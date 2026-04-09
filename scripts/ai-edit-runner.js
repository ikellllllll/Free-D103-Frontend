#!/usr/bin/env node

const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const stateFile = process.env.AI_EDIT_STATE_FILE;

if (!stateFile) {
  console.error("AI_EDIT_STATE_FILE is required.");
  process.exit(1);
}

const sudoBin = "/usr/bin/sudo";
const flockBin = "/usr/bin/flock";
const APP_DIR_LOCK = process.env.AIG_APP_DIR_LOCK || "/home/studio/logs/app-dir.lock";

const config = {
  appDir: process.env.AIG_WORKSHOP_FRONTEND_APP_DIR || "/home/studio/apps/Free-D103-Frontend",
  openClawBin: process.env.AIG_WORKSHOP_OPENCLAW_BIN || "/home/openclaw-studio/.openclaw/bin/openclaw",
  openClawUser: process.env.AIG_WORKSHOP_OPENCLAW_USER || "openclaw-studio",
  restartFrontendScript: process.env.AIG_WORKSHOP_RESTART_SCRIPT || "/home/studio/deploy/restart-frontend.sh",
  workspaceDir: process.env.AIG_AI_EDIT_WORKSPACE || "/home/openclaw-studio/ai-edit-workspace",
  model: process.env.AIG_AI_EDIT_MODEL || "openai-codex/gpt-5.4",
  thinking: process.env.AIG_AI_EDIT_THINKING || "medium",
  agentTimeoutSeconds: Number(process.env.AIG_AI_EDIT_TIMEOUT || "900"),
  installTimeoutMs: Number(process.env.AIG_AI_EDIT_INSTALL_TIMEOUT_MS || "600000"),
  buildTimeoutMs: Number(process.env.AIG_AI_EDIT_BUILD_TIMEOUT_MS || "900000"),
  agentId: "ai-edit"
};

const shouldRestartAfterEdit =
  process.env.AIG_AI_EDIT_RESTART === "true" ||
  (!Object.prototype.hasOwnProperty.call(process.env, "AIG_AI_EDIT_RESTART") &&
    process.platform === "linux" &&
    fsSync.existsSync(config.restartFrontendScript));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function readState() {
  const raw = JSON.parse(await fs.readFile(stateFile, "utf8"));
  if (!Array.isArray(raw.queue)) raw.queue = [];
  return raw;
}

async function writeState(state) {
  const next = { ...state, updatedAt: new Date().toISOString() };
  await fs.writeFile(stateFile, JSON.stringify(next, null, 2), "utf8");
  return next;
}

async function updateState(mutator) {
  const current = await readState();
  const next = await mutator(clone(current));
  return writeState(next);
}

async function pulseState({ step, label }) {
  const timestamp = new Date().toISOString();
  await updateState((state) => {
    state.currentStep = step ?? state.currentStep;
    state.heartbeatAt = timestamp;
    state.heartbeatLabel = label ?? state.heartbeatLabel;
    return state;
  });
}

async function withHeartbeat({ step, label, intervalMs = 8000 }, task) {
  await pulseState({ step, label });

  const timer = setInterval(() => {
    void pulseState({ step, label }).catch(() => {});
  }, intervalMs);

  try {
    return await task();
  } finally {
    clearInterval(timer);
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let timeoutId = null;

    if (options.timeoutMs) {
      timeoutId = setTimeout(() => {
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 5000).unref();
      }, options.timeoutMs);
    }

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (timeoutId) clearTimeout(timeoutId);
      reject(error);
    });

    child.on("close", (code, signal) => {
      if (timeoutId) clearTimeout(timeoutId);

      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      if (signal) {
        reject(new Error(`${command} was terminated by ${signal}`));
        return;
      }

      reject(new Error(stderr.trim() || stdout.trim() || `${command} exited with ${code}`));
    });

    if (options.input) {
      child.stdin.write(options.input);
    }

    child.stdin.end();
  });
}

function runAsOpenClaw(args, options = {}) {
  return runCommand(sudoBin, ["-u", config.openClawUser, ...args], options);
}

function runAsOpenClawInDir(workingDir, args, options = {}) {
  return runAsOpenClaw(["bash", "-lc", 'cd "$1" && shift && exec "$@"', "--", workingDir, ...args], options);
}

function getRouteHints(jobTargetPath) {
  if (jobTargetPath === "/login" || jobTargetPath === "/signup") {
    return [
      "- Start with auth files only: app/(auth)/login/page.tsx, app/(auth)/signup/page.tsx, components/auth/, app/(auth)/layout.tsx, app/globals.css.",
      "- Preserve the Korean UI copy and the existing login/signup behavior.",
      "- Prefer a shared auth component if the change affects both login and signup tabs.",
      "- For this route, animations should be subtle and product-like: short fade/slide transitions, tab indicator movement, no flashy motion."
    ];
  }

  return [
    "- Start with the target route file and the components that route imports.",
    "- Only touch app/globals.css if the visual change needs shared styling."
  ];
}

