# Workspace review

Source: https://gemini.google.com/app/09cf8496cd38905e

Ten actual Orcabot screenshots were uploaded together: new conversation,
completed conversation, empty work list, work creation, real work detail,
projects, project creation, thread editing, routines and routine creation.
Gemini inspected each screenshot and explicitly stated that it had **not generated
a new design image** because image generation was quota-limited.

These are recommendations, not measured layout facts or implemented features.
The screenshots mix the initial baseline with later captures made during the
shared-control migration. In particular, the selector arrow wrapping visible in
project/thread captures was fixed in the subsequent shared-control build.

| Screen           | Finding                                                                                  | Proposed correction                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| New conversation | Repeated Agent/target metadata and a prominent temporary directory dominate the handoff  | Bring the request entry forward; put configuration in a compact, expandable context row            |
| Conversation     | Process output competes with the result; duplicate thread titles are hard to distinguish | Lead with a delivery summary, retain process detail below, show meaningful thread context          |
| Empty work list  | The empty view offers little help with the next step                                     | Present a concise first-task action and real attention categories without invented records         |
| Work creation    | Duplicate creation entry and equally prominent infrastructure options                    | Keep one create action; progressively reveal channel/workflow configuration                        |
| Work detail      | Raw event names and combined execution/stage labels obscure the next responsibility      | Human-readable timeline entries and a clear distinction between execution, evidence and acceptance |
| Projects         | The empty project area and boxed unassigned threads use conflicting structure            | Use consistent rows, relevant thread context and a single project action                           |
| Project creation | No visible Cancel action; directory text overloads the Agent control                     | Compact dialog footer, aligned selector and secondary configuration context                        |
| Thread editing   | Archive and save lack clear relative priority                                            | Separate the low-frequency archive action from Cancel/Save                                         |
| Routines         | Engineering terms lead the empty page                                                    | Explain recurring delegated work with its real limits                                              |
| Routine creation | Boundary rules crowd the footer and Cancel is absent                                     | A readable rule summary, clear secondary action, bounded mobile scrolling                          |

## Shared principles

- Start with the owner's work and the assistant's next useful action.
- Use the supplied Orca identity and humanist typography; keep paths/code secondary.
- Keep light surfaces warm and dark surfaces readable, with limited blue accents.
- Give dialogs and menus one coherent interaction system, including focus and touch sizing.
- Reveal advanced configuration when needed and preserve actual failure states.
- Never portray an execution as business-accepted without its separate review.

New home/landing and per-page visual implementations remain pending actual image
artifacts. The text critique alone does not satisfy that gate.
