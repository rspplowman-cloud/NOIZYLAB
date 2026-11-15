#!/usr/bin/env python3
"""Step 3: split the portrait into the figure and the room behind him.

    python 03_layers.py portrait.jpg work/

Reads work/depth.npy. Writes:
  work/subject.png     the figure, with a soft see-through edge where the room was
  work/mask.png        white where the figure is (a little wider than the figure, for the mesh)
  work/background.jpg  the room with the figure painted out, so nothing ghosts when he moves
Uses OpenCV (Apache-2.0) only. Nothing leaves the machine.
"""
import sys
from pathlib import Path

import cv2
import numpy as np


def main(portrait: str, work: str) -> None:
    out = Path(work)
    image = cv2.imread(portrait, cv2.IMREAD_COLOR)
    depth = np.load(out / "depth.npy")
    if depth.shape != image.shape[:2]:
        sys.exit("depth.npy does not match the portrait size. Run 01_depth.py again.")

    # Near things are the figure. Otsu picks the split between the two humps of the depth histogram.
    d8 = (depth * 255).astype(np.uint8)
    threshold, near = cv2.threshold(d8, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Keep the one big near shape that holds the middle of the picture; drop lamps and desk corners.
    count, labels, stats, _ = cv2.connectedComponentsWithStats(near, connectivity=8)
    if count < 2:
        sys.exit("No figure found in the depth map.")
    h, w = near.shape
    centre = labels[int(h * 0.45), w // 2]
    keep = centre if centre != 0 else 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    figure = np.where(labels == keep, 255, 0).astype(np.uint8)
    figure = cv2.morphologyEx(figure, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))

    # Soft edge for the texture; a wider hard mask for the mesh so the soft edge has geometry under it.
    alpha = cv2.GaussianBlur(figure, (0, 0), 1.6)
    cv2.imwrite(str(out / "subject.png"), np.dstack([image, alpha]))
    cv2.imwrite(str(out / "mask.png"), cv2.dilate(figure, np.ones((13, 13), np.uint8)))

    # The room: paint the figure out at quarter size (fast, and it is only seen in slivers), then soften.
    small = cv2.resize(image, (w // 4, h // 4), interpolation=cv2.INTER_AREA)
    hole = cv2.resize(cv2.dilate(figure, np.ones((25, 25), np.uint8)), (w // 4, h // 4), interpolation=cv2.INTER_NEAREST)
    filled = cv2.inpaint(small, hole, 6, cv2.INPAINT_TELEA)
    room = cv2.resize(filled, (w, h), interpolation=cv2.INTER_CUBIC)
    room = cv2.GaussianBlur(room, (0, 0), 3)
    keep_sharp = cv2.GaussianBlur(255 - cv2.dilate(figure, np.ones((41, 41), np.uint8)), (0, 0), 8)[..., None] / 255.0
    room = (image * keep_sharp + room * (1 - keep_sharp)).astype(np.uint8)
    cv2.imwrite(str(out / "background.jpg"), room, [cv2.IMWRITE_JPEG_QUALITY, 88])
    print(f"layers: figure covers {float((figure > 0).mean()):.2f} of the picture (depth split at {threshold / 255:.2f}) -> subject.png, mask.png, background.jpg")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
