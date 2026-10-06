"""Phase 7: FastAPI backend. Uses a fake encoder and a tiny TF-IDF (no BGE download).

Real-model integration test is opt-in:  RUN_INTEGRATION=1 pytest -m integration tests/test_api.py
"""
import io
import json
import logging
import os
import time

import pandas as pd
import pytest
from fastapi.testclient import TestClient

import backend.app.main as main
from backend.app.config import DISCLAIMER, Settings
from backend.app.registry import Registry
from backend.app.schemas import CompareResult, MatchResult
from ml.config import DATA_SPLITS, RESULTS_DIR
from ml.models.tfidf import TFIDFMatcher
from tests.test_semantic import FakeEncoder

RESUME = (main.DEMO / "resume.txt").read_text(encoding="utf-8")
JOB = (main.DEMO / "job.txt").read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def client():
    tfidf = TFIDFMatcher(min_df=1, max_df=1.0).fit([RESUME, JOB])
    reg = Registry(encoder_factory=FakeEncoder, tfidf=tfidf)
    with TestClient(main.create_app(registry=reg, preload=True)) as c:
        yield c


def _pdf(text: str) -> bytes:
    """A minimal valid one-page PDF with a text layer."""
    content = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
            b"/Resources << /Font << /F1 5 0 R >> >> >>",
            b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream",
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    out, offsets = b"%PDF-1.4\n", []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    out += b"".join(b"%010d 00000 n \n" % off for off in offsets)
    return out + b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF" % (len(objs) + 1, xref)


def _docx(text: str) -> bytes:
    from docx import Document
    d = Document()
    for line in text.splitlines():
        d.add_paragraph(line)
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue()


# ---------- general ----------

def test_health_and_models(client):
    h = client.get("/api/health").json()
    assert h["status"] == "ok" and h["models"] == ["tfidf", "semantic", "hybrid"] and h["models_loaded"]
    assert h["disclaimer"] == DISCLAIMER
    m = client.get("/api/models").json()
    assert [x["name"] for x in m["models"]] == ["tfidf", "semantic", "hybrid"]
    assert m["models"][2]["selected_on"] == "validation"


def test_demo_fixture_is_synthetic(client):
    d = client.get("/api/demo").json()
    assert "Synthetic" in d["note"] and d["resume"].strip() and d["job_description"].strip()


# ---------- validation and errors ----------

@pytest.mark.parametrize("body,needle", [
    ({"resume": RESUME, "job_description": JOB, "model": "gpt"}, "model"),
    ({"resume": "   ", "job_description": JOB}, "Resume text cannot be empty."),
    ({"resume": RESUME, "job_description": ""}, "Job description text cannot be empty."),
    ({"job_description": JOB}, "resume"),
])
def test_invalid_match_requests(client, body, needle):
    r = client.post("/api/match", json=body)
    assert r.status_code == 422
    err = r.json()["error"]
    assert err["code"] == "INVALID_INPUT" and needle in err["message"]
    assert RESUME[:30] not in json.dumps(r.json())  # input is never echoed back


