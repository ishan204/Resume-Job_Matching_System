"""Step 1: download the dataset at a pinned revision into data/raw/.

    python -m ml.dataset.download
"""
from datasets import load_dataset

from ml.config import DATA_RAW, DATASET_NAME, DATASET_REVISION


def download():
    DATA_RAW.mkdir(parents=True, exist_ok=True)
    ds = load_dataset(DATASET_NAME, revision=DATASET_REVISION)
    for split, part in ds.items():
        path = DATA_RAW / f"{split}.parquet"
        part.to_pandas().to_parquet(path, index=False)
        print(f"{split}: {len(part)} rows -> {path}")


if __name__ == "__main__":
    download()
