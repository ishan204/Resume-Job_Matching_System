"""Phase 5: hybrid scoring, explanations, validation-only selection, evaluation compatibility.
Uses the fake encoder from test_semantic (no network)."""
import json

import numpy as np
import pandas as pd
import pytest

import ml.evaluation.experiment as experiment
from ml.evaluation import hybrid_select
from ml.evaluation.metrics import ranking_metrics
from ml.models.hybrid import COMPONENTS, HybridMatcher, combine, fit_scaler
from ml.models.semantic import SemanticMatcher
from tests.test_semantic import FakeEncoder

JOB = ("Responsibilities Prepare monthly financial reports for the leadership team. Reconcile bank accounts "
       "and the general ledger every week. Required Qualifications 3+ years of accounting experience. "
       "Must have Excel, QuickBooks and GAAP knowledge. Preferred Qualifications CPA and SAP experience.")
STRONG = ("Summary Accountant. Experience Senior Accountant 01/2014 to 01/2020 Acme. Prepared monthly financial "
          "reports for the leadership team using Excel. Reconciled bank accounts and the general ledger weekly. "
          "Applied GAAP in QuickBooks. Education Bachelor of Science in Accounting")
WEAK = ("Summary Cook. Experience Line Cook 01/2019 to 01/2020 Diner. Prepared breakfast for many guests. "
        "Cleaned the kitchen every evening. Education High School Diploma")
W = {"semantic_similarity": 0.4, "required_skill_coverage": 0.25, "preferred_skill_coverage": 0.1,
     "experience_match": 0.1, "responsibility_similarity": 0.15}


def matcher(weights=W, scaler=None):
    return HybridMatcher(SemanticMatcher("fake", encoder=FakeEncoder()), weights=weights,
                         scaler=scaler if scaler is not None else {"semantic_similarity": [0.0, 1.0],
                                                                    "responsibility_similarity": [0.0, 1.0]})


def test_features_are_bounded_and_explained_by_schema():
    f = matcher().features([STRONG, WEAK], [JOB, JOB])
    for c in ["required_skill_coverage", "preferred_skill_coverage", "weighted_skill_coverage", "experience_match"]:
        assert f[c].dropna().between(0, 1).all()
    assert f.loc[0, "required_skill_count"] == 3 and f.loc[0, "required_skill_coverage"] == 1.0
    assert f.loc[1, "required_skill_coverage"] == 0.0
    assert f.loc[0, "experience_match"] == 1.0 and f.loc[1, "experience_match"] == pytest.approx(1 / 3)
    assert f.loc[0, "responsibility_similarity"] > f.loc[1, "responsibility_similarity"]
    assert not any(c in f.columns for c in ["gender", "age", "race", "religion", "nationality", "address"])


def test_hybrid_scores_bounded_deterministic_and_ranked():
    s1 = matcher().score_pairs([STRONG, WEAK], [JOB, JOB])
    s2 = matcher().score_pairs([STRONG, WEAK], [JOB, JOB])
    np.testing.assert_array_equal(s1, s2)
    assert np.all((s1 >= 0) & (s1 <= 1))
    assert s1[0] > s1[1]


def test_combine_is_a_weighted_average_of_available_parts():
    f = pd.DataFrame({"semantic_similarity": [0.5, 0.5], "required_skill_coverage": [1.0, 0.0],
                      "required_skill_count": [2, 0], "experience_match": [np.nan, 0.5]})
    w = {"semantic_similarity": 0.5, "required_skill_coverage": 0.3, "experience_match": 0.2}
    s = combine(f, w, scaler={})
    assert s[0] == pytest.approx((0.5 * 0.5 + 0.3 * 1.0) / 0.8)   # experience unknown -> left out
    assert s[1] == pytest.approx((0.5 * 0.5 + 0.2 * 0.5) / 0.7)   # no required skills -> left out


def test_scaling_clips_to_unit_interval():
    f = pd.DataFrame({"semantic_similarity": [0.2, 0.6, 0.9]})
    assert list(combine(f, {"semantic_similarity": 1.0}, {"semantic_similarity": [0.4, 0.8]})) == \
        pytest.approx([0.0, 0.5, 1.0])
    sc = fit_scaler(pd.DataFrame({"semantic_similarity": np.linspace(0, 1, 101),
                                  "responsibility_similarity": np.linspace(0, 1, 101)}))
    assert sc["semantic_similarity"] == pytest.approx([0.01, 0.99])


def test_weight_changes_move_the_score_the_right_way():
    f = matcher().features([WEAK], [JOB])  # weak candidate: no required skills matched
    skill_heavy = {**W, "required_skill_coverage": 0.8}
    sc = {"semantic_similarity": [0.0, 1.0], "responsibility_similarity": [0.0, 1.0]}
    assert combine(f, skill_heavy, sc)[0] < combine(f, W, sc)[0]


def test_explanation_agrees_with_features_and_evidence():
    m = matcher()
    ex = m.explain(WEAK, JOB)
    f = m.features([WEAK], [JOB]).iloc[0]
    assert ex["overall_score"] == pytest.approx(m.score_pairs([WEAK], [JOB])[0])
    assert ex["missing_required_skills"] == ["GAAP", "Microsoft Excel", "QuickBooks"]
    assert len(ex["missing_required_skills"]) == f["missing_required_skill_count"]
    assert ex["components"]["required_skill_coverage"] == f["required_skill_coverage"] == 0.0
    assert ex["experience"]["gap_years"] == pytest.approx(f["experience_gap"])
    assert any("missing" in g for g in ex["gaps"])
    strong = m.explain(STRONG, JOB)
    for skill, sentence in strong["skill_evidence"].items():
        assert sentence in m.parse_resume(STRONG)["evidence"] or skill.split()[-1].lower() in sentence.lower()
    for ev in strong["responsibility_evidence"]:
        assert ev["job_responsibility"] in m.parse_job(JOB)["responsibilities"]
        assert ev["candidate_experience"] in m.parse_resume(STRONG)["evidence"]


