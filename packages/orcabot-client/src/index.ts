import type { BoardState, WorkDetail } from "orcabot-contracts";

export class BoardClientError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly commandId?: string,
  ) {
    super(code);
  }
}
/** A trusted-operator client; profiles do not confer independent worker permissions. */
export class BoardClient {
  private readonly origin: string;
  constructor(
    private readonly options: {
      url: string;
      token: string;
      fetch?: typeof fetch;
    },
  ) {
    const url = new URL(options.url);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error("USE_HTTP_SERVICE_ORIGIN");
    if (options.token.length < 32 || options.token.length > 512)
      throw new Error("INVALID_SERVICE_KEY");
    this.origin = url.origin;
  }
  async request<T>(path: string, body?: Record<string, unknown>): Promise<T> {
    if (
      path !== "/board" &&
      !path.startsWith("/board/") &&
      !path.startsWith("/board?")
    )
      throw new Error("INVALID_BOARD_PATH");
    if (path.includes("..") || path.includes("\\") || path.includes("#"))
      throw new Error("INVALID_BOARD_PATH");
    const destination = new URL("/api" + path, this.origin);
    if (
      destination.pathname !== "/api/board" &&
      !destination.pathname.startsWith("/api/board/")
    )
      throw new Error("INVALID_BOARD_PATH");
    const response = await (this.options.fetch ?? fetch)(destination.href, {
      method: body ? "POST" : "GET",
      redirect: "manual",
      headers: {
        authorization: `Bearer ${this.options.token}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status >= 300 && response.status < 400)
      throw new BoardClientError(
        "REDIRECT_REJECTED",
        response.status,
        body?.commandId as string | undefined,
      );
    const value = (await response.json()) as Record<string, unknown>;
    if (!response.ok)
      throw new BoardClientError(
        typeof value.error === "string" ? value.error : "REQUEST_FAILED",
        response.status,
        body?.commandId as string | undefined,
      );
    return value as T;
  }
  list(before?: number) {
    return this.request<BoardState>(
      `/board${before === undefined ? "" : `?before=${before}`}`,
    );
  }
  detail(id: string) {
    return this.request<WorkDetail>(`/board/work/${encodeURIComponent(id)}`);
  }
  command<T>(path: string, body: Record<string, unknown>, commandId: string) {
    // Callers retain this identity and reuse the same body when the outcome of a transport attempt is unknown.
    return this.request<T>(path, { ...body, commandId });
  }
}
