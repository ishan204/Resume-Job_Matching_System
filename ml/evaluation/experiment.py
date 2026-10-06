"""Run one matching model through the frozen evaluation protocol.

    python -m ml.evaluation.experiment <config> [--validation-only]
    e.g. tfidf | semantic | semantic_truncate   (experiments/config/<config>.json)

Protocol (order matters):
  1. fit the model on TRAIN only (TF-IDF: vocabulary + IDF from train resumes and jobs)
  2. score VALIDATION; learn the two classification thresholds on validation labels
  3. freeze model + thresholds, then score TEST once
--validation-only stops after step 2 (used to choose between configurations without touching test).
Writes results/<config>_{validation,test}_predictions.csv and _metrics.json. TF-IDF also saves the
fitted model to artifacts/tfidf.joblib; the semantic model only caches embeddings in artifacts/cache/.
"""
import hashlib
import json
import sys

import pandas as pd

from ml.config import (DATA_SPLITS, DATASET_NAME, DATASET_REVISION, EXPERIMENTS_DIR, LABELS,
                       RESULTS_DIR, ROOT, SEED)
from ml.dataset.split import load_splits
from ml.evaluation.metrics import (apply_thresholds, classification_metrics, fit_thresholds,
                                   ranking_metrics, reference_baselines)
from ml.models.hybrid import COMPONENTS, HybridMatcher
from ml.models.semantic import SemanticMatcher
from ml.models.tfidf import TOKEN_PATTERN, TFIDFMatcher

ARTIFACTS = ROOT / "artifacts"
ID_COLUMNS = ["resume_id", "job_id", "resume_group", "label", "label_id"]


def build_tfidf(train: pd.DataFrame, params: dict) -> TFIDFMatcher:
    return TFIDFMatcher(**params).fit(pd.concat([train["resume"], train["job_description"]]))


def describe_tfidf(matcher: TFIDFMatcher) -> dict:
    return {**matcher.params, "ngram_range": list(matcher.params["ngram_range"]),
            "token_pattern": TOKEN_PATTERN, "vocabulary_size": len(matcher.vectorizer.vocabulary_),
            "fit_corpus": "unique train resumes + unique train job descriptions"}


SEMANTIC_ARGS = ("revision", "device", "batch_size", "long_text", "query_instruction", "max_seq_length")


def _semantic(model_name: str, params: dict) -> SemanticMatcher:
    kwargs = {k: params[k] for k in SEMANTIC_ARGS if k in params}
    cache = None
    if params.get("cache", True):  # embeddings depend only on text + these settings, never on labels
        ident = json.dumps({"model_name": model_name, **kwargs}, sort_keys=True)
        cache = ARTIFACTS / "cache" / f"semantic_{hashlib.sha1(ident.encode()).hexdigest()[:12]}.npz"
    return SemanticMatcher(model_name, cache_path=cache, **kwargs)


def build_semantic(train: pd.DataFrame, params: dict) -> SemanticMatcher:
    """Zero-shot: train data is not used. Falls back only if the primary model cannot be loaded."""
    import torch
    torch.manual_seed(params.get("seed", SEED))
    try:
        return _semantic(params["model_name"], params).fit()
    except OSError as e:
        print(f"WARNING: {params['model_name']} could not be loaded ({e}); "
              f"using fallback {params['fallback_model_name']}")
        return _semantic(params["fallback_model_name"], {**params, "revision": None}).fit()


def describe_semantic(m: SemanticMatcher) -> dict:
    import sentence_transformers
    import torch
    return {"model_name": m.model_name, "revision": m.revision, "device": m.device,
            "batch_size": m.batch_size, "max_seq_length": m.encoder.max_seq_length,
            "long_text": m.long_text, "query_instruction": m.query_instruction,
            "embedding_dim": int(m.encoder.get_embedding_dimension()),
            "normalized_embeddings": True, "fine_tuned": False,
            "cache_file": m.cache_path.name if m.cache_path else None,
            "encoding_stats": dict(m.stats),  # snapshot: the counters keep growing as later splits are encoded
            "versions": {"sentence_transformers": sentence_transformers.__version__,
                         "torch": torch.__version__}}


