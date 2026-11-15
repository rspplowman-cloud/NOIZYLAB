#!/usr/bin/env python3
"""Step 4 (Blender): build GABRIEL's 3D bust from the portrait and export it for the browser.

Run either way, with no window and no clicking:

    blender --background --python 04_build_bust.py -- work/ work/gabriel.glb
    python 04_build_bust.py work/ work/gabriel.glb          (with the `bpy` module installed)

Reads from work/: depth.npy, mask.png, subject.png, background.jpg, landmarks.json.
Writes one .glb holding:
  Room      a flat picture of the study, behind him
  Gabriel   the figure as a relief mesh shaped by the depth map, with these face shapes
            (named after Apple's ARKit blendshapes so any standard face tracker or
            lip-sync tool can drive them):
              jawOpen  mouthPucker  mouthSmileLeft  mouthSmileRight
              eyeBlinkLeft  eyeBlinkRight  browInnerUp  browDownLeft  browDownRight
            and four head moves (ARKit sends head pose as a transform, so these names are ours):
              headYawLeft  headYawRight  headPitchUp  headPitchDown   (12 degrees at full strength)
  A dark mouth interior sits behind the lips so an open mouth is not see-through.

This is a relief, not a full head: it turns about 10 degrees each way and no more.
"Left" and "Right" are GABRIEL's own left and right, as ARKit defines them.
"""
import json
import sys
from pathlib import Path

import bpy
import numpy as np

STEP = 4            # one mesh point every STEP pixels
RELIEF = 0.42       # how far the nearest point stands out, as a share of the picture's width
GAP = 0.10          # space between the room and the back of the figure
HEIGHT = 1.5        # the picture is 1.0 wide and 1.5 tall in scene units (a 2:3 portrait)


def smoothstep(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0 + 1e-9), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def curve_y(points, xs):
    """Height of a landmark curve at each x (the curve is a few points, left to right)."""
    pts = points[np.argsort(points[:, 0])]
    return np.interp(xs, pts[:, 0], pts[:, 1])


def load_channel(path, channel=0):
    """One channel of a picture as rows top-down (0 red, 3 alpha)."""
    img = bpy.data.images.load(str(path))
    img.alpha_mode = "CHANNEL_PACKED"  # keep alpha as stored, not multiplied into the colour
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(h, w, 4)[::-1, :, channel]  # Blender stores rows bottom-up; flip to top-down


def new_shape(obj, name):
    key = obj.shape_key_add(name=name)
    key.value = 0.0  # Blender 5 starts a new shape fully on; the export would then show every shape at once
    return key


def material(name, image_path=None, colour=(0, 0, 0, 1)):
    mat = bpy.data.materials.new(name)
    if bpy.app.version < (5, 0, 0):
        mat.use_nodes = True  # always on from Blender 5
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 1.0
    if image_path is None:
        bsdf.inputs["Base Color"].default_value = colour
        return mat
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(str(image_path))
    mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if tex.image.depth == 32:  # the figure's picture has a see-through edge
        mat.node_tree.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
        if hasattr(mat, "blend_method"):
            mat.blend_method = "HASHED"
    return mat


