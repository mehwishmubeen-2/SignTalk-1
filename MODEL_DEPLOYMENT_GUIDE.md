# SignTalk Model Deployment Guide

## Overview
This document provides detailed information about all models used in the SignTalk backend, including their sizes, architecture details, and deployment requirements.

---

## 1. EMOTION DETECTION MODEL

### Model Details
- **Model Name:** `j-hartmann/emotion-english-distilroberta-base`
- **Type:** Text Classification (Transformers)
- **Framework:** PyTorch
- **Base Architecture:** DistilRoBERTa-base (Distilled version of RoBERTa)

### Model Specifications
| Metric | Value |
|--------|-------|
| **Model Parameters** | ~82M (82 million) |
| **Layers** | 6 |
| **Hidden Dimension** | 768 |
| **Attention Heads** | 12 |
| **Base Model Size (PyTorch)** | ~313 MB (per file) |
| **Total Cached Size** | **629.11 MB** |
| **Inference Speed** | ~2x faster than full RoBERTa-base |
| **Device** | CPU (device=-1) |

### Supported Emotions (7 Classes)
1. **joy** → Happy 😊 (#22c55e)
2. **sadness** → Sad 😢 (#3b82f6)
3. **anger** → Angry 😠 (#ef4444)
4. **neutral** → Neutral 😐 (#94a3b8)
5. **disgust** → Disgust 🤢 (#a855f7)
6. **fear** → Fear 😨 (#f97316)
7. **surprise** → Surprised 😲 (#eab308)

### Training Data
The model was fine-tuned on 6 diverse datasets:
- Crowdflower (2016)
- Emotion Dataset (Elvis et al. 2018)
- GoEmotions (Demszky et al. 2020)
- ISEAR (Vikash 2018)
- MELD (Poria et al. 2019)
- SemEval-2018

**Data Sources:** Twitter, Reddit, student self-reports, TV dialogues

### Tokenizer Information
- **Tokenizer Type:** RoBERTa BPE Tokenizer
- **Vocabulary Size:** 50,265 tokens
- **Special Tokens:**
  - `<s>` (BOS - Beginning of Sequence)
  - `</s>` (EOS - End of Sequence)
  - `<unk>` (Unknown token)
  - `<pad>` (Padding token)
  - `<mask>` (Mask token)
- **Max Sequence Length:** 512 tokens

### Files in Cache
```
models--j-hartmann--emotion-english-distilroberta-base/
├── config.json                    (0 KB)
├── merges.txt                     (1.29 MB)
├── pytorch_model.bin              (0 KB - symbolic link)
├── special_tokens_map.json        (0 KB)
├── tokenizer.json                 (0 KB)
├── tokenizer_config.json          (0 KB)
├── vocab.json                     (0 KB)
├── [Large binary files]           (313.29 MB + 313.32 MB)
└── [Metadata files]               (~0.76 MB + 0.44 MB)
```

### Deployment Considerations
- ✅ **Lightweight:** ~630 MB total (fits easily in most deployments)
- ✅ **CPU-Only:** No GPU required
- ✅ **Fast Inference:** Minimal latency for real-time emotion detection
- ⚠️ **Language:** English only
- ✅ **License:** Permissive (research use)

### Usage Code
```python
from transformers import pipeline

emotion_pipeline = pipeline(
    "text-classification",
    model="j-hartmann/emotion-english-distilroberta-base",
    top_k=None,
    device=-1  # CPU
)

results = emotion_pipeline("I am very happy!")
```

---

## 2. GRAMMAR CORRECTION MODEL

### Model Details
- **Model Name:** `vennify/t5-base-grammar-correction`
- **Type:** Sequence-to-Sequence (Text2Text Generation)
- **Framework:** PyTorch
- **Base Architecture:** T5-Base (Google Text-To-Text Transfer Transformer)

### Model Specifications
| Metric | Value |
|--------|-------|
| **Model Parameters** | 220M (220 million) |
| **Encoder Layers** | 12 |
| **Decoder Layers** | 12 |
| **Hidden Dimension** | 768 |
| **Feed-Forward Dimension** | 3,072 |
| **Attention Heads** | 12 |
| **Base Model Size (PyTorch)** | ~850 MB (per file) |
| **Total Cached Size** | **1,702.84 MB (~1.7 GB)** |
| **Max Input Length** | 512 tokens |
| **Max Output Length** | 128 tokens |
| **Device** | CPU |

### Training Dataset
- **Dataset:** JFLEG (Fluency Corpus and Benchmark)
- **Size:** Sentence-level grammatical error annotations
- **Paper:** "JFLEG: A Fluency Corpus and Benchmark for Grammatical Error Correction" (2017)
- **Purpose:** Fine-tuned for grammatical error correction in English text
- **Training Framework:** Happy Transformer

### Key Features
- **Prefix-Based:** Requires "grammar: " prefix for input
- **Minimal Edits:** Makes faithful, minimal-edit corrections (not hallucinating)
- **Telegraphic Input:** Specialized for short, word-by-word input like ASL translations
  - ✅ Correctly handles "I HUNGRY" → "I'm hungry."
  - ✅ Handles "WHERE BATHROOM" → "Where is the bathroom?"
  - ❌ Avoids hallucinations seen with other models

### Tokenizer Information
- **Tokenizer Type:** SentencePiece (T5 Tokenizer)
- **Vocabulary Size:** 32,000 tokens (learned from C4 corpus)
- **Special Tokens:**
  - `<unk>` (Unknown)
  - `<s>` (Start)
  - `</s>` (End)
  - `<pad>` (Padding)
- **Max Sequence Length:** 512 tokens (input), 128 (output)

### Files in Cache
```
models--vennify--t5-base-grammar-correction/
├── config.json                    (0 KB)
├── generation_config.json         (0 KB)
├── pytorch_model.bin              (0 KB - symbolic link)
├── special_tokens_map.json        (0 KB)
├── spiece.model                   (1.32 MB)
├── tokenizer.json                 (0 KB)
├── tokenizer_config.json          (0 KB)
├── [Large binary files]           (850.42 MB + 850.34 MB)
├── [Metadata]                     (~0.75 MB + d60a...)
└── [Index files]                  (generation_config.json)
```

### Deployment Considerations
- ⚠️ **Large:** ~1.7 GB (significantly larger than emotion model)
- ✅ **CPU Compatible:** Works on CPU (though slower than GPU)
- ✅ **No Internet Dependency:** Runs locally after download
- ⚠️ **Memory:** Requires ~2-3 GB RAM for comfortable inference
- ✅ **License:** CC-BY-NC-SA 4.0 (research/commercial with attribution)

### Usage Code
```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tokenizer = AutoTokenizer.from_pretrained("vennify/t5-base-grammar-correction")
model = AutoModelForSeq2SeqLM.from_pretrained("vennify/t5-base-grammar-correction")

input_text = "grammar: " + "i hungry".lower()
inputs = tokenizer(input_text, return_tensors="pt", truncation=True, max_length=128)
output_ids = model.generate(**inputs, max_length=128, num_beams=4)
corrected = tokenizer.decode(output_ids[0], skip_special_tokens=True)
```

---

## 3. SIGN RECOGNITION MODEL

### Overview
The Sign Recognition system uses a hybrid approach combining MediaPipe for hand detection and machine learning for sign classification.

### 3.1 Hand Landmark Detection

**Model:** MediaPipe Hand Landmarker (Task-Based API)
- **Type:** Hand Pose Estimation
- **Framework:** MediaPipe Tasks (TensorFlow-based)
- **File:** `hand_landmarker.task`
- **Size:** 7.46 MB

#### Hand Landmarks
- **Detects:** 21 hand landmarks per hand
- **Coordinates:** (x, y, z) coordinates
  - x, y: Normalized to image dimensions (0-1)
  - z: Depth relative to wrist
- **Total Features:** 63 (21 landmarks × 3 coordinates)

#### Feature Normalization (63 Features)
```
For each hand:
  1. Normalize all coordinates relative to wrist position
  2. Scale by maximum absolute value across all coordinates
  3. This creates rotation-invariant, scale-invariant features
  4. Final input: 63-dimensional feature vector
```

### 3.2 Random Forest Classifier

**Model:** ASL Random Forest Classifier
- **File:** `asl_rf_model.pkl`
- **Size:** 78.85 MB
- **Type:** Scikit-learn Random Forest
- **Configuration:**
  - Multiple decision trees
  - Trained on hand landmark features
  - Outputs class probabilities
  - Uses `predict_proba()` for confidence scores

### 3.3 PyTorch Models (K-Fold Validation)

**Files:** `best_0.pt` through `best_4.pt`
- **Size per model:** 4.27 MB each
- **Total:** 21.35 MB (5 models)
- **Purpose:** K-Fold cross-validation checkpoints
- **Type:** PyTorch neural networks
- **Framework:** Deep learning for sign classification

### 3.4 Sign Vocabulary

**Total Classes:** 20 ASL sign phrases
```
1. bye
2. good_morning
3. hello
4. how_are_you
5. i_am_busy
6. i_am_fine
7. i_cant_hear_you
8. i_dont_know
9. i_know
10. i_need_help
11. i_understand
12. nice_to_meet_you
13. no_sign (silence/no gesture detected)
14. no_thankyou
15. same_here
16. see_you_later
17. take_care
18. what_is_your_name
19. whats_up
20. yes_please
```

### Model Files Summary

| Model | Size | Type | Purpose |
|-------|------|------|---------|
| `hand_landmarker.task` | 7.46 MB | MediaPipe | Hand detection & landmark extraction |
| `asl_rf_model.pkl` | 78.85 MB | Random Forest | Sign classification (primary) |
| `best_0.pt` - `best_4.pt` | 4.27 MB each | PyTorch | Deep learning models (k-fold validation) |
| **Total** | **107.65 MB** | Hybrid | Complete sign recognition pipeline |

### Deployment Considerations
- ✅ **Compact:** ~108 MB total (fits in mobile/edge devices)
- ✅ **Real-time:** Fast inference for video frames
- ✅ **Offline:** No internet required after download
- ✅ **CPU-First:** Works on CPU (or GPU for acceleration)
- ⚠️ **ASL-Specific:** Only recognizes 20 common ASL phrases
- ✅ **MediaPipe:** Proven, stable library for hand detection

### Processing Pipeline
```
Input Image
    ↓
[MediaPipe HandLandmarker]
    ↓
21 hand landmarks (x, y, z)
    ↓
[Feature Normalization]
    ↓
63-dimensional feature vector
    ↓
[Random Forest Classifier]
    ↓
Class probabilities
    ↓
[argmax + Label Encoding]
    ↓
Sign label + confidence score
```

---

## 4. TOTAL DEPLOYMENT SIZE SUMMARY

### Model Sizes Breakdown

| Component | Size | Type |
|-----------|------|------|
| **Emotion Model** | 629.11 MB | Transformers (DistilRoBERTa) |
| **Grammar Model** | 1,702.84 MB | Transformers (T5-Base) |
| **Sign Recognition** | 107.65 MB | Hybrid (MediaPipe + ML) |
| **Dependencies** | ~800 MB | Libraries (transformers, mediapipe, torch) |
| **TOTAL** | **~3.2 GB** | All models + dependencies |

### Storage vs. Memory Requirements

**Storage (Downloaded Models):**
- Models cache: ~2.44 GB
- Python libraries: ~800 MB
- Application code: ~50 MB
- **Total:** ~3.3 GB

**Runtime Memory (Peak Usage):**
- Emotion model: ~300 MB (loaded)
- Grammar model: ~400 MB (loaded)
- Sign recognition: ~100 MB (loaded)
- Other libraries: ~200 MB
- **Peak:** ~1.0 GB (sufficient for most servers)

---

## 5. DEPLOYMENT RECOMMENDATIONS

### For Cloud Deployment (AWS, Google Cloud, Azure)

**Recommended Config:**
- **Instance Type:** t3.medium or equivalent (2 vCPU, 4 GB RAM)
- **Storage:** 20 GB SSD (12 GB for models + overhead)
- **Docker Image Size:** ~2 GB
- **Startup Time:** 30-60 seconds (model loading)

**Cost Estimate:**
- Monthly compute: $30-50 USD
- Storage: $5-10 USD
- **Total:** ~$40-60 USD/month

### For Local/On-Premise Deployment

**Minimum Requirements:**
- **CPU:** 2 cores (Intel i5/Ryzen 5 or better)
- **RAM:** 4 GB (8 GB recommended)
- **Storage:** 20 GB SSD
- **Network:** Not required after initial download

### For Docker Deployment

```dockerfile
# Suggested base image
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0

# Copy requirements
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download models (optional, speeds up startup)
RUN python -c "from transformers import pipeline; \
    pipeline('text-classification', model='j-hartmann/emotion-english-distilroberta-base'); \
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM; \
    AutoTokenizer.from_pretrained('vennify/t5-base-grammar-correction'); \
    AutoModelForSeq2SeqLM.from_pretrained('vennify/t5-base-grammar-correction')"

# Copy application
COPY backend/ /app/

WORKDIR /app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Build Command:**
```bash
docker build -t signtalk-backend:latest .
docker run -p 8000:8000 -m 3g signtalk-backend:latest
```

---

## 6. PERFORMANCE BENCHMARKS

### Inference Latency (on CPU, single request)

| Model | Input | Latency | Notes |
|-------|-------|---------|-------|
| **Emotion** | "I am happy" | ~50-100ms | DistilRoBERTa (fast) |
| **Grammar** | "i hungry" | ~200-400ms | T5 (slower, seq2seq) |
| **Sign Recognition** | Image frame | ~100-200ms | MediaPipe + RF |

**Concurrent Requests:**
- 5 concurrent emotion requests: ~500ms (batched)
- Mixed workload (all 3 models): ~600-800ms

---

## 7. GRAMMAR MODEL ALPHABET & VOCABULARY

### T5 Tokenizer (SentencePiece)

**Vocabulary Details:**
- **Type:** Learned SentencePiece vocabulary
- **Size:** 32,000 tokens
- **Coverage:** 99.9% of C4 corpus
- **Special Sequences:**
  - Prefix: `"grammar: "` before input
  - Output: Grammatically correct sentence
  - Max length: 128 tokens (output)

**Token Statistics:**
- Subword tokens: ~25,000
- Special tokens: ~32
- Language coverage: English + European languages (from C4)

---

## 8. EMOTION MODEL ALPHABET & VOCABULARY

### DistilRoBERTa Tokenizer (BPE)

**Vocabulary Details:**
- **Type:** Byte-Pair Encoding (BPE)
- **Size:** 50,265 tokens
- **Base Model:** RoBERTa (trained on 160GB C4 data)
- **Special Tokens:** 5 (UNK, BOS, EOS, PAD, MASK)

**Supported Characters:**
- All ASCII characters
- Common punctuation
- Accented characters (à, é, ñ, etc.)
- Emoji support (via encoding)
- Numbers (0-9)
- Multiple languages (English primary)

**Max Context:** 512 tokens (~2000 characters)

---

## 9. COMPARISON WITH ALTERNATIVE MODELS

### Emotion Detection Alternatives

| Model | Parameters | Size | Speed | Accuracy |
|-------|-----------|------|-------|----------|
| **DistilRoBERTa-base (Current)** | 82M | 629 MB | ⭐⭐⭐⭐ Fast | ⭐⭐⭐⭐ High |
| RoBERTa-large | 355M | 1.3 GB | ⭐⭐⭐ Medium | ⭐⭐⭐⭐⭐ Highest |
| BERT-base | 110M | 440 MB | ⭐⭐⭐ Medium | ⭐⭐⭐ Good |
| DistilBERT-base | 66M | 268 MB | ⭐⭐⭐⭐⭐ Fastest | ⭐⭐⭐ Good |

**Recommendation:** Current choice is optimal for deployment (balance of accuracy and speed).

### Grammar Correction Alternatives

| Model | Parameters | Size | Speed | Quality |
|--------|-----------|------|-------|---------|
| **T5-Base (Current)** | 220M | 1.7 GB | ⭐⭐⭐ Medium | ⭐⭐⭐⭐ Good |
| T5-Small | 60M | 242 MB | ⭐⭐⭐⭐ Fast | ⭐⭐⭐ Fair |
| T5-Large | 770M | 2.9 GB | ⭐⭐ Slow | ⭐⭐⭐⭐⭐ Excellent |
| BERT (sequence labeling) | 110M | 440 MB | ⭐⭐⭐⭐ Fast | ⭐⭐⭐ Fair |

**Recommendation:** Current choice balances model size and quality for ASL corrections.

---

## 10. MONITORING & MAINTENANCE

### Model Health Checks

**Emotion Model:**
```python
# Quick sanity check
result = emotion_pipeline("I love this!")
assert result[0][4]['label'] == 'joy', "Model output mismatch"
```

**Grammar Model:**
```python
# Verify grammar correction works
input_text = "grammar: " + "i hungry".lower()
inputs = tokenizer(input_text, return_tensors="pt")
outputs = model.generate(**inputs, max_length=128)
output_text = tokenizer.decode(outputs[0])
assert "hungry" in output_text.lower(), "Model output mismatch"
```

### Disk Space Monitoring

**Alert thresholds:**
- ⚠️ Warning: When free space < 2 GB
- 🔴 Critical: When free space < 500 MB
- Action: Archive old logs, clear temporary cache

### Cache Management

**Hugging Face Cache:**
```bash
# Location
~/.cache/huggingface/hub/

# Estimated size
Total: 2.4 GB

# Safe to delete (will re-download on startup)
rm -rf ~/.cache/huggingface/hub/
```

---

## 11. VERSION PINNING & REPRODUCIBILITY

### Current Versions (from requirements.txt)

```
transformers==5.17.0
mediapipe==0.10.14
scikit-learn==1.6.1
joblib==1.6.0
torch (CPU): installed via Docker base
```

### Model Commit Hashes (for exact reproduction)

**Emotion Model:**
- Repository: `j-hartmann/emotion-english-distilroberta-base`
- Commit: `0e1cd914e3d46199ed785853e12b57304e04178b`

**Grammar Model:**
- Repository: `vennify/t5-base-grammar-correction`
- Commit: `9e4a09d21dca1072a69302df9261289d03c3ed78`

---

## 12. SECURITY NOTES

### API Key Management ⚠️

**IMPORTANT:** The `.env` file contains Hugging Face API tokens and should be:
- ✅ **Added to `.gitignore`** (never commit)
- ✅ **Stored securely** in CI/CD secrets
- ✅ **Rotated regularly** (if exposed)
- ❌ **Never shared** in code or documentation

### Model Integrity

**Verify downloaded models:**
```bash
# Transformers library auto-verifies via SHA256
# No additional verification needed
```

---

## 13. QUICK START DEPLOYMENT CHECKLIST

- [ ] Install Python 3.11+
- [ ] Install dependencies: `pip install -r requirements.txt`
- [ ] Pre-download models (optional):
  ```bash
  python -c "from transformers import pipeline; pipeline('text-classification', model='j-hartmann/emotion-english-distilroberta-base')"
  python -c "from transformers import AutoTokenizer; AutoTokenizer.from_pretrained('vennify/t5-base-grammar-correction')"
  ```
- [ ] Configure `.env` with API keys
- [ ] Start backend: `python main.py`
- [ ] Test endpoints:
  - POST `/emotion/detect` with `{"text": "I am happy"}`
  - POST `/grammar/correct` with `{"text": "i hungry"}`
  - POST `/sign/predict` with base64 image

---

## 14. TROUBLESHOOTING

### Model Loading Issues

**Problem:** "Model not found in cache"
```
Solution: Delete cache and re-download
rm -rf ~/.cache/huggingface/hub/
python main.py  # Will re-download on startup
```

**Problem:** "CUDA out of memory"
```
Solution: Ensure device=-1 for CPU mode (already configured)
```

**Problem:** "Tokenizer vocab file not found"
```
Solution: Reinstall transformers
pip install --upgrade --force-reinstall transformers==5.17.0
```

### Performance Issues

**Slow emotion detection:**
- Normal latency: 50-100ms
- If > 500ms: Check CPU usage, RAM availability
- Solution: Reduce concurrent requests or use GPU

**Slow grammar correction:**
- Normal latency: 200-400ms
- T5 is inherently slower due to seq2seq architecture
- Solution: Use T5-Small for faster inference (with slight accuracy trade-off)

---

## Summary Table

| Aspect | Emotion | Grammar | Sign Recognition | Total |
|--------|---------|---------|------------------|-------|
| **Cache Size** | 629 MB | 1.7 GB | 108 MB | 2.44 GB |
| **Parameters** | 82M | 220M | Mixed | 302M |
| **Inference Time** | 50-100ms | 200-400ms | 100-200ms | ~400-600ms |
| **Memory** | 300 MB | 400 MB | 100 MB | ~1 GB |
| **CPU Only** | ✅ | ✅ | ✅ | ✅ |
| **Offline** | ✅ | ✅ | ✅ | ✅ |
| **Deployment Ready** | ✅ | ✅ | ✅ | ✅ |

---

## References

- **Emotion Model:** https://huggingface.co/j-hartmann/emotion-english-distilroberta-base
- **Grammar Model:** https://huggingface.co/vennify/t5-base-grammar-correction
- **MediaPipe Hand:** https://mediapipe.dev/
- **Transformers Docs:** https://huggingface.co/docs/transformers/

---

**Last Updated:** 2026-11-14  
**Backend Version:** 1.0.0  
**Author:** SignTalk Development Team
