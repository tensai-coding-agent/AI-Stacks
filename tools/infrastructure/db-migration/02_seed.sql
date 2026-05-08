-- FrameSight Seed Data
-- Run after schema creation to populate reference tables

-- ============================================================================
-- AI Models
-- ============================================================================
INSERT INTO ai_models (model_name, provider, version, capabilities, cost_per_1k_tokens, context_window, embedding_dimensions) VALUES
('gpt-4-turbo-preview', 'openai', '0125', '["chat", "function_calling", "json_mode"]'::jsonb, 0.01, 128000, NULL),
('gpt-4o', 'openai', '2024-05-13', '["chat", "vision", "function_calling", "json_mode"]'::jsonb, 0.005, 128000, NULL),
('gpt-3.5-turbo', 'openai', '0125', '["chat", "function_calling", "json_mode"]'::jsonb, 0.0005, 16385, NULL),
('text-embedding-3-small', 'openai', '1', '["embedding"]'::jsonb, 0.00002, 8191, 1536),
('text-embedding-3-large', 'openai', '1', '["embedding"]'::jsonb, 0.00013, 8191, 3072),
('claude-3-opus-20240229', 'anthropic', '20240229', '["chat", "vision", "function_calling"]'::jsonb, 0.015, 200000, NULL),
('claude-3-sonnet-20240229', 'anthropic', '20240229', '["chat", "vision", "function_calling"]'::jsonb, 0.003, 200000, NULL),
('claude-3-haiku-20240307', 'anthropic', '20240307', '["chat", "vision"]'::jsonb, 0.00025, 200000, NULL);

-- ============================================================================
-- Data Sources
-- ============================================================================
INSERT INTO data_sources (source_name, source_type, network, rpc_endpoint, api_endpoint, auth_config) VALUES
('ethereum-mainnet', 'blockchain', 'mainnet', 'https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}', NULL, '{"provider": "alchemy"}'::jsonb),
('ethereum-sepolia', 'blockchain', 'sepolia', 'https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}', NULL, '{"provider": "alchemy"}'::jsonb),
('polygon-mainnet', 'blockchain', 'polygon', 'https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}', NULL, '{"provider": "alchemy"}'::jsonb),
('base-mainnet', 'blockchain', 'base', 'https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}', NULL, '{"provider": "alchemy"}'::jsonb),
('arbitrum-mainnet', 'blockchain', 'arbitrum', 'https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}', NULL, '{"provider": "alchemy"}'::jsonb),
('thegraph-ethereum', 'api', 'mainnet', NULL, 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3', '{"auth_type": "bearer"}'::jsonb),
('coingecko', 'api', NULL, NULL, 'https://api.coingecko.com/api/v3', '{"rate_limit": "10-30/min"}'::jsonb),
('defillama', 'api', NULL, NULL, 'https://api.llama.fi', '{}'::jsonb);

-- ============================================================================
-- Alert Rules (Example configurations)
-- ============================================================================
INSERT INTO alert_rules (rule_name, description, condition_type, condition_config, severity, notification_channels) VALUES
('Large Transfer Detection', 'Detects transfers over 1000 ETH', 'threshold', '{
    "event_type": "Transfer",
    "field": "value",
    "operator": ">=",
    "threshold": "1000000000000000000000",
    "unit": "wei"
}'::jsonb, 'warning', '["slack", "webhook"]'::jsonb),

('Price Volatility Spike', 'Detects 5% price change in 5 minutes', 'threshold', '{
    "metric": "price_change_percent",
    "window": "5 minutes",
    "operator": ">=",
    "threshold": 5
}'::jsonb, 'critical', '["slack", "pagerduty", "email"]'::jsonb),

('Liquidity Drain', 'Detects sudden liquidity decrease >30%', 'threshold', '{
    "metric": "liquidity_change_percent",
    "window": "1 hour",
    "operator": "<=",
    "threshold": -30
}'::jsonb, 'critical', '["slack", "pagerduty"]'::jsonb),

('Smart Contract Interaction Anomaly', 'ML-based anomaly detection for contract calls', 'anomaly', '{
    "model": "isolation_forest",
    "features": ["gas_used", "call_frequency", "value_transferred"],
    "sensitivity": 0.95
}'::jsonb, 'warning', '["slack"]'::jsonb),

('Whale Wallet Activity', 'Tracks known whale wallet transactions', 'pattern', '{
    "watchlist": "whale_wallets",
    "min_value": "10000000000000000000",
    "track_types": ["transfer", "swap", "stake"]
}'::jsonb, 'info', '["slack"]'::jsonb);
