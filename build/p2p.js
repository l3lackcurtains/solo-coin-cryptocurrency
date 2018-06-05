"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var ws_1 = __importDefault(require("ws"));
var blockchain_1 = require("./blockchain");
var transactionPool_1 = require("./transactionPool");
var sockets = [];
var MessageType;
(function (MessageType) {
    MessageType[MessageType["QUERY_LATEST"] = 0] = "QUERY_LATEST";
    MessageType[MessageType["QUERY_ALL"] = 1] = "QUERY_ALL";
    MessageType[MessageType["RESPONSE_BLOCKCHAIN"] = 2] = "RESPONSE_BLOCKCHAIN";
    MessageType[MessageType["QUERY_TRANSACTION_POOL"] = 3] = "QUERY_TRANSACTION_POOL";
    MessageType[MessageType["RESPONSE_TRANSACTION_POOL"] = 4] = "RESPONSE_TRANSACTION_POOL";
})(MessageType || (MessageType = {}));
var Message = /** @class */ (function () {
    function Message() {
    }
    return Message;
}());
var initP2PServer = function (p2pPort) {
    var server = new ws_1.default.Server({ port: p2pPort });
    server.on("connection", function (ws) {
        initConnection(ws);
    });
    console.log("listening websocket p2p port on: " + p2pPort);
};
exports.initP2PServer = initP2PServer;
var getSockets = function () { return sockets; };
exports.getSockets = getSockets;
var initConnection = function (ws) {
    sockets.push(ws);
    initMessageHandler(ws);
    initErrorHandler(ws);
    write(ws, queryChainLengthMsg());
    // query transactions pool only some time after chain query
    setTimeout(function () {
        broadcast(queryTransactionPoolMsg());
    }, 500);
};
var JSONToObject = function (data) {
    try {
        return JSON.parse(data);
    }
    catch (e) {
        console.log(e);
        return null;
    }
};
var initMessageHandler = function (ws) {
    ws.on("message", function (data) {
        try {
            var message = JSONToObject(data);
            if (message === null) {
                console.log("could not parse received JSON message: " + data);
                return;
            }
            console.log("Received message: %s", JSON.stringify(message));
            switch (message.type) {
                case MessageType.QUERY_LATEST:
                    write(ws, responseLatestMsg());
                    break;
                case MessageType.QUERY_ALL:
                    write(ws, responseChainMsg());
                    break;
                case MessageType.RESPONSE_BLOCKCHAIN:
                    var receivedBlocks = JSONToObject(message.data);
                    if (receivedBlocks === null) {
                        console.log("invalid blocks received: %s", JSON.stringify(message.data));
                        break;
                    }
                    handleBlockchainResponse(receivedBlocks);
                    break;
                case MessageType.QUERY_TRANSACTION_POOL:
                    write(ws, responseTransactionPoolMsg());
                    break;
                case MessageType.RESPONSE_TRANSACTION_POOL:
                    var receivedTransactions = JSONToObject(message.data);
                    if (receivedTransactions === null) {
                        console.log("invalid transaction received: %s", JSON.stringify(message.data));
                        break;
                    }
                    receivedTransactions.forEach(function (transaction) {
                        try {
                            blockchain_1.handleReceivedTransaction(transaction);
                            // if no error is thrown, transaction was indeed added to the pool
                            // let's broadcast transaction pool
                            broadCastTransactionPool();
                        }
                        catch (e) {
                            console.log(e.message);
                        }
                    });
                    break;
            }
        }
        catch (e) {
            console.log(e);
        }
    });
};
var write = function (ws, message) {
    return ws.send(JSON.stringify(message));
};
var broadcast = function (message) {
    return sockets.forEach(function (socket) { return write(socket, message); });
};
var queryChainLengthMsg = function () { return ({
    type: MessageType.QUERY_LATEST,
    data: null
}); };
var queryAllMsg = function () { return ({
    type: MessageType.QUERY_ALL,
    data: null
}); };
var responseChainMsg = function () { return ({
    type: MessageType.RESPONSE_BLOCKCHAIN,
    data: JSON.stringify(blockchain_1.getBlockchain())
}); };
var responseLatestMsg = function () { return ({
    type: MessageType.RESPONSE_BLOCKCHAIN,
    data: JSON.stringify([blockchain_1.getLatestBlock()])
}); };
var queryTransactionPoolMsg = function () { return ({
    type: MessageType.QUERY_TRANSACTION_POOL,
    data: null
}); };
var responseTransactionPoolMsg = function () { return ({
    type: MessageType.RESPONSE_TRANSACTION_POOL,
    data: JSON.stringify(transactionPool_1.getTransactionPool())
}); };
var initErrorHandler = function (ws) {
    var closeConnection = function (myWs) {
        console.log("connection failed to peer: " + myWs.url);
        sockets.splice(sockets.indexOf(myWs), 1);
    };
    ws.on("close", function () { return closeConnection(ws); });
    ws.on("error", function () { return closeConnection(ws); });
};
var handleBlockchainResponse = function (receivedBlocks) {
    if (receivedBlocks.length === 0) {
        console.log("received block chain size of 0");
        return;
    }
    var latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
    if (!blockchain_1.isValidBlockStructure(latestBlockReceived)) {
        console.log("block structuture not valid");
        return;
    }
    var latestBlockHeld = blockchain_1.getLatestBlock();
    if (latestBlockReceived.index > latestBlockHeld.index) {
        console.log("blockchain possibly behind. We got: " +
            latestBlockHeld.index +
            " Peer got: " +
            latestBlockReceived.index);
        if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
            if (blockchain_1.addBlockToChain(latestBlockReceived)) {
                broadcast(responseLatestMsg());
            }
        }
        else if (receivedBlocks.length === 1) {
            console.log("We have to query the chain from our peer");
            broadcast(queryAllMsg());
        }
        else {
            console.log("Received blockchain is longer than current blockchain");
            blockchain_1.replaceChain(receivedBlocks);
        }
    }
    else {
        console.log("received blockchain is not longer than received blockchain. Do nothing");
    }
};
var broadcastLatest = function () {
    broadcast(responseLatestMsg());
};
exports.broadcastLatest = broadcastLatest;
var connectToPeers = function (newPeer) {
    var ws = new ws_1.default(newPeer);
    ws.on("open", function () {
        initConnection(ws);
    });
    ws.on("error", function () {
        console.log("connection failed");
    });
};
exports.connectToPeers = connectToPeers;
var broadCastTransactionPool = function () {
    broadcast(responseTransactionPoolMsg());
};
exports.broadCastTransactionPool = broadCastTransactionPool;
