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
  problems
} from "@/lib/mock-data";
import type { AiEditSuggestion, AiMessage, TraceEvent } from "@/lib/types/ai";
import type { AuthUser, LoginInput, SignupInput } from "@/lib/types/auth";
import type { ProblemDetail, ProblemSummary } from "@/lib/types/problem";
import type { FeedbackReport } from "@/lib/types/report";
import type { ProblemLanguage, RunResult, SessionListItem, SolveSession, Submission, TestRunResult, WorkspaceFile } from "@/lib/types/session";

interface MockDb {
  users: AuthUser[];
  auth: { currentUserId: string | null };
  problems: ProblemDetail[];
  sessions: SolveSession[];
  submissions: Submission[];
  reports: FeedbackReport[];
}

const STORAGE_KEY = "aig-mock-db-v2";
const delay = (ms = 300) => new Promise((resolve) => window.setTimeout(resolve, ms));
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const getStorage = () => {
  if (typeof window === "undefined") {
    throw new Error("mock api is client-only");
  }
  return window.localStorage;
};

const createSeedDb = (): MockDb => {
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

  const s1Id = "session-seed-01";
  const s2Id = "session-seed-02";
  const sub1Id = "submission-seed-01";

  const session1: SolveSession = {
    id: s1Id,
    workspaceId: `ws-${s1Id}`,
    problemId: "todo-api",
    userId: defaultUser.id,
    language: "java",
    status: "SUBMITTED",
    aiRequestCount: 8,
    lastSavedAt: daysAgo(7),
    createdAt: daysAgo(8),
    readyAt: 0,
    files: createStarterFiles("java"),
    messages: [],
    traces: [],
    aiModel: "aig-default",
    aiProvider: "default"
  };

  const session2: SolveSession = {
    id: s2Id,
    workspaceId: `ws-${s2Id}`,
    problemId: "jwt-auth",
    userId: defaultUser.id,
    language: "python",
    status: "IN_PROGRESS",
    aiRequestCount: 3,
    lastSavedAt: daysAgo(2),
    createdAt: daysAgo(3),
    readyAt: 0,
    files: createStarterFiles("python"),
    messages: [],
    traces: [],
    aiModel: "aig-default",
    aiProvider: "default"
  };

  const submission1: Submission = {
    id: sub1Id,
    sessionId: s1Id,
    status: "COMPLETED",
    submittedAt: daysAgo(7),
    readyAt: 0
  };

  const report1 = createFeedbackReport(sub1Id, []);

  return {
    users: [defaultUser],
    auth: { currentUserId: defaultUser.id },
    problems,
    sessions: [session1, session2],
    submissions: [submission1],
    reports: [report1]
  };
};

const formatClock = (value: Date) =>
  value.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });

