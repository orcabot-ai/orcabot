import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  plugins: [tailwind(), tanstackStart({ spa: { enabled: true } }), react()],
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:4310" } },
  build: { sourcemap: true },
});
