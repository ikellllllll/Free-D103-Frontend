import type { AiEditSuggestion, AiMessage, TraceEvent } from "@/lib/types/ai";
import type { AuthUser } from "@/lib/types/auth";
import type { ProblemDetail } from "@/lib/types/problem";
import type { FeedbackReport, ScoreItem } from "@/lib/types/report";
import type {
  ProblemLanguage,
  RunResult,
  SolveSession,
  Submission,
  TestCaseResult,
  TestRunResult,
  WorkspaceFile
} from "@/lib/types/session";

export const problems: ProblemDetail[] = [
  {
    id: "todo-api",
    order: "01",
    title: "Todo API 구현",
    level: 1,
    category: "API 구현",
    passRate: 78,
    status: "완료",
    summary: "간단한 Todo CRUD API를 설계하고 예외 처리를 포함해 구현합니다.",
    estimate: "60분",
    description: `# Todo API 구현

간단한 Todo 관리 API를 설계하고 구현하세요.

## 요구사항
- Todo CRUD를 모두 지원해야 합니다.
- \`done\` 필드를 포함해야 합니다.
- 존재하지 않는 ID 요청에는 적절한 예외 응답을 내려야 합니다.`,
    requirements: [
      "Todo 생성, 조회, 수정, 삭제를 모두 지원해야 합니다.",
      "title, done, createdAt 필드를 관리해야 합니다.",
      "없는 ID 요청에는 올바른 상태 코드와 메시지를 반환해야 합니다."
    ],
    endpoints: ["POST /todos", "GET /todos", "GET /todos/{id}", "PATCH /todos/{id}", "DELETE /todos/{id}"],
    publicCases: [
      {
        id: "tc-01",
        name: "TC-01 · Todo 생성",
        detail: 'POST /todos { "title": "공부하기" }',
        result: "201 Created"
      },
      {
        id: "tc-02",
        name: "TC-02 · 없는 ID 조회",
        detail: "GET /todos/999",
        result: "404 Not Found"
      }
    ],
    criteria: ["테스트 케이스 통과율", "RESTful 설계 일관성", "예외 처리 완결성", "AI 활용 방식 분석"],
    aiGuide: "에러 메시지, 현재 파일 문맥, 시도한 검증 과정을 함께 주면 AI 응답 정확도가 올라갑니다."
  },
  {
    id: "jwt-auth",
    order: "02",
    title: "JWT 인증 구현",
    level: 2,
    category: "API 구현",
    passRate: 54,
    status: "도전 중",
    summary: "로그인, 토큰 발급, 인증 필터까지 포함한 인증 플로우를 구현합니다.",
    estimate: "90분",
    description: `# JWT 인증 구현

로그인과 토큰 검증 흐름을 분리해서 구현하세요.

## 요구사항
- 로그인 성공 시 Access/Refresh Token을 발급해야 합니다.
- 보호 API에서는 유효하지 않은 토큰을 차단해야 합니다.
- 토큰 만료와 재발급 흐름을 다뤄야 합니다.`,
    requirements: [
      "로그인 성공 시 Access Token과 Refresh Token을 함께 발급해야 합니다.",
      "인증 필터는 보호 라우트에서만 동작해야 합니다.",
      "만료 토큰 처리와 재발급 흐름을 구분해야 합니다."
    ],
    endpoints: ["POST /auth/login", "POST /auth/refresh", "GET /users/me"],
    publicCases: [
      { id: "tc-03", name: "TC-01 · 로그인 성공", detail: "POST /auth/login", result: "200 OK" },
      { id: "tc-04", name: "TC-02 · 토큰 만료", detail: "GET /users/me", result: "401 Unauthorized" }
    ],
    criteria: ["인증 플로우 이해", "예외 응답 일관성", "보안 헤더 처리", "AI 활용 방식 분석"],
    aiGuide: "보안 로직은 AI 제안을 그대로 붙이지 말고 상태 코드와 헤더 동작을 직접 검증하는 편이 안전합니다."
  },
  {
    id: "board-api",
    order: "03",
    title: "게시판 API 구현",
    level: 2,
    category: "API 구현",
    passRate: 41,
    status: "미시작",
    summary: "게시글, 댓글, 페이지네이션이 포함된 게시판 API를 구현합니다.",
    estimate: "80분",
    description: `# 게시판 API 구현

목록, 상세, 댓글, 페이지네이션을 함께 고려해야 하는 과제입니다.`,
    requirements: ["게시글 CRUD와 목록 조회", "페이지네이션 및 정렬 지원", "댓글 생성 및 목록 조회"],
    endpoints: ["GET /posts", "POST /posts", "GET /posts/{id}", "POST /posts/{id}/comments"],
    publicCases: [{ id: "tc-05", name: "TC-01 · 게시글 목록", detail: "GET /posts?page=0", result: "200 OK" }],
    criteria: ["리소스 설계", "페이지네이션 처리", "예외 처리", "AI 활용 방식 분석"],
    aiGuide: "먼저 응답 스키마를 정리한 뒤 AI에게 세부 검토를 맡기면 흐름이 덜 흔들립니다."
  },
  {
    id: "order-stock",
    order: "04",
    title: "주문/재고 API 구현",
    level: 3,
    category: "API 구현",
    passRate: 23,
    status: "잠김",
    summary: "트랜잭션과 동시성을 함께 고려해야 하는 고난도 과제입니다.",
    estimate: "120분",
    description: `# 주문/재고 API 구현

트랜잭션, 재고 차감, 동시성 충돌을 함께 고려하세요.`,
    requirements: ["주문 생성 시 재고 차감", "재고 부족 처리", "동시성 충돌 방지"],
    endpoints: ["POST /orders", "PATCH /stock/{id}", "GET /orders/{id}"],
    publicCases: [{ id: "tc-06", name: "TC-01 · 주문 성공", detail: "POST /orders", result: "201 Created" }],
    criteria: ["트랜잭션 설계", "동시성 대응", "예외 처리", "AI 활용 방식 분석"],
    aiGuide: "이 과제는 AI를 설계 리뷰어로 두고 핵심 로직은 단계별로 직접 구현하는 편이 좋습니다."
  },
  {
    id: "bug-fix",
    order: "05",
    title: "버그 수정 과제",
    level: 2,
    category: "버그 수정",
    passRate: 67,
    status: "미시작",
    summary: "주어진 코드에서 결함을 찾고 회귀 없이 수정합니다.",
    estimate: "50분",
    description: `# 버그 수정 과제

실패 테스트를 통과시키고, 원인까지 설명해야 합니다.`,
    requirements: ["실패 테스트 통과", "부작용 없는 수정", "버그 원인 설명"],
    endpoints: ["PATCH /legacy/tasks/{id}", "DELETE /legacy/tasks/{id}"],
    publicCases: [{ id: "tc-07", name: "TC-01 · NPE 수정", detail: "TaskService.findById", result: "PASS" }],
    criteria: ["원인 분석", "수정 범위 관리", "검증 흐름", "AI 활용 방식 분석"],
    aiGuide: "버그 과제는 해결책보다 원인 설명부터 AI에게 묻는 편이 학습 효과가 더 큽니다."
  }
];

