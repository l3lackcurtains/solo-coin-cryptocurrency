"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var crypto_js_1 = __importDefault(require("crypto-js"));
var elliptic_1 = __importDefault(require("elliptic"));
var lodash_1 = __importDefault(require("lodash"));
var ec = new elliptic_1.default.ec("secp256k1");
var COINBASE_AMOUNT = 50;
var TxOut = /** @class */ (function () {
    function TxOut(address, amount) {
        this.address = address;
        this.amount = amount;
    }
    return TxOut;
}());
exports.TxOut = TxOut;
var TxIn = /** @class */ (function () {
    function TxIn() {
    }
    return TxIn;
}());
exports.TxIn = TxIn;
var Transaction = /** @class */ (function () {
    function Transaction() {
    }
    return Transaction;
}());
exports.Transaction = Transaction;
var UnspentTxOut = /** @class */ (function () {
    function UnspentTxOut(txOutId, txOutIndex, address, amount) {
        this.txOutId = txOutId;
        this.txOutIndex = txOutIndex;
        this.address = address;
        this.amount = amount;
    }
    return UnspentTxOut;
}());
exports.UnspentTxOut = UnspentTxOut;
var unspentTxOuts = [];
var getTransactionId = function (transaction) {
    var txInContent = transaction.txIns
        .map(function (txIn) { return txIn.txOutId + txIn.txOutIndex; })
        .reduce(function (a, b) { return a + b; }, "");
    var txOutContent = transaction.txOuts
        .map(function (txOut) { return txOut.address + txOut.amount; })
        .reduce(function (a, b) { return a + b; }, "");
    return crypto_js_1.default.SHA256(txInContent + txOutContent).toString();
};
exports.getTransactionId = getTransactionId;
var validateTransaction = function (transaction, aUnspentTxOuts) {
    if (getTransactionId(transaction) !== transaction.id) {
        console.log("invalid tx id: " + transaction.id);
        return false;
    }
    var hasValidTxIns = transaction.txIns
        .map(function (txIn) { return validateTxIn(txIn, transaction, aUnspentTxOuts); })
        .reduce(function (a, b) { return a && b; }, true);
    if (!hasValidTxIns) {
        console.log("some of the txIns are invalid in tx: " + transaction.id);
        return false;
    }
    var totalTxInValues = transaction.txIns
        .map(function (txIn) { return getTxInAmount(txIn, aUnspentTxOuts); })
        .reduce(function (a, b) { return a + b; }, 0);
    var totalTxOutValues = transaction.txOuts
        .map(function (txOut) { return txOut.amount; })
        .reduce(function (a, b) { return a + b; }, 0);
    if (totalTxOutValues !== totalTxInValues) {
        console.log("totalTxOutValues !== totalTxInValues in tx: " + transaction.id);
        return false;
    }
    return true;
};
exports.validateTransaction = validateTransaction;
var validateBlockTransactions = function (aTransactions, aUnspentTxOuts, blockIndex) {
    var coinbaseTx = aTransactions[0];
    if (!validateCoinbaseTx(coinbaseTx, blockIndex)) {
        console.log("invalid coinbase transaction: " + JSON.stringify(coinbaseTx));
        return false;
    }
    //check for duplicate txIns. Each txIn can be included only once
    var txIns = lodash_1.default(aTransactions)
        .map(function (tx) { return tx.txIns; })
        .flatten()
        .value();
    if (hasDuplicates(txIns)) {
        return false;
    }
    // all but coinbase transactions
    var normalTransactions = aTransactions.slice(1);
    return normalTransactions
        .map(function (tx) { return validateTransaction(tx, aUnspentTxOuts); })
        .reduce(function (a, b) { return a && b; }, true);
};
var hasDuplicates = function (txIns) {
    var groups = lodash_1.default.countBy(function (txIns, txIn) { return txIn.txOutId + txIn.txOutId; });
    return lodash_1.default(groups)
        .map(function (value, key) {
        if (value > 1) {
            console.log("duplicate txIn: " + key);
            return true;
        }
        else {
            return false;
        }
    })
        .includes(true);
};
var validateCoinbaseTx = function (transaction, blockIndex) {
    if (transaction == null) {
        console.log("the first transaction in the block must be coinbase transaction");
        return false;
    }
    if (getTransactionId(transaction) !== transaction.id) {
        console.log("invalid coinbase tx id: " + transaction.id);
        return false;
    }
    if (transaction.txIns.length !== 1) {
        console.log("one txIn must be specified in the coinbase transaction");
        return false;
    }
    if (transaction.txIns[0].txOutIndex !== blockIndex) {
        console.log("the txIn signature in coinbase tx must be the block height");
        return false;
    }
    if (transaction.txOuts.length !== 1) {
        console.log("invalid number of txOuts in coinbase transaction");
        return false;
    }
    if (transaction.txOuts[0].amount != COINBASE_AMOUNT) {
        console.log("invalid coinbase amount in coinbase transaction");
        return false;
    }
    return true;
};
var validateTxIn = function (txIn, transaction, aUnspentTxOuts) {
    var referencedUTxOut = aUnspentTxOuts.find(function (uTxO) { return uTxO.txOutId === txIn.txOutId && uTxO.txOutId === txIn.txOutId; });
    if (referencedUTxOut == null) {
        console.log("referenced txOut not found: " + JSON.stringify(txIn));
        return false;
    }
    var address = referencedUTxOut.address;
    var key = ec.keyFromPublic(address, "hex");
    return key.verify(transaction.id, txIn.signature);
};
var getTxInAmount = function (txIn, aUnspentTxOuts) {
    return findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts).amount;
};
var findUnspentTxOut = function (transactionId, index, aUnspentTxOuts) {
    return aUnspentTxOuts.find(function (uTxO) { return uTxO.txOutId === transactionId && uTxO.txOutIndex === index; });
};
var getCoinbaseTransaction = function (address, blockIndex) {
    var t = new Transaction();
    var txIn = new TxIn();
    txIn.signature = "";
    txIn.txOutId = "";
    txIn.txOutIndex = blockIndex;
    t.txIns = [txIn];
    t.txOuts = [new TxOut(address, COINBASE_AMOUNT)];
    t.id = getTransactionId(t);
    return t;
};
exports.getCoinbaseTransaction = getCoinbaseTransaction;
var signTxIn = function (transaction, txInIndex, privateKey, aUnspentTxOuts) {
    var txIn = transaction.txIns[txInIndex];
    var dataToSign = transaction.id;
    var referencedUnspentTxOut = findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts);
    var referenceAddress = referencedUnspentTxOut.address;
    var key = ec.keyFromPrivate(privateKey, "hex");
    var signature = toHexString(key.sign(dataToSign).toDER());
    return signature;
};
exports.signTxIn = signTxIn;
var updateUnspentTxOuts = function (newTransactions, aUnspentTxOuts) {
    var newUnspentTxOuts = newTransactions
        .map(function (t) {
        return t.txOuts.map(function (txOut, index) {
            return new UnspentTxOut(t.id, index, txOut.address, txOut.amount);
        });
    })
        .reduce(function (a, b) { return a.concat(b); }, []);
    var consumedTxOuts = newTransactions
        .map(function (t) { return t.txIns; })
        .reduce(function (a, b) { return a.concat(b); }, [])
        .map(function (txIn) { return new UnspentTxOut(txIn.txOutId, txIn.txOutIndex, "", 0); });
    var resultingUnspentTxOuts = aUnspentTxOuts
        .filter(function (uTxO) { return !findUnspentTxOut(uTxO.txOutId, uTxO.txOutIndex, consumedTxOuts); })
        .concat(newUnspentTxOuts);
    return resultingUnspentTxOuts;
};
var processTransactions = function (aTransactions, aUnspentTxOuts, blockIndex) {
    if (!isValidTransactionsStructure(aTransactions)) {
        return null;
    }
    if (!validateBlockTransactions(aTransactions, aUnspentTxOuts, blockIndex)) {
        console.log("invalid block transactions");
        return null;
    }
    return updateUnspentTxOuts(aTransactions, aUnspentTxOuts);
};
exports.processTransactions = processTransactions;
var toHexString = function (byteArray) {
    return Array.from(byteArray, function (byte) {
        return ("0" + (byte & 0xff).toString(16)).slice(-2);
    }).join("");
};
var getPublicKey = function (aPrivateKey) {
    return ec
        .keyFromPrivate(aPrivateKey, "hex")
        .getPublic()
        .encode("hex");
};
exports.getPublicKey = getPublicKey;
var isValidTxInStructure = function (txIn) {
    if (txIn == null) {
        console.log("txIn is null");
        return false;
    }
    else if (typeof txIn.signature !== "string") {
        console.log("invalid signature type in txIn");
        return false;
    }
    else if (typeof txIn.txOutId !== "string") {
        console.log("invalid txOutId type in txIn");
        return false;
    }
    else if (typeof txIn.txOutIndex !== "number") {
        console.log("invalid txOutIndex type in txIn");
        return false;
    }
    else {
        return true;
    }
};
var isValidTxOutStructure = function (txOut) {
    if (txOut == null) {
        console.log("txOut is null");
        return false;
    }
    else if (typeof txOut.address !== "string") {
        console.log("invalid address type in txOut");
        return false;
    }
    else if (!isValidAddress(txOut.address)) {
        console.log("invalid TxOut address");
        return false;
    }
    else if (typeof txOut.amount !== "number") {
        console.log("invalid amount type in txOut");
        return false;
    }
    else {
        return true;
    }
};
var isValidTransactionsStructure = function (transactions) {
    return transactions
        .map(isValidTransactionStructure)
        .reduce(function (a, b) { return a && b; }, true);
};
var isValidTransactionStructure = function (transaction) {
    if (typeof transaction.id !== "string") {
        console.log("transactionId missing");
        return false;
    }
    if (!(transaction.txIns instanceof Array)) {
        console.log("invalid txIns type in transaction");
        return false;
    }
    if (!transaction.txIns.map(isValidTxInStructure).reduce(function (a, b) { return a && b; }, true)) {
        return false;
    }
    if (!(transaction.txOuts instanceof Array)) {
        console.log("invalid txIns type in transaction");
        return false;
    }
    if (!transaction.txOuts
        .map(isValidTxOutStructure)
        .reduce(function (a, b) { return a && b; }, true)) {
        return false;
    }
    return true;
};
//valid address is a valid ecdsa public key in the 04 + X-coordinate + Y-coordinate format
var isValidAddress = function (address) {
    if (address.length !== 130) {
        console.log("invalid public key length");
        return false;
    }
    else if (address.match("^[a-fA-F0-9]+$") === null) {
        console.log("public key must contain only hex characters");
        return false;
    }
    else if (!address.startsWith("04")) {
        console.log("public key must start with 04");
        return false;
    }
    return true;
};
exports.isValidAddress = isValidAddress;
