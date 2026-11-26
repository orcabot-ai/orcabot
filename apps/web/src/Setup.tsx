import { Select } from "./Select.js";
import { useI18n } from "./i18n.js";
import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { X, Server, Bot } from "lucide-react";
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
    [kind, setKind] = useState("local"),
    [showKey, setShowKey] = useState(false);
  const localEndpoint =
    state.targets.find((target) => target.kind === "local")?.endpoint ?? "";
  const title =
    tab === "agent"
      ? "Create agent"
      : kind === "local"
        ? "Local connection"
        : "Remote connection";
  const description =
    tab === "agent"
      ? "Give your assistant a place to work."
      : kind === "local"
        ? "Use this computer's configured connection."
        : "Connect to a worker on another machine.";
  function changeTab(next: "agent" | "target") {
    setTab(next);
    setShowKey(false);
    setError("");
  }
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
      endpoint: localEndpoint,
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
        setShowKey(false);
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
    <Dialog title={t(title)} onClose={onClose} className="connection-setup">
      <div className="dialog-heading">
        <div>
          <h2 id="setup-title">{t(title)}</h2>
          <p>{t(description)}</p>
        </div>
        <button
          className="icon-button"
          aria-label={t("Close settings")}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div
        className="setup-tabs"
        role="group"
        aria-label={t("Connection setup")}
      >
        <button
          className={tab === "agent" ? "selected" : ""}
          aria-pressed={tab === "agent"}
          onClick={() => changeTab("agent")}
        >
          <Bot size={15} />
          {t("Agents")}
        </button>
        <button
          className={tab === "target" ? "selected" : ""}
          aria-pressed={tab === "target"}
          onClick={() => changeTab("target")}
        >
          <Server size={15} />
          {t("Execution targets")}
        </button>
      </div>
      <form
        className="setup-form"
        key={`${tab}-${state.targets.length}`}
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        {tab === "target" ? (
          <>
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
              <Select
                value={kind}
                onValueChange={(next) => {
                  setKind(next);
                  setShowKey(false);
                  setError("");
                }}
              >
                <option value="local">{t("This computer")}</option>
                <option value="remote">{t("Remote worker")}</option>
              </Select>
            </label>
            {kind === "local" ? (
              <details
                className="advanced endpoint-disclosure"
                open={!localEndpoint}
              >
                <summary>{t("Advanced local endpoint")}</summary>
                <label>
                  {t("Kernel endpoint")}
                  <form.Field name="endpoint">
                    {(field) => (
                      <input
                        name="endpoint"
                        required
                        onInvalid={(event) => {
                          const details =
                            event.currentTarget.closest("details");
                          if (details) details.open = true;
                        }}
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
              </details>
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
                      <div className="secret-input">
                        <input
                          name="token"
                          type={showKey ? "text" : "password"}
                          autoComplete="off"
                          required
                          minLength={32}

                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                        />
                        <button
                          type="button"
                          aria-label={t(
                            showKey ? "Hide service key" : "Show service key",
                          )}
                          aria-pressed={showKey}
                          onClick={() => setShowKey(!showKey)}
                        >
                          {t(showKey ? "Hide" : "Show")}
                        </button>
                      </div>
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
            <label>
              {t("Name")}
              <form.Field name="name">
                {(field) => (
                  <input
                    name="name"
                    required
                    maxLength={160}
                    placeholder={t("My assistant")}

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
                    <Select
                      name="targetId"
                      required

                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onValueChange={(next) => field.handleChange(next)}
                    >
                      <option value="" disabled>
                        {t("Select a target")}
                      </option>
                      {state.targets.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
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
                    <Select
                      name="effort"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onValueChange={(next) => field.handleChange(next)}
                    >
                      <option value="">{t("Provider default")}</option>
                      {["low", "medium", "high", "xhigh"].map((e) => (
                        <option key={e} value={e}>
                          {t(e)}
                        </option>
                      ))}
                    </Select>
                  )}
                </form.Field>
              </label>
            </div>
            <details className="advanced">
              <summary>{t("MCP advanced")}</summary>
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
        <div className="dialog-footer">
          <button type="button" className="button" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button
            className="button primary"
            disabled={saving || (tab === "agent" && !state.targets.length)}
          >
            {saving
              ? t("Saving…")
              : tab === "target"
                ? t("Connect target")
                : t("Create agent")}
          </button>
        </div>
        {tab === "agent" && !state.targets.length && (
          <button
            type="button"
            className="text-button mt-3"
            onClick={() => changeTab("target")}
          >
            {t("Add an execution target first")}
          </button>
        )}
      </form>
    </Dialog>
  );
}