export const heroStats = [
  { label: "실습 과제", value: "5종", note: "Lv 1 ~ Lv 3" },
  { label: "세션 보존", value: "30초", note: "중단 복구 대비" },
  { label: "분석 대기", value: "최대 2분", note: "제출 후 처리" }
];

export const defaultUser: AuthUser = {
  id: "user-default",
  name: "홍길동",
  email: "user@email.com",
  provider: "LOCAL",
  createdAt: new Date().toISOString()
};

export const javaStarterFiles: WorkspaceFile[] = [
  {
    path: "src/TodoController.java",
    language: "java",
    content: `@RestController
@RequestMapping("/todos")
public class TodoController {
  private final TodoService todoService;

  public TodoController(TodoService todoService) {
    this.todoService = todoService;
  }
}`
  },
  {
    path: "src/TodoService.java",
    language: "java",
    content: `@Service
public class TodoService {
  @Autowired
  private TodoRepository repo;

  public Todo findById(Long id) {
    return repo.findById(id).get();
  }
}`
  },
  {
    path: "src/TodoRepository.java",
    language: "java",
    content: `public interface TodoRepository extends JpaRepository<Todo, Long> {
}`
  },
  {
    path: "src/Todo.java",
    language: "java",
    content: `@Entity
public class Todo {
  @Id
  @GeneratedValue
  private Long id;
  private String title;
  private boolean done;
}`
  },
  {
    path: "src/TodoServiceTest.java",
    language: "java",
    content: `class TodoServiceTest {
  @Test
  void returns404WhenTodoDoesNotExist() {
  }
}`
  },
  {
    path: "agent/HARNESS.md",
    language: "markdown",
    content: `# Harness Notes

- 이 폴더는 하네스/에이전트 관련 보조 파일을 둡니다.
- \`src\` 코드는 과제 풀이 로직, \`agent\`는 실행 환경 메모를 분리해서 봅니다.
- 현재 워크스페이스는 mock 구조 확인용입니다.`
  }
];

