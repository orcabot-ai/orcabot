import { createFileRoute } from "@tanstack/react-router";
import { App } from "../App.js";
export const Route = createFileRoute("/projects")({
  component: App,
  ssr: false,
});
