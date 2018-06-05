import CryptoJS from "crypto-js";
import _ from "lodash";
import { broadcastLatest, broadCastTransactionPool } from "./p2p";
import {
  getCoinbaseTransaction,
  isValidAddress,
  processTransactions,
  Transaction,
  UnspentTxOut
} from "./transaction";
import {
  addToTransactionPool,
  getTransactionPool,
  updateTransactionPool
} from "./transactionPool";
import { hexToBinary } from "./utils";
import {
  createTransaction,
  findUnspentTxOuts,
  getBalance,
  getPrivateFromWallet,
  getPublicFromWallet
} from "./wallet";

// Block Definition
class Block {
  public index: number;
  public hash: string;
  public previousHash: string;
  public timestamp: number;
  public data: Transaction[];
  public difficulty: number;
  public nonce: number;

  constructor(
    index: number,
    hash: string,
    previousHash: string,
    timestamp: number,
    data: Transaction[],
    difficulty: number,
    nonce: number
  ) {
    this.index = index;
    this.hash = hash;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.data = data;
    this.difficulty = difficulty;
    this.nonce = nonce;
  }
}

// genesis Transaction
const genesisTransaction = {
  txIns: [{ signature: "", txOutId: "", txOutIndex: 0 }],
  txOuts: [
    {
      address:
        "04bfcab8722991ae774db48f934ca79cfb7dd991229153b9f732ba5334aafcd8e7266e47076996b55a14bf9913ee3145ce0cfc1372ada8ada74bd287450313534a",
      amount: 50
    }
  ],
  id: "e655f6a5f26dc9b4cac6e46f52336428287759cf81ef5ff10854f69d68f43fa3"
};

// Genesis Block: 1st block
const genesisBlock: Block = new Block(
  0,
  "816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7",
  "0",
  1465154705,
  [genesisTransaction],
  10,
  0
);

// defines how often a block should be found, 10 Minutes
const BLOCK_GENERATION_INTERVAL: number = 10;

// defines how often the difficulty should adjust to the increasing or decreasing network hashrate.
const DIFFICULTY_ADJUSTMENT_INTERVAL: number = 10;

// The Main BlockChain
let blockchain: Block[] = [genesisBlock];

// Unspent Transaction outputs
let unspentTxOuts: any = processTransactions(blockchain[0].data, [], 0);

// get the last block
const getLatestBlock = (): Block => blockchain[blockchain.length - 1];

// Get the blockchain
const getBlockchain = (): Block[] => blockchain;

const getUnspentTxOuts = (): UnspentTxOut[] => _.cloneDeep(unspentTxOuts);

// and txPool should be only updated at the same time
const setUnspentTxOuts = (newUnspentTxOut: UnspentTxOut[]) => {
  console.log("replacing unspentTxouts with: %s", newUnspentTxOut);
  unspentTxOuts = newUnspentTxOut;
};

// Get current timestamp
const getCurrentTimestamp = (): number =>
  Math.round(new Date().getTime() / 1000);

// Calculating the Hash
const calculateHash = (
  index: number,
  previousHash: string,
  timestamp: number,
  data: Transaction[],
  difficulty: number,
  nonce: number
): string =>
  CryptoJS.SHA256(
    index + previousHash + timestamp + data + difficulty + nonce
  ).toString();

// Adding Block in blockchain after validation
const addBlock = (newBlock: Block) => {
  if (isValidNewBlock(newBlock, getLatestBlock())) {
    blockchain.push(newBlock);
  }
};

// Get Difficulty Value in each interval
const getDifficulty = (aBlockchain: Block[]): number => {
  const latestBlock: Block = aBlockchain[blockchain.length - 1];
  if (
    latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 &&
    latestBlock.index !== 0
  ) {
    return getAdjustedDifficulty(latestBlock, aBlockchain);
  } else {
    return latestBlock.difficulty;
  }
};

// Adjust difficilty Value
const getAdjustedDifficulty = (latestBlock: Block, aBlockchain: Block[]) => {
  const prevAdjustmentBlock: Block =
    aBlockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
  const timeExpected: number =
    BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
  const timeTaken: number =
    latestBlock.timestamp - prevAdjustmentBlock.timestamp;
  if (timeTaken < timeExpected / 2) {
    return prevAdjustmentBlock.difficulty + 1;
  } else if (timeTaken > timeExpected * 2) {
    return prevAdjustmentBlock.difficulty - 1;
  } else {
    return prevAdjustmentBlock.difficulty;
  }
};

