import json, os, plistlib, sys, tempfile, unittest, datetime as dt
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import app_map, app_tags, video_sort

def make_app(root, name, cat=None, intents=False, bid=None):
    a = Path(root) / f"{name}.app" / "Contents"; (a / "Resources").mkdir(parents=True)
    info = {"CFBundleName": name, "CFBundleIdentifier": bid or f"com.x.{name}", "CFBundleShortVersionString": "1.0"}
    if cat: info["LSApplicationCategoryType"] = cat
    (a / "Info.plist").write_bytes(plistlib.dumps(info))
    if intents: (a / "Resources" / "Metadata.appintents").mkdir()
    return a.parent

class AppMap(unittest.TestCase):
    def test_apps_extensions_and_mcp_names_only(self):
        with tempfile.TemporaryDirectory() as t:
            make_app(f"{t}/A", "Logic Pro", "public.app-category.music", intents=True)
            make_app(f"{t}/A", "Claude", "public.app-category.productivity", bid="com.anthropic.claudefordesktop")
            make_app(f"{t}/A", "Mystery")
            e = Path(t, "ext", "anthropic.claude-code-2.0"); e.mkdir(parents=True)
            (e / "package.json").write_text(json.dumps({"publisher": "anthropic", "name": "claude-code", "version": "2.0", "description": "Claude Code with MCP"}))
            cfg = Path(t, "cfg.json"); cfg.write_text(json.dumps({"mcpServers": {"gabriel": {"env": {"KEY": "sk-secret"}}}}))
            rep = app_map.build([f"{t}/A"], {"VS Code": f"{t}/ext"}, {"Claude Desktop": str(cfg)})
            by = {a["name"]: a for a in rep["apps"]}
            self.assertEqual(by["Logic Pro"]["noizy_category"], "Music")
            self.assertTrue(by["Logic Pro"]["app_intents"])
            self.assertTrue(by["Claude"]["ai_related"])
            self.assertEqual(by["Mystery"]["noizy_category"], "Other")
            self.assertTrue(rep["extensions"][0]["mcp"])
            self.assertEqual(rep["mcp"]["Claude Desktop"], ["gabriel"])
            md = app_map.markdown(rep)
            self.assertNotIn("sk-secret", json.dumps(rep) + md)  # names only, never values
            self.assertIn("Logic Pro 1.0 — App Intents", md)

class AppTags(unittest.TestCase):
    def test_plan_adds_one_tag_skips_system_and_tagged(self):
        apps = [{"path": "/Applications/A.app", "noizy_category": "Music", "system": False},
                {"path": "/Applications/B.app", "noizy_category": "Video", "system": False},
                {"path": "/System/Applications/C.app", "noizy_category": "Utility", "system": True}]
        tags = {"/Applications/A.app": ["Red\n6"], "/Applications/B.app": ["NOIZY Video"]}
        todo = app_tags.plan(apps, read=lambda p: tags.get(p, []))
        self.assertEqual(todo, [("/Applications/A.app", ["Red\n6", "NOIZY Music"], "NOIZY Music")])

    def test_halt_fails_closed(self):
        self.assertTrue(app_tags.halted(None))
        self.assertTrue(app_tags.halted("http://127.0.0.1:1"))

class VideoSort(unittest.TestCase):
    def test_dates_plan_and_safe_apply(self):
        with tempfile.TemporaryDirectory() as t:
            src = Path(t, "in"); src.mkdir(); dest = Path(t, "Sorted")
            (src / "IMG_20240315_1200.mov").write_bytes(b"a")
            (src / "clip.mp4").write_bytes(b"b"); os.utime(src / "clip.mp4", (1700000000, 1700000000))
            (src / "notes.txt").write_text("x")
            rows = video_sort.plan(dest, [src], probes=())
            by = {Path(r["from"]).name: r for r in rows}
            self.assertEqual(set(by), {"IMG_20240315_1200.mov", "clip.mp4"})
            self.assertEqual(by["IMG_20240315_1200.mov"]["source"], "name")
            self.assertTrue(by["IMG_20240315_1200.mov"]["to"].endswith("2024/2024-03/IMG_20240315_1200.mov"))
            self.assertEqual(by["clip.mp4"]["source"], "guess")
            (dest / "2024" / "2024-03").mkdir(parents=True)
            (dest / "2024" / "2024-03" / "IMG_20240315_1200.mov").write_bytes(b"other")
            rows = video_sort.plan(dest, [src], probes=())
            self.assertTrue(any("(1).mov" in r["to"] for r in rows))  # never overwrites
            moved = video_sort.apply(rows, Path(t, "undo.csv"))
            self.assertEqual(len(moved), 2)
            self.assertEqual((dest / "2024" / "2024-03" / "IMG_20240315_1200.mov").read_bytes(), b"other")
            self.assertTrue((src / "notes.txt").exists())
            self.assertIn("put_back_at", Path(t, "undo.csv").read_text())

    def test_bad_clock_dates_are_ignored(self):
        self.assertIsNone(video_sort.parse_iso("1970-01-01T00:00:00Z"))
        self.assertEqual(video_sort.parse_iso("2023-07-04T10:00:00Z").year, 2023)

    def test_skip_volumes_respected(self):
        with tempfile.TemporaryDirectory() as t:
            Path(t, "a.mov").write_bytes(b"x")
            os.environ["NOIZY_SKIP_VOLUMES"] = t
            try: self.assertEqual(video_sort.plan(Path(t, "out"), [t], probes=()), [])
            finally: del os.environ["NOIZY_SKIP_VOLUMES"]

if __name__ == "__main__": unittest.main()