async function prepareWorkspace() {
  await runCommand(sudoBin, ["rm", "-rf", config.workspaceDir]);
  await runCommand(sudoBin, ["mkdir", "-p", config.workspaceDir]);

  await runCommand(flockBin, [
    "-s",
    "-w",
    "60",
    APP_DIR_LOCK,
    sudoBin,
    "rsync",
    "-a",
    "--delete",
    "--exclude",
    ".git",
    "--exclude",
    "node_modules",
    "--exclude",
    ".next",
    `${config.appDir}/`,
    `${config.workspaceDir}/`
  ]);

  await runCommand(sudoBin, [
    "chown",
    "-R",
    `${config.openClawUser}:${config.openClawUser}`,
    config.workspaceDir
  ]);
}

function createBrief(jobPrompt, jobTargetPath) {
  return [
    "# AI UI Edit Request",
    "",
    `Target page: ${jobTargetPath || "not specified"}`,
    "",
    "## User request",
    jobPrompt,
    "",
    "## Constraints",
    "- This project uses custom CSS, not Tailwind.",
    "- Preserve route flow, API logic, and data behavior.",
    "- Keep Korean UI copy unless the request explicitly asks for text changes.",
    "- Limit edits to the target page and the shared components/styles it directly uses.",
    "- Prefer production-ready UI changes over placeholder landing-page styling.",
    "- Do not create unrelated files or refactor unrelated areas.",
    "",
    "## Project hints",
    ...getRouteHints(jobTargetPath),
    "",
    "## Validation",
    "- Review modified files for obvious TypeScript or JSX mistakes before finishing.",
    "- Keep the final response to 2 or 3 concise lines."
  ].join("\n");
}

async function writeBrief(jobPrompt, jobTargetPath) {
  await runAsOpenClaw(["tee", `${config.workspaceDir}/EDIT_BRIEF.md`], {
    input: createBrief(jobPrompt, jobTargetPath)
  });
}

async function ensureAgent() {
  const result = await runAsOpenClaw([config.openClawBin, "agents", "list", "--json"]);
  const agents = JSON.parse(result.stdout || "[]");

  if (agents.some((agent) => agent.id === config.agentId)) {
    return config.agentId;
  }

  await runAsOpenClaw([
    config.openClawBin,
    "agents",
    "add",
    config.agentId,
    "--workspace",
    config.workspaceDir,
    "--model",
    config.model,
    "--non-interactive",
    "--json"
  ]);

  return config.agentId;
}

async function installWorkspaceDependencies() {
  return runAsOpenClawInDir(
    config.workspaceDir,
    ["/usr/bin/corepack", "yarn", "install", "--frozen-lockfile"],
    { timeoutMs: config.installTimeoutMs }
  );
}

async function runAgent(agentId, jobId, jobTargetPath) {
  const routeFocus =
    jobTargetPath === "/login" || jobTargetPath === "/signup"
      ? "Focus on the auth routes, their shared auth components, and auth-related CSS only."
      : "Focus only on the target route and the components that route directly uses.";

  const agentMessage = [
    "Read EDIT_BRIEF.md first.",
    routeFocus,
    "Do not scan or refactor the whole repository.",
    "Implement the requested UI change completely in this workspace.",
    "Run a production build in this workspace and fix any issues until it passes.",
    "Keep behavior intact, then review the modified files for obvious issues.",
    "Respond in 2 or 3 lines summarizing the actual changes you made."
  ].join(" ");

  return runAsOpenClawInDir(
    config.workspaceDir,
    [
      config.openClawBin,
      "agent",
      "--agent",
      agentId,
      "--session-id",
      jobId,
      "--thinking",
      config.thinking,
      "--timeout",
      String(config.agentTimeoutSeconds),
      "--json",
      "-m",
      agentMessage
    ],
    { timeoutMs: (config.agentTimeoutSeconds + 120) * 1000 }
  );
}

function collectTextPayloads(payloads) {
  const summaryParts = [];
  const thinkingParts = [];

  for (const item of payloads) {
    if (item.type === "thinking" && item.thinking) {
      thinkingParts.push(item.thinking);
      continue;
    }

    if (typeof item.text === "string" && item.text.trim()) {
      summaryParts.push(item.text);
    }
  }

  return {
    summary: summaryParts.join("\n").trim(),
    thinking: thinkingParts.join("\n\n").trim() || null
  };
}

function detectAgentFailure(rawOutput, summary) {
  const haystack = `${rawOutput}\n${summary}`.toLowerCase();

  if (haystack.includes("request timed out before a response was generated")) {
    return "AI 응답 시간이 초과되었습니다. 요청 범위를 더 좁히거나 다시 시도해 주세요.";
  }

  if (haystack.includes("timed out") && haystack.includes("response")) {
    return "AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.";
  }

  if (haystack.includes("unauthorized") || haystack.includes("401")) {
    return "AI 편집 에이전트 인증에 문제가 있습니다.";
  }

  return null;
}

