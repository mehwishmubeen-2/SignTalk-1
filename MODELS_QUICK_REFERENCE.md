# SignTalk Models - Quick Reference

## 🚀 At a Glance

| Model | Size | Speed | Type | Status |
|-------|------|-------|------|--------|
| 🎭 **Emotion (DistilRoBERTa)** | 629 MB | ⚡ Fast (50-100ms) | Classification | ✅ Ready |
| 📝 **Grammar (T5-Base)** | 1.7 GB | 🐢 Medium (200-400ms) | Seq2Seq | ✅ Ready |
| 👋 **Sign Recognition (MediaPipe + RF)** | 108 MB | ⚡ Fast (100-200ms) | Detection | ✅ Ready |
| **TOTAL DEPLOYMENT** | **~2.4 GB** | **~400-600ms** | Mixed | ✅ Ready |

---

## 📦 EMOTION DETECTION MODEL

### Quick Facts
- **Download:** `j-hartmann/emotion-english-distilroberta-base`
- **Size:** 629.11 MB
- **Type:** Text Classification
- **Base:** DistilRoBERTa (82M parameters)
- **Classes:** 7 emotions + color + emoji

### Emotions Detected
| Code | Label | Emoji | Color |
|------|-------|-------|-------|
| joy | Happy | 😊 | #22c55e (Green) |
| sadness | Sad | 😢 | #3b82f6 (Blue) |
| anger | Angry | 😠 | #ef4444 (Red) |
| neutral | Neutral | 😐 | #94a3b8 (Gray) |
| disgust | Disgust | 🤢 | #a855f7 (Purple) |
| fear | Fear | 😨 | #f97316 (Orange) |
| surprise | Surprised | 😲 | #eab308 (Yellow) |

### Setup & Test
```python
# Load model
from transformers import pipeline
emotion_pipeline = pipeline(
    "text-classification",
    model="j-hartmann/emotion-english-distilroberta-base",
    top_k=None,
    device=-1  # CPU
)

# Test
result = emotion_pipeline("I love this!")
# Output: Top emotion is 'joy' with 97.7% confidence
```

### API Endpoint
```
POST /emotion/detect
Content-Type: application/json

{
  "text": "I am feeling great today!"
}

Response:
{
  "code": "joy",
  "label": "Happy",
  "emoji": "😊",
  "color": "#22c55e",
  "score": 95
}
```

### Tokenizer Info
- **Type:** BPE (Byte-Pair Encoding)
- **Vocab Size:** 50,265 tokens
- **Max Length:** 512 tokens
- **Languages:** English (optimized)

---

## 📝 GRAMMAR CORRECTION MODEL

### Quick Facts
- **Download:** `vennify/t5-base-grammar-correction`
- **Size:** 1,702.84 MB (1.7 GB)
- **Type:** Sequence-to-Sequence (Text Generation)
- **Base:** Google T5-Base (220M parameters)
- **Trained On:** JFLEG dataset

### Key Features
✅ Minimal-edit corrections (faithful to original)  
✅ Handles ASL telegraphic input well  
✅ Adds capitalization and punctuation  
✅ No hallucinations (unlike some alternatives)  

### Examples
| Input | Output |
|-------|--------|
| "i hungry" | "I'm hungry." |
| "where bathroom" | "Where is the bathroom?" |
| "i dont know" | "I don't know." |
| "see you later" | "See you later." |

### Setup & Test
```python
# Load model
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tokenizer = AutoTokenizer.from_pretrained("vennify/t5-base-grammar-correction")
model = AutoModelForSeq2SeqLM.from_pretrained("vennify/t5-base-grammar-correction")

# Test
text = "i am very happy"
input_text = "grammar: " + text.lower()
inputs = tokenizer(input_text, return_tensors="pt", truncation=True, max_length=128)
output_ids = model.generate(**inputs, max_length=128, num_beams=4)
corrected = tokenizer.decode(output_ids[0], skip_special_tokens=True)
# Output: "I am very happy."
```

