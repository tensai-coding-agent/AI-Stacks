import {
  BigInt,
  Address,
  Bytes,
  ethereum,
  log,
} from "@graphprotocol/graph-ts";
import {
  UserOperation,
  AccountDeployed,
  UserOperationRevertReason,
  Account,
  Paymaster,
  Bundler,
  Factory,
  DailyUserOperationStats,
  HourlyUserOperationStats,
  EntryPointDeposit,
  EntryPointWithdrawal,
} from "../generated/schema";

// EntryPoint v0.6.0 event signatures
class UserOperationEvent_v060 extends ethereum.Event {
  get parameters(): Array<ethereum.EventParam> {
    return this._parameters;
  }
}

// Helper functions
function getOrCreateAccount(address: Address, timestamp: BigInt, blockNumber: BigInt): Account {
  let id = address.toHex();
  let account = Account.load(id);
  
  if (account == null) {
    account = new Account(id);
    account.address = address;
    account.createdAt = timestamp;
    account.createdAtBlock = blockNumber;
    account.totalOperations = BigInt.fromI32(0);
    account.successfulOperations = BigInt.fromI32(0);
    account.failedOperations = BigInt.fromI32(0);
    account.save();
  }
  
  return account;
}

function getOrCreatePaymaster(address: Address, timestamp: BigInt): Paymaster {
  let id = address.toHex();
  let paymaster = Paymaster.load(id);
  
  if (paymaster == null) {
    paymaster = new Paymaster(id);
    paymaster.address = address;
    paymaster.createdAt = timestamp;
    paymaster.totalOperations = BigInt.fromI32(0);
    paymaster.totalGasPaid = BigInt.fromI32(0);
    paymaster.save();
  }
  
  return paymaster;
}

function updateDailyStats(
  chainId: i32,
  timestamp: BigInt,
  gasUsed: BigInt,
  gasCost: BigInt,
  success: boolean,
  isDeployment: boolean,
  sender: Address,
  paymaster: Address,
  bundler: Address
): void {
  let dayTimestamp = timestamp.div(BigInt.fromI32(86400)).times(BigInt.fromI32(86400));
  let date = new Date(dayTimestamp.toI64() * 1000).toISOString().split("T")[0];
  let id = chainId.toString() + "-" + dayTimestamp.toString();
  
  let stats = DailyUserOperationStats.load(id);
  if (stats == null) {
    stats = new DailyUserOperationStats(id);
    stats.chainId = chainId;
    stats.date = date;
    stats.timestamp = dayTimestamp;
    stats.totalOperations = BigInt.fromI32(0);
    stats.successfulOperations = BigInt.fromI32(0);
    stats.failedOperations = BigInt.fromI32(0);
    stats.deployments = BigInt.fromI32(0);
    stats.totalGasUsed = BigInt.fromI32(0);
    stats.avgGasUsed = BigDecimal.fromString("0");
    stats.totalGasCost = BigInt.fromI32(0);
    stats.avgGasCost = BigDecimal.fromString("0");
    stats.uniqueSenders = BigInt.fromI32(0);
    stats.uniquePaymasters = BigInt.fromI32(0);
    stats.uniqueBundlers = BigInt.fromI32(0);
  }
  
  stats.totalOperations = stats.totalOperations.plus(BigInt.fromI32(1));
  if (success) {
    stats.successfulOperations = stats.successfulOperations.plus(BigInt.fromI32(1));
  } else {
    stats.failedOperations = stats.failedOperations.plus(BigInt.fromI32(1));
  }
  if (isDeployment) {
    stats.deployments = stats.deployments.plus(BigInt.fromI32(1));
  }
  
  stats.totalGasUsed = stats.totalGasUsed.plus(gasUsed);
  stats.totalGasCost = stats.totalGasCost.plus(gasCost);
  stats.avgGasUsed = stats.totalGasUsed.toBigDecimal().div(stats.totalOperations.toBigDecimal());
  stats.avgGasCost = stats.totalGasCost.toBigDecimal().div(stats.totalOperations.toBigDecimal());
  
  stats.save();
}

function updateHourlyStats(
  chainId: i32,
  timestamp: BigInt,
  gasUsed: BigInt,
  gasCost: BigInt,
  success: boolean,
  isDeployment: boolean
): void {
  let hourTimestamp = timestamp.div(BigInt.fromI32(3600)).times(BigInt.fromI32(3600));
  let hour = new Date(hourTimestamp.toI64() * 1000).toISOString();
  let id = chainId.toString() + "-" + hourTimestamp.toString();
  
  let stats = HourlyUserOperationStats.load(id);
  if (stats == null) {
    stats = new HourlyUserOperationStats(id);
    stats.chainId = chainId;
    stats.hour = hour;
    stats.timestamp = hourTimestamp;
    stats.totalOperations = BigInt.fromI32(0);
    stats.successfulOperations = BigInt.fromI32(0);
    stats.failedOperations = BigInt.fromI32(0);
    stats.deployments = BigInt.fromI32(0);
    stats.totalGasUsed = BigInt.fromI32(0);
    stats.totalGasCost = BigInt.fromI32(0);
  }
  
  stats.totalOperations = stats.totalOperations.plus(BigInt.fromI32(1));
  if (success) {
    stats.successfulOperations = stats.successfulOperations.plus(BigInt.fromI32(1));
  } else {
    stats.failedOperations = stats.failedOperations.plus(BigInt.fromI32(1));
  }
  if (isDeployment) {
    stats.deployments = stats.deployments.plus(BigInt.fromI32(1));
  }
  
  stats.totalGasUsed = stats.totalGasUsed.plus(gasUsed);
  stats.totalGasCost = stats.totalGasCost.plus(gasCost);
  stats.save();
}

