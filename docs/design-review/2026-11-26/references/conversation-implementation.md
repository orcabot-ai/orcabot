# Results, permission decisions and delivery references

The actual [conversation/reference image](conversation-gemini.jpg) came from a [fresh Gemini review](https://gemini.google.com/app/6c400dd47d42e2a3) of the original screenshots and personal-home style. Its [critique](conversation-critique.md) is retained. The first image incorrectly conflated runtime permission with business acceptance, claimed that criteria were verified, and invented example URLs. Those parts were rejected. The [corrected permission image](permission-gemini.jpg) separates action, directory and request scope before explicit allow/deny actions and full request details.

## What follows the images

- Long original requests are inspectable. Final answers precede progress, thinking and tool notes; the original Orca replaces the generic assistant glyph. Completed execution does not imply business acceptance.
- Permission cards show actual operation/command, directory, requested permissions and grant scope when supplied. Full JSON remains available without the previous8kcut. Unknown question shapes reveal their details. Declared allowed outcomes determine which controls appear, including cancellation-only requests. Responses retain the original run and interaction identity; no new grant scope or automatic approval is introduced.
- Permission decisions remain inline in the original conversation, retaining context rather than forcing an unsolicited modal. The image's semantic hierarchy applies to the card. Existing guards, expiry checks and business review remain separate.
- References appear before the attachment form. Locations are copyable, advanced metadata is disclosed, Cancel discards an unsubmitted draft, and dialog focus starts at the panel so existing references remain visible. Invalid hidden metadata opens for correction. Missing Clipboard API support shows a manual-copy fallback.
- Execution-relative Markdown locations render as text rather than misleading links into the web app's route space. Default Markdown URL sanitization remains in place. HTTP/mail/fragment links retain their link behavior.

No generated sample task, person, verified-criteria claim or deployed URL became application data. Existing execution messages remain historical text rather than being rewritten to match a later business decision.

## Verification

Web typecheck/build and the30-check browser suite pass. New cases cover final/progress ordering, local-location rendering, original execution allow/deny/question/cancel responses, full request payload visibility, references and clipboard copying, missing clipboard support, hidden invalid metadata and draft cancellation. Independent standards/spec reviews approved the code after the recorded boundary fixes.

The permission after-shot is from the isolated deterministic fixture, with no real command executed or provider call. Conversation and artifact screenshots use the earlier real Orcabot example journey. That journey's two attempts, evidence and separate operator acceptance remain intact; this phase did not test the game itself.
