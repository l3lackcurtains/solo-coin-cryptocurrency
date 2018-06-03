import WebSocket from "ws";
import { Server } from "ws";

import {
  addBlockToChain,
  Block,
  getBlockchain,
  getLatestBlock,
  isValidBlockStructure,
  replaceChain
} from "./blockchain";

const sockets: WebSocket[] = [];

enum MessageType {
  QUERY_LATEST = 0,
  QUERY_ALL = 1,
  RESPONSE_BLOCKCHAIN = 2
}

class Message {
  public type: MessageType;
  public data: any;
}

const initP2PServer = (p2pPort: any) => {
  const server: Server = new WebSocket.Server({ port: p2pPort });
  server.on("connection", (ws: WebSocket) => {
    initConnection(ws);
  });
  console.log("Listening P2P Websocket on port: " + p2pPort);
};

const getSockets = () => sockets;

const initConnection = (ws: WebSocket) => {
  sockets.push(ws);
  initMessageHandler(ws);
  initErrorHandler(ws);
  write(ws, queryChainLengthMsg());
};

const JSONToObject = (data: string) => {
  try {
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
};

const initMessageHandler = (ws: WebSocket) => {
  ws.on("change", (data: string) => {
    const message: Message = JSONToObject(data);
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
        const receivedBlocks: Block[] = JSONToObject(message.data);
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

const write = (ws: WebSocket, message: Message): void =>
  ws.send(JSON.stringify(message));

const broadcast = (message: Message): void =>
  sockets.forEach(socket => write(socket, message));

const queryChainLengthMsg = (): Message => ({
  type: MessageType.QUERY_LATEST,
  data: null
});

const queryAllMsg = (): Message => ({
  type: MessageType.QUERY_ALL,
  data: null
});

const responseChainMsg = (): Message => ({
  type: MessageType.RESPONSE_BLOCKCHAIN,
  data: JSON.stringify(getBlockchain())
});

const responseLatestMsg = (): Message => ({
  type: MessageType.RESPONSE_BLOCKCHAIN,
  data: JSON.stringify([getLatestBlock()])
});

const initErrorHandler = (ws: WebSocket) => {
  const closeConnection = (mws: WebSocket) => {
    console.log("Connection failed to peer: " + mws.url);
    sockets.splice(sockets.indexOf(mws), 1);
  };
  ws.on("close", () => closeConnection(ws));
  ws.on("error", () => closeConnection(ws));
};

const handleBlockchainResponse = (receivedBlocks: Block[]) => {
  if (receivedBlocks.length === 0) {
    console.log("Received Block has size 0");
    return;
  }
  const latestBlockReceived: Block = receivedBlocks[receivedBlocks.length - 1];

  if (!isValidBlockStructure(latestBlockReceived)) {
    console.log("Block Structure not valid.");
    return;
  }

  const latestBlockHeld: Block = getLatestBlock();

  if (latestBlockReceived.index > latestBlockHeld.index) {
    console.log(
      `Blockchain possibly behind, We got ${latestBlockHeld.index} Peer got ${
        latestBlockReceived.index
      }`
    );
    if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
      if (addBlockToChain(latestBlockReceived)) {
        broadcast(responseLatestMsg());
      }
    } else if (receivedBlocks.length === 1) {
      console.log("We have to query the chain from our peer");
      broadcast(queryAllMsg());
    } else {
      console.log("Received blockchain is longer than current blockchain.");
      replaceChain(receivedBlocks);
    }
  } else {
    console.log(
      "Received blockchain is not longer than received blockchain. Do Nothing."
    );
  }
};

const broadcastLatest = (): void => {
  broadcast(responseLatestMsg());
};

const connectToPeers = (newPeer: any): void => {
  const ws: WebSocket = new WebSocket(newPeer);

  ws.on("open", () => {
    initConnection(ws);
  });

  ws.on("error", () => {
    console.log("Connection failed.");
  });
};

export { connectToPeers, broadcastLatest, initP2PServer, getSockets };
