import {
  BigInt,
  Address,
  Bytes,
  ethereum,
  log,
} from "@graphprotocol/graph-ts";
import {
  NFTContract,
  NFTToken,
  NFTTransfer,
  Account,
  DailyNFTVolume,
} from "../generated/schema";
import { ERC1155 } from "../generated/ERC1155/ERC1155";

// Helper to get or create Account
function getOrCreateAccount(address: Address, timestamp: BigInt, blockNumber: BigInt): Account {
  let id = address.toHex();
  let account = Account.load(id);
  
  if (account == null) {
    account = new Account(id);
    account.address = address;
    account.createdAt = timestamp;
    account.createdAtBlock = blockNumber;
    account.save();
  }
  
  return account;
}

// Helper to get or create NFTContract
function getOrCreateNFTContract(
  address: Address,
  timestamp: BigInt,
  blockNumber: BigInt
): NFTContract {
  let id = address.toHex();
  let contract = NFTContract.load(id);
  
  if (contract == null) {
    contract = new NFTContract(id);
    contract.address = address;
    contract.contractType = "ERC1155";
    contract.createdAt = timestamp;
    contract.createdAtBlock = blockNumber;
    contract.transferCount = BigInt.fromI32(0);
    contract.holderCount = BigInt.fromI32(0);
    
    // Try to fetch metadata
    let erc1155 = ERC1155.bind(address);
    
    let uriResult = erc1155.try_uri(BigInt.fromI32(0));
    if (!uriResult.reverted) {
      // ERC1155 doesn't have name/symbol by default
      contract.name = "ERC1155 Collection";
      contract.symbol = "ERC1155";
    } else {
      contract.name = "Unknown ERC1155";
      contract.symbol = "???";
    }
    
    contract.save();
  }
  
  return contract;
}

// Helper to get or create NFTToken (ERC1155 specific)
function getOrCreateNFTToken(
  contract: NFTContract,
  tokenId: BigInt,
  timestamp: BigInt,
  blockNumber: BigInt
): NFTToken {
  let id = contract.id + "-" + tokenId.toString();
  let token = NFTToken.load(id);
  
  if (token == null) {
    token = new NFTToken(id);
    token.tokenId = tokenId;
    token.contract = contract.id;
    token.mintedAt = timestamp;
    token.mintedAtBlock = blockNumber;
    token.burned = false;
    
    // Try to fetch URI
    let erc1155 = ERC1155.bind(Address.fromBytes(contract.address));
    let uriResult = erc1155.try_uri(tokenId);
    if (!uriResult.reverted) {
      token.uri = uriResult.value;
    }
    
    token.save();
  }
  
  return token;
}

// Update daily volume aggregate
function updateDailyVolume(
  contract: NFTContract,
  value: BigInt,
  timestamp: BigInt,
  isMint: boolean,
  isBurn: boolean
): void {
  let dayTimestamp = timestamp.div(BigInt.fromI32(86400)).times(BigInt.fromI32(86400));
  let date = new Date(dayTimestamp.toI64() * 1000).toISOString().split("T")[0];
  let id = contract.id + "-" + dayTimestamp.toString();
  
  let volume = DailyNFTVolume.load(id);
  if (volume == null) {
    volume = new DailyNFTVolume(id);
    volume.nftContract = contract.id;
    volume.date = date;
    volume.timestamp = dayTimestamp;
    volume.transferCount = BigInt.fromI32(0);
    volume.mintCount = BigInt.fromI32(0);
    volume.burnCount = BigInt.fromI32(0);
    volume.totalVolume = BigInt.fromI32(0);
  }
  
  volume.transferCount = volume.transferCount.plus(BigInt.fromI32(1));
  volume.totalVolume = volume.totalVolume.plus(value);
  
  if (isMint) {
    volume.mintCount = volume.mintCount.plus(value);
  }
  if (isBurn) {
    volume.burnCount = volume.burnCount.plus(value);
  }
  
  volume.save();
}

