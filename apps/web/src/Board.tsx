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
  const { t } = useI18n(),
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
          <div className="eyebrow">{t("DELIVER WORK")}</div>
          <h1>{t("Work items")}</h1>
          <p className="muted">
            {t("Give your agents a goal. Review the result, not every step.")}
          </p>
        </div>
        <button
          className="button primary"
          onClick={() => setCreating(!creating)}
        >
          <Plus size={16} />
          {t("New work item")}
        </button>
      </div>
      <ErrorText error={query.error} />
      {query.isPending && <p>{t("Loading work…")}</p>}
      {creating &&
        query.data &&
        (state.agents.length ? (
          <CreateWork
            state={state}
            board={query.data}
            onCreated={async (work) => {
              setCreating(false);
              await navigate({
                to: "/work/$workId",
                params: { workId: work.id },
              });
            }}
          />
        ) : (
          <div className="board-card">
            <p>{t("Create an agent before assigning work.")}</p>
            <button className="button mt-4" onClick={onSetup}>
              {t("Connect your agents")}
            </button>
          </div>
        ))}
      {query.data?.items.length === 0 && !creating && (
        <div className="board-empty">
          <ClipboardList size={36} />
          <h2>{t("A clear goal. A reviewed result.")}</h2>
          <p>
            {t(
              "Create a work item with acceptance criteria to start your first delivery.",
            )}
          </p>
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
            </div>
            <span className="board-stage">{t(w.state)}</span>
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
}: {
  state: State;
  board: BoardState;
  onCreated: (w: WorkItem) => Promise<void>;
}) {
  const { t } = useI18n(),
    command = useCommand();
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
      className="board-card board-form"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <h2>{t("Define the outcome")}</h2>
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
      <div className="field-grid">
        <form.Field name="agentId">
          {(f) => (
            <label>
              {t("Agent")}
              <select
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
              >
                {state.agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </form.Field>
        <form.Field name="channelId">
          {(f) => (
            <label>
              {t("Channel")}
              <select
                required
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
              >
                {board.channels
                  .filter((c) => !c.archived)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.path}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </form.Field>
      </div>
      <form.Field name="definition">
        {(f) => (
          <label>
            {t("Workflow")}
            <select
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            >
              {board.definitions.map((d) => (
                <option
                  key={`${d.workflow.id}@${d.workflow.version}`}
                  value={`${d.workflow.id}@${d.workflow.version}`}
                >
                  {d.workflow.id} · v{d.workflow.version}
                </option>
              ))}
            </select>
          </label>
        )}
      </form.Field>
      <ErrorText error={command.error} />
      <button className="button primary" disabled={command.isPending}>
        {t(command.isPending ? "Saving…" : "Create work item")}
      </button>
    </form>
  );
}
function WorkDetailView({ id }: { id: string }) {
  const { t, locale } = useI18n(),
    navigate = useNavigate();
  const [eventAfter, setEventAfter] = useState(0),
    [taskBefore, setTaskBefore] = useState<number | null>(null);
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
        {t("All work items")}
      </button>
      <div className="board-heading mt-5">
        <div>
          <div className="eyebrow">{t("BUSINESS OUTCOME")}</div>
          <h1>{work.title}</h1>
          <p className="muted">
            {definition.workflow.id} · v{definition.workflow.version}
          </p>
        </div>
        <span className="board-stage">{t(work.state)}</span>
      </div>
      <ErrorText error={query.error} />
      <ErrorText error={command.error} />
      <article className="board-card">
        <h2>{t("Goal")}</h2>
        <p className="board-prose">{work.goal}</p>
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
              <p className="muted">
                {t(task.stage)} · {t(task.status)} · {t("Claim generation")}{" "}
                {task.generation}
              </p>
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
                  void act("claim", { expectedRevision: task.revision }, true)
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
                      { expectedRevision: task.revision, claimToken: claim },
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
                      { expectedRevision: task.revision, claimToken: claim },
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
                      { expectedRevision: task.revision, claimToken: claim },
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
          <code className="board-digest">SHA-256 {latest.sha256}</code>
          <p className="muted">
            {t(
              "The digest identifies this submitted text. External files and URLs are not verified.",
            )}
          </p>
        </article>
      )}
      {reviewing && latest && (
        <ReviewForm key={latest.id} detail={query.data} />
      )}
      <article className="board-card">
        <h2>{t("Shared thread")}</h2>
        <div className="work-events">
          {events.map((e) => (
            <div key={e.seq} className="work-event">
              <small>
                {e.actor === "operator" ? t("Operator") : "Runtime"} ·{" "}
                {new Date(e.createdAt).toLocaleString(
                  locale === "zh" ? "zh-CN" : "en-US",
                )}
              </small>
              <strong>{t(e.type)}</strong>
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
        <select
          value={decision}
          onChange={(e) =>
            setDecision(e.target.value === "reject" ? "reject" : "approve")
          }
        >
          <option value="approve">{t("Approve result")}</option>
          <option value="reject">{t("Request changes")}</option>
        </select>
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
