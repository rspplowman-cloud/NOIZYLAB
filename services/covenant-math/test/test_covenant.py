import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import covenant as c

class Covenant(unittest.TestCase):
    def test_digital_and_sync_work_at_75_percent_of_gross(self):
        for s in (c.DEFAULTS[0], c.DEFAULTS[1], c.DEFAULTS[4]):
            r = s.split("GROSS")
            self.assertEqual(r["artist_share_of_receipts"], 0.75)
            self.assertTrue(r["works"], s.name)

    def test_hard_goods_lose_money_at_75_percent_of_gross(self):
        for s in (c.DEFAULTS[2], c.DEFAULTS[3], c.DEFAULTS[5]):
            self.assertFalse(s.split("GROSS")["works"], s.name)

    def test_clean_rule_makes_every_stream_work(self):
        for s in c.DEFAULTS:
            self.assertTrue(s.split("CLEAN")["works"], s.name)

    def test_clean_never_pays_less_than_75_percent_of_margin(self):
        for s in c.DEFAULTS:
            r = s.split("CLEAN")
            self.assertAlmostEqual(r["artist"], 0.75 * max(0, s.label_receives - s.hard_costs), places=6)

    def test_traditional_pays_nothing_before_recoupment(self):
        self.assertEqual(c.traditional(100.0, recouped=False), 0.0)
        self.assertAlmostEqual(c.traditional(100.0, recouped=True), 13.5)

    def test_album_artist_earns_most_under_75_25(self):
        a = c.album_scenario()
        d = a["deals"]
        self.assertGreater(d["NOIZY 75/25 clean"]["artist"], d["indie 50/50 net profit"]["artist"])
        self.assertGreater(d["indie 50/50 net profit"]["artist"], d["traditional (18%, recoupable)"]["artist"])

    def test_recoupment_needs_many_more_units_at_75_25(self):
        s = c.DEFAULTS[0]
        self.assertEqual(c.recoup_units(100.0, c.Stream("x", 1.0, 0.0, 0.10), "GROSS"), 667)
        self.assertEqual(c.recoup_units(1.0, c.Stream("y", 1.0, 0.0, 0.30), "GROSS"), float("inf"))

if __name__ == "__main__": unittest.main()

class Recovery(unittest.TestCase):
    def test_recovery_then_75_25_forever(self):
        r = c.with_recovery([20000, 20000, 20000, 20000, 20000], investment=12000)
        self.assertTrue(r["repaid"])
        self.assertGreaterEqual(r["label_after_investment"], 0)
        last = r["years"][-1]
        self.assertAlmostEqual(last["artist"], 0.75 * 20000, places=2)  # back to 75/25 after repayment
        self.assertGreaterEqual(r["artist_total"], 0.5 * 100000)       # never below half

    def test_no_investment_means_75_25_from_day_one(self):
        r = c.with_recovery([10000], investment=0)
        self.assertEqual(r["years"][0]["artist"], 7500.0)
