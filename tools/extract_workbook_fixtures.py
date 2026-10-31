"""Read the two owner-supplied XLSX references without recalculation or mutation.

Only standard ZIP/XML support is needed, including for unsupported color rules.
Numeric XML lexemes are strings so binary float conversion cannot lose precision.
"""
from __future__ import annotations

import argparse
from decimal import Decimal, localcontext
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
METRICS = ["afr", "afr_delta", "count", "count_delta", "new", "retired", "failed"]
SOURCES = {
    "2025-Q3": "a3e2f0517dcceb59c61b37833bd2c7010c5c4631bc841dc891d4b8c97aa1ebf9",
    "2025-Q4": "8682be7fb2f85f27875739583c8aa934f4a290f903e2eca89c61bb154d4f3b65",
}


def column(number: int) -> str:
    result = ""
    while number:
        number, digit = divmod(number - 1, 26)
        result = chr(65 + digit) + result
    return result


def number_column(name: str) -> int:
    result = 0
    for letter in name:
        result = result * 26 + ord(letter) - 64
    return result


def range_cells(reference: str):
    """Expand the rectangular OOXML scope (including its blank cells)."""
    left, right = reference.split(":")
    a = re.fullmatch(r"([A-Z]+)([0-9]+)", left)
    b = re.fullmatch(r"([A-Z]+)([0-9]+)", right)
    if not a or not b:
        raise ValueError(f"Unsupported range: {reference}")
    for col in range(number_column(a[1]), number_column(b[1]) + 1):
        for row in range(int(a[2]), int(b[2]) + 1):
            yield f"{column(col)}{row}"


def percentile(values: list[Decimal], percent: Decimal) -> Decimal:
    """Excel inclusive percentile: rank=(n-1)*p with linear interpolation."""
    if not values or not 0 <= percent <= 100:
        raise ValueError("Percentile needs numeric observations and p in [0,100]")
    values = sorted(values)
    with localcontext() as context:
        context.prec = 50
        rank = (len(values) - 1) * percent / 100
        low = int(rank)
        high = min(low + 1, len(values) - 1)
        return values[low] + (values[high] - values[low]) * (rank - low)