def build(work: Path, out: Path) -> dict:
    depth = np.load(work / "depth.npy")
    H, W = depth.shape
    mask = load_channel(work / "mask.png") > 0.5                        # the figure plus a rim, for the mesh
    solid = load_channel(work / "subject.png", 3) > 0.5                 # the figure itself
    marks = json.loads((work / "landmarks.json").read_text())
    pts = np.array(marks["points"], dtype=np.float64) * [W, H]          # landmark positions in pixels
    grp = {k: pts[v] for k, v in marks["groups"].items()}

    bpy.ops.wm.read_factory_settings(use_empty=True)
    aspect = W / H

    # ── The grid ────────────────────────────────────────────
    gx = np.arange(0, W, STEP); gy = np.arange(0, H, STEP)
    if gx[-1] != W - 1: gx = np.append(gx, W - 1)
    if gy[-1] != H - 1: gy = np.append(gy, H - 1)
    nx, ny = len(gx), len(gy)
    PX, PY = np.meshgrid(gx.astype(np.float64), gy.astype(np.float64))  # pixel position of every grid point
    D = depth[np.ix_(gy, gx)].astype(np.float64)
    M = mask[np.ix_(gy, gx)]
    F = solid[np.ix_(gy, gx)]
    # The rim lies over the room, where depth falls away. Give each rim point the depth of the figure
    # next to it, so the soft see-through edge of the picture sits on a smooth surface, not a cliff.
    D = np.where(F, D, -1.0)
    for _ in range(8):
        todo = M & (D < 0)
        if not todo.any():
            break
        pad = np.pad(D, 1, constant_values=-1.0)
        near = np.max([pad[1 + dy:pad.shape[0] - 1 + dy, 1 + dx:pad.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)], axis=0)
        D = np.where(todo & (near >= 0), near, D)
    M = M & (D >= 0)
    d_back = float(np.percentile(D[M], 1))

    unit = HEIGHT * aspect / W                                           # scene units per pixel
    def to_scene(px, py, d):
        # Blender: X right, Z up, -Y toward the viewer. The exporter turns this into glTF's Y up, Z toward the viewer.
        return np.stack([(px - W / 2) * unit, -(GAP + (d - d_back) * RELIEF), (H / 2 - py) * unit], axis=-1)

    # ── Mouth: where the lips part ──────────────────────────
    left, right = sorted(grp["mouth_corners"][:, 0])
    mouth_w = right - left
    cx = (left + right) / 2
    inner = np.vstack([(grp["lips_inner_upper"] + grp["lips_inner_lower"]) / 2])
    lip_y = curve_y(inner, PX)                                           # the line between the lips, at every x
    chin_y = float(grp["chin"][0, 1])
    drop = chin_y - float(np.mean(inner[:, 1]))                          # lip line to chin, in pixels
    in_span = (PX > left + mouth_w * 0.06) & (PX < right - mouth_w * 0.06)
    lower = PY > lip_y                                                   # below the lip line

    # ── Faces: join neighbours unless they are outside the figure or across the lips ──
    # Steps in depth inside the figure (an arm in front of the chest) stay joined: a cut there would
    # show the room through a crack. Seen from the front the join is edge-on and cannot be seen.
    idx = np.arange(nx * ny).reshape(ny, nx)
    a, b, c, d = idx[:-1, :-1], idx[:-1, 1:], idx[1:, 1:], idx[1:, :-1]
    quadM = M[:-1, :-1] & M[:-1, 1:] & M[1:, 1:] & M[1:, :-1]
    quadL = np.stack([lower[:-1, :-1], lower[:-1, 1:], lower[1:, 1:], lower[1:, :-1]])
    quadS = in_span[:-1, :-1] & in_span[:-1, 1:] & in_span[1:, 1:] & in_span[1:, :-1]
    near_mouth = (np.abs(PY[:-1, :-1] - lip_y[:-1, :-1]) < STEP * 2)
    slit = quadS & near_mouth & (quadL.any(0) != quadL.all(0))            # quads that straddle the lip line
    keep = quadM & ~slit
    faces = np.stack([a[keep], d[keep], c[keep], b[keep]], axis=-1)       # counter-clockwise seen from the front

    used = np.zeros(nx * ny, dtype=bool); used[faces.ravel()] = True
    remap = -np.ones(nx * ny, dtype=np.int64); remap[used] = np.arange(used.sum())
    P = np.stack([PX.ravel()[used], PY.ravel()[used]], axis=-1)           # pixel position of each kept point
    Dv = D.ravel()[used]
    base = to_scene(P[:, 0], P[:, 1], Dv)
    faces = remap[faces]
    is_lower = lower.ravel()[used]
    n_fig = len(base)

    # ── A dark panel behind the lips ────────────────────────
    mouth_d = float(np.median(Dv[(np.abs(P[:, 0] - cx) < mouth_w / 2) & (np.abs(P[:, 1] - lip_y.ravel()[used]) < drop * 0.3)]))
    mx0, mx1 = left - mouth_w * 0.15, right + mouth_w * 0.15
    my0, my1 = float(inner[:, 1].min()) - drop * 0.25, float(inner[:, 1].max()) + drop * 0.9
    panel_px = np.array([[mx0, my0], [mx1, my0], [mx1, my1], [mx0, my1]])
    panel = to_scene(panel_px[:, 0], panel_px[:, 1], np.full(4, mouth_d - 0.05))
    verts = np.vstack([base, panel])
    all_faces = [tuple(int(i) for i in f) for f in faces] + [(n_fig, n_fig + 3, n_fig + 2, n_fig + 1)]

    mesh = bpy.data.meshes.new("Gabriel")
    mesh.from_pydata(verts.tolist(), [], all_faces)
    mesh.update()
    uv = mesh.uv_layers.new(name="UVMap")
    loop_vert = np.empty(len(mesh.loops), dtype=np.int64); mesh.loops.foreach_get("vertex_index", loop_vert)
    all_px = np.vstack([P, panel_px])
    uvs = np.stack([all_px[loop_vert, 0] / (W - 1), 1 - all_px[loop_vert, 1] / (H - 1)], axis=-1)
    uv.data.foreach_set("uv", uvs.ravel())
    mesh.materials.append(material("GabrielSkin", work / "subject.png"))
    mesh.materials.append(material("MouthDark", colour=(0.012, 0.006, 0.005, 1)))
    mats = np.zeros(len(mesh.polygons), dtype=np.int32); mats[-1] = 1
    mesh.polygons.foreach_set("material_index", mats)
    figure = bpy.data.objects.new("Gabriel", mesh)
    bpy.context.scene.collection.objects.link(figure)

    # ── Face shapes ─────────────────────────────────────────
    x, y = P[:, 0], P[:, 1]
    figure.shape_key_add(name="Basis")

    def shape(name, dx=0.0, dy=0.0, dz=0.0):
        """Add a shape that moves each figure point by (dx right, dy DOWN, dz toward the viewer), in pixels."""
        moved = base.copy()
        moved[:, 0] += np.broadcast_to(dx, x.shape) * unit
        moved[:, 2] -= np.broadcast_to(dy, x.shape) * unit
        moved[:, 1] -= np.broadcast_to(dz, x.shape) * unit
        new_shape(figure, name).data.foreach_set("co", np.vstack([moved, panel]).ravel())
        return float(np.abs(moved - base).max() / unit)

    report = {}
    # The jaw: everything below the lip line, strongest at the middle of the lower lip, fading out to the
    # sides and below the chin so the collar stays still. The beard rides with it.
    side = 1 - smoothstep(mouth_w * 0.55, mouth_w * 1.35, np.abs(x - cx))
    below = 1 - smoothstep(chin_y + drop * 0.15, chin_y + drop * 0.95, y)
    # Right at the lips the opening is lens-shaped: nothing at the corners, most in the middle.
    # Further down, the whole chin and beard move together.
    lip_line = lip_y.ravel()[used]
    lens = np.cos(np.clip(np.abs(x - cx) / (mouth_w * 0.5), 0, 1) * np.pi / 2) ** 1.5
    depth_below_lip = smoothstep(0, drop * 0.55, y - lip_line)
    jaw = np.where(is_lower, side * below * (lens + (1 - lens) * depth_below_lip), 0.0)
    # The upper lip lifts a little as the jaw drops.
    lift = np.where(~is_lower, lens * np.exp(-((y - lip_line) / (drop * 0.22)) ** 2) * (np.abs(x - cx) < mouth_w * 0.5), 0.0)
    report["jawOpen"] = shape("jawOpen", dy=jaw * drop * 0.30 - lift * drop * 0.05, dz=-jaw * drop * 0.08)

    mouth_y = float(np.mean(inner[:, 1]))
    around = np.exp(-(((x - cx) / (mouth_w * 0.75)) ** 2 + ((y - mouth_y) / (drop * 0.55)) ** 2))
    report["mouthPucker"] = shape("mouthPucker", dx=-(x - cx) * 0.30 * around, dz=around * drop * 0.10)

    corners = grp["mouth_corners"][np.argsort(grp["mouth_corners"][:, 0])]  # [image-left, image-right]
    for name, corner, sign in (("mouthSmileRight", corners[0], -1), ("mouthSmileLeft", corners[1], 1)):
        g = np.exp(-(((x - corner[0]) / (mouth_w * 0.42)) ** 2 + ((y - corner[1]) / (mouth_w * 0.42)) ** 2))
        report[name] = shape(name, dx=sign * g * mouth_w * 0.13, dy=-g * mouth_w * 0.11)

    # Blink: the skin above the eye stretches down until the upper lid meets the lower lid.
    for name, key in (("eyeBlinkRight", "eye_right"), ("eyeBlinkLeft", "eye_left")):
        up, low = grp[key + "_upper"], grp[key + "_lower"]
        x0, x1 = float(up[:, 0].min()), float(up[:, 0].max())
        uy, ly = curve_y(up, x), curve_y(low, x)
        gap = np.maximum(ly - uy, 0.0)
        lid = np.maximum(gap, 1.0) * 1.6                                    # how much skin above the eye takes part
        across = smoothstep(x0 - (x1 - x0) * 0.08, x0 + (x1 - x0) * 0.12, x) * (1 - smoothstep(x1 - (x1 - x0) * 0.12, x1 + (x1 - x0) * 0.08, x))
        stretch = np.where((y >= uy - lid) & (y < uy), (y - (uy - lid)) / lid * gap, 0.0)
        close = np.where((y >= uy) & (y <= ly), ly - y, 0.0)
        report[name] = shape(name, dy=(stretch + close) * across)

    brows = np.vstack([grp["brow_right"], grp["brow_left"]])
    brow_w = float(brows[:, 0].max() - brows[:, 0].min())
    inner_brow = np.array([grp["brow_right"][np.argmax(grp["brow_right"][:, 0])], grp["brow_left"][np.argmin(grp["brow_left"][:, 0])]]).mean(0)
    g = np.exp(-(((x - inner_brow[0]) / (brow_w * 0.30)) ** 2 + ((y - inner_brow[1]) / (brow_w * 0.16)) ** 2))
    report["browInnerUp"] = shape("browInnerUp", dy=-g * brow_w * 0.045)
    for name, key in (("browDownRight", "brow_right"), ("browDownLeft", "brow_left")):
        c0 = grp[key].mean(0)
        g = np.exp(-(((x - c0[0]) / (brow_w * 0.24)) ** 2 + ((y - c0[1]) / (brow_w * 0.13)) ** 2))
        report[name] = shape(name, dy=g * brow_w * 0.04)

    # Head turns: the head, hair and beard swing about a point inside the neck; shoulders stay still.
    # A shape can only slide points in straight lines, which matches a true turn closely up to about 12 degrees.
    oval = grp["face_oval"]
    face_cx, face_w = float(oval[:, 0].mean()), float(oval[:, 0].max() - oval[:, 0].min())
    head = (y < chin_y + drop * 0.6) & (np.abs(x - face_cx) < face_w * 1.9)
    hair_top = float(y[head & (np.abs(x - face_cx) < face_w * 0.5)].min())
    hair_half = float(np.abs(x[head & (y < chin_y)] - face_cx).max())
    ey = (hair_top + chin_y + drop * 0.5) / 2
    ry = (chin_y + drop * 0.5 - hair_top) / 2
    r = np.sqrt(((x - face_cx) / (hair_half * 1.02)) ** 2 + ((y - ey) / ry) ** 2)
    in_head = 1 - smoothstep(0.86, 1.14, r)
    face_z = float(np.median(-base[(np.abs(x - face_cx) < face_w * 0.3) & (np.abs(y - ey) < ry * 0.4), 1]))
    pivot = np.array([(face_cx - W / 2) * unit, (H / 2 - (chin_y + drop * 0.4)) * unit, face_z - 0.16])  # glTF axes: x, y up, z to viewer
    g = np.stack([base[:, 0], base[:, 2], -base[:, 1]], axis=-1) - pivot                                  # each point, seen from the pivot
    angle = np.radians(12.0)

    def turn(name, yaw=0.0, pitch=0.0):
        cy, sy, cp, sp = np.cos(yaw), np.sin(yaw), np.cos(pitch), np.sin(pitch)
        x1 = g[:, 0] * cy + g[:, 2] * sy
        z1 = -g[:, 0] * sy + g[:, 2] * cy
        y2 = g[:, 1] * cp - z1 * sp
        z2 = g[:, 1] * sp + z1 * cp
        delta = (np.stack([x1, y2, z2], axis=-1) - g) * in_head[:, None]
        moved = base + np.stack([delta[:, 0], -delta[:, 2], delta[:, 1]], axis=-1)
        new_shape(figure, name).data.foreach_set("co", np.vstack([moved, panel]).ravel())
        report[name] = float(np.abs(delta).max() / unit)

    turn("headYawLeft", yaw=angle)       # his left: toward the viewer's right
    turn("headYawRight", yaw=-angle)
    turn("headPitchUp", pitch=-angle * 0.7)
    turn("headPitchDown", pitch=angle * 0.7)

    # ── The room behind him ─────────────────────────────────
    grow = 1.0   # exactly the picture; the viewer zooms in a touch so its edge is never seen
    hw, hh = HEIGHT * aspect / 2 * grow, HEIGHT / 2 * grow
    room_mesh = bpy.data.meshes.new("Room")
    room_mesh.from_pydata([(-hw, 0, -hh), (hw, 0, -hh), (hw, 0, hh), (-hw, 0, hh)], [], [(0, 1, 2, 3)])
    ruv = room_mesh.uv_layers.new(name="UVMap")
    ruv.data.foreach_set("uv", np.array([0, 0, 1, 0, 1, 1, 0, 1], dtype=np.float32))
    room_mesh.materials.append(material("RoomPicture", work / "background.jpg"))
    room = bpy.data.objects.new("Room", room_mesh)
    bpy.context.scene.collection.objects.link(room)

    # Where his neck is, so the viewer can turn him about the right point.
    figure["pivot"] = [float(v) for v in pivot]
    figure["shapes"] = list(report)
    figure["made_by"] = "apps/avatar/pipeline/04_build_bust.py"

    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(out), export_format="GLB", export_yup=True,
        export_morph=True, export_morph_normal=False, export_morph_tangent=False, export_try_sparse_sk=True,
        export_normals=False, export_texcoords=True, export_materials="EXPORT", export_image_format="AUTO",
        export_extras=True, export_animations=False, export_cameras=False, export_lights=False,
    )
    return {"points": int(n_fig), "faces": int(len(faces)), "grid": [int(nx), int(ny)], "size_bytes": out.stat().st_size,
            "largest_move_px": {k: round(v, 1) for k, v in report.items()}}


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    if len(args) != 2:
        sys.exit(__doc__)
    info = build(Path(args[0]), Path(args[1]))
    print("bust:", json.dumps(info))
