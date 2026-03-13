import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import type { WorkflowConfig, WorkflowSummary } from "./types";

export class WorkflowNotFoundError extends Error {
  constructor(workflowName: string) {
    super(`Workflow '${workflowName}' was not found.`);
    this.name = "WorkflowNotFoundError";
  }
}

export function getWorkflowDir(): string {
  return process.env.WORKFLOW_DIR?.trim() || path.join(process.cwd(), "workflows");
}

export function loadWorkflow(workflowName: string): WorkflowConfig {
  const workflowDir = getWorkflowDir();
  const filePath = path.join(workflowDir, `${workflowName}.yaml`);
  if (!fs.existsSync(filePath)) {
    throw new WorkflowNotFoundError(workflowName);
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = YAML.parse(raw) as WorkflowConfig;
  return parsed;
}

export function listWorkflows(): WorkflowSummary[] {
  const workflowDir = getWorkflowDir();
  if (!fs.existsSync(workflowDir)) {
    return [];
  }

  const files = fs
    .readdirSync(workflowDir)
    .filter((name) => name.endsWith(".yaml"))
    .sort((a, b) => a.localeCompare(b));

  return files.map((fileName) => {
    const raw = fs.readFileSync(path.join(workflowDir, fileName), "utf-8");
    const parsed = YAML.parse(raw) as WorkflowConfig;
    return {
      name: parsed.name,
      version: parsed.version,
      description: parsed.description,
    };
  });
}
