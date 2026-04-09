#!/usr/bin/env node

/**
 * ai-edit-runner.js
 *
 * 백그라운드 AI 편집 실행기.
 * 흐름: 워크스페이스 준비 → OpenClaw 에이전트 실행 → rsync → (선택) 프론트엔드 재시작
 *
 * dev 모드 기본값: rsync 후 Next.js HMR이 자동 감지 — 재시작 없음
 * 프로덕션 재시작 필요 시: AIG_AI_EDIT_RESTART=true
 */

const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

// ── 환경 변수 ────────────────────────────────────────────────────
const stateFile = process.env.AI_EDIT_STATE_FILE;
const jobId = process.env.AI_EDIT_JOB_ID || "";
const requestPrompt = process.env.AI_EDIT_PROMPT || "";
const targetPath = process.env.AI_EDIT_TARGET_PATH || "";

if (!stateFile) {
  console.error("AI_EDIT_STATE_FILE is required.");
  process.exit(1);
}

// ── 설정 ────────────────────────────────────────────────────────
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
  thinking: process.env.AIG_AI_EDIT_THINKING || "high",
  agentTimeoutSeconds: Number(process.env.AIG_AI_EDIT_TIMEOUT || "600"),
  agentId: "ai-edit"
};

// ── 상태 관리 ────────────────────────────────────────────────────
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function readState() {
  return JSON.parse(await fs.readFile(stateFile, "utf8"));
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

// ── 명령 실행 ────────────────────────────────────────────────────
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

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

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

    if (options.input) child.stdin.write(options.input);
    child.stdin.end();
  });
}

function runAsOpenClaw(args, options = {}) {
  return runCommand(sudoBin, ["-u", config.openClawUser, ...args], options);
}

function runAsOpenClawInDir(workingDir, args, options = {}) {
  return runAsOpenClaw(
    ["bash", "-lc", 'cd "$1" && shift && exec "$@"', "--", workingDir, ...args],
    options
  );
}

// ── 워크스페이스 준비 ────────────────────────────────────────────
async function prepareWorkspace() {
  await runCommand(sudoBin, ["rm", "-rf", config.workspaceDir]);
  await runAsOpenClaw(["mkdir", "-p", config.workspaceDir]);

  // flock: appDir 읽기 중 다른 프로세스의 쓰기 방지
  await runCommand(flockBin, [
    "-s", "-w", "60", APP_DIR_LOCK,
    sudoBin, "rsync", "-a", "--delete",
    "--exclude", ".git",
    "--exclude", "node_modules",
    "--exclude", ".next",
    `${config.appDir}/`,
    `${config.workspaceDir}/`
  ]);

  await runAsOpenClaw([
    "ln", "-sfn",
    `${config.appDir}/node_modules`,
    `${config.workspaceDir}/node_modules`
  ]);

  await runCommand(sudoBin, [
    "chown", "-R",
    `${config.openClawUser}:${config.openClawUser}`,
    config.workspaceDir
  ]);
}

// ── EDIT_BRIEF.md 생성 ───────────────────────────────────────────
function createBrief() {
  return [
    "# UI 편집 요청",
    "",
    targetPath ? `대상 페이지: ${targetPath}` : "대상 페이지: 전체 (명시되지 않음)",
    "",
    "## 요청 내용",
    requestPrompt,
    "",
    "## 제약 조건",
    "- 이 프로젝트는 커스텀 CSS를 사용합니다 (Tailwind 미사용). className 변경 시 app/globals.css의 기존 클래스를 활용하세요.",
    "- 기존 라우팅, API 로직, 데이터 흐름은 유지합니다.",
    "- 요청한 페이지와 직접 연결된 컴포넌트 위주로 수정합니다.",
    "- 한국어 문구를 유지합니다.",
    "- 마케팅 랜딩보다 실제 제품 UI 느낌을 우선합니다.",
    "- 불필요한 파일을 새로 생성하지 않습니다.",
    "",
    "## 프로젝트 구조 힌트",
    "- 페이지: app/(main)/ 또는 app/(auth)/ 하위 page.tsx",
    "- 공통 컴포넌트: components/",
    "- 전역 스타일: app/globals.css (CSS 변수 기반 디자인 토큰 사용)",
    "- 스토어: store/ (Zustand)",
    "- 타입: lib/types/"
  ].join("\n");
}

async function writeBrief() {
  await runAsOpenClaw(
    ["tee", `${config.workspaceDir}/EDIT_BRIEF.md`],
    { input: createBrief() }
  );
}

