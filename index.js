import express from 'express'
import CryptoJS from 'crypto-js'
import bodyParser from 'body-parser'
import WebSocket from 'ws'

const httpPort = process.env.HTTP_PORT || 3001
const p2pPort = process.env.P2P_PORT || 6001
const initialPeers = process.env.PEERS ? process.env.PEERS.split(',') : []

const sockets = []
const messageType = {
	QUERY_LATEST: 0,
	QUERY_ALL: 1,
	RESPONSE_BLOCKCHAIN: 2,
}
/*
 *************************************
 * Blockchain
 *************************************
*/
class Block {
	constructor(index, previousHash, timestamp, data, hash) {
		this.index = index
		this.previousHash = previousHash.toString()
		this.timestamp = timestamp
		this.data = data
		this.hash = hash.toString()
	}
}

const calculateHash = (index, previousHash, timestamp, data) => {
	return CryptoJS.SHA256(index + previousHash + timestamp + data).toString()
}

const calculateHashForBlock = (block) => {
	return CryptoJS.SHA256(block.index + block.previousHash + block.timestamp + block.data).toString()
}

const generateNextBlock = (blockData) => {
	const previousBlock = getLatestBlock()
	const nextIndex = previousBlock.index + 1
	const nextTimeStamp = new Date().getTime() / 1000
	const nextHash = calculateHash(nextIndex, previousBlock.hash, nextTimeStamp, blockData)
	return new Block(nextIndex, previousBlock.hash, nextTimeStamp, blockData, nextHash)
}

const getGenesisBlock = () => {
	return new Block(0, "0", 1465154705, "My genesis block", "816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7")
}

let blockchain = [getGenesisBlock()]

const addBlock = (newBlock) => {
	if(isValidNewBlock(newBlock, getLatestBlock())) {
		blockchain.push(newBlock)
	}
}

const isValidNewBlock = (newBlock, previousBlock) => {
	if(previousBlock.index + 1 !== newBlock.index) {
		console.log('invalid index')
		return false
	} else if (previousBlock.hash !== newBlock.previousHash) {
		console.log('Invalid previous hash')
		return false
	} else if (calculateHashForBlock(newBlock) !== newBlock.hash) {
		console.log('Invalid hash.')
		return false
	}

	return true
}

/*
 * *********************************************
 * Server
 * *********************************************
*/

const initHttpServer = () => {
	const app = express()
	app.use(bodyParser.json({ limit: '50mb' }))
	app.use(bodyParser.urlencoded({ limit: '50mb', extended: false, parameterLimit: 50000 }))

	app.get('/blocks', (req, res) => res.send({ success: true, data: JSON.stringify(blockchain) }))

	app.post('/mineblock', (req, res) => {
		const newBlock = generateNextBlock(req.body.data)
		addBlock(newBlock)
		broadcast(responseLatestMsg())
		console.log('Block Added: ', JSON.stringify(newBlock))
		res.send({ success: true, data: newBlock })
	})

	app.get('/peers', (req, res) => {
		res.send({ success: true, data: sockets.map(s => s._socket.remoteAddress + ':' + s._socket.remotePort) })
	})

	app.post('/add-peer', (req, res) => {
		connectToPeers([req.body.peer])
		res.send({ success: true, data: req.body.peer })
	})

	app.listen(httpPort, () => console.log('Listening to port', httpPort))
}

/*
 * *********************************************
 * P2P Server
 * *********************************************
*/

const initP2PServer = () => {
	const server = new WebSocket.Server({ port: p2pPort })
	server.on('connection', ws => initConnection(ws))
	console.log('Listening to websocket p2p port on', p2pPort)
}

const initConnection = (ws) => {
	sockets.push(ws)
	initMessageHandler(ws)
	initErrorHandler(ws)
	write(ws, queryChainLengthMsg())
}

const initMessageHandler = (ws) => {
	ws.on('message', (data) => {
		const message = data
		console.log('received Message ' + JSON.stringify(message))
		switch(message.type) {
			case messageType.QUERY_LATEST:
				write(ws, responseLatestMsg)
				break
			case messageType.QUERY_ALL:
				write(ws, responseChainMsg())
				break
			case messageType.RESPONSE_BLOCKCHAIN:
				handleBlockchainResponse(message)
				break
		}
	})
}

const initErrorHandler = (ws) => {
	const closeConnection =(ws) => {
		console.log('connection failer to peer' + ws.url)
		sockets.splice(sockets.indexOf(ws), 1)
	}
	ws.on('close', () => closeConnection(ws))
	ws.on('error', () => closeConnection(ws))
}

const connectToPeers = (newPeers) => {
	newPeers.forEach((peer) => {
			var ws = new WebSocket(peer)
			ws.on('open', () => initConnection(ws))
			ws.on('error', () => {
					console.log('connection failed')
			})
	})
}

const handleBlockchainResponse = (message) => {
	const receivedBlocks = JSON.parse(message.data).sort((b1, b2) => (b1.index - b2.index))
	const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1]
	const latestBlockHeld = getLatestBlock()

	if (latestBlockReceived.index > latestBlockHeld.index) {
		console.log('Blockchain possibly behind. We got ' + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index)
		if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
			console.log('We can append the received block to our chain.')
			blockchain.push(latestBlockReceived)
			broadcast(responseLatestMsg)
		} else if ( receivedBlocks.length === 1) {
			console.log('We have to query the chain from our peer')
			broadcast(queryAllMsg())
		} else {
			console.log('Received blockchain is longer than current blockchain.')
			replaceChain(receivedBlocks)
		}
	} else {
		console.log('Received blockchain is not longer  than received blockchain. Do nothing.')
	}
}

const replaceChain = (newBlocks) => {
	if(isValidChain(newBlocks) && newBlocks.length > blockchain.length) {
		console.log('Received blockchain is valid. Replacing current blockchain with received blockchain')
		blockchain = newBlocks
		broadcast(responseLatestMsg())
	} else {
		console.log('Received blockchain invalid.')
	}
}

const isValidChain = (blockchainToValidate) => {
	if(JSON.stringify(blockchainToValidate[0]) !== JSON.stringify(getGenesisBlock)) {
		return false
	}
	const tempBlocks = [blockchainToValidate[0]]
	for(let i = 1; i < blockchainToValidate.length; i++) {
		if(isValidNewBlock(blockchainToValidate[i], tempBlocks[i-1])) {
			tempBlocks.push(blockchainToValidate[i])
		} else {
			return false
		}
	}
	return true
}

const getLatestBlock = () => blockchain[blockchain.length - 1]
const queryChainLengthMsg = () => ({ type: messageType.QUERY_LATEST })
const queryAllMsg = () => ({ type: messageType.QUERY_ALL })
const responseChainMsg = () => ({
	type: messageType.RESPONSE_BLOCKCHAIN, data: JSON.stringify(blockchain)
})

const responseLatestMsg = () => ({
	type: messageType.RESPONSE_BLOCKCHAIN,
	data: JSON.stringify([getLatestBlock])
})

const write = (ws, message) => ws.send(JSON.stringify(message))

const broadcast = (message) => sockets.forEach(socket => write(socket, message))

connectToPeers(initialPeers)
initHttpServer()
initP2PServer()