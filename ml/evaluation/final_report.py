"""Assemble the final comparison tables and figures from saved results only (nothing recomputed).

    python -m ml.evaluation.final_report
      -> results/final_model_comparison.csv / .json, results/final_ablation.csv, results/figures/*.png
"""
import json

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

from ml.config import DATASET_NAME, DATASET_REVISION, RESULTS_DIR, ROOT, SEED  # noqa: E402

RANKING = ["mrr", "map", "ndcg@5", "ndcg@10", "p@1", "p@5"]
CLASSIFICATION = ["accuracy", "macro_precision", "macro_recall", "macro_f1"]
MODELS = ["tfidf", "semantic", "hybrid", "hybrid_parserfix"]
LABELS = {"random": "Random", "tfidf": "TF-IDF", "semantic": "BGE semantic",
          "hybrid": "Hybrid (Phase 5)", "hybrid_parserfix": "Hybrid (parser fix)"}
# Reference palette slots 1-3 (validated: CVD + normal-vision pass; aqua < 3:1 so every bar is labelled)
COLOR = {"tfidf": "#2a78d6", "semantic": "#eb6834", "hybrid": "#1baf7a", "hybrid_parserfix": "#1baf7a"}
INK, MUTED, GRID, AXIS, SURFACE = "#0b0b0b", "#52514e", "#e1e0d9", "#c3c2b7", "#fcfcfb"
FIG = RESULTS_DIR / "figures"


def metrics(config: str, split: str) -> dict | None:
    path = RESULTS_DIR / f"{config}_{split}_metrics.json"
    return json.loads(path.read_text()) if path.exists() else None


def comparison_table() -> tuple[pd.DataFrame, dict]:
    rep = pd.read_csv(RESULTS_DIR / "repeated_grouped_summary.csv")
    rep_model = {"random": "random", "tfidf": "tfidf", "semantic": "semantic", "hybrid_parserfix": "hybrid"}
    rows = []
    for name in ["random"] + MODELS:
        row = {"model": name}
        for split in ("validation", "test"):
            if name == "random":
                ref = metrics("tfidf", split)["chance_reference"]
                row |= {f"{split}_{k}": ref["random_ranking"][k] for k in RANKING}
                continue
            m = metrics(name, split)
            if m is None:
                continue
            row |= {f"{split}_{k}": m["ranking"][k] for k in RANKING}
            row |= {f"{split}_{k}": m["classification"][k] for k in CLASSIFICATION}
        if name in rep_model:
            sub = rep[rep.model == rep_model[name]].set_index("metric")
            for k in sub.index:
                row[f"repeated_mean_{k}"] = sub.loc[k, "mean"]
                row[f"repeated_std_{k}"] = sub.loc[k, "std"]
        rows.append(row)
    return pd.DataFrame(rows).set_index("model"), rep_model


def ablation_table() -> pd.DataFrame:
    val = pd.read_csv(RESULTS_DIR / "hybrid_ablation_validation.csv")
    test = pd.read_csv(RESULTS_DIR / "hybrid_ablation_test.csv")
    rep = pd.read_csv(RESULTS_DIR / "repeated_grouped_ablation_summary.csv")
    stage = lambda s: s.split(" (")[0]
    out = pd.DataFrame({"stage": val.configuration.map(stage)})
    for k in ["ndcg@10", "mrr", "map", "macro_f1"]:
        out[f"phase5_validation_{k}"] = val[k].values
        out[f"phase5_test_{k}"] = test[k].values
        out[f"repeated_mean_{k}"] = rep[f"{k}_mean"].values
        out[f"repeated_std_{k}"] = rep[f"{k}_std"].values
    return out


# ---------------- figures ----------------

def _style(ax, title, ylabel):
    ax.set_facecolor(SURFACE)
    ax.set_title(title, color=INK, fontsize=11, loc="left")
    ax.set_ylabel(ylabel, color=MUTED, fontsize=9)
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    ax.spines["bottom"].set_color(AXIS)
    ax.tick_params(colors=MUTED, labelsize=9, length=0)


def _bars(ax, names, values, errors=None, ref=None, ref_label=None, ylim=None):
    x = range(len(names))
    ax.bar(x, values, width=0.6, color=[COLOR[n] for n in names], yerr=errors,
           error_kw={"ecolor": INK, "elinewidth": 1, "capsize": 3}, edgecolor=SURFACE, linewidth=2)
    for i, v in enumerate(values):  # direct labels: identity and value never rely on color alone
        top = v + (errors[i] if errors is not None else 0)
        ax.text(i, top + 0.004, f"{v:.3f}", ha="center", va="bottom", fontsize=9, color=INK)
    ax.set_xticks(list(x), [LABELS[n] for n in names])
    if ref is not None:
        ax.axhline(ref, color=MUTED, linestyle="--", linewidth=1)
        ax.text(len(names) - 0.5, ref, f" {ref_label} {ref:.3f}", va="bottom", ha="right", fontsize=8, color=MUTED)
    if ylim:
        ax.set_ylim(*ylim)


