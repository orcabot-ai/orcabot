import { useState, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Folder, Clock, X, ArrowRight, Pause, Play } from "lucide-react";
import type { State, Project, Routine, Conversation } from "orcabot-contracts";
import { api, friendly } from "./api.js";
import { Dialog } from "./Dialog.js";
import { useI18n } from "./i18n.js";
export function Automation({
  state,
  mode,
}: {
  state: State;
  mode: "projects" | "routines";
}) {
  const { t } = useI18n(),
    client = useQueryClient(),
    navigate = useNavigate();
  const [creating, setCreating] = useState(false),
    [error, setError] = useState(""),
    [editing, setEditing] = useState<Conversation | null>(null);
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<{ items: Project[] }>("/projects"),
  });
  const routines = useQuery({
    queryKey: ["routines"],
    queryFn: () => api<{ items: Routine[] }>("/routines"),
    refetchInterval: 5000,
  });
  const threadCommand = useRef<{ projectId: string; id: string } | undefined>(
    undefined,
  );
  const [threadPending, setThreadPending] = useState(false);
  const pending = useRef<{ key: string; id: string } | undefined>(undefined);
  const action = useMutation({
    mutationFn: async ({
      path,
      body,
    }: {
      path: string;
      body: Record<string, unknown>;
    }) => {
      const key = JSON.stringify({ path, body });
      if (pending.current?.key !== key)
        pending.current = { key, id: crypto.randomUUID() };
      return api(path, { ...body, commandId: pending.current.id });
    },
    onSuccess: async () => {
      pending.current = undefined;
      await Promise.all([
        client.invalidateQueries({ queryKey: ["routines"] }),
        client.invalidateQueries({ queryKey: ["projects"] }),
        client.invalidateQueries({ queryKey: ["state"] }),
      ]);
      setError("");
    },
  });
  async function perform(path: string, body: Record<string, unknown>) {
    try {
      await action.mutateAsync({ path, body });
      return true;
    } catch (e) {
      setError(t(friendly(e)));
      return false;
    }
  }
  return (
    <div className="board-page">
      <div className="board-heading">
        <div>
          <div className="eyebrow">{t("YOUR WORKSPACE")}</div>
          <h1>{t(mode === "projects" ? "Projects" : "Routines")}</h1>
          <p className="muted">
            {t(
              mode === "projects"
                ? "A workspace for every thread."
                : "Standing instructions. Results in the original thread.",
            )}
          </p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setError("");
            setCreating(true);
          }}
        >
          <Plus size={16} />
          {t(mode === "projects" ? "New project" : "New routine")}
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {(projects.error || routines.error) && (
        <p role="alert">{friendly(projects.error ?? routines.error)}</p>
      )}
      {mode === "projects" ? (
        <div className="automation-grid">
          {projects.data?.items.map((p) => (
            <section className="board-card" key={p.id}>
              <Folder size={20} />
              <h2>{p.name}</h2>
              <p className="muted automation-path">{p.workdir}</p>
              <button
                className="button mt-4"
                disabled={threadPending}
                onClick={async () => {
                  if (threadPending) return;
                  setThreadPending(true);
                  try {
                    if (threadCommand.current?.projectId !== p.id)
                      threadCommand.current = {
                        projectId: p.id,
                        id: crypto.randomUUID(),
                      };
                    const c = await api<Conversation>(
                      `/projects/${p.id}/threads`,
                      {
                        commandId: threadCommand.current.id,
                        title: t("New thread"),
                      },
                    );
                    threadCommand.current = undefined;
                    await client.invalidateQueries({ queryKey: ["state"] });
                    await navigate({
                      to: "/conversations/$conversationId",
                      params: { conversationId: c.id },
                    });
                  } catch (e) {
                    setError(t(friendly(e)));
                  } finally {
                    setThreadPending(false);
                  }
                }}
              >
                {t("New thread")} <ArrowRight size={14} />
              </button>
              <div className="project-threads">
                {state.conversations
                  .filter((c) => c.projectId === p.id)
                  .map((c) => (
                    <div key={c.id}>
                      <button
                        onClick={() =>
                          void navigate({
                            to: "/conversations/$conversationId",
                            params: { conversationId: c.id },
                          })
                        }
                      >
                        {c.title}
                        {c.archived ? " · " + t("Archived") : ""}
                      </button>
                      <button
                        className="text-button"
                        onClick={() => {
                          setError("");
                          setEditing(c);
                        }}
                      >
                        {t("Manage thread")}
                      </button>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="board-list">
          {routines.data?.items.map((r) => (
            <section className="board-card" key={r.id}>
              <div className="flex items-center justify-between">
                <h2>{r.title}</h2>
                <span className="pill">{t(r.enabled ? "On" : "Paused")}</span>
              </div>
              <p className="mt-3">{r.instruction}</p>
              <p className="muted mt-3">
                {t("Every {minutes} minutes", {
                  minutes: r.intervalSeconds / 60,
                })}{" "}
                ·{" "}
                {t("{count} of {max} runs", { count: r.runs, max: r.maxRuns })}
              </p>
              <p className="muted mt-2">
                {t("Next run")}: {new Date(r.nextAt).toLocaleString()}{" "}
                {r.reason
                  ? " · " +
                    t(
                      (
                        {
                          paused_by_operator: "Paused by you",
                          execution_unknown: "Execution needs investigation",
                          consecutive_failures:
                            "Paused after three failed runs",
                          thread_archived: "Thread is archived",
                          budget_or_end_reached:
                            "Run budget or end time reached",
                        } as Record<string, string>
                      )[r.reason] ?? r.reason.replaceAll("_", " "),
                    )
                  : ""}
              </p>
              <div className="automation-actions">
                <button
                  className="button"
                  disabled={action.isPending}
                  onClick={() =>
                    void perform(`/routines/${r.id}/state`, {
                      expectedRevision: r.revision,
                      enabled: !r.enabled,
                    })
                  }
                >
                  {r.enabled ? <Pause size={14} /> : <Play size={14} />}{" "}
                  {t(r.enabled ? "Pause" : "Resume")}
                </button>
                <button
                  className="button"
                  disabled={action.isPending || !r.enabled}
                  onClick={() =>
                    void perform(`/routines/${r.id}/run`, {
                      expectedRevision: r.revision,
                    })
                  }
                >
                  {t("Run now")}
                </button>
                <button
                  className="text-button"
                  onClick={() =>
                    void navigate({
                      to: "/conversations/$conversationId",
                      params: { conversationId: r.conversationId },
                    })
                  }
                >
                  {t("Open thread")} <ArrowRight size={14} />
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
      {(mode === "projects"
        ? projects.data?.items.length === 0
        : routines.data?.items.length === 0) && (
        <div className="board-empty">
          {mode === "projects" ? <Folder size={36} /> : <Clock size={36} />}
          <h2>
            {t(
              mode === "projects"
                ? "Keep related work together."
                : "Make recurring work explicit.",
            )}
          </h2>
          <p>
            {t(
              mode === "projects"
                ? "Create a project from an agent workspace, then start a thread."
                : "Choose a thread, an instruction and a bounded schedule.",
            )}
          </p>
        </div>
      )}
      {mode === "projects" && state.conversations.some((c) => !c.projectId) && (
        <section className="board-card mt-6">
          <h2>{t("Other threads")}</h2>
          <div className="project-threads">
            {state.conversations
              .filter((c) => !c.projectId)
              .map((c) => (
                <div key={c.id}>
                  <button
                    onClick={() =>
                      void navigate({
                        to: "/conversations/$conversationId",
                        params: { conversationId: c.id },
                      })
                    }
                  >
                    {c.title}
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      setError("");
                      setEditing(c);
                    }}
                  >
                    {t("Manage thread")}
                  </button>
                </div>
              ))}
          </div>
        </section>
      )}
      {creating && (
        <CreateAutomation
          mode={mode}
          error={error}
          state={state}
          onClose={() => setCreating(false)}
          save={async (body) => {
            if (await perform("/" + mode, body)) setCreating(false);
          }}
        />
      )}
      {editing && (
        <ThreadEditor
          thread={editing}
          projects={projects.data?.items ?? []}
          error={error}
          busy={action.isPending}
          onClose={() => setEditing(null)}
          save={async (body) => {
            if (await perform(`/threads/${editing.id}`, body)) setEditing(null);
          }}
        />
      )}
    </div>
  );
}
function CreateAutomation({
  error,
  mode,
  state,
  onClose,
  save,
}: {
  mode: "projects" | "routines";
  error: string;
  state: State;
  onClose: () => void;
  save: (body: Record<string, unknown>) => Promise<void>;
}) {
  const { t } = useI18n();
  const form = useForm({
    defaultValues: {
      name: "",
      agentId: state.agents[0]?.id ?? "",
      conversationId: state.conversations.find((c) => !c.archived)?.id ?? "",
      instruction: "",
      minutes: "60",
      maxRuns: "20",
    },
    onSubmit: async ({ value: v }) => {
      await save(
        mode === "projects"
          ? { name: v.name, agentId: v.agentId }
          : {
              title: v.name,
              conversationId: v.conversationId,
              instruction: v.instruction,
              intervalSeconds: Number(v.minutes) * 60,
              maxRuns: Number(v.maxRuns),
            },
      );
    },
  });
  return (
    <Dialog
      title={t(mode === "projects" ? "New project" : "New routine")}
      onClose={onClose}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">ORCABOT</div>
          <h2>{t(mode === "projects" ? "New project" : "New routine")}</h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={t("Close")}
        >
          <X size={18} />
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error mt-4">
          {error}
        </p>
      )}
      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="name">
          {(f) => (
            <label>
              {t("Name")}
              <input
                required
                maxLength={160}
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
              />
            </label>
          )}
        </form.Field>
        {mode === "projects" ? (
          <form.Field name="agentId">
            {(f) => (
              <label>
                {t("Agent")}
                <select
                  required
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                >
                  <option value="">{t("Choose an agent")}</option>
                  {state.agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.workdir}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </form.Field>
        ) : (
          <>
            <form.Field name="conversationId">
              {(f) => (
                <label>
                  {t("Thread")}
                  <select
                    required
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                  >
                    <option value="">{t("Choose a thread")}</option>
                    {state.conversations
                      .filter((c) => !c.archived)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </form.Field>
            <form.Field name="instruction">
              {(f) => (
                <label>
                  {t("What to do")}
                  <textarea
                    required
                    rows={4}
                    maxLength={16000}
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                  />
                </label>
              )}
            </form.Field>
            <div className="field-grid">
              <form.Field name="minutes">
                {(f) => (
                  <label>
                    {t("Interval (minutes)")}
                    <input
                      type="number"
                      required
                      min={15}
                      max={43200}
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                    />
                  </label>
                )}
              </form.Field>
              <form.Field name="maxRuns">
                {(f) => (
                  <label>
                    {t("Run budget")}
                    <input
                      type="number"
                      required
                      min={1}
                      max={1000}
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                    />
                  </label>
                )}
              </form.Field>
            </div>
            <p className="muted mb-5">
              {t(
                "Missed windows are skipped. Three consecutive failures pause the routine. Pausing does not cancel running work.",
              )}
            </p>
          </>
        )}
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(busy) => (
            <button className="button primary" disabled={busy}>
              {t(busy ? "Saving…" : "Create")}
            </button>
          )}
        </form.Subscribe>
      </form>
    </Dialog>
  );
}
function ThreadEditor({
  error,
  projects,
  busy,
  thread,
  onClose,
  save,
}: {
  thread: Conversation;
  error: string;
  projects: Project[];
  busy: boolean;
  onClose: () => void;
  save: (body: Record<string, unknown>) => Promise<void>;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(thread.title);
  const [projectId, setProjectId] = useState(thread.projectId ?? "");
  return (
    <Dialog title={t("Manage thread")} onClose={onClose}>
      <div className="flex items-center justify-between">
        <h2>{t("Manage thread")}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={t("Close")}
        >
          <X size={18} />
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error mt-4">
          {error}
        </p>
      )}
      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          void save({
            title,
            projectId: projectId || null,
            expectedRevision: thread.revision ?? 0,
          });
        }}
      >
        <label>
          {t("Name")}
          <input
            required
            value={title}
            maxLength={160}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          {t("Project")}
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">{t("No project")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="automation-actions">
          <button
            className="button"
            type="button"
            disabled={busy}
            onClick={() =>
              void save({
                archived: !thread.archived,
                expectedRevision: thread.revision ?? 0,
              })
            }
          >
            {t(thread.archived ? "Restore thread" : "Archive thread")}
          </button>
          <button className="button primary" disabled={busy}>
            {t("Save changes")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