function parseAgentResult(stdout) {
  try {
    const payload = JSON.parse(stdout);
    const payloads = payload?.result?.payloads ?? payload?.content ?? [];
    const { summary, thinking } = collectTextPayloads(Array.isArray(payloads) ? payloads : []);
    const failure = detectAgentFailure(stdout, summary);

    return {
      summary: summary || "변경 작업을 완료했습니다.",
      thinking,
      failure
    };
  } catch {
    const failure = detectAgentFailure(stdout, stdout);
    return {
      summary: stdout.trim() || "변경 작업을 완료했습니다.",
      thinking: null,
      failure
    };
  }
}

async function buildWorkspace() {
  return runAsOpenClawInDir(
    config.workspaceDir,
    [
      "env",
      "NEXT_TELEMETRY_DISABLED=1",
      "/usr/bin/node",
      "./node_modules/next/dist/bin/next",
      "build"
    ],
    { timeoutMs: config.buildTimeoutMs }
  );
}

async function syncToAppDir() {
  await runCommand(flockBin, [
    "-x",
    "-w",
    "60",
    APP_DIR_LOCK,
    sudoBin,
    "rsync",
    "-a",
    "--delete",
    "--exclude",
    ".git",
    "--exclude",
    "node_modules",
    "--exclude",
    ".next",
    `${config.workspaceDir}/`,
    `${config.appDir}/`
  ]);
}

async function dequeueNext() {
  const state = await readState();
  if (!state.queue || state.queue.length === 0) {
    return null;
  }

  const [next, ...remaining] = state.queue;

  await writeState({
    ...state,
    status: "running",
    jobId: next.jobId,
    pid: process.pid,
    prompt: next.prompt,
    targetPath: next.targetPath,
    currentStep: `대기 중이던 AI 수정 작업을 시작합니다. (남은 대기 ${remaining.length}개)`,
    heartbeatAt: null,
    heartbeatLabel: null,
    thinking: null,
    error: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    queue: remaining
  });

  return next;
}

async function processJob(jobId, jobPrompt, jobTargetPath) {
  await withHeartbeat(
    {
      step: "워크스페이스를 준비하고 있습니다.",
      label: "Preparing"
    },
    async () => {
      await prepareWorkspace();
      await writeBrief(jobPrompt, jobTargetPath);
    }
  );

  await withHeartbeat(
    {
      step: "AI 작업용 의존성을 준비하고 있습니다.",
      label: "Install"
    },
    () => installWorkspaceDependencies()
  );

  await pulseState({
    step: "AI 편집 세션을 초기화하고 있습니다.",
    label: "Initializing"
  });

  const agentId = await ensureAgent();

  const agentResult = await withHeartbeat(
    {
      step: "코드를 분석하고 화면을 수정하는 중입니다.",
      label: "Thinking"
    },
    () => runAgent(agentId, jobId, jobTargetPath)
  );

  const { summary, thinking, failure } = parseAgentResult(agentResult.stdout);
  if (failure) {
    throw new Error(failure);
  }

  await withHeartbeat(
    {
      step: "에이전트 결과를 워크스페이스에서 빌드 검증하고 있습니다.",
      label: "Build"
    },
    () => buildWorkspace()
  );

  await withHeartbeat(
    {
      step: "변경 사항을 서비스 코드로 반영하고 있습니다.",
      label: "Syncing"
    },
    () => syncToAppDir()
  );

  if (shouldRestartAfterEdit) {
    await withHeartbeat(
      {
        step: "빌드 후 서비스를 다시 시작하고 있습니다.",
        label: "Restarting"
      },
      () => runCommand(config.restartFrontendScript, [])
    );
  }

  await updateState((state) => {
    state.status = "done";
    state.pid = null;
    state.currentStep = summary;
    state.heartbeatAt = new Date().toISOString();
    state.heartbeatLabel = "Done";
    state.thinking = thinking;
    state.error = null;
    state.completedAt = new Date().toISOString();
    return state;
  });
}

async function main() {
  let currentJobId = process.env.AI_EDIT_JOB_ID || "";
  let currentPrompt = process.env.AI_EDIT_PROMPT || "";
  let currentTargetPath = process.env.AI_EDIT_TARGET_PATH || "";

  while (true) {
    try {
      await processJob(currentJobId, currentPrompt, currentTargetPath);
    } catch (error) {
      await updateState((state) => {
        state.status = "failed";
        state.pid = null;
        state.currentStep = null;
        state.heartbeatAt = new Date().toISOString();
        state.heartbeatLabel = "Failed";
        state.error = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
        state.completedAt = new Date().toISOString();
        return state;
      });
    }

    const next = await dequeueNext();
    if (!next) {
      break;
    }

    currentJobId = next.jobId;
    currentPrompt = next.prompt;
    currentTargetPath = next.targetPath;
  }
}

main().catch(async (error) => {
  try {
    await updateState((state) => {
      state.status = "failed";
      state.pid = null;
      state.currentStep = null;
      state.heartbeatAt = new Date().toISOString();
      state.heartbeatLabel = "Failed";
      state.error = error instanceof Error ? error.message : "AI 수정 작업이 실패했습니다.";
      state.completedAt = new Date().toISOString();
      return state;
    });
  } catch {}

  process.exit(1);
});
