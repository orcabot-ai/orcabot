import { useI18n } from "./i18n.js";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import Markdown from "react-markdown";
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
          <p className="whitespace-pre-wrap break-words">{run.prompt}</p>
        </div>
      </div>
      <div className="agent-message">
        <div className="avatar agent">
          <span>◒</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="message-meta">
            {t("Agent")}{" "}
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
          {[...messages].map(([key, m]) => (
            <div
              key={key}
              className={`markdown ${m.channel === "analysis" ? "reasoning" : ""}`}
            >
              <Markdown>{m.text.slice(-64000)}</Markdown>
              {m.text.length > 64000 && (
                <small>{t("Long output is clipped in this view.")}</small>
              )}
            </div>
          ))}
          {!messages.size && active(run.status) && (
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
  return (
    <div className="interaction">
      <div className="font-medium">{t("Your input is needed")}</div>
      <pre>{JSON.stringify(pending.request, null, 2).slice(0, 8000)}</pre>
      <div className="flex gap-2 flex-wrap">
        <button
          className="button primary"
          disabled={!controllable || response.isPending}
          onClick={() => response.mutate({ outcome: "accepted" })}
        >
          {t("Allow")}
        </button>
        <button
          className="button"
          disabled={!controllable || response.isPending}
          onClick={() => response.mutate({ outcome: "declined" })}
        >
          {t("Decline")}
        </button>
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="answer">
          {(field) => (
            <input
              aria-label={t("Answer")}
              placeholder={t("Or write an answer…")}
              maxLength={16000}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
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
      {response.error && (
        <p className="error-text" role="alert">
          {t(friendly(response.error))}
        </p>
      )}
    </div>
  );
}