// Single transfer handler
export function handleTransferSingle(event: ethereum.Event): void {
  let params = event.parameters;
  
  let operator = params[0].value.toAddress();
  let fromAddress = params[1].value.toAddress();
  let toAddress = params[2].value.toAddress();
  let tokenId = params[3].value.toBigInt();
  let value = params[4].value.toBigInt();
  
  let contract = getOrCreateNFTContract(event.address, event.block.timestamp, event.block.number);
  let from = getOrCreateAccount(fromAddress, event.block.timestamp, event.block.number);
  let to = getOrCreateAccount(toAddress, event.block.timestamp, event.block.number);
  let token = getOrCreateNFTToken(contract, tokenId, event.block.timestamp, event.block.number);
  
  // Update token owner (simplified - real implementation would track balances)
  if (toAddress != Address.zero()) {
    token.owner = to.id;
  }
  
  if (fromAddress == Address.zero() && toAddress == Address.zero()) {
    token.burned = true;
    token.burnedAt = event.block.timestamp;
  }
  
  token.save();
  
  // Create transfer
  let transfer = new NFTTransfer(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  transfer.transactionHash = event.transaction.hash;
  transfer.blockNumber = event.block.number;
  transfer.timestamp = event.block.timestamp;
  transfer.nftContract = contract.id;
  transfer.token = token.id;
  transfer.from = from.id;
  transfer.to = to.id;
  transfer.operator = operator;
  transfer.value = value;
  transfer.isBatch = false;
  transfer.gasUsed = event.transaction.gasUsed;
  transfer.gasPrice = event.transaction.gasPrice;
  transfer.save();
  
  // Update contract stats
  contract.transferCount = contract.transferCount.plus(BigInt.fromI32(1));
  contract.save();
  
  // Update daily volume
  let isMint = fromAddress == Address.zero();
  let isBurn = toAddress == Address.zero();
  updateDailyVolume(contract, value, event.block.timestamp, isMint, isBurn);
  
  log.info("ERC1155 TransferSingle: token {} x{} from {} to {}", [
    tokenId.toString(),
    value.toString(),
    fromAddress.toHex(),
    toAddress.toHex(),
  ]);
}

// Batch transfer handler
export function handleTransferBatch(event: ethereum.Event): void {
  let params = event.parameters;
  
  let operator = params[0].value.toAddress();
  let fromAddress = params[1].value.toAddress();
  let toAddress = params[2].value.toAddress();
  let tokenIds = params[3].value.toBigIntArray();
  let values = params[4].value.toBigIntArray();
  
  let contract = getOrCreateNFTContract(event.address, event.block.timestamp, event.block.number);
  let from = getOrCreateAccount(fromAddress, event.block.timestamp, event.block.number);
  let to = getOrCreateAccount(toAddress, event.block.timestamp, event.block.number);
  
  // Create a single batch transfer record
  let transfer = new NFTTransfer(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  transfer.transactionHash = event.transaction.hash;
  transfer.blockNumber = event.block.number;
  transfer.timestamp = event.block.timestamp;
  transfer.nftContract = contract.id;
  transfer.from = from.id;
  transfer.to = to.id;
  transfer.operator = operator;
  transfer.isBatch = true;
  transfer.tokenIds = tokenIds;
  transfer.values = values;
  transfer.gasUsed = event.transaction.gasUsed;
  transfer.gasPrice = event.transaction.gasPrice;
  transfer.save();
  
  // Process individual tokens
  for (let i = 0; i < tokenIds.length; i++) {
    let tokenId = tokenIds[i];
    let value = values[i];
    
    let token = getOrCreateNFTToken(contract, tokenId, event.block.timestamp, event.block.number);
    
    if (toAddress != Address.zero()) {
      token.owner = to.id;
    }
    
    if (fromAddress == Address.zero() && toAddress == Address.zero()) {
      token.burned = true;
      token.burnedAt = event.block.timestamp;
    }
    
    token.save();
    
    // Update daily volume for each token type
    let isMint = fromAddress == Address.zero();
    let isBurn = toAddress == Address.zero();
    updateDailyVolume(contract, value, event.block.timestamp, isMint, isBurn);
  }
  
  // Update contract stats
  contract.transferCount = contract.transferCount.plus(BigInt.fromI32(1));
  contract.save();
  
  log.info("ERC1155 TransferBatch: {} tokens from {} to {}", [
    tokenIds.length.toString(),
    fromAddress.toHex(),
    toAddress.toHex(),
  ]);
}
