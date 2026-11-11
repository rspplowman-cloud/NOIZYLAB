# How labels made money from artists, and how 75/25 makes the math work

**For:** Robert Stephen Plowman (RSP_001). **Written:** 2026-11-11.
**Proof:** every number in section 3 comes from `services/covenant-math/` (tested). Change an input, re-run, see the result.
**Rule being tested:** the 75/25 covenant. Creators keep 75¢ of every dollar.

---

## 1. The short answer

- **Digital, downloads and sync:** 75% of **every dollar the label receives** works. The label still makes a margin.
- **Vinyl, CDs and merch:** 75% of gross **loses money on every unit**. Pressing an LP costs about $8 before anyone earns.
  The fix: take only **hard, third-party costs at invoice** off the top (pressing, shipping, mechanicals, card fees), then 75/25.
- **Big upfront spending breaks 75/25.** A $30,000 album budget is never paid back from a 25% share at normal sales.
  The fix: **spend lean**, and allow a **transparent recovery**: 50/50 until the documented cost is repaid (no interest, no markup), then 75/25 forever.
- **Decision for RSP_001:** the covenant line "third-party fees come from the platform's 25%" (FISHMUSICINC README) cannot hold for physical goods. It needs the hard-cost rule above.

## 2. The history: how labels took the money

| Era | What the artist got | How the label kept the rest |
|---|---|---|
| **1900s–1950s (78s, singles)** | About **3–5%** royalty, often on 90% of sales; stars about 6% | **Breakage**: 10% off every sale, for brittle shellac records. Many artists got a flat session fee and nothing after. |
| **1960s (the LP)** | About **5–12%** (US), 8–15% (UK) | Breakage kept after records stopped breaking. **Recoupment**: no royalty until every advance and cost was paid back from the artist's share. |
| **1970s–1990s (LP, cassette, CD)** | About **10–15%** "points" | **Packaging** deduction (about 20–25% of price, larger for CDs), **free goods** (about 15% shipped royalty-free), **reserves** (35–50% held back for returns), **controlled composition** (artist-songwriters capped at 75% of the mechanical rate), recording, video and tour support all **recoupable**, and **cross-collateral** across albums. |
| **2000s (downloads, piracy)** | Same royalty, applied to cheaper digital units | Old deductions applied to digital (no breakage, still charged). **360 deals** arrive: the label also takes **10–30% of touring, merch and publishing**. |
| **2010s–2026 (streaming)** | Major label: about **18–25%** royalty; indie: often **50/50 of net profit**; self-distribution: **80–100%** of receipts minus a fee | The label owns the master for life (or 10–35 years). Recoupment against streaming royalties. Streaming is about **70%** of the **$31.7 billion** recorded-music market (2025). |

**The pattern in one line:** the percentage was always small, and the deductions and recoupment made it smaller.
Many artists who sold well were "unrecouped" for life: their records made money, and they never saw a royalty.

## 3. The math: 75/25, stream by stream

Per unit, in US dollars. "Label receives" is what reaches the label after the store or streaming service keeps its share.
Two rules tested: **Gross** (75% of everything received) and **Clean** (hard third-party costs at invoice off the top, then 75/25).

| Stream | Label receives | Gross: label after costs | Clean: artist gets | Clean: label after costs |
|---|---|---|---|---|
| Stream (one play) | $0.0030 | ✅ +$0.0004 | $0.0022 (75%) | ✅ +$0.0004 |
| Download (one track) | $0.90 | ✅ +$0.015 | $0.585 | ✅ +$0.105 |
| Vinyl LP, sold direct ($35) | $35.00 | ❌ −$7.10 | $16.99 | ✅ +$2.16 |
| Vinyl LP, wholesale ($16) | $16.00 | ❌ −$6.58 | $5.03 | ✅ +$0.40 |
| Sync licence (master side) | $5,000 | ✅ +$750 | $3,750 (75%) | ✅ +$750 |
| T-shirt, sold direct ($30) | $30.00 | ❌ −$7.40 | $13.58 | ✅ +$1.53 |

Assumptions (all inputs in `covenant.py`): about $0.004 paid per stream with about half reaching the master side;
store keeps 30% of a $1.29 download; LP pressing $8 at 500 units, shipping and packing $2, mechanicals about $1.30, card fees 3%;
label overhead 8–10% of receipts.

## 4. One album, three deals, same sales

5 million streams, 1,000 LPs, one sync, $30,000 spent by the label (recording plus marketing):

| Deal | Artist gets | Label gets |
|---|---|---|
| Traditional (18%, recoupable) | **$0** (still unrecouped) | $7,150 |
| Indie, 50/50 of net profit | $3,575 | $3,575 |
| NOIZY 75/25 (clean) | **$31,988** | **−$24,838** (label loses) |

**75/25 makes the artist far better off, and breaks the label, if the label spends like an old label.**

## 5. The model that works