export const pythonStarterFiles: WorkspaceFile[] = [
  {
    path: "app/views.py",
    language: "python",
    content: `import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .service import TodoService

service = TodoService()


@csrf_exempt
def todo_collection(request):
    if request.method == "GET":
        return JsonResponse(service.find_all(), safe=False)
    if request.method == "POST":
        return JsonResponse(service.create(json.loads(request.body or "{}")), status=201)
    return JsonResponse({"message": "Method not allowed"}, status=405)


@csrf_exempt
def todo_detail(request, todo_id):
    if request.method == "GET":
        todo = service.find_by_id(todo_id)
        return JsonResponse(todo)
    if request.method == "PATCH":
        return JsonResponse(service.update(todo_id, json.loads(request.body or "{}")))
    if request.method == "DELETE":
        service.delete(todo_id)
        return JsonResponse({}, status=204)
    return JsonResponse({"message": "Method not allowed"}, status=405)
`
  },
  {
    path: "app/service.py",
    language: "python",
    content: `class TodoService:
    def __init__(self):
        self._todos: dict = {}
        self._next_id: int = 1

    def create(self, data: dict) -> dict:
        todo = {"id": self._next_id, "title": data["title"], "done": False}
        self._todos[self._next_id] = todo
        self._next_id += 1
        return todo

    def find_all(self) -> list:
        return list(self._todos.values())

    def find_by_id(self, todo_id: int) -> dict:
        # TODO: 없는 ID 요청 처리가 필요합니다
        return self._todos.get(todo_id)

    def update(self, todo_id: int, data: dict) -> dict:
        todo = self.find_by_id(todo_id)
        todo.update(data)
        return todo

    def delete(self, todo_id: int) -> None:
        self.find_by_id(todo_id)
        del self._todos[todo_id]
`
  },
  {
    path: "app/models.py",
    language: "python",
    content: `from django.db import models


class Todo(models.Model):
    title = models.CharField(max_length=100)
    done = models.BooleanField(default=False)
`
  },
  {
    path: "tests/test_public.py",
    language: "python",
    content: `from django.test import TestCase


class TodoApiPublicTest(TestCase):
  def test_get_nonexistent_todo(self):
    response = self.client.get("/todos/999")
    # TODO: 404를 반환해야 합니다
    assert response.status_code == 404
`
  },
  {
    path: "agent/HARNESS.md",
    language: "markdown",
    content: `# Harness Notes

- 이 폴더는 하네스/에이전트 관련 보조 파일을 둡니다.
- \`src\` 코드는 과제 풀이 로직, \`agent\`는 실행 환경 메모를 분리해서 봅니다.
- 현재 워크스페이스는 mock 구조 확인용입니다.`
  }
];

const buildJavaWorktreeContent = (file: WorkspaceFile) => {
  if (file.path === "src/TodoService.java") {
    return `@Service
public class TodoService {
  @Autowired
  private TodoRepository repo;

  public Todo findById(Long id) {
    return repo.findById(id)
      .orElseThrow(() -> new IllegalArgumentException("Todo not found: " + id));
  }
}`;
  }

  if (file.path === "src/TodoController.java") {
    return `@RestController
@RequestMapping("/todos")
public class TodoController {
  private final TodoService todoService;

  public TodoController(TodoService todoService) {
    this.todoService = todoService;
  }

  @GetMapping("/{id}")
  public ResponseEntity<Todo> getTodo(@PathVariable Long id) {
    return ResponseEntity.ok(todoService.findById(id));
  }
}`;
  }

  if (file.path === "src/TodoServiceTest.java") {
    return `class TodoServiceTest {
  @Test
  void returns404WhenTodoDoesNotExist() {
    assertThatThrownBy(() -> service.findById(999L))
      .isInstanceOf(IllegalArgumentException.class);
  }
}`;
  }

  return file.content;
};

