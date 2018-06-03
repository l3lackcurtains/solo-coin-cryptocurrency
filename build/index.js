"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var body_parser_1 = __importDefault(require("body-parser"));
var blockchain_1 = require("./blockchain");
var p2p_1 = require("./p2p");
var httpPort = process.env.HTTP_PORT || 3001;
var p2pPort = process.env.P2P_PORT || 6001;
var initHttpServer = function (httpPort) {
    var app = express_1.default();
    app.use(body_parser_1.default.json());
    app.get("/blocks", function (req, res) {
        res.send(blockchain_1.getBlockchain());
    });
    app.post("/mineBlock", function (req, res) {
        var newBlock = blockchain_1.generateNextBlock(req.body.data);
        res.send(newBlock);
    });
    app.get("/peers", function (req, res) {
        res.send(p2p_1.getSockets().map(function (s) { return s._socket.remoteAddress + ":" + s._socket.remotePort; }));
    });
    app.post("/addPeer", function (req, res) {
        p2p_1.connectToPeers(req.body.peer);
        res.send();
    });
    app.listen(httpPort, function () {
        console.log("Listening HTTP server on port: " + httpPort);
    });
};
initHttpServer(httpPort);
p2p_1.initP2PServer(p2pPort);
