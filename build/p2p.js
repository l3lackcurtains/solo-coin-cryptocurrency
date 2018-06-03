"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var ws_1 = __importDefault(require("ws"));
var blockchain_1 = require("./blockchain");
var sockets = [];
var MessageType;
(function (MessageType) {
    MessageType[MessageType["QUERY_LATEST"] = 0] = "QUERY_LATEST";
    MessageType[MessageType["QUERY_ALL"] = 1] = "QUERY_ALL";
    MessageType[MessageType["RESPONSE_BLOCKCHAIN"] = 2] = "RESPONSE_BLOCKCHAIN";
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
    console.log("Listening P2P Websocket on port: " + p2pPort);
};
exports.initP2PServer = initP2PServer;
var getSockets = function () { return sockets; };
exports.getSockets = getSockets;
var initConnection = function (ws) {
    sockets.push(ws);
    initMessageHandler(ws);
    initErrorHandler(ws);
    write(ws, queryChainLengthMsg());
};
var JSONToObject = function (data) {
    try {
        return JSON.parse(data);
    }
    catch (e) {
        return null;
    }
};
var initMessageHandler = function (ws) {
    ws.on("change", function (data) {
        var message = JSONToObject(data);
        if (message === null) {
            console.log("Couldn't parse received JSON message: " + data);
            return;
        }
        console.log("Received Message" + JSON.stringify(message));
        switch (message.type) {
            case MessageType.QUERY_LATEST:
                write(ws, responseChainMsg());
                break;
            case MessageType.QUERY_ALL:
                write(ws, responseChainMsg());
                break;
            case MessageType.RESPONSE_BLOCKCHAIN:
                var receivedBlocks = JSONToObject(message.data);
                if (receivedBlocks === null) {
                    console.log("Invalid Blocks Received.");
                    console.log(message.data);
                    break;
                }
                handleBlockchainResponse(receivedBlocks);
                break;
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
var initErrorHandler = function (ws) {
    var closeConnection = function (mws) {
        console.log("Connection failed to peer: " + mws.url);
        sockets.splice(sockets.indexOf(mws), 1);
    };
    ws.on("close", function () { return closeConnection(ws); });
    ws.on("error", function () { return closeConnection(ws); });
};
var handleBlockchainResponse = function (receivedBlocks) {
    if (receivedBlocks.length === 0) {
        console.log("Received Block has size 0");
        return;
    }
    var latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
    if (!blockchain_1.isValidBlockStructure(latestBlockReceived)) {
        console.log("Block Structure not valid.");
        return;
    }
    var latestBlockHeld = blockchain_1.getLatestBlock();
    if (latestBlockReceived.index > latestBlockHeld.index) {
        console.log("Blockchain possibly behind, We got " + latestBlockHeld.index + " Peer got " + latestBlockReceived.index);
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
            console.log("Received blockchain is longer than current blockchain.");
            blockchain_1.replaceChain(receivedBlocks);
        }
    }
    else {
        console.log("Received blockchain is not longer than received blockchain. Do Nothing.");
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
        console.log("Connection failed.");
    });
};
exports.connectToPeers = connectToPeers;
