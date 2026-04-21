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
import { ERC721 } from "../generated/ERC721/ERC721";
import { ERC721Metadata } from "../generated/ERC721/ERC721Metadata";

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
  contractType: string,
  timestamp: BigInt,
  blockNumber: BigInt
): NFTContract {
  let id = address.toHex();
  let contract = NFTContract.load(id);
  
  if (contract == null) {
    contract = new NFTContract(id);
    contract.address = address;
    contract.contractType = contractType;
    contract.createdAt = timestamp;
    contract.createdAtBlock = blockNumber;
    contract.transferCount = BigInt.fromI32(0);
    contract.holderCount = BigInt.fromI32(0);
    
    // Try to fetch metadata
    let erc721 = ERC721.bind(address);
    
    let nameResult = erc721.try_name();
    if (!nameResult.reverted) {
      contract.name = nameResult.value;
    } else {
      contract.name = "Unknown Collection";
    }
    
    let symbolResult = erc721.try_symbol();
    if (!symbolResult.reverted) {
      contract.symbol = symbolResult.value;
    } else {
      contract.symbol = "???";
    }
    
    let totalSupplyResult = erc721.try_totalSupply();
    if (!totalSupplyResult.reverted) {
      contract.totalSupply = totalSupplyResult.value;
    }
    
    contract.save();
  }
  
  return contract;
}

// Helper to get or create NFTToken
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
    
    // Try to fetch tokenURI
    let erc721 = ERC721.bind(Address.fromBytes(contract.address));
    let tokenURIResult = erc721.try_tokenURI(tokenId);
    if (!tokenURIResult.reverted) {
      token.uri = tokenURIResult.value;
    }
    
    token.save();
  }
  
  return token;
}

// Update daily volume aggregate
function updateDailyVolume(
  contract: NFTContract,
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
  volume.totalVolume = volume.totalVolume.plus(BigInt.fromI32(1));
  
  if (isMint) {
    volume.mintCount = volume.mintCount.plus(BigInt.fromI32(1));
  }
  if (isBurn) {
    volume.burnCount = volume.burnCount.plus(BigInt.fromI32(1));
  }
  
  volume.save();
}

// Event handlers
export function handleTransfer(event: ethereum.Event): void {
  let params = event.parameters;
  
  let fromAddress = params[0].value.toAddress();
  let toAddress = params[1].value.toAddress();
  let tokenId = params[2].value.toBigInt();
  
  let contract = getOrCreateNFTContract(event.address, "ERC721", event.block.timestamp, event.block.number);
  let from = getOrCreateAccount(fromAddress, event.block.timestamp, event.block.number);
  let to = getOrCreateAccount(toAddress, event.block.timestamp, event.block.number);
  let token = getOrCreateNFTToken(contract, tokenId, event.block.timestamp, event.block.number);
  
  // Update token owner
  token.owner = to.id;
  
  // Check for burn
  if (toAddress == Address.zero()) {
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
  transfer.value = BigInt.fromI32(1);
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
  updateDailyVolume(contract, event.block.timestamp, isMint, isBurn);
  
  log.info("ERC721 Transfer: token {} from {} to {}", [
    tokenId.toString(),
    fromAddress.toHex(),
    toAddress.toHex(),
  ]);
}

export function handleApproval(event: ethereum.Event): void {
  // Track single token approval if needed
  let params = event.parameters;
  let owner = params[0].value.toAddress();
  let approved = params[1].value.toAddress();
  let tokenId = params[2].value.toBigInt();
  
  log.info("ERC721 Approval: token {} approved for {} by {}", [
    tokenId.toString(),
    approved.toHex(),
    owner.toHex(),
  ]);
}

export function handleApprovalForAll(event: ethereum.Event): void {
  let params = event.parameters;
  let owner = params[0].value.toAddress();
  let operator = params[1].value.toAddress();
  let approved = params[2].value.toBoolean();
  
  log.info("ERC721 ApprovalForAll: operator {} approved={} by {}", [
    operator.toHex(),
    approved ? "true" : "false",
    owner.toHex(),
  ]);
}
