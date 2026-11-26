import { WorkAttention } from "./WorkAttention.js";
import { useI18n } from "./i18n.js";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { X, ArrowRight, RefreshCw, Check, AlertTriangle } from "lucide-react";
import type { AttentionPage, AttentionItem } from "orcabot-contracts";
import { api, friendly } from "./api.js";
import { Dialog } from "./Dialog.js";

export function Attention({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: (id: string) => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const [before, setBefore] = useState<number | null>(null);
  const [focused, setFocused] = useState("");
  const [error, setError] = useState("");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["attention", before],
    queryFn: () =>
      api<AttentionPage>(
        `/attention${before === null ? "" : `?before=${before}`}`,
      ),
    refetchInterval: 15_000,
  });
  const page = query.data;
  const items = page?.items ?? [];
  const selected = items.find((item) => item.run.id === focused) ?? items[0];
  const recover = useMutation({
    mutationFn: (id: string) => api(`/runs/${id}/recover`, {}),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["attention"] }),
        client.invalidateQueries({ queryKey: ["runs"] }),
        client.invalidateQueries({ queryKey: ["run"] }),
      ]);
    },
  });
  const displayError =
    error ||
    (query.error
      ? friendly(query.error)
      : recover.error
        ? friendly(recover.error)
        : "");
  return (
    <Dialog
      title={t("Needs attention")}
      onClose={onClose}
      className="attention-panel"
    >
      <div className="dialog-heading">
        <div>
          <h2>{t("Needs attention")}</h2>
        </div>
        <button
          className="icon-button"
          aria-label={t("Close attention")}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <p className="muted my-4">
        {t("The decisions and interruptions that need you.")}
      </p>
      <WorkAttention onClose={onClose} />
      <h3 className="attention-subheading">
        {t("Execution questions and failures")}
      </h3>
      <div className="flex gap-2 mb-5">
        <button
          className="button"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCw size={14} />
          {t("Refresh")}
        </button>
        {before !== null && (
          <button className="button" onClick={() => setBefore(null)}>
            {t("Latest items")}
          </button>
        )}
      </div>
      {displayError && (
        <p className="error-text mb-4" role="alert">
          {t(displayError)}
        </p>
      )}
      {query.isPending && <p className="muted">{t("Loading attention…")}</p>}
      {page?.items.length === 0 && (
        <div className="attention-empty">
          <Check size={28} />
          <h3>{t("No execution alerts")}</h3>
          <p>
            {t(
              "Unresolved questions, failures and unknown outcomes appear here.",
            )}
          </p>
        </div>
      )}
      <div className="attention-items">
        {items.map((item) => (
          <article className="attention-item" key={item.run.id}>
            <button
              className="attention-summary"
              aria-expanded={selected?.run.id === item.run.id}
              onClick={() => setFocused(item.run.id)}
            >
              <span>
                <strong>{item.title}</strong>
                <small>
                  {item.agent} ·{" "}
                  {new Date(item.run.updatedAt).toLocaleString(
                    locale === "zh" ? "zh-CN" : "en-US",
                  )}
                </small>
              </span>
              <span className={`status ${item.run.status}`}>
                <AlertTriangle size={12} />
                {t(item.run.status)}
              </span>
            </button>
            {selected?.run.id === item.run.id && (
              <div className="attention-decision">
                {item.run.error && (
                  <p className="error-text">
                    {t(friendly(new Error(item.run.error)))}
                  </p>
                )}
                {item.pendingCount > 0 && (
                  <p className="muted">
                    {t("{count} pending interactions.", {
                      count: item.pendingCount,
                    })}{" "}
                    {t(
                      item.run.status === "unknown"
                        ? "Recover observation before responding."
                        : "Respond in the conversation.",
                    )}
                  </p>
                )}
                <div className="flex gap-2 flex-wrap mt-4">
                  {item.run.conversationId && (
                    <button
                      className="button"
                      onClick={() =>
                        void onOpen(item.run.conversationId!)
                          .then(onClose)
                          .catch((err) => setError(friendly(err)))
                      }
                    >
                      {t("Open conversation")}
                      <ArrowRight size={14} />
                    </button>
                  )}
                  {item.run.status === "unknown" && (
                    <button
                      className="button"
                      disabled={recover.isPending}
                      onClick={() =>
                        void recover.mutateAsync(item.run.id).catch(() => {})
                      }
                    >
                      <RefreshCw size={14} />
                      {t(
                        recover.isPending
                          ? "Recovering…"
                          : "Recover observation",
                      )}
                    </button>
                  )}
                </div>
                <details className="attention-request">
                  <summary>{t("Original request")}</summary>
                  <p className="attention-prompt">{item.run.prompt}</p>
                </details>
                {item.run.status !== "waiting" && item.pendingCount === 0 && (
                  <ReviewForm
                    key={`${item.run.id}:${item.run.lastSeq}`}
                    item={item}
                  />
                )}
              </div>
            )}
          </article>
        ))}
      </div>
      {page?.nextBefore !== null && page?.nextBefore !== undefined && (
        <button
          className="button mt-5"
          onClick={() => setBefore(page.nextBefore)}
        >
          {t("Earlier items")}
        </button>
      )}
    </Dialog>
  );
}
function ReviewForm({ item }: { item: AttentionItem }) {
  const { t } = useI18n();
  const client = useQueryClient();
  const review = useMutation({
    mutationFn: (note: string) =>
      api(`/runs/${item.run.id}/review`, {
        expectedLastSeq: item.run.lastSeq,
        note,
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["attention"] }),
        client.invalidateQueries({ queryKey: ["run", item.run.id] }),
      ]);
    },
  });
  const form = useForm({
    defaultValues: { note: "" },
    onSubmit: async ({ value }) => {
      try {
        await review.mutateAsync(value.note);
      } catch {
        /* Display the mutation error without discarding the note. */
      }
    },
  });
  return (
    <form
      className="review-form"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="note"
        validators={{
          onChange: ({ value }) =>
            value.length > 2000
              ? t("Use at most 2,000 characters.")
              : undefined,
        }}
      >
        {(field) => (
          <label>
            {t("Investigation note")}
            <textarea
              aria-label={t("Investigation note for {title}", {
                title: item.title,
              })}
              rows={2}
              required
              maxLength={2000}
              placeholder={t("What did you verify on the execution host?")}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.note}>
        {(note) => (
          <button
            className="button"
            disabled={review.isPending || !note.trim()}
          >
            <Check size={14} />
            {t("Acknowledge")}
          </button>
        )}
      </form.Subscribe>
      {review.error && (
        <p className="error-text" role="alert">
          {t(friendly(review.error))}
        </p>
      )}
      <small className="muted">
        {t(
          "Acknowledgement records your note and clears this alert. The execution outcome stays unchanged.",
        )}
      </small>
    </form>
  );
}