// Event handlers for EntryPoint v0.6.0
export function handleUserOperationEvent(event: ethereum.Event): void {
  let params = event.parameters;
  
  let userOpHash = params[0].value.toBytes();
  let senderAddress = params[1].value.toAddress();
  let paymasterAddress = params[2].value.toAddress();
  let nonce = params[3].value.toBigInt();
  let success = params[4].value.toBoolean();
  let actualGasCost = params[5].value.toBigInt();
  let actualGasUsed = params[6].value.toBigInt();
  
  let sender = getOrCreateAccount(senderAddress, event.block.timestamp, event.block.number);
  let paymaster = getOrCreatePaymaster(paymasterAddress, event.block.timestamp);
  
  let userOp = new UserOperation(userOpHash.toHex());
  userOp.userOpHash = userOpHash;
  userOp.entryPoint = event.address;
  userOp.sender = sender.id;
  userOp.paymaster = paymasterAddress;
  userOp.nonce = nonce;
  userOp.success = success;
  userOp.actualGasCost = actualGasCost;
  userOp.actualGasUsed = actualGasUsed;
  userOp.transactionHash = event.transaction.hash;
  userOp.blockNumber = event.block.number;
  userOp.blockTimestamp = event.block.timestamp;
  userOp.save();
  
  // Update stats
  sender.totalOperations = sender.totalOperations.plus(BigInt.fromI32(1));
  if (success) {
    sender.successfulOperations = sender.successfulOperations.plus(BigInt.fromI32(1));
  } else {
    sender.failedOperations = sender.failedOperations.plus(BigInt.fromI32(1));
  }
  sender.save();
  
  paymaster.totalOperations = paymaster.totalOperations.plus(BigInt.fromI32(1));
  paymaster.totalGasPaid = paymaster.totalGasPaid.plus(actualGasCost);
  paymaster.save();
  
  // Update aggregates
  let chainId = 1; // Mainnet - adjust based on network
  updateDailyStats(chainId, event.block.timestamp, actualGasUsed, actualGasCost, success, false, senderAddress, paymasterAddress, event.transaction.from);
  updateHourlyStats(chainId, event.block.timestamp, actualGasUsed, actualGasCost, success, false);
  
  log.info("UserOperation: {} from {} with paymaster {} - success: {}", [
    userOpHash.toHex(),
    senderAddress.toHex(),
    paymasterAddress.toHex(),
    success ? "true" : "false",
  ]);
}

export function handleAccountDeployed(event: ethereum.Event): void {
  let params = event.parameters;
  
  let userOpHash = params[0].value.toBytes();
  let senderAddress = params[1].value.toAddress();
  let factoryAddress = params[2].value.toAddress();
  let paymasterAddress = params[3].value.toAddress();
  
  let sender = getOrCreateAccount(senderAddress, event.block.timestamp, event.block.number);
  
  let deployment = new AccountDeployed(userOpHash.toHex());
  deployment.userOpHash = userOpHash;
  deployment.sender = sender.id;
  deployment.factory = factoryAddress;
  deployment.paymaster = paymasterAddress;
  deployment.transactionHash = event.transaction.hash;
  deployment.blockNumber = event.block.number;
  deployment.blockTimestamp = event.block.timestamp;
  deployment.save();
  
  // Update sender with factory info
  sender.factory = factoryAddress;
  sender.factoryUsedAt = event.block.timestamp;
  sender.save();
  
  log.info("AccountDeployed: {} via factory {} with paymaster {}", [
    senderAddress.toHex(),
    factoryAddress.toHex(),
    paymasterAddress.toHex(),
  ]);
}

export function handleUserOperationRevertReason(event: ethereum.Event): void {
  let params = event.parameters;
  
  let userOpHash = params[0].value.toBytes();
  let senderAddress = params[1].value.toAddress();
  let nonce = params[2].value.toBigInt();
  let revertReason = params[3].value.toBytes();
  
  let revert = new UserOperationRevertReason(userOpHash.toHex());
  revert.userOpHash = userOpHash;
  revert.sender = senderAddress;
  revert.nonce = nonce;
  revert.revertReason = revertReason;
  revert.transactionHash = event.transaction.hash;
  revert.blockNumber = event.block.number;
  revert.blockTimestamp = event.block.timestamp;
  revert.save();
  
  log.info("UserOperationRevert: {} from {} - reason: {}", [
    userOpHash.toHex(),
    senderAddress.toHex(),
    revertReason.toHex(),
  ]);
}