const getMyUnspentTransactionOutputs = () => {
  return findUnspentTxOuts(getPublicFromWallet(), getUnspentTxOuts());
};

// Generate the next Raw Block, add and broadcast
const generateRawNextBlock = (blockData: Transaction[]) => {
  const previousBlock: Block = getLatestBlock();
  const difficulty: number = getDifficulty(getBlockchain());
  const nextIndex: number = previousBlock.index + 1;
  const nextTimestamp: number = getCurrentTimestamp();
  const newBlock: Block = findBlock(
    nextIndex,
    previousBlock.hash,
    nextTimestamp,
    blockData,
    difficulty
  );
  if (addBlockToChain(newBlock)) {
    broadcastLatest();
    return newBlock;
  } else {
    return null;
  }
};

// Generate Next Block
const generateNextBlock = () => {
  const coinbaseTx: Transaction = getCoinbaseTransaction(
    getPublicFromWallet(),
    getLatestBlock().index + 1
  );
  const blockData: Transaction[] = [coinbaseTx].concat(getTransactionPool());
  return generateRawNextBlock(blockData);
};

// Generate Next block with Transaction
const generateNextBlockWithTransaction = (
  receiverAddress: string,
  amount: number
) => {
  if (!isValidAddress(receiverAddress)) {
    throw Error("invalid address");
  }
  if (typeof amount !== "number") {
    throw Error("invalid amount");
  }
  const coinbaseTx: Transaction = getCoinbaseTransaction(
    getPublicFromWallet(),
    getLatestBlock().index + 1
  );
  const tx: Transaction = createTransaction(
    receiverAddress,
    amount,
    getPrivateFromWallet(),
    getUnspentTxOuts(),
    getTransactionPool()
  );
  const blockData: Transaction[] = [coinbaseTx, tx];
  return generateRawNextBlock(blockData);
};

// Finding the valid block by adjusting nonce value
const findBlock = (
  index: number,
  previousHash: string,
  timestamp: number,
  data: Transaction[],
  difficulty: number
): Block => {
  let nonce = 0;
  while (true) {
    const hash: string = calculateHash(
      index,
      previousHash,
      timestamp,
      data,
      difficulty,
      nonce
    );
    if (hashMatchesDifficulty(hash, difficulty)) {
      return new Block(
        index,
        hash,
        previousHash,
        timestamp,
        data,
        difficulty,
        nonce
      );
    }
    nonce++;
  }
};

const getAccountBalance = (): number => {
  return getBalance(getPublicFromWallet(), getUnspentTxOuts());
};

const sendTransaction = (address: string, amount: number): Transaction => {
  const tx: Transaction = createTransaction(
    address,
    amount,
    getPrivateFromWallet(),
    getUnspentTxOuts(),
    getTransactionPool()
  );
  addToTransactionPool(tx, getUnspentTxOuts());
  broadCastTransactionPool();
  return tx;
};

// calculating hash for a block
const calculateHashForBlock = (block: Block): string =>
  calculateHash(
    block.index,
    block.previousHash,
    block.timestamp,
    block.data,
    block.difficulty,
    block.nonce
  );

// Validate TimeStamp to prevent difficulty adjustment attack
const isValidTimestamp = (newBlock: Block, previousBlock: Block): boolean => {
  return (
    previousBlock.timestamp - 60 < newBlock.timestamp &&
    newBlock.timestamp - 60 < getCurrentTimestamp()
  );
};

// Validate the new block
const isValidNewBlock = (newBlock: Block, previousBlock: Block): boolean => {
  if (!isValidBlockStructure(newBlock)) {
    console.log("invalid block structure: %s", JSON.stringify(newBlock));
    return false;
  }
  if (previousBlock.index + 1 !== newBlock.index) {
    console.log("invalid index");
    return false;
  } else if (previousBlock.hash !== newBlock.previousHash) {
    console.log("invalid previoushash");
    return false;
  } else if (!isValidTimestamp(newBlock, previousBlock)) {
    console.log("invalid timestamp");
    return false;
  } else if (!hasValidHash(newBlock)) {
    return false;
  }
  return true;
};

