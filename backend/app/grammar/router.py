# backend/app/grammar/router.py
"""
Turns raw fingerspelled/word-by-word Sign-to-Text output (telegraphic, e.g.
"I HUNGRY" or "WHERE BATHROOM") into a fluent, grammatically correct sentence
using a local seq2seq grammar-correction model — no API key needed, runs the
same way as app/emotion/router.py.

Note: pszemraj/grammar-synthesis-small was tried first but hallucinates badly
on short telegraphic input (e.g. "im ill" -> "I will call him immediately if
he is still alive."). vennify/t5-base-grammar-correction makes faithful,
minimal-edit corrections instead and was far more reliable in testing.
"""
import re

from fastapi import APIRouter
from pydantic import BaseModel
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

router = APIRouter(prefix="/grammar", tags=["grammar"])

_MODEL_NAME = "vennify/t5-base-grammar-correction"

print("[grammar] Loading grammar-correction model locally...")
grammar_tokenizer = AutoTokenizer.from_pretrained(_MODEL_NAME)
grammar_model = AutoModelForSeq2SeqLM.from_pretrained(_MODEL_NAME)
print("[grammar] ✅ Grammar-correction model ready")


class TextInput(BaseModel):
    text: str


def _postprocess(text: str) -> str:
    text = re.sub(r"\bim\b", "I'm", text, flags=re.IGNORECASE)
    text = text[:1].upper() + text[1:] if text else text
    if text and text[-1] not in ".!?":
        text += "."
    return text


@router.post("/correct")
def correct_grammar(body: TextInput):
    raw = body.text.strip()
    if not raw:
        return {"original": raw, "corrected": ""}

    # Fingerspelled text comes in ALL CAPS, which is out-of-distribution for a
    # model trained on normally-cased text. Lowercasing first keeps it
    # in-distribution; the model re-capitalizes correctly on its own.
    normalized = "grammar: " + raw.lower()

    inputs = grammar_tokenizer(normalized, return_tensors="pt", truncation=True, max_length=128)
    output_ids = grammar_model.generate(**inputs, max_length=128, num_beams=4)
    corrected = _postprocess(grammar_tokenizer.decode(output_ids[0], skip_special_tokens=True).strip())

    return {"original": raw, "corrected": corrected}
