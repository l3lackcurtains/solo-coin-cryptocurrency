"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var lodash_1 = __importDefault(require("lodash"));
var transaction_1 = require("./transaction");
var transactionPool = [];
var getTransactionPool = function () {
    return lodash_1.default.cloneDeep(transactionPool);
};
exports.getTransactionPool = getTransactionPool;
var addToTransactionPool = function (tx, unspentTxOuts) {
    if (!transaction_1.validateTransaction(tx, unspentTxOuts)) {
        throw Error("Trying to add invalid tx to pool");
    }
    if (!isValidTxForPool(tx, transactionPool)) {
        throw Error("Trying to add invalid tx to pool");
    }
    console.log("adding to txPool: %s", JSON.stringify(tx));
    transactionPool.push(tx);
};
exports.addToTransactionPool = addToTransactionPool;
var hasTxIn = function (txIn, unspentTxOuts) {
    var foundTxIn = unspentTxOuts.find(function (uTxO) {
        return uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex;
    });
    return foundTxIn !== undefined;
};
var updateTransactionPool = function (unspentTxOuts) {
    var invalidTxs = [];
    for (var _i = 0, transactionPool_1 = transactionPool; _i < transactionPool_1.length; _i++) {
        var tx = transactionPool_1[_i];
        for (var _a = 0, _b = tx.txIns; _a < _b.length; _a++) {
            var txIn = _b[_a];
            if (!hasTxIn(txIn, unspentTxOuts)) {
                invalidTxs.push(tx);
                break;
            }
        }
    }
    if (invalidTxs.length > 0) {
        console.log("removing the following transactions from txPool: %s", JSON.stringify(invalidTxs));
        transactionPool = lodash_1.default.without.apply(lodash_1.default, [transactionPool].concat(invalidTxs));
    }
};
exports.updateTransactionPool = updateTransactionPool;
var getTxPoolIns = function (aTransactionPool) {
    return lodash_1.default(aTransactionPool)
        .map(function (tx) { return tx.txIns; })
        .flatten()
        .value();
};
var isValidTxForPool = function (tx, aTtransactionPool) {
    var txPoolIns = getTxPoolIns(aTtransactionPool);
    var containsTxIn = function (txIns, txIn) {
        return lodash_1.default.find(txPoolIns, function (txPoolIn) {
            return (txIn.txOutIndex === txPoolIn.txOutIndex &&
                txIn.txOutId === txPoolIn.txOutId);
        });
    };
    for (var _i = 0, _a = tx.txIns; _i < _a.length; _i++) {
        var txIn = _a[_i];
        if (containsTxIn(txPoolIns, txIn)) {
            console.log("txIn already found in the txPool");
            return false;
        }
    }
    return true;
};
