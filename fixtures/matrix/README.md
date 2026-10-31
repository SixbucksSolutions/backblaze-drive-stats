# Synthetic production-contract fixtures

All figures in this directory are invented aggregate test values. Model names
identify exact real-world suffix variants only to test identity separation; the
values make **no claims about observed Backblaze performance**. These artifacts
are separate from the measured legacy workbook extractions in `../workbooks`.

- `synthetic-earlier.json`: 2024 Q4 cutoff, complete supplied history beginning
  2023 Q4. First eligibility is exactly 2,000 drives in 2024 Q1; 2024 Q2 falls
  below threshold; 2024 Q3 reenters at relative quarter 3 with its original anchor.
- `synthetic-later.json`: 2025 Q3 cutoff and predecessor link to the earlier
  snapshot. Missing 2025 Q1 and incomplete 2025 Q2 remain distinct from future
  cells. Reentry shows known Count/New/Failed and quarterly AFR while cumulative
  AFR/Delta remain unavailable. Later coverage uncertainty revises old inferred
  retirement counts to unavailable, preserving the earlier artifact.
- `synthetic-correction.json`: a separate generation at the same 2024 Q4 cutoff,
  with revised synthetic input/manifest identities. Earlier 2024 Q1 inferred
  Retired changes from 6 to 4 for `ST12000NM0007` and 5 to 3 for its suffix variant;
  the predecessor path remains unchanged. This is a source-correction example.

Every model has 24 calendar-aligned cells, retaining snapshot-ended distance to
the guides after quarters 20 and 24. The first model's first eligible quarter has
zero current failures but a nonzero cumulative AFR from pre-eligibility exposure
and failures. Deltas use the previous eligible row and record elapsed calendar
quarters; sub-threshold exposure still contributes to subsequent cumulative AFR.

`build_synthetic.py` deterministically regenerates the three files. The public
contract validator checks structure, finite arithmetic, coverage metadata,
thresholds, offsets, baselines, retirement status and shared color domains.
Tests also cover empty/tied/constant/zero-only color domains and exact encoded
sRGB interpolation. The validator cannot prove the underlying daily observations,
source hashes, anchor discovery or last-seen identity computations: those require
the separately gated generator and retained private source evidence. No daily
identity records, historical downloads or production exporter are included here.

Run from the repository root:

```powershell
.\.venv\Scripts\python.exe fixtures/matrix/build_synthetic.py
.\.venv\Scripts\python.exe -m unittest tests.test_matrix_contract
.\.venv\Scripts\python.exe tools/validate_matrix_contract.py fixtures/matrix/synthetic-earlier.json fixtures/matrix/synthetic-later.json fixtures/matrix/synthetic-correction.json
```
