# FrameSight Graph Node - Query Examples

## ERC-20 Subgraph Queries

### Get Recent Transfers
```graphql
{
  transfers(first: 10, orderBy: timestamp, orderDirection: desc) {
    id
    transactionHash
    timestamp
    blockNumber
    from {
      address
    }
    to {
      address
    }
    value
    token {
      symbol
      decimals
    }
    gasUsed
    gasPrice
  }
}
```

### Get Token Info
```graphql
{
  tokens(first: 5) {
    id
    address
    symbol
    name
    decimals
    totalSupply
    transferCount
    holderCount
    createdAt
  }
}
```

### Get Account Balances
```graphql
{
  accountBalances(where: {account: "0x..."}) {
    id
    token {
      symbol
      decimals
    }
    balance
    updatedAt
  }
}
```

### Daily Transfer Volume
```graphql
{
  dailyTransferVolumes(first: 7, orderBy: timestamp, orderDirection: desc) {
    id
    date
    token {
      symbol
    }
    transferCount
    totalVolume
  }
}
```

### Specific Token Transfers
```graphql
{
  transfers(
    where: {token: "0x..."}
    first: 20
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    from {
      address
    }
    to {
      address
    }
    value
    timestamp
  }
}
```

## NFT Subgraph Queries

### Get Recent NFT Transfers
```graphql
{
  nftTransfers(first: 10, orderBy: timestamp, orderDirection: desc) {
    id
    transactionHash
    timestamp
    nftContract {
      name
      contractType
    }
    token {
      tokenId
      uri
    }
    from {
      address
    }
    to {
      address
    }
    isBatch
  }
}
```

### Get NFT Collection Info
```graphql
{
  nftContracts(first: 5) {
    id
    address
    name
    symbol
    contractType
    totalSupply
    transferCount
    holderCount
  }
}
```

### Get Tokens Owned by Account
```graphql
{
  account(id: "0x...") {
    address
    tokensOwned {
      tokenId
      contract {
        name
        contractType
      }
      uri
      mintedAt
    }
  }
}
```

### Daily NFT Volume
```graphql
{
  dailyNFTVolumes(first: 30, orderBy: timestamp, orderDirection: desc) {
    id
    date
    nftContract {
      name
      contractType
    }
    transferCount
    mintCount
    burnCount
    totalVolume
  }
}
```

## EntryPoint (Account Abstraction) Subgraph Queries

### Get Recent UserOperations
```graphql
{
  userOperations(first: 10, orderBy: blockTimestamp, orderDirection: desc) {
    id
    userOpHash
    entryPoint
    sender {
      address
      totalOperations
      successfulOperations
    }
    paymaster
    nonce
    success
    actualGasUsed
    actualGasCost
    blockNumber
    blockTimestamp
  }
}
```

### Get Account Details
```graphql
{
  account(id: "0x...") {
    address
    createdAt
    totalOperations
    successfulOperations
    failedOperations
    factory
    factoryUsedAt
    operations(first: 5, orderBy: blockTimestamp, orderDirection: desc) {
      userOpHash
      success
      actualGasCost
      blockTimestamp
    }
  }
}
```

### Get Paymaster Stats
```graphql
{
  paymasters(first: 10, orderBy: totalOperations, orderDirection: desc) {
    id
    address
    totalOperations
    totalGasPaid
    createdAt
  }
}
```

### Daily UserOperation Stats
```graphql
{
  dailyUserOperationStats(first: 30, orderBy: timestamp, orderDirection: desc) {
    id
    date
    chainId
    totalOperations
    successfulOperations
    failedOperations
    deployments
    totalGasUsed
    avgGasUsed
    totalGasCost
    uniqueSenders
    uniquePaymasters
  }
}
```

### Get Failed Operations
```graphql
{
  userOperations(
    where: {success: false}
    first: 20
    orderBy: blockTimestamp
    orderDirection: desc
  ) {
    id
    userOpHash
    sender {
      address
    }
    revertReason {
      revertReason
    }
    blockTimestamp
  }
}
```

### Get Recent Deployments
```graphql
{
  accountDeployeds(first: 10, orderBy: blockTimestamp, orderDirection: desc) {
    id
    userOpHash
    sender {
      address
    }
    factory
    paymaster
    blockTimestamp
  }
}
```

## Combined/Hybrid Queries

### FrameSight Overview Stats
```graphql
{
  # ERC-20 stats
  tokens {
    totalSupply
  }
  
  # NFT stats
  nftContracts {
    totalSupply
    transferCount
  }
  
  # AA stats
  dailyUserOperationStats(first: 1, orderBy: timestamp, orderDirection: desc) {
    totalOperations
    successfulOperations
    uniqueSenders
  }
}
```

## Using curl

```bash
# ERC-20 transfers
curl http://localhost:8000/subgraphs/name/framesight/erc20 \
  -H "Content-Type: application/json" \
  -d '{"query": "{ transfers(first: 5) { id from { id } to { id } value } }"}'

# NFT transfers
curl http://localhost:8000/subgraphs/name/framesight/nft \
  -H "Content-Type: application/json" \
  -d '{"query": "{ nftTransfers(first: 5) { id token { tokenId } from { address } to { address } } }"}'

# EntryPoint operations
curl http://localhost:8000/subgraphs/name/framesight/entrypoint \
  -H "Content-Type: application/json" \
  -d '{"query": "{ userOperations(first: 5) { userOpHash sender { address } success } }"}'
```

## Using JavaScript/TypeScript

```typescript
const query = `
  {
    userOperations(first: 10) {
      userOpHash
      sender { address }
      success
      actualGasCost
    }
  }
`;

const response = await fetch('http://localhost:8000/subgraphs/name/framesight/entrypoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});

const data = await response.json();
console.log(data.data.userOperations);
```

## Pagination

```graphql
{
  transfers(
    first: 100
    skip: 0
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    value
  }
}
```

## Filtering

```graphql
{
  transfers(
    where: {
      value_gt: "1000000000000000000"
      timestamp_gt: "1700000000"
    }
  ) {
    id
    value
    timestamp
  }
}
```

---

Co-Authored-By: Paperclip <noreply@paperclip.ing>