// ── OpenClaw 에이전트 준비 ────────────────────────────────────────
async function ensureAgent() {
  const result = await runAsOpenClaw([config.openClawBin, "agents", "list", "--json"]);
  const agents = JSON.parse(result.stdout || "[]");

  if (agents.some((agent) => agent.id === config.agentId)) {
    return config.agentId;
  }

  await runAsOpenClaw([
    config.openClawBin, "agents", "add",
    config.agentId,
    "--workspace", config.workspaceDir,
    "--model", config.model,
    "--non-interactive",
    "--json"
  ]);

  return config.agentId;
}

// ── OpenClaw 에이전트 실행 ────────────────────────────────────────
async function runAgent(agentId) {
  const agentMessage = [
    "Read EDIT_BRIEF.md first.",
    "Explore the codebase, identify the files that need changing, and implement the edit request completely.",
    "Focus only on the files relevant to the request. Do not modify unrelated code.",
    "After making changes, verify there are no obvious TypeScript errors in the modified files.",
    "Respond with 2-3 lines summarizing what you changed and why."
  ].join(" ");

  return runAsOpenClawInDir(
    config.workspaceDir,
    [
      config.openClawBin,
      "agent",
      "--agent", agentId,
      "--session-id", jobId,
      "--thinking", config.thinking,
      "--timeout", String(config.agentTimeoutSeconds),
      "--json",
      "-m", agentMessage
    ],
    { timeoutMs: (config.agentTimeoutSeconds + 120) * 1000 }
  );
}

// ── 결과 파싱 (summary + thinking) ───────────────────────────────
function parseAgentResult(stdout) {
  try {
    const payload = JSON.parse(stdout);
    const payloads = payload?.result?.payloads ?? payload?.content ?? [];

    const summaryParts = [];
    const thinkingParts = [];

    for (const item of payloads) {
      if (item.type === "thinking" && item.thinking) {
        thinkingParts.push(item.thinking);
      } else if (item.type === "text" && item.text) {
        summaryParts.push(item.text);
      } else if (typeof item.text === "string" && item.text.trim()) {
        summaryParts.push(item.text);
      }
    }

    return {
      summary: summaryParts.join("\n").trim() || "변경이 완료되었습니다.",
      thinking: thinkingParts.join("\n\n").trim() || null
    };
  } catch {
    return { summary: "변경이 완료되었습니다.", thinking: null };
  }
}

// ── 변경사항 앱에 반영 ───────────────────────────────────────────
async function syncToAppDir() {
  // flock -x: 배타적 잠금 — 동시 쓰기 방지
  await runCommand(flockBin, [
    "-x", "-w", "60", APP_DIR_LOCK,
    sudoBin, "rsync", "-a", "--delete",
    "--exclude", ".git",
    "--exclude", "node_modules",
    "--exclude", ".next",
    `${config.workspaceDir}/`,
    `${config.appDir}/`
  ]);
}

// ── 메인 ────────────────────────────────────────────────────────
async function main() {
  try {
    await updateState((state) => {
      state.currentStep = "워크스페이스를 준비하는 중입니다.";
      return state;
    });
    await prepareWorkspace();
    await writeBrief();

    await updateState((state) => {
      state.currentStep = "AI 에이전트를 초기화하는 중입니다.";
      return state;
    });
    const agentId = await ensureAgent();

    await updateState((state) => {
      state.currentStep = "코드를 분석하고 수정하는 중입니다. 잠시 기다려 주세요.";
      return state;
    });
    const agentResult = await runAgent(agentId);
    const { summary, thinking } = parseAgentResult(agentResult.stdout);

    await updateState((state) => {
      state.currentStep = "변경사항을 적용하는 중입니다.";
      return state;
    });
    await syncToAppDir();

    // dev 모드: rsync 후 HMR이 자동 감지
    // 프로덕션 빌드 필요 시: AIG_AI_EDIT_RESTART=true
    if (process.env.AIG_AI_EDIT_RESTART === "true") {
      await updateState((state) => {
        state.currentStep = "빌드 및 서버를 재시작하는 중입니다. (1~3분 소요)";
        return state;
      });
      await runCommand(config.restartFrontendScript, []);
    }

    await updateState((state) => {
      state.status = "done";
      state.pid = null;
      state.currentStep = summary;
      state.thinking = thinking;
      state.completedAt = new Date().toISOString();
      return state;
    });
  } catch (error) {
    await updateState((state) => {
      state.status = "failed";
      state.pid = null;
      state.currentStep = null;
      state.thinking = state.thinking ?? null;
      state.error = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
      return state;
    });
    process.exit(1);
  }
}

main();
