import { createFileRoute } from "@tanstack/react-router";
import { App } from "../App.js";
export const Route = createFileRoute("/conversations/$conversationId")({
  ssr: false,
  component: App,
});
