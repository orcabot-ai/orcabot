import { useI18n } from "./i18n.js";
import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { X, ArrowRight, Server, Bot } from "lucide-react";
import type { State } from "orcabot-contracts";
import { api, friendly } from "./api.js";
import { Dialog } from "./Dialog.js";
export function Setup({
  state,
  onClose,
  onSaved,
}: {
  state: State;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"agent" | "target">(
      state.targets.length ? "agent" : "target",
    ),
    [error, setError] = useState(""),
    [kind, setKind] = useState("local");
  const save = useMutation({
    mutationFn: async (values: {
      name: string;
      endpoint: string;
      url: string;
      token: string;
      targetId: string;
      adapter: string;
      workdir: string;
      model: string;
      effort: string;
      mcp: string;
    }) => {
      if (tab === "target")
        await api(
          "/targets",
          kind === "local"
            ? { name: values.name, kind, endpoint: values.endpoint }
            : { name: values.name, kind, url: values.url, token: values.token },
        );
      else
        await api("/agents", {
          name: values.name,
          targetId: values.targetId,
          adapter: values.adapter,
          workdir: values.workdir,
          ...(values.model ? { model: values.model } : {}),
          ...(values.effort ? { effort: values.effort } : {}),
          mcp: JSON.parse(values.mcp || "{}"),
        });
      await onSaved();
    },
  });
  const form = useForm({
    defaultValues: {
      name: "",
      endpoint: "",
      url: "",
      token: "",
      targetId: state.targets[0]?.id ?? "",
      adapter: "codex",
      workdir: "",
      model: "",
      effort: "",
      mcp: "{}",
    },
    onSubmit: async ({ value }) => {
      setError("");
      try {
        await save.mutateAsync(value);
        form.reset();
        if (tab === "target") setTab("agent");
        else onClose();
      } catch (err) {
        setError(
          err instanceof SyntaxError
            ? "MCP configuration must be a valid JSON object."
            : friendly(err),
        );
      }
    },
  });
  const saving = save.isPending;
  return (
    <Dialog title={t("Connect your agents")} onClose={onClose}>
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">{t("WORKSPACE SETTINGS")}</div>
          <h2 id="setup-title">{t("Connect your agents")}</h2>
        </div>
        <button
          className="icon-button"
          aria-label={t("Close settings")}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="setup-tabs">
        <button
          className={tab === "agent" ? "selected" : ""}
          onClick={() => setTab("agent")}
        >
          <Bot size={15} />
          {t("Agents")}
        </button>
        <button
          className={tab === "target" ? "selected" : ""}
          onClick={() => setTab("target")}
        >
          <Server size={15} />
          {t("Execution targets")}
        </button>
      </div>
      <form
        key={`${tab}-${kind}-${state.targets.length}`}
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        {tab === "target" ? (
          <>
            <p className="muted mb-5">
              {t(
                "Connect a local Kernel or an Orcabot service running on another machine.",
              )}
            </p>
            <label>
              {t("Name")}
              <form.Field name="name">
                {(field) => (
                  <input
                    name="name"
                    required
                    maxLength={160}
                    placeholder={t("Development machine")}

                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                )}
              </form.Field>
            </label>
            <label>
              {t("Connection")}
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="local">{t("Local Kernel IPC")}</option>
                <option value="remote">{t("Remote Orcabot bridge")}</option>
              </select>
            </label>
            {kind === "local" ? (
              <label>
                {t("Kernel endpoint")}
                <form.Field name="endpoint">
                  {(field) => (
                    <input
                      name="endpoint"
                      required
                      placeholder="/absolute/path/to/kernel.sock"

                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                    />
                  )}
                </form.Field>
                <small>
                  {t(
                    "Use the IPC endpoint supplied by your running OctoRuntime service.",
                  )}
                </small>
              </label>
            ) : (
              <>
                <label>
                  {t("Service URL")}
                  <form.Field name="url">
                    {(field) => (
                      <input
                        name="url"
                        type="url"
                        required
                        placeholder="https://your-worker.example.com"

                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                      />
                    )}
                  </form.Field>
                </label>
                <label>
                  {t("Service key")}
                  <form.Field name="token">
                    {(field) => (
                      <input
                        name="token"
                        type="password"
                        autoComplete="off"
                        required
                        minLength={32}

                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                      />
                    )}
                  </form.Field>
                  <small>
                    {t(
                      "Stored only on the control server. Use HTTPS or a trusted tunnel.",
                    )}
                  </small>
                </label>
              </>
            )}
          </>
        ) : (
          <>
            <p className="muted mb-5">
              {t(
                "An Agent is a reusable execution configuration. Each run keeps its own snapshot.",
              )}
            </p>
            <label>
              {t("Name")}
              <form.Field name="name">
                {(field) => (
                  <input
                    name="name"
                    required
                    maxLength={160}
                    placeholder={t("My engineering agent")}

                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                )}
              </form.Field>
            </label>
            <div className="field-grid">
              <label>
                {t("Execution target")}
                <form.Field name="targetId">
                  {(field) => (
                    <select
                      name="targetId"
                      required

                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                    >
                      <option value="" disabled>
                        {t("Select a target")}
                      </option>
                      {state.targets.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}
                </form.Field>
              </label>
              <label>
                {t("Harness adapter")}
                <form.Field name="adapter">
                  {(field) => (
                    <input
                      name="adapter"
                      required
                      placeholder="codex"
                      pattern="[a-z0-9][a-z0-9._-]*"

                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                    />
                  )}
                </form.Field>
              </label>
            </div>
            <label>
              {t("Working directory")}
              <form.Field name="workdir">
                {(field) => (
                  <input
                    name="workdir"
                    required
                    placeholder="/absolute/path/on/execution-machine"

                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                )}
              </form.Field>
              <small>
                {t(
                  "The directory must already exist on the execution machine.",
                )}
              </small>
            </label>
            <div className="field-grid">
              <label>
                {t("Model")}
                <form.Field name="model">
                  {(field) => (
                    <input
                      name="model"
                      placeholder={t("Provider default")}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                    />
                  )}
                </form.Field>
              </label>
              <label>
                {t("Reasoning effort")}
                <form.Field name="effort">
                  {(field) => (
                    <select
                      name="effort"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                    >
                      <option value="">{t("Provider default")}</option>
                      {["low", "medium", "high", "xhigh"].map((e) => (
                        <option key={e} value={e}>
                          {t(e)}
                        </option>
                      ))}
                    </select>
                  )}
                </form.Field>
              </label>
            </div>
            <details className="advanced">
              <summary>
                {t("MCP servers")}
                <span>{t("Optional")}</span>
              </summary>
              <label className="mt-3">
                {t("Server map (JSON)")}
                <form.Field name="mcp">
                  {(field) => (
                    <textarea
                      name="mcp"
                      rows={5}
                      spellCheck={false}

                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                    />
                  )}
                </form.Field>
                <small>
                  {t(
                    "Use the OctoRuntime public MCP server map. Credentials remain on the service.",
                  )}
                </small>
              </label>
            </details>
          </>
        )}
        {error && (
          <div className="error-text my-3" role="alert">
            {t(error)}
          </div>
        )}
        <button
          className="button primary w-full justify-center mt-4"
          disabled={saving || (tab === "agent" && !state.targets.length)}
        >
          {saving
            ? t("Saving…")
            : tab === "target"
              ? t("Connect target")
              : t("Create agent")}
          <ArrowRight size={15} />
        </button>
        {tab === "agent" && !state.targets.length && (
          <button
            type="button"
            className="text-button mt-3"
            onClick={() => setTab("target")}
          >
            {t("Add an execution target first")}
          </button>
        )}
      </form>
    </Dialog>
  );
}
