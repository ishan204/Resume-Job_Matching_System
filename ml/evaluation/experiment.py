"""Run one matching model through the frozen evaluation protocol.

    python -m ml.evaluation.experiment tfidf

Protocol (order matters):
  1. fit the model on TRAIN only (TF-IDF: vocabulary + IDF from train resumes and jobs)
  2. score VALIDATION; learn the two classification thresholds on validation labels
  3. freeze model + thresholds, then score TEST once
Writes results/<model>_{validation,test}_predictions.csv and _metrics.json,
and the fitted model to artifacts/<model>.joblib.
"""
import json
import sys

import pandas as pd

from ml.config import (DATA_SPLITS, DATASET_NAME, DATASET_REVISION, EXPERIMENTS_DIR, LABELS,
                       RESULTS_DIR, ROOT, SEED)
from ml.dataset.split import load_splits
from ml.evaluation.metrics import (apply_thresholds, classification_metrics, fit_thresholds,
                                   ranking_metrics, reference_baselines)
from ml.models.tfidf import TOKEN_PATTERN, TFIDFMatcher

ARTIFACTS = ROOT / "artifacts"
ID_COLUMNS = ["resume_id", "job_id", "resume_group", "label", "label_id"]


def build_tfidf(train: pd.DataFrame, params: dict) -> TFIDFMatcher:
    return TFIDFMatcher(**params).fit(pd.concat([train["resume"], train["job_description"]]))


def describe_tfidf(matcher: TFIDFMatcher) -> dict:
    return {**matcher.params, "ngram_range": list(matcher.params["ngram_range"]),
            "token_pattern": TOKEN_PATTERN, "vocabulary_size": len(matcher.vectorizer.vocabulary_),
            "fit_corpus": "unique train resumes + unique train job descriptions"}


MODELS = {"tfidf": (build_tfidf, describe_tfidf)}


def run(name: str, splits: dict[str, pd.DataFrame], params: dict):
    build, describe = MODELS[name]
    model = build(splits["train"], params)
    score_col = f"{name}_score"

    predictions, metrics, thresholds = {}, {}, None
    for split in ("validation", "test"):  # validation first: thresholds are frozen before test is scored
        df = splits[split]
        pred = df[ID_COLUMNS].copy()
        pred[score_col] = model.score_pairs(df["resume"], df["job_description"])
        if split == "validation":
            thresholds = fit_thresholds(pred[score_col], pred["label_id"])
        pred["predicted_label_id"] = apply_thresholds(pred[score_col], thresholds)
        pred["predicted_label"] = pred["predicted_label_id"].map(LABELS.__getitem__)

        ranking, _ = ranking_metrics(pred, score_col)
        metrics[split] = {
            "model": name,
            "split": split,
            "pairs_scored": len(pred),
            "model_params": describe(model),
            "ranking": ranking,
            "classification": {
                "thresholds": thresholds,
                "threshold_source": "validation (macro-F1 grid over score percentiles)",
                **classification_metrics(pred["label_id"], pred["predicted_label_id"]),
            },
            "chance_reference": reference_baselines(pred, SEED),
            "relevance": {"graded": "No Fit=0, Potential Fit=1, Good Fit=2 (NDCG)",
                          "binary": "relevant = label > 0 (MRR, MAP, P@k)"},
            "dataset": {"name": DATASET_NAME, "revision": DATASET_REVISION, "seed": SEED},
        }
        predictions[split] = pred
    return model, predictions, metrics


def main(name: str):
    params = json.loads((EXPERIMENTS_DIR / f"{name}.json").read_text())
    split_summary = json.loads((DATA_SPLITS / "split_summary.json").read_text())
    model, predictions, metrics = run(name, load_splits(), params)

    ARTIFACTS.mkdir(exist_ok=True)
    model.save(ARTIFACTS / f"{name}.joblib")
    for split in predictions:
        metrics[split]["dataset"]["split_sha256"] = split_summary["splits"][split]["sha256"]
        predictions[split].to_csv(RESULTS_DIR / f"{name}_{split}_predictions.csv", index=False)
        (RESULTS_DIR / f"{name}_{split}_metrics.json").write_text(json.dumps(metrics[split], indent=2))
        r, c = metrics[split]["ranking"], metrics[split]["classification"]
        print(f"{name} {split}: pairs={metrics[split]['pairs_scored']} jobs={r['jobs_total']} "
              f"eligible={r['jobs_eligible']} binary_eligible={r['jobs_binary_eligible']} | "
              f"MRR={r['mrr']:.4f} MAP={r['map']:.4f} NDCG@5={r['ndcg@5']:.4f} NDCG@10={r['ndcg@10']:.4f} "
              f"P@1={r['p@1']:.4f} P@5={r['p@5']:.4f} | Acc={c['accuracy']:.4f} F1={c['macro_f1']:.4f}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "tfidf")
