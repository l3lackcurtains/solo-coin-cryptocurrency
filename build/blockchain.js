"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var crypto_js_1 = __importDefault(require("crypto-js"));
var p2p_1 = require("./p2p");
var utils_1 = require("./utils");
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
// Genesis Block: 1st block
var genesisBlock = new Block(0, "816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7", "0", 1465154705, "GENESIS BLOCK", 10, 0);
// defines how often a block should be found, 10 Minutes
var BLOCK_GENERATION_INTERVAL = 10;
// defines how often the difficulty should adjust to the increasing or decreasing network hashrate.
var DIFFICULTY_ADJUSTMENT_INTERVAL = 10;
// The Main BlockChain
var blockchain = [genesisBlock];
// get the last block
var getLatestBlock = function () { return blockchain[blockchain.length - 1]; };
exports.getLatestBlock = getLatestBlock;
// Get the blockchain
var getBlockchain = function () { return blockchain; };
exports.getBlockchain = getBlockchain;
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
    var latestBlock = aBlockchain[aBlockchain.length - 1];
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
    var prevAdjustmentBlock = aBlockchain[aBlockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
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
// Generate the next Block, add and broadcast
var generateNextBlock = function (blockData) {
    var previousBlock = getLatestBlock();
    var difficilty = getDifficulty(getBlockchain());
    console.log("[^] Difficulty: ", difficilty);
    var nextIndex = previousBlock.index + 1;
    var nextTimestamp = getCurrentTimestamp();
    var newBlock = findBlock(nextIndex, previousBlock.hash, nextTimestamp, blockData, difficilty);
    addBlock(newBlock);
    p2p_1.broadcastLatest();
    return newBlock;
};
exports.generateNextBlock = generateNextBlock;
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
    if (previousBlock.index + 1 !== newBlock.index) {
        console.log("Invalid Block index");
        return false;
    }
    if (previousBlock.hash !== newBlock.previousHash) {
        console.log("Invalid Previous Block Hash");
        return false;
    }
    if (calculateHashForBlock(newBlock) !== newBlock.hash) {
        console.log("Invalid Hash");
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
        typeof block.data === "string");
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
    var isValidGenesis = function (block) {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    };
    if (!isValidGenesis(blockchainToValidate[0])) {
        return false;
    }
    for (var i = 1; i < blockchainToValidate.length; i++) {
        if (!isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])) {
            return false;
        }
    }
    return true;
};
// Adding block to bhockchain
var addBlockToChain = function (newBlock) {
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        blockchain.push(newBlock);
        return true;
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
    if (isValidChain(newBlocks) &&
        getAccumulatedDifficulty(newBlocks) >
            getAccumulatedDifficulty(getBlockchain())) {
        console.log("Received blockchain is valid. Replacing current blockchain with received blockchain");
        blockchain = newBlocks;
        p2p_1.broadcastLatest();
    }
    else {
        console.log("Received blockchain invalid");
    }
};
exports.replaceChain = replaceChain;
