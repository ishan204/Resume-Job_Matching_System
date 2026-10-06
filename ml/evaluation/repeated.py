"""Repeated grouped evaluation: does the ranking of the three methods hold across splits?

    python -m ml.evaluation.repeated          (settings: experiments/config/repeated.json)

Splits. All cleaned pairs are assigned once to 20 folds with StratifiedGroupKFold (groups =
resume_group, stratified by label, fixed seed). Repetition r uses folds 3r..3r+2 as TEST, the next
3 folds as VALIDATION and the other 14 as TRAIN (70/15/15). Test sets are disjoint across
repetitions, so every resume is tested at most once. No resume group crosses train/validation/test
inside a repetition (checked with the Phase 2 leakage checker). The original Phase 2 split is not
one of these repetitions.

Methodology is re-run per repetition, not reused from the original split:
  TF-IDF   vocabulary + IDF fitted on that repetition's TRAIN
  BGE      pretrained, zero-shot (nothing to fit)
  Hybrid   scaling bounds and the choice among the 6 pre-declared weight sets from that
           repetition's VALIDATION (same rule as Phase 5: highest NDCG@10)
  all      classification thresholds from that repetition's VALIDATION; TEST scored once
BGE scores and hybrid features are deterministic, label-free functions of each (resume, job)
text pair, so they are computed once for all pairs (embeddings cached) and reused.

Outputs (results/): repeated_grouped_per_rep.csv, repeated_grouped_summary.csv,
repeated_grouped_differences.csv, repeated_grouped_ablation.csv, repeated_grouped_selection.csv,
repeated_grouped_per_job.csv, repeated_grouped_meta.json
"""
import json

import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold

from ml.config import DATA_PROCESSED, EXPERIMENTS_DIR, RESULTS_DIR
from ml.evaluation.experiment import build_tfidf
from ml.evaluation.hybrid_select import METRICS, _matcher, configurations, select
from ml.evaluation.leakage_check import check
from ml.evaluation.metrics import (apply_thresholds, classification_metrics, fit_thresholds,
                                   ranking_metrics, reference_baselines)
from ml.models.hybrid import combine

MODELS = ["tfidf", "semantic", "hybrid"]
COMPARISONS = [("hybrid", "semantic"), ("hybrid", "tfidf"), ("semantic", "tfidf")]
DIFF_METRICS = ["ndcg@10", "ndcg@5", "mrr", "map"]


def repetitions(df: pd.DataFrame, cfg: dict) -> list[dict[str, np.ndarray]]:
    """Row indices of train / validation / test for each repetition."""
    folds = np.empty(len(df), dtype=int)
    sgkf = StratifiedGroupKFold(n_splits=cfg["n_folds"], shuffle=True, random_state=cfg["seed"])
    for k, (_, idx) in enumerate(sgkf.split(df, df["label_id"], groups=df["resume_group"])):
        folds[idx] = k
    t, v, n = cfg["test_folds"], cfg["validation_folds"], cfg["n_folds"]
    out = []
    for r in range(cfg["repetitions"]):
        test = {(t * r + i) % n for i in range(t)}
        val = {(t * r + t + i) % n for i in range(v)}
        out.append({"test": np.flatnonzero(np.isin(folds, list(test))),
                    "validation": np.flatnonzero(np.isin(folds, list(val))),
                    "train": np.flatnonzero(~np.isin(folds, list(test | val)))})
    return out


def score_split(df: pd.DataFrame, val_scores, val_labels, test_scores) -> tuple[dict, pd.DataFrame]:
    """Test metrics with thresholds from validation; also returns per-job ranking metrics."""
    thresholds = fit_thresholds(val_scores, val_labels)
    pred = df[["job_id", "resume_id", "label_id"]].assign(score=np.asarray(test_scores))
    ranking, per_job = ranking_metrics(pred, "score")
    cls = classification_metrics(pred["label_id"], apply_thresholds(pred["score"], thresholds))
    return ({**{m: ranking[m] for m in METRICS}, "accuracy": cls["accuracy"], "macro_f1": cls["macro_f1"],
             "jobs_eligible": ranking["jobs_eligible"]}, per_job)


