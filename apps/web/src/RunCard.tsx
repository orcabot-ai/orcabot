import { BrandMark } from "./BrandMark.js";
import { useI18n } from "./i18n.js";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { OutputMarkdown as Markdown } from "./OutputMarkdown.js";
import {
  Check,
  ChevronLeft,
  Circle,
  LoaderCircle,
  Square,
  AlertTriangle,
  Wrench,
  FileText,
  RefreshCw,
} from "lucide-react";
import {
  active,
  type Run,
  type RuntimeEvent,
  type StoredEvent,
  type RunReview,
} from "orcabot-contracts";
import { api, friendly } from "./api.js";
import { Artifacts } from "./Artifacts.js";

type Details = {
  run: Run;
  pending: Record<string, unknown>[];
  reviews: RunReview[];
};
type Page = { events: StoredEvent[]; lastSeq: number; total: number };
export function RunCard({
  initial,
  onDone,
}: {
  initial: Run;
  onDone: () => void;
}) {
  const { t, locale } = useI18n();
  const client = useQueryClient();
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [view, setView] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [artifacts, setArtifacts] = useState(false);
  const detailsQuery = useQuery({
    queryKey: ["run", initial.id],
    queryFn: () => api<Details>(`/runs/${initial.id}`),
  });
  const run =
    detailsQuery.data && detailsQuery.data.run.lastSeq >= initial.lastSeq
      ? detailsQuery.data.run
      : initial;
  const pending = detailsQuery.data?.pending ?? [];
  const reviews = detailsQuery.data?.reviews ?? [];
  useEffect(() => {
    let disposed = false,
      stream: EventSource | undefined;
    const details = () =>
      client.fetchQuery({
        queryKey: ["run", initial.id],
        queryFn: () => api<Details>(`/runs/${initial.id}`),
        staleTime: 0,
      });
    void (async () => {
      try {
        const page = await client.fetchQuery({
          queryKey: ["events", initial.id, view],
          queryFn: () =>
            api<Page>(
              `/runs/${initial.id}/event-page${view === null ? "" : `?after=${view}`}`,
            ),
          staleTime: 0,
        });
        if (disposed) return;
        setEvents(page.events);
        await details();
        if (disposed || view !== null) return;
        stream = new EventSource(
          `/api/runs/${initial.id}/events?after=${page.lastSeq}`,
        );
        stream.addEventListener("runtime", (e) => {
          const item = {
            seq: Number(e.lastEventId),
            event: JSON.parse(e.data) as RuntimeEvent,
          };
          setEvents((previous) =>
            previous.some((p) => p.seq === item.seq)
              ? previous
              : [...previous, item].slice(-200),
          );
          if (item.event.type.startsWith("interaction."))
            void details().catch((err) => setError(friendly(err)));
        });
        stream.addEventListener("done", () => {
          stream?.close();
          void details()
            .then(() => {
              if (!disposed) onDone();
            })
            .catch((err) => setError(friendly(err)));
        });
        stream.onerror = () => {
          if (!disposed)
            setError("Connection interrupted. Reconnecting to saved output…");
        };
        stream.onopen = () => {
          if (!disposed) setError("");
        };
      } catch (err) {
        if (!disposed) setError(friendly(err));
      }
    })();
    return () => {
      disposed = true;
      stream?.close();
    };
  }, [client, initial.id, initial.status, view, onDone]);
  const messages = new Map<string, { text: string; channel: string }>();
  const tools = new Map<string, RuntimeEvent>();
  const notices: RuntimeEvent[] = [];
  for (const { event } of events) {
    const p = event.payload;
    if (
      event.type.startsWith("message.") &&
      typeof p.text === "string" &&
      !p.redacted
    ) {
      const key = String(p.messageId ?? "answer"),
        previous = messages.get(key)?.text ?? "";
      messages.set(key, {
        channel: String(p.channel ?? "final"),
        text: event.type === "message.delta" ? previous + p.text : p.text,
      });
    }
    if (event.type.startsWith("tool_call.")) tools.set(String(p.id), event);
    if (
      [
        "run.failed",
        "run.notice",
        "orcabot.observation_lost",
        "orcabot.dispatch_rejected",
      ].includes(event.type)
    )
      notices.push(event);
  }
  const messageEntries = [...messages];
  const hasFinalAnswer = messageEntries.some(([, m]) => m.channel === "final");
  const resultMessages = messageEntries.filter(
    ([, m]) =>
      m.channel !== "analysis" && (!hasFinalAnswer || m.channel === "final"),
  );
  const progressMessages = hasFinalAnswer
    ? messageEntries.filter(
        ([, m]) => m.channel !== "analysis" && m.channel !== "final",
      )
    : [];
  const recover = useMutation({
    mutationFn: () => api(`/runs/${run.id}/recover`, {}),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["run", run.id] });
      onDone();
    },
  });
  const cancel = useMutation({
    mutationFn: () => api(`/runs/${run.id}/cancel`, {}),
  });
  const recovering = recover.isPending;
  const cancelling =
    cancel.isPending || (cancel.isSuccess && active(run.status));
  const displayError =
    error ||
    (detailsQuery.error
      ? friendly(detailsQuery.error)
      : recover.error
        ? friendly(recover.error)
        : cancel.error
          ? friendly(cancel.error)
          : "");
  return (
    <article className="run-card">
      {artifacts && (
        <Artifacts runId={run.id} onClose={() => setArtifacts(false)} />
      )}
      <div className="human-message">
        <div className="avatar human">{t("You")}</div>
        <div className="min-w-0">
          <div className="message-meta">
            {t("You")}{" "}
            <time>
              {new Date(run.createdAt).toLocaleTimeString(
                locale === "zh" ? "zh-CN" : "en-US",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                },
              )}
            </time>
          </div>
          {run.prompt.length > 420 ? (
            <details className="request-context">
              <summary>
                {run.prompt.slice(0, 160)}…{" "}
                <span>{t("Read full request")}</span>
              </summary>
              <p className="whitespace-pre-wrap break-words">{run.prompt}</p>
            </details>
          ) : (
            <p className="whitespace-pre-wrap break-words">{run.prompt}</p>
          )}
        </div>
      </div>
      <div className="agent-message">
        <div className="avatar agent">
          <BrandMark small />
        </div>
        <div className="min-w-0 flex-1">
          <div className="message-meta">
            {t("Assistant")}{" "}
            <span className={`run-status status-${run.status}`}>
              {active(run.status) ? (
                <LoaderCircle className="spin" size={12} />
              ) : run.status === "completed" ? (
                <Check size={12} />
              ) : (
                <Circle size={10} />
              )}{" "}
              {t(run.status)}
            </span>
            <button
              className="artifact-button"
              onClick={() => setArtifacts(true)}
            >
              <FileText size={12} />
              {t("Artifacts")}
            </button>
            {active(run.status) && (
              <button
                className="cancel"
                onClick={() => cancel.mutate()}
                disabled={cancelling}
              >
                <Square size={11} />
                {cancelling ? t("Cancel requested") : t("Stop")}
              </button>
            )}
          </div>
          {events[0]?.seq > 1 && (
            <button
              className="text-button mb-3"
              onClick={() => setView(Math.max(0, events[0].seq - 201))}
            >
              <ChevronLeft size={13} />
              {t("Earlier output")}
            </button>
          )}
          {view !== null && (
            <button
              className="text-button mb-3 ml-3"
              onClick={() => setView(null)}
            >
              {t("Return to latest")}
            </button>
          )}
          {run.status === "completed" && (
            <p className="execution-finished">
              <Check size={14} />
              {t(
                [...messages.values()].some((m) => m.channel !== "analysis")
                  ? "Execution finished. Review the result below."
                  : "Execution finished.",
              )}
            </p>
          )}
          {resultMessages.map(([key, m]) => (
            <div key={key} className="markdown">
              <Markdown>{m.text.slice(-64000)}</Markdown>
              {m.text.length > 64000 && (
                <small>{t("Long output is clipped in this view.")}</small>
              )}
            </div>
          ))}
          {progressMessages.length > 0 && (
            <details className="reasoning-group">
              <summary>{t("Progress notes")}</summary>
              {progressMessages.map(([key, m]) => (
                <div key={key} className="markdown">
                  <Markdown>{m.text.slice(-64000)}</Markdown>
                  {m.text.length > 64000 && (
                    <small>{t("Long output is clipped in this view.")}</small>
                  )}
                </div>
              ))}
            </details>
          )}
          {[...messages].some(([, m]) => m.channel === "analysis") && (
            <details className="reasoning-group">
              <summary>{t("Thinking notes")}</summary>
              {[...messages]
                .filter(([, m]) => m.channel === "analysis")
                .map(([key, m]) => (
                  <div key={key} className="markdown reasoning">
                    <Markdown>{m.text.slice(-64000)}</Markdown>
                    {m.text.length > 64000 && (
                      <small>{t("Long output is clipped in this view.")}</small>
                    )}
                  </div>
                ))}
            </details>
          )}
          {[...tools].length > 0 && (
            <details className="tool-group">
              <summary>
                <Wrench size={13} />
                {t(
                  tools.size === 1
                    ? "{count} tool activity"
                    : "{count} tool activities",
                  { count: tools.size },
                )}
                <span>{t("View details")}</span>
              </summary>
              {[...tools].map(([key, e]) => (
                <div className="tool-row" key={key}>
                  <span>{String(e.payload.name ?? key).slice(0, 100)}</span>
                  <pre>{JSON.stringify(e.payload, null, 2).slice(0, 8000)}</pre>
                </div>
              ))}
            </details>
          )}
          {![...messages.values()].some((m) => m.channel !== "analysis") &&
            active(run.status) && (
              <div className="thinking">
                <span />
                <span />
                <span />{" "}
                <span className="thinking-label">
                  {run.status === "waiting"
                    ? t("Waiting for your response")
                    : t("Working on your request")}
                </span>
              </div>
            )}
          {pending.map((p) => (
            <Interaction
              key={String(p.interactionId)}
              runId={run.id}
              pending={p}
              controllable={active(run.status)}
            />
          ))}
          {notices.map((e, i) => (
            <div className="notice" key={i}>
              <AlertTriangle size={14} />
              <span>
                {t(
                  friendly(
                    new Error(
                      String(e.payload.code ?? e.payload.message ?? e.type),
                    ),
                  ),
                )}
              </span>
            </div>
          ))}
          {run.status === "unknown" && (
            <div className="notice">
              <div>
                {t(
                  "The execution outcome is unknown. Recover observation of the original execution, or investigate its host before starting replacement work.",
                )}
                <button
                  className="button mt-3"
                  disabled={recovering}
                  onClick={() => recover.mutate()}
                >
                  <RefreshCw size={13} />
                  {recovering ? t("Recovering…") : t("Recover observation")}
                </button>
              </div>
            </div>
          )}
          {reviews.length > 0 && (
            <details className="review-history">
              <summary>
                {t("Investigation notes")} ({reviews.length})
              </summary>
              {reviews.map((review) => (
                <div key={review.id}>
                  <small className="muted">
                    {new Date(review.createdAt).toLocaleString(
                      locale === "zh" ? "zh-CN" : "en-US",
                    )}{" "}
                    · {t("Event")} {review.expectedLastSeq}
                  </small>
                  <p>{review.note}</p>
                </div>
              ))}
            </details>
          )}
          {displayError && (
            <div className="error-text" role="alert">
              {t(displayError)}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function Interaction({
  runId,
  pending,
  controllable,
}: {
  runId: string;
  pending: Record<string, unknown>;
  controllable: boolean;
}) {
  const { t } = useI18n();
  const client = useQueryClient();
  const response = useMutation({
    mutationFn: ({ outcome, value }: { outcome: string; value?: string }) =>
      api(`/runs/${runId}/respond`, {
        interactionId: String(pending.interactionId),
        outcome,
        ...(value === undefined ? {} : { value }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["run", runId] });
    },
  });
  const form = useForm({
    defaultValues: { answer: "" },
    onSubmit: async ({ value }) => {
      try {
        await response.mutateAsync({
          outcome: "answered",
          value: value.answer,
        });
        form.reset();
      } catch {
        /* Keep the answer available for retry. */
      }
    },
  });
  const record = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const request = record(pending.request),
    operation = record(request.operation),
    provider = record(request.providerDetails);
  const approval = pending.kind === "approval";
  const action =
    typeof operation.summary === "string"
      ? operation.summary
      : typeof request.text === "string"
        ? request.text
        : typeof pending.request === "string"
          ? pending.request
          : undefined;
  const command =
    typeof provider.command === "string" ? provider.command : undefined;
  const allowed = (outcome: string) =>
    !Array.isArray(request.allowedOutcomes) ||
    request.allowedOutcomes.includes(outcome);
  const scope =
    typeof request.grantScope === "string" ? request.grantScope : undefined;
  return (
    <div
      className="interaction"
      role="region"
      aria-label={t(approval ? "Permission needed" : "Your input is needed")}
    >
      <h3>{t(approval ? "Permission needed" : "Your input is needed")}</h3>
      {action && <pre className="permission-action">{action}</pre>}
      {command && command !== action && (
        <div>
          <span className="permission-label">{t("Command")}</span>
          <pre className="permission-action">{command}</pre>
        </div>
      )}
      {approval && (
        <dl className="permission-context">
          {typeof provider.cwd === "string" && (
            <>
              <dt>{t("Working directory")}</dt>
              <dd>
                <code>{provider.cwd}</code>
              </dd>
            </>
          )}
          <dt>{t("Scope")}</dt>
          <dd>
            {t(
              scope === "request"
                ? "This request only"
                : (scope ?? "Not provided"),
            )}
          </dd>
        </dl>
      )}
      {Array.isArray(request.requestedPermissions) &&
        request.requestedPermissions.length > 0 && (
          <div>
            <span className="permission-label">
              {t("Requested permissions")}
            </span>
            <pre className="permission-action">
              {JSON.stringify(request.requestedPermissions, null, 2)}
            </pre>
          </div>
        )}
      <details className="permission-details" open={!action && !command}>
        <summary>{t("Technical details")}</summary>
        <pre>
          {JSON.stringify(pending.request, null, 2) ??
            t("No request details were supplied.")}
        </pre>
      </details>
      {approval && (
        <p className="permission-boundary">
          {t("Execution permission is separate from task acceptance.")}
        </p>
      )}
      <div className="flex gap-2 flex-wrap">
        {allowed("declined") && (
          <button
            className="button"
            disabled={!controllable || response.isPending}
            onClick={() => response.mutate({ outcome: "declined" })}
          >
            {t(approval ? "Deny request" : "Decline")}
          </button>
        )}
        {allowed("accepted") && (
          <button
            className="button primary"
            disabled={!controllable || response.isPending}
            onClick={() => response.mutate({ outcome: "accepted" })}
          >
            {t(
              approval
                ? scope === "request"
                  ? "Allow this request"
                  : "Allow request"
                : "Allow",
            )}
          </button>
        )}
        {Array.isArray(request.allowedOutcomes) && allowed("cancelled") && (
          <button
            className="button"
            disabled={!controllable || response.isPending}
            onClick={() => response.mutate({ outcome: "cancelled" })}
          >
            {t("Cancel request")}
          </button>
        )}
      </div>
      {allowed("answered") && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="answer">
            {(field) => (
              <label className="interaction-answer">
                {t("Answer")}
                <input
                  aria-label={t("Answer")}
                  placeholder={t("Or write an answer…")}
                  maxLength={16000}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </label>
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.values.answer}>
            {(answer) => (
              <button
                className="button"
                disabled={!answer.trim() || !controllable || response.isPending}
              >
                {t("Send")}
              </button>
            )}
          </form.Subscribe>
        </form>
      )}
      {response.error && (
        <p className="error-text" role="alert">
          {t(friendly(response.error))}
        </p>
      )}
    </div>
  );
}
