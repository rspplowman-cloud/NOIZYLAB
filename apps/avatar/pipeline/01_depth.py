#!/usr/bin/env python3
"""Step 1: estimate how far each pixel of the portrait is from the camera.

    python 01_depth.py portrait.jpg work/

Writes work/depth.npy (float32, 0 = far, 1 = near) and work/depth.png (to look at).
Model: Depth Anything V2 Small (code and weights Apache-2.0). Runs on CPU, or on
Apple Silicon (MPS) when available. The image never leaves the machine; the model
is downloaded once from Hugging Face and then cached.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

MODEL = "depth-anything/Depth-Anything-V2-Small-hf"  # the Base/Large/Giant sizes are CC-BY-NC: do not swap them in


def main(portrait: str, work: str) -> None:
    import torch
    from transformers import pipeline

    out = Path(work)
    out.mkdir(parents=True, exist_ok=True)
    image = Image.open(portrait).convert("RGB")
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    depth = pipeline("depth-estimation", model=MODEL, device=device)(image)["predicted_depth"]
    d = np.asarray(depth.squeeze().cpu(), dtype=np.float32)
    d = (d - d.min()) / max(float(d.max() - d.min()), 1e-6)  # the model gives "nearness": bigger is closer
    d = np.asarray(Image.fromarray(d).resize(image.size, Image.BICUBIC), dtype=np.float32).clip(0, 1)
    np.save(out / "depth.npy", d)
    Image.fromarray((d * 255).astype(np.uint8)).save(out / "depth.png")
    print(f"depth: {d.shape[1]}x{d.shape[0]} on {device}, near share {float((d > 0.5).mean()):.2f} -> {out / 'depth.npy'}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
