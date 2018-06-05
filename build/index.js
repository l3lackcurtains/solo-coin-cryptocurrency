"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var body_parser_1 = __importDefault(require("body-parser"));
var blockchain_1 = require("./blockchain");
var p2p_1 = require("./p2p");
var transactionPool_1 = require("./transactionPool");
var wallet_1 = require("./wallet");
var httpPort = process.env.HTTP_PORT || 3001;
var p2pPort = process.env.P2P_PORT || 6001;
var initHttpServer = function (httpPort) {
    var app = express_1.default();
    app.use(body_parser_1.default.json());
    app.use(function (err, req, res, next) {
        if (err) {
            res.status(400).send(err.message);
        }
    });
    app.get("/blocks", function (req, res) {
        res.send(blockchain_1.getBlockchain());
    });
    app.get("/unspentTransactionOutputs", function (req, res) {
        res.send(blockchain_1.getUnspentTxOuts());
    });
    app.get("/myUnspentTransactionOutputs", function (req, res) {
        res.send(blockchain_1.getMyUnspentTransactionOutputs());
    });
    app.post("/mineRawBlock", function (req, res) {
        if (req.body.data == null) {
            res.send("data parameter is missing");
            return;
        }
        var newBlock = blockchain_1.generateRawNextBlock(req.body.data);
        if (newBlock === null) {
            res.status(400).send("could not generate block");
        }
        else {
            res.send(newBlock);
        }
    });
    app.post("/mineBlock", function (req, res) {
        var newBlock = blockchain_1.generateNextBlock();
        if (newBlock === null) {
            res.status(400).send("could not generate block");
        }
        else {
            res.send(newBlock);
        }
    });
    app.get("/balance", function (req, res) {
        var balance = blockchain_1.getAccountBalance();
        res.send({ balance: balance });
    });
    app.get("/address", function (req, res) {
        var address = wallet_1.getPublicFromWallet();
        res.send({ address: address });
    });
    app.post("/mineTransaction", function (req, res) {
        var address = req.body.address;
        var amount = req.body.amount;
        try {
            var resp = blockchain_1.generateNextBlockWithTransaction(address, amount);
            res.send(resp);
        }
        catch (e) {
            console.log(e.message);
            res.status(400).send(e.message);
        }
    });
    app.post("/sendTransaction", function (req, res) {
        try {
            var address = req.body.address;
            var amount = req.body.amount;
            if (address === undefined || amount === undefined) {
                throw Error("invalid address or amount");
            }
            var resp = blockchain_1.sendTransaction(address, amount);
            res.send(resp);
        }
        catch (e) {
            console.log(e.message);
            res.status(400).send(e.message);
        }
    });
    app.get("/transactionPool", function (req, res) {
        res.send(transactionPool_1.getTransactionPool());
    });
    app.get("/peers", function (req, res) {
        res.send(p2p_1.getSockets().map(function (s) { return s._socket.remoteAddress + ":" + s._socket.remotePort; }));
    });
    app.post("/addPeer", function (req, res) {
        p2p_1.connectToPeers(req.body.peer);
        res.send();
    });
    app.post("/stop", function (req, res) {
        res.send({ msg: "stopping server" });
        process.exit();
    });
    app.listen(httpPort, function () {
        console.log("Listening http on port: " + httpPort);
    });
};
initHttpServer(httpPort);
p2p_1.initP2PServer(p2pPort);
wallet_1.initWallet();
