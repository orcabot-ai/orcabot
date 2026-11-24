import { createFileRoute } from "@tanstack/react-router";
import { App } from "../App.js";
export const Route = createFileRoute("/work/$workId")({
  ssr: false,
  component: App,
});
