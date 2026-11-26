# A personal assistant for your work

English · [简体中文](../zh-CN/personal-agent-experience.md)

The personal home and landing now follow an actual Gemini-generated reference.
Home uses the existing admission path and real task, attention and conversation
records. Other core surfaces are being reviewed in the same documented cycle.

Orcabot should feel like an assistant you give work to. The first screen should
help you hand over a task, see what is happening, and make the decisions that
need you. Task boards and execution profiles support that experience.

## The main surfaces

| Surface    | Your question                             | What it shows or does                                                                                            |
| ---------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Home       | What should I hand over, or look at next? | A direct message entry, work in progress, decisions waiting for you and recent deliveries, all from real records |
| Task board | Where has my work reached?                | Goals, project-specific stages, attempts, acceptance criteria and the next available action                      |
| Thread     | What happened, and what context matters?  | The conversation, execution output, questions, decisions and deliverable references in their original context    |
| Routines   | What should happen again?                 | A bounded instruction, its schedule and budget, pause/resume, and results returned to the same thread            |
| Settings   | Where and how can my assistant work?      | Connection and execution profiles; technical configuration appears when needed                                   |

A profile is a configuration, not the product's protagonist. Giving work to Orca
should not require understanding the runtime installation or orchestrating a team
of agents. The existing managed local startup remains responsible for preparing
execution; explicit provider authentication can still be necessary.

## Status needs to mean something

Every friendly label must preserve the underlying distinction between execution
and business completion:

| Situation                                  | Experience                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| An execution is running                    | Show the active task and the latest useful activity                             |
| An execution needs permission or an answer | Present the specific decision, its scope and its consequences                   |
| An execution has finished                  | Show the result as ready to inspect; completion alone does not accept the task  |
| Evidence is submitted                      | Show what is being reviewed and which criteria it addresses                     |
| The operator accepts the evidence          | Show the accepted delivery and retain the decision in the thread                |
| An attempt fails or expires                | Explain what happened and offer the allowed next action, preserving the attempt |

Direct conversation runs have their own recent-conversation section. Their
completion is distinct from an accepted business delivery. Home summarizes at
most 20 recent business tasks, with five progress/delivery rows and three rows
per attention category; when older tasks exist,
it identifies the partial view and links to the paginated task list. The bounded
activity endpoint excludes archived conversations and board-owned executions,
returning only title, identifiers, status and time.

The home screen groups these facts for attention. It does not replace a project's
workflow definition or bypass its transition guards. Raw event names and claim
generation numbers belong in inspectable details rather than the primary story.

## Visual direction

Use the supplied Orca mark and blue accents, Manrope for Latin text and local
Chinese font fallbacks. Forms use coss-inspired Base UI primitives. The landing
has a 7:3 desktop split: an Orca and AI particle visual on the left, a concise
entry form on the right. Small screens stack the entry first. Motion needs a
still state and reduced-motion support. The work area keeps its reading surface
quiet; particles belong to the landing.

Headings should sound like an assistant helping with a concrete task. Prefer
“Needs your decision” and the actual task title over infrastructure terminology.
Show existing context and real results; do not manufacture activity, statistics,
notifications or remembered facts to make an empty screen look busy.

## Acceptance for the home redesign

- Sending a request reaches the existing admission path and original thread.
- Each attention item opens the relevant task, review or execution question.
- A completed execution cannot appear as an accepted business delivery.
- Empty, loading and error states remain distinguishable.
- English/Chinese and light/dark work with the existing preference persistence.
- Controls remain reachable by keyboard and usable at 320px.
- The implemented screen is compared with an actual Gemini-generated image.

Track screenshot, image and verification coverage in the
[design review manifest](../design-review/2026-11-26/manifest.json).
