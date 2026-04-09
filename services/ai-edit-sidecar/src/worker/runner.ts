import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";

import { aiEditConfig } from "../config";
import type { AiEditState } from "../shared/types";

const resolvedStateFile = process.env.AI_EDIT_STATE_FILE;

if (!resolvedStateFile) {
  console.error("AI_EDIT_STATE_FILE is required.");
  process.exit(1);
}

const stateFile = resolvedStateFile;

const sudoBin = "/usr/bin/sudo";
const flockBin = "/usr/bin/flock";

const shouldRestartAfterEdit =
  process.env.AIG_AI_EDIT_RESTART === "true" ||
  (!Object.prototype.hasOwnProperty.call(process.env, "AIG_AI_EDIT_RESTART") &&
    process.platform === "linux" &&
    fsSync.existsSync(aiEditConfig.restartFrontendScript));

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

async function readState() {
  const raw = JSON.parse(await fs.readFile(stateFile, "utf8")) as AiEditState;
  if (!Array.isArray(raw.queue)) {
    raw.queue = [];
  }
  return raw;
}

async function writeState(state: AiEditState) {
  const next = { ...state, updatedAt: new Date().toISOString() };
  await fs.writeFile(stateFile, JSON.stringify(next, null, 2), "utf8");
  return next;
}

async function updateState(mutator: (state: AiEditState) => AiEditState | Promise<AiEditState>) {
  const current = await readState();
  const next = await mutator(clone(current));
  return writeState(next);
}

async function pulseState({ step, label }: { step?: string | null; label?: string | null }) {
  const timestamp = new Date().toISOString();
  await updateState((state) => ({
    ...state,
    currentStep: step ?? state.currentStep,
    heartbeatAt: timestamp,
    heartbeatLabel: label ?? state.heartbeatLabel
  }));
}

async function withHeartbeat<T>(
  config: { step: string; label: string; intervalMs?: number },
  task: () => Promise<T>
) {
  await pulseState({ step: config.step, label: config.label });

  const timer = setInterval(() => {
    void pulseState({ step: config.step, label: config.label }).catch(() => undefined);
  }, config.intervalMs ?? 8000);

  try {
    return await task();
  } finally {
    clearInterval(timer);
  }
}