def decimal_text(value: Decimal) -> str:
    text = format(value, "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def extract(path: Path, snapshot: str) -> dict:
    source_bytes = path.read_bytes()
    digest = hashlib.sha256(source_bytes).hexdigest()
    if digest != SOURCES[snapshot]:
        raise ValueError(f"Source hash mismatch for {snapshot}; refusing new baseline")
    with zipfile.ZipFile(path) as archive:
        sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        strings = ["".join(si.itertext()) for si in
                   ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("m:si", NS)]
    cells = {cell.attrib["r"]: cell for cell in sheet.findall(".//m:sheetData/m:row/m:c", NS)}

    def value(address):
        cell = cells.get(address)
        if cell is None:
            return None
        if cell.find("m:f", NS) is not None:
            raise ValueError(f"Unexpected formula at {address}")
        raw = cell.findtext("m:v", namespaces=NS)
        return strings[int(raw)] if cell.get("t") == "s" and raw is not None else raw

    end_row = int(re.search(r"[0-9]+$", sheet.find("m:dimension", NS).get("ref"))[0])
    models = []
    for index, start in enumerate(range(3, 136, 7)):
        model = value(f"{column(start)}3")
        if not model:
            raise ValueError(f"Missing model header in block {index}")
        rows = []
        blank_seen = False
        for row in range(6, end_row + 1):
            coordinates = [f"{column(start + metric)}{row}" for metric in range(7)]
            raw_values = [value(address) for address in coordinates]
            populated = all(raw is not None for raw in raw_values)
            if not populated and any(raw is not None for raw in raw_values):
                raise ValueError(f"Partial metric row: {model}/{row}")
            if populated and blank_seen:
                raise ValueError(f"Unexpected internal blank: {model}/{row}")
            blank_seen |= not populated
            for raw in raw_values:
                if raw is not None and not Decimal(raw).is_finite():
                    raise ValueError("Non-finite value")
            rows.append({
                "sheet_row": row, "display_ordinal": row - 5,
                "retained_ordinal": row - 5 if populated else None,
                "display_year": int(value(f"A{row}") or ((row - 6) // 4 + 1)),
                "display_quarter": int(value(f"B{row}")),
                "status": "retained" if populated else "trailing_blank_unknown",
                "calendar_quarter": None, "exposure_drive_days": None,
                "cells": list(map(list, zip(coordinates, raw_values))),
            })
        models.append({"model": model, "vendor": "Seagate" if index < 6 else
                       "Toshiba" if index < 12 else "WDC/HGST",
                       "header_cell": f"{column(start)}3", "rows": rows})

    rules = []
    for scope in sheet.findall("m:conditionalFormatting", NS):
        rule = scope.find("m:cfRule", NS)
        priority = int(rule.get("priority"))
        metric = METRICS[priority - 1]
        references = scope.get("sqref").split()
        addresses = [address for ref in references for address in range_cells(ref)]
        numbers = [Decimal(value(address)) for address in addresses if value(address) is not None]
        scale = rule.find("m:colorScale", NS)
        stops = []
        for threshold, color in zip(scale.findall("m:cfvo", NS), scale.findall("m:color", NS)):
            kind = threshold.get("type")
            raw = threshold.get("val")
            resolved = {"min": min(numbers), "max": max(numbers)}.get(kind)
            if kind == "num":
                resolved = Decimal(raw)
            elif kind == "percentile":
                resolved = percentile(numbers, Decimal(raw))
            if resolved is None:
                raise ValueError(f"Unsupported color threshold: {kind}")
            argb = color.get("rgb")
            normalize = metric == "new" and argb == "FFFFFFFFF"
            if not normalize and not re.fullmatch(r"[0-9A-F]{8}", argb):
                raise ValueError(f"Unexpected color: {argb}")
            stops.append({"type": kind, "raw_value": raw,
                          "resolved_value": decimal_text(resolved), "raw_argb": argb,
                          "css_color": "#FFFFFF" if normalize else f"#{argb[2:]}",
                          "normalization": "owner_screenshot_intended_white" if normalize else None})
        rules.append({"metric": metric, "priority": priority, "type": rule.get("type"),
                      "scope": references, "scope_kind": "all_19_models_all_display_rows",
                      "numeric_count": len(numbers), "blank_count": len(addresses) - len(numbers),
                      "minimum": decimal_text(min(numbers)),
                      "median": decimal_text(percentile(numbers, Decimal(50))),
                      "maximum": decimal_text(max(numbers)), "stops": stops})
    if len(rules) != 7:
        raise ValueError("Expected seven shared color rules")
    return {"schema": "workbook-reference-fixture/v1", "snapshot": snapshot,
            "purpose": "reference_only_not_production_matrix",
            "source": {"file": path.name, "sha256": digest, "bytes": len(source_bytes),
                       "url": "https://s3.us-east-2.amazonaws.com/backblaze-drive-stats.sixbuckssolutions.com/afr_data/"
                       + snapshot.lower().replace("-", "") + "_quarterly_afr.xlsx",
                       "label": f"Owner-supplied {snapshot} reference snapshot; cutoff inferred from label only"},
            "sheet": "Sheet1", "dimension": sheet.find("m:dimension", NS).get("ref"),
            "pane": sheet.find("m:sheetViews/m:sheetView/m:pane", NS).attrib,
            "metrics": METRICS, "numeric_encoding": "exact_OOXML_v_text",
            "calendar_mapping": "unknown", "exposure": "unknown",
            "trailing_blank_meaning": "unknown; does not establish threshold exit or future quarter",
            "models": models, "color_rules": rules}


def revisions(before: dict, after: dict) -> dict:
    changes = []
    for old_model, new_model in zip(before["models"], after["models"]):
        if old_model["model"] != new_model["model"]:
            raise ValueError("Model block order changed")
        for old, new in zip(old_model["rows"], new_model["rows"]):
            if old["status"] != "retained" or new["status"] != "retained":
                continue
            for metric, old_cell, new_cell in zip(METRICS, old["cells"], new["cells"]):
                if Decimal(old_cell[1]) != Decimal(new_cell[1]):
                    changes.append({"model": old_model["model"], "retained_ordinal": old["retained_ordinal"],
                                    "cell": old_cell[0], "metric": metric,
                                    "before": old_cell[1], "after": new_cell[1]})
    return {"schema": "workbook-reference-revisions/v1", "before": before["snapshot"],
            "after": after["snapshot"], "changes": changes}


STORIES = [
    ("warning", ["ST12000NM0007"], "Rising AFR, large retirement waves and shrinking population"),
    ("promising", ["WUH721816ALE6L4"], "Low AFR, growing population and quiet departure columns; short history"),
    ("mature_good", ["HUH721212ALN604"], "Long stable history before late deterioration; preserve age context"),
    ("early_spike", ["MG08ACA16TA", "MG08ACA16TE"], "Early high AFR settling near 1%; pre-eligibility contribution unknown"),
    ("favorable", ["ST16000NM001G"], "Owner-favorable comparison; historical shopping availability is not fleet data"),
    ("early_deterioration", ["ST24000NM002H"], "Rising AFR during growing deployment before retirement waves"),
    ("rollout_plateau", ["HUH721212ALE604"], "New falls after ordinal 5 while Count plateaus near 13000"),
    ("sustained_rollout", ["WUH722222ALE6L4"], "Continuing bulk additions and Count above 44000; motive unknown"),
]


def owner_stories(snapshots: list[dict]) -> dict:
    stories = []
    for key, models, reading in STORIES:
        evidence = []
        for snapshot in snapshots:
            for model in snapshot["models"]:
                if model["model"] in models:
                    rows = [row for row in model["rows"] if row["status"] == "retained"]
                    evidence.append({"snapshot": snapshot["snapshot"], "model": model["model"],
                                     "fixture": f"{snapshot['snapshot']}.json", "retained_rows": len(rows),
                                     "range": f"{rows[0]['cells'][0][0]}:{rows[-1]['cells'][-1][0]}"})
        stories.append({"id": key, "models": models, "owner_reading": reading, "evidence": evidence})
    return {"schema": "workbook-owner-stories/v1", "source": "docs/flagship-afr-plan.md#reference-evidence-and-acceptance-stories",
            "interpretation": "Owner reading cases, not purchase rankings, causal findings or current assessments",
            "stories": stories}


def build(source_dir: Path) -> dict[str, dict]:
    snapshots = [extract(source_dir / f"{snapshot}_quarterly_afr.xlsx", snapshot) for snapshot in SOURCES]
    result = {f"{snapshot['snapshot']}.json": snapshot for snapshot in snapshots}
    result["revisions.json"] = revisions(*snapshots)
    result["owner-stories.json"] = owner_stories(snapshots)
    return result


def serialized(value: dict) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=ROOT / "data/references")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "fixtures/workbooks")
    parser.add_argument("--check", action="store_true", help="Verify committed bytes without writing")
    args = parser.parse_args()
    outputs = build(args.source_dir)
    if not args.check:
        args.output_dir.mkdir(parents=True, exist_ok=True)
    for name, fixture in outputs.items():
        target = args.output_dir / name
        content = serialized(fixture)
        if args.check:
            if not target.exists() or target.read_bytes() != content.encode("utf-8"):
                raise SystemExit(f"Fixture differs: {target}")
        else:
            target.write_bytes(content.encode("utf-8"))
    print(f"{'Verified' if args.check else 'Extracted'} {len(outputs)} reference fixtures")


if __name__ == "__main__":
    main()