const worktreePathFor = (path: string) => path.replace(/^src\//, ".worktree/");

const replaceSelectionInContent = (content: string, selectedCode: string, replacement: string) => {
  if (!selectedCode) {
    return content;
  }

  const firstMatchIndex = content.indexOf(selectedCode);

  if (firstMatchIndex < 0) {
    return content;
  }

  return `${content.slice(0, firstMatchIndex)}${replacement}${content.slice(firstMatchIndex + selectedCode.length)}`;
};

const normalizeWorkspaceFiles = (files: SolveSession["files"]) => {
  const starterFiles = createStarterFiles();
  const harnessFile = starterFiles.find((file) => file.path === "agent/HARNESS.md");
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

  // ⚠️ 백엔드 세션에서 가짜 worktree 파일이 inject 되는 버그 방지.
  // mock 세션은 createStarterFiles 가 이미 worktree 포함 — 여기서 추가 inject 안 함.
  // 백엔드 세션은 backend payload.worktree 만 반영 (sessionApi.toWorkspaceFiles 에서 처리).

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

  async createSession(problemId: string, userId: string, language: ProblemLanguage = "java", aiModel = "aig-default", aiProvider = "default") {
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

    const session = { ...createInitialSession(uid("session"), userId, problemId, language), aiModel, aiProvider };
    db.sessions.push(session);
    writeDb(db);
    return clone(session);
  },

  async registerExternalSession(session: SolveSession) {
    const db = readDb();
    const nextSession = {
      ...session,
      files: normalizeWorkspaceFiles(session.files)
    };
    const index = db.sessions.findIndex((item) => item.id === session.id);

    if (index >= 0) {
      db.sessions[index] = nextSession;
    } else {
      db.sessions.push(nextSession);
    }

    writeDb(db);
    return clone(nextSession);
  },

  async getSession(sessionId: string) {
    await delay(160);
    return clone(getSessionOrThrow(readDb(), sessionId));
  },

  async switchLanguage(sessionId: string, language: ProblemLanguage) {
    await delay(200);
    const db = readDb();
    const session = getSessionOrThrow(db, sessionId);
    session.language = language;
    session.files = createStarterFiles(language);
    appendTrace(session, "실행", `언어 전환: ${language === "java" ? "Java" : "Python"}`, "스타터 파일 초기화");
    writeDb(db);
    return clone(session);
  },

  async getWorkspace(sessionId: string) {
    await delay(160);
    const session = getSessionOrThrow(readDb(), sessionId);
    return { workspaceId: session.workspaceId, files: clone(session.files) };
  },

  async syncExternalWorkspace(sessionId: string, files: WorkspaceFile[]) {
    const db = readDb();
    const session = getSessionOrThrow(db, sessionId);
    session.files = normalizeWorkspaceFiles(files);
    session.lastSavedAt = new Date().toISOString();
    writeDb(db);
    return { workspaceId: session.workspaceId, files: clone(session.files) };
  },

  async syncExternalFileContent(sessionId: string, path: string, content: string, language?: string) {
    const db = readDb();
    const session = getSessionOrThrow(db, sessionId);
    const hasTarget = session.files.some((file) => file.path === path);

    session.files = hasTarget
      ? session.files.map((file) =>
          file.path === path
            ? {
                ...file,
                content,
                language: language ?? file.language
              }
            : file
        )
      : normalizeWorkspaceFiles([
          ...session.files,
          {
            path,
            content,
            language: language ?? "plaintext"
          }
        ]);

    session.lastSavedAt = new Date().toISOString();
    writeDb(db);
    return clone(session.files.find((file) => file.path === path) ?? null);
  },

  async syncExternalTraces(sessionId: string, traces: TraceEvent[]) {
    const db = readDb();
    const session = getSessionOrThrow(db, sessionId);
    session.traces = clone(traces);
    writeDb(db);
    return clone(session.traces);
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
    const lang = session.language ?? "java";
    appendTrace(session, "실행", "애플리케이션 실행", lang === "python" ? "uvicorn 기준 목업 실행" : "bootRun 기준 목업 실행");
    writeDb(db);
    return createRunResult(lang);
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
    const stored = clone(getSessionOrThrow(readDb(), sessionId).messages);
    const hasRealConversation = stored.some((m) => !m.id.startsWith("msg-seed-") && !m.id.startsWith("optimistic-"));
    if (hasRealConversation) return stored;

    // Notion API 명세 예시 기반 mock 대화 데이터
    const base = new Date(Date.now() - 18 * 60000).toISOString();
    const t = (offsetMin: number) => new Date(new Date(base).getTime() + offsetMin * 60000).toISOString();

    return [
      {
        id: "mock-msg-1",
        role: "user" as const,
        content: "GET /users API를 구현하려고 하는데 어디서부터 시작해야 하나요?",
        createdAt: t(0)
      },
      {
        id: "mock-msg-2",
        role: "assistant" as const,
        content: `Controller → Service → Repository 순서로 구현하는 게 좋습니다.\n\n1. **Repository**: \`findAllByOrderByNameAsc()\` 메서드를 선언하면 Spring Data JPA가 자동으로 name 오름차순 쿼리를 생성합니다.\n2. **Service**: Repository를 주입받아 조회 결과를 \`List<UserResponse>\`로 변환합니다.\n3. **Controller**: \`@GetMapping("/users")\`에서 Service를 호출하고 200 OK로 반환합니다.`,
        createdAt: t(1)
      },
      {
        id: "mock-msg-3",
        role: "user" as const,
        content: "UserRepository에 메서드를 어떻게 선언해야 해요?",
        createdAt: t(3)
      },
      {
        id: "mock-msg-4",
        role: "assistant" as const,
        content: "Spring Data JPA의 메서드 이름 규칙을 사용하면 됩니다:\n\n```java\npublic interface UserRepository extends JpaRepository<User, Long> {\n    List<User> findAllByOrderByNameAsc();\n}\n```\n\n`findAllByOrderByNameAsc`는 **전체 조회 후 name 오름차순 정렬**을 의미합니다. 별도 `@Query` 없이 JPA가 자동으로 처리합니다.",
        createdAt: t(4)
      },
      {
        id: "mock-msg-5",
        role: "user" as const,
        content: "Service에서 User 엔티티를 UserResponse DTO로 변환하는 방법도 알려주세요.",
        createdAt: t(7)
      },
      {
        id: "mock-msg-6",
        role: "assistant" as const,
        content: `UserResponse에 정적 팩토리 메서드를 추가하는 방식이 깔끔합니다:\n\n\`\`\`java\n// UserResponse.java\npublic record UserResponse(Long id, String name, String email) {\n    public static UserResponse from(User user) {\n        return new UserResponse(user.getId(), user.getName(), user.getEmail());\n    }\n}\n\n// UserService.java\npublic List<UserResponse> findAll() {\n    return userRepository.findAllByOrderByNameAsc()\n            .stream()\n            .map(UserResponse::from)\n            .toList();\n}\n\`\`\`\n\n회원이 없으면 빈 리스트가 반환되므로 별도 처리 없이 요구사항을 충족합니다.`,
        createdAt: t(8)
      }
    ] satisfies Array<{ id: string; role: "user" | "assistant"; content: string; createdAt: string }>;
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

  async requestAiEdit(sessionId: string, path: string, sourceContent: string, selectedCode: string, instruction: string): Promise<AiEditSuggestion> {
    await delay(260);
    const db = readDb();
    const session = getSessionOrThrow(db, sessionId);
    session.aiRequestCount += 1;
    appendTrace(session, "AI 요청", `Edit: ${instruction}`, "선택 영역 기반 수정 제안");

    const suggestion =
      selectedCode.includes(".get()")
        ? createAiEditSuggestion(selectedCode)
        : {
      original: selectedCode,
      replacement: `${selectedCode}\n// TODO: AI 제안이 여기에 들어갑니다.`,
      summary: "선택한 코드를 기준으로 보수적인 TODO 수정안을 제안합니다."
          };
    const targetPath = worktreePathFor(path);
    const nextWorktreeContent = replaceSelectionInContent(sourceContent, suggestion.original, suggestion.replacement);

    session.files = session.files.map((file) =>
      file.path === targetPath
        ? {
            ...file,
            content: nextWorktreeContent
          }
        : file
    );

    writeDb(db);
    return suggestion;
  },

  async applyAiEdit(sessionId: string, path: string, nextContent: string, summary: string) {
    await delay(150);
    const db = readDb();
    const session = getSessionOrThrow(db, sessionId);
    const worktreePath = worktreePathFor(path);
    session.files = session.files.map((file) =>
      file.path === path || file.path === worktreePath ? { ...file, content: nextContent } : file
    );
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

  async getSessions(userId: string): Promise<SessionListItem[]> {
    await delay(200);
    const db = readDb();
    const userSessions = db.sessions
      .filter((s) => s.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return userSessions
      .map((session): SessionListItem | null => {
        const problem = getProblemById(session.problemId);
        if (!problem) return null;

        const submission = session.status === "SUBMITTED"
          ? db.submissions.find((s) => s.sessionId === session.id) ?? null
          : null;
        const report = submission
          ? db.reports.find((r) => r.submissionId === submission.id) ?? null
          : null;

        return {
          sessionId: session.id,
          problemId: session.problemId,
          problemTitle: problem.title,
          problemLevel: problem.level,
          problemCategory: problem.category,
          difficulty: problem.level === 1 ? "쉬움" : problem.level === 2 ? "보통" : "어려움",
          language: session.language ?? "java",
          status: session.status,
          startedAt: session.createdAt,
          endedAt: submission?.submittedAt ?? null,
          aiRequestCount: session.aiRequestCount,
          submissionId: submission?.id ?? null,
          passRate: report?.status === "COMPLETED" ? report.testSummary : null,
          score: report?.status === "COMPLETED" ? report.testPassRate : null
        };
      })
      .filter((item): item is SessionListItem => item !== null);
  },

  async getMyDashboard(userId: string) {
    await delay(220);
    const db = readDb();

    // 동적 stats 계산
    const userSessions = db.sessions.filter((s) => s.userId === userId);
    const completedSessions = userSessions.filter((s) => s.status === "SUBMITTED");
    const activeSessions = userSessions.filter((s) => s.status === "IN_PROGRESS");
    const totalAiRequests = userSessions.reduce((sum, s) => sum + s.aiRequestCount, 0);

    const lastCompletedProblem = completedSessions.length > 0
      ? getProblemById(completedSessions[completedSessions.length - 1].problemId)
      : null;

    const stats = [
      {
        label: "완료한 과제",
        value: String(completedSessions.length),
        note: lastCompletedProblem ? lastCompletedProblem.title : "아직 없어요"
      },
      {
        label: "진행 중 세션",
        value: String(activeSessions.length),
        note: activeSessions.length > 0 ? "이어서 풀어보세요" : "새 과제를 시작해보세요"
      },
      {
        label: "누적 AI 요청",
        value: String(totalAiRequests),
        note: "전체 세션 기준"
      }
    ];

    // 이어할 수 있는 세션 목록
    const resumableSessions = activeSessions
      .map((s) => {
        const problem = getProblemById(s.problemId);
        return problem
          ? {
              sessionId: s.id,
              title: problem.title,
              level: problem.level,
              category: problem.category,
              aiRequestCount: s.aiRequestCount,
              lastSavedAt: s.lastSavedAt,
              href: `/ide/${s.id}`
            }
          : null;
      })
      .filter(Boolean);

    // 완료된 리포트에서 역량 점수 평균 계산
    const completedReports = db.reports.filter((r) => r.status === "COMPLETED");
    const avgScores = (() => {
      if (completedReports.length === 0) return [];
      const totals: Record<string, { sum: number; count: number; tone: "good" | "mid" | "warn" }> = {};
      completedReports.forEach((r) => {
        r.scores.forEach((s) => {
          if (!totals[s.label]) totals[s.label] = { sum: 0, count: 0, tone: s.tone };
          totals[s.label].sum += s.score;
          totals[s.label].count += 1;
          // tone은 최신 리포트 기준
          totals[s.label].tone = s.tone;
        });
      });
      return Object.entries(totals).map(([label, { sum, count, tone }]) => ({
        label,
        score: Math.round(sum / count),
        tone
      }));
    })();

    // 난이도별 완료 현황
    const levelBreakdown = ([1, 2, 3] as const).map((level) => {
      const levelProblems = problems.filter((p) => p.level === level);
      const completedCount = levelProblems.filter((p) =>
        completedSessions.some((s) => s.problemId === p.id)
      ).length;
      return { level, total: levelProblems.length, completed: completedCount };
    });

    // 제출 이력
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
      stats,
      resumableSessions,
      avgScores,
      levelBreakdown,
      history,
      user: db.users.find((user) => user.id === userId) ?? defaultUser
    };
  },

  async getAgentTraces(sessionId: string) {
    await delay(150);
    const now = new Date();
    const minsAgo = (m: number) => new Date(now.getTime() - m * 60000).toISOString();

    // 완료된 run
    const run1 = {
      agentTraceId: `trace-${sessionId}-1`,
      status: "COMPLETED" as const,
      startedAt: minsAgo(45),
      endedAt: minsAgo(42),
      durationMs: 182000,
      outcome: "success",
      totalInputTokens: 9840,
      totalOutputTokens: 2610,
      totalCostCredits: 124,
      summaryText: "UserResponse에 active 필드를 추가하고 JSON 응답 키를 isActive로 맞추도록 정리했습니다.",
      errorMessage: null,
      spans: [
        {
          spanId: "span-1-1",
          parentSpanId: null,
          spanName: "plan",
          sequenceNo: 1,
          status: "COMPLETED" as const,
          startedAt: minsAgo(45),
          endedAt: minsAgo(44),
          durationMs: 3200,
          toolCalls: [
            { toolCallId: "tc-1", toolName: "read_file", argsJson: { path: "starter/src/main/java/com/example/starter/dto/UserResponse.java" }, durationMs: 120, status: "COMPLETED" as const }
          ],
          llmCalls: [
              { llmCallId: "llm-1", vendor: "CLAUDE" as const, modelName: "CLAUDE_4_5_SONNET", inputTokens: 3200, outputTokens: 480, latencyMs: 1840, finishReason: "end_turn", status: "COMPLETED" as const }
          ],
          patches: [],
          inputJson: { task: "Analyze UserResponse DTO and extend it for active status response", files: ["starter/src/main/java/com/example/starter/dto/UserResponse.java"], goal: "Expose active state as isActive in the response payload" },
          outputJson: { plan: ["1. Inject UserService into UserController", "2. Delegate user loading to UserService", "3. Sort UserResponse by name before returning"], estimatedChanges: 2, confidence: 0.95 }
        },
        {
          spanId: "span-1-2",
          parentSpanId: null,
          spanName: "code_edit",
          sequenceNo: 2,
          status: "COMPLETED" as const,
          startedAt: minsAgo(44),
          endedAt: minsAgo(43),
          durationMs: 6700,
          toolCalls: [
            { toolCallId: "tc-3", toolName: "write_file", argsJson: { path: "starter/src/main/java/com/example/starter/dto/UserResponse.java" }, durationMs: 88, status: "COMPLETED" as const },
            { toolCallId: "tc-4", toolName: "bash", argsJson: { cmd: "./gradlew compileJava" }, durationMs: 3200, status: "COMPLETED" as const }
          ],
          llmCalls: [
              { llmCallId: "llm-2", vendor: "CLAUDE" as const, modelName: "CLAUDE_4_5_SONNET", inputTokens: 4800, outputTokens: 1640, latencyMs: 2100, finishReason: "end_turn", status: "COMPLETED" as const }
          ],
          patches: [
            { patchId: "patch-1", filePath: "starter/src/main/java/com/example/starter/dto/UserResponse.java", additions: 6, deletions: 1 },
            { patchId: "patch-2", filePath: "starter/src/main/java/com/example/starter/controller/UserController.java", additions: 9, deletions: 3 },
            { patchId: "patch-3", filePath: "starter/src/main/java/com/example/starter/service/UserService.java", additions: 12, deletions: 1 },
            { patchId: "patch-4", filePath: "starter/src/main/java/com/example/starter/entity/User.java", additions: 4, deletions: 0 },
            { patchId: "patch-5", filePath: "starter/src/main/java/com/example/starter/repository/UserRepository.java", additions: 5, deletions: 0 }
          ],
          inputJson: { plan: ["Add active field to UserResponse", "Expose the field as isActive with JsonProperty"], currentContent: "public record UserResponse (Long id, String name, String email) {\n}" },
          outputJson: { status: "success", filesModified: ["starter/src/main/java/com/example/starter/dto/UserResponse.java"], compilationResult: "BUILD SUCCESS", patchSummary: "+6 -1 lines" }
        },
        {
          spanId: "span-1-3",
          parentSpanId: null,
          spanName: "verify",
          sequenceNo: 3,
          status: "COMPLETED" as const,
          startedAt: minsAgo(43),
          endedAt: minsAgo(42),
          durationMs: 4100,
          toolCalls: [
            { toolCallId: "tc-5", toolName: "bash", argsJson: { cmd: "./gradlew test" }, durationMs: 3800, status: "COMPLETED" as const }
          ],
          llmCalls: [],
          patches: [],
          inputJson: { command: "./gradlew test", scope: "full test suite" },
          outputJson: { exitCode: 0, testsRun: 12, passed: 12, failed: 0, duration: "3.8s", summary: "BUILD SUCCESS" }
        }
      ]
    };

    // 실패한 run
    const run2 = {
      agentTraceId: `trace-${sessionId}-2`,
      status: "FAILED" as const,
      startedAt: minsAgo(60),
      endedAt: minsAgo(58),
      durationMs: 74000,
      outcome: null,
      totalInputTokens: 3120,
      totalOutputTokens: 620,
      totalCostCredits: 38,
      summaryText: null,
      errorMessage: "컴파일 오류: cannot find symbol — UserService",
      spans: [
        {
          spanId: "span-2-1",
          parentSpanId: null,
          spanName: "plan",
          sequenceNo: 1,
          status: "COMPLETED" as const,
          startedAt: minsAgo(60),
          endedAt: minsAgo(59),
          durationMs: 2800,
          toolCalls: [
            { toolCallId: "tc-6", toolName: "read_file", argsJson: { path: "starter/src/main/java/com/example/starter/dto/UserResponse.java" }, durationMs: 110, status: "COMPLETED" as const }
          ],
          llmCalls: [
              { llmCallId: "llm-3", vendor: "CLAUDE" as const, modelName: "CLAUDE_4_5_SONNET", inputTokens: 3120, outputTokens: 620, latencyMs: 1600, finishReason: "end_turn", status: "COMPLETED" as const }
          ],
          patches: [],
          inputJson: { task: "Analyze UserResponse DTO and add an active field", files: ["starter/src/main/java/com/example/starter/dto/UserResponse.java"], goal: "Return active state using a record field" },
          outputJson: { plan: ["Add active field", "Annotate the field with JsonProperty"], estimatedChanges: 1, confidence: 0.88 }
        },
        {
          spanId: "span-2-2",
          parentSpanId: null,
          spanName: "code_edit",
          sequenceNo: 2,
          status: "FAILED" as const,
          startedAt: minsAgo(59),
          endedAt: minsAgo(58),
          durationMs: 4200,
          toolCalls: [
            { toolCallId: "tc-7", toolName: "write_file", argsJson: { path: "starter/src/main/java/com/example/starter/dto/UserResponse.java" }, durationMs: 92, status: "COMPLETED" as const },
            { toolCallId: "tc-8", toolName: "bash", argsJson: { cmd: "./gradlew compileJava" }, durationMs: 3800, status: "FAILED" as const }
          ],
          llmCalls: [],
          patches: [],
          inputJson: { plan: ["Add active field to UserResponse"], currentContent: "public record UserResponse (Long id, String name, String email) {\n}" },
          outputJson: { status: "FAILED", error: "cannot find symbol — JsonProperty", exitCode: 1, buildOutput: "UserResponse.java:3: error: package com.fasterxml.jackson.annotation does not exist\nimport com.fasterxml.jackson.annotation.JsonProperty;\n                                       ^" }
        }
      ]
    };

    return [run1, run2];
  }
};
