import CryptoJS from 'crypto-js'

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
	const nextTimeStamp = new.Date().getTime() / 1000
	const nextHash = calculateHash(nextIndex, previousBlock.hash, nextTimeStamp, blockData)
	return new Block(nextIndex, previousBlock.hash, nextTimeStamp, blockData, nextHash)
}

const getGenesisBlock = () => {
	return new Block(0, "0", 1465154705, "My genesis block", "816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7")
}

const blockchain = [getGenesisBlock()]

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

const replaceChain = (newBlocks) => {
	if(isValidChain(newBlocks) && newBlocks.length > blockchain.length) {
		console.log('Received blockchain is valid. Replacing current blockchain with received blockchain')
		blockchain = newBlocks
		broadcast(responseLatestMsg())
	} else {
		console.log('Received blockchain invalid.')
	}
}

