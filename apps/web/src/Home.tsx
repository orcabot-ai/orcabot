import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Check,
  MessageSquare,
  Circle,
  ChevronDown,
} from "lucide-react";
import type {
  State,
  Agent,
  PublicTarget,
  BoardState,
  AttentionPage,
  WorkItem,
  HomeActivity,
} from "orcabot-contracts";
import { api, friendly } from "./api.js";
import { useI18n } from "./i18n.js";

export function Home({
  state,
  agent,
  target,
  composer,
  onOpenConversation,
  onAttention,
}: {
  state: State;
  agent?: Agent;
  target?: PublicTarget;
  composer: ReactNode;
  onOpenConversation: (id: string) => Promise<void>;
  onAttention: () => void;
}) {
  const { t, locale } = useI18n(),
    navigate = useNavigate();
  const board = useQuery({
    queryKey: ["board", null],
    queryFn: () => api<BoardState>("/board"),
    refetchInterval: 15000,
  });
  const reviews = useQuery({
    queryKey: ["workAttention", null],
    queryFn: () =>
      api<{ items: WorkItem[]; nextBefore: number | null }>("/board/attention"),
    refetchInterval: 15000,
  });
  const attention = useQuery({
    queryKey: ["attention", null],
    queryFn: () => api<AttentionPage>("/attention"),
    refetchInterval: 15000,
  });
  const activity = useQuery({
    queryKey: ["activity"],
    queryFn: () => api<HomeActivity>("/activity"),
    refetchInterval: 15000,
  });
  const terminal = (work: WorkItem) =>
    board.data?.definitions
      .find(
        (d) =>
          d.workflow.id === work.definitionId &&
          d.workflow.version === work.definitionVersion,
      )
      ?.workflow.states.find((s) => s.id === work.state)?.terminal === true;
  const reviewIds = new Set(reviews.data?.items.map((w) => w.id));
  const progress =
    board.data?.items.filter((w) => !terminal(w) && !reviewIds.has(w.id)) ?? [];
  const delivered = board.data?.items.filter(terminal) ?? [];
  const error =
    board.error || reviews.error || attention.error || activity.error;
  const open = (work: WorkItem) =>
    void navigate({ to: "/work/$workId", params: { workId: work.id } });
  const date = (time: number) =>
    new Date(time).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
      month: "short",
      day: "numeric",
    });
  const workRow = (work: WorkItem, accepted = false) => (
    <button className="assistant-row" key={work.id} onClick={() => open(work)}>
      <span className="assistant-row-icon">
        {accepted ? <Check size={15} /> : <Circle size={14} />}
      </span>
      <span className="assistant-row-title">
        {work.title}
        <small>{date(work.updatedAt)}</small>
      </span>
      <span className={accepted ? "assistant-accepted" : "assistant-stage"}>
        {t(accepted ? "Accepted" : work.state)}
      </span>
      <ArrowUpRight size={15} />
    </button>
  );
  return (
    <section className="welcome assistant-home">
      <div className="assistant-greeting">
        <h1>{t("Your assistant")}</h1>
      </div>
      {composer}
      <details className="workspace-context assistant-context">
        <summary>
          {t("Workspace details")}
          <ChevronDown size={13} />
        </summary>
        <div>
          <span>{t("Agent")}</span>
          <strong>{agent?.name ?? t("Not configured")}</strong>
        </div>
        <div>
          <span>{t("Execution target")}</span>
          <strong>{target?.name ?? t("Not configured")}</strong>
        </div>
        {agent?.workdir && (
          <div>
            <span>{t("Working directory")}</span>
            <code>{agent.workdir}</code>
          </div>
        )}
      </details>
      {error && (
        <p className="error-text" role="alert">
          {t(friendly(error))}
        </p>
      )}
      {board.data?.nextBefore != null && (
        <div className="assistant-scope">
          <p>
            {t(
              "Showing {count} recent tasks. Browse older work in the task list.",
              { count: board.data.items.length },
            )}
          </p>
          <button
            className="text-button"
            onClick={() => void navigate({ to: "/work" })}
          >
            {t("Open task list")}
            <ArrowUpRight size={13} />
          </button>
        </div>
      )}
      <section className="assistant-section">
        <div className="assistant-section-heading">
          <h2>{t("In progress")}</h2>
          <button
            className="text-button"
            onClick={() => void navigate({ to: "/work" })}
          >
            {t("View tasks")}
            <ArrowUpRight size={13} />
          </button>
        </div>
        {activity.data?.active
          .filter((item) => item.status === "running")
          .slice(0, 5)
          .map((item) => (
            <button
              className="assistant-row"
              key={item.runId}
              onClick={() => void onOpenConversation(item.conversationId)}
            >
              <MessageSquare size={14} />
              <span className="assistant-row-title">
                {item.title}
                <small>{t("Conversation")}</small>
              </span>
              <span className="assistant-stage">{t(item.status)}</span>
              <ArrowUpRight size={15} />
            </button>
          ))}
        {board.isPending || activity.isPending ? (
          <p className="assistant-empty">{t("Loading work…")}</p>
        ) : (
          board.isSuccess &&
          activity.isSuccess &&
          (progress.length ? (
            progress.slice(0, 5).map((w) => workRow(w))
          ) : activity.data?.active.some(
              (item) => item.status === "running",
            ) ? null : (
            <p className="assistant-empty">
              {t(
                board.data?.nextBefore != null
                  ? "No in-progress tasks in this recent view."
                  : "No tasks in progress. Tell Orca what you want to do next.",
              )}
            </p>
          ))
        )}
      </section>
      <section className="assistant-section">
        <div className="assistant-section-heading">
          <h2>{t("Needs your attention")}</h2>
          <button className="text-button" onClick={onAttention}>
            {t("View all")}
            <ArrowUpRight size={13} />
          </button>
        </div>
        {reviews.isPending || attention.isPending ? (
          <p className="assistant-empty">{t("Loading work…")}</p>
        ) : (
          reviews.isSuccess &&
          attention.isSuccess && (
            <>
              {reviews.data.items.slice(0, 3).map((w) => (
                <button
                  className="assistant-row"
                  key={w.id}
                  onClick={() => open(w)}
                >
                  <Circle size={14} />
                  <span className="assistant-row-title">{w.title}</span>
                  <span className="assistant-review">
                    {t("Review delivery")}
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
              {attention.data.items.slice(0, 3).map((item) => (
                <button
                  className="assistant-row"
                  key={item.run.id}
                  onClick={() =>
                    void (item.run.conversationId
                      ? onOpenConversation(item.run.conversationId)
                      : onAttention())
                  }
                >
                  <MessageSquare size={14} />
                  <span className="assistant-row-title">
                    {item.title}
                    <small>
                      {t(
                        item.pendingCount
                          ? "Waiting for your reply"
                          : "Earlier execution",
                      )}
                    </small>
                  </span>
                  <span className="assistant-stage">
                    {t(
                      item.pendingCount
                        ? "Your reply is needed"
                        : item.run.status,
                    )}
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
              {!reviews.data.items.length && !attention.data.items.length && (
                <p className="assistant-empty">
                  {t("Nothing needs your attention right now.")}
                </p>
              )}
            </>
          )
        )}
      </section>
      <section className="assistant-section">
        <div className="assistant-section-heading">
          <h2>{t("Recent deliveries")}</h2>
        </div>
        {board.isPending ? (
          <p className="assistant-empty">{t("Loading work…")}</p>
        ) : (
          board.isSuccess &&
          (delivered.length ? (
            delivered.slice(0, 5).map((w) => workRow(w, true))
          ) : (
            <p className="assistant-empty">
              {t(
                board.data?.nextBefore != null
                  ? "No accepted deliveries in this recent view."
                  : "Accepted work will appear here.",
              )}
            </p>
          ))
        )}
      </section>
      {!!activity.data?.recent.filter(
        (item) => item.status === "completed" || item.status === "cancelled",
      ).length && (
        <section className="assistant-section">
          <div className="assistant-section-heading">
            <h2>{t("Recent conversations")}</h2>
          </div>
          {activity.data.recent
            .filter(
              (item) =>
                item.status === "completed" || item.status === "cancelled",
            )
            .slice(0, 5)
            .map((item) => (
              <button
                className="assistant-row"
                key={item.runId}
                onClick={() => void onOpenConversation(item.conversationId)}
              >
                <MessageSquare size={14} />
                <span className="assistant-row-title">
                  {item.title}
                  <small>{date(item.updatedAt)}</small>
                </span>
                <span className="assistant-stage">{t(item.status)}</span>
                <ArrowUpRight size={15} />
              </button>
            ))}
        </section>
      )}
      {(activity.data?.moreActive || activity.data?.moreRecent) && (
        <p className="assistant-footnote">
          {t("Showing the most recent conversation activity.")}
        </p>
      )}
      {!state.conversations.length && (
        <p className="assistant-footnote">
          {t("Your conversations and results stay in this workspace.")}
        </p>
      )}
    </section>
  );
}
