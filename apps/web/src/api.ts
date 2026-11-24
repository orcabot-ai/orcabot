export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const r = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = await r.json();
  if (!r.ok)
    throw new ApiError(r.status, String(value.error ?? "Request failed"));
  return value as T;
}
export function friendly(error: unknown): string {
  if (!(error instanceof Error))
    return "Something went wrong. Please try again.";
  const messages: Record<string, string> = {
    STALE_WORK_REVISION:
      "This item changed. Refresh it and review the latest state before trying again.",
    CLAIM_LOST:
      "Your claim expired or was released. Refresh and claim the task again.",
    TASK_NOT_READY:
      "This task is already claimed or has unresolved execution. Refresh its status.",
    TASK_SUPERSEDED: "A newer attempt exists. Open the latest task.",
    CHANNEL_ARCHIVED:
      "This channel is archived. New work and execution are disabled.",
    EVIDENCE_NOT_ALLOWED:
      "Wait for a completed execution before submitting evidence for this stage.",
    CRITERIA_NOT_CONFIRMED:
      "Confirm every acceptance requirement before submitting evidence.",
    STALE_EVIDENCE:
      "A different evidence submission is current. Review the latest content.",
    WORKFLOW_TRANSITION_NOT_ALLOWED:
      "This action is not allowed in the current workflow stage.",
    TASK_RETRY_NOT_ALLOWED:
      "Only a known failed execution can create another attempt. Recover unknown work first.",
    IDEMPOTENCY_CONFLICT:
      "This command ID was already used for different input. Start a new action.",
    WORKFLOW_VERSION_EXISTS:
      "This workflow version already exists. Create a new version.",

    UNAUTHORIZED: "Your session has expired. Reload to unlock the workbench.",
    CONVERSATION_BUSY_OR_UNRESOLVED:
      "This conversation already has active or unresolved work. Start a new conversation for independent work.",
    INVALID_AGENT_ENV:
      "The Runtime rejected this Agent configuration. Check the adapter, model and MCP settings.",
    INVALID_REQUEST: "Check the form values and try again.",
    RUN_NOT_CONTROLLABLE: "This run can no longer accept controls.",
    RECOVERY_IDENTITY_UNAVAILABLE:
      "This execution has no saved Runtime identity. Investigate its host before starting replacement work.",
    RUN_NOT_RECOVERABLE: "Only an unknown outcome can resume observation.",
    STALE_RUN_REVISION:
      "New execution events arrived. Refresh this item before acknowledging it.",
    RUN_REVIEW_NOT_ALLOWED:
      "Respond to pending interactions in the conversation. Active work cannot be acknowledged away.",
    EXECUTION_CAPACITY_REACHED:
      "All execution slots are busy. Please try again shortly.",
  };
  return (
    messages[error.message] ?? error.message.replaceAll("_", " ").toLowerCase()
  );
}
