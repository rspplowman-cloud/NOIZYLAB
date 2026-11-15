#!/usr/bin/env python3
"""Step 6 (Blender): render a finished video of GABRIEL speaking a line.

    blender --background --python 06_render_video.py -- gabriel.glb work/say/evening.json evening.mp4
    python 06_render_video.py gabriel.glb work/say/evening.json evening.mp4        (with the `bpy` module)

    options, after the three paths:  --height 1080   --fps 24   --engine cycles|eevee   --samples 6   --keep-frames

Takes the bust (step 4) and a spoken line (step 5: sound plus mouth track). Blender animates the mouth
from the track, adds the same quiet life the live page has (a slow head drift, blinks, a breath),
renders every frame, and ffmpeg joins the frames to the sound.

Free software only: Blender (GPL) and ffmpeg. Nothing leaves the machine.
On M2Ultra use --engine eevee (the Metal GPU; much faster). Cycles runs anywhere, even with no GPU.
"""
import json
import math
import random
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import bpy

ZOOM = 1.035        # the same framing as the live page
MOUTH_GAIN = 0.6    # the same relaxed speaking mouth as the live page
TAIL = 0.6          # seconds of stillness after the last word


def emission_material(mat):
    """Show the picture exactly as it is: the portrait is already lit by its own lamps."""
    tree = mat.node_tree
    tex = next((n for n in tree.nodes if n.type == "TEX_IMAGE"), None)
    bsdf = next((n for n in tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    out = next(n for n in tree.nodes if n.type == "OUTPUT_MATERIAL")
    emit = tree.nodes.new("ShaderNodeEmission")
    if tex:
        tree.links.new(tex.outputs["Color"], emit.inputs["Color"])
    elif bsdf:
        emit.inputs["Color"].default_value = bsdf.inputs["Base Color"].default_value
    if tex and tex.image and tex.image.depth == 32:      # the figure's picture has a soft see-through edge
        clear = tree.nodes.new("ShaderNodeBsdfTransparent")
        mix = tree.nodes.new("ShaderNodeMixShader")
        tree.links.new(tex.outputs["Alpha"], mix.inputs["Fac"])
        tree.links.new(clear.outputs["BSDF"], mix.inputs[1])
        tree.links.new(emit.outputs["Emission"], mix.inputs[2])
        tree.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    else:
        tree.links.new(emit.outputs["Emission"], out.inputs["Surface"])


def wave(t, a, b, c):
    return math.sin(t * a) * 0.5 + math.sin(t * b + 1.3) * 0.3 + math.sin(t * c + 2.1) * 0.2


def render(glb: Path, line: Path, out: Path, height=1080, fps=24, engine="cycles", samples=6, keep=False) -> dict:
    data = json.loads(line.read_text())
    track, rate = data["track"]["shapes"], data["track"]["rate"]
    duration = float(data["duration"])
    audio = line.parent / data["audio"]
    if shutil.which("ffmpeg") is None:
        sys.exit("ffmpeg not found. Install it: brew install ffmpeg")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    figure = next((o for o in bpy.data.objects if o.type == "MESH" and o.data.shape_keys and "jawOpen" in o.data.shape_keys.key_blocks), None)
    if figure is None:
        sys.exit("The model has no face shapes. Build it with 04_build_bust.py.")
    for mat in bpy.data.materials:
        if mat.node_tree:
            emission_material(mat)
    keys = figure.data.shape_keys.key_blocks

    scene = bpy.context.scene
    cam_data = bpy.data.cameras.new("Camera")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 1.5 / ZOOM                    # the picture is 1.5 tall; a flat camera shows it undistorted
    cam = bpy.data.objects.new("Camera", cam_data)
    cam.location = (0, -4, 0)
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.world = bpy.data.worlds.new("Dark")
    scene.world.color = (0, 0, 0)
    scene.render.resolution_y = height - height % 2
    scene.render.resolution_x = round(height * 2 / 3) - round(height * 2 / 3) % 2
    scene.render.resolution_percentage = 100
    scene.render.fps = fps
    scene.view_settings.view_transform = "Standard"      # no film look: the colours stay the portrait's own
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    if engine == "eevee":
        ids = {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
        scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in ids else "BLENDER_EEVEE"
    else:
        scene.render.engine = "CYCLES"
        scene.cycles.samples = samples
        scene.cycles.use_denoising = False
        scene.cycles.max_bounces = 0
        scene.cycles.transparent_max_bounces = 4

    # ── Animate ─────────────────────────────────────────────
    frames = int(math.ceil((duration + TAIL) * fps))
    rng = random.Random(7)                               # the same blinks every time, so a re-render matches
    blinks, t = [], 1.1
    while t < duration + TAIL:
        blinks.append(t); t += 2.2 + rng.random() * 3.4
    n = len(track["jawOpen"])
    for f in range(frames):
        t = f / fps
        i = min(n - 1, int(t * rate))
        speaking = t < duration
        w = {
            "jawOpen": track["jawOpen"][i] * MOUTH_GAIN if speaking else 0.0,
            "mouthPucker": track["mouthPucker"][i] * MOUTH_GAIN if speaking else 0.0,
            "mouthSmileLeft": track["mouthSmileLeft"][i] * MOUTH_GAIN if speaking else 0.0,
            "mouthSmileRight": track["mouthSmileRight"][i] * MOUTH_GAIN if speaking else 0.0,
        }
        yaw, pitch = wave(t, 0.23, 0.41, 0.13) * 0.22, wave(t, 0.19, 0.31, 0.11) * 0.16
        w["headYawLeft"], w["headYawRight"] = max(0.0, yaw), max(0.0, -yaw)
        w["headPitchUp"], w["headPitchDown"] = max(0.0, pitch), max(0.0, -pitch)
        blink = max((math.sin((t - b) / 0.22 * math.pi) for b in blinks if 0 <= t - b < 0.22), default=0.0)
        w["eyeBlinkLeft"] = w["eyeBlinkRight"] = blink
        for name, value in w.items():
            if name in keys:
                keys[name].value = min(1.0, max(0.0, value))
                keys[name].keyframe_insert("value", frame=f + 1)
        figure.location.z = math.sin(t * 0.95) * 0.0022  # the breath
        figure.keyframe_insert("location", frame=f + 1)

    # ── Render and join ─────────────────────────────────────
    work = Path(tempfile.mkdtemp(prefix="gabriel-frames-"))
    scene.frame_start, scene.frame_end = 1, frames
    scene.render.filepath = str(work / "f_")
    bpy.ops.render.render(animation=True)
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-i", str(work / "f_%04d.png"), "-i", str(audio),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(out),
    ], check=True)
    if keep:
        print("frames kept in", work)
    else:
        shutil.rmtree(work, ignore_errors=True)
    return {"frames": frames, "fps": fps, "size": [scene.render.resolution_x, scene.render.resolution_y], "seconds": round(frames / fps, 2),
            "engine": scene.render.engine, "bytes": out.stat().st_size}


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    paths = [a for a in args if not a.startswith("--")]
    opts = {"height": 1080, "fps": 24, "engine": "cycles", "samples": 6}
    it = iter(args)
    paths = []
    keep = False
    for a in it:
        if a == "--keep-frames":
            keep = True
        elif a.startswith("--") and a[2:] in opts:
            v = next(it)
            opts[a[2:]] = v if a == "--engine" else int(v)
        else:
            paths.append(a)
    if len(paths) != 3:
        sys.exit(__doc__)
    info = render(Path(paths[0]), Path(paths[1]), Path(paths[2]), keep=keep, **opts)
    print("video:", json.dumps(info))
