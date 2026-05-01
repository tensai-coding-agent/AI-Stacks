#!/bin/sh

set -e

GRAPH_NODE_ADMIN_ENDPOINT=${GRAPH_NODE_ADMIN_ENDPOINT:-http://graph-node:8020}
IPFS_ENDPOINT=${IPFS_ENDPOINT:-http://graph-ipfs:5001}
SUBGRAPH_VERSION_LABEL=${SUBGRAPH_VERSION_LABEL:-v1.0.0}

echo "========================================"
echo "FrameSight Subgraph Deployer"
echo "========================================"
echo "Graph Node: $GRAPH_NODE_ADMIN_ENDPOINT"
echo "IPFS: $IPFS_ENDPOINT"
echo "Version: $SUBGRAPH_VERSION_LABEL"
echo "========================================"

# Wait for graph-node to be ready
echo "Waiting for graph-node..."
until curl -s "$GRAPH_NODE_ADMIN_ENDPOINT" > /dev/null 2>&1; do
  echo "Waiting for graph-node to be available..."
  sleep 5
done
echo "Graph-node is ready!"

# Deploy subgraphs
for subgraph_dir in /subgraphs/*/; do
  if [ -d "$subgraph_dir" ]; then
    subgraph_name=$(basename "$subgraph_dir")
    echo ""
    echo "----------------------------------------"
    echo "Deploying: $subgraph_name"
    echo "----------------------------------------"
    
    cd "$subgraph_dir"
    
    # Check if subgraph.yaml exists
    if [ ! -f "subgraph.yaml" ]; then
      echo "Warning: subgraph.yaml not found in $subgraph_dir, skipping..."
      continue
    fi
    
    # Create if not exists
    echo "Creating subgraph..."
    graph create --node "$GRAPH_NODE_ADMIN_ENDPOINT" "framesight/$subgraph_name" || true
    
    # Deploy
    echo "Deploying subgraph..."
    graph deploy \
      --node "$GRAPH_NODE_ADMIN_ENDPOINT" \
      --ipfs "$IPFS_ENDPOINT" \
      --version-label "$SUBGRAPH_VERSION_LABEL" \
      "framesight/$subgraph_name" \
      subgraph.yaml || echo "Warning: Failed to deploy $subgraph_name"
    
    echo "✓ $subgraph_name deployed"
  fi
done

echo ""
echo "========================================"
echo "All subgraphs deployed!"
echo "========================================"
echo "Query endpoints:"
echo "  - ERC20: http://localhost:8000/subgraphs/name/framesight/erc20"
echo "  - NFT: http://localhost:8000/subgraphs/name/framesight/nft"
echo "  - EntryPoint: http://localhost:8000/subgraphs/name/framesight/entrypoint"
echo "========================================"
