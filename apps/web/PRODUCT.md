# Orcabot product context

schema: 1
platform: web

Orcabot is a personal AI assistant for delegating work, retaining context in threads, following task progress and reviewing results. Tasks and conversations are the core, not multi-agent orchestration. It runs with a local or remote worker backed by OctoRuntime, with SQLite persistence. Execution completion is distinct from business acceptance.

The browser UI uses React, TanStack and Tailwind. English is the default language, with Simplified Chinese and a session locale preference. Both light and dark themes are supported. Service-key authentication and protected deep-link recovery must remain intact.

## Entry surface

The owner clarified on 2026-11-27 that `/welcome` is a **login page**, not a marketing landing page. It must remain one screen with no vertical page scrolling, a 70% visual / 30% entry split on desktop, a small supplied brand mark, and a real login form. No task-story demo, marketing sections or feature cards belong here. The previous ocean artwork and giant whale motifs were rejected; the visual treatment is delegated. On narrow phones prioritize the actual login and preserve a compact brand surface without overflow.
