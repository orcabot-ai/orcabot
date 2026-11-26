import { Home } from "./Home.js";
import { Landing } from "./Landing.js";
import { Select } from "./Select.js";
import { Dialog } from "./Dialog.js";
import { Automation } from "./Automation.js";
import { BrandMark } from "./BrandMark.js";
import { Board } from "./Board.js";
import { LanguageControl, useI18n } from "./i18n.js";
import { useCallback, useEffect, useRef, useState } from "react";
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
  Folder,
  Clock3,
  Server,
  KeyRound,
  ArrowRight,
  Bot,
  BellDot,
  ClipboardList,
  House,
  X,
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
  const { t, locale } = useI18n();
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
  const [narrow, setNarrow] = useState(
    () => window.matchMedia("(max-width: 600px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 600px)");
    const update = () => {
      setNarrow(media.matches);
      setSidebar(!media.matches);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const scroll = useRef<HTMLDivElement>(null);
  const navigationToggle = useRef<HTMLButtonElement>(null);
  const closeNavigation = () => {
    setSidebar(false);
    requestAnimationFrame(() => navigationToggle.current?.focus());
  };
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
    void client.invalidateQueries({ queryKey: ["activity"] });
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
      await client.invalidateQueries({ queryKey: ["activity"] });
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
        if (path === "/welcome") await navigate({ to: "/" });
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
  if (locked || path === "/welcome")
    return (
      <Landing keyRequired={locked}>
        {locked ? (
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
              {t("Open Orcabot")}
              <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <button
            className="button primary w-full justify-center"
            onClick={() => void navigate({ to: "/" })}
          >
            {t("Open Orcabot")}
            <ArrowRight size={16} />
          </button>
        )}
      </Landing>
    );
  const composerPanel = (
    <div className="composer-wrap">
      {displayError && (
        <div className="error-banner" role="alert">
          {t(displayError)}
          <button onClick={() => setError("")} aria-label={t("Dismiss error")}>
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
                  ? t("What would you like to get done?")
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
            <Select
              aria-label={t("Agent")}
              disabled={!!selected}
              value={selected?.agentId ?? agentId}
              onValueChange={(next) => setAgentId(next)}
            >
              {!state.agents.length && (
                <option value="">{t("Select an agent")}</option>
              )}
              {state.agents.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
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
        <details className="composer-context">
          <summary>
            <Server size={11} />
            {t("Execution details")}
          </summary>
          <span>
            {target ? (
              <>
                {target.name} · {agent?.adapter}
              </>
            ) : (
              t("No execution target selected")
            )}
          </span>
        </details>
        <span>
          {t("Enter to send")}{" "}
          <span className="hidden sm:inline">
            {t("· Shift + Enter for a new line")}
          </span>
        </span>
      </div>
    </div>
  );
  const navigation = (
    <aside
      id="workspace-navigation"
      className="sidebar"
      aria-label={t("Workspace navigation")}
    >
      <div className="brand">
        <BrandMark small />
        <span>Orcabot</span>
        <button
          className="icon-button ml-auto"
          aria-label={t("Hide sidebar")}
          onClick={closeNavigation}
        >
          {narrow ? <X size={18} /> : <PanelLeftClose size={16} />}
        </button>
      </div>
      <button
        className={`work-nav ${path === "/" ? "selected" : ""}`}
        aria-current={path === "/" ? "page" : undefined}
        onClick={() => {
          void navigate({ to: "/" });
          if (narrow) setSidebar(false);
        }}
      >
        <House size={16} />
        {t("Home")}
      </button>
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
      </button>
      <button
        className={`work-nav ${path.startsWith("/work") ? "selected" : ""}`}
        aria-current={path.startsWith("/work") ? "page" : undefined}
        onClick={() => {
          void navigate({ to: "/work" });
          if (window.matchMedia("(max-width: 600px)").matches)
            setSidebar(false);
        }}
      >
        <ClipboardList size={16} />
        {t("Tasks")}
      </button>
      <button
        className={`work-nav ${automationMode === "projects" ? "selected" : ""}`}
        aria-current={automationMode === "projects" ? "page" : undefined}
        onClick={() => {
          void navigate({ to: "/projects" });
          if (narrow) setSidebar(false);
        }}
      >
        <Folder size={16} />
        {t("Projects")}
      </button>
      <button
        className={`work-nav ${automationMode === "routines" ? "selected" : ""}`}
        aria-current={automationMode === "routines" ? "page" : undefined}
        onClick={() => {
          void navigate({ to: "/routines" });
          if (narrow) setSidebar(false);
        }}
      >
        <Clock3 size={16} />
        {t("Routines")}
      </button>
      <div className="section-heading">
        {t("Threads")}
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
              <span>
                {c.title}
                <small className="thread-time">
                  {new Date(c.createdAt).toLocaleString(
                    locale === "zh" ? "zh-CN" : "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
                </small>
              </span>
            </button>
          ))
        ) : (
          <div className="sidebar-empty">
            {t("Your conversations will appear here.")}
          </div>
        )}
      </nav>
      <div className="sidebar-bottom">
        <button
          onClick={() => {
            if (narrow) setSidebar(false);
            setAttention(true);
          }}
        >
          <BellDot size={15} />
          {t("Needs attention")}
        </button>
        <button
          onClick={() => {
            if (narrow) setSidebar(false);
            setSetup(true);
          }}
        >
          <Settings2 size={15} />
          {t("Settings")}
          <span>{state.agents.length}</span>
        </button>
        <div className="local-label">
          <span className="connection-dot" />
          {t("Your workspace")}
        </div>
      </div>
    </aside>
  );
  return (
    <div className="workbench">
      <a className="skip-link" href="#workspace-content">
        {t("Skip to content")}
      </a>
      {sidebar &&
        (narrow ? (
          <Dialog
            title={t("Workspace navigation")}
            className="sidebar-drawer"
            onClose={closeNavigation}
          >
            {navigation}
          </Dialog>
        ) : (
          navigation
        ))}
      <main className="main" inert={narrow && sidebar}>
        <header className="topbar">
          <div className="flex items-center gap-3 min-w-0">
            {(narrow || !sidebar) && (
              <button
                ref={navigationToggle}
                className="icon-button"
                aria-label={t("Show sidebar")}
                aria-expanded={sidebar}
                aria-controls="workspace-navigation"
                onClick={() => setSidebar(true)}
              >
                <PanelLeft size={17} />
              </button>
            )}
            <span className="muted hidden sm:inline">{t("Workspace")}</span>
            <span className="muted hidden sm:inline">/</span>
            <span className="truncate">
              {automationMode
                ? t(automationMode === "projects" ? "Projects" : "Routines")
                : workMode
                  ? t("Tasks")
                  : (selected?.title ?? t("Home"))}
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
          id="workspace-content"
          className="content-scroll"
          ref={scroll}
          role="region"
          aria-label={t(
            workMode
              ? automationMode === "projects"
                ? "Projects"
                : automationMode === "routines"
                  ? "Routines"
                  : "Tasks"
              : conversationId
                ? "Conversation history"
                : "Your assistant",
          )}
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
            <Home
              state={state}
              agent={agent}
              target={target}
              composer={composerPanel}
              onOpenConversation={openConversation}
              onAttention={() => setAttention(true)}
            />
          )}
        </div>
        {!workMode && !!conversationId && composerPanel}
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
