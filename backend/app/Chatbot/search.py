"""
app/chatbot/search.py
Word lookup with exact + fuzzy matching, and autocomplete.
"""

import re
from difflib import get_close_matches


def _tokenise(text: str) -> list:
    text = text.lower().strip()
    fillers = r"\b(show me|how to sign|teach me|what is|sign for|how do i sign|sign)\b"
    text = re.sub(fillers, "", text)
    return [t for t in re.split(r"[^a-z']+", text) if t]


def _lookup_word(word: str, index: dict) -> dict:
    # Exact match
    if word in index:
        videos = index[word]
        return {"input_word": word, "matched_word": word,
                "match_type": "exact", "video": videos[0] if videos else None,
                "all_videos": videos}

    # Fuzzy match
    matches = get_close_matches(word, index.keys(), n=1, cutoff=0.7)
    if matches:
        matched = matches[0]
        videos  = index[matched]
        return {"input_word": word, "matched_word": matched,
                "match_type": "fuzzy", "video": videos[0] if videos else None,
                "all_videos": videos}

    # Not found
    return {"input_word": word, "matched_word": None,
            "match_type": "none", "video": None, "all_videos": []}


def search_sentence(query: str, index: dict, fuzzy: bool = True) -> list:
    tokens = _tokenise(query)
    if not tokens:
        return []

    results = []
    for token in tokens:
        result = _lookup_word(token, index)
        if not fuzzy and result["match_type"] == "fuzzy":
            result = {**result, "matched_word": None, "match_type": "none",
                      "video": None, "all_videos": []}
        results.append(result)
    return results


def get_suggestions(prefix: str, index: dict, limit: int = 10) -> list:
    prefix  = prefix.lower().strip()
    matches = sorted(w for w in index if w.startswith(prefix))
    return matches[:limit]