### API Endpoint
```
POST /grammar/correct
Content-Type: application/json

{
  "text": "i hungry"
}

Response:
{
  "original": "i hungry",
  "corrected": "I'm hungry."
}
```

### Tokenizer Info
- **Type:** SentencePiece (T5 Tokenizer)
- **Vocab Size:** 32,000 tokens
- **Max Input:** 512 tokens
- **Max Output:** 128 tokens
- **Prefix Required:** "grammar: " before input

---

## 👋 SIGN RECOGNITION MODELS

### Quick Facts
- **Total Size:** 107.65 MB
- **Type:** Hybrid (MediaPipe + Machine Learning)
- **Classes:** 20 ASL signs
- **Primary Model:** Random Forest (sklearn)
- **Backup Models:** PyTorch (k-fold validation)

### Files & Sizes
```
hand_landmarker.task        7.46 MB   (MediaPipe hand detection)
asl_rf_model.pkl           78.85 MB   (Random Forest classifier)
best_0.pt ~ best_4.pt      21.35 MB   (5 PyTorch models, k-fold)
```

### Recognized Signs (20 Classes)
```
1. bye                    11. i_understand
2. good_morning           12. nice_to_meet_you
3. hello                  13. no_sign (silence)
4. how_are_you            14. no_thankyou
5. i_am_busy              15. same_here
6. i_am_fine              16. see_you_later
7. i_cant_hear_you        17. take_care
8. i_dont_know            18. what_is_your_name
9. i_know                 19. whats_up
10. i_need_help           20. yes_please
```

### Detection Process
```
Input Image
    ↓
MediaPipe Hand Landmarks (21 points × 3 coords = 63 features)
    ↓
Feature Normalization (wrist-relative, scale-invariant)
    ↓
Random Forest Classification
    ↓
Output: Sign + Confidence Score
```

### API Endpoint
```
POST /sign/predict
Content-Type: application/json

{
  "image": "base64_encoded_image_here"
}

Response:
{
  "label": "hello",
  "confidence": 0.92,
  "proba": {
    "hello": 0.92,
    "goodbye": 0.05,
    ...
  }
}
```

### Hand Landmarks (21 per hand)
- **0:** Wrist
- **1-4:** Thumb (base to tip)
- **5-8:** Index finger
- **9-12:** Middle finger
- **13-16:** Ring finger
- **17-20:** Pinky finger

---

## 📊 DEPLOYMENT SIZES

### Individual Models
```
Emotion Model:           629 MB
Grammar Model:         1,703 MB
Sign Recognition:       108 MB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Models Cache:         2,440 MB (~2.4 GB)

Python Dependencies:    ~800 MB
Application Code:        ~50 MB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL DEPLOYMENT:     ~3.3 GB
```

### Runtime Memory
```
Emotion Model (loaded):     ~300 MB
Grammar Model (loaded):     ~400 MB
Sign Recognition (loaded):  ~100 MB
Other libraries:            ~200 MB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Peak Memory Usage:         ~1.0 GB
```

---

## ⚡ PERFORMANCE

### Inference Latency (CPU, single request)
```
Emotion Detection:        50-100 ms  ⚡
Sign Recognition:        100-200 ms ⚡
Grammar Correction:      200-400 ms 🐢
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Combined Pipeline:       400-600 ms 🟡
```

### Throughput
```
Concurrent Requests (CPU):
  - Emotion:  ~20 req/sec
  - Grammar:  ~5 req/sec
  - Signs:    ~10 req/sec (with video)
```

### System Requirements
```
Minimum:                    Recommended:
- CPU: 2 cores             - CPU: 4+ cores
- RAM: 4 GB                - RAM: 8 GB
- Storage: 20 GB           - Storage: 50 GB SSD
- No GPU needed            - GPU optional (torch CPU-only)
```

---

## 📋 VOCABULARY INFO