// Event handlers for EntryPoint v0.7.0
export function handleUserOperationEvent_v070(event: ethereum.Event): void {
  let params = event.parameters;
  
  let userOpHash = params[0].value.toBytes();
  let senderAddress = params[1].value.toAddress();
  let paymasterAddress = params[2].value.toAddress();
  let nonce = params[3].value.toBigInt();
  let success = params[4].value.toBoolean();
  let actualGasCost = params[5].value.toBigInt();
  let actualGasUsed = params[6].value.toBigInt();
  let actualGas = params[7].value.toBigInt();
  let computedUserOpHash = params[8].value.toBytes();
  
  let sender = getOrCreateAccount(senderAddress, event.block.timestamp, event.block.number);
  let paymaster = getOrCreatePaymaster(paymasterAddress, event.block.timestamp);
  
  let userOp = new UserOperation(userOpHash.toHex());
  userOp.userOpHash = userOpHash;
  userOp.entryPoint = event.address;
  userOp.sender = sender.id;
  userOp.paymaster = paymasterAddress;
  userOp.nonce = nonce;
  userOp.success = success;
  userOp.actualGasCost = actualGasCost;
  userOp.actualGasUsed = actualGasUsed;
  userOp.transactionHash = event.transaction.hash;
  userOp.blockNumber = event.block.number;
  userOp.blockTimestamp = event.block.timestamp;
  userOp.save();
  
  // Update stats
  sender.totalOperations = sender.totalOperations.plus(BigInt.fromI32(1));
  if (success) {
    sender.successfulOperations = sender.successfulOperations.plus(BigInt.fromI32(1));
  } else {
    sender.failedOperations = sender.failedOperations.plus(BigInt.fromI32(1));
  }
  sender.save();
  
  paymaster.totalOperations = paymaster.totalOperations.plus(BigInt.fromI32(1));
  paymaster.totalGasPaid = paymaster.totalGasPaid.plus(actualGasCost);
  paymaster.save();
  
  // Update aggregates
  let chainId = 1; // Mainnet
  updateDailyStats(chainId, event.block.timestamp, actualGasUsed, actualGasCost, success, false, senderAddress, paymasterAddress, event.transaction.from);
  updateHourlyStats(chainId, event.block.timestamp, actualGasUsed, actualGasCost, success, false);
  
  log.info("UserOperation v0.7.0: {} from {} with paymaster {} - success: {}", [
    userOpHash.toHex(),
    senderAddress.toHex(),
    paymasterAddress.toHex(),
    success ? "true" : "false",
  ]);
}

export function handleUserOperationRevertReason_v070(event: ethereum.Event): void {
  let params = event.parameters;
  
  let userOpHash = params[0].value.toBytes();
  let senderAddress = params[1].value.toAddress();
  let nonce = params[2].value.toBigInt();
  let revertReason = params[3].value.toBytes();
  let gas = params[4].value.toBigInt();
  
  let revert = new UserOperationRevertReason(userOpHash.toHex());
  revert.userOpHash = userOpHash;
  revert.sender = senderAddress;
  revert.nonce = nonce;
  revert.revertReason = revertReason;
  revert.transactionHash = event.transaction.hash;
  revert.blockNumber = event.block.number;
  revert.blockTimestamp = event.block.timestamp;
  revert.save();
  
  log.info("UserOperationRevert v0.7.0: {} from {} - gas: {}", [
    userOpHash.toHex(),
    senderAddress.toHex(),
    gas.toString(),
  ]);
}

export function handleDeposited(event: ethereum.Event): void {
  let params = event.parameters;
  let account = params[0].value.toAddress();
  let amount = params[1].value.toBigInt();
  
  let deposit = new EntryPointDeposit(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  deposit.account = account;
  deposit.amount = amount;
  deposit.transactionHash = event.transaction.hash;
  deposit.blockNumber = event.block.number;
  deposit.blockTimestamp = event.block.timestamp;
  deposit.save();
  
  log.info("Deposit: {} for {}", [amount.toString(), account.toHex()]);
}

export function handleWithdrawn(event: ethereum.Event): void {
  let params = event.parameters;
  let account = params[0].value.toAddress();
  let withdrawTo = params[1].value.toAddress();
  let amount = params[2].value.toBigInt();
  
  let withdrawal = new EntryPointWithdrawal(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  withdrawal.account = account;
  withdrawal.withdrawTo = withdrawTo;
  withdrawal.amount = amount;
  withdrawal.transactionHash = event.transaction.hash;
  withdrawal.blockNumber = event.block.number;
  withdrawal.blockTimestamp = event.block.timestamp;
  withdrawal.save();
  
  log.info("Withdrawal: {} to {} from {}", [
    amount.toString(),
    withdrawTo.toHex(),
    account.toHex(),
  ]);
}

export function handleSignatureAggregatorChanged(event: ethereum.Event): void {
  let params = event.parameters;
  let aggregator = params[0].value.toAddress();
  
  log.info("SignatureAggregator changed to {}", [aggregator.toHex()]);
}

export function handleBeforeExecution(event: ethereum.Event): void {
  log.info("BeforeExecution event at block {}", [event.block.number.toString()]);
}
