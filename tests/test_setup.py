"""Phase 1 smoke test: environment and central config are sane."""
import importlib

from ml import config


def test_core_dependencies_import():
    for mod in ["numpy", "pandas", "sklearn", "datasets", "sentence_transformers",
                "pypdf", "docx", "fastapi"]:
        importlib.import_module(mod)


def test_config():
    assert abs(sum(config.SPLIT_RATIOS.values()) - 1.0) < 1e-9
    assert config.LABELS == ["No Fit", "Potential Fit", "Good Fit"]
    assert config.DATA_RAW.is_relative_to(config.ROOT)
    assert config.EMBEDDING_MODEL != config.EMBEDDING_FALLBACK
