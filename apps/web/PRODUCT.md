# Orcabot product context

schema: 1
platform: web

Orcabot is a personal AI assistant for delegating work, retaining context in threads, following task progress and reviewing results. Tasks and conversations are the core, not multi-agent orchestration. It runs with a local or remote worker backed by OctoRuntime, with SQLite persistence. Execution completion is distinct from business acceptance.

The browser UI uses React, TanStack and Tailwind. English is the default language, with Simplified Chinese and a session locale preference. Both light and dark themes are supported. Service-key authentication and protected deep-link recovery must remain intact.

## Entry surface

The owner clarified on 2026-11-27 that `/welcome` is a **login page**, not a marketing landing page. It must remain one screen with no vertical page scrolling, a small supplied brand mark and a real login form. No task-story demo, marketing sections or feature cards belong here. Preserve service-key authentication, protected deep-link recovery, theme and locale persistence, and bilingual HTML copy.

The latest approved direction replaces the earlier 70% visual / 30% entry split: use one continuous full-screen background with an inset floating sign-in panel on the right. The owner approved `output/artwork/orcabot-poster/background.jpg` for installation; ship optimized local variants of that artwork. Keep the original small brand at the top left and the personal-AI statement at the lower left. The panel is opaque and theme-aware. The shell is full bleed with no enclosing rounded frame; the floating panel itself has soft corners and a restrained shadow.

On narrow screens, center the panel below the compact brand and hide the secondary statement while retaining the continuous background. Short screens scroll only inside the form, keeping preferences accessible. Detailed ocean scenery, giant whale motifs and the hard split were rejected; the approved blue filament artwork is the current visual authority. The implementation contract lives in `../../.octospec/tasks/login-floating-panel/brief.md`.