def metric_figure(table: pd.DataFrame, metric: str, title: str, fname: str, ylim):
    fig, axes = plt.subplots(1, 2, figsize=(10, 3.8), sharey=True, facecolor=SURFACE)
    orig = ["tfidf", "semantic", "hybrid"]
    has_ref = f"test_{metric}" in table.columns and pd.notna(table.loc["random"].get(f"test_{metric}"))
    _bars(axes[0], orig, table.loc[orig, f"test_{metric}"].tolist(),
          ref=table.loc["random", f"test_{metric}"] if has_ref else None, ref_label="random", ylim=ylim)
    _style(axes[0], "Original held-out test split (157 rankable jobs)", metric.upper().replace("NDCG", "NDCG"))
    rep = ["tfidf", "semantic", "hybrid_parserfix"]
    _bars(axes[1], rep, table.loc[rep, f"repeated_mean_{metric}"].tolist(),
          errors=table.loc[rep, f"repeated_std_{metric}"].tolist(),
          ref=table.loc["random", f"repeated_mean_{metric}"] if has_ref else None, ref_label="random", ylim=ylim)
    _style(axes[1], "5 repeated grouped splits: mean ± SD", "")
    fig.suptitle(title, x=0.01, ha="left", color=INK, fontsize=12)
    fig.tight_layout()
    fig.savefig(FIG / fname, dpi=150, facecolor=SURFACE)
    plt.close(fig)


def ablation_figure(ab: pd.DataFrame):
    fig, axes = plt.subplots(1, 3, figsize=(13, 3.8), sharey=True, facecolor=SURFACE)
    short = ["Semantic", "+Req", "+Pref", "+Exp", "+Resp", "Final"]
    series = [("phase5_validation_ndcg@10", None, "Phase 5 validation"), ("phase5_test_ndcg@10", None, "Phase 5 test"),
              ("repeated_mean_ndcg@10", "repeated_std_ndcg@10", "Repeated splits: mean ± SD")]
    for ax, (col, err, title) in zip(axes, series):
        vals = ab[col].tolist()
        errs = ab[err].tolist() if err else None
        ax.bar(range(6), vals, width=0.6, color=COLOR["tfidf"], yerr=errs, edgecolor=SURFACE, linewidth=2,
               error_kw={"ecolor": INK, "elinewidth": 1, "capsize": 3})
        ax.axhline(vals[0], color=MUTED, linestyle="--", linewidth=1)  # semantic-only reference
        for i, v in enumerate(vals):
            ax.text(i, v + (errs[i] if errs else 0) + 0.002, f"{v:.3f}", ha="center", va="bottom", fontsize=8, color=INK)
        ax.set_xticks(range(6), short)
        ax.set_ylim(0.76, 0.87)
        _style(ax, title, "NDCG@10" if ax is axes[0] else "")
    fig.suptitle("Hybrid ablation: NDCG@10 as components are added (dashed = semantic only)",
                 x=0.01, ha="left", color=INK, fontsize=12)
    fig.tight_layout()
    fig.savefig(FIG / "hybrid_ablation_ndcg10.png", dpi=150, facecolor=SURFACE)
    plt.close(fig)


def repeated_distribution_figure():
    per = pd.read_csv(RESULTS_DIR / "repeated_grouped_per_rep.csv")
    models = ["tfidf", "semantic", "hybrid"]
    fig, ax = plt.subplots(figsize=(7, 4), facecolor=SURFACE)
    wide = per[per.model.isin(models)].pivot(index="repetition", columns="model", values="ndcg@10")[models]
    for _, row in wide.iterrows():  # paired: one thin line per repetition
        ax.plot(range(3), row.values, color=GRID, linewidth=1.2, zorder=1)
    for i, m in enumerate(models):
        ax.scatter([i] * len(wide), wide[m], s=60, color=COLOR[m], edgecolor=SURFACE, linewidth=2, zorder=2)
        ax.text(i + 0.08, wide[m].mean(), f"mean {wide[m].mean():.3f}", fontsize=8, color=INK, va="center")
    rnd = per[per.model == "random"]["ndcg@10"].mean()
    ax.axhline(rnd, color=MUTED, linestyle="--", linewidth=1)
    ax.text(2.45, rnd, f"random {rnd:.3f}", fontsize=8, color=MUTED, va="bottom", ha="right")
    ax.set_xticks(range(3), ["TF-IDF", "BGE semantic", "Hybrid (parser fix)"])
    ax.set_xlim(-0.4, 2.6)
    _style(ax, "NDCG@10 on each of 5 repeated grouped test splits (lines join the same split)", "NDCG@10")
    fig.tight_layout()
    fig.savefig(FIG / "repeated_ndcg10_distribution.png", dpi=150, facecolor=SURFACE)
    plt.close(fig)


