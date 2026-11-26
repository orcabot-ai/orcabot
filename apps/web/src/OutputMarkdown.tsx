import Markdown from "react-markdown";

/** Relative output locations belong to the execution machine, not the web app. */
export function OutputMarkdown({ children }: { children: string }) {
  return (
    <Markdown
      components={{
        a({ href, children }) {
          if (!href) return <span>{children}</span>;
          if (/^(?:https?:|mailto:|#)/i.test(href))
            return (
              <a
                href={href}
                target={href.startsWith("#") ? undefined : "_blank"}
                rel="noopener noreferrer"
              >
                {children}
              </a>
            );
          return (
            <span className="output-location" title={href}>
              {children}
              <code>{href}</code>
            </span>
          );
        },
      }}
    >
      {children}
    </Markdown>
  );
}
