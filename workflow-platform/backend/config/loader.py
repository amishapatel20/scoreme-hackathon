from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

RuleType = Literal["mandatory", "threshold", "conditional"]
OperatorType = Literal["eq", "neq", "gt", "gte", "lt", "lte", "contains", "regex"]
ActionOnFail = Literal["reject", "flag_review", "retry", "warn"]
StageType = Literal["auto", "manual", "external"]


class PayloadField(BaseModel):
    name: str
    type: Literal["string", "number", "integer", "boolean"] = "string"
    required: bool = True
    label: str | None = None
    helper_text: str | None = None


class RuleConfig(BaseModel):
    rule_id: str | None = None
    type: RuleType
    field: str
    operator: OperatorType
    value: Any
    action_on_fail: ActionOnFail = "reject"
    explanation: str


class StageConfig(BaseModel):
    name: str
    type: StageType
    on_success: str | None = None
    on_failure: str | None = None
    on_retry: str | None = None
    external_dependency: str | None = None
    rules: list[RuleConfig] = Field(default_factory=list)


class RetryPolicy(BaseModel):
    max_attempts: int = 3
    backoff_seconds: float = 1.0
    backoff_multiplier: float = 2.0

    @field_validator("max_attempts")
    @classmethod
    def max_attempts_must_be_positive(cls, value: int) -> int:
        if value < 1:
            raise ValueError("max_attempts must be >= 1")
        return value


class ExternalDependency(BaseModel):
    name: str
    simulate_failure_rate: float = 0.0

    @field_validator("simulate_failure_rate")
    @classmethod
    def failure_rate_range(cls, value: float) -> float:
        if not 0.0 <= value <= 1.0:
            raise ValueError("simulate_failure_rate must be between 0.0 and 1.0")
        return value


class WorkflowConfig(BaseModel):
    workflow_id: str
    name: str
    description: str = ""
    version: str = "1.0"
    payload_schema: list[PayloadField] = Field(default_factory=list)
    stages: list[StageConfig]
    retry_policy: RetryPolicy = Field(default_factory=RetryPolicy)
    external_dependency: ExternalDependency | None = None

    @model_validator(mode="after")
    def ensure_unique_stage_names(self) -> "WorkflowConfig":
        names = [stage.name for stage in self.stages]
        if len(set(names)) != len(names):
            raise ValueError("Stage names must be unique")
        return self


class WorkflowConfigLoader:
    def __init__(self, workflows_dir: str | Path):
        self.workflows_dir = Path(workflows_dir)
        self.workflows_dir.mkdir(parents=True, exist_ok=True)

    def list_workflows(self) -> list[WorkflowConfig]:
        configs: list[WorkflowConfig] = []
        for file in sorted(self.workflows_dir.glob("*.yaml")):
            configs.append(self.load(file.stem))
        return configs

    def load(self, workflow_id: str) -> WorkflowConfig:
        path = self.workflows_dir / f"{workflow_id}.yaml"
        if not path.exists():
            raise FileNotFoundError(f"Workflow config not found for '{workflow_id}'")

        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError(f"Workflow file '{path.name}' is invalid")

        try:
            return WorkflowConfig.model_validate(data)
        except ValidationError as exc:
            raise ValueError(f"Workflow config '{workflow_id}' is invalid: {exc}") from exc

    def save(self, workflow_id: str, yaml_content: str) -> WorkflowConfig:
        data = yaml.safe_load(yaml_content)
        if not isinstance(data, dict):
            raise ValueError("Workflow YAML must be an object")

        config = WorkflowConfig.model_validate(data)
        if config.workflow_id != workflow_id:
            raise ValueError("workflow_id in body must match path workflow_id")

        path = self.workflows_dir / f"{workflow_id}.yaml"
        path.write_text(yaml.safe_dump(config.model_dump(mode="json"), sort_keys=False), encoding="utf-8")
        return config

    def create(self, yaml_content: str) -> WorkflowConfig:
        data = yaml.safe_load(yaml_content)
        if not isinstance(data, dict):
            raise ValueError("Workflow YAML must be an object")
        config = WorkflowConfig.model_validate(data)
        path = self.workflows_dir / f"{config.workflow_id}.yaml"
        if path.exists():
            raise ValueError(f"Workflow '{config.workflow_id}' already exists")
        path.write_text(yaml.safe_dump(config.model_dump(mode="json"), sort_keys=False), encoding="utf-8")
        return config

    def delete(self, workflow_id: str) -> None:
        path = self.workflows_dir / f"{workflow_id}.yaml"
        if not path.exists():
            raise FileNotFoundError(f"Workflow config not found for '{workflow_id}'")
        path.unlink()

    def dry_run(self, workflow_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        config = self.load(workflow_id)
        required_fields = [f.name for f in config.payload_schema if f.required]
        missing = [field for field in required_fields if field not in payload or payload.get(field) in (None, "")]
        return {
            "workflow_id": config.workflow_id,
            "required_fields": required_fields,
            "missing_fields": missing,
            "would_process": len(missing) == 0,
            "stages": [stage.name for stage in config.stages],
        }