const buildPythonWorktreeContent = (file: WorkspaceFile) => {
  if (file.path === "app/service.py") {
    return `class TodoService:
    def __init__(self):
        self._todos: dict = {}
        self._next_id: int = 1

    def create(self, data: dict) -> dict:
        todo = {"id": self._next_id, "title": data["title"], "done": False}
        self._todos[self._next_id] = todo
        self._next_id += 1
        return todo

    def find_all(self) -> list:
        return list(self._todos.values())

    def find_by_id(self, todo_id: int) -> dict:
        todo = self._todos.get(todo_id)
        if todo is None:
            raise ValueError(f"Todo not found: {todo_id}")
        return todo

    def update(self, todo_id: int, data: dict) -> dict:
        todo = self.find_by_id(todo_id)
        todo.update(data)
        return todo

    def delete(self, todo_id: int) -> None:
        self.find_by_id(todo_id)
        del self._todos[todo_id]
`;
  }
  if (file.path === "tests/test_public.py") {
    return `from django.test import TestCase


class TodoApiPublicTest(TestCase):
  def test_get_nonexistent_todo(self):
    response = self.client.get("/todos/999")
    assert response.status_code == 404


  def test_create_todo(self):
    response = self.client.post("/todos", data={"title": "공부하기"}, content_type="application/json")
    assert response.status_code == 201
`;
  }
  return file.content;
};

export const createWorktreeFiles = (files: WorkspaceFile[]) => {
  const isPython = files.some((f) => f.language === "python");
  return files
    .filter((file) => !file.path.startsWith("agent/"))
    .map((file) => ({
      path: `.worktree/${file.path.replace(/^src\//, "")}`,
      language: file.language,
      content: isPython ? buildPythonWorktreeContent(file) : buildJavaWorktreeContent(file)
    }));
};

export const starterMessagesSeed = [
  { role: "user" as const, content: "7번째 줄에서 왜 NPE가 나는지 설명해줘" },
  {
    role: "assistant" as const,
    content:
      "findById()가 Optional을 반환하는데 .get()을 바로 호출해서 값이 없으면 예외가 납니다. orElseThrow()로 바꾸는 쪽이 안전합니다."
  }
];

export const starterTracesSeed: TraceEvent[] = [
  {
    id: "trace-1",
    time: "10:03",
    type: "AI 요청",
    summary: "NPE 원인 설명 요청",
    detail: "현재 파일: TodoService.java"
  },
  {
    id: "trace-2",
    time: "10:04",
    type: "AI 응답",
    summary: "orElseThrow 대안 안내",
    detail: "응답 길이 142자"
  }
];

export const reportScores: ScoreItem[] = [
  {
    label: "하네스 품질 점수",
    score: 82,
    tone: "good",
    note: "HARNESS.md에 작성된 에이전트 지시 품질과 문제 문맥 명확성이 우수했습니다."
  },
  {
    label: "실행 품질 점수",
    score: 46,
    tone: "warn",
    note: "AI 제안 코드를 실행·테스트로 검증하고 결과를 반영하는 빈도를 높일 필요가 있습니다."
  },
  {
    label: "트레이스 활용 점수",
    score: 65,
    tone: "mid",
    note: "에이전트 트레이스를 참고하는 흐름은 있으나 일부 구간에서 활용도가 다소 낮았습니다."
  }
];

export const reportStrengths = [
  "에러 메시지와 현재 파일을 함께 제시해 AI가 상황을 빠르게 이해할 수 있었습니다.",
  "AI 응답 이후 테스트를 다시 실행하면서 수정 흐름을 단계적으로 검증했습니다."
];

export const reportImprovements = [
  "AI 제안 코드를 붙이기 전에 예상 상태 코드와 실패 원인을 먼저 직접 정리하면 더 안정적입니다.",
  "예외 처리 케이스를 기능 단위로 나눠 확인하면 수정 범위를 더 잘 통제할 수 있습니다."
];

export const reportSummary =
  "AI를 조언 도구로는 잘 활용했지만, 응답 검증 루틴을 더 강화하면 다음 단계로 안정적으로 올라갈 수 있습니다.";

export const mypageStats = [
  { label: "완료한 과제", value: "1", note: "Todo API 구현" },
  { label: "진행 중 세션", value: "2", note: "JWT 인증 구현 포함" },
  { label: "누적 AI 요청", value: "34", note: "전체 세션 기준" }
];

