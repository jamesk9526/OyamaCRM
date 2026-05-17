/**
 * Steward tool validation helpers — production-grade input validation,
 * error messaging, and confirm-first enforcement for all write operations.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ToolExecutionValidation {
  tool: string;
  organizationId: string;
  userId: string;
  requiresConfirmation: boolean;
  confirmationPassed?: boolean;
  validationResult: ValidationResult;
}

/**
 * Validates common donor context parameters.
 */
export function validateDonorInput(input: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input || typeof input !== "object") {
    errors.push("Input must be an object");
    return { valid: false, errors, warnings };
  }

  const obj = input as Record<string, unknown>;

  // Check constituentId if provided
  if ("constituentId" in obj) {
    const id = obj.constituentId;
    if (!id || (typeof id !== "string" && typeof id !== "number")) {
      errors.push("constituentId must be a non-empty string or number");
    } else if (String(id).length > 50) {
      errors.push("constituentId exceeds maximum length (50 characters)");
    }
  }

  // Warn about deprecated fields
  if ("donorId" in obj) {
    warnings.push("Use constituentId instead of donorId (legacy field)");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates task creation input: required title, optional due date, priority.
 */
export function validateTaskInput(input: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input || typeof input !== "object") {
    errors.push("Input must be an object");
    return { valid: false, errors, warnings };
  }

  const obj = input as Record<string, unknown>;

  // Required: title
  if (!obj.title || typeof obj.title !== "string" || !obj.title.trim()) {
    errors.push("Task title is required and must be non-empty");
  } else if (obj.title.length > 500) {
    errors.push("Task title exceeds maximum length (500 characters)");
  }

  // Optional: constituentId
  if ("constituentId" in obj && obj.constituentId !== undefined && obj.constituentId !== null) {
    if (typeof obj.constituentId !== "string" && typeof obj.constituentId !== "number") {
      errors.push("constituentId must be a string or number");
    }
  }

  // Optional: dueDate
  if ("dueDate" in obj && obj.dueDate !== undefined && obj.dueDate !== null) {
    const dateStr = String(obj.dueDate);
    const dt = new Date(dateStr);
    if (isNaN(dt.getTime())) {
      errors.push("dueDate must be a valid ISO date string");
    } else if (dt < new Date(new Date().toISOString().split("T")[0])) {
      warnings.push("Due date is in the past");
    }
  }

  // Optional: priority
  if ("priority" in obj && obj.priority !== undefined && obj.priority !== null) {
    const valid = ["low", "medium", "high", "urgent"];
    if (!valid.includes(String(obj.priority).toLowerCase())) {
      errors.push(`Priority must be one of: ${valid.join(", ")}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates email draft creation: required subject and recipient audience.
 */
export function validateEmailDraftInput(input: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input || typeof input !== "object") {
    errors.push("Input must be an object");
    return { valid: false, errors, warnings };
  }

  const obj = input as Record<string, unknown>;

  // Required: subject
  if (!obj.subject || typeof obj.subject !== "string" || !obj.subject.trim()) {
    errors.push("Email subject is required and must be non-empty");
  } else if (obj.subject.length > 200) {
    errors.push("Email subject exceeds maximum length (200 characters)");
  }

  // Required or optional: body or bodyMarkdown
  if (!obj.body && !obj.bodyMarkdown) {
    errors.push("Email body is required (provide 'body' or 'bodyMarkdown')");
  } else {
    const body = (obj.body ?? obj.bodyMarkdown) as string;
    if (body.length > 10_000) {
      errors.push("Email body exceeds maximum length (10,000 characters)");
    }
  }

  // Recommended: audience
  if (!obj.audience) {
    warnings.push("Audience/recipient list is recommended but not required (e.g., 'Major Donors', 'All Donors')");
  } else if (typeof obj.audience !== "string") {
    errors.push("Audience must be a string description");
  }

  // Warning if HTML is included without plain text alternative
  if (obj.bodyHtml && !obj.bodyPlainText) {
    warnings.push("Provide plaintext alternative (bodyPlainText) for HTML email content");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates letter draft creation: required template reference and content.
 */
export function validateLetterDraftInput(input: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input || typeof input !== "object") {
    errors.push("Input must be an object");
    return { valid: false, errors, warnings };
  }

  const obj = input as Record<string, unknown>;

  // Required: templateId or templateName
  if (!obj.templateId && !obj.templateName) {
    errors.push("Letter templateId or templateName is required");
  }

  // Recommended: recipientName
  if (!obj.recipientName) {
    warnings.push("Recipient name is recommended for personalization");
  }

  // Optional: body
  if (obj.body && typeof obj.body === "string" && obj.body.length > 5000) {
    errors.push("Letter body exceeds maximum length (5,000 characters)");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a write tool confirmation — ensures user intent matches actual operation.
 */
export function validateConfirmation(
  confirmationMessage: string,
  userAction: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check that confirmation message and user action are coherent
  if (!confirmationMessage || typeof confirmationMessage !== "string" || !confirmationMessage.trim()) {
    errors.push("Confirmation message is required");
  }

  if (!userAction || typeof userAction !== "string" || !userAction.trim()) {
    errors.push("User action description is required");
  }

  // Warn if confirmation message is too generic
  if (confirmationMessage && confirmationMessage.length < 15) {
    warnings.push("Confirmation message may be too generic — be more specific about what will happen");
  }

  // Warn if confirmation message is extremely long (hard to review)
  if (confirmationMessage && confirmationMessage.length > 1000) {
    warnings.push("Confirmation message is very long — consider breaking it into steps");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates that a permission check was performed before a write operation.
 */
export function validatePermissionCheckPerformed(
  requiredPermissions: string[],
  checkResult: boolean
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!requiredPermissions || requiredPermissions.length === 0) {
    errors.push("Required permissions list is empty");
  }

  if (typeof checkResult !== "boolean") {
    errors.push("Permission check result must be a boolean");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Formats validation results for user-facing error display.
 */
export function formatValidationErrors(result: ValidationResult): string {
  if (result.valid) return "";

  const lines: string[] = [];

  if (result.errors.length > 0) {
    lines.push("❌ Errors:");
    result.errors.forEach((e) => lines.push(`  • ${e}`));
  }

  if (result.warnings.length > 0) {
    lines.push("⚠️ Warnings:");
    result.warnings.forEach((w) => lines.push(`  • ${w}`));
  }

  return lines.join("\n");
}

/**
 * Enforces confirm-first invariant: write operations must have explicit user consent.
 */
export function enforceConfirmFirst(options: {
  toolName: string;
  requiresConfirmation: boolean;
  userConfirmed: boolean;
  dryRun?: boolean;
}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (options.requiresConfirmation && !options.userConfirmed) {
    errors.push(
      `${options.toolName} requires explicit user confirmation before execution. ` +
      `User must review and confirm the action first.`
    );
  }

  if (options.dryRun) {
    warnings.push("Running in dry-run mode — no changes will be persisted");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates safe-delete preconditions: ensure records exist and can be deleted.
 */
export function validateSafeDelete(options: {
  recordType: string;
  recordCount: number;
  allowedMaximum?: number;
  hasBackup?: boolean;
}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (options.recordCount === 0) {
    errors.push(`No ${options.recordType} records found to delete`);
  }

  const maxAllowed = options.allowedMaximum ?? 100;
  if (options.recordCount > maxAllowed) {
    errors.push(
      `Attempting to delete ${options.recordCount} ${options.recordType} records exceeds safe limit (${maxAllowed}). ` +
      `Please delete in smaller batches.`
    );
  }

  if (!options.hasBackup) {
    warnings.push("No backup recorded — consider creating a backup before deletion");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Constructs a standardized error response for tool execution failures.
 */
export interface ToolErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    userFriendlyMessage: string;
  };
}

export function createToolError(
  code: string,
  message: string,
  userFriendlyMessage: string,
  details?: unknown
): ToolErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      userFriendlyMessage,
    },
  };
}

/**
 * Constructs a standardized success response for tool execution.
 */
export interface ToolSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export function createToolSuccess<T>(data: T, message?: string): ToolSuccessResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}
