import "server-only";

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

import type { WorkshopGenerateInput, WorkshopState, WorkshopVariantId, WorkshopVariantState } from "@/lib/workshop/types";

interface WorkshopConfig {
  appDir: string;
  baseWorkspace: string;
  openClawBin: string;
  openClawUser: string;
  restartFrontendScript: string;
  stateDir: string;
  stateFile: string;
  variantRoot: string;
}

interface CommandResult {
  code: number;
  stderr: string;
  stdout: string;
}

const isLinux = process.platform === "linux";

const defaultStateDir = () => {
  if (process.env.AIG_WORKSHOP_DIR) {
    return process.env.AIG_WORKSHOP_DIR;
  }

  if (isLinux && existsSync("/home/studio/logs")) {
    return "/home/studio/logs/preview-workshop";
  }

  return path.join(process.cwd(), ".workshop-runtime");
};

export const workshopConfig: WorkshopConfig = {
  appDir: process.env.AIG_WORKSHOP_FRONTEND_APP_DIR ?? "/home/studio/apps/Free-D103-Frontend",
  baseWorkspace: process.env.AIG_WORKSHOP_BASE_WORKSPACE ?? "/home/openclaw-studio/workspace/Free-D103-Frontend",
  openClawBin: process.env.AIG_WORKSHOP_OPENCLAW_BIN ?? "/home/openclaw-studio/.openclaw/bin/openclaw",
  openClawUser: process.env.AIG_WORKSHOP_OPENCLAW_USER ?? "openclaw-studio",
  restartFrontendScript: process.env.AIG_WORKSHOP_RESTART_SCRIPT ?? "/home/studio/deploy/restart-frontend.sh",
  stateDir: defaultStateDir(),
  stateFile: path.join(defaultStateDir(), "state.json"),
  variantRoot: process.env.AIG_WORKSHOP_VARIANT_ROOT ?? "/home/openclaw-studio/preview-workshop/variants"
};

function pathExistsForWorkshop(targetPath: string) {
  if (!targetPath) {
    return false;
  }

  if (!isLinux) {
    return existsSync(targetPath);
  }

  const directCheck = existsSync(targetPath);
  if (directCheck) {
    return true;
  }

  const sudoCheck = spawnSync("sudo", ["test", "-e", targetPath], {
    stdio: "ignore"
  });

  return sudoCheck.status === 0;
}

const variantBlueprints: WorkshopVariantState[] = [
  {
    id: "a",
    title: "A안",
    direction: "보수적으로 정돈한 버전",
    url: process.env.AIG_WORKSHOP_PREVIEW_A_URL ?? "https://preview-a.158.180.89.153.sslip.io",
    status: "idle",
    summary: null,
    error: null,
    updatedAt: null
  },
  {
    id: "b",
    title: "B안",
    direction: "업무툴 톤을 강화한 버전",
    url: process.env.AIG_WORKSHOP_PREVIEW_B_URL ?? "https://preview-b.158.180.89.153.sslip.io",
    status: "idle",
    summary: null,
    error: null,
    updatedAt: null
  }
];

const createInitialState = (configured = isWorkshopConfigured()): WorkshopState => ({
  configured,
  status: "idle",
  currentJobId: null,
  currentPid: null,
  targetPath: "",
  prompt: "",
  runningStep: null,
  heartbeatAt: null,
  heartbeatLabel: null,
  error: null,
  selectedVariant: null,
  startedAt: null,
  updatedAt: new Date().toISOString(),
  lastPromotionAt: null,
  variants: variantBlueprints.map((variant) => ({ ...variant }))
});

const mergeState = (raw: Partial<WorkshopState> | null | undefined): WorkshopState => {
  const base = createInitialState(raw?.configured ?? isWorkshopConfigured());
  const variants = raw?.variants ?? [];

  return {
    ...base,
    ...raw,
    variants: base.variants.map((variant) => ({
      ...variant,
      ...(variants.find((candidate) => candidate.id === variant.id) ?? {})
    }))
  };
};

export function isWorkshopConfigured() {
  return (
    pathExistsForWorkshop(workshopConfig.openClawBin) &&
    pathExistsForWorkshop(workshopConfig.baseWorkspace) &&
    pathExistsForWorkshop(workshopConfig.variantRoot) &&
    pathExistsForWorkshop(workshopConfig.restartFrontendScript)
  );
}

export async function ensureWorkshopStateDir() {
  await mkdir(workshopConfig.stateDir, { recursive: true });
}

