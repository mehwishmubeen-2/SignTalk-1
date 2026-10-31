import numpy as np, torch, torch.nn as nn, torch.nn.functional as F
from pathlib import Path

def load_classes():
    """Load classes from classes.txt with flexible path resolution."""
    paths_to_try = [
        Path("dataset/classes.txt"),
        Path(__file__).parent / "app" / "SignRecognition" / "classes.txt",
        Path(__file__).parent / "SignRecognition" / "classes.txt",
    ]
    
    for path in paths_to_try:
        if path.exists():
            return path.read_text().strip().split("\n")
    
    # Fallback if no file found
    return ["bye", "hello", "how_are_you", "i_am_fine", "i_dont_know", "i_know", 
            "nice_to_meet_you", "no_sign", "see_you_later", "what_is_your_name", "whats_up"]

classes = load_classes()

USE_HAND_SHAPE = True                      # set False to compare against the old features
POSE_KEEP = [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24]   # nose, ears, shoulders, elbows, wrists, hips
COLS = [3 * i + k for i in POSE_KEEP for k in range(3)] + list(range(99, 225))
D_IN = 2 * (len(COLS) + (126 if USE_HAND_SHAPE else 0))

def hand_shape(x):                         # (B,T,225) -> (B,T,126): finger shape relative to wrist
    out = []
    for a in (99, 162):                    # left hand, right hand
        h = x[..., a:a + 63].reshape(*x.shape[:2], 21, 3)
        rel = h - h[..., :1, :]
        size = rel.norm(dim=-1).amax(-1)[..., None, None] + 1e-6
        out.append((rel / size).flatten(2))
    return torch.cat(out, -1)

def prep(x):                               # use this everywhere instead of with_vel
    parts = [x[..., COLS]] + ([hand_shape(x)] if USE_HAND_SHAPE else [])
    z = torch.cat(parts, -1)
    return torch.cat([z, torch.diff(z, dim=1, prepend=z[:, :1])], -1)

def augment(x):                            # raw (B,T,225), training batches only
    B, L, _ = x.shape
    th = (torch.rand(B, 1, 1, device=x.device) - 0.5) * 0.35           # rotation, about ±10°
    p = x.reshape(B, L, 75, 3)
    c, s = torch.cos(th), torch.sin(th)
    p = torch.stack([c * p[..., 0] - s * p[..., 1], s * p[..., 0] + c * p[..., 1], p[..., 2]], -1)
    x = p.reshape(B, L, 225)
    x = x * (0.9 + 0.2 * torch.rand(B, 1, 1, device=x.device))          # scale
    x = x + 0.01 * torch.randn_like(x) * (x != 0)                       # noise, not on missing hands
    n = np.random.randint(26, L + 1)                                    # time warp
    st = np.random.randint(0, L - n + 1)
    x = x[:, st:st + n].transpose(1, 2)
    return F.interpolate(x, size=L, mode="linear", align_corners=True).transpose(1, 2)

class SignNet(nn.Module):
    def __init__(self, d_in=D_IN, n_cls=len(classes)):
        super().__init__()
        self.lstm = nn.LSTM(d_in, 128, num_layers=2, batch_first=True,
                            bidirectional=True, dropout=0.3)
        self.head = nn.Sequential(nn.Dropout(0.4), nn.Linear(256, n_cls))

    def forward(self, x):
        return self.head(self.lstm(x)[0].mean(dim=1))