def differences_figure():
    d = pd.read_csv(RESULTS_DIR / "repeated_grouped_differences.csv")
    d = d[d.metric.isin(["ndcg@10", "mrr"])].reset_index(drop=True)
    fig, ax = plt.subplots(figsize=(8, 4), facecolor=SURFACE)
    y = list(range(len(d)))[::-1]
    for yi, r in zip(y, d.itertuples()):
        ax.plot([r.ci95_low, r.ci95_high], [yi, yi], color=INK, linewidth=1.5)
        ax.scatter([r.mean_diff], [yi], s=50, color=COLOR["tfidf"], zorder=3, edgecolor=SURFACE, linewidth=2)
        ax.text(r.ci95_high + 0.002, yi, f"{r.mean_diff:+.3f}  [{r.ci95_low:+.3f}, {r.ci95_high:+.3f}]  "
                f"{r.reps_positive}/{r.n_repetitions} splits > 0", va="center", fontsize=8, color=INK)
    ax.axvline(0, color=MUTED, linewidth=1)
    ax.set_yticks(y, [f"{r.comparison}  ({r.metric.upper()})" for r in d.itertuples()])
    ax.set_xlim(min(d.ci95_low.min(), 0) - 0.01, d.ci95_high.max() + 0.09)
    _style(ax, "Paired differences across 5 repeated splits: mean and 95% job-bootstrap CI", "")
    ax.grid(axis="x", color=GRID, linewidth=0.8)
    ax.grid(axis="y", visible=False)
    fig.tight_layout()
    fig.savefig(FIG / "repeated_paired_differences.png", dpi=150, facecolor=SURFACE)
    plt.close(fig)


def main():
    FIG.mkdir(parents=True, exist_ok=True)
    table, rep_model = comparison_table()
    table.round(6).to_csv(RESULTS_DIR / "final_model_comparison.csv")
    ab = ablation_table()
    ab.round(6).to_csv(RESULTS_DIR / "final_ablation.csv", index=False)

    metric_figure(table, "ndcg@10", "NDCG@10 by model", "ndcg10_by_model.png", (0.70, 0.90))
    metric_figure(table, "mrr", "MRR by model", "mrr_by_model.png", (0.65, 0.90))
    metric_figure(table, "macro_f1", "Macro F1 by model (classification, secondary)", "macro_f1_by_model.png", (0.30, 0.50))
    ablation_figure(ab)
    repeated_distribution_figure()
    differences_figure()

    load = lambda name: json.loads((RESULTS_DIR / name).read_text()) if (RESULTS_DIR / name).exists() else None
    meta = {
        "dataset": {"name": DATASET_NAME, "revision": DATASET_REVISION, "split_seed": SEED,
                    "stats": load("dataset_stats.json")},
        "protocol": "fit on train; thresholds, scaling and weights on validation; test scored once",
        "models": {name: {split: (metrics(name, split) or {}).get("model_params") for split in ("test",)}
                   for name in MODELS},
        "repeated_grouped": load("repeated_grouped_meta.json"),
        "repeated_model_mapping": {k: f"repeated '{v}'" for k, v in rep_model.items()},
        "original_test_bootstrap": pd.read_csv(RESULTS_DIR / "significance_test.csv").to_dict(orient="records"),
        "repeated_differences": pd.read_csv(RESULTS_DIR / "repeated_grouped_differences.csv").to_dict(orient="records"),
        "explainability_check": load("hybrid_explainability_check.json"),
        "privacy_check": load("privacy_check.json"),
        "error_analysis_summary": pd.read_csv(RESULTS_DIR / "error_analysis_summary.csv").to_dict(orient="records"),
        "comparison": json.loads(table.round(6).reset_index().to_json(orient="records")),
        "figures": sorted(str(p.relative_to(ROOT)).replace("\\", "/") for p in FIG.glob("*.png")),
        "notes": ["Scores are similarities, not probabilities.",
                  "Ranking metrics are primary; classification metrics are secondary.",
                  "Repeated-split hybrid uses the Phase 6 parser fix and re-selects weights per repetition."],
    }
    (RESULTS_DIR / "final_model_comparison.json").write_text(json.dumps(meta, indent=2, default=str))
    with pd.option_context("display.width", 250, "display.max_columns", 40):
        cols = [c for c in table.columns if c.split("_", 1)[-1] in ("ndcg@10", "mrr", "macro_f1")
                and not c.startswith("validation_macro")]
        print(table[cols].round(4))
    print("figures:", meta["figures"])


if __name__ == "__main__":
    main()
