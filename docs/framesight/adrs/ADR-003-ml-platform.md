# ADR-003: ML Platform Architecture

## Status
Accepted

## Context

FrameSight's core differentiator is AI-powered intent classification and anomaly detection. We need an ML platform that:
- Supports real-time inference (classify transactions as they happen)
- Enables continuous model improvement
- Is cost-effective for a startup
- Can scale from MVP to production

## Decision

We will build a **modular ML platform** with three inference patterns:

### 1. Real-Time Intent Classification

**Pattern:** Model served via SageMaker Serverless or self-hosted

**Architecture:**
```
Transaction Event
      │
      ▼
┌───────────────┐
│ Feature Store │───► Pre-computed address embeddings
│  (Feast/Dynamo)│
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  Embedding    │───► all-MiniLM-L6-v2 or similar
│  Model (Fast) │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  Intent Classifier │───► Fine-tuned LLM (Llama 3 8B)
│  (LLM-based)  │     or lightweight classifier (XGBoost)
└───────┬───────┘
        │
        ▼
   IntentPrediction
```

**Model Serving Options:**

| Stage | Serving Method | Cost Model | Latency |
|-------|----------------|------------|---------|
| MVP | Self-hosted (vLLM) | Compute only | ~50ms |
| Growth | SageMaker Serverless | Per-request | ~100ms |
| Scale | SageMaker Real-time | Instance-based | ~20ms |

**Rationale:**
- LLMs capture nuance in transaction descriptions
- Can start with smaller models (3B params) and scale up
- Fine-tuning on domain-specific data improves accuracy

### 2. Batch Anomaly Detection

**Pattern:** Scheduled jobs using historical data

**Models:**
- **Isolation Forest** for outlier detection
- **LSTM Autoencoders** for sequence anomalies
- **Clustering** (DBSCAN) for behavioral grouping

**Pipeline:**
```
Data Lake (S3)
     │
     ▼
SageMaker Processing Job
     │
     ├───► Feature engineering
     ├───► Model inference
     └───► Alert generation
     │
     ▼
TimescaleDB (anomalies table)
```

### 3. Feedback Loop (Active Learning)

**Pattern:** User corrections improve model

```
User Action
     │
     ▼
┌───────────────┐
│  Correction   │───► "This was a swap, not a transfer"
│  Logged       │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  Ground Truth │───► Stored in labeling DB
│  Database     │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  Periodic     │───► Weekly retraining job
│  Retraining   │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  Model        │───► Deploy if accuracy improves
│  Evaluation   │
└───────────────┘
```

## Training Data Strategy

### Data Sources

1. **On-Chain Data**
   - Transaction traces
   - Event logs
   - Contract bytecode

2. **Protocol Documentation**
   - ABI definitions
   - Method signatures
   - Project documentation

3. **User Feedback**
   - Manual corrections
   - Thumb up/down on classifications
   - Support tickets

### Labeling Pipeline

```python
# Pseudo-code for labeling job
async def label_transaction(tx: Transaction) -> IntentLabel:
    # 1. Heuristic pre-labeling
    heuristic_intent = apply_heuristics(tx)
    
    # 2. LLM-assisted labeling (GPT-4 for ground truth)
    llm_intent = await gpt4_classify(tx)
    
    # 3. Store with confidence scores
    return IntentLabel(
        transaction=tx,
        heuristic=heuristic_intent,
        llm_assisted=llm_intent,
        needs_review=heuristic_intent != llm_intent,
        confidence=min(heuristic_intent.confidence, llm_intent.confidence)
    )
```

## Model Registry

Using **MLflow** (self-hosted or Databricks):

```
Model Versions:
├── intent-classifier/
│   ├── v1.0.0 (baseline XGBoost)
│   ├── v1.1.0 (+ more DeFi protocols)
│   ├── v2.0.0 (Llama 3 fine-tuned)
│   └── production → v1.1.0
│   └── staging → v2.0.0
│
├── address-embedder/
│   └── v1.0.0 (all-MiniLM-L6-v2)
│
└── anomaly-detector/
    └── v1.0.0 (Isolation Forest)
```

## Infrastructure

### MVP Stack (Bootstrap)

| Component | Tool | Cost |
|-----------|------|------|
| Training | Local GPU or SageMaker Studio Lab | Free |
| Model Serving | vLLM on EC2 g5.xlarge | ~$0.50/hr |
| Feature Store | DynamoDB | ~$5/mo |
| Registry | MLflow on EC2 | ~$20/mo |
| Monitoring | Custom metrics to CloudWatch | ~$10/mo |

### Production Stack (Scale)

| Component | Tool |
|-----------|------|
| Training | SageMaker Training Jobs |
| Serving | SageMaker Endpoints |
| Feature Store | SageMaker Feature Store |
| Registry | SageMaker Model Registry |
| Monitoring | SageMaker Model Monitor |

## Consequences

### Positive
- Three inference patterns cover all use cases
- Can start cheap (MVP stack ~$100/mo)
- Clear upgrade path to managed services
- Feedback loop enables continuous improvement

### Negative
- Multiple serving patterns add complexity
- Need ML expertise for model fine-tuning
- Cold start latency with serverless (mitigate with provisioned concurrency)

## Evaluation Metrics

### Intent Classification
- **Accuracy:** % of correct classifications
- **Precision/Recall:** Per-intent metrics
- **F1 Score:** Harmonic mean
- **Latency:** P99 inference time

Target: 85% accuracy MVP, 95% at scale

### Anomaly Detection
- **Precision:** % of alerts that are true anomalies
- **Recall:** % of true anomalies caught
- **False Positive Rate:** % of normal flagged

Target: <5% FPR, >90% recall

## Success Criteria

1. **Week 1:** Baseline model (heuristics + simple classifier) deployed
2. **Month 1:** LLM-based classifier with 80%+ accuracy
3. **Month 3:** Feedback loop operational, 85%+ accuracy
4. **Month 6:** Anomaly detection in production

## Related

- [ADR-001: Indexing Engine Selection](./ADR-001-indexing-engine.md)
- [ADR-002: Database Schema Design](./ADR-002-database-schema.md)
- FrameSight Architecture: [README](./../README.md)
- Epic: [TEN-12 FrameSight](/TEN/issues/TEN-12)

---

Co-Authored-By: Paperclip <noreply@paperclip.ing>
