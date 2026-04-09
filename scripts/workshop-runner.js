#!/usr/bin/env node

const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { spawn } = require("node:child_process");

const action = process.argv[2];

const stateFile = process.env.WORKSHOP_STATE_FILE;
const jobId = process.env.WORKSHOP_JOB_ID || randomUUID();
const targetPath = process.env.WORKSHOP_TARGET_PATH || "";
const requestPrompt = process.env.WORKSHOP_REQUEST_PROMPT || "";

if (!stateFile) {
  console.error("WORKSHOP_STATE_FILE is required.");
  process.exit(1);
}

const stateDir = path.dirname(stateFile);
const isLinux = process.platform === "linux";

const config = {
  baseWorkspace: process.env.AIG_WORKSHOP_BASE_WORKSPACE || "/home/openclaw-studio/workspace/Free-D103-Frontend",
  openClawBin: process.env.AIG_WORKSHOP_OPENCLAW_BIN || "/home/openclaw-studio/.openclaw/bin/openclaw",
  openClawUser: process.env.AIG_WORKSHOP_OPENCLAW_USER || "openclaw-studio",
  variantRoot: process.env.AIG_WORKSHOP_VARIANT_ROOT || "/home/openclaw-studio/preview-workshop/variants",
  previewUrls: {
    a: process.env.AIG_WORKSHOP_PREVIEW_A_URL || "https://preview-a.158.180.89.153.sslip.io",
    b: process.env.AIG_WORKSHOP_PREVIEW_B_URL || "https://preview-b.158.180.89.153.sslip.io"
  },
  thinking: process.env.AIG_WORKSHOP_THINKING || "xhigh",
  agentTimeoutSeconds: Number(process.env.AIG_WORKSHOP_AGENT_TIMEOUT_SECONDS || "1200"),
  buildTimeoutMs: Number(process.env.AIG_WORKSHOP_BUILD_TIMEOUT_MS || "900000"),
  variants: [
    {
      id: "a",
      title: "A안",
      direction: "보수적으로 정돈한 버전",
      promptDirection: "Conservative refinement: closest to the current structure, but cleaner and more product-like."
    },
    {
      id: "b",
      title: "B안",
      direction: "업무툴 톤을 강화한 버전",
      promptDirection: "Workflow-first tool UI: denser, more operational, stronger IDE and productivity tone."
    }
  ]
};

const sudoBin = "/usr/bin/sudo";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDefaultState() {
  return {
    configured: true,
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
    variants: config.variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      direction: variant.direction,
      url: config.previewUrls[variant.id],
      status: "idle",
      summary: null,
      error: null,
      updatedAt: null
    }))
  };
}

async function ensureStateDir() {
  await fs.mkdir(stateDir, { recursive: true });
}

async function readState() {
  await ensureStateDir();

  if (!fsSync.existsSync(stateFile)) {
    return createDefaultState();
  }

  const raw = JSON.parse(await fs.readFile(stateFile, "utf8"));
  const base = createDefaultState();
  return {
    ...base,
    ...raw,
    variants: base.variants.map((variant) => ({
      ...variant,
      ...(raw.variants || []).find((candidate) => candidate.id === variant.id)
    }))
  };
}

async function writeState(state) {
  await ensureStateDir();
  const nextState = {
    ...state,
    updatedAt: new Date().toISOString()
  };
  await fs.writeFile(stateFile, JSON.stringify(nextState, null, 2), "utf8");
  return nextState;
}

async function updateState(mutator) {
  const current = await readState();
  const next = await mutator(clone(current));
  return writeState(next);
}

async function pulseState({ step, label, variantId }) {
  const timestamp = new Date().toISOString();

  await updateState((state) => {
    const next = clone(state);
    next.runningStep = step ?? next.runningStep;
    next.heartbeatAt = timestamp;
    next.heartbeatLabel = label ?? next.heartbeatLabel;

    if (variantId) {
      next.variants = next.variants.map((variant) =>
        variant.id === variantId
          ? {
              ...variant,
              updatedAt: timestamp
            }
          : variant
      );
    }

    return next;
  });
}

