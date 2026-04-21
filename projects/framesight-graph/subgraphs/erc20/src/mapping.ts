import {
  BigInt,
  Address,
  Bytes,
  ethereum,
  log,
} from "@graphprotocol/graph-ts";
import {
  Transfer,
  Approval,
  Token,
  Account,
  AccountBalance,
  DailyTransferVolume,
  HourlyTransferVolume,
} from "../generated/schema";
import { ERC20 } from "../generated/ERC20/ERC20";

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

// Helper to get or create Token
function getOrCreateToken(address: Address, timestamp: BigInt, blockNumber: BigInt): Token {
  let id = address.toHex();
  let token = Token.load(id);
  
  if (token == null) {
    token = new Token(id);
    token.address = address;
    token.createdAt = timestamp;
    token.createdAtBlock = blockNumber;
    token.transferCount = BigInt.fromI32(0);
    token.holderCount = BigInt.fromI32(0);
    
    // Try to fetch token metadata
    let erc20 = ERC20.bind(address);
    
    let symbolResult = erc20.try_symbol();
    if (!symbolResult.reverted) {
      token.symbol = symbolResult.value;
    } else {
      token.symbol = "UNKNOWN";
    }
    
    let nameResult = erc20.try_name();
    if (!nameResult.reverted) {
      token.name = nameResult.value;
    } else {
      token.name = "Unknown Token";
    }
    
    let decimalsResult = erc20.try_decimals();
    if (!decimalsResult.reverted) {
      token.decimals = decimalsResult.value;
    } else {
      token.decimals = 18;
    }
    
    let totalSupplyResult = erc20.try_totalSupply();
    if (!totalSupplyResult.reverted) {
      token.totalSupply = totalSupplyResult.value;
    } else {
      token.totalSupply = BigInt.fromI32(0);
    }
    
    token.save();
  }
  
  return token;
}

// Helper to update account balance
function updateAccountBalance(
  account: Account,
  token: Token,
  newBalance: BigInt,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  let balanceId = account.id + "-" + token.id;
  let accountBalance = AccountBalance.load(balanceId);
  
  if (accountBalance == null) {
    accountBalance = new AccountBalance(balanceId);
    accountBalance.account = account.id;
    accountBalance.token = token.id;
  }
  
  accountBalance.balance = newBalance;
  accountBalance.updatedAt = timestamp;
  accountBalance.updatedAtBlock = blockNumber;
  accountBalance.save();
}

// Update daily volume aggregate
function updateDailyVolume(
  token: Token,
  value: BigInt,
  timestamp: BigInt
): void {
  let dayTimestamp = timestamp.div(BigInt.fromI32(86400)).times(BigInt.fromI32(86400));
  let dayId = token.id + "-" + dayTimestamp.toString();
  let date = new Date(dayTimestamp.toI64() * 1000).toISOString().split("T")[0];
  
  let dailyVolume = DailyTransferVolume.load(dayId);
  if (dailyVolume == null) {
    dailyVolume = new DailyTransferVolume(dayId);
    dailyVolume.token = token.id;
    dailyVolume.date = date;
    dailyVolume.timestamp = dayTimestamp;
    dailyVolume.transferCount = BigInt.fromI32(0);
    dailyVolume.totalVolume = BigInt.fromI32(0);
  }
  
  dailyVolume.transferCount = dailyVolume.transferCount.plus(BigInt.fromI32(1));
  dailyVolume.totalVolume = dailyVolume.totalVolume.plus(value);
  dailyVolume.save();
}

// Update hourly volume aggregate
function updateHourlyVolume(
  token: Token,
  value: BigInt,
  timestamp: BigInt
): void {
  let hourTimestamp = timestamp.div(BigInt.fromI32(3600)).times(BigInt.fromI32(3600));
  let hourId = token.id + "-" + hourTimestamp.toString();
  let hour = new Date(hourTimestamp.toI64() * 1000).toISOString();
  
  let hourlyVolume = HourlyTransferVolume.load(hourId);
  if (hourlyVolume == null) {
    hourlyVolume = new HourlyTransferVolume(hourId);
    hourlyVolume.token = token.id;
    hourlyVolume.hour = hour;
    hourlyVolume.timestamp = hourTimestamp;
    hourlyVolume.transferCount = BigInt.fromI32(0);
    hourlyVolume.totalVolume = BigInt.fromI32(0);
  }
  
  hourlyVolume.transferCount = hourlyVolume.transferCount.plus(BigInt.fromI32(1));
  hourlyVolume.totalVolume = hourlyVolume.totalVolume.plus(value);
  hourlyVolume.save();
}

