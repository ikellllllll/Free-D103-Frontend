import "server-only";

import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AiEditQueueItem, AiEditStartInput, AiEditState } from "@/lib/ai-edit/types";

const isLinux = process.platform === "linux";

const defaultStateDir = () => {
  if (process.env.AIG_AI_EDIT_STATE_DIR) {
    return process.env.AIG_AI_EDIT_STATE_DIR;
  }

  if (isLinux && existsSync("/home/studio/logs")) {
    return "/home/studio/logs/ai-edit";
  }

  return path.join(process.cwd(), ".ai-edit-runtime");
};

export const aiEditConfig = {
  appDir: process.env.AIG_WORKSHOP_FRONTEND_APP_DIR ?? "/home/studio/apps/Free-D103-Frontend",
  openClawBin: process.env.AIG_WORKSHOP_OPENCLAW_BIN ?? "/home/openclaw-studio/.openclaw/bin/openclaw",
  openClawUser: process.env.AIG_WORKSHOP_OPENCLAW_USER ?? "openclaw-studio",
  restartFrontendScript: process.env.AIG_WORKSHOP_RESTART_SCRIPT ?? "/home/studio/deploy/restart-frontend.sh",
  workspaceDir: process.env.AIG_AI_EDIT_WORKSPACE ?? "/home/openclaw-studio/ai-edit-workspace",
  model: process.env.AIG_AI_EDIT_MODEL ?? "openai-codex/gpt-5.4",
  thinking: process.env.AIG_AI_EDIT_THINKING ?? "medium",
  agentTimeoutSeconds: Number(process.env.AIG_AI_EDIT_TIMEOUT ?? "900"),
  healthcheckUrl: process.env.AIG_AI_EDIT_HEALTHCHECK_URL ?? "http://127.0.0.1:3002/login",
  stateDir: defaultStateDir(),
  stateFile: path.join(defaultStateDir(), "state.json"),
  workshopStateFile:
    process.env.AIG_WORKSHOP_STATE_FILE ??
    (isLinux && existsSync("/home/studio/logs")
      ? "/home/studio/logs/preview-workshop/state.json"
      : path.join(process.cwd(), ".workshop-runtime", "state.json"))
};

function pathExists(targetPath: string) {
  if (!targetPath) return false;
  if (!isLinux) return existsSync(targetPath);

  if (existsSync(targetPath)) return true;
  return spawnSync("sudo", ["test", "-e", targetPath], { stdio: "ignore" }).status === 0;
}

export function isAiEditConfigured() {
  return pathExists(aiEditConfig.openClawBin) && pathExists(aiEditConfig.restartFrontendScript);
}

const createInitialState = (): AiEditState => ({
  configured: isAiEditConfigured(),
  status: "idle",
  jobId: null,
  pid: null,
  prompt: "",
  targetPath: "",
  currentStep: null,
  heartbeatAt: null,
  heartbeatLabel: null,
  thinking: null,
  error: null,
  startedAt: null,
  completedAt: null,
  updatedAt: new Date().toISOString(),
  queue: []
});

export async function ensureStateDir() {
  await mkdir(aiEditConfig.stateDir, { recursive: true });
}