def test_malformed_json_and_404_use_error_format(client):
    r = client.post("/api/match", content=b"{not json", headers={"Content-Type": "application/json"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "INVALID_INPUT"
    r = client.get("/api/nope")
    assert r.status_code == 404 and r.json()["error"]["code"] == "NOT_FOUND"


def test_text_too_long(client, monkeypatch):
    monkeypatch.setattr(main, "settings", Settings(max_text_chars=100))
    r = client.post("/api/match", json={"resume": RESUME, "job_description": JOB})
    assert r.status_code == 413 and r.json()["error"]["code"] == "TEXT_TOO_LONG"


def test_unexpected_errors_hide_internals(client, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("secret internal detail " + RESUME[:20])
    monkeypatch.setattr(main.matching, "match", boom)
    c = TestClient(client.app, raise_server_exceptions=False)
    r = c.post("/api/match", json={"resume": RESUME, "job_description": JOB})
    assert r.status_code == 500 and r.json() == {"error": {"code": "INTERNAL_ERROR",
                                                           "message": "An unexpected error occurred."}}


# ---------- matching ----------

def test_match_tfidf_semantic_hybrid_return_relevant_fields(client):
    out = {}
    for model in ("tfidf", "semantic", "hybrid"):
        r = client.post("/api/match", json={"resume": RESUME, "job_description": JOB, "model": model})
        assert r.status_code == 200, r.text
        out[model] = MatchResult.model_validate(r.json())
        body = r.json()
        assert body["category"] in ("Weak match", "Potential match", "Strong match")
        assert 0 <= body["validation_percentile"] <= 100
        if model != "hybrid":
            assert "matched_required_skills" not in body and "experience" not in body
    assert out["tfidf"].explanation["top_shared_terms"]
    h = out["hybrid"]
    # AWS is a "must have" the resume lacks; "Tableau or Power BI" marks both as required (a known
    # parser limitation: alternatives are not modelled), and the resume never says "data analysis"
    assert set(h.missing_required_skills) == {"AWS", "Data Analysis", "Power BI"}
    assert {"Python", "SQL", "Tableau"} <= set(h.matched_required_skills)
    assert h.experience["required_years"] == 5 and h.experience["gap_years"] is not None
    assert any("AWS" in g for g in h.explanation["gaps"])
    assert 0 <= h.score <= 1


def test_default_model_is_hybrid(client):
    r = client.post("/api/match", json={"resume": RESUME, "job_description": JOB})
    assert r.json()["model"] == "hybrid"


def test_compare_runs_all_three_on_same_input(client):
    r = client.post("/api/compare", json={"resume": RESUME, "job_description": JOB})
    assert r.status_code == 200
    body = CompareResult.model_validate(r.json())
    assert [x["model"] for x in body.ranking] == sorted(
        ("tfidf", "semantic", "hybrid"), key=lambda m: (-getattr(body, m).validation_percentile, m))
    for m in ("tfidf", "semantic", "hybrid"):
        single = client.post("/api/match", json={"resume": RESUME, "job_description": JOB, "model": m}).json()
        assert single["score"] == getattr(body, m).score
    assert "not calibrated probabilities" in body.note


# ---------- parsing ----------

@pytest.mark.parametrize("name,data", [("cv.txt", RESUME.encode()), ("cv.docx", _docx(RESUME)),
                                       ("cv.pdf", _pdf("Python and SQL analyst with Tableau"))],
                         ids=["txt", "docx", "pdf"])
def test_parse_resume_files(client, name, data):
    r = client.post("/api/parse-resume", files={"file": (name, data)})
    assert r.status_code == 200, r.text
    body = r.json()
    skills = {s["skill"] for s in body["skills"]}
    assert {"Python", "SQL", "Tableau"} <= skills
    assert "text" not in body                                                # raw text only on request
    if name != "cv.pdf":
        assert body["experience"]["total_years"] == pytest.approx(76 / 12, abs=0.01)  # 25 + 51 months
        assert body["highest_degree"] == "Bachelor"
        assert body["projects"] and body["certifications"]


def test_parse_resume_text_and_include_text(client):
    r = client.post("/api/parse-resume?include_text=true", data={"text": RESUME})
    assert r.status_code == 200 and r.json()["text"] == RESUME


@pytest.mark.parametrize("name,data,code", [
    ("cv.pdf", b"this is not really a pdf", "UNSUPPORTED_OR_UNREADABLE_FILE"),
    ("cv.docx", b"PK\x03\x04 broken zip", "UNSUPPORTED_OR_UNREADABLE_FILE"),
    ("cv.exe", b"MZ\x90\x00", "UNSUPPORTED_OR_UNREADABLE_FILE"),
    ("cv.txt", b"   ", "UNSUPPORTED_OR_UNREADABLE_FILE"),
])
def test_bad_uploads_rejected_safely(client, name, data, code):
    r = client.post("/api/parse-resume", files={"file": (name, data)})
    assert r.status_code == 422 and r.json()["error"]["code"] == code


def test_upload_size_limit_and_missing_input(client, monkeypatch):
    monkeypatch.setattr(main, "settings", Settings(max_upload_mb=0.001))
    r = client.post("/api/parse-resume", files={"file": ("cv.txt", b"x" * 5000)})
    assert r.status_code == 413 and r.json()["error"]["code"] == "FILE_TOO_LARGE"
    monkeypatch.setattr(main, "settings", Settings())
    r = client.post("/api/parse-resume", data={})
    assert r.status_code == 422 and r.json()["error"]["code"] == "INVALID_INPUT"


def test_parse_job(client):
    r = client.post("/api/parse-job", json={"job_description": JOB})
    assert r.status_code == 200
    b = r.json()
    req = {s["skill"] for s in b["required_skills"]}
    assert {"SQL", "Python", "AWS", "Tableau", "Power BI"} <= req
    assert {"Airflow", "Snowflake"} <= {s["skill"] for s in b["preferred_skills"]}
    assert b["experience_requirement"]["min_years"] == 5
    assert b["education"]["required_level"] == "Bachelor"
    assert b["responsibilities_from_section"] and b["title"] == "Senior Data Analyst"
    assert all(s["evidence"] for s in b["required_skills"])
    assert client.post("/api/parse-job", json={"job_description": " "}).status_code == 422


# ---------- research (read-only, matches committed files) ----------

def test_research_endpoints_serve_saved_results(client):
    comp = pd.read_csv(RESULTS_DIR / "final_model_comparison.csv").set_index("model")
    s = client.get("/api/research/summary").json()
    assert s["dataset"]["pairs"] == 7987 and s["dataset"]["no_resume_overlap_between_splits"]
    assert s["dataset"]["raw_pairs"] == 8000 and s["repeated_evaluation"]["repetitions"] == 5
    assert s["dataset"]["original_split_leakage"] == json.loads((RESULTS_DIR / "original_split_leakage.json").read_text())
    assert s["headline"]["semantic"]["test_ndcg@10"] == pytest.approx(comp.loc["semantic", "test_ndcg@10"])
    assert s["hybrid_vs_semantic_repeated"]["splits_positive"] == 5
    assert s["limitations"]
    rows = {r["model"]: r for r in client.get("/api/research/models").json()["rows"]}
    assert rows["hybrid"]["test_ndcg@10"] == pytest.approx(comp.loc["hybrid", "test_ndcg@10"])
    assert len(client.get("/api/research/ablation").json()["rows"]) == 6
    rob = client.get("/api/research/robustness").json()
    assert rob["design"]["all_repetitions_leakage_free"] and len(rob["per_repetition"]) == 20


# ---------- CORS and privacy ----------

def test_cors_allows_dev_origin_only(client):
    ok = client.options("/api/match", headers={"Origin": "http://localhost:5173",
                                               "Access-Control-Request-Method": "POST"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    bad = client.options("/api/match", headers={"Origin": "http://evil.example",
                                                "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in bad.headers


def test_logs_contain_no_user_text(client, caplog):
    secret = "ZQX-UNIQUE-CANARY jane.doe@example.com 555-123-4567"
    with caplog.at_level(logging.DEBUG):
        client.post("/api/match", json={"resume": RESUME + secret, "job_description": JOB})
        client.post("/api/parse-resume", files={"file": ("secret-name.txt", (RESUME + secret).encode())})
        client.post("/api/parse-job", json={"job_description": JOB + secret})
    logged = caplog.text
    assert "/api/match" in logged                      # operational logging happens
    for needle in ("ZQX-UNIQUE-CANARY", "jane.doe", "555-123-4567", "secret-name", "Northwind"):
        assert needle not in logged


def test_openapi_docs(client):
    spec = client.get("/openapi.json").json()
    for path in ["/api/health", "/api/match", "/api/compare", "/api/parse-resume", "/api/parse-job",
                 "/api/research/summary", "/api/research/models", "/api/research/ablation",
                 "/api/research/robustness"]:
        assert path in spec["paths"]
    assert client.get("/docs").status_code == 200 and client.get("/redoc").status_code == 200


# ---------- opt-in: the real BGE model reproduces the research scores ----------

@pytest.mark.integration
@pytest.mark.skipif(os.environ.get("RUN_INTEGRATION") != "1", reason="set RUN_INTEGRATION=1 to load the real BGE model")
def test_real_models_reproduce_saved_test_scores():
    start = time.perf_counter()
    with TestClient(main.create_app(registry=Registry(), preload=True)) as c:
        cold = time.perf_counter() - start
        test = pd.read_csv(DATA_SPLITS / "test.csv", keep_default_na=False).iloc[:3]
        saved = {m: pd.read_csv(RESULTS_DIR / f"{f}_test_predictions.csv").set_index(["resume_id", "job_id"])
                 for m, f in [("tfidf", "tfidf"), ("semantic", "semantic"), ("hybrid", "hybrid_parserfix")]}
        for row in test.itertuples():
            body = c.post("/api/compare", json={"resume": row.resume, "job_description": row.job_description}).json()
            for m in ("tfidf", "semantic", "hybrid"):
                expected = saved[m].loc[(row.resume_id, row.job_id), f"{m}_score"]
                assert body[m]["score"] == pytest.approx(expected, abs=1e-5), m
        t0 = time.perf_counter()
        c.post("/api/match", json={"resume": RESUME, "job_description": JOB, "model": "hybrid"})
        warm_match = time.perf_counter() - t0
        t0 = time.perf_counter()
        c.post("/api/compare", json={"resume": RESUME, "job_description": JOB})
        warm_compare = time.perf_counter() - t0
    print(f"\ncold init {cold:.1f}s | warm hybrid match {warm_match:.2f}s | warm compare {warm_compare:.2f}s")
