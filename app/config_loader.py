from __future__ import annotations

from pathlib import Path

import yaml

from app.models import WorkflowConfig, WorkflowSummary


class WorkflowNotFoundError(FileNotFoundError):
    pass


class WorkflowConfigLoader:
    def __init__(self, workflow_dir: Path) -> None:
        self.workflow_dir = workflow_dir

    def load(self, workflow_name: str) -> WorkflowConfig:
        path = self.workflow_dir / f"{workflow_name}.yaml"
        if not path.exists():
            raise WorkflowNotFoundError(f"Workflow '{workflow_name}' was not found.")
        with path.open("r", encoding="utf-8") as handle:
            raw_config = yaml.safe_load(handle)
        return WorkflowConfig.model_validate(raw_config)

    def list_workflows(self) -> list[WorkflowSummary]:
        workflows: list[WorkflowSummary] = []
        for path in sorted(self.workflow_dir.glob("*.yaml")):
            with path.open("r", encoding="utf-8") as handle:
                raw_config = yaml.safe_load(handle)
            config = WorkflowConfig.model_validate(raw_config)
            workflows.append(
                WorkflowSummary(
                    name=config.name,
                    version=config.version,
                    description=config.description,
                )
            )
        return workflows
