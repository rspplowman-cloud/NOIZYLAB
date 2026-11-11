"""75/25 covenant math: does "the artist gets 75% of everything" work, stream by stream?

Every number is an input, never a hidden constant. The defaults are the 2025-2026 public ballparks in
docs/economics/75-25-SURVEY-AND-MODEL.md; change them and re-run.

Two definitions of "everything" are tested:
  GROSS  : 75% of every dollar the label receives. All costs, including third-party fees, come out of the 25%.
  CLEAN  : 75% of every dollar the label receives AFTER hard pass-through costs only (pressing, shipping,
           mechanicals, payment fees) paid to third parties at invoice cost, with the invoices shown to the artist.
           No breakage, packaging, free-goods, reserve, or "recoupable" deductions. Ever.
Standard library only.
"""
from dataclasses import dataclass, field

ARTIST = 0.75

@dataclass
class Stream:
    """One revenue stream, per unit (one stream, one LP, one sync licence...)."""
    name: str
    label_receives: float          # what reaches the label per unit, after the store/DSP keeps its share
    hard_costs: float = 0.0        # third-party pass-through per unit (pressing, shipping, mechanicals, card fees)
    overhead_pct: float = 0.10     # label's own running cost as a share of receipts (staff, A&R, consent ledger)

    def split(self, rule="GROSS"):
        base = self.label_receives if rule == "GROSS" else max(0.0, self.label_receives - self.hard_costs)
        artist = ARTIST * base
        label_gross = self.label_receives - artist
        label_net = label_gross - self.hard_costs - self.overhead_pct * self.label_receives
        return {"stream": self.name, "rule": rule, "artist": round(artist, 6),
                "artist_share_of_receipts": round(artist / self.label_receives, 4) if self.label_receives else 0,
                "label_keeps_after_costs": round(label_net, 6), "works": label_net >= 0}

def traditional(label_receives, royalty=0.18, deductions=0.25, recouped=False):
    """Old deal: a royalty rate on receipts minus deductions, paid only after recoupment."""
    paid = 0.0 if not recouped else label_receives * (1 - deductions) * royalty
    return round(paid, 6)

def recoup_units(investment, stream: Stream, rule="GROSS"):
    """How many units before the label's money back (advance, recording, marketing) is earned from its share."""
    per = stream.split(rule)["label_keeps_after_costs"]
    return float("inf") if per <= 0 else -(-investment // per)

# Defaults: 2025-2026 public ballparks (see the doc for sources). Per unit, in USD.
DEFAULTS = [
    # Streaming: ~$0.004 paid per stream; ~52% of DSP revenue goes to the master side, so ~$0.0030 reaches the label.
    Stream("stream (per play)", label_receives=0.0030, hard_costs=0.0, overhead_pct=0.10),
    # Download: $1.29 price; store keeps 30%.
    Stream("download (per track)", label_receives=0.90, hard_costs=0.12, overhead_pct=0.10),   # 0.12 = US mechanical, 9.1c+ ... rounded
    # Vinyl LP sold direct: $35 retail; card fee 3%; pressing $8 at 500 units; shipping/packing $2; mechanicals ~ $1.30.
    Stream("vinyl LP, sold direct", label_receives=35.00, hard_costs=8.00 + 2.00 + 1.30 + 1.05, overhead_pct=0.10),
    # Vinyl LP wholesale to a shop/distributor at $16.
    Stream("vinyl LP, wholesale", label_receives=16.00, hard_costs=8.00 + 1.30, overhead_pct=0.08),
    # Sync licence (master side of a TV placement).
    Stream("sync licence (master)", label_receives=5000.0, hard_costs=0.0, overhead_pct=0.10),
    # Merch T-shirt sold direct at $30; blank+print $11; card fee $0.90.
    Stream("merch T-shirt, direct", label_receives=30.00, hard_costs=11.90, overhead_pct=0.10),
]

def table(streams=DEFAULTS):
    rows = []
    for s in streams:
        for rule in ("GROSS", "CLEAN"):
            rows.append(s.split(rule))
    return rows

if __name__ == "__main__":
    for r in table():
        flag = "works" if r["works"] else "LOSES MONEY"
        print(f"{r['stream']:26} {r['rule']:5}  artist {r['artist']:>10.4f}  ({r['artist_share_of_receipts']:.0%} of receipts)"
              f"  label keeps {r['label_keeps_after_costs']:>10.4f}  {flag}")

def album_scenario(investment=30000.0, streams=5_000_000, lps=1000, syncs=1, overhead_pct=0.10):
    """One album, three deals, same sales. Who ends up with what?"""
    s, lp, sy = DEFAULTS[0], DEFAULTS[2], DEFAULTS[4]
    receipts = streams * s.label_receives + lps * lp.label_receives + syncs * sy.label_receives
    hard = lps * lp.hard_costs
    overhead = overhead_pct * receipts
    out = {}
    # Traditional major: 18% royalty on receipts less 25% deductions, recoupable against the investment.
    earned = (receipts * 0.75) * 0.18
    out["traditional (18%, recoupable)"] = {"artist": round(max(0.0, earned - investment), 2),
                                            "label": round(receipts - hard - overhead - investment - max(0.0, earned - investment), 2)}
    # Indie 50/50 of net profit (after costs and investment).
    net = receipts - hard - overhead - investment
    out["indie 50/50 net profit"] = {"artist": round(max(0.0, net) / 2, 2), "label": round(net - max(0.0, net) / 2, 2)}
    # NOIZY 75/25 CLEAN: hard costs off the top, then 75% to the artist; label funds investment from its 25%.
    base = receipts - hard
    out["NOIZY 75/25 clean"] = {"artist": round(0.75 * base, 2), "label": round(0.25 * base - overhead - investment, 2)}
    return {"receipts": round(receipts, 2), "deals": out}

def with_recovery(receipts_by_year, investment, hard_costs_by_year=None, overhead_pct=0.10, recovery_artist=0.50):
    """75/25 with TRANSPARENT RECOVERY.

    Year by year: hard costs come off the top (at invoice). Until the label's documented investment is paid back
    (at cost: no interest, no markup, no cross-collateral with other projects), the split is 50/50 and the label's
    half (after its overhead) repays the investment. The moment it is repaid, the split is 75/25 for good.
    The artist never gets less than 50% of the margin, and a live, public balance shows what is left to repay.
    """
    hard = hard_costs_by_year or [0.0] * len(receipts_by_year)
    left = investment; artist_total = label_total = 0.0; years = []
    for rec, hc in zip(receipts_by_year, hard):
        margin = max(0.0, rec - hc)
        overhead = overhead_pct * rec
        if left > 0:
            # How much margin at 50/50 does it take to repay what is left?
            per_dollar = (1 - recovery_artist) - overhead_pct * (rec / margin if margin else 0)
            need = left / per_dollar if per_dollar > 0 else float("inf")
            m1 = min(margin, need)
            a = recovery_artist * m1 + ARTIST * (margin - m1)
            label = margin - a - overhead
            repaid = min(left, (1 - recovery_artist) * m1 - overhead_pct * rec * (m1 / margin if margin else 0))
            left -= max(0.0, repaid)
        else:
            a = ARTIST * margin; label = margin - a - overhead
        artist_total += a; label_total += label
        years.append({"artist": round(a, 2), "label": round(label, 2), "left_to_repay": round(max(0.0, left), 2)})
    return {"artist_total": round(artist_total, 2), "label_total_before_investment": round(label_total, 2),
            "label_after_investment": round(label_total - investment, 2), "repaid": left <= 0.005, "years": years}
