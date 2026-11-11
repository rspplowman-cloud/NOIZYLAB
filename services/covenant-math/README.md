# covenant-math: proving 75/25 with numbers

- `python3 covenant.py` prints the per-unit table (gross vs clean rule).
- `album_scenario()` compares traditional, indie 50/50 and NOIZY 75/25 on one album.
- `with_recovery()` runs 75/25 with transparent recovery (50/50 until repaid at cost, then 75/25 forever), year by year.
- Every number is an input. Replace the defaults with real invoices and statements.
- Tests: `python3 -m unittest discover -s test -v` (9 tests).
- Write-up: `docs/economics/75-25-SURVEY-AND-MODEL.md`.
