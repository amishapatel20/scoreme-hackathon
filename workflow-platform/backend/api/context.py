from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.orm import sessionmaker

from config.loader import WorkflowConfigLoader
from core.engine import WorkflowEngine


@dataclass
class AppContext:
    session_factory: sessionmaker
    workflow_loader: WorkflowConfigLoader
    engine: WorkflowEngine
    workflow_dir: Path
