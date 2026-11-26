[English](product-direction.md) · [简体中文](../zh-CN/product-direction.md)

# Product direction: a task-centered assistant

Owner clarification, 2026-11-24: the product centers on perception, a Grokbot-like
assistant experience, task boards and meaningful state transitions, plus A2UI.
Multi-Agent orchestration is a supporting mechanism rather than the primary user
model. The term Grokbot records the owner's experience reference; no vendor
integration or precise feature parity is inferred from that name.

## Interaction model

The user's unit of work is an objective with a persistent task thread, explicit
decisions, current deliverables and acceptance requirements. A board summarizes
what is happening, what is waiting, and what needs the owner's attention. A model
can propose or request a business action; the service validates authority,
revision, prerequisites and evidence before recording a fact and advancing state.
Execution success alone does not mean delivery acceptance.

Perception should turn authorized observations into attributed signals with
provenance. Observed content is input, not authorization to execute. The precise
sources, freshness rules and activation policy require a separate implementation
contract; the current CLI refactor does not add sensors or autonomous activation.

The assistant should help clarify intent, explain progress and request decisions
without asking users to operate a team hierarchy. Agent configuration and multiple
execution targets remain available as supporting capabilities.

## Context and state

One task provides a cohesive user-facing container: brief and acceptance criteria,
discussion, decisions, current artifacts and links to original execution attempts.
Those records retain distinct identities and versions. Each model invocation
receives a bounded selection from the container; the full thread is not blindly
replayed as authoritative instructions.

Business stages can be customized using templates. Execution outcomes such as
running, failed and unknown preserve their system-defined meanings. Useful actions
include submit deliverable, request input, approve and request correction. Their
validated outcomes produce events; a model emitting an event name is insufficient
to establish a fact. Key delivery gates are strict while exploration inside a
stage stays flexible. General stage configuration beyond P1's paired execution and
review contract is future work.

## A2UI direction

A2UI is recorded as a desired structured interaction capability. Forms, choices,
progress and artifact cards should reference the same task and authorized command
protocol as the ordinary UI. The exact external protocol/version is not selected
by this document. No arbitrary model HTML/JavaScript should execute in the
authenticated application origin. Browser and Electron should share the same
renderer and action boundary. This direction is not an implemented A2UI renderer.

## Deployment experience

Ordinary users start an Orcabot worker; its local execution prerequisites are
prepared automatically. They open a web or desktop client and work on tasks.
Provider authentication may still require the provider's own login. Installation,
native process management and adapter details belong behind the product boundary,
with explicit advanced diagnostics for operators. See [CLI and deployment](cli-and-deployment.md).
