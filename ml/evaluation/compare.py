"""Comparison table built only from saved metrics files (nothing is recomputed).

    python -m ml.evaluation.compare tfidf semantic hybrid
        -> results/model_comparison.csv (absolute + deltas vs the first model)
        -> results/model_deltas.csv     (every model minus every earlier one, incl. random)

Rows: random-ordering reference, then each config. Delta columns compare every model with the
first one listed (the baseline). Differences are descriptive; no significance test is implied.
"""
import json
import sys

import pandas as pd

from ml.config import RESULTS_DIR

RANKING = ["mrr", "map", "ndcg@5", "ndcg@10", "p@1", "p@5"]
CLASSIFICATION = ["accuracy", "macro_f1"]


def load(config: str, split: str = "test") -> dict:
    return json.loads((RESULTS_DIR / f"{config}_{split}_metrics.json").read_text())


def comparison(configs: list[str], split: str = "test") -> pd.DataFrame:
    metrics = {c: load(c, split) for c in configs}
    refs = [m["chance_reference"] for m in metrics.values()]
    if any(r != refs[0] for r in refs):
        raise ValueError("chance references differ: models were not evaluated on the same pairs/jobs")
    groups = {(m["pairs_scored"], m["ranking"]["jobs_eligible"], m["ranking"]["jobs_binary_eligible"])
              for m in metrics.values()}
    if len(groups) != 1:
        raise ValueError(f"models evaluated on different candidate groups: {groups}")

    rows = [{"model": "random_ordering", **{k: refs[0]["random_ranking"][k] for k in RANKING},
             "accuracy": None, "macro_f1": None}]
    for c, m in metrics.items():
        rows.append({"model": c, **{k: m["ranking"][k] for k in RANKING},
                     **{k: m["classification"][k] for k in CLASSIFICATION}})
    df = pd.DataFrame(rows).set_index("model")

    base = df.loc[configs[0]]
    for c in configs[1:]:
        for k in RANKING + CLASSIFICATION:
            df.loc[c, f"delta_{k}"] = round(df.loc[c, k] - base[k], 6)
            df.loc[c, f"rel_{k}_%"] = round(100 * (df.loc[c, k] - base[k]) / base[k], 2)
    return df


def pairwise_deltas(df: pd.DataFrame) -> pd.DataFrame:
    """Every later row minus every earlier row (incl. random), for the ranking metrics."""
    names = list(df.index)
    rows = [{"comparison": f"{b} - {a}", **{k: round(df.loc[b, k] - df.loc[a, k], 6) for k in RANKING}}
            for i, b in enumerate(names) for a in names[:i]]
    return pd.DataFrame(rows)


def main(configs: list[str]):
    df = comparison(configs)
    df.to_csv(RESULTS_DIR / "model_comparison.csv")
    deltas = pairwise_deltas(df)
    deltas.to_csv(RESULTS_DIR / "model_deltas.csv", index=False)
    with pd.option_context("display.width", 200, "display.max_columns", 50):
        print(df[RANKING + CLASSIFICATION].round(4))
        print(deltas.round(4).to_string(index=False))


if __name__ == "__main__":
    main(sys.argv[1:] or ["tfidf", "semantic", "hybrid"])
