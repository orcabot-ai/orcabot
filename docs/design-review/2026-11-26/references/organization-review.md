# Projects, threads and routines

The actual [project comparison](projects-gemini.jpg) and [routine/attention comparison](routines-attention-gemini.jpg) were downloaded before implementation. The former covers Projects, New project and Manage thread; the latter covers Routines and its creation dialog, with Attention tracked separately.

Dialogs now share a compact480px frame and Cancel/explicit primary footer. Project directory context is real and read-only, disclosed below the Agent selector. Thread archival stays separate from saving name/project edits. Unassigned threads use consistent lightweight rows with actual dates. Routine copy describes repeated work; interval and numeric run limit remain visible, with the existing scheduling/failure rules available on demand.

The routine image invents working-day calendars, daily9AM schedules and unlimited execution. These are not implemented: the existing bounded interval and maximum-run contract remains authoritative. It also reintroduces old sidebar labels; the already reviewed Home/Tasks/Settings organization is retained. The image's immediate business Accept/Decline actions are not adopted: actual evidence review and guarded transitions stay in task detail.

Web typecheck/build pass. The25-check E2E suite checks Cancel without writes for project creation, thread rename and routine creation, plus original thread identity, stale-revision feedback, manual routine execution, pause/resume and preference persistence. Independent code reviews approved; the spec reviewer also ran automation tests9/9. Actual light-mode screenshots and a mobile routine dialog are retained. No real recurring job was enabled merely to produce a screenshot.
