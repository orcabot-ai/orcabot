import { Dialog } from "./Dialog.js";
import { Select } from "./Select.js";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import Markdown from "react-markdown";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ClipboardList,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import type {
  BoardState,
  WorkDetail,
  State,
  DeliveryTask,
  WorkItem,
} from "orcabot-contracts";
import { api, friendly } from "./api.js";
import { useI18n } from "./i18n.js";

const eventLabels: Record<string, string> = {
  "work.created": "Task created",
  "task.claimed": "Execution reserved",
  "task.dispatched": "Execution started",
  "task.retry_requested": "Another attempt requested",
  "claim.expired": "Execution reservation expired",
  "claim.released": "Execution reservation released",
  "claim.renewed": "Execution reservation extended",
  "message.posted": "Message added",
  "execution.observed": "Execution updated",
  "evidence.submitted": "Delivery submitted for review",
  "review.approved": "Review approved",
  "review.rejected": "Changes requested",
};

function useCommand() {
  const client = useQueryClient(),
    pending = useRef(new Map<string, string>());
  return useMutation({
    mutationFn: async ({
      path,
      body,
    }: {
      path: string;
      body: Record<string, unknown>;
    }) => {
      const signature = JSON.stringify({ path, body });
      let commandId = pending.current.get(signature);
      if (!commandId) {
        commandId = crypto.randomUUID();
        pending.current.set(signature, commandId);
      }
      const result = await api<unknown>(path, { ...body, commandId });
      pending.current.delete(signature);
      return result;
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["board"] }),
        client.invalidateQueries({ queryKey: ["workAttention"] }),
        client.invalidateQueries({ queryKey: ["work"] }),
        client.invalidateQueries({ queryKey: ["state"] }),
      ]);
    },
  });
}
function ErrorText({ error }: { error: unknown }) {
  const { t } = useI18n();
  return error ? (
    <p role="alert" className="error-text">
      {t(friendly(error))}
    </p>
  ) : null;
}
export function Board({
  state,
  workId,
  onSetup,
}: {
  state: State;
  workId?: string;
  onSetup: () => void;
}) {
  const { t, locale } = useI18n(),
    navigate = useNavigate();
  const [before, setBefore] = useState<number | null>(null),
    [creating, setCreating] = useState(false);
  const query = useQuery({
    queryKey: ["board", before],
    queryFn: () =>
      api<BoardState>(`/board${before === null ? "" : `?before=${before}`}`),
  });
  if (workId) return <WorkDetailView key={workId} id={workId} />;
  return (
    <section className="board-page">
      <div className="board-heading">
        <div>
          <h1>{t("Tasks")}</h1>
          <p className="muted">{t("Goals, execution, and review.")}</p>
        </div>
        <button className="button primary" onClick={() => setCreating(true)}>
          <Plus size={16} />
          {t("New task")}
        </button>
      </div>
      <ErrorText error={query.error} />
      {query.isPending && <p>{t("Loading work…")}</p>}
      {creating && query.data && (
        <Dialog
          title={t("New task")}
          onClose={() => setCreating(false)}
          className="task-create-panel"
        >
          <div className="dialog-heading">
            <h2>{t("New task")}</h2>
            <button
              className="icon-button"
              aria-label={t("Close task creation")}
              onClick={() => setCreating(false)}
            >
              <X size={18} />
            </button>
          </div>
          {state.agents.length ? (
            <CreateWork
              state={state}
              board={query.data}
              onCancel={() => setCreating(false)}
              onCreated={async (work) => {
                setCreating(false);
                await navigate({
                  to: "/work/$workId",
                  params: { workId: work.id },
                });
              }}
            />
          ) : (
            <div className="task-setup-required">
              <p>{t("Create an agent before assigning work.")}</p>
              <div className="dialog-footer">
                <button className="button" onClick={() => setCreating(false)}>
                  {t("Cancel")}
                </button>
                <button
                  className="button primary"
                  onClick={() => {
                    setCreating(false);
                    onSetup();
                  }}
                >
                  {t("Connect your agents")}
                </button>
              </div>
            </div>
          )}
        </Dialog>
      )}
      {query.data?.items.length === 0 && !creating && (
        <div className="board-empty">
          <ClipboardList size={36} />
          <h2>{t("No tasks yet")}</h2>
          <p>
            {t(
              "Create a work item to define a goal and its acceptance criteria.",
            )}
          </p>
        </div>
      )}
      {query.data && query.data.items.length > 0 && (
        <div className="collection-heading">
          <span>
            {t("All work")}{" "}
            <span className="collection-count">{query.data.items.length}</span>
          </span>
          <span>{t("Status")}</span>
        </div>
      )}
      <div className="board-list">
        {query.data?.items.map((w) => (
          <button
            className="board-card work-row"
            key={w.id}
            onClick={() =>
              void navigate({ to: "/work/$workId", params: { workId: w.id } })
            }
          >
            <div>
              <strong>{w.title}</strong>
              <p>{w.goal}</p>
              <small className="work-row-time">
                {t("Updated")}{" "}
                {new Date(w.updatedAt).toLocaleDateString(
                  locale === "zh" ? "zh-CN" : "en-US",
                  { month: "short", day: "numeric" },
                )}
              </small>
            </div>
            <span className="board-stage" data-state={w.state}>
              <i aria-hidden="true" />
              {t(w.state)}
            </span>
            <ArrowUpRight size={17} />
          </button>
        ))}
      </div>
      <div className="flex gap-2 mt-5">
        {before !== null && (
          <button className="button" onClick={() => setBefore(null)}>
            {t("Latest items")}
          </button>
        )}
        {query.data?.nextBefore != null && (
          <button
            className="button"
            onClick={() => setBefore(query.data!.nextBefore)}
          >
            {t("Earlier items")}
          </button>
        )}
      </div>
    </section>
  );
}
function CreateWork({
  state,
  board,
  onCreated,
  onCancel,
}: {
  state: State;
  board: BoardState;
  onCreated: (w: WorkItem) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useI18n(),
    command = useCommand();
  const hasChannel = board.channels.some((channel) => !channel.archived);
  const form = useForm({
    defaultValues: {
      title: "",
      goal: "",
      criteria: "",
      agentId: state.agents[0].id,
      channelId: board.channels.find((c) => !c.archived)?.id ?? "",
      definition: `${board.definitions[0].workflow.id}@${board.definitions[0].workflow.version}`,
    },
    onSubmit: async ({ value }) => {
      const [definitionId, version] = value.definition.split("@");
      try {
        const result = await command.mutateAsync({
          path: "/board/work",
          body: {
            title: value.title,
            goal: value.goal,
            criteria: value.criteria
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
            agentId: value.agentId,
            channelId: value.channelId,
            definitionId,
            definitionVersion: Number(version),
          },
        });
        await onCreated(result as WorkItem);
      } catch {
        /* Preserve the brief for retry. */
      }
    },
  });
  return (
    <form
      className="board-form task-create-form"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <p className="muted">
        {t("Give Orca a goal and a clear way to know it is done.")}
      </p>
      <form.Field name="title">
        {(f) => (
          <label>
            {t("Title")}
            <input
              required
              maxLength={160}
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="goal">
        {(f) => (
          <label>
            {t("Goal")}
            <textarea
              required
              maxLength={16000}
              rows={3}
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="criteria">
        {(f) => (
          <label>
            {t("Acceptance criteria")}
            <textarea
              required
              maxLength={20000}
              rows={3}
              placeholder={t("One verifiable requirement per line")}
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
            <small>
              {t(
                "Every requirement must be confirmed when evidence is submitted.",
              )}
            </small>
          </label>
        )}
      </form.Field>
      <div>
        <form.Field name="agentId">
          {(f) => (
            <label>
              {t("Agent")}
              <Select
                value={f.state.value}
                onValueChange={(next) => f.handleChange(next)}
              >
                {state.agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </label>
          )}
        </form.Field>
      </div>
      <details className="advanced">
        <summary>{t("More options")}</summary>
        <form.Field name="channelId">
          {(f) => (
            <label>
              {t("Channel")}
              <Select
                required
                value={f.state.value}
                onValueChange={(next) => f.handleChange(next)}
              >
                {board.channels
                  .filter((c) => !c.archived)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.path}
                    </option>
                  ))}
              </Select>
            </label>
          )}
        </form.Field>
        <form.Field name="definition">
          {(f) => (
            <label>
              {t("Workflow")}
              <Select
                value={f.state.value}
                onValueChange={(next) => f.handleChange(next)}
              >
                {board.definitions.map((d) => (
                  <option
                    key={`${d.workflow.id}@${d.workflow.version}`}
                    value={`${d.workflow.id}@${d.workflow.version}`}
                  >
                    {d.workflow.id} · v{d.workflow.version}
                  </option>
                ))}
              </Select>
            </label>
          )}
        </form.Field>
      </details>
      {!hasChannel && (
        <p role="alert" className="notice">
          {t(
            "No active channels are available. Create or restore a channel before assigning a task.",
          )}
        </p>
      )}
      <ErrorText error={command.error} />
      <div className="dialog-footer">
        <button type="button" className="button" onClick={onCancel}>
          {t("Cancel")}
        </button>
        <button
          className="button primary"
          disabled={command.isPending || !hasChannel}
        >
          {t(command.isPending ? "Saving…" : "Create task")}
        </button>
      </div>
    </form>
  );
}
function WorkDetailView({ id }: { id: string }) {
  const { t, locale } = useI18n(),
    navigate = useNavigate();
  const [eventAfter, setEventAfter] = useState(0),
    [taskBefore, setTaskBefore] = useState<number | null>(null),
    [goalExpanded, setGoalExpanded] = useState(false);
  const query = useQuery({
    queryKey: ["work", id, eventAfter, taskBefore],
    queryFn: () =>
      api<WorkDetail>(
        `/board/work/${id}?after=${eventAfter}${taskBefore === null ? "" : `&beforeTasks=${taskBefore}`}`,
      ),
    refetchInterval: 5000,
  });
  const command = useCommand(),
    [claim, setClaim] = useState("");
  const task = query.data?.task;
  useEffect(() => {
    try {
      setClaim(
        task ? (sessionStorage.getItem(`orcabot.claim.${task.id}`) ?? "") : "",
      );
    } catch {
      setClaim("");
    }
  }, [task?.id]);
  const act = async (
    action: string,
    body: Record<string, unknown>,
    taskAction = false,
  ) => {
    try {
      const result = await command.mutateAsync({
        path: `/board/${taskAction ? "tasks/" + task!.id : "work/" + id}/${action}`,
        body,
      });
      if (action === "claim") {
        const token = (result as { claimToken: string }).claimToken;
        setClaim(token);
        try {
          sessionStorage.setItem(`orcabot.claim.${task!.id}`, token);
        } catch {
          /* Memory remains usable. */
        }
      }
      if (action === "dispatch" || action === "release") {
        setClaim("");
        try {
          sessionStorage.removeItem(`orcabot.claim.${task!.id}`);
        } catch {
          /* No persistent preference is required. */
        }
      }
    } catch {
      /* Show the request error. */
    }
  };
  if (!query.data)
    return (
      <section className="board-page">
        <ErrorText error={query.error} />
        <p>{t("Loading work…")}</p>
      </section>
    );
  const { work, definition, evidence, events, tasks } = query.data,
    terminal = definition.workflow.states.find(
      (s) => s.id === work.state,
    )?.terminal;
  const reviewing =
      !terminal && !definition.executionStates.includes(work.state),
    latest = evidence[0];
  return (
    <section className="board-page">
      <button
        className="text-button"
        onClick={() => void navigate({ to: "/work" })}
      >
        <ArrowLeft size={14} />
        {t("All tasks")}
      </button>
      <div className="board-heading mt-5">
        <div>
          <h1>{work.title}</h1>
          <p className="muted">
            {t(
              terminal
                ? "Accepted delivery"
                : reviewing
                  ? "Ready for your review"
                  : "A goal, a thread and a clear finish.",
            )}
          </p>
          <details className="work-workflow">
            <summary>{t("Workflow details")}</summary>
            <code>
              {definition.workflow.id} · v{definition.workflow.version}
            </code>
          </details>
        </div>
        <span className="board-stage" data-state={work.state}>
          <i aria-hidden="true" />
          {t(work.state)}
        </span>
      </div>
      <ErrorText error={query.error} />
      <ErrorText error={command.error} />
      <div className="work-layout">
        <aside className="work-context" aria-label={t("Task details")}>
          <article className="board-card">
            <h2>{t("Goal")}</h2>
            <p
              className={`board-prose${work.goal.length > 420 ? " work-goal" + (goalExpanded ? " expanded" : "") : ""}`}
            >
              {work.goal}
            </p>
            {work.goal.length > 420 && (
              <button
                className="text-button work-goal-toggle"
                aria-expanded={goalExpanded}
                onClick={() => setGoalExpanded(!goalExpanded)}
              >
                {t(goalExpanded ? "Show less" : "Read full goal")}
              </button>
            )}
            <h3>{t("Acceptance criteria")}</h3>
            <ul>
              {work.criteria.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </article>
          {task && (
            <article className="board-card">
              <div className="board-heading">
                <div>
                  <h2>{t("Current task")}</h2>
                  <p className="muted">{t(task.status)}</p>
                  <details className="event-technical">
                    <summary>{t("Execution details")}</summary>
                    <p>
                      {t(task.stage)} · {t("Claim generation")}{" "}
                      {task.generation}
                    </p>
                  </details>
                </div>
                {terminal && <Check size={24} />}
              </div>
              {task.leaseUntil && (
                <p className="muted">
                  {t("Claim expires")}{" "}
                  {new Date(task.leaseUntil).toLocaleTimeString(
                    locale === "zh" ? "zh-CN" : "en-US",
                  )}
                </p>
              )}
              <div className="flex gap-2 flex-wrap mt-4">
                {!terminal && task.status === "ready" && (
                  <button
                    className="button primary"
                    disabled={command.isPending}
                    onClick={() =>
                      void act(
                        "claim",
                        { expectedRevision: task.revision },
                        true,
                      )
                    }
                  >
                    {t("Claim task")}
                  </button>
                )}
                {task.status === "claimed" && claim && (
                  <>
                    <button
                      className="button primary"
                      disabled={command.isPending}
                      onClick={() =>
                        void act(
                          "dispatch",
                          {
                            expectedRevision: task.revision,
                            claimToken: claim,
                          },
                          true,
                        )
                      }
                    >
                      {t("Start execution")}
                    </button>
                    <button
                      className="button"
                      disabled={command.isPending}
                      onClick={() =>
                        void act(
                          "renew",
                          {
                            expectedRevision: task.revision,
                            claimToken: claim,
                          },
                          true,
                        )
                      }
                    >
                      {t("Renew claim")}
                    </button>
                    <button
                      className="button"
                      disabled={command.isPending}
                      onClick={() =>
                        void act(
                          "release",
                          {
                            expectedRevision: task.revision,
                            claimToken: claim,
                          },
                          true,
                        )
                      }
                    >
                      {t("Release claim")}
                    </button>
                  </>
                )}
                {task.status === "claimed" && !claim && (
                  <p className="muted">
                    {t(
                      "This task is claimed in another session. Wait for release or expiry.",
                    )}
                  </p>
                )}
                {task.status === "failed" && (
                  <button
                    className="button"
                    disabled={command.isPending}
                    onClick={() =>
                      void act("retry", { expectedRevision: work.revision })
                    }
                  >
                    {t("Create another attempt")}
                  </button>
                )}
                {task.conversationId && (
                  <button
                    className="button"
                    onClick={() =>
                      void navigate({
                        to: "/conversations/$conversationId",
                        params: { conversationId: task.conversationId! },
                      })
                    }
                  >
                    {t("Open execution")}
                    <ArrowUpRight size={14} />
                  </button>
                )}
              </div>
              {task.status === "unknown" && (
                <p className="notice mt-4">
                  {t(
                    "Execution outcome is unknown. Recover the original run before creating replacement work.",
                  )}
                </p>
              )}
              <p className="muted mt-4">
                {t("Execution completion does not accept this work item.")}
              </p>
            </article>
          )}
        </aside>
        <div className="work-main">
          {task?.status === "completed" &&
            definition.executionStates.includes(work.state) && (
              <EvidenceForm key={task.id} detail={query.data} />
            )}
          {latest && (
            <article className="board-card">
              <h2>{t("Submitted evidence")}</h2>
              <div className="markdown">
                <Markdown>{latest.content}</Markdown>
              </div>
              <details className="evidence-metadata">
                <summary>{t("Evidence details")}</summary>
                <code className="board-digest">SHA-256 {latest.sha256}</code>
                <p className="muted">
                  {t(
                    "The digest identifies this submitted text. External files and URLs are not verified.",
                  )}
                </p>
              </details>
            </article>
          )}
          {reviewing && latest && (
            <ReviewForm key={latest.id} detail={query.data} />
          )}
          <article className="board-card">
            <h2>{t("Activity")}</h2>
            <div className="work-events">
              {events.map((e) => (
                <div key={e.seq} className="work-event">
                  <small>
                    {e.actor === "operator" ? t("Operator") : t("Assistant")} ·{" "}
                    {new Date(e.createdAt).toLocaleString(
                      locale === "zh" ? "zh-CN" : "en-US",
                    )}
                  </small>
                  <strong>
                    {t(eventLabels[e.type] ?? "Activity recorded")}
                    {e.type === "execution.observed" &&
                    typeof e.data.status === "string"
                      ? " · " + t(e.data.status)
                      : ""}
                  </strong>
                  <details className="event-technical">
                    <summary>{t("Technical details")}</summary>
                    <code>
                      {e.type} · #{e.seq}
                    </code>
                  </details>
                  {typeof e.data.text === "string" && (
                    <div className="markdown">
                      <Markdown>{e.data.text}</Markdown>
                    </div>
                  )}
                  {typeof e.data.note === "string" && <p>{e.data.note}</p>}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              {eventAfter > 0 && (
                <button className="button" onClick={() => setEventAfter(0)}>
                  {t("Start of thread")}
                </button>
              )}
              {query.data.nextEventAfter !== null && (
                <button
                  className="button"
                  onClick={() => setEventAfter(query.data!.nextEventAfter!)}
                >
                  {t("More activity")}
                </button>
              )}
            </div>
            <MessageForm workId={id} />
          </article>
          <article className="board-card">
            <h2>{t("Execution attempts")}</h2>
            {tasks.map((attempt) => (
              <div className="board-attempt" key={attempt.id}>
                <span>
                  {t(attempt.stage)} · {t(attempt.status)}
                </span>
                {attempt.conversationId && (
                  <button
                    className="text-button"
                    onClick={() =>
                      void navigate({
                        to: "/conversations/$conversationId",
                        params: { conversationId: attempt.conversationId! },
                      })
                    }
                  >
                    {t("Open execution")}
                  </button>
                )}
              </div>
            ))}
            <div className="flex gap-2 mt-4">
              {taskBefore !== null && (
                <button className="button" onClick={() => setTaskBefore(null)}>
                  {t("Latest items")}
                </button>
              )}
              {query.data.nextBefore !== null && (
                <button
                  className="button"
                  onClick={() => setTaskBefore(query.data!.nextBefore)}
                >
                  {t("Earlier items")}
                </button>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
function EvidenceForm({ detail }: { detail: WorkDetail }) {
  const { t } = useI18n(),
    command = useCommand();
  const form = useForm({
    defaultValues: {
      content: "",
      checks: detail.work.criteria.map(() => false),
    },
    onSubmit: async ({ value }) => {
      try {
        await command.mutateAsync({
          path: `/board/work/${detail.work.id}/evidence`,
          body: {
            ...value,
            taskId: detail.task.id,
            expectedRevision: detail.work.revision,
          },
        });
      } catch {
        /* Retain the submission. */
      }
    },
  });
  return (
    <form
      className="board-card board-form"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <h2>{t("Submit for review")}</h2>
      <form.Field name="content">
        {(f) => (
          <label>
            {t("Deliverable (Markdown)")}
            <textarea
              required
              rows={7}
              maxLength={32000}
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="checks">
        {(f) => (
          <div className="board-checks">
            {detail.work.criteria.map((c, i) => (
              <label key={i}>
                <input
                  type="checkbox"
                  checked={f.state.value[i]}
                  onChange={(e) =>
                    f.handleChange(
                      f.state.value.map((v, n) =>
                        n === i ? e.target.checked : v,
                      ),
                    )
                  }
                />
                <span>{c}</span>
              </label>
            ))}
          </div>
        )}
      </form.Field>
      <p className="muted">
        {t(
          "Confirm each requirement. A human will review this exact submission.",
        )}
      </p>
      <ErrorText error={command.error} />
      <form.Subscribe selector={(s) => s.values}>
        {(values) => (
          <button
            className="button primary mt-4"
            disabled={
              command.isPending ||
              !values.content.trim() ||
              !values.checks.every(Boolean)
            }
          >
            {t("Submit evidence")}
          </button>
        )}
      </form.Subscribe>
    </form>
  );
}
function ReviewForm({ detail }: { detail: WorkDetail }) {
  const { t } = useI18n(),
    command = useCommand(),
    [decision, setDecision] = useState<"approve" | "reject">("approve");
  const form = useForm({
    defaultValues: { note: "" },
    onSubmit: async ({ value }) => {
      try {
        await command.mutateAsync({
          path: `/board/work/${detail.work.id}/review`,
          body: {
            ...value,
            decision,
            evidenceId: detail.evidence[0].id,
            expectedRevision: detail.work.revision,
          },
        });
      } catch {
        /* Keep the review note for reconciliation. */
      }
    },
  });
  return (
    <form
      className="board-card board-form"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <h2>{t("Human acceptance")}</h2>
      <p className="muted">
        {t(
          "You are acting as the trusted operator. Confirm the evidence meets every requirement.",
        )}
      </p>
      <label>
        {t("Decision")}
        <Select
          value={decision}
          onValueChange={(next) =>
            setDecision(next === "reject" ? "reject" : "approve")
          }
        >
          <option value="approve">{t("Approve result")}</option>
          <option value="reject">{t("Request changes")}</option>
        </Select>
      </label>
      <form.Field name="note">
        {(f) => (
          <label>
            {t("Review note")}
            <textarea
              required
              maxLength={4000}
              rows={3}
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          </label>
        )}
      </form.Field>
      <ErrorText error={command.error} />
      <button className="button primary" disabled={command.isPending}>
        {t("Record decision")}
      </button>
    </form>
  );
}
function MessageForm({ workId }: { workId: string }) {
  const { t } = useI18n(),
    command = useCommand();
  const form = useForm({
    defaultValues: { text: "" },
    onSubmit: async ({ value }) => {
      try {
        await command.mutateAsync({
          path: `/board/work/${workId}/messages`,
          body: value,
        });
        form.reset();
      } catch {
        /* Preserve the message. */
      }
    },
  });
  return (
    <form
      className="board-message-form"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="text">
        {(f) => (
          <label>
            {t("Add context")}
            <textarea
              required
              rows={2}
              maxLength={16000}
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          </label>
        )}
      </form.Field>
      <ErrorText error={command.error} />
      <button className="button" disabled={command.isPending}>
        {t("Post message")}
      </button>
    </form>
  );
}
