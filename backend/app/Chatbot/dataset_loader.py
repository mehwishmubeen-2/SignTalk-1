"""
app/chatbot/dataset_loader.py
Loads WLASL data files from  backend/data/
"""

import json
import os
from pathlib import Path

# backend/app/chatbot/dataset_loader.py → go up 3 levels → backend/
_BACKEND_DIR = Path(__file__).parent.parent.parent
_DATA_DIR    = _BACKEND_DIR / "data"

_NSLT_FILES  = ["nslt_100.json", "nslt_300.json", "nslt_1000.json", "nslt_2000.json"]


def _load_class_list() -> list:
    path = _DATA_DIR / "wlasl_class_list.txt"
    with open(path, "r", encoding="utf-8") as f:
        result = []
        for line in f:
            line = line.strip()
            if not line:
                continue
            # Format is either "index\tword" or just "word"
            parts = line.split("\t", 1)
            result.append(parts[-1].lower())
        return result


def build_unified_index() -> dict:
    """
    Returns { word: [ {id, source}, ... ], ... }
    """
    class_list = _load_class_list()
    index: dict = {}

    for filename in _NSLT_FILES:
        path = _DATA_DIR / filename
        if not path.exists():
            print(f"  [chatbot] skip — {filename} not found")
            continue

        with open(path, "r", encoding="utf-8") as f:
            data: dict = json.load(f)

        split_name = filename.replace(".json", "")

        for video_id, meta in data.items():
            action = meta.get("action")
            if action is None:
                continue
            action_idx = action[0] if isinstance(action, list) else action
            if action_idx >= len(class_list):
                continue

            word  = class_list[action_idx]
            entry = {"id": video_id, "source": split_name}

            if word not in index:
                index[word] = []
            if not any(e["id"] == video_id for e in index[word]):
                index[word].append(entry)

    return index