1. **Hard costs off the top, at invoice, shown to the artist.** Pressing, shipping, mechanicals, payment fees. Nothing else.
2. **Never** breakage, packaging, free goods, reserves, "recoupable" video or tour support, or cross-collateral.
3. **75/25 of everything that is left**, from the first dollar.
4. **Spend lean.** The artist owns the masters. NOIZY's tools (consent ledger, automated distribution, LUCY and GABRIEL) keep overhead near 10%.
5. **If the label invests, transparent recovery:** 50/50 of the margin only until the documented investment is repaid,
   **at cost, no interest, no cross-collateral**, with a live public balance. Then 75/25 forever. The artist never gets less than 50%.
6. **Rule of thumb, from the model:** the label's upfront spend should stay under about **a sixth of the album's expected 10-year margin**.

Ten-year test (5M streams in year one, fading 40% a year; 1,300 LPs; one $5,000 sync):

| Label investment | Artist over 10 years | Label over 10 years | Repaid? |
|---|---|---|---|
| $8,000 | **$48,342** | **+$6,599** | ✅ in year 1 |
| $30,000 | $35,859 | −$2,918 | ❌ never |

**The artist earns the most when the label spends the least.** That is the covenant working as designed.

## 6. Open decisions for RSP_001

1. Adopt the **clean** rule (hard costs off the top) for physical and merch? It changes the FISHMUSICINC README line.
2. Adopt **transparent recovery** (50/50 until repaid at cost, then 75/25)? Or no label investment at all?
3. Investment cap per album (the model suggests about a sixth of expected 10-year margin).
4. Publishing (songwriting) is a separate pot and is not in this model. Apply 75/25 there too?

## 7. Return to Analog (Montreal): a reissue label to know

- **Who:** Montreal reissue label founded in 2014 (some sources say 2015) by **Pierre Markotanyos**, who also runs the record shop **Aux 33 Tours** on Mont-Royal Avenue.
- **What:** brings back significant Québec, Canadian and international records, "famous and forgotten", mostly 1960s–70s, mostly on vinyl.
- **Size:** about **150 to nearly 200** titles (sources differ by date), built through **licensing deals**.
- **Examples found:** Offenbach *Tabarnac* (2-LP, RTA-001; remastered clear vinyl 2024); Octobre (Québec prog rock); Boule de Son *Just'en Passant* (1975);
  Sonny Greenwich *Sun Song*; Sadik Hakim *London Suite*; Le Quatuor de Jazz Libre du Québec (1967 free jazz); Lemon Fog (psych);
  Maneige; Les Jaguars; Men I Trust; Steve Hill; Genetic Control; live Miles Davis and Thelonious Monk; Horace Silver.
- **Why it matters to NOIZY:** a licensing-based reissue label is the natural partner for the **FISHMUSICINC catalogue** and THE-OLD-GUARD idea.
  A 75/25 reissue deal on licensed masters (no recording cost, only pressing) fits the **clean** rule well.
- **Not checked:** their artist terms. Ask before any deal.

## Sources

- History: [Hypebot: A Brief History of Record Deals](https://www.hypebot.com/decoded-record-deals-through-history-2/), [Recording contract (Wikipedia)](https://en.wikipedia.org/wiki/Recording_contract),
  [Ken Abdo: the American exclusive artist recording agreement (PDF)](https://lommen.com/wp-content/uploads/2016/03/Conceptual-Overview-of-the-American-Exclusive-Artist-Recording-Agreement-Ken-Abdo.pdf),
  [Medium: music business infrastructure](https://shelrochaleal.medium.com/the-democratization-of-the-music-industry-9e3e38b1bb1d), [Digital Music News: the 360 deal](https://www.digitalmusicnews.com/2013/07/02/threesixty/).
- Today: [IFPI Global Music Report 2026](https://www.ifpi.org/global-music-report-2026-global-recorded-music-revenues-grow-6-4-as-record-companies-drive-innovation/),
  [MBW: $31.7B in 2025](https://www.musicbusinessworldwide.com/global-recorded-music-revenues-hit-31-7bn-in-2025-up-6-4-yoy-users-of-paid-music-subscriptions-reach-837m),
  [Eric Alper: how streaming pays in 2026](https://www.thatericalper.com/2026/03/27/how-streaming-actually-pays-artists-in-2026-its-confusing/),
  [MBW: Phonorecords V proposals](https://www.musicbusinessworldwide.com/phono-v-streaming-rate-proposals-filed-with-us-copyright-royalty-board-as-dima-points-to-30-growth-in-publishing-revenues-since-2022/).
- Return to Analog: [Discogs](https://www.discogs.com/label/827914-Return-To-Analog), [MusicBrainz](https://musicbrainz.org/label/e02a7c83-029f-4405-87a2-eb6b0ea8af09),
  [label site](https://returntoanalogrecords.com/pages/about-us), [Montreal Rocks](https://montrealrocks.ca/the-best-record-stores-in-and-around-montreal/),
  [Godberd](https://godberd.com/m/articles/view/RETURN-TO-ANALOG), [Chisto interview](https://chisto.com/return-to-analogs-pierre-markotanyos/),
  [Dusty Groove](https://www.dustygroove.com/label/160179), [Offenbach Tabarnac on Discogs](https://www.discogs.com/release/6869394-Offenbach-Tabarnac).
- Caveat: most per-unit figures are public ballparks from secondary sources. They are inputs, not facts: replace them with NOIZY's real invoices and statements.

`killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai`
