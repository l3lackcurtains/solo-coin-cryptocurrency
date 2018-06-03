import express from "express";
import bodyParser from "body-parser";

import { Block, generateNextBlock, getBlockchain } from "./blockchain";
import { connectToPeers, getSockets, initP2PServer } from "./p2p";

const httpPort = process.env.HTTP_PORT || 3001;
const p2pPort = process.env.P2P_PORT || 6001;

const initHttpServer = httpPort => {
  const app: express.Application = express();
  app.use(bodyParser.json());

  app.get("/blocks", (req, res) => {
    res.send(getBlockchain());
  });

  app.post("/mineBlock", (req, res) => {
    const newBlock: Block = generateNextBlock(req.body.data);
    res.send(newBlock);
  });

  app.get("/peers", (req, res) => {
    res.send(
      getSockets().map(
        (s: any) => s._socket.remoteAddress + ":" + s._socket.remotePort
      )
    );
  });

  app.post("/addPeer", (req, res) => {
    connectToPeers(req.body.peer);
    res.send();
  });

  app.listen(httpPort, () => {
    console.log("Listening HTTP server on port: " + httpPort);
  });
};

initHttpServer(httpPort);
initP2PServer(p2pPort);