export const getProblemById = (id: string) => problems.find((problem) => problem.id === id);

export const createStarterFiles = (language: ProblemLanguage = "java"): WorkspaceFile[] => {
  const base = language === "python" ? pythonStarterFiles : javaStarterFiles;
  const sourceFiles = base.map((file) => ({ ...file }));
  const worktreeFiles = createWorktreeFiles(sourceFiles);
  return [...sourceFiles, ...worktreeFiles];
};

export const createStarterMessages = (): AiMessage[] =>
  starterMessagesSeed.map((message, index) => ({
    id: `msg-seed-${index + 1}`,
    role: message.role,
    content: message.content,
    createdAt: new Date().toISOString()
  }));

export const createStarterTraces = (): TraceEvent[] => starterTracesSeed.map((trace) => ({ ...trace }));

export const createRunResult = (language: ProblemLanguage = "java"): RunResult => ({
  status: "COMPLETED",
  stdout: language === "python"
    ? "$ uvicorn main:app --reload\nINFO:     Uvicorn running on http://127.0.0.1:8000\nINFO:     Application startup complete."
    : "$ ./gradlew bootRun\nStarted on port 8080\nBUILD SUCCESS (3.4s)",
  stderr: "",
  exitCode: 0,
  durationMs: 3400
});

export const createTestResults = (passCount: number): TestRunResult => {
  const results: TestCaseResult[] = [
    { id: "tc-01", name: "TC-01 Todo 생성", status: "PASS", time: "120ms" },
    { id: "tc-02", name: "TC-02 없는 ID", status: passCount >= 2 ? "PASS" : "FAIL", time: "85ms" },
    { id: "tc-03", name: "TC-03 중복 데이터", status: passCount >= 3 ? "PASS" : "FAIL", time: "95ms" },
    { id: "tc-04", name: "TC-04 완료 수정", status: passCount >= 4 ? "PASS" : "FAIL", time: "78ms" },
    { id: "tc-05", name: "TC-05 예외 응답", status: passCount >= 5 ? "PASS" : "FAIL", time: "62ms" }
  ];

  return {
    total: results.length,
    passed: results.filter((result) => result.status === "PASS").length,
    failed: results.filter((result) => result.status === "FAIL").length,
    results
  };
};

export const createFeedbackReport = (submissionId: string, timeline: TraceEvent[]): FeedbackReport => ({
  id: `report-${submissionId}`,
  submissionId,
  status: "COMPLETED",
  generatedAt: new Date().toISOString(),
  testPassRate: 60,
  testSummary: "3 / 5 통과",
  scores: reportScores,
  strengths: reportStrengths,
  improvements: reportImprovements,
  summary: reportSummary,
  timeline
});

export const createAiEditSuggestion = (selected: string): AiEditSuggestion => ({
  original: selected,
  replacement: `return repo.findById(id)\n  .orElseThrow(() -> new TodoNotFoundException(id));`,
  summary: "Optional.get() 대신 orElseThrow()를 사용해 값이 없을 때 예외를 명시적으로 처리하도록 수정합니다."
});

export const derivePassCountFromFiles = (files: WorkspaceFile[]) => {
  const source = files.find((file) => file.path.endsWith("TodoService.java"))?.content ?? "";

  if (
    source.includes("ResponseStatusException") ||
    source.includes("@ResponseStatus") ||
    source.includes("HttpStatus.NOT_FOUND")
  ) {
    return 5;
  }
  if (source.includes("TodoNotFoundException")) {
    return 4;
  }
  if (source.includes("orElseThrow")) {
    return 3;
  }
  return 1;
};

export const createInitialSession = (sessionId: string, userId: string, problemId: string, language: ProblemLanguage = "java"): SolveSession => ({
  id: sessionId,
  workspaceId: `ws-${sessionId}`,
  problemId,
  userId,
  language,
  status: "CREATING",
  aiRequestCount: 2,
  lastSavedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  readyAt: Date.now() + 2200,
  files: createStarterFiles(language),
  messages: createStarterMessages(),
  traces: createStarterTraces(),
  aiModel: "aig-default",
  aiProvider: "default"
});

export const createSubmission = (submissionId: string, sessionId: string): Submission => ({
  id: submissionId,
  sessionId,
  status: "PROCESSING",
  submittedAt: new Date().toISOString(),
  readyAt: Date.now() + 3500
});