function isPidAlive(pid: number | null) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function isFrontendHealthy() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(aiEditConfig.healthcheckUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

export async function writeAiEditState(next: AiEditState) {
  await ensureStateDir();
  const payload = { ...next, updatedAt: new Date().toISOString() };
  await writeFile(aiEditConfig.stateFile, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

function spawnRunner(jobId: string, prompt: string, targetPath: string) {
  const workerPath = path.join(process.cwd(), "scripts", "ai-edit-runner.js");
  const child = spawn(process.execPath, [workerPath], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      AI_EDIT_JOB_ID: jobId,
      AI_EDIT_PROMPT: prompt,
      AI_EDIT_TARGET_PATH: targetPath,
      AI_EDIT_STATE_FILE: aiEditConfig.stateFile
    }
  });
  child.unref();
  return child.pid ?? null;
}

async function isWorkshopBusy() {
  try {
    if (!existsSync(aiEditConfig.workshopStateFile)) return false;

    const raw = JSON.parse(await readFile(aiEditConfig.workshopStateFile, "utf8"));
    const busy = raw?.status === "running" || raw?.status === "promoting";
    return busy && isPidAlive(raw?.currentPid ?? null);
  } catch {
    return false;
  }
}

export async function readAiEditState(): Promise<AiEditState> {
  await ensureStateDir();

  if (!existsSync(aiEditConfig.stateFile)) {
    return writeAiEditState(createInitialState());
  }

  const raw = JSON.parse(await readFile(aiEditConfig.stateFile, "utf8")) as Partial<AiEditState>;
  const state: AiEditState = {
    ...createInitialState(),
    ...raw,
    queue: Array.isArray(raw.queue) ? raw.queue : []
  };

  if (state.status === "running" && state.pid && !isPidAlive(state.pid)) {
    if (state.heartbeatLabel === "Restarting") {
      if (await isFrontendHealthy()) {
        return writeAiEditState({
          ...state,
          status: "done",
          pid: null,
          currentStep: "수정 내용을 반영했고 서비스를 다시 시작했습니다.",
          heartbeatAt: new Date().toISOString(),
          heartbeatLabel: "Done",
          error: null,
          completedAt: new Date().toISOString()
        });
      }

      const restartAgeMs =
        state.heartbeatAt ? Date.now() - new Date(state.heartbeatAt).getTime() : Number.POSITIVE_INFINITY;
      if (restartAgeMs < 90_000) {
        return state;
      }
    }

    return writeAiEditState({
      ...state,
      status: "failed",
      pid: null,
      currentStep: null,
      heartbeatAt: null,
      heartbeatLabel: null,
      error: "AI 수정 작업이 비정상 종료되었습니다."
    });
  }

  if (
    (state.status === "idle" || state.status === "done" || state.status === "failed") &&
    state.queue.length > 0 &&
    !(await isWorkshopBusy())
  ) {
    const [next, ...remaining] = state.queue;
    const started: AiEditState = {
      ...state,
      configured: isAiEditConfigured(),
      status: "running",
      jobId: next.jobId,
      pid: null,
      prompt: next.prompt,
      targetPath: next.targetPath,
      currentStep: "대기 중이던 AI 수정 작업을 시작합니다.",
      heartbeatAt: null,
      heartbeatLabel: null,
      thinking: null,
      error: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      queue: remaining
    };

    await writeAiEditState(started);
    const pid = spawnRunner(next.jobId, next.prompt, next.targetPath);
    return writeAiEditState({ ...started, pid });
  }

  const configured = isAiEditConfigured();
  if (state.configured !== configured) {
    return writeAiEditState({ ...state, configured });
  }

  return state;
}

export async function startAiEdit(input: AiEditStartInput) {
  const prompt = input.prompt.trim();

  if (!prompt) {
    throw new Error("수정 요청을 입력해 주세요.");
  }

  if (!isAiEditConfigured()) {
    throw new Error("AI 수정 환경이 아직 서버에 준비되지 않았습니다.");
  }

  const current = await readAiEditState();
  const isRunning = current.status === "running" && isPidAlive(current.pid);
  const workshopBusy = await isWorkshopBusy();

  if (isRunning || workshopBusy) {
    const item: AiEditQueueItem = {
      jobId: randomUUID(),
      prompt,
      targetPath: input.targetPath ?? "",
      enqueuedAt: new Date().toISOString()
    };

    return writeAiEditState({
      ...current,
      queue: [...current.queue, item],
      currentStep:
        current.currentStep ??
        (workshopBusy
          ? "워크숍 작업이 끝나는 즉시 처리됩니다."
          : "현재 실행 중인 작업이 끝나는 즉시 처리됩니다.")
    });
  }

  const jobId = randomUUID();
  const nextState: AiEditState = {
    configured: true,
    status: "running",
    jobId,
    pid: null,
    prompt,
    targetPath: input.targetPath ?? "",
    currentStep: "AI 수정 작업을 준비하고 있습니다.",
    heartbeatAt: null,
    heartbeatLabel: null,
    thinking: null,
    error: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    updatedAt: new Date().toISOString(),
    queue: current.queue
  };

  await writeAiEditState(nextState);

  const pid = spawnRunner(jobId, prompt, input.targetPath ?? "");
  nextState.pid = pid;
  return writeAiEditState(nextState);
}
