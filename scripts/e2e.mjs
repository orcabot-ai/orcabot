import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import assert from "node:assert/strict";
const root = resolve(import.meta.dirname, ".."),
  temp = await mkdtemp(join(tmpdir(), "orcabot-e2e-"));
let chrome, fixture, ws;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const reports = [];
try {
  const location = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].find((p) => p && existsSync(p));
  if (!location) throw Error("Chrome/Chromium required; set CHROME_PATH");
  fixture = spawn(
    process.execPath,
    ["--import", "tsx", "scripts/e2e-fixture.ts", join(temp, "fixture.sqlite")],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
  );
  let diagnostics = "";
  fixture.stderr.on("data", (b) => {
    diagnostics = (diagnostics + b).slice(-4000);
  });
  const lines = createInterface({ input: fixture.stdout });
  const config = await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(Error("Fixture startup timed out: " + diagnostics)),
      15000,
    );
    lines.once("line", (line) => {
      clearTimeout(timeout);
      try {
        resolve(JSON.parse(line));
      } catch (e) {
        reject(e);
      }
    });
    fixture.once("exit", (code) => {
      clearTimeout(timeout);
      reject(Error("Fixture exited " + code + ": " + diagnostics));
    });
  });
  chrome = spawn(
    location,
    [
      "--headless=new",
      `--user-data-dir=${join(temp, "chrome")}`,
      "--remote-debugging-port=0",
      "--no-first-run",
      "--no-default-browser-check",
      // Only the disposable CI fixture opts out; local runs keep the sandbox.
      ...(process.env.ORCABOT_E2E_NO_SANDBOX === "1" ? ["--no-sandbox"] : []),
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  let chromeDiagnostics = "";
  chrome.stderr.on("data", (b) => {
    chromeDiagnostics = (chromeDiagnostics + b).slice(-4000);
  });
  chrome.on("error", (error) => {
    chromeDiagnostics = String(error);
  });
  let port;
  for (let i = 0; i < 100; i++) {
    if (chrome.exitCode !== null || chrome.signalCode !== null) break;
    try {
      port = Number(
        (await readFile(join(temp, "chrome/DevToolsActivePort"), "utf8")).split(
          "\n",
        )[0],
      );
      break;
    } catch {
      await pause(100);
    }
  }
  if (!port) throw Error("Chrome startup failed: " + chromeDiagnostics);
  const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let seq = 0;
  const pending = new Map();
  const exceptions = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.method === "Runtime.exceptionThrown")
      exceptions.push(m.params.exceptionDetails.text);
    if (pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((res, rej) => {
      const id = ++seq;
      pending.set(id, (m) =>
        m.error ? rej(Error(m.error.message)) : res(m.result),
      );
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  const { targetId } = await send("Target.createTarget", {
    url: "about:blank",
  });
  const { sessionId } = await send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  const S = (m, p) => send(m, p, sessionId);
  const ev = async (expression) => {
    const r = await S("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails)
      throw Error(
        r.exceptionDetails.exception?.description ?? r.exceptionDetails.text,
      );
    return r.result.value;
  };
  const wait = async (expression) => {
    for (let i = 0; i < 100; i++) {
      if (await ev(expression)) return;
      await pause(80);
    }
    throw Error("UI wait failed: " + expression);
  };
  const go = async (path) => {
    await S("Page.navigate", { url: config.url + path });
    await wait(
      '!!document.querySelector(".board-page, .gate, .transcript, .welcome")',
    );
  };
  const click = async (text) => {
    const result = await ev(
      `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b||b.disabled)return false;b.focus();b.click();return true})()`,
    );
    assert.ok(result, "Missing/disabled button: " + text);
    await pause(100);
  };
  const hit = async (selector) => {
    const point = await ev(
      `(()=>{const b=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.checkVisibility());if(!b||b.disabled)return null;b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
    );
    assert.ok(point, "Missing control " + selector);
    await S("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
    await S("Input.dispatchMouseEvent", {
      type: "mousePressed",
      ...point,
      button: "left",
      clickCount: 1,
    });
    await S("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      ...point,
      button: "left",
      clickCount: 1,
    });
  };
  const selectValue = async (trigger, value) => {
    await hit(trigger);
    const option = `[role=option][data-value=${JSON.stringify(value)}]`;
    await wait(
      `[...document.querySelectorAll(${JSON.stringify(option)})].some(e=>e.checkVisibility())`,
    );
    await hit(option);
    await wait(
      `document.querySelector(${JSON.stringify(trigger)}).getAttribute('aria-expanded')==='false'`,
    );
    await wait(
      '![...document.querySelectorAll("[role=listbox]")].some(e=>e.checkVisibility())',
    );
  };
  const field = async (label, value) => {
    const result = await ev(
      `(()=>{const l=[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.trim().startsWith(${JSON.stringify(label)}));if(l?.querySelector('[role=combobox]')){l.querySelector('[role=combobox]').setAttribute('data-e2e-select','current');return 'select'}const e=l?.querySelector('input:not([type=hidden]),textarea');if(!e)return false;const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`,
    );
    assert.ok(result, "Missing field " + label);
    if (result === "select") {
      await selectValue('[data-e2e-select="current"]', value);
      await ev(
        `document.querySelector('[data-e2e-select="current"]').removeAttribute('data-e2e-select')`,
      );
    }
  };
  const request = async (path, body) => {
    const r = await fetch(config.workerUrl + "/api" + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + config.token,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.ok(r.ok, await r.clone().text());
    return r.json();
  };
  await S("Page.enable");
  await S("Runtime.enable");
  await S("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await S("Page.navigate", { url: config.url });
  await wait('!!document.querySelector("input")');
  assert.equal(await ev("document.documentElement.lang"), "en");
  await ev(
    `fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:${JSON.stringify(config.token)}})}).then(r=>r.ok)`,
  );
  await go("/projects");
  await wait('document.body.textContent.includes("New project")');
  await click("New project");
  await field("Name", "E2E workspace");
  await click("Create");
  await wait('!document.querySelector("[role=dialog]")');
  await wait('document.body.textContent.includes("E2E workspace")');
  await click("New thread");
  await wait('location.pathname.startsWith("/conversations/")');
  const threadId = await ev('location.pathname.split("/").at(-1)');
  reports.push("project creation and durable thread");
  await go("/projects");
  await wait('!!document.querySelector(".project-threads button")');
  await click("Manage thread");
  await field("Name", "E2E delivery");
  await click("Save changes");
  await wait('!document.querySelector("[role=dialog]")');
  assert.equal(
    (await request("/conversations/" + threadId)).title,
    "E2E delivery",
  );
  reports.push("thread rename and original identity");
  await go("/projects");
  await wait(
    'document.body.textContent.includes("Existing unassigned thread")',
  );
  assert.ok(
    await ev(
      `(()=>{const row=[...document.querySelectorAll('.project-threads>div')].find(d=>d.textContent.includes('Existing unassigned thread'));const b=[...row.querySelectorAll('button')].find(b=>b.textContent.includes('Manage thread'));b.focus();b.click();return true})()`,
    ),
  );
  await field("Name", "Migrated thread");
  const project = (await request("/projects")).items[0];
  await field("Project", project.id);
  await click("Save changes");
  await wait('!document.querySelector("[role=dialog]")');
  const migrated = (await request("/state")).conversations.find(
    (c) => c.title === "Migrated thread",
  );
  assert.equal(migrated.projectId, project.id);
  reports.push("legacy thread project assignment");
  await click("Manage thread");
  const current = await request("/conversations/" + threadId);
  await request("/threads/" + threadId, {
    commandId: "concurrent-e2e-edit",
    expectedRevision: current.revision ?? 0,
    title: "Changed elsewhere",
  });
  await click("Save changes");
  await wait('!!document.querySelector("[role=dialog] [role=alert]")');
  assert.match(
    await ev(
      'document.querySelector("[role=dialog] [role=alert]").textContent',
    ),
    /thread changed/,
  );
  await S("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  reports.push("stale edit error inside active dialog");

  await go("/routines");
  await wait('document.body.textContent.includes("New routine")');
  await click("New routine");
  await field("Name", "E2E routine");
  await field("Thread", threadId);
  await field("What to do", "Return a verified fixture deliverable");
  await field("Interval (minutes)", "15");
  await field("Run budget", "2");
  await click("Create");
  await wait('!document.querySelector("[role=dialog]")');
  await wait('document.body.textContent.includes("E2E routine")');
  await click("Run now");
  await wait('document.body.textContent.includes("1 of 2 runs")');
  await click("Pause");
  await wait('document.body.textContent.includes("Resume")');
  await click("Resume");
  await wait('document.body.textContent.includes("Pause")');
  reports.push("routine creation, manual run, pause and resume");
  const routines = await request("/routines");
  assert.equal(routines.items.length, 1);
  const routine = routines.items[0];
  assert.equal(routine.conversationId, threadId);
  assert.equal(routine.runs, 1);
  const runs = await request("/conversations/" + threadId + "/runs");
  assert.equal(runs.runs.length, 1);
  assert.equal(runs.runs[0].status, "completed");
  await click("Open thread");
  await wait(
    'document.body.textContent.includes("Verified fixture deliverable")',
  );
  reports.push("result delivered into original thread");
  await go("/routines");
  await wait('document.body.textContent.includes("New routine")');
  await click("New routine");
  for (let i = 0; i < 14; i++) {
    await S("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
    });
    await S("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
    });
    await wait(
      'document.querySelector("[role=dialog]").contains(document.activeElement)',
    );
  }
  reports.push("dialog keyboard focus containment");
  await mkdir(join(root, "docs/screenshots"), { recursive: true });
  for (const theme of ["light", "dark"]) {
    await ev(`document.documentElement.dataset.theme='${theme}'`);
    await pause(250);
    const { data } = await S("Page.captureScreenshot", { format: "png" });
    await writeFile(
      join(root, `docs/screenshots/routine-${theme}.png`),
      Buffer.from(data, "base64"),
    );
  }
  await S("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await pause(250);
  assert.ok(await ev("document.body.scrollWidth<=innerWidth"));
  assert.ok(
    await ev("[...document.images].every(i=>i.complete&&i.naturalWidth>0)"),
  );
  const shot = await S("Page.captureScreenshot", { format: "png" });
  await writeFile(
    join(root, "docs/screenshots/routine-mobile.png"),
    Buffer.from(shot.data, "base64"),
  );
  await S("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await wait('!document.querySelector("[role=dialog]")');
  assert.ok(
    await ev('document.activeElement?.textContent.includes("New routine")'),
  );
  reports.push("mobile bounds, images, Escape and focus restoration");
  await selectValue(".language-control [role=combobox]", "zh");
  await selectValue(".theme-control [role=combobox]", "dark");
  await go("/routines");
  await wait('document.body.textContent.includes("例行任务")');
  assert.equal(await ev("document.documentElement.dataset.theme"), "dark");
  reports.push("Chinese session preference and dark theme after reload");
  const listed = JSON.parse(
    execFileSync(
      process.execPath,
      [join(root, "apps/cli/dist/index.js"), "--json", "routine", "list"],
      {
        cwd: temp,
        env: {
          ...process.env,
          ORCABOT_URL: config.workerUrl,
          ORCABOT_TOKEN: config.token,
        },
        encoding: "utf8",
      },
    ),
  );
  assert.equal(listed.items[0].id, routine.id);
  assert.equal(listed.items[0].runs, 1);
  reports.push("built headless routine CLI outside the checkout");

  // Exercise the task/context layout with the same admission and evidence APIs.
  const command = (path, body) =>
    request(path, { commandId: crypto.randomUUID(), ...body });
  const fixtureAgent = (await request("/state")).agents[0];
  const work = await command("/board/work", {
    title: "Prepare the release brief",
    goal: "Summarize the changes, call out risks, and list the checks needed before release.",
    criteria: [
      "Include a concise summary",
      "List risks and verification steps",
    ],
    agentId: fixtureAgent.id,
    channelId: "general",
    definitionId: "standard-delivery",
    definitionVersion: 1,
  });
  let detail = await request("/board/work/" + work.id);
  const claimed = await command("/board/tasks/" + detail.task.id + "/claim", {
    expectedRevision: detail.task.revision,
  });
  await command("/board/tasks/" + detail.task.id + "/dispatch", {
    expectedRevision: claimed.task.revision,
    claimToken: claimed.claimToken,
  });
  for (let i = 0; i < 100; i++) {
    detail = await request("/board/work/" + work.id);
    if (detail.task.status === "completed") break;
    await pause(50);
  }
  assert.equal(detail.task.status, "completed");
  await command("/board/work/" + work.id + "/evidence", {
    expectedRevision: detail.work.revision,
    taskId: detail.task.id,
    content:
      "## Release brief\n\nProject threads retain the conversation. Routines return repeat work to the same thread.\n\n**Before release:** review dependency notices, run the checks, and confirm the delivery criteria.\n\nExample content from an isolated documentation fixture.",
    checks: [true, true],
  });
  await ev("sessionStorage.setItem('orcabot.locale','en')");
  for (const theme of ["light", "dark"]) {
    await ev(`localStorage.setItem('orcabot.theme',${JSON.stringify(theme)})`);
    for (const width of [1440, 1024, 768, 390, 320]) {
      await S("Emulation.setDeviceMetricsOverride", {
        width,
        height: width < 600 ? 844 : 900,
        deviceScaleFactor: 1,
        mobile: width < 600,
      });
      await go("/work/" + work.id);
      await wait('document.body.textContent.includes("Submitted evidence")');
      await wait("[...document.images].every(i=>i.complete&&i.naturalWidth>0)");
      await ev("document.fonts.ready");
      assert.equal(await ev("document.documentElement.dataset.theme"), theme);
      assert.ok(
        await ev("document.body.scrollWidth<=innerWidth"),
        `Overflow at ${width}/${theme}`,
      );
      assert.ok(
        await ev(
          'document.querySelector(".content-scroll").scrollWidth<=document.querySelector(".content-scroll").clientWidth',
        ),
        `Content overflow at ${width}/${theme}`,
      );
      if (width >= 1024) {
        assert.ok(
          await ev(
            'document.querySelector(".work-main").getBoundingClientRect().right <= document.querySelector(".work-context").getBoundingClientRect().left',
          ),
          "Context must stay beside the document",
        );
      }
      if (width === 1440 || (theme === "light" && [768, 390].includes(width))) {
        await pause(180);
        const frame = await S("Page.captureScreenshot", { format: "png" });
        const filename =
          width === 1440
            ? `readme-work-${theme}.png`
            : width === 768
              ? "workbench-tablet.png"
              : "workbench-mobile.png";
        await writeFile(
          join(root, "docs/screenshots", filename),
          Buffer.from(frame.data, "base64"),
        );
      }
    }
  }
  reports.push(
    "task review and context rail in both themes at 1440, 1024, 768, 390 and 320px",
  );
  const key = async (key, code, extra = {}) => {
    await S("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
      code,
      windowsVirtualKeyCode: key === "Tab" ? 9 : 27,
      ...extra,
    });
    await S("Input.dispatchKeyEvent", { type: "keyUp", key, code, ...extra });
  };
  await ev(
    `document.querySelector('button[aria-label="Show sidebar"]').focus();document.querySelector('button[aria-label="Show sidebar"]').click()`,
  );
  await wait('!!document.querySelector(".sidebar-drawer")');
  assert.ok(await ev('document.querySelector(".main").inert'));
  await ev(
    '[...document.querySelectorAll(".sidebar-drawer button")].at(-1).focus()',
  );
  await key("Tab", "Tab");
  await wait(
    'document.querySelector(".sidebar-drawer").contains(document.activeElement)',
  );
  await key("Escape", "Escape");
  await wait('!document.querySelector(".sidebar-drawer")');
  await wait(
    'document.activeElement?.getAttribute("aria-label")==="Show sidebar"',
  );
  await ev(
    `document.querySelector('button[aria-label="Show sidebar"]').click()`,
  );
  await wait('!!document.querySelector(".sidebar-drawer")');
  await click("Projects");
  await wait(
    'location.pathname === "/projects" && !document.querySelector(".sidebar-drawer")',
  );
  assert.equal(
    await ev(
      'document.querySelector(".topbar > div:first-child > span:last-child").textContent',
    ),
    "Projects",
  );
  assert.equal(await ev('document.querySelector(".main").inert'), false);
  reports.push(
    "mobile navigation traps focus, closes on route/Escape, restores focus and shows the right breadcrumb",
  );
  await go("/");
  await wait('!!document.querySelector(".workspace-context")');
  assert.ok(
    await ev(
      'document.querySelector(".workspace-context").textContent.includes("Fixture assistant")',
    ),
  );
  assert.ok(
    await ev(
      'document.querySelector(".workspace-context").textContent.includes("/fixture/project")',
    ),
  );
  reports.push(
    "new thread displays the actual configured agent and working directory",
  );
  const longTarget = await request("/targets", {
    name: "Target".repeat(24),
    kind: "local",
    endpoint: "/fixture/long.sock",
  });
  const longAgent = await request("/agents", {
    name: "Agent".repeat(24),
    targetId: longTarget.id,
    adapter: "codex",
    workdir: "/fixture/" + "workspace".repeat(20),
    mcp: {},
  });
  await go("/");
  await wait('!!document.querySelector(".agent-picker [role=combobox]")');
  await selectValue(".agent-picker [role=combobox]", longAgent.id);
  await wait(
    `document.querySelector('.workspace-context').textContent.includes(${JSON.stringify(longAgent.name)})`,
  );
  for (const width of [390, 320]) {
    await S("Emulation.setDeviceMetricsOverride", {
      width,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    assert.ok(
      await ev(
        'document.querySelector(".content-scroll").scrollWidth<=document.querySelector(".content-scroll").clientWidth',
      ),
      `Long configuration overflow at ${width}`,
    );
  }
  assert.ok(
    await ev(
      'document.querySelector(".agent-picker [role=combobox]").getBoundingClientRect().height>=44',
    ),
    "Mobile agent picker must have a 44px touch target",
  );
  reports.push(
    "long Agent, target and directory metadata wrap inside the mobile content scroller",
  );
  // Verify the shared primitives through real pointer and keyboard input.
  await S("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await go("/");
  await wait('!!document.querySelector(".welcome")');
  await hit('button[aria-label="Open settings"]');
  await wait('!!document.querySelector(".connection-setup")');
  await field("Name", "E2E personal assistant");
  await field("Working directory", "/fixture/assistant");
  await field("Reasoning effort", "high");
  const effortTrigger =
    '.connection-setup label:has(input[name="effort"]) [role=combobox]';
  await hit(effortTrigger);
  await wait(
    `document.querySelector(${JSON.stringify(effortTrigger)}).getAttribute('aria-expanded')==='true'`,
  );
  await key("Escape", "Escape");
  await wait(
    `document.querySelector(${JSON.stringify(effortTrigger)}).getAttribute('aria-expanded')==='false'`,
  );
  assert.ok(
    await ev('!!document.querySelector(".connection-setup")'),
    "Escape on a nested select must keep the parent dialog open",
  );
  await click("Create agent");
  await wait('!document.querySelector(".connection-setup")');
  const savedAssistant = (await request("/state")).agents.find(
    (a) => a.name === "E2E personal assistant",
  );
  assert.equal(savedAssistant.workdir, "/fixture/assistant");
  assert.equal(savedAssistant.adapter, "codex");
  assert.equal(savedAssistant.effort, "high");
  reports.push(
    "agent creation persists the selected custom-dropdown value; nested Escape keeps the dialog open",
  );
  const targetsBefore = (await request("/state")).targets.length;
  await hit('button[aria-label="Open settings"]');
  await wait('!!document.querySelector(".connection-setup")');
  await click("Execution targets");
  assert.equal(
    await ev('document.querySelector(".endpoint-disclosure").open'),
    false,
  );
  await field("Connection", "remote");
  await field("Service key", "fixture-key-used-only-in-browser-checks");
  assert.equal(
    await ev('document.querySelector("input[name=token]").type'),
    "password",
  );
  await click("Show");
  assert.equal(
    await ev('document.querySelector("input[name=token]").type'),
    "text",
  );
  await field("Connection", "local");
  await field("Connection", "remote");
  assert.equal(
    await ev('document.querySelector("input[name=token]").type'),
    "password",
  );
  await click("Cancel");
  await wait('!document.querySelector(".connection-setup")');
  assert.equal((await request("/state")).targets.length, targetsBefore);
  reports.push(
    "managed local details are collapsed; remote key visibility resets and Cancel creates no connection",
  );
  assert.deepEqual(exceptions, []);
  console.log(
    JSON.stringify(
      { passed: true, checks: reports, providerCalls: 0 },
      null,
      2,
    ),
  );
} finally {
  ws?.close();
  for (const p of [chrome, fixture])
    if (p) {
      p.kill("SIGTERM");
      await Promise.race([new Promise((r) => p.once("exit", r)), pause(5000)]);
      if (p.exitCode === null) p.kill("SIGKILL");
    }
  await rm(temp, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  });
}