def stratified_bootstrap(per_rep_diffs: list[np.ndarray], n: int, seed: int) -> tuple[float, float]:
    """95% CI of the mean (over repetitions) of per-job differences. Jobs are resampled with
    replacement WITHIN each repetition's test set, keeping the model pairing."""
    rng = np.random.default_rng(seed)
    means = np.zeros(n)
    for d in per_rep_diffs:
        means += d[rng.integers(0, len(d), size=(n, len(d)))].mean(axis=1)
    means /= len(per_rep_diffs)
    low, high = np.percentile(means, [2.5, 97.5])
    return float(low), float(high)


def main():
    cfg = json.loads((EXPERIMENTS_DIR / "repeated.json").read_text())
    hyb_cfg = json.loads((EXPERIMENTS_DIR / f"{cfg['hybrid_config']}.json").read_text())
    tfidf_params = json.loads((EXPERIMENTS_DIR / f"{cfg['tfidf_config']}.json").read_text())
    df = pd.read_parquet(DATA_PROCESSED / "all.parquet")

    # Label-free per-pair features, computed once (BGE embeddings come from the cache).
    matcher = _matcher(hyb_cfg)
    feats = matcher.features(df["resume"], df["job_description"])
    matcher.semantic.save_cache()

    reps = repetitions(df, cfg)
    rows, ablation_rows, selection_rows, per_job_rows, meta_reps = [], [], [], [], []
    for r, idx in enumerate(reps):
        split = {k: df.iloc[v].reset_index(drop=True) for k, v in idx.items()}
        leak = check(split)
        if not leak["no_resume_overlap"]:
            raise SystemExit(f"LEAKAGE in repetition {r}")
        meta_reps.append({"repetition": r, **{k: len(v) for k, v in idx.items()},
                          "test_jobs_eligible": leak["splits"]["test"]["ranking_groups"],
                          "no_resume_overlap": leak["no_resume_overlap"]})
        val, test = split["validation"], split["test"]
        fv, ft = feats.iloc[idx["validation"]].reset_index(drop=True), feats.iloc[idx["test"]].reset_index(drop=True)

        tfidf = build_tfidf(split["train"], tfidf_params)
        scores = {
            "tfidf": (tfidf.score_pairs(val["resume"], val["job_description"]),
                      tfidf.score_pairs(test["resume"], test["job_description"])),
            "semantic": (fv["semantic_similarity"].to_numpy(), ft["semantic_similarity"].to_numpy()),
        }
        selected, scaler, comparison, _ = select(hyb_cfg, fv, val)   # validation only
        w = hyb_cfg["candidate_weights"][selected]
        scores["hybrid"] = (combine(fv, w, scaler), combine(ft, w, scaler))
        selection_rows.append({"repetition": r, "selected": selected, **w,
                               **{f"scaler_{k}": json.dumps([round(x, 6) for x in v]) for k, v in scaler.items()}})

        for model, (sv, st) in scores.items():
            m, per_job = score_split(test, sv, val["label_id"], st)
            rows.append({"repetition": r, "model": model, **m})
            per_job_rows.append(per_job.assign(repetition=r, model=model))
        rnd = reference_baselines(test, seed=cfg["seed"] + r, n_shuffles=cfg["random_shuffles"])
        rows.append({"repetition": r, "model": "random", **{k: rnd["random_ranking"][k] for k in METRICS},
                     "accuracy": None, "macro_f1": None, "jobs_eligible": rows[-1]["jobs_eligible"]})

        for stage, sw in configurations(hyb_cfg, selected).items():
            m, _ = score_split(test, combine(fv, sw, scaler), val["label_id"], combine(ft, sw, scaler))
            ablation_rows.append({"repetition": r, "stage": stage.split(" (")[0], **m})
        print(f"rep {r}: selected {selected} | " + " | ".join(
            f"{x['model']} NDCG@10={x['ndcg@10']:.4f}" for x in rows[-4:]), flush=True)

    per_rep = pd.DataFrame(rows)
    per_job = pd.concat(per_job_rows, ignore_index=True)
    ablation = pd.DataFrame(ablation_rows)

    summary = []
    for model in ["random"] + MODELS:
        sub = per_rep[per_rep.model == model]
        for metric in METRICS + ["accuracy", "macro_f1"]:
            x = sub[metric].dropna().astype(float)
            if len(x):
                summary.append({"model": model, "metric": metric, "mean": x.mean(), "std": x.std(ddof=1),
                                "min": x.min(), "max": x.max(), "n_repetitions": len(x)})

    diffs = []
    for a, b in COMPARISONS:
        for metric in DIFF_METRICS:
            rep_d = per_rep[per_rep.model == a].set_index("repetition")[metric] - \
                    per_rep[per_rep.model == b].set_index("repetition")[metric]
            job_d = []
            for r in range(len(reps)):
                ja = per_job[(per_job.model == a) & (per_job.repetition == r)].set_index("job_id")[metric]
                jb = per_job[(per_job.model == b) & (per_job.repetition == r)].set_index("job_id")[metric]
                job_d.append((ja - jb).dropna().to_numpy())
            low, high = stratified_bootstrap(job_d, cfg["bootstrap_resamples"], cfg["seed"])
            diffs.append({"comparison": f"{a} - {b}", "metric": metric, "mean_diff": rep_d.mean(),
                          "std_diff": rep_d.std(ddof=1), "min_diff": rep_d.min(), "max_diff": rep_d.max(),
                          "reps_positive": int((rep_d > 0).sum()), "n_repetitions": len(rep_d),
                          "ci95_low": low, "ci95_high": high, "ci_excludes_0": bool(low > 0 or high < 0),
                          "n_job_units": int(sum(len(d) for d in job_d))})

    ab_summary = ablation.groupby("stage", sort=False)[METRICS + ["macro_f1"]].agg(["mean", "std"])
    ab_summary.columns = [f"{m}_{s}" for m, s in ab_summary.columns]

    r6 = lambda d: d.round(6)
    r6(per_rep).to_csv(RESULTS_DIR / "repeated_grouped_per_rep.csv", index=False)
    r6(pd.DataFrame(summary)).to_csv(RESULTS_DIR / "repeated_grouped_summary.csv", index=False)
    r6(pd.DataFrame(diffs)).to_csv(RESULTS_DIR / "repeated_grouped_differences.csv", index=False)
    r6(ablation).to_csv(RESULTS_DIR / "repeated_grouped_ablation.csv", index=False)
    r6(ab_summary.reset_index()).to_csv(RESULTS_DIR / "repeated_grouped_ablation_summary.csv", index=False)
    pd.DataFrame(selection_rows).to_csv(RESULTS_DIR / "repeated_grouped_selection.csv", index=False)
    r6(per_job[["repetition", "model", "job_id", "n_candidates"] + DIFF_METRICS]).to_csv(
        RESULTS_DIR / "repeated_grouped_per_job.csv", index=False)
    (RESULTS_DIR / "repeated_grouped_meta.json").write_text(json.dumps(
        {"config": cfg, "hybrid": {"config": cfg["hybrid_config"], "glued_cues": hyb_cfg.get("glued_cues", False),
                                   "selection_metric": hyb_cfg["selection_metric"]},
         "repetitions": meta_reps, "total_pairs": len(df),
         "all_repetitions_leakage_free": all(m["no_resume_overlap"] for m in meta_reps)}, indent=2))

    with pd.option_context("display.width", 220, "display.max_columns", 30):
        print(r6(pd.DataFrame(summary)).pivot(index="model", columns="metric", values="mean")
              .loc[["random"] + MODELS, METRICS + ["macro_f1"]].round(4))
        print(pd.DataFrame(diffs).round(4).to_string(index=False))
        print(ab_summary.round(4))


if __name__ == "__main__":
    main()
