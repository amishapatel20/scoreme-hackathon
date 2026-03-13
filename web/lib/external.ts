export class DependencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DependencyError";
  }
}

export class TransientDependencyError extends DependencyError {
  constructor(message: string) {
    super(message);
    this.name = "TransientDependencyError";
  }
}

export interface DependencyOutcome {
  outcome: string;
  message: string;
  reference: string;
}

export class ExternalDependencyGateway {
  evaluate(dependencyName: string, payload: Record<string, unknown>, attemptNumber: number): DependencyOutcome {
    if (dependencyName !== "fraud_service") {
      throw new DependencyError(`Unsupported dependency '${dependencyName}'.`);
    }

    const entityId = String(
      payload["applicant_id"] ??
        payload["claim_id"] ??
        payload["vendor_id"] ??
        payload["employee_id"] ??
        payload["document_id"] ??
        "unknown"
    );

    const dependencyMode = String(payload["dependency_mode"] ?? "pass");

    if (dependencyMode === "transient_error" && attemptNumber === 0) {
      throw new TransientDependencyError("Simulated transient dependency timeout from fraud_service.");
    }

    if (dependencyMode === "fail" || payload["fraud_flag"] === true) {
      return {
        outcome: "fail",
        message: "fraud_service flagged the request as suspicious.",
        reference: `fraud_service:${entityId}:fail`,
      };
    }

    return {
      outcome: "pass",
      message: "fraud_service cleared the request.",
      reference: `fraud_service:${entityId}:pass`,
    };
  }
}