// validating block structure
const isValidBlockStructure = (block: Block): boolean => {
  return (
    typeof block.index === "number" &&
    typeof block.hash === "string" &&
    typeof block.previousHash === "string" &&
    typeof block.timestamp === "number" &&
    typeof block.data === "object"
  );
};

// validating hash
const hasValidHash = (block: Block): boolean => {
  if (!hashMatchesBlockContent(block)) {
    console.log("invalid hash, got:" + block.hash);
    return false;
  }

  if (!hashMatchesDifficulty(block.hash, block.difficulty)) {
    console.log(
      "block difficulty not satisfied. Expected: " +
        block.difficulty +
        "got: " +
        block.hash
    );
  }
  return true;
};

// validating block content
const hashMatchesBlockContent = (block: Block): boolean => {
  const blockHash: string = calculateHashForBlock(block);
  return blockHash === block.hash;
};

// Valididating difficulty
const hashMatchesDifficulty = (hash: string, difficulty: number): boolean => {
  const hashInBinary: string = hexToBinary(hash);
  const requiredPrefix: string = "0".repeat(difficulty);
  return hashInBinary.startsWith(requiredPrefix);
};

// Validating block chain
const isValidChain = (blockchainToValidate: Block[]): any => {
  console.log("isValidChain:");
  console.log(JSON.stringify(blockchainToValidate));
  const isValidGenesis = (block: Block): boolean => {
    return JSON.stringify(block) === JSON.stringify(genesisBlock);
  };

  if (!isValidGenesis(blockchainToValidate[0])) {
    return null;
  }
  /*
  Validate each block in the chain. The block is valid if the block structure is valid
    and the transaction are valid
   */
  let aUnspentTxOuts: any = [];

  for (let i = 0; i < blockchainToValidate.length; i++) {
    const currentBlock: Block = blockchainToValidate[i];
    if (
      i !== 0 &&
      !isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])
    ) {
      return null;
    }

    aUnspentTxOuts = processTransactions(
      currentBlock.data,
      aUnspentTxOuts,
      currentBlock.index
    );
    if (aUnspentTxOuts === null) {
      console.log("invalid transactions in blockchain");
      return null;
    }
  }
  return aUnspentTxOuts;
};

// Adding block to bhockchain
const addBlockToChain = (newBlock: Block): boolean => {
  if (isValidNewBlock(newBlock, getLatestBlock())) {
    const retVal: any = processTransactions(
      newBlock.data,
      getUnspentTxOuts(),
      newBlock.index
    );
    if (retVal === null) {
      console.log("block is not valid in terms of transactions");
      return false;
    } else {
      blockchain.push(newBlock);
      setUnspentTxOuts(retVal);
      updateTransactionPool(unspentTxOuts);
      return true;
    }
  }
  return false;
};

// Choosing the cummulative difficulty chain rather than longest one.
const getAccumulatedDifficulty = (aBlockchain: Block[]): number => {
  return aBlockchain
    .map(block => block.difficulty)
    .map(difficulty => Math.pow(2, difficulty))
    .reduce((a, b) => a + b);
};

// replacing the blockchain
const replaceChain = (newBlocks: Block[]) => {
  const aUnspentTxOuts = isValidChain(newBlocks);
  const validChain: boolean = aUnspentTxOuts !== null;
  if (
    validChain &&
    getAccumulatedDifficulty(newBlocks) >
      getAccumulatedDifficulty(getBlockchain())
  ) {
    console.log(
      "Received blockchain is valid. Replacing current blockchain with received blockchain"
    );
    blockchain = newBlocks;
    setUnspentTxOuts(aUnspentTxOuts);
    updateTransactionPool(unspentTxOuts);
    broadcastLatest();
  } else {
    console.log("Received blockchain invalid");
  }
};

const handleReceivedTransaction = (transaction: Transaction) => {
  addToTransactionPool(transaction, getUnspentTxOuts());
};

export {
  Block,
  getBlockchain,
  getUnspentTxOuts,
  getLatestBlock,
  sendTransaction,
  generateRawNextBlock,
  generateNextBlock,
  generateNextBlockWithTransaction,
  handleReceivedTransaction,
  getMyUnspentTransactionOutputs,
  getAccountBalance,
  isValidBlockStructure,
  replaceChain,
  addBlockToChain
};