def build_hybrid(train: pd.DataFrame, params: dict) -> HybridMatcher:
    """Weights and scaling come from the frozen validation selection (ml/evaluation/hybrid_select.py)."""
    sem = json.loads((EXPERIMENTS_DIR / f"{params['semantic_config']}.json").read_text())
    sem.pop("model", None)
    frozen = json.loads((ROOT / params["weights_file"]).read_text())
    model = HybridMatcher(build_semantic(train, sem), weights=frozen["weights"], scaler=frozen["scaler"],
                          alpha=frozen["preferred_alpha"], glued_cues=params.get("glued_cues", False)).fit()
    model.selection = frozen
    return model


def describe_hybrid(m: HybridMatcher) -> dict:
    sel = m.selection
    return {"components": COMPONENTS, "weights": m.weights, "scaler": m.scaler, "preferred_alpha": m.alpha,
            "selected_config": sel["selected"], "selected_on": sel["selected_on"],
            "selection_metric": sel["selection_metric"], "taxonomy_skills": len(m.extractor.category),
            "glued_cues": m.glued_cues,
            "semantic": describe_semantic(m.semantic)}


MODELS = {"tfidf": (build_tfidf, describe_tfidf), "semantic": (build_semantic, describe_semantic),
          "hybrid": (build_hybrid, describe_hybrid)}


def run(name: str, splits: dict[str, pd.DataFrame], params: dict,
        eval_splits=("validation", "test")):
    """name = model key in MODELS. Thresholds always come from validation."""
    build, describe = MODELS[name]
    model = build(splits["train"], params)
    score_col = f"{name}_score"

    predictions, metrics, thresholds = {}, {}, None
    for split in eval_splits:  # validation first: thresholds are frozen before test is scored
        df = splits[split]
        pred = df[ID_COLUMNS].copy()
        if hasattr(model, "pair_features"):  # structured, label-free features go into the prediction file
            feats = model.pair_features(df["resume"], df["job_description"])
            pred[score_col] = feats.pop("score").to_numpy()
            pred = pd.concat([pred, feats.set_index(pred.index)], axis=1)
        else:
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


def main(config: str, validation_only: bool = False):
    params = json.loads((EXPERIMENTS_DIR / f"{config}.json").read_text())
    name = params.pop("model", config)
    split_summary = json.loads((DATA_SPLITS / "split_summary.json").read_text())
    eval_splits = ("validation",) if validation_only else ("validation", "test")
    model, predictions, metrics = run(name, load_splits(), params, eval_splits)

    ARTIFACTS.mkdir(exist_ok=True)
    if hasattr(model, "save"):
        model.save(ARTIFACTS / f"{name}.joblib")
    if hasattr(model, "save_cache"):
        model.save_cache()
    for split in predictions:
        metrics[split]["dataset"]["split_sha256"] = split_summary["splits"][split]["sha256"]
        if config != name:
            metrics[split]["config"] = config
        predictions[split].to_csv(RESULTS_DIR / f"{config}_{split}_predictions.csv", index=False)
        (RESULTS_DIR / f"{config}_{split}_metrics.json").write_text(json.dumps(metrics[split], indent=2))
        r, c = metrics[split]["ranking"], metrics[split]["classification"]
        print(f"{config} {split}: pairs={metrics[split]['pairs_scored']} jobs={r['jobs_total']} "
              f"eligible={r['jobs_eligible']} binary_eligible={r['jobs_binary_eligible']} | "
              f"MRR={r['mrr']:.4f} MAP={r['map']:.4f} NDCG@5={r['ndcg@5']:.4f} NDCG@10={r['ndcg@10']:.4f} "
              f"P@1={r['p@1']:.4f} P@5={r['p@5']:.4f} | Acc={c['accuracy']:.4f} F1={c['macro_f1']:.4f}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    main(args[0] if args else "tfidf", validation_only="--validation-only" in sys.argv)
