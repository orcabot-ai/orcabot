import test from "node:test";
import assert from "node:assert/strict";
import {
  WorkflowDefinition,
  transition,
} from "../packages/orcabot-workflows/src/index.js";
const definition = WorkflowDefinition.parse({
  id: "delivery",
  version: 1,
  initial: "plan",
  states: [
    { id: "plan" },
    { id: "review" },
    { id: "delivered", terminal: true },
  ],
  transitions: [
    { from: "plan", to: "review", event: "ready" },
    {
      from: "review",
      to: "delivered",
      event: "approve",
      approvalRequired: true,
    },
    { from: "review", to: "plan", event: "revise" },
  ],
});
const initial = {
  definitionId: "delivery",
  definitionVersion: 1,
  state: "plan",
  revision: 0,
};
test("workspace-defined paths replace fixed kanban states", () => {
  const review = transition(definition, initial, {
    event: "ready",
    expectedRevision: 0,
  });
  assert.equal(review.state, "review");
  assert.equal(
    transition(definition, review, { event: "revise", expectedRevision: 1 })
      .state,
    "plan",
  );
});
test("approvals, definition versions and optimistic revisions are enforced", () => {
  const review = transition(definition, initial, {
    event: "ready",
    expectedRevision: 0,
  });
  assert.throws(
    () =>
      transition(definition, review, { event: "approve", expectedRevision: 1 }),
    /APPROVAL_REQUIRED/,
  );
  assert.equal(
    transition(definition, review, {
      event: "approve",
      approved: true,
      expectedRevision: 1,
    }).state,
    "delivered",
  );
  assert.throws(
    () =>
      transition(definition, initial, { event: "ready", expectedRevision: 7 }),
    /STALE/,
  );
  assert.throws(
    () =>
      transition({ ...definition, version: 2 }, initial, {
        event: "ready",
        expectedRevision: 0,
      }),
    /VERSION_MISMATCH/,
  );
});
test("invalid, ambiguous and terminal outgoing transitions are rejected", () => {
  assert.throws(
    () =>
      transition(definition, initial, {
        event: "invented",
        expectedRevision: 0,
      }),
    /NOT_ALLOWED/,
  );
  assert.equal(
    WorkflowDefinition.safeParse({
      ...definition,
      transitions: [...definition.transitions, definition.transitions[0]],
    }).success,
    false,
  );
  assert.equal(
    WorkflowDefinition.safeParse({
      ...definition,
      transitions: [{ from: "delivered", to: "plan", event: "restart" }],
    }).success,
    false,
  );
});
