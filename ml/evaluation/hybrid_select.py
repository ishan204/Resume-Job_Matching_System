"""Choose and freeze the hybrid's scaling + weights using VALIDATION ONLY, and run the ablation.

    python -m ml.evaluation.hybrid_select [config]                 # validation: weights, ablation, freeze
    python -m ml.evaluation.hybrid_select [config] --test-ablation # AFTER freezing: report ablation on test
config defaults to "hybrid" (Phase 5); other configs (e.g. hybrid_parserfix) write prefixed files.

Selection never opens data/splits/test.csv. Rule (fixed in experiments/config/hybrid.json before any
result): the candidate weight set with the highest validation NDCG@10 wins; ties go to the first listed.

Writes:
  results/weight_comparison.csv           all candidate weight sets, validation metrics
  results/hybrid_ablation_validation.csv  A-E (initial weights restricted to the listed parts) + F (final)
  config/matching_weights.json            frozen weights, scaler bounds, alpha
  results/hybrid_ablation_test.csv        (--test-ablation only; thresholds still from validation)
"""
import json
import sys

import pandas as pd

from ml.config import DATA_SPLITS, EXPERIMENTS_DIR, RESULTS_DIR, ROOT
from ml.evaluation.experiment import build_semantic
from ml.evaluation.metrics import apply_thresholds, classification_metrics, fit_thresholds, ranking_metrics
from ml.models.hybrid import HybridMatcher, combine, fit_scaler

METRICS = ["mrr", "map", "ndcg@5", "ndcg@10", "p@1", "p@5"]


def evaluate(df: pd.DataFrame, scores, thresholds) -> dict:
    pred = df[["job_id", "resume_id", "label_id"]].assign(score=scores)
    ranking, _ = ranking_metrics(pred, "score")
    cls = classification_metrics(pred["label_id"], apply_thresholds(pred["score"], thresholds))
    return {**{m: ranking[m] for m in METRICS}, "accuracy": cls["accuracy"], "macro_f1": cls["macro_f1"]}


def configurations(cfg: dict, selected: str) -> dict[str, dict]:
    """Ablation stages: the initial weights restricted to the listed components (combine()
    renormalises them), plus F = the selected final weights."""
    initial = cfg["candidate_weights"][cfg["initial_weights"]]
    stages = {name: {c: initial[c] for c in parts} for name, parts in cfg["ablation"].items()}
    stages[f"F_final ({selected})"] = cfg["candidate_weights"][selected]
    return stages


def select(cfg: dict, features: pd.DataFrame, val: pd.DataFrame) -> tuple[str, dict, pd.DataFrame, pd.DataFrame]:
    """Pure function of validation features/labels -> (selected name, scaler, comparison, ablation)."""
    lo, hi = cfg["scaler_percentiles"]
    scaler = fit_scaler(features, lo, hi)
    rows = []
    for name, w in cfg["candidate_weights"].items():
        s = combine(features, w, scaler)
        rows.append({"configuration": name, **w, **evaluate(val, s, fit_thresholds(s, val["label_id"]))})
    comparison = pd.DataFrame(rows)
    metric = cfg["selection_metric"]
    selected = comparison.loc[comparison[metric].idxmax(), "configuration"]  # idxmax: first on ties

    ab = []
    for name, w in configurations(cfg, selected).items():
        s = combine(features, w, scaler)
        ab.append({"configuration": name, **evaluate(val, s, fit_thresholds(s, val["label_id"]))})
    return selected, scaler, comparison, pd.DataFrame(ab)


def _matcher(cfg: dict) -> HybridMatcher:
    sem = json.loads((EXPERIMENTS_DIR / f"{cfg['semantic_config']}.json").read_text())
    sem.pop("model", None)
    return HybridMatcher(build_semantic(None, sem), alpha=cfg["preferred_alpha"],
                         glued_cues=cfg.get("glued_cues", False))


def _prefix(config: str) -> str:
    """Phase 5 file names are kept for the original config; any other config gets its own files."""
    return "" if config == "hybrid" else f"{config}_"


def main(config: str = "hybrid"):
    cfg = json.loads((EXPERIMENTS_DIR / f"{config}.json").read_text())
    val = pd.read_csv(DATA_SPLITS / "validation.csv", keep_default_na=False)  # test is never loaded here
    matcher = _matcher(cfg)
    features = matcher.features(val["resume"], val["job_description"])
    matcher.semantic.save_cache()

    selected, scaler, comparison, ablation = select(cfg, features, val)
    comparison.round(6).to_csv(RESULTS_DIR / f"{_prefix(config)}weight_comparison.csv", index=False)
    ablation.round(6).to_csv(RESULTS_DIR / f"{_prefix(config)}hybrid_ablation_validation.csv", index=False)
    frozen = {"selected": selected, "weights": cfg["candidate_weights"][selected], "scaler": scaler,
              "preferred_alpha": cfg["preferred_alpha"], "selection_metric": cfg["selection_metric"],
              "selected_on": "validation", "candidates_evaluated": len(comparison),
              "validation_metrics": comparison.set_index("configuration").loc[selected, METRICS].round(6).to_dict()}
    (ROOT / cfg["weights_file"]).write_text(json.dumps(frozen, indent=2))
    with pd.option_context("display.width", 200, "display.max_columns", 30):
        print(comparison.drop(columns=list(cfg["candidate_weights"]["A_initial"])).round(4).to_string(index=False))
        print(f"\nSELECTED: {selected} (highest validation {cfg['selection_metric']}) -> {cfg['weights_file']}\n")
        print(ablation.round(4).to_string(index=False))


def test_ablation(config: str = "hybrid"):
    """Reporting only, after the weights are frozen: the same stages on test, with every stage's
    thresholds learned on validation. Nothing here feeds back into selection."""
    cfg = json.loads((EXPERIMENTS_DIR / f"{config}.json").read_text())
    frozen = json.loads((ROOT / cfg["weights_file"]).read_text())
    matcher = _matcher(cfg)
    splits = {s: pd.read_csv(DATA_SPLITS / f"{s}.csv", keep_default_na=False) for s in ("validation", "test")}
    feats = {s: matcher.features(d["resume"], d["job_description"]) for s, d in splits.items()}
    rows = []
    for name, w in configurations(cfg, frozen["selected"]).items():
        sv = combine(feats["validation"], w, frozen["scaler"])
        thresholds = fit_thresholds(sv, splits["validation"]["label_id"])
        rows.append({"configuration": name,
                     **evaluate(splits["test"], combine(feats["test"], w, frozen["scaler"]), thresholds)})
    out = pd.DataFrame(rows)
    out.round(6).to_csv(RESULTS_DIR / f"{_prefix(config)}hybrid_ablation_test.csv", index=False)
    print(out.round(4).to_string(index=False))


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    config = args[0] if args else "hybrid"
    test_ablation(config) if "--test-ablation" in sys.argv else main(config)