# ---------- selection: validation only ----------

def _features_and_labels():
    rng = np.random.default_rng(0)
    n = 40
    f = pd.DataFrame({c: rng.random(n) for c in COMPONENTS})
    f["required_skill_count"], f["preferred_skill_count"] = 3, 2
    val = pd.DataFrame({"job_id": [f"j{i % 5}" for i in range(n)], "resume_id": [f"r{i}" for i in range(n)],
                        "label_id": (f["required_skill_coverage"] * 2.99).astype(int)})
    return f, val


def _cfg():
    return json.loads((experiment.EXPERIMENTS_DIR / "hybrid.json").read_text())


def test_selection_is_deterministic_and_uses_the_validation_rule():
    f, val = _features_and_labels()
    a = hybrid_select.select(_cfg(), f, val)
    b = hybrid_select.select(_cfg(), f, val)
    assert a[0] == b[0] and a[1] == b[1]
    pd.testing.assert_frame_equal(a[2], b[2])
    assert a[0] == a[2].loc[a[2]["ndcg@10"].idxmax(), "configuration"]
    # labels here are driven by required-skill coverage, so a skill-heavy weighting must win
    assert a[0] == "D_skill_heavy"
    assert list(a[3]["configuration"])[:5] == list(_cfg()["ablation"])


def test_selection_never_reads_the_test_split(monkeypatch, tmp_path):
    """Only validation.csv exists in the data folder: any attempt to open test.csv would crash."""
    f, val = _features_and_labels()
    splits = tmp_path / "splits"
    splits.mkdir()
    val.assign(resume="x", job_description="y").to_csv(splits / "validation.csv", index=False)
    (tmp_path / "config").mkdir()
    fake = type("Fake", (), {"features": lambda self, r, j: f,
                             "semantic": type("S", (), {"save_cache": lambda self: None})()})()
    monkeypatch.setattr(hybrid_select, "_matcher", lambda cfg: fake)
    monkeypatch.setattr(hybrid_select, "DATA_SPLITS", splits)
    monkeypatch.setattr(hybrid_select, "RESULTS_DIR", tmp_path)
    monkeypatch.setattr(hybrid_select, "ROOT", tmp_path)
    hybrid_select.main()
    frozen = json.loads((tmp_path / "config" / "matching_weights.json").read_text())
    assert frozen["selected_on"] == "validation" and frozen["selected"] in _cfg()["candidate_weights"]


def test_scaler_and_weights_ignore_test_labels():
    f, val = _features_and_labels()
    sel = hybrid_select.select(_cfg(), f, val)
    # selection only receives validation; scaler depends on features only, never on labels
    assert sel[1] == fit_scaler(f)
    assert hybrid_select.select(_cfg(), f, val)[1] == fit_scaler(f.sample(frac=1, random_state=1))


# ---------- same evaluation path as the baselines ----------

def test_hybrid_runs_through_the_shared_experiment(monkeypatch, tmp_path):
    frozen = {"selected": "A_initial", "weights": W, "preferred_alpha": 0.5, "selection_metric": "ndcg@10",
              "selected_on": "validation", "scaler": {"semantic_similarity": [0.0, 1.0],
                                                     "responsibility_similarity": [0.0, 1.0]}}
    (tmp_path / "w.json").write_text(json.dumps(frozen))
    monkeypatch.setattr(experiment, "ROOT", tmp_path)
    monkeypatch.setattr(experiment, "_semantic", lambda name, p: SemanticMatcher(name, encoder=FakeEncoder()))

    def make(rows):
        return pd.DataFrame([{"resume": r, "job_description": JOB, "resume_id": rid, "job_id": "j1",
                              "resume_group": "g" + rid, "label_id": l, "label": ["No Fit", "Potential Fit", "Good Fit"][l]}
                             for rid, r, l in rows])
    splits = {"train": make([("r0", STRONG, 2)]),
              "validation": make([("r1", STRONG, 2), ("r2", WEAK, 0), ("r3", STRONG + " Line cook.", 1)]),
              "test": make([("r4", WEAK, 0), ("r5", STRONG, 2)])}
    params = {"semantic_config": "semantic", "weights_file": "w.json"}
    _, preds, metrics = experiment.run("hybrid", splits, params)
    p = preds["test"]
    assert list(p.columns[:6]) == ["resume_id", "job_id", "resume_group", "label", "label_id", "hybrid_score"]
    assert {"required_skill_coverage", "experience_match", "responsibility_similarity"} <= set(p.columns)
    assert not {"resume", "job_description"} & set(p.columns)   # no raw text in prediction files
    assert ranking_metrics(p, "hybrid_score")[0] == metrics["test"]["ranking"]
    assert metrics["test"]["classification"]["thresholds"] == metrics["validation"]["classification"]["thresholds"]
    assert metrics["test"]["model_params"]["selected_on"] == "validation"
