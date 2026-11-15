#!/usr/bin/env python3
"""Step 2: find the face in the portrait: lips, eyes, brows, jaw.

    python 02_landmarks.py portrait.jpg work/

Writes work/landmarks.json: 478 points as fractions of the image (x right, y down),
plus the named groups the Blender step uses to build the mouth, blink and brow shapes.
Model: MediaPipe Face Landmarker (Apache-2.0). Runs on CPU. The image never leaves
the machine; the model file is downloaded once into work/.
"""
import json
import sys
import urllib.request
from pathlib import Path

MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"

# Index lists from MediaPipe's face mesh topology.
GROUPS = {
    "lips_inner_upper": [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
    "lips_inner_lower": [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308],
    "lips_outer_upper": [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
    "lips_outer_lower": [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291],
    "mouth_corners": [61, 291],
    "eye_right_upper": [33, 246, 161, 160, 159, 158, 157, 173, 133],   # the subject's right eye (image left)
    "eye_right_lower": [33, 7, 163, 144, 145, 153, 154, 155, 133],
    "eye_left_upper": [362, 398, 384, 385, 386, 387, 388, 466, 263],
    "eye_left_lower": [362, 382, 381, 380, 374, 373, 390, 249, 263],
    "brow_right": [70, 63, 105, 66, 107],
    "brow_left": [336, 296, 334, 293, 300],
    "face_oval": [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152,
                  148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
    "chin": [152],
    "nose_tip": [1],
}


def main(portrait: str, work: str) -> None:
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision

    out = Path(work)
    out.mkdir(parents=True, exist_ok=True)
    model = out / "face_landmarker.task"
    if not model.exists():
        urllib.request.urlretrieve(MODEL_URL, model)
    options = vision.FaceLandmarkerOptions(base_options=mp_python.BaseOptions(model_asset_path=str(model)), num_faces=1)
    with vision.FaceLandmarker.create_from_options(options) as detector:
        result = detector.detect(mp.Image.create_from_file(portrait))
    if not result.face_landmarks:
        sys.exit("No face found in the portrait.")
    points = [[round(p.x, 5), round(p.y, 5)] for p in result.face_landmarks[0]]
    (out / "landmarks.json").write_text(json.dumps({"points": points, "groups": GROUPS}))
    xs = [p[0] for p in points]; ys = [p[1] for p in points]
    print(f"landmarks: {len(points)} points, face box x {min(xs):.2f}-{max(xs):.2f}, y {min(ys):.2f}-{max(ys):.2f} -> {out / 'landmarks.json'}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
