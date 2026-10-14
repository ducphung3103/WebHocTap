"""Local submission backups outside the public GitHub Pages directory."""
import json
import os
import tempfile
from pathlib import Path


def save_local_submission(root: Path, submission: dict) -> None:
    submission_id = submission.get("id")
    if not submission_id:
        raise ValueError("Submission must have an id")
    path = Path(root) / "data" / "private" / "submissions.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    records = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    if not isinstance(records, dict):
        raise ValueError("Local submission store must be an object")
    records[submission_id] = {**records.get(submission_id, {}), **submission}
    # Atomic replacement leaves the previous file intact if writing fails.
    fd, temporary = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(records, stream, ensure_ascii=False, indent=2)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