function runCommand(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    input?: string;
    timeoutMs?: number;
  } = {}
) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let timeoutId: NodeJS.Timeout | null = null;

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
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      reject(error);
    });

    child.on("close", (code, signal) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

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

const runAsOpenClaw = (args: string[], options: Parameters<typeof runCommand>[2] = {}) =>
  runCommand(sudoBin, ["-u", aiEditConfig.openClawUser, ...args], options);

const runAsOpenClawInDir = (
  workingDir: string,
  args: string[],
  options: Parameters<typeof runCommand>[2] = {}
) =>
  runAsOpenClaw(["bash", "-lc", 'cd "$1" && shift && exec "$@"', "--", workingDir, ...args], options);

function getRouteHints(jobTargetPath: string) {
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
  await runCommand(sudoBin, ["rm", "-rf", aiEditConfig.workspaceDir]);
  await runCommand(sudoBin, ["mkdir", "-p", aiEditConfig.workspaceDir]);

  await runCommand(flockBin, [
    "-s",
    "-w",
    "60",
    aiEditConfig.appDirLock,
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
    `${aiEditConfig.appDir}/`,
    `${aiEditConfig.workspaceDir}/`
  ]);

  await runCommand(sudoBin, [
    "chown",
    "-R",
    `${aiEditConfig.openClawUser}:${aiEditConfig.openClawUser}`,
    aiEditConfig.workspaceDir
  ]);
}

function createBrief(jobPrompt: string, jobTargetPath: string) {
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

async function writeBrief(jobPrompt: string, jobTargetPath: string) {
  await runAsOpenClaw(["tee", `${aiEditConfig.workspaceDir}/EDIT_BRIEF.md`], {
    input: createBrief(jobPrompt, jobTargetPath)
  });
}

async function ensureAgent() {
  const result = await runAsOpenClaw([aiEditConfig.openClawBin, "agents", "list", "--json"]);
  const agents = JSON.parse(result.stdout || "[]") as Array<{ id?: string }>;

  if (agents.some((agent) => agent.id === aiEditConfig.agentId)) {
    return aiEditConfig.agentId;
  }

  await runAsOpenClaw([
    aiEditConfig.openClawBin,
    "agents",
    "add",
    aiEditConfig.agentId,
    "--workspace",
    aiEditConfig.workspaceDir,
    "--model",
    aiEditConfig.model,
    "--non-interactive",
    "--json"
  ]);

  return aiEditConfig.agentId;
}

function installWorkspaceDependencies() {
  return runAsOpenClawInDir(
    aiEditConfig.workspaceDir,
    ["/usr/bin/corepack", "yarn", "install", "--frozen-lockfile"],
    { timeoutMs: aiEditConfig.installTimeoutMs }
  );
}

function runAgent(agentId: string, jobId: string, jobTargetPath: string) {
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
    aiEditConfig.workspaceDir,
    [
      aiEditConfig.openClawBin,
      "agent",
      "--agent",
      agentId,
      "--session-id",
      jobId,
      "--thinking",
      aiEditConfig.thinking,
      "--timeout",
      String(aiEditConfig.agentTimeoutSeconds),
      "--json",
      "-m",
      agentMessage
    ],
    { timeoutMs: (aiEditConfig.agentTimeoutSeconds + 120) * 1000 }
  );
}

function collectTextPayloads(payloads: Array<{ text?: string; thinking?: string; type?: string }>) {
  const summaryParts: string[] = [];
  const thinkingParts: string[] = [];

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

function detectAgentFailure(rawOutput: string, summary: string) {
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

function parseAgentResult(stdout: string) {
  try {
    const payload = JSON.parse(stdout) as {
      content?: Array<{ text?: string; thinking?: string; type?: string }>;
      result?: { payloads?: Array<{ text?: string; thinking?: string; type?: string }> };
    };
    const payloads = payload?.result?.payloads ?? payload?.content ?? [];
    const { summary, thinking } = collectTextPayloads(Array.isArray(payloads) ? payloads : []);
    const failure = detectAgentFailure(stdout, summary);

    return {
      summary: summary || "변경 작업이 완료되었습니다.",
      thinking,
      failure
    };
  } catch {
    const failure = detectAgentFailure(stdout, stdout);
    return {
      summary: stdout.trim() || "변경 작업이 완료되었습니다.",
      thinking: null,
      failure
    };
  }
}

function buildWorkspace() {
  return runAsOpenClawInDir(
    aiEditConfig.workspaceDir,
    ["env", "NEXT_TELEMETRY_DISABLED=1", "/usr/bin/node", "./node_modules/next/dist/bin/next", "build"],
    { timeoutMs: aiEditConfig.buildTimeoutMs }
  );
}

async function syncToAppDir() {
  await runCommand(flockBin, [
    "-x",
    "-w",
    "60",
    aiEditConfig.appDirLock,
    sudoBin,
    "rsync",
    "-a",
    "--delete",
    "--exclude",
    ".git",
    "--exclude",
    "node_modules",
    "--exclude",
    ".openclaw",
    "--exclude",
    "AGENTS.md",
    "--exclude",
    "BOOTSTRAP.md",
    "--exclude",
    "EDIT_BRIEF.md",
    "--exclude",
    "HEARTBEAT.md",
    "--exclude",
    "IDENTITY.md",
    "--exclude",
    "SOUL.md",
    "--exclude",
    "TOOLS.md",
    "--exclude",
    "USER.md",
    `${aiEditConfig.workspaceDir}/`,
    `${aiEditConfig.appDir}/`
  ]);

  if (process.platform === "linux") {
    await runCommand(sudoBin, ["chown", "-R", aiEditConfig.appDirOwner, aiEditConfig.appDir]);
  }
}

function restartFrontend() {
  if (process.platform === "linux") {
    return runCommand("bash", [
      "-lc",
      `nohup env HOME=/home/studio PM2_HOME=/home/studio/.pm2 pm2 restart '${aiEditConfig.pm2ProcessName}' >/home/studio/logs/ai-edit/pm2-restart.log 2>&1 < /dev/null &`
    ]);
  }

  return runCommand(aiEditConfig.restartFrontendScript, []);
}

async function dequeueNext() {
  const state = await readState();
  if (state.queue.length === 0) {
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
    currentStep: `대기 중이던 AI 수정 작업을 시작합니다. (남은 대기 ${remaining.length}건)`,
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

async function processJob(jobId: string, jobPrompt: string, jobTargetPath: string) {
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
      step: "AI 작업 의존성을 준비하고 있습니다.",
      label: "Install"
    },
    () => installWorkspaceDependencies()
  );

  await pulseState({
    step: "AI 편집 에이전트를 초기화하고 있습니다.",
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
      step: "수정 결과를 워크스페이스에서 빌드 검증하고 있습니다.",
      label: "Build"
    },
    () => buildWorkspace()
  );

  await withHeartbeat(
    {
      step: "변경 사항을 서비스 코드에 반영하고 있습니다.",
      label: "Syncing"
    },
    () => syncToAppDir()
  );

  if (shouldRestartAfterEdit) {
    await updateState((state) => ({
      ...state,
      status: "running",
      pid: process.pid,
      currentStep: summary,
      heartbeatAt: new Date().toISOString(),
      heartbeatLabel: "Restarting",
      thinking,
      error: null,
      completedAt: null
    }));

    await restartFrontend();
    return false;
  }

  await updateState((state) => ({
    ...state,
    status: "done",
    pid: null,
    currentStep: summary,
    heartbeatAt: new Date().toISOString(),
    heartbeatLabel: "Done",
    thinking,
    error: null,
    completedAt: new Date().toISOString()
  }));

  return true;
}

async function main() {
  let currentJobId = process.env.AI_EDIT_JOB_ID || "";
  let currentPrompt = process.env.AI_EDIT_PROMPT || "";
  let currentTargetPath = process.env.AI_EDIT_TARGET_PATH || "";

  while (true) {
    try {
      const canContinue = await processJob(currentJobId, currentPrompt, currentTargetPath);
      if (!canContinue) {
        break;
      }
    } catch (error) {
      await updateState((state) => ({
        ...state,
        status: "failed",
        pid: null,
        currentStep: null,
        heartbeatAt: new Date().toISOString(),
        heartbeatLabel: "Failed",
        error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
        completedAt: new Date().toISOString()
      }));
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

void main().catch(async (error) => {
  try {
    await updateState((state) => ({
      ...state,
      status: "failed",
      pid: null,
      currentStep: null,
      heartbeatAt: new Date().toISOString(),
      heartbeatLabel: "Failed",
      error: error instanceof Error ? error.message : "AI 수정 작업이 실패했습니다.",
      completedAt: new Date().toISOString()
    }));
  } catch {
    // ignore
  }

  process.exit(1);
});
