import { Automation } from "./Automation.js";
import { BrandMark } from "./BrandMark.js";
import { Board } from "./Board.js";
import { LanguageControl, useI18n } from "./i18n.js";
import { useCallback, useRef, useState } from "react";
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate, useParams, useLocation } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { VirtualRuns } from "./VirtualRuns.js";
import {
  ArrowUp,
  Plus,
  Settings2,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
  ChevronDown,
  Globe2,
  Server,
  KeyRound,
  ArrowRight,
  Command,
  Bot,
  BellDot,
  ClipboardList,
} from "lucide-react";
import {
  active,
  type State,
  type Conversation,
  type RunPage,
  type Run,
} from "orcabot-contracts";
import { api, ApiError, friendly } from "./api.js";
import { Setup } from "./Setup.js";
import { ThemeControl } from "./ThemeControl.js";
import { Attention } from "./Attention.js";

const empty: State = { targets: [], agents: [], conversations: [] };
let fragmentSession: Promise<void> | undefined;
function exchangeFragment() {
  if (!fragmentSession) {
    const key = new URLSearchParams(location.hash.slice(1)).get("key");
    if (location.hash)
      history.replaceState(null, "", location.pathname + location.search);
    fragmentSession = key
      ? api<void>("/session", { token: key })
      : Promise.resolve();
    // A failed link can still be replaced by a key entered in the unlock form.
    fragmentSession.catch(() => {
      fragmentSession = undefined;
    });
  }
  return fragmentSession;
}
export function App() {
  const { t } = useI18n();
  const client = useQueryClient();
  const navigate = useNavigate();
  const { conversationId, workId } = useParams({ strict: false });
  const path = useLocation().pathname;
  const automationMode =
    path === "/projects"
      ? "projects"
      : path === "/routines"
        ? "routines"
        : null;
  const workMode = path.startsWith("/work") || !!automationMode;
  const [error, setError] = useState("");
  const [setup, setSetup] = useState(false);
  const [attention, setAttention] = useState(false);
  const [agentChoice, setAgentId] = useState("");
  const [sidebar, setSidebar] = useState(
    () => window.matchMedia("(min-width: 601px)").matches,
  );
  const scroll = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const workspace = useQuery({
    queryKey: ["state"],
    queryFn: async () => {
      await exchangeFragment();
      return api<State>("/state");
    },
  });
  const state = workspace.data ?? empty;
  const agentId = agentChoice || state.agents[0]?.id || "";
  const locked =
    workspace.error instanceof ApiError && workspace.error.status === 401;
  const ready = !workspace.isPending;
  const conversation = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => api<Conversation>(`/conversations/${conversationId}`),
    enabled: !!conversationId && workspace.isSuccess,
  });
  const selected =
    conversation.data ??
    state.conversations.find((c) => c.id === conversationId) ??
    null;
  const history = useInfiniteQuery({
    queryKey: ["runs", conversationId],
    initialPageParam: null as number | null,
    queryFn: ({ pageParam }) =>
      api<RunPage>(
        `/conversations/${conversationId}/runs${pageParam === null ? "" : `?before=${pageParam}`}`,
      ),
    getNextPageParam: (page) => page.nextBefore ?? undefined,
    enabled: !!conversationId && workspace.isSuccess,
    refetchInterval: (query) =>
      query.state.data?.pages[0]?.runs.some((r) => active(r.status))
        ? 5000
        : false,
  });
  const runs = [...(history.data?.pages ?? [])]
    .reverse()
    .flatMap((page) => [...page.runs].reverse());
  const refresh = useCallback(async () => {
    await client.invalidateQueries({ queryKey: ["state"] });
  }, [client]);
  const refreshRuns = useCallback(() => {
    void client.invalidateQueries({ queryKey: ["runs"] });
    void client.invalidateQueries({ queryKey: ["attention"] });
  }, [client]);
  const openConversation = useCallback(
    async (id: string) => {
      await navigate({
        to: "/conversations/$conversationId",
        params: { conversationId: id },
      });
      setError("");
      if (window.matchMedia("(max-width: 600px)").matches) setSidebar(false);
    },
    [navigate],
  );
  const admission = useMutation({
    mutationFn: async ({
      prompt,
      agentId,
      id,
    }: {
      prompt: string;
      agentId: string;
      id?: string;
    }) => {
      let current = id;
      if (!current) {
        const created = await api<Conversation>("/conversations", {
          agentId,
          title: prompt.slice(0, 80),
        });
        current = created.id;
        client.setQueryData(["conversation", current], created);
        await openConversation(current);
        await refresh();
      }
      await api<Run>(`/conversations/${current}/runs`, { prompt });
      await client.invalidateQueries({ queryKey: ["runs", current] });
      await refresh();
    },
  });
  const composer = useForm({
    defaultValues: { prompt: "" },
    onSubmit: async ({ value }) => {
      if (
        !value.prompt.trim() ||
        admission.isPending ||
        (history.isPending && !!conversationId)
      )
        return;
      if (!agentId) {
        setSetup(true);
        return;
      }
      setError("");
      try {
        await admission.mutateAsync({
          prompt: value.prompt.trim(),
          agentId,
          id: conversationId,
        });
        composer.reset();
        requestAnimationFrame(() =>
          scroll.current?.scrollTo({
            top: scroll.current.scrollHeight,
            behavior: "smooth",
          }),
        );
      } catch (err) {
        setError(friendly(err));
      }
    },
  });
  const unlockForm = useForm({
    defaultValues: { token: "" },
    onSubmit: async ({ value }) => {
      try {
        await api("/session", { token: value.token });
        unlockForm.reset();
        await refresh();
        setError("");
      } catch (err) {
        setError(friendly(err));
      }
    },
  });
  const sending = admission.isPending;
  const before = history.hasNextPage;
  const displayError =
    error ||
    (conversation.error
      ? friendly(conversation.error)
      : history.error
        ? friendly(history.error)
        : workspace.error && !locked
          ? friendly(workspace.error)
          : "");
  const agent = state.agents.find(
      (a) => a.id === (selected?.agentId ?? agentId),
    ),
    target = state.targets.find((t) => t.id === agent?.targetId);
  const busy =
    !!selected?.archived ||
    runs.some((r) => active(r.status) || r.status === "unknown");
  if (!ready)
    return (
      <div className="gate">
        <BrandMark />
        <p className="muted">{t("Opening your workspace…")}</p>
      </div>
    );
  if (locked)
    return (
      <div className="gate">
        <div className="gate-preferences">
          <LanguageControl />
          <ThemeControl />
        </div>
        <section className="unlock-card">
          <BrandMark />
          <div className="eyebrow mt-7">{t("YOUR AGENTS. ONE WORKSPACE.")}</div>
          <h1>{t("Welcome to Orcabot")}</h1>
          <p className="muted mt-3 mb-7">
            {t(
              "Use the service key from your startup URL to open the workbench.",
            )}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void unlockForm.handleSubmit();
            }}
          >
            <label>
              <span className="flex items-center gap-2">
                <KeyRound size={14} />
                {t("Service key")}
              </span>
              <unlockForm.Field name="token">
                {(field) => (
                  <input
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    name="token"
                    type="password"
                    autoFocus
                    autoComplete="off"
                    required
                    minLength={32}
                  />
                )}
              </unlockForm.Field>
            </label>
            {error && (
              <p className="error-text mb-4" role="alert">
                {t(error)}
              </p>
            )}
            <button className="button primary w-full justify-center">
              {t("Open workspace")}
              <ArrowRight size={16} />
            </button>
          </form>
          <small className="block mt-6 muted">
            {t(
              "Your key grants access to this service and its execution targets.",
            )}
          </small>
        </section>
      </div>
    );
  return (
    <div className="workbench">
      {sidebar && (
        <aside className="sidebar">
          <div className="brand">
            <BrandMark small />
            <span>Orcabot</span>
            <span className="preview-tag">{t("PREVIEW")}</span>
            <button
              className="icon-button ml-auto"
              aria-label={t("Hide sidebar")}
              onClick={() => setSidebar(false)}
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
          <div className="workspace-switch">
            <span className="workspace-initial">O</span>
            <div>
              <strong>{t("My workspace")}</strong>
              <small>{t("Agent control center")}</small>
            </div>
            <ChevronDown size={13} className="ml-auto muted" />
          </div>
          <button
            className="new-conversation"
            onClick={() => {
              void navigate({ to: "/" });
              if (window.matchMedia("(max-width: 600px)").matches)
                setSidebar(false);
              setError("");
              composer.reset();
            }}
          >
            <Plus size={16} />
            {t("New conversation")}
            <span>↗</span>
          </button>
          <button
            className={`work-nav ${path.startsWith("/work") ? "selected" : ""}`}
            onClick={() => {
              void navigate({ to: "/work" });
              if (window.matchMedia("(max-width: 600px)").matches)
                setSidebar(false);
            }}
          >
            <ClipboardList size={16} />
            {t("Work items")}
          </button>
          <button
            className={`work-nav ${automationMode === "projects" ? "selected" : ""}`}
            onClick={() => void navigate({ to: "/projects" })}
          >
            <ClipboardList size={16} />
            {t("Projects")}
          </button>
          <button
            className={`work-nav ${automationMode === "routines" ? "selected" : ""}`}
            onClick={() => void navigate({ to: "/routines" })}
          >
            <BellDot size={16} />
            {t("Routines")}
          </button>
          <div className="section-heading">
            {t("CONVERSATIONS")}
            <span>{state.conversations.length}</span>
          </div>
          <nav className="conversation-nav">
            {state.conversations.length ? (
              state.conversations.map((c) => (
                <button
                  key={c.id}
                  className={selected?.id === c.id ? "selected" : ""}
                  onClick={() => {
                    void openConversation(c.id);
                    if (window.matchMedia("(max-width: 600px)").matches)
                      setSidebar(false);
                    setError("");
                  }}
                >
                  <MessageSquare size={14} />
                  <span>{c.title}</span>
                </button>
              ))
            ) : (
              <div className="sidebar-empty">
                {t("Your conversations will appear here.")}
              </div>
            )}
          </nav>
          <div className="sidebar-bottom">
            <button onClick={() => setAttention(true)}>
              <BellDot size={15} />
              {t("Needs attention")}
            </button>
            <button onClick={() => setSetup(true)}>
              <Settings2 size={15} />
              {t("Agents & connections")}
              <span>{state.agents.length}</span>
            </button>
            <div className="local-label">
              <span className="connection-dot" />
              {t("Self-hosted workspace")}
            </div>
          </div>
        </aside>
      )}
      <main className="main">
        <header className="topbar">
          <div className="flex items-center gap-3 min-w-0">
            {!sidebar && (
              <button
                className="icon-button"
                aria-label={t("Show sidebar")}
                onClick={() => setSidebar(true)}
              >
                <PanelLeft size={17} />
              </button>
            )}
            <span className="muted hidden sm:inline">{t("Workspace")}</span>
            <span className="muted hidden sm:inline">/</span>
            <span className="truncate">
              {workMode
                ? t("Work items")
                : (selected?.title ?? t("New conversation"))}
            </span>
          </div>
          <div className="topbar-status">
            <LanguageControl />
            <ThemeControl />
            <button
              className="icon-button"
              aria-label={t("Open attention")}
              onClick={() => setAttention(true)}
            >
              <BellDot size={16} />
            </button>
            <span className="connection-dot" />
            <span className="connection-label">{t("Connected")}</span>{" "}
            <button
              className="icon-button"
              aria-label={t("Open settings")}
              onClick={() => setSetup(true)}
            >
              <Settings2 size={16} />
            </button>
          </div>
        </header>
        <div
          className="content-scroll"
          ref={scroll}
          role="region"
          aria-label={t("Conversation history")}
          tabIndex={0}
        >
          {automationMode ? (
            <Automation mode={automationMode} state={state} />
          ) : workMode ? (
            <Board
              state={state}
              workId={workId}
              onSetup={() => setSetup(true)}
            />
          ) : runs.length ? (
            <div className="transcript">
              {before && (
                <button
                  className="button mx-auto mb-6"
                  disabled={history.isFetchingNextPage}
                  onClick={() => void history.fetchNextPage()}
                >
                  {t("Load earlier runs")}
                </button>
              )}
              <VirtualRuns
                key={conversationId}
                runs={runs}
                scroll={scroll}
                onDone={refreshRuns}
              />
            </div>
          ) : conversationId ? (
            <div className="gate">
              <p className="muted">
                {history.isPending
                  ? t("Loading conversation…")
                  : t("No runs in this conversation yet.")}
              </p>
            </div>
          ) : (
            <section className="welcome">
              <div className="hero-mark">◒</div>
              <div className="eyebrow">
                {t("ONE WORKSPACE. MANY POSSIBILITIES.")}
              </div>
              <h1>{t("What are we working on?")}</h1>
              <p>
                {t("Connect your agents. Give them direction.")}
                <br />
                {t("Keep every run in sight, wherever it happens.")}
              </p>
              <div className="welcome-cards">
                <button onClick={() => setSetup(true)}>
                  <div className="welcome-icon">
                    <Bot size={19} />
                  </div>
                  <strong>
                    {state.agents.length
                      ? t("Manage your agents")
                      : t("Create your first agent")}
                  </strong>
                  <span>{t("Choose a harness, model and workspace.")}</span>
                  <ArrowRight size={15} />
                </button>
                <button onClick={() => setSetup(true)}>
                  <div className="welcome-icon">
                    <Globe2 size={19} />
                  </div>
                  <strong>{t("Connect an execution target")}</strong>
                  <span>{t("Work locally or on another machine.")}</span>
                  <ArrowRight size={15} />
                </button>
              </div>
              <div className="welcome-footnote">
                <Command size={12} />{" "}
                {t("A focused place for headless agent work.")}
              </div>
            </section>
          )}
        </div>
        {!workMode && (
          <div className="composer-wrap">
            {displayError && (
              <div className="error-banner" role="alert">
                {t(displayError)}
                <button
                  onClick={() => setError("")}
                  aria-label={t("Dismiss error")}
                >
                  ×
                </button>
              </div>
            )}
            <form
              ref={form}
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                void composer.handleSubmit();
              }}
            >
              <composer.Field name="prompt">
                {(field) => (
                  <textarea
                    aria-label={t("Message your agent")}
                    placeholder={
                      agent
                        ? t("Describe what you want your agent to do…")
                        : t("Create an agent to get started…")
                    }
                    rows={3}
                    maxLength={32000}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.nativeEvent.isComposing
                      ) {
                        e.preventDefault();
                        form.current?.requestSubmit();
                      }
                    }}
                  />
                )}
              </composer.Field>
              <div className="composer-tools">
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t("Agent settings")}
                  onClick={() => setSetup(true)}
                >
                  <Plus size={18} />
                </button>
                <div className="agent-picker">
                  <Bot size={13} />
                  <select
                    aria-label={t("Agent")}
                    disabled={!!selected}
                    value={selected?.agentId ?? agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                  >
                    {!state.agents.length && (
                      <option value="">{t("Select an agent")}</option>
                    )}
                    {state.agents.map((a) => (
                      <option value={a.id} key={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} />
                </div>
                {agent && (
                  <span className="model-label">
                    {agent.model ?? t("Provider default")}
                    {agent.effort ? ` · ${t(agent.effort)}` : ""}
                  </span>
                )}
                <composer.Subscribe selector={(state) => state.values.prompt}>
                  {(prompt) => (
                    <button
                      className="send-button"
                      aria-label={t("Send message")}
                      disabled={
                        !prompt.trim() ||
                        sending ||
                        busy ||
                        (!!conversationId &&
                          (history.isPending || conversation.isError))
                      }
                    >
                      <ArrowUp size={18} />
                    </button>
                  )}
                </composer.Subscribe>
              </div>
            </form>
            <div className="composer-footer">
              <span>
                {target ? (
                  <>
                    <Server size={11} />
                    {target.name}
                    <span className="footer-dot">·</span>
                    {agent?.adapter}
                  </>
                ) : (
                  t("No execution target selected")
                )}
              </span>
              <span>
                {t("Enter to send")}{" "}
                <span className="hidden sm:inline">
                  {t("· Shift + Enter for a new line")}
                </span>
              </span>
            </div>
          </div>
        )}
      </main>
      {attention && (
        <Attention
          onClose={() => {
            setAttention(false);
            refreshRuns();
          }}
          onOpen={openConversation}
        />
      )}
      {setup && (
        <Setup
          state={state}
          onClose={() => setSetup(false)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
