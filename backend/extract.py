import cv2, numpy as np, mediapipe as mp
from pathlib import Path

T = 32
hol = mp.solutions.holistic.Holistic(model_complexity=1)

def pts(lm, n):
    return np.array([[p.x, p.y, p.z] for p in lm.landmark]) if lm else np.zeros((n, 3))

def frame_feat(r):
    pose, lh, rh = pts(r.pose_landmarks, 33), pts(r.left_hand_landmarks, 21), pts(r.right_hand_landmarks, 21)
    if r.pose_landmarks:
        c = (pose[11] + pose[12]) / 2
        s = np.linalg.norm(pose[11] - pose[12]) + 1e-6
        pose = (pose - c) / s
        if r.left_hand_landmarks:  lh = (lh - c) / s
        if r.right_hand_landmarks: rh = (rh - c) / s
    hand = r.left_hand_landmarks is not None or r.right_hand_landmarks is not None
    return np.concatenate([pose.ravel(), lh.ravel(), rh.ravel()]), hand

def video_to_seq(path):
    cap, feats, hands = cv2.VideoCapture(str(path)), [], []
    while True:
        ok, img = cap.read()
        if not ok: break
        f, h = frame_feat(hol.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
        feats.append(f); hands.append(h)
    feats, idx = np.array(feats), np.flatnonzero(hands)
    if len(idx) >= 2:
        feats = feats[idx[0]: idx[-1] + 1]
    src = np.linspace(0, len(feats) - 1, T)
    return np.stack([np.interp(src, np.arange(len(feats)), feats[:, j]) for j in range(225)], 1)

if __name__ == "__main__":
    root = Path("dataset")
    classes = sorted(p.name for p in (root / "train").iterdir())
    Path("dataset/classes.txt").write_text("\n".join(classes))
    for split in ["train", "val", "test"]:
        X, y = [], []
        for ci, cls in enumerate(classes):
            for v in sorted((root / split / cls).glob("*.mp4"), key=lambda p: int(p.stem)):
                X.append(video_to_seq(v)); y.append(ci)
            print(split, cls, "done")
        np.savez(f"dataset/{split}.npz", X=np.array(X, dtype=np.float32), y=np.array(y))
        print(split, np.array(X).shape)