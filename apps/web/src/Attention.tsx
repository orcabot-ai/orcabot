import { WorkAttention } from "./WorkAttention.js";
import { useI18n } from "./i18n.js";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { X, ArrowRight, RefreshCw, Check, AlertTriangle } from "lucide-react";
import type { AttentionPage, AttentionItem } from "orcabot-contracts";
import { api, friendly } from "./api.js";
import { Dialog } from "./Dialog.js";

const features = tableFeatures({});
const column = createColumnHelper<typeof features, AttentionItem>();
const emptyItems: AttentionItem[] = [];
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
  const items = page?.items ?? emptyItems;
  const selected = items.find((item) => item.run.id === focused) ?? items[0];
  const columns = useMemo(
    () =>
      column.columns([
        column.accessor("title", {
          header: t("Conversation"),
          cell: (info) => (
            <button
              className="text-button attention-title"
              onClick={() => setFocused(info.row.original.run.id)}
              aria-pressed={info.row.original.run.id === selected?.run.id}
            >
              {info.getValue()}
            </button>
          ),
        }),
        column.accessor((item) => item.run.status, {
          id: "status",
          header: t("Outcome"),
          cell: (info) => (
            <span className={`status ${info.getValue()}`}>
              {t(info.getValue())}
            </span>
          ),
        }),
        column.accessor((item) => item.run.updatedAt, {
          id: "updatedAt",
          header: t("Updated"),
          cell: (info) => (
            <time dateTime={new Date(info.getValue()).toISOString()}>
              {new Date(info.getValue()).toLocaleString(
                locale === "zh" ? "zh-CN" : "en-US",
              )}
            </time>
          ),
        }),
      ]),
    [selected?.run.id, t, locale],
  );
  const table = useTable(
    { features, columns, data: items, getRowId: (item) => item.run.id },
    (state) => state,
  );
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="eyebrow">{t("OPERATOR ATTENTION")}</div>
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
        {t(
          "Resolve agent questions, inspect failures, and reconnect to original executions.",
        )}
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
      {items.length > 0 && (
        <div className="attention-table-scroll">
          <table className="attention-table">
            <caption className="sr-only">
              {t("Executions requiring attention on this page")}
            </caption>
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => (
                    <th key={header.id}>
                      {!header.isPlaceholder && (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={selected?.run.id === row.id ? "selected" : ""}
                >
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <article className="attention-item mt-4">
          <div className="flex justify-between gap-3">
            <strong>{selected.title}</strong>
            <span className={`status ${selected.run.status}`}>
              <AlertTriangle size={12} />
              {t(selected.run.status)}
            </span>
          </div>
          <small className="muted">
            {selected.agent} ·{" "}
            {new Date(selected.run.updatedAt).toLocaleString(
              locale === "zh" ? "zh-CN" : "en-US",
            )}
          </small>
          <p className="attention-prompt">{selected.run.prompt}</p>
          {selected.run.error && (
            <p className="muted text-xs">
              {t(friendly(new Error(selected.run.error)))}
            </p>
          )}
          {selected.pendingCount > 0 && (
            <p className="muted">
              {t("{count} pending interactions.", {
                count: selected.pendingCount,
              })}{" "}
              {selected.run.status === "unknown"
                ? t("Recover observation before responding.")
                : t("Respond in the conversation.")}
            </p>
          )}
          <div className="flex gap-2 flex-wrap mt-4">
            {selected.run.conversationId && (
              <button
                className="button"
                onClick={() =>
                  void onOpen(selected.run.conversationId!)
                    .then(onClose)
                    .catch((err) => setError(friendly(err)))
                }
              >
                {t("Open conversation")}
                <ArrowRight size={14} />
              </button>
            )}
            {selected.run.status === "unknown" && (
              <button
                className="button"
                disabled={recover.isPending}
                onClick={() =>
                  void recover.mutateAsync(selected.run.id).catch(() => {})
                }
              >
                <RefreshCw size={14} />
                {recover.isPending
                  ? t("Recovering…")
                  : t("Recover observation")}
              </button>
            )}
          </div>
          {selected.run.status !== "waiting" && selected.pendingCount === 0 && (
            <ReviewForm
              key={`${selected.run.id}:${selected.run.lastSeq}`}
              item={selected}
            />
          )}
        </article>
      )}
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
