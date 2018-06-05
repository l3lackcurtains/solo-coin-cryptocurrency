"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var crypto_js_1 = __importDefault(require("crypto-js"));
var lodash_1 = __importDefault(require("lodash"));
var p2p_1 = require("./p2p");
var transaction_1 = require("./transaction");
var transactionPool_1 = require("./transactionPool");
var utils_1 = require("./utils");
var wallet_1 = require("./wallet");
// Block Definition
var Block = /** @class */ (function () {
    function Block(index, hash, previousHash, timestamp, data, difficulty, nonce) {
        this.index = index;
        this.hash = hash;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.difficulty = difficulty;
        this.nonce = nonce;
    }
    return Block;
}());
exports.Block = Block;
// genesis Transaction
var genesisTransaction = {
    txIns: [{ signature: "", txOutId: "", txOutIndex: 0 }],
    txOuts: [
        {
            address: "04bfcab8722991ae774db48f934ca79cfb7dd991229153b9f732ba5334aafcd8e7266e47076996b55a14bf9913ee3145ce0cfc1372ada8ada74bd287450313534a",
            amount: 50
        }
    ],
    id: "e655f6a5f26dc9b4cac6e46f52336428287759cf81ef5ff10854f69d68f43fa3"
};
// Genesis Block: 1st block
var genesisBlock = new Block(0, "816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7", "0", 1465154705, [genesisTransaction], 10, 0);
// defines how often a block should be found, 10 Minutes
var BLOCK_GENERATION_INTERVAL = 10;
// defines how often the difficulty should adjust to the increasing or decreasing network hashrate.
var DIFFICULTY_ADJUSTMENT_INTERVAL = 10;
// The Main BlockChain
var blockchain = [genesisBlock];
// Unspent Transaction outputs
var unspentTxOuts = transaction_1.processTransactions(blockchain[0].data, [], 0);
// get the last block
var getLatestBlock = function () { return blockchain[blockchain.length - 1]; };
exports.getLatestBlock = getLatestBlock;
// Get the blockchain
var getBlockchain = function () { return blockchain; };
exports.getBlockchain = getBlockchain;
var getUnspentTxOuts = function () { return lodash_1.default.cloneDeep(unspentTxOuts); };
exports.getUnspentTxOuts = getUnspentTxOuts;
// and txPool should be only updated at the same time
var setUnspentTxOuts = function (newUnspentTxOut) {
    console.log("replacing unspentTxouts with: %s", newUnspentTxOut);
    unspentTxOuts = newUnspentTxOut;
};
// Get current timestamp
var getCurrentTimestamp = function () {
    return Math.round(new Date().getTime() / 1000);
};
// Calculating the Hash
var calculateHash = function (index, previousHash, timestamp, data, difficulty, nonce) {
    return crypto_js_1.default.SHA256(index + previousHash + timestamp + data + difficulty + nonce).toString();
};
// Adding Block in blockchain after validation
var addBlock = function (newBlock) {
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        blockchain.push(newBlock);
    }
};
// Get Difficulty Value in each interval
var getDifficulty = function (aBlockchain) {
    var latestBlock = aBlockchain[blockchain.length - 1];
    if (latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 &&
        latestBlock.index !== 0) {
        return getAdjustedDifficulty(latestBlock, aBlockchain);
    }
    else {
        return latestBlock.difficulty;
    }
};
// Adjust difficilty Value
var getAdjustedDifficulty = function (latestBlock, aBlockchain) {
    var prevAdjustmentBlock = aBlockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
    var timeExpected = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
    var timeTaken = latestBlock.timestamp - prevAdjustmentBlock.timestamp;
    if (timeTaken < timeExpected / 2) {
        return prevAdjustmentBlock.difficulty + 1;
    }
    else if (timeTaken > timeExpected * 2) {
        return prevAdjustmentBlock.difficulty - 1;
    }
    else {
        return prevAdjustmentBlock.difficulty;
    }
};
var getMyUnspentTransactionOutputs = function () {
    return wallet_1.findUnspentTxOuts(wallet_1.getPublicFromWallet(), getUnspentTxOuts());
};
exports.getMyUnspentTransactionOutputs = getMyUnspentTransactionOutputs;
// Generate the next Raw Block, add and broadcast
var generateRawNextBlock = function (blockData) {
    var previousBlock = getLatestBlock();
    var difficulty = getDifficulty(getBlockchain());
    var nextIndex = previousBlock.index + 1;
    var nextTimestamp = getCurrentTimestamp();
    var newBlock = findBlock(nextIndex, previousBlock.hash, nextTimestamp, blockData, difficulty);
    if (addBlockToChain(newBlock)) {
        p2p_1.broadcastLatest();
        return newBlock;
    }
    else {
        return null;
    }
};
exports.generateRawNextBlock = generateRawNextBlock;
// Generate Next Block
var generateNextBlock = function () {
    var coinbaseTx = transaction_1.getCoinbaseTransaction(wallet_1.getPublicFromWallet(), getLatestBlock().index + 1);
    var blockData = [coinbaseTx].concat(transactionPool_1.getTransactionPool());
    return generateRawNextBlock(blockData);
};
exports.generateNextBlock = generateNextBlock;
// Generate Next block with Transaction
var generateNextBlockWithTransaction = function (receiverAddress, amount) {
    if (!transaction_1.isValidAddress(receiverAddress)) {
        throw Error("invalid address");
    }
    if (typeof amount !== "number") {
        throw Error("invalid amount");
    }
    var coinbaseTx = transaction_1.getCoinbaseTransaction(wallet_1.getPublicFromWallet(), getLatestBlock().index + 1);
    var tx = wallet_1.createTransaction(receiverAddress, amount, wallet_1.getPrivateFromWallet(), getUnspentTxOuts(), transactionPool_1.getTransactionPool());
    var blockData = [coinbaseTx, tx];
    return generateRawNextBlock(blockData);
};
exports.generateNextBlockWithTransaction = generateNextBlockWithTransaction;
// Finding the valid block by adjusting nonce value
var findBlock = function (index, previousHash, timestamp, data, difficulty) {
    var nonce = 0;
    while (true) {
        var hash = calculateHash(index, previousHash, timestamp, data, difficulty, nonce);
        if (hashMatchesDifficulty(hash, difficulty)) {
            return new Block(index, hash, previousHash, timestamp, data, difficulty, nonce);
        }
        nonce++;
    }
};
var getAccountBalance = function () {
    return wallet_1.getBalance(wallet_1.getPublicFromWallet(), getUnspentTxOuts());
};
exports.getAccountBalance = getAccountBalance;
var sendTransaction = function (address, amount) {
    var tx = wallet_1.createTransaction(address, amount, wallet_1.getPrivateFromWallet(), getUnspentTxOuts(), transactionPool_1.getTransactionPool());
    transactionPool_1.addToTransactionPool(tx, getUnspentTxOuts());
    p2p_1.broadCastTransactionPool();
    return tx;
};
exports.sendTransaction = sendTransaction;
// calculating hash for a block
var calculateHashForBlock = function (block) {
    return calculateHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce);
};
// Validate TimeStamp to prevent difficulty adjustment attack
var isValidTimestamp = function (newBlock, previousBlock) {
    return (previousBlock.timestamp - 60 < newBlock.timestamp &&
        newBlock.timestamp - 60 < getCurrentTimestamp());
};
// Validate the new block
var isValidNewBlock = function (newBlock, previousBlock) {
    if (!isValidBlockStructure(newBlock)) {
        console.log("invalid block structure: %s", JSON.stringify(newBlock));
        return false;
    }
    if (previousBlock.index + 1 !== newBlock.index) {
        console.log("invalid index");
        return false;
    }
    else if (previousBlock.hash !== newBlock.previousHash) {
        console.log("invalid previoushash");
        return false;
    }
    else if (!isValidTimestamp(newBlock, previousBlock)) {
        console.log("invalid timestamp");
        return false;
    }
    else if (!hasValidHash(newBlock)) {
        return false;
    }
    return true;
};
// validating block structure
var isValidBlockStructure = function (block) {
    return (typeof block.index === "number" &&
        typeof block.hash === "string" &&
        typeof block.previousHash === "string" &&
        typeof block.timestamp === "number" &&
        typeof block.data === "object");
};
exports.isValidBlockStructure = isValidBlockStructure;
// validating hash
var hasValidHash = function (block) {
    if (!hashMatchesBlockContent(block)) {
        console.log("invalid hash, got:" + block.hash);
        return false;
    }
    if (!hashMatchesDifficulty(block.hash, block.difficulty)) {
        console.log("block difficulty not satisfied. Expected: " +
            block.difficulty +
            "got: " +
            block.hash);
    }
    return true;
};
// validating block content
var hashMatchesBlockContent = function (block) {
    var blockHash = calculateHashForBlock(block);
    return blockHash === block.hash;
};
// Valididating difficulty
var hashMatchesDifficulty = function (hash, difficulty) {
    var hashInBinary = utils_1.hexToBinary(hash);
    var requiredPrefix = "0".repeat(difficulty);
    return hashInBinary.startsWith(requiredPrefix);
};
// Validating block chain
var isValidChain = function (blockchainToValidate) {
    console.log("isValidChain:");
    console.log(JSON.stringify(blockchainToValidate));
    var isValidGenesis = function (block) {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    };
    if (!isValidGenesis(blockchainToValidate[0])) {
        return null;
    }
    /*
    Validate each block in the chain. The block is valid if the block structure is valid
      and the transaction are valid
     */
    var aUnspentTxOuts = [];
    for (var i = 0; i < blockchainToValidate.length; i++) {
        var currentBlock = blockchainToValidate[i];
        if (i !== 0 &&
            !isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])) {
            return null;
        }
        aUnspentTxOuts = transaction_1.processTransactions(currentBlock.data, aUnspentTxOuts, currentBlock.index);
        if (aUnspentTxOuts === null) {
            console.log("invalid transactions in blockchain");
            return null;
        }
    }
    return aUnspentTxOuts;
};
// Adding block to bhockchain
var addBlockToChain = function (newBlock) {
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        var retVal = transaction_1.processTransactions(newBlock.data, getUnspentTxOuts(), newBlock.index);
        if (retVal === null) {
            console.log("block is not valid in terms of transactions");
            return false;
        }
        else {
            blockchain.push(newBlock);
            setUnspentTxOuts(retVal);
            transactionPool_1.updateTransactionPool(unspentTxOuts);
            return true;
        }
    }
    return false;
};
exports.addBlockToChain = addBlockToChain;
// Choosing the cummulative difficulty chain rather than longest one.
var getAccumulatedDifficulty = function (aBlockchain) {
    return aBlockchain
        .map(function (block) { return block.difficulty; })
        .map(function (difficulty) { return Math.pow(2, difficulty); })
        .reduce(function (a, b) { return a + b; });
};
// replacing the blockchain
var replaceChain = function (newBlocks) {
    var aUnspentTxOuts = isValidChain(newBlocks);
    var validChain = aUnspentTxOuts !== null;
    if (validChain &&
        getAccumulatedDifficulty(newBlocks) >
            getAccumulatedDifficulty(getBlockchain())) {
        console.log("Received blockchain is valid. Replacing current blockchain with received blockchain");
        blockchain = newBlocks;
        setUnspentTxOuts(aUnspentTxOuts);
        transactionPool_1.updateTransactionPool(unspentTxOuts);
        p2p_1.broadcastLatest();
    }
    else {
        console.log("Received blockchain invalid");
    }
};
exports.replaceChain = replaceChain;
var handleReceivedTransaction = function (transaction) {
    transactionPool_1.addToTransactionPool(transaction, getUnspentTxOuts());
};
exports.handleReceivedTransaction = handleReceivedTransaction;