### Emotion Model (DistilRoBERTa)
```
Tokenizer Type:    BPE (Byte-Pair Encoding)
Vocabulary Size:   50,265 tokens
Max Sequence:      512 tokens (~2000 chars)
Languages:         English optimized
Special Tokens:    <unk>, <s>, </s>, <pad>, <mask>
```

### Grammar Model (T5)
```
Tokenizer Type:    SentencePiece
Vocabulary Size:   32,000 tokens
Max Input:         512 tokens
Max Output:        128 tokens
Languages:         Multilingual (C4 trained)
Special Tokens:    <unk>, <s>, </s>, <pad>
Prefix:            "grammar: " (required)
```

---

## 🔧 INSTALLATION

### Requirements
```bash
# Python 3.11+ recommended
python --version

# Install dependencies
pip install -r backend/requirements.txt

# Key packages:
# - transformers==5.17.0
# - mediapipe==0.10.14
# - scikit-learn==1.6.1
# - torch (CPU-only)
```

### Pre-download Models
```bash
# Optional: Pre-load models to avoid startup delay
python -c "
from transformers import pipeline
print('Loading emotion model...')
pipeline('text-classification', model='j-hartmann/emotion-english-distilroberta-base')

from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
print('Loading grammar model...')
AutoTokenizer.from_pretrained('vennify/t5-base-grammar-correction')
AutoModelForSeq2SeqLM.from_pretrained('vennify/t5-base-grammar-correction')

print('All models loaded!')
"
```

---

## 🐳 DOCKER DEPLOYMENT

### Build & Run
```bash
# Build
docker build -t signtalk-backend:latest backend/

# Run
docker run -p 8000:8000 -m 3g signtalk-backend:latest

# With volume for persistent cache
docker run -p 8000:8000 -m 3g \
  -v ~/.cache/huggingface:/root/.cache/huggingface \
  signtalk-backend:latest
```

### Docker Image Size
- Base (Python 3.11): ~200 MB
- Dependencies: ~600 MB
- Models (cache): ~2.4 GB
- **Total Image:** ~3.2 GB

---

## 🚀 API ENDPOINTS SUMMARY

```
POST /emotion/detect
├─ Input: {"text": "I love this!"}
└─ Output: emotion code, label, emoji, color, confidence score

POST /grammar/correct
├─ Input: {"text": "i hungry"}
└─ Output: original text, corrected text

POST /sign/predict
├─ Input: {"image": "base64_image"}
└─ Output: sign label, confidence, probabilities
```

---

## 🐛 TROUBLESHOOTING

### "Module not found" errors
```
Solution: pip install --upgrade transformers mediapipe
```

### Models loading slowly
```
Normal: ~30-60 seconds on first run
Cached: ~5-10 seconds on subsequent runs
If slow: Check network, disk speed
```

### Out of memory errors
```
Solution: Ensure only one model loaded at a time
Or: Upgrade system RAM to 8+ GB
```

### API timeout issues
```
Emotion: Should be fast (<200ms)
Grammar: Slower (~300-400ms), may need timeout extension
Signs: Depends on frame processing
```

---

## 📚 DOCUMENTATION LINKS

- **Emotion Model:** https://huggingface.co/j-hartmann/emotion-english-distilroberta-base
- **Grammar Model:** https://huggingface.co/vennify/t5-base-grammar-correction
- **MediaPipe:** https://mediapipe.dev/
- **Transformers Docs:** https://huggingface.co/docs/transformers/

---

## 📝 NOTES FOR DEPLOYMENT

✅ **Ready to Deploy**
- All models are production-ready
- No GPU required (CPU-only)
- Offline capable (no internet after download)
- Suitable for edge devices

⚠️ **Considerations**
- Grammar model is largest (~1.7 GB)
- Emotion model is most commonly used
- Sign recognition needs good lighting/hand visibility
- Consider load balancing for high concurrency

---

**Version:** 1.0.0  
**Last Updated:** 2026-11-14  
**Status:** ✅ Production Ready