// Event handlers
export function handleTransfer(event: ethereum.Event): void {
  let transferEvent = event as TransferEvent;
  
  let fromAddress = ethereum.decode("address", transferEvent.parameters[0].value.toBytes())!.toAddress();
  let toAddress = ethereum.decode("address", transferEvent.parameters[1].value.toBytes())!.toAddress();
  let value = ethereum.decode("uint256", transferEvent.parameters[2].value.toBytes())!.toBigInt();
  
  let token = getOrCreateToken(event.address, event.block.timestamp, event.block.number);
  let from = getOrCreateAccount(fromAddress, event.block.timestamp, event.block.number);
  let to = getOrCreateAccount(toAddress, event.block.timestamp, event.block.number);
  
  // Create transfer entity
  let transfer = new Transfer(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  transfer.transactionHash = event.transaction.hash;
  transfer.blockNumber = event.block.number;
  transfer.timestamp = event.block.timestamp;
  transfer.from = from.id;
  transfer.to = to.id;
  transfer.value = value;
  transfer.token = token.id;
  transfer.gasUsed = event.transaction.gasUsed;
  transfer.gasPrice = event.transaction.gasPrice;
  transfer.save();
  
  // Update token stats
  token.transferCount = token.transferCount.plus(BigInt.fromI32(1));
  
  // Update balances
  let erc20 = ERC20.bind(event.address);
  
  let fromBalanceResult = erc20.try_balanceOf(fromAddress);
  if (!fromBalanceResult.reverted) {
    updateAccountBalance(from, token, fromBalanceResult.value, event.block.timestamp, event.block.number);
  }
  
  let toBalanceResult = erc20.try_balanceOf(toAddress);
  if (!toBalanceResult.reverted) {
    updateAccountBalance(to, token, toBalanceResult.value, event.block.timestamp, event.block.number);
  }
  
  token.save();
  
  // Update aggregates
  updateDailyVolume(token, value, event.block.timestamp);
  updateHourlyVolume(token, value, event.block.timestamp);
  
  log.info("ERC20 Transfer: {} {} from {} to {}", [
    value.toString(),
    token.symbol,
    fromAddress.toHex(),
    toAddress.toHex(),
  ]);
}

export function handleApproval(event: ethereum.Event): void {
  let approvalEvent = event as ApprovalEvent;
  
  let ownerAddress = ethereum.decode("address", approvalEvent.parameters[0].value.toBytes())!.toAddress();
  let spenderAddress = ethereum.decode("address", approvalEvent.parameters[1].value.toBytes())!.toAddress();
  let value = ethereum.decode("uint256", approvalEvent.parameters[2].value.toBytes())!.toBigInt();
  
  let token = getOrCreateToken(event.address, event.block.timestamp, event.block.number);
  let owner = getOrCreateAccount(ownerAddress, event.block.timestamp, event.block.number);
  let spender = getOrCreateAccount(spenderAddress, event.block.timestamp, event.block.number);
  
  // Create approval entity
  let approval = new Approval(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  approval.transactionHash = event.transaction.hash;
  approval.blockNumber = event.block.number;
  approval.timestamp = event.block.timestamp;
  approval.owner = owner.id;
  approval.spender = spender.id;
  approval.value = value;
  approval.token = token.id;
  approval.save();
  
  log.info("ERC20 Approval: {} {} by {} for {}", [
    value.toString(),
    token.symbol,
    ownerAddress.toHex(),
    spenderAddress.toHex(),
  ]);
}

// Type definitions for event parameters
class TransferEvent extends ethereum.Event {
  get parameters(): Array<ethereum.EventParam> {
    return this._parameters;
  }
}

class ApprovalEvent extends ethereum.Event {
  get parameters(): Array<ethereum.EventParam> {
    return this._parameters;
  }
}