function isPidAlive(pid: number | null) {
  if (!pid) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function writeWorkshopState(nextState: WorkshopState) {
  await ensureWorkshopStateDir();
  const payload = {
    ...nextState,
    updatedAt: new Date().toISOString()
  };
  await writeFile(workshopConfig.stateFile, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

export async function readWorkshopState() {
  await ensureWorkshopStateDir();

  if (!existsSync(workshopConfig.stateFile)) {
    return writeWorkshopState(createInitialState());
  }

  const raw = await readFile(workshopConfig.stateFile, "utf8");
  const state = mergeState(JSON.parse(raw) as WorkshopState);

  if ((state.status === "running" || state.status === "promoting") && state.currentPid && !isPidAlive(state.currentPid)) {
    const hasReadyVariant = state.variants.some((variant) => variant.status === "ready");
    const hasFailedVariant = state.variants.some((variant) => variant.status === "failed");

    state.currentPid = null;
    state.runningStep = null;
    state.heartbeatLabel = null;

    if (state.status === "promoting") {
      state.status = hasReadyVariant ? "ready" : "failed";
      state.error ??= "반영 작업이 비정상 종료되었습니다.";
    } else if (hasReadyVariant || hasFailedVariant) {
      state.status = hasReadyVariant ? "ready" : "failed";
      state.error ??= hasFailedVariant ? "일부 시안 생성에 실패했습니다." : null;
    } else {
      state.status = "failed";
      state.error ??= "백그라운드 작업이 예기치 않게 종료되었습니다.";
    }

    return writeWorkshopState(state);
  }

  if (state.configured !== isWorkshopConfigured()) {
    state.configured = isWorkshopConfigured();
    return writeWorkshopState(state);
  }

  return state;
}

function normalizeTargetPath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export async function startWorkshopGeneration(input: WorkshopGenerateInput) {
  const targetPath = normalizeTargetPath(input.targetPath);
  const prompt = input.prompt.trim();

  if (!targetPath) {
    throw new Error("대상 페이지 경로를 입력해 주세요.");
  }

  if (!prompt) {
    throw new Error("수정 요청을 입력해 주세요.");
  }

  if (!isWorkshopConfigured()) {
    throw new Error("워크숍 런타임이 아직 서버에 준비되지 않았습니다.");
  }

  const current = await readWorkshopState();
  if ((current.status === "running" || current.status === "promoting") && isPidAlive(current.currentPid)) {
    throw new Error("다른 워크숍 작업이 진행 중입니다. 완료 후 다시 시도해 주세요.");
  }

  const currentJobId = randomUUID();
  const nextState = createInitialState(true);
  nextState.status = "running";
  nextState.currentJobId = currentJobId;
  nextState.targetPath = targetPath;
  nextState.prompt = prompt;
  nextState.startedAt = new Date().toISOString();
  nextState.heartbeatAt = nextState.startedAt;
  nextState.heartbeatLabel = "Queued";
  nextState.runningStep = "A/B 시안을 생성하는 중입니다.";
  nextState.variants = nextState.variants.map((variant) => ({
    ...variant,
    status: "queued",
    summary: null,
    error: null,
    updatedAt: null
  }));

  await writeWorkshopState(nextState);

  const workerPath = path.join(process.cwd(), "scripts", "workshop-runner.js");
  const child = spawn(process.execPath, [workerPath, "generate"], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      WORKSHOP_JOB_ID: currentJobId,
      WORKSHOP_REQUEST_PROMPT: prompt,
      WORKSHOP_STATE_FILE: workshopConfig.stateFile,
      WORKSHOP_TARGET_PATH: targetPath
    }
  });

  child.unref();

  nextState.currentPid = child.pid ?? null;
  return writeWorkshopState(nextState);
}

function runCommand(command: string, args: string[], cwd?: string) {
  return new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ code: code ?? 0, stdout, stderr });
        return;
      }

      reject(new Error(stderr.trim() || stdout.trim() || `${command} exited with ${code}`));
    });
  });
}

export async function promoteWorkshopVariant(variantId: WorkshopVariantId) {
  if (!isWorkshopConfigured()) {
    throw new Error("워크숍 런타임이 아직 서버에 준비되지 않았습니다.");
  }

  const state = await readWorkshopState();

  if (state.status === "running" && isPidAlive(state.currentPid)) {
    throw new Error("시안 생성이 아직 끝나지 않았습니다.");
  }

  const variant = state.variants.find((item) => item.id === variantId);
  if (!variant || variant.status !== "ready") {
    throw new Error("반영 가능한 시안이 아닙니다.");
  }

  state.status = "promoting";
  state.error = null;
  state.runningStep = `${variant.title}을 본 서비스에 반영하는 중입니다.`;
  state.heartbeatAt = new Date().toISOString();
  state.heartbeatLabel = "Promoting";
  await writeWorkshopState(state);

  const sourceDir = path.join(workshopConfig.variantRoot, variantId);
  await runCommand("sudo", [
    "rsync",
    "-a",
    "--delete",
    "--exclude",
    ".git",
    "--exclude",
    "node_modules",
    "--exclude",
    ".next",
    `${sourceDir}/`,
    `${workshopConfig.appDir}/`
  ]);

  await runCommand(workshopConfig.restartFrontendScript, []);

  state.status = "ready";
  state.selectedVariant = variantId;
  state.currentPid = null;
  state.runningStep = null;
  state.heartbeatAt = new Date().toISOString();
  state.heartbeatLabel = null;
  state.lastPromotionAt = new Date().toISOString();
  state.error = null;

  return writeWorkshopState(state);
}
