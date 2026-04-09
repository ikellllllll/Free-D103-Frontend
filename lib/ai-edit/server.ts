import "server-only";

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
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
  thinking: process.env.AIG_AI_EDIT_THINKING ?? "high",
  agentTimeoutSeconds: Number(process.env.AIG_AI_EDIT_TIMEOUT ?? "600"),
  stateDir: defaultStateDir(),
  stateFile: path.join(defaultStateDir(), "state.json"),
  // 교차 충돌 방지용 — workshop 상태 파일 위치
  workshopStateFile: process.env.AIG_WORKSHOP_STATE_FILE
    ?? (isLinux && existsSync("/home/studio/logs")
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
  return (
    pathExists(aiEditConfig.openClawBin) &&
    pathExists(aiEditConfig.restartFrontendScript)
  );
}

const createInitialState = (): AiEditState => ({
  configured: isAiEditConfigured(),
  status: "idle",
  jobId: null,
  pid: null,
  prompt: "",
  targetPath: "",
  currentStep: null,
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

export async function writeAiEditState(next: AiEditState) {
  await ensureStateDir();
  const payload = { ...next, updatedAt: new Date().toISOString() };
  await writeFile(aiEditConfig.stateFile, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

export async function readAiEditState(): Promise<AiEditState> {
  await ensureStateDir();

  if (!existsSync(aiEditConfig.stateFile)) {
    return writeAiEditState(createInitialState());
  }

  const raw = JSON.parse(await readFile(aiEditConfig.stateFile, "utf8")) as AiEditState;

  // queue 필드 없는 구 버전 상태 파일 호환
  if (!Array.isArray(raw.queue)) raw.queue = [];

  if (raw.status === "running" && raw.pid && !isPidAlive(raw.pid)) {
    // runner가 죽었으면: 큐에 항목이 있어도 새 runner가 없으므로 실패 처리
    return writeAiEditState({
      ...raw,
      status: "failed",
      pid: null,
      currentStep: null,
      error: "작업이 비정상 종료되었습니다.",
      queue: raw.queue
    });
  }

  const configured = isAiEditConfigured();
  if (raw.configured !== configured) {
    return writeAiEditState({ ...raw, configured });
  }

  return raw;
}

// workshop 상태 파일을 직접 읽어 실행 중인지 확인 (순환 import 방지)
async function isWorkshopBusy(): Promise<boolean> {
  try {
    if (!existsSync(aiEditConfig.workshopStateFile)) return false;
    const raw = JSON.parse(await readFile(aiEditConfig.workshopStateFile, "utf8"));
    const busy = raw?.status === "running" || raw?.status === "promoting";
    return busy && isPidAlive(raw?.currentPid ?? null);
  } catch {
    return false;
  }
}

export async function startAiEdit(input: AiEditStartInput) {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("수정 요청을 입력해 주세요.");
  if (!isAiEditConfigured()) throw new Error("AI 에디팅 런타임이 아직 서버에 준비되지 않았습니다.");

  const current = await readAiEditState();
  const isRunning = current.status === "running" && isPidAlive(current.pid);
  const workshopBusy = await isWorkshopBusy();

  // 바쁜 경우 → 큐에 추가하고 반환 (에러 아님)
  if (isRunning || workshopBusy) {
    const item: AiEditQueueItem = {
      jobId: randomUUID(),
      prompt,
      targetPath: input.targetPath ?? "",
      enqueuedAt: new Date().toISOString()
    };
    const reason = workshopBusy
      ? "워크숍 작업 완료 후 처리됩니다."
      : "현재 작업 완료 후 처리됩니다.";
    return writeAiEditState({
      ...current,
      queue: [...(current.queue ?? []), item],
      // currentStep에 큐 힌트를 남겨두면 폴링 UI에서 볼 수 있음
      currentStep: current.currentStep ?? reason
    });
  }

  // 즉시 실행
  const jobId = randomUUID();
  const nextState: AiEditState = {
    configured: true,
    status: "running",
    jobId,
    pid: null,
    prompt,
    targetPath: input.targetPath ?? "",
    currentStep: "수정 작업을 준비하는 중입니다.",
    thinking: null,
    error: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    updatedAt: new Date().toISOString(),
    queue: current.queue ?? []
  };

  await writeAiEditState(nextState);

  const workerPath = path.join(process.cwd(), "scripts", "ai-edit-runner.js");
  const child = spawn(process.execPath, [workerPath], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      AI_EDIT_JOB_ID: jobId,
      AI_EDIT_PROMPT: prompt,
      AI_EDIT_TARGET_PATH: input.targetPath ?? "",
      AI_EDIT_STATE_FILE: aiEditConfig.stateFile
    }
  });

  child.unref();

  nextState.pid = child.pid ?? null;
  return writeAiEditState(nextState);
}
