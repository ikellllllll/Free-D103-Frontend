"use client";

import {
  createAiEditSuggestion,
  createFeedbackReport,
  createInitialSession,
  createRunResult,
  createStarterFiles,
  createSubmission,
  createTestResults,
  defaultUser,
  derivePassCountFromFiles,
  getProblemById,
  mypageStats,
  problems
} from "@/lib/mock-data";
import type { AiEditSuggestion, AiMessage, TraceEvent } from "@/lib/types/ai";
import type { AuthUser, LoginInput, SignupInput } from "@/lib/types/auth";
import type { ProblemDetail, ProblemSummary } from "@/lib/types/problem";
import type { FeedbackReport } from "@/lib/types/report";
import type { RunResult, SolveSession, Submission, TestRunResult } from "@/lib/types/session";

interface MockDb {
  users: AuthUser[];
  auth: { currentUserId: string | null };
  problems: ProblemDetail[];
  sessions: SolveSession[];
  submissions: Submission[];
  reports: FeedbackReport[];
}

const STORAGE_KEY = "aig-mock-db-v1";
const delay = (ms = 300) => new Promise((resolve) => window.setTimeout(resolve, ms));
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const getStorage = () => {
  if (typeof window === "undefined") {
    throw new Error("mock api is client-only");
  }
  return window.localStorage;
};

const createSeedDb = (): MockDb => ({
  users: [defaultUser],
  auth: { currentUserId: defaultUser.id },
  problems,
  sessions: [],
  submissions: [],
  reports: []
});

const formatClock = (value: Date) =>
  value.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });

const normalizeWorkspaceFiles = (files: SolveSession["files"]) => {
  const harnessFile = createStarterFiles().find((file) => file.path === "agent/HARNESS.md");
  const seen = new Set<string>();
  const normalized = files
    .map((file) => {
      const nextPath = file.path
        .replace(/^src\/main\/java\//, "src/")
        .replace(/^src\/test\/java\//, "src/");

      return {
        ...file,
        path: nextPath
      };
    })
    .filter((file) => {
      if (seen.has(file.path)) {
        return false;
      }
      seen.add(file.path);
      return true;
    });

  if (harnessFile && !seen.has(harnessFile.path)) {
    normalized.push(clone(harnessFile));
  }

  return normalized;
};

const appendTrace = (session: SolveSession, type: TraceEvent["type"], summary: string, detail?: string) => {
  session.traces = [
    ...session.traces,
    {
      id: uid("trace"),
      time: formatClock(new Date()),
      type,
      summary,
      detail
    }
  ];
};

const refreshDb = (db: MockDb) => {
  const now = Date.now();

  db.sessions = db.sessions.map((session) =>
    ({
      ...session,
      status: session.status === "CREATING" && session.readyAt <= now ? "IN_PROGRESS" : session.status,
      files: normalizeWorkspaceFiles(session.files)
    })
  );

  db.submissions = db.submissions.map((submission) =>
    submission.status === "PROCESSING" && submission.readyAt <= now ? { ...submission, status: "COMPLETED" } : submission
  );

  db.reports = db.reports.map((report) => {
    const submission = db.submissions.find((item) => item.id === report.submissionId);
    if (!submission || report.status === "COMPLETED" || submission.status !== "COMPLETED") {
      return report;
    }

    const session = db.sessions.find((item) => item.id === submission.sessionId);
    if (!session) {
      return report;
    }

    return createFeedbackReport(submission.id, clone(session.traces));
  });

  return db;
};

const readDb = (): MockDb => {
  const storage = getStorage();
  const raw = storage.getItem(STORAGE_KEY);

  if (!raw) {
    const seeded = createSeedDb();
    storage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  const parsed = JSON.parse(raw) as MockDb;
  const refreshed = refreshDb(parsed);
  storage.setItem(STORAGE_KEY, JSON.stringify(refreshed));
  return refreshed;
};

const writeDb = (db: MockDb) => {
  getStorage().setItem(STORAGE_KEY, JSON.stringify(db));
};

const getSessionOrThrow = (db: MockDb, sessionId: string) => {
  const session = db.sessions.find((item) => item.id === sessionId);
  if (!session) {
    throw new Error("세션을 찾을 수 없습니다.");
  }
  return session;
};

const buildAiReply = (message: string, currentFile?: string) => {
  if (/npe|optional|get\(\)/i.test(message)) {
    return `${
      currentFile ?? "현재 파일"
    }에서 Optional.get()을 바로 호출하고 있어 값이 없을 때 예외가 발생합니다. orElseThrow()로 바꾸고 404 응답 설계를 함께 정리해보세요.`;
  }

  if (/404|not found|없는 id/i.test(message)) {
    return "없는 ID 케이스는 서비스 계층에서 명시적인 예외를 던지고, 컨트롤러 또는 전역 예외 처리기에서 404로 변환하는 구조가 가장 깔끔합니다.";
  }

  if (/jwt|token/i.test(message)) {
    return "JWT 과제는 토큰 발급, 검증 필터, 만료 응답, 재발급 메서드를 분리해 점검하는 편이 좋습니다.";
  }

  return "질문을 조금 더 구체적으로 적으면 피드백 밀도가 올라갑니다. 에러 메시지, 테스트 결과, 관련 파일을 함께 주면 더 정확하게 도와줄 수 있습니다.";
};

export const mockApi = {
  async hydrateUser(userId: string | null) {
    await delay(100);
    const db = readDb();
    return db.users.find((user) => user.id === userId) ?? null;
  },

  async login(input: LoginInput) {
    await delay(300);
    const db = readDb();
    let user = db.users.find((item) => item.email === input.email);

    if (!user) {
      user = {
        id: uid("user"),
        name: input.email.split("@")[0] || "사용자",
        email: input.email,
        provider: "LOCAL",
        createdAt: new Date().toISOString()
      };
      db.users.push(user);
    }

    db.auth.currentUserId = user.id;
    writeDb(db);
    return clone(user);
  },

  async signup(input: SignupInput) {
    await delay(350);
    const db = readDb();
    if (db.users.some((user) => user.email === input.email)) {
      throw new Error("이미 가입된 이메일입니다.");
    }

    const user: AuthUser = {
      id: uid("user"),
      name: input.name,
      email: input.email,
      provider: "LOCAL",
      createdAt: new Date().toISOString()
    };

    db.users.push(user);
    db.auth.currentUserId = user.id;
    writeDb(db);
    return clone(user);
  },

  async logout() {
    await delay(100);
    const db = readDb();
    db.auth.currentUserId = null;
    writeDb(db);
  },

  async getProblems(): Promise<ProblemSummary[]> {
    await delay(200);
    return clone(readDb().problems);
  },

  async getProblemDetail(id: string) {
    await delay(180);
    const problem = readDb().problems.find((item) => item.id === id);
    if (!problem) {
      throw new Error("과제를 찾을 수 없습니다.");
    }
    return clone(problem);
  },

  async createSession(problemId: string, userId: string) {
    await delay(320);
    const db = readDb();
    if (!getProblemById(problemId)) {
      throw new Error("유효하지 않은 과제입니다.");
    }

    const existing = db.sessions.find(
      (session) => session.problemId === problemId && session.userId === userId && session.status !== "SUBMITTED"
    );

    if (existing) {
      return clone(existing);
    }

    const session = createInitialSession(uid("session"), userId, problemId);
    db.sessions.push(session);
    writeDb(db);
    return clone(session);
  },

  async getSession(sessionId: string) {
    await delay(160);
    return clone(getSessionOrThrow(readDb(), sessionId));
  },

  async getWorkspace(sessionId: string) {
    await delay(160);
    const session = getSessionOrThrow(readDb(), sessionId);
    return { workspaceId: session.workspaceId, files: clone(session.files) };
  },

  async saveFile(sessionId: string, path: string, content: string) {
    await delay(180);
    const db = readDb();
    const session = getSessionOrThrow(db, sessionId);
    session.files = session.files.map((file) => (file.path === path ? { ...file, content } : file));
    session.lastSavedAt = new Date().toISOString();
    writeDb(db);
    return clone(session);
  },

  async runCode(sessionId: string): Promise<RunResult> {
    await delay(620);
    const db = readDb();
    const session = getSessionOrThrow(db, sessionId);
    appendTrace(session, "실행", "애플리케이션 실행", "bootRun 기준 목업 실행");
    writeDb(db);
    return createRunResult();
  },

  async runTests(sessionId: string): Promise<TestRunResult> {
    await delay(760);
    const db = readDb();
    const session = getSessionOrThrow(db, sessionId);
    const result = createTestResults(derivePassCountFromFiles(session.files));
    appendTrace(session, "테스트", `${result.passed} / ${result.total} 통과`, "공개 테스트 기준");
    writeDb(db);
    return result;
  },

  async getChatMessages(sessionId: string) {
    await delay(120);
    return clone(getSessionOrThrow(readDb(), sessionId).messages);
  },

  async requestAiChat(sessionId: string, message: string, currentFile?: string) {
    await delay(220);
    const db = readDb();
    const session = getSessionOrThrow(db, sessionId);
    const userMessage: AiMessage = {
      id: uid("msg"),
      role: "user",
      content: message,
      createdAt: new Date().toISOString()
    };
    const assistantMessage: AiMessage = {
      id: uid("msg"),
      role: "assistant",
      content: buildAiReply(message, currentFile),
      createdAt: new Date().toISOString()
    };

    session.aiRequestCount += 1;
    session.messages = [...session.messages, userMessage, assistantMessage];
    appendTrace(session, "AI 요청", message, currentFile ? `현재 파일: ${currentFile}` : undefined);
    appendTrace(session, "AI 응답", assistantMessage.content.slice(0, 56), `${assistantMessage.content.length} chars`);
    writeDb(db);

    return { assistantMessage: clone(assistantMessage), requestCount: session.aiRequestCount };
  },

  async requestAiEdit(sessionId: string, selectedCode: string, instruction: string): Promise<AiEditSuggestion> {
    await delay(260);
    const db = readDb();
    const session = getSessionOrThrow(db, sessionId);
    session.aiRequestCount += 1;
    appendTrace(session, "AI 요청", `Edit: ${instruction}`, "선택 영역 기반 수정 제안");
    writeDb(db);

    if (selectedCode.includes(".get()")) {
      return createAiEditSuggestion(selectedCode);
    }

    return {
      original: selectedCode,
      replacement: `${selectedCode}\n// TODO: AI 제안이 여기에 들어갑니다.`,
      summary: "선택한 코드를 기준으로 보수적인 TODO 수정안을 제안합니다."
    };
  },

  async applyAiEdit(sessionId: string, path: string, nextContent: string, summary: string) {
    await delay(150);
    const db = readDb();
    const session = getSessionOrThrow(db, sessionId);
    session.files = session.files.map((file) => (file.path === path ? { ...file, content: nextContent } : file));
    session.lastSavedAt = new Date().toISOString();
    appendTrace(session, "코드 수정", `${path.split("/").pop()} 반영`, summary);
    writeDb(db);
    return clone(session);
  },

  async submitSession(sessionId: string) {
    await delay(320);
    const db = readDb();
    const session = getSessionOrThrow(db, sessionId);
    const existing = db.submissions.find((submission) => submission.sessionId === sessionId);
    if (existing) {
      return clone(existing);
    }

    session.status = "SUBMITTED";
    appendTrace(session, "제출", "최종 제출 완료", "피드백 리포트 생성 시작");

    const submission = createSubmission(uid("submission"), sessionId);
    db.submissions.push(submission);
    db.reports.push({
      id: `report-${submission.id}`,
      submissionId: submission.id,
      status: "GENERATING",
      generatedAt: null,
      testPassRate: 0,
      testSummary: "생성 중",
      scores: [],
      strengths: [],
      improvements: [],
      summary: "",
      timeline: []
    });
    writeDb(db);
    return clone(submission);
  },

  async getSubmission(submissionId: string) {
    await delay(150);
    const submission = readDb().submissions.find((item) => item.id === submissionId);
    if (!submission) {
      throw new Error("제출 정보를 찾을 수 없습니다.");
    }
    return clone(submission);
  },

  async getReport(submissionId: string) {
    await delay(180);
    const report = readDb().reports.find((item) => item.submissionId === submissionId);
    if (!report) {
      throw new Error("리포트를 찾을 수 없습니다.");
    }
    return clone(report);
  },

  async getTimeline(submissionId: string) {
    await delay(150);
    const report = await this.getReport(submissionId);
    return clone(report.timeline);
  },

  async getMyDashboard(userId: string) {
    await delay(220);
    const db = readDb();
    const history = db.submissions
      .map((submission) => {
        const session = db.sessions.find((item) => item.id === submission.sessionId);
        const problem = getProblemById(session?.problemId ?? "");
        const report = db.reports.find((item) => item.submissionId === submission.id);
        return problem
          ? {
              id: submission.id,
              title: problem.title,
              date: new Date(submission.submittedAt).toLocaleDateString("ko-KR"),
              passRate: report?.status === "COMPLETED" ? report.testSummary : "-",
              aiUsage:
                report?.status === "COMPLETED" && report.scores[0]?.score >= 70
                  ? "좋음"
                  : report?.status === "COMPLETED"
                    ? "보통"
                    : "-",
              href: report?.status === "COMPLETED" ? `/submissions/${submission.id}/report` : `/submissions/${submission.id}`
            }
          : null;
      })
      .filter(Boolean);

    return {
      stats: mypageStats,
      history,
      user: db.users.find((user) => user.id === userId) ?? defaultUser
    };
  }
};
