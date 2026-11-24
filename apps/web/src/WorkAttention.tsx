import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { WorkItem } from "orcabot-contracts";
import { api, friendly } from "./api.js";
import { useI18n } from "./i18n.js";

export function WorkAttention({ onClose }: { onClose: () => void }) {
  const { t } = useI18n(),
    navigate = useNavigate(),
    [before, setBefore] = useState<number | null>(null);
  const query = useQuery({
    queryKey: ["workAttention", before],
    queryFn: () =>
      api<{ items: WorkItem[]; nextBefore: number | null }>(
        `/board/attention${before === null ? "" : `?before=${before}`}`,
      ),
    refetchInterval: 15000,
  });
  return (
    <section className="work-attention">
      <h3 className="attention-subheading">
        {t("Awaiting business acceptance")}
      </h3>
      {query.error && (
        <p className="error-text" role="alert">
          {t(friendly(query.error))}
        </p>
      )}
      {query.isPending && <p className="muted">{t("Loading work…")}</p>}
      {query.data?.items.length === 0 && (
        <p className="muted">{t("No business reviews pending.")}</p>
      )}
      {query.data?.items.map((w) => (
        <button
          className="work-attention-row"
          key={w.id}
          onClick={() => {
            void navigate({ to: "/work/$workId", params: { workId: w.id } });
            onClose();
          }}
        >
          <strong>{w.title}</strong>
          <span>{t(w.state)} →</span>
        </button>
      ))}
      <div className="flex gap-2 mt-3">
        {before !== null && (
          <button className="text-button" onClick={() => setBefore(null)}>
            {t("Latest items")}
          </button>
        )}
        {query.data?.nextBefore != null && (
          <button
            className="text-button"
            onClick={() => setBefore(query.data!.nextBefore)}
          >
            {t("Earlier items")}
          </button>
        )}
      </div>
    </section>
  );
}
