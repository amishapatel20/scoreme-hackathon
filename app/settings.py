from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class AppSettings:
    project_root: Path
    db_path: Path
    workflow_dir: Path

    @classmethod
    def from_env(cls) -> "AppSettings":
        project_root = Path(__file__).resolve().parent.parent
        db_path = Path(os.getenv("DECISION_DB_PATH", project_root / "decision_platform.db"))
        workflow_dir = Path(os.getenv("WORKFLOW_CONFIG_DIR", project_root / "workflows"))
        return cls(project_root=project_root, db_path=db_path, workflow_dir=workflow_dir)
