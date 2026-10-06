"""Scan generated result files for personal or raw-text content (Phase 6).

    python -m ml.evaluation.privacy_check   -> results/privacy_check.json, exits non-zero on findings

Checks every CSV / JSON under results/ and config/ for: e-mail addresses, phone numbers, URLs,
columns that would hold raw text or protected attributes, and long free-text cells (a crude
detector for copied resume/job text). Images are listed for manual review.
"""
import json
import re

import pandas as pd

from ml.config import CONFIG_DIR, RESULTS_DIR, ROOT

EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE = re.compile(r"(?<!\d)(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?!\d)")
URL = re.compile(r"https?://|www\.", re.I)
FORBIDDEN_COLUMNS = {"resume", "resume_text", "job_description", "job_description_text", "name", "email", "phone",
                     "address", "gender", "age", "race", "religion", "nationality", "marital_status", "photo"}
MAX_CELL_CHARS = 120
ALLOWED_URL_FILES = {"repeated_grouped_meta.json", "final_model_comparison.json"}  # dataset link in metadata


def scan_text(name: str, text: str) -> list[str]:
    found = []
    if EMAIL.search(text):
        found.append(f"{name}: e-mail address")
    if PHONE.search(text):
        found.append(f"{name}: phone-number pattern")
    if URL.search(text) and name not in ALLOWED_URL_FILES:
        found.append(f"{name}: URL")
    return found


def scan_csv(path) -> list[str]:
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    found = [f"{path.name}: forbidden column {c!r}" for c in df.columns if c.lower() in FORBIDDEN_COLUMNS]
    long = df.apply(lambda col: col.str.len().max() if len(col) else 0).max() if len(df) else 0
    if long > MAX_CELL_CHARS:
        found.append(f"{path.name}: text cell of {long} characters")
    return found + scan_text(path.name, path.read_text(encoding="utf-8"))


def main():
    files = sorted(p for d in (RESULTS_DIR, CONFIG_DIR) for p in d.rglob("*") if p.suffix in (".csv", ".json"))
    findings = []
    for p in files:
        if p.name == "skills.json":  # the taxonomy is project-authored vocabulary, not data
            continue
        findings += scan_csv(p) if p.suffix == ".csv" else scan_text(p.name, p.read_text(encoding="utf-8"))
    images = sorted(str(p.relative_to(ROOT)) for p in RESULTS_DIR.rglob("*.png"))
    report = {"files_scanned": len(files), "findings": findings, "images_for_manual_review": images,
              "passed": not findings}
    (RESULTS_DIR / "privacy_check.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    if findings:
        raise SystemExit("PRIVACY CHECK: FAIL")
    print("PRIVACY CHECK: PASS")


if __name__ == "__main__":
    main()
