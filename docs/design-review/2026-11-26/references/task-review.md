# Task surfaces from the generated comparison board

The [actual Gemini image](tasks-gemini.jpg) covers the task list, task detail and creation sheet. Its review thread and original screenshot critique are recorded in the coverage manifest.

The list keeps real task titles, goal excerpts, update dates and business stages. The creation sheet follows the right-side composition, with one Cancel/Create footer, visible goal and acceptance criteria, and advanced Channel/Workflow fields. An empty active-channel list is explained before submission; a collapsed required field cannot silently block creation.

Task detail keeps the submitted delivery and activity in the main column, with the goal, criteria and execution context alongside. Long goals expand explicitly. Workflow identity, evidence digest and protocol event names remain inspectable rather than leading the screen. Human-readable events use a neutral **Review approved** label: a custom SOP can approve evidence and continue into another execution stage, so an approval event alone cannot imply final acceptance. Current terminal business state remains the source of accepted-delivery status.

The generated image's invented people, repeated sample tasks and inconsistent stage labels were not adopted. Commands, revisions, claim ownership, evidence digests and approval guards remain unchanged. Execution completion still requires a separate evidence/review path.

Web typecheck/build pass. `pnpm e2e` passes24checks, including UI-created work, Cancel without persistence, collapsed defaults, missing-channel feedback and the existing workflow/responsive suite. Reviewers independently identified the intermediate-approval and hidden-channel-validation cases; both were corrected before commit. The short multiline goal regression ensures that content is never clamped without an expansion control. A real browser also checked long-goal expansion and actual light/mobile surfaces. The earlier real provider task and both execution attempts remain intact.
