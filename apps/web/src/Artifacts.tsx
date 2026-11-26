import { useI18n } from "./i18n.js";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { FileText, Plus, X, ExternalLink, Copy, Check } from "lucide-react";
import type { ArtifactPage } from "orcabot-contracts";
import { api, friendly } from "./api.js";
import { Dialog } from "./Dialog.js";
export function Artifacts({
  runId,
  onClose,
}: {
  runId: string;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const [before, setBefore] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const client = useQueryClient();
  const artifacts = useQuery({
    queryKey: ["artifacts", runId, before],
    queryFn: () =>
      api<ArtifactPage>(
        `/runs/${runId}/artifacts${before === null ? "" : `?before=${before}`}`,
      ),
  });
  const page = artifacts.data;
  const attach = useMutation({
    mutationFn: (data: Record<string, string>) =>
      api(
        `/runs/${runId}/artifacts`,
        Object.fromEntries(
          Object.entries(data).filter(([, value]) => value !== ""),
        ),
      ),
  });
  const form = useForm({
    defaultValues: {
      name: "",
      uri: "",
      mediaType: "",
      sha256: "",
      summary: "",
    },
    onSubmit: async ({ value }) => {
      setError("");
      try {
        await attach.mutateAsync(value);
        form.reset();
        setBefore(null);
        await client.invalidateQueries({ queryKey: ["artifacts", runId] });
      } catch (err) {
        setError(friendly(err));
      }
    },
  });
  const saving = attach.isPending;
  const displayError =
    error || (artifacts.error ? friendly(artifacts.error) : "");
  return (
    <Dialog
      title={t("Run artifacts")}
      onClose={onClose}
      className="artifact-panel"
      initialFocus="panel"
    >
      <div className="dialog-heading">
        <div>
          <h2>{t("Run artifacts")}</h2>
        </div>
        <button
          className="icon-button"
          aria-label={t("Close artifacts")}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <p className="muted my-4">
        {t(
          "Attach locations of deliverables and evidence. References are unverified; Orcabot does not read or upload their contents.",
        )}
      </p>
      {displayError && (
        <p className="error-text mb-4" role="alert">
          {t(displayError)}
        </p>
      )}
      <div className="artifact-items">
        {!page && <p className="muted">{t("Loading artifacts…")}</p>}
        {page?.items.length === 0 && (
          <p className="muted">{t("No artifact references attached.")}</p>
        )}
        {page?.items.map((item) => (
          <article className="artifact-item" key={item.id}>
            <div className="flex gap-2 items-center">
              <FileText size={16} />
              <strong>{item.name}</strong>
              <span className="artifact-tag">{t("Unverified")}</span>
            </div>
            {/^https?:/.test(item.uri) ? (
              <a
                href={item.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="artifact-location"
              >
                {item.uri}
                <ExternalLink size={12} />
              </a>
            ) : (
              <code className="artifact-location">{item.uri}</code>
            )}
            <button
              type="button"
              className="text-button artifact-copy"
              onClick={() => {
                void (async () => {
                  try {
                    if (!navigator.clipboard?.writeText)
                      throw Error("Clipboard unavailable");
                    await navigator.clipboard.writeText(item.uri);
                    setCopied(item.id);
                    setError("");
                  } catch {
                    setCopied("");
                    setError(
                      "Could not copy the location. Select and copy it manually.",
                    );
                  }
                })();
              }}
            >
              {copied === item.id ? <Check size={13} /> : <Copy size={13} />}{" "}
              {t(copied === item.id ? "Location copied" : "Copy location")}
            </button>
            {item.summary && <p className="mt-2 text-sm">{item.summary}</p>}
            <small className="muted">
              {item.mediaType ?? t("Unspecified type")} ·{" "}
              {new Date(item.createdAt).toLocaleString(
                locale === "zh" ? "zh-CN" : "en-US",
              )}
            </small>
            {item.sha256 && (
              <code className="artifact-digest">SHA-256 {item.sha256}</code>
            )}
          </article>
        ))}
      </div>
      <div className="flex gap-2 my-4">
        {before !== null && (
          <button className="button" onClick={() => setBefore(null)}>
            {t("Latest artifacts")}
          </button>
        )}
        {page?.nextBefore !== null && page?.nextBefore !== undefined && (
          <button className="button" onClick={() => setBefore(page.nextBefore)}>
            {t("Earlier artifacts")}
          </button>
        )}
      </div>
      <form
        className="artifact-form"
        onInvalidCapture={(event) => {
          const details = (
            event.target as HTMLElement
          ).closest<HTMLDetailsElement>("details");
          if (details) details.open = true;
          setError("Check the highlighted reference fields.");
        }}
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <h3>{t("Attach a reference")}</h3>
        <label>
          {t("Name")}
          <form.Field name="name">
            {(field) => (
              <input
                name="name"
                placeholder={t("Implementation report")}
                required
                maxLength={160}

                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            )}
          </form.Field>
        </label>
        <label>
          {t("Location")}
          <form.Field name="uri">
            {(field) => (
              <input
                name="uri"
                type="url"
                placeholder={t("https://… or file:///…")}
                required
                maxLength={4096}

                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            )}
          </form.Field>
        </label>
        <details className="advanced artifact-metadata">
          <summary>{t("Metadata options")}</summary>
          <div className="field-grid">
            <label>
              {t("Media type")}
              <form.Field name="mediaType">
                {(field) => (
                  <input
                    name="mediaType"
                    placeholder="text/markdown"
                    maxLength={128}

                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                )}
              </form.Field>
            </label>
            <label>
              SHA-256
              <form.Field name="sha256">
                {(field) => (
                  <input
                    name="sha256"
                    pattern="[0-9a-fA-F]{64}"
                    placeholder={t("Optional digest")}

                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                )}
              </form.Field>
            </label>
          </div>
        </details>
        <label>
          {t("Summary")}
          <form.Field name="summary">
            {(field) => (
              <textarea
                name="summary"
                rows={2}
                maxLength={4000}
                placeholder={t("What does this artifact demonstrate?")}

                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            )}
          </form.Field>
        </label>
        <div className="dialog-footer">
          <button type="button" className="button" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button className="button primary" disabled={saving}>
            <Plus size={14} />
            {saving ? t("Attaching…") : t("Attach reference")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