async function withHeartbeat({ step, label, variantId, intervalMs = 8000 }, task) {
  await pulseState({ step, label, variantId });

  const timer = setInterval(() => {
    void pulseState({ step, label, variantId }).catch(() => {});
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
      env: {
        ...process.env,
        ...(options.env || {})
      },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let timeoutId = null;

    if (options.timeoutMs) {
      timeoutId = setTimeout(() => {
        child.kill("SIGTERM");
        setTimeout(() => {
          child.kill("SIGKILL");
        }, 5000).unref();
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

function runAsOpenClaw(args, options = {}) {
  return runCommand(sudoBin, ["-u", config.openClawUser, ...args], options);
}

function runAsOpenClawInDir(workingDir, args, options = {}) {
  return runAsOpenClaw(
    [
      "bash",
      "-lc",
      'cd "$1" && shift && exec "$@"',
      "--",
      workingDir,
      ...args
    ],
    options
  );
}

async function getOpenClawUid() {
  const result = await runCommand("id", ["-u", config.openClawUser]);
  return result.stdout.trim();
}

async function ensureAgent(slot) {
  const agentId = `preview-${slot.id}`;
  const result = await runAsOpenClaw([config.openClawBin, "agents", "list", "--json"]);
  const agents = JSON.parse(result.stdout || "[]");

  if (agents.some((agent) => agent.id === agentId)) {
    return agentId;
  }

  await runAsOpenClaw([
    config.openClawBin,
    "agents",
    "add",
    agentId,
    "--workspace",
    path.join(config.variantRoot, slot.id),
    "--model",
    "openai-codex/gpt-5.4",
    "--non-interactive",
    "--json"
  ]);

  return agentId;
}

function createBrief(slot) {
  return [
    `대상 페이지 경로: ${targetPath}`,
    "",
    "기본 요청:",
    requestPrompt,
    "",
    `시안 방향: ${slot.direction}`,
    "",
    "제약 사항:",
    "- 한국어 문구를 유지합니다.",
    "- 기존 라우트와 목업 데이터 흐름은 유지합니다.",
    "- 요청한 페이지와 직접 연결된 컴포넌트 위주로 수정합니다.",
    "- 마케팅 랜딩 느낌보다 실제 제품 UI 느낌을 우선합니다.",
    "- Next.js production build가 통과해야 합니다."
  ].join("\n");
}

async function prepareVariant(slot) {
  const variantDir = path.join(config.variantRoot, slot.id);

  await runCommand(sudoBin, ["rm", "-rf", variantDir]);
  await runAsOpenClaw(["mkdir", "-p", variantDir]);
  await runCommand(sudoBin, [
    "rsync",
    "-a",
    "--delete",
    "--exclude",
    ".git",
    "--exclude",
    "node_modules",
    "--exclude",
    ".next",
    `${config.baseWorkspace}/`,
    `${variantDir}/`
  ]);
  await runAsOpenClaw(["ln", "-sfn", `${config.baseWorkspace}/node_modules`, `${variantDir}/node_modules`]);
  await runCommand(sudoBin, ["chown", "-R", `${config.openClawUser}:${config.openClawUser}`, variantDir]);
  await runAsOpenClaw(["tee", `${variantDir}/VARIANT_BRIEF.md`], {
    input: createBrief(slot)
  });

  return variantDir;
}

function extractSummary(payload) {
  const texts =
    payload?.result?.payloads
      ?.map((item) => item.text)
      .filter((text) => typeof text === "string" && text.trim().length > 0) || [];

  return texts.join("\n").trim() || "요약이 반환되지 않았습니다.";
}

async function writeLogFile(fileName, contents) {
  await ensureStateDir();
  await fs.writeFile(path.join(stateDir, fileName), contents, "utf8");
}

async function restartPreviewService(slot, uid) {
  if (!isLinux) {
    return;
  }

  await runAsOpenClaw([
    "env",
    `XDG_RUNTIME_DIR=/run/user/${uid}`,
    `DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/${uid}/bus`,
    "systemctl",
    "--user",
    "restart",
    `preview-${slot.id}.service`
  ]);
}

async function generateVariant(slot, uid) {
  await pulseState({
    step: `${slot.title} 워크스페이스를 준비하는 중입니다.`,
    label: "Preparing",
    variantId: slot.id
  });

  const variantDir = await prepareVariant(slot);
  const agentId = await ensureAgent(slot);

  await updateState((state) => {
    const next = clone(state);
    next.runningStep = `${slot.title}을 생성하는 중입니다.`;
    next.error = null;
    next.variants = next.variants.map((variant) =>
      variant.id === slot.id
        ? {
            ...variant,
            status: "running",
            error: null,
            summary: null,
            updatedAt: new Date().toISOString()
          }
        : variant
    );
    return next;
  });

  const agentMessage = [
    `You are preparing ${slot.title} for a Next.js frontend workspace.`,
    "Read VARIANT_BRIEF.md first, inspect the codebase, and focus on the requested route and the components it uses.",
    "Implement the variant completely in this workspace.",
    "Run the production build yourself and fix any issues until it passes.",
    "Keep the final response short: 2 to 4 lines summarizing the direction and the main changed areas."
  ].join(" ");

  const agentResult = await withHeartbeat(
    {
      step: `${slot.title} Thinking 중입니다. 요청을 해석하고 화면을 수정하고 있습니다.`,
      label: "Thinking",
      variantId: slot.id
    },
    () =>
      runAsOpenClawInDir(
        variantDir,
        [
          config.openClawBin,
          "agent",
          "--agent",
          agentId,
          "--session-id",
          `${jobId}-${slot.id}`,
          "--thinking",
          config.thinking,
          "--timeout",
          String(config.agentTimeoutSeconds),
          "--json",
          "-m",
          agentMessage
        ],
        {
          timeoutMs: (config.agentTimeoutSeconds + 120) * 1000
        }
      )
  );

  await writeLogFile(`${jobId}-${slot.id}.json`, agentResult.stdout);

  const buildResult = await withHeartbeat(
    {
      step: `${slot.title} 빌드를 검증하는 중입니다.`,
      label: "Build",
      variantId: slot.id
    },
    () =>
      runAsOpenClawInDir(
        variantDir,
        [
          "env",
          "NEXT_TELEMETRY_DISABLED=1",
          "/usr/bin/node",
          "./node_modules/next/dist/bin/next",
          "build"
        ],
        {
          timeoutMs: config.buildTimeoutMs
        }
      )
  );

  await writeLogFile(`${jobId}-${slot.id}-build.log`, buildResult.stdout || buildResult.stderr || "");

  await pulseState({
    step: `${slot.title} 프리뷰를 재시작하는 중입니다.`,
    label: "Preview",
    variantId: slot.id
  });
  await restartPreviewService(slot, uid);

  const summary = extractSummary(JSON.parse(agentResult.stdout));
  await writeLogFile(`${jobId}-${slot.id}-summary.txt`, summary);

  await updateState((state) => {
    const next = clone(state);
    next.variants = next.variants.map((variant) =>
      variant.id === slot.id
        ? {
            ...variant,
            status: "ready",
            summary,
            error: null,
            updatedAt: new Date().toISOString()
          }
        : variant
    );
    next.heartbeatAt = new Date().toISOString();
    next.heartbeatLabel = null;
    return next;
  });
}

async function failVariant(slot, error) {
  await updateState((state) => {
    const next = clone(state);
    next.variants = next.variants.map((variant) =>
      variant.id === slot.id
        ? {
            ...variant,
            status: "failed",
            error: error.message,
            updatedAt: new Date().toISOString()
          }
        : variant
    );
    next.heartbeatAt = new Date().toISOString();
    next.heartbeatLabel = null;
    next.error = error.message;
    return next;
  });
}

async function generate() {
  const uid = await getOpenClawUid();

  try {
    for (const slot of config.variants) {
      try {
        await generateVariant(slot, uid);
      } catch (error) {
        await failVariant(slot, error instanceof Error ? error : new Error("알 수 없는 오류가 발생했습니다."));
      }
    }

    await updateState((state) => {
      const next = clone(state);
      const hasReadyVariant = next.variants.some((variant) => variant.status === "ready");
      const hasFailedVariant = next.variants.some((variant) => variant.status === "failed");

      next.status = hasReadyVariant ? "ready" : "failed";
      next.currentPid = null;
      next.heartbeatAt = new Date().toISOString();
      next.heartbeatLabel = null;
      next.runningStep = hasReadyVariant
        ? hasFailedVariant
          ? "일부 시안은 실패했지만 확인 가능한 결과가 있습니다."
          : "A/B 시안 생성이 완료되었습니다."
        : "시안 생성에 실패했습니다.";

      if (!hasReadyVariant && !next.error) {
        next.error = "A/B 시안을 모두 생성하지 못했습니다.";
      }

      return next;
    });
  } catch (error) {
    await updateState((state) => {
      const next = clone(state);
      next.status = "failed";
      next.currentPid = null;
      next.heartbeatAt = new Date().toISOString();
      next.heartbeatLabel = null;
      next.runningStep = null;
      next.error = error instanceof Error ? error.message : "워크숍 작업이 실패했습니다.";
      return next;
    });
  }
}

async function main() {
  if (action !== "generate") {
    console.error(`Unsupported workshop action: ${action}`);
    process.exit(1);
  }

  await generate();
}

main().catch(async (error) => {
  await updateState((state) => {
    const next = clone(state);
    next.status = "failed";
    next.currentPid = null;
    next.heartbeatAt = new Date().toISOString();
    next.heartbeatLabel = null;
    next.runningStep = null;
    next.error = error instanceof Error ? error.message : "워크숍 작업이 실패했습니다.";
    return next;
  });
  process.exit(1);
});
