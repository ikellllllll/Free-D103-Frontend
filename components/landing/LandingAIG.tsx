"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles,
  ArrowRight,
  PlayCircle,
  LogOut,
  Minus,
  Save,
  Square,
  X
} from "lucide-react";

const SECTION_IDS = ["hero", "showcase", "features", "workflow", "demo", "reports", "cta"] as const;
type SectionId = (typeof SECTION_IDS)[number];

const WORKFLOW = [
  {
    step: "01",
    label: "세션 시작",
    cmd: "aig session start --problem todo-api",
    tag: "세션",
    desc: "과제를 선택하고 AI 에이전트 세션을 초기화합니다. 파일 시스템이 준비되고 AI가 컨텍스트를 파악합니다.",
    img: "/problemsSession.png",
    alt: "세션 시작 화면"
  },
  {
    step: "02",
    label: "코드 수정 & Diff",
    cmd: "aig diff --show-changes",
    tag: "Diff 뷰",
    desc: "AI가 제안한 코드 변경 사항을 Diff 뷰로 확인합니다. 좌우 비교로 수정 전·후를 한눈에 파악할 수 있습니다.",
    img: "/problemsDIFF.png",
    alt: "코드 Diff 화면"
  },
  {
    step: "03",
    label: "Trace 분석",
    cmd: "aig trace --session current --detail",
    tag: "Trace",
    desc: "에이전트의 모든 Tool Call, LLM 호출, 실행 스팬을 실시간으로 기록합니다. 에이전트가 어떻게 사고하는지 투명하게 확인하세요.",
    img: "/Trace.png",
    alt: "Trace 분석 화면"
  },
  {
    step: "04",
    label: "제출 & 분석 중",
    cmd: "aig submit --session current",
    tag: "분석 중",
    desc: "코드를 제출하면 AI가 테스트 케이스 채점, 코드 리뷰, AI 활용 분석을 순차적으로 처리합니다.",
    img: "/reportrunning.png",
    alt: "제출 분석 진행 화면"
  },
  {
    step: "05",
    label: "피드백 리포트",
    cmd: "aig report --latest --format full",
    tag: "리포트 완성",
    desc: "하네스 점수 · 실행 품질 · AI 활용 역량 3가지 기준으로 분석된 맞춤형 리포트를 확인합니다.",
    img: "/report.png",
    alt: "피드백 리포트 화면"
  }
];

const IDE_STEPS = [
  {
    label: "코드 선택",
    status: "수정이 필요한 하네스 로직을 드래그합니다.",
    question: "회원 목록 API가 name 오름차순으로 정렬이 안 되는 이유가 뭐야?",
    answer: "UserController에서 List.of()를 그대로 반환하고 있어요. UserService를 주입하고 .stream().sorted(Comparator.comparing(UserResponse::name)).toList()로 바꾸면 됩니다."
  },
  {
    label: "에이전트에게 질문",
    status: "선택한 코드가 에이전트 모드로 전달됩니다.",
    question: "회원 목록 API가 name 오름차순으로 정렬이 안 되는 이유가 뭐야?",
    answer: "UserController에서 List.of()를 그대로 반환하고 있어요. UserService를 주입하고 .stream().sorted(Comparator.comparing(UserResponse::name)).toList()로 바꾸면 됩니다."
  },
  {
    label: "답변 생성 중",
    status: "에이전트가 하네스 컨텍스트를 분석하고 있습니다.",
    question: "회원 목록 API가 name 오름차순으로 정렬이 안 되는 이유가 뭐야?",
    answer: "UserController에서 List.of()를 그대로 반환하고 있어요. UserService를 주입하고 .stream().sorted(Comparator.comparing(UserResponse::name)).toList()로 바꾸면 됩니다."
  },
  {
    label: "답변 도착",
    status: "원인과 수정 방향, diff 미리보기가 함께 열립니다.",
    question: "회원 목록 API가 name 오름차순으로 정렬이 안 되는 이유가 뭐야?",
    answer: "UserController에서 List.of()를 그대로 반환하고 있어요. UserService를 주입하고 .stream().sorted(Comparator.comparing(UserResponse::name)).toList()로 바꾸면 됩니다."
  }
];

const SHOWCASE_STATS = [
  { value: "5종", label: "하네스 과제" },
  { value: "AI", label: "에이전트 협업" },
  { value: "3개", label: "평가 지표" },
  { value: "14기", label: "SSAFY" }
];

const HERO_IDE_PREVIEW_WIDTH = 1440;
const HERO_IDE_PREVIEW_HEIGHT = 810;

function HeroIdePreviewMock({ step }: { step: number }) {
  const [activeActivity, setActiveActivity] = useState(1);
  const [agentOpen, setAgentOpen] = useState(true);
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const [aiMode, setAiMode] = useState<"chat" | "agent">("chat");
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const [previewScale, setPreviewScale] = useState(1);

  const activityItems = [
    { id: "problem", icon: "codicon-book", badge: "0", label: "문제" },
    { id: "explorer", icon: "codicon-files", badge: "2", label: "탐색기" },
    { id: "search", icon: "codicon-search", badge: "", label: "검색" },
    { id: "trace", icon: "codicon-pulse", badge: "", label: "Trace" },
    { id: "harness", icon: "codicon-circuit-board", badge: "", label: "하네스" },
    { id: "output", icon: "codicon-terminal", badge: "2", label: "출력" },
    { id: "ai", icon: "codicon-hubot", badge: "1/5", label: "AI" }
  ];

  const agentFiles = [
    ["codicon-chevron-down", "codicon-folder-opened", "agent", 0],
    ["codicon-chevron-down", "codicon-folder-opened", "prompts", 1],
    ["", "codicon-book", "harness-authoring.md", 2],
    ["codicon-chevron-down", "codicon-folder-opened", "skills", 1],
    ["codicon-chevron-down", "codicon-folder-opened", "harness-creator", 2],
    ["", "codicon-book", "SKILL.md", 3],
    ["codicon-chevron-down", "codicon-folder-opened", "sub_agent", 2],
    ["", "codicon-settings-gear", "harness-reviewer.toml", 3],
    ["", "codicon-book", "AGENTS.md", 1],
    ["", "codicon-book", "HARNESS.md", 1]
  ] as const;

  const workspaceFiles = [
    ["codicon-chevron-down", "codicon-folder-opened", "worktree", 0, "ai"],
    ["codicon-chevron-down", "codicon-folder-opened", "problem-1-todo-api-java-starter", 1, ""],
    ["codicon-chevron-down", "codicon-folder-opened", "src", 2, ""],
    ["codicon-chevron-down", "codicon-folder-opened", "main", 3, ""],
    ["", "codicon-symbol-namespace", "java.com.aig.todo", 4, ""],
    ["codicon-chevron-down", "codicon-folder-opened", "exception", 5, ""],
    ["", "codicon-symbol-class", "GlobalExceptionHandl...", 6, ""],
    ["", "codicon-symbol-class", "TodoNotFoundExcepti...", 6, ""],
    ["codicon-chevron-down", "codicon-folder-opened", "todo", 5, ""],
    ["codicon-chevron-down", "codicon-folder-opened", "controller", 6, ""],
    ["", "codicon-symbol-class", "TodoController.java", 7, ""]
  ] as const;

  const linePulse = step >= 2;

  const getPreviewFileKind = (icon: string, name: string) => {
    if (icon.includes("symbol-class") || name.endsWith(".java")) return "java";
    if (icon.includes("settings") || name.endsWith(".toml")) return "config";
    return "docs";
  };

  const getPreviewFolderKind = (name: string) => {
    if (name === "worktree") return "worktree";
    if (name === "src" || name === "main") return "source";
    if (name.includes(".")) return "package";
    return "default";
  };

  const renderPreviewTreeItem = (
    item: readonly [string, string, string, number] | readonly [string, string, string, number, string],
    activeName?: string
  ) => {
    const [chevron, icon, name, depth, tag = ""] = item;
    const isFolderLike = Boolean(chevron) || icon.includes("folder") || icon.includes("symbol-namespace");

    if (isFolderLike) {
      return (
        <button
          key={name}
          type="button"
          className="tree-folder tree-folder--open"
          style={{ paddingLeft: `${7 + depth * 7}px` }}
        >
          <span
            className={`tree-row__twistie codicon ${chevron || "codicon-chevron-down"}`}
            aria-hidden="true"
          />
          <span
            className={`tree-folder__icon codicon ${icon}`}
            data-folder-kind={getPreviewFolderKind(name)}
            aria-hidden="true"
          />
          <span className="tree-row__folder">{name}</span>
          {tag ? <span className="tree-row__badge">{tag}</span> : null}
        </button>
      );
    }

    return (
      <button
        key={name}
        type="button"
        className={name === activeName ? "tree-row tree-row--file tree-row--active" : "tree-row tree-row--file"}
        style={{ paddingLeft: `${9 + depth * 7}px` }}
      >
        <span className="tree-row__main">
          <span
            className={`file-icon codicon ${icon}`}
            data-file-kind={getPreviewFileKind(icon, name)}
            data-file-ext={name.split(".").pop()}
            aria-hidden="true"
          />
          <span className="tree-row__label">{name}</span>
        </span>
        {tag ? <span className="tree-row__badge">{tag}</span> : null}
      </button>
    );
  };

  useEffect(() => {
    const frame = previewFrameRef.current;
    if (!frame) return;

    const syncScale = () => {
      const { width, height } = frame.getBoundingClientRect();
      setPreviewScale(Math.min(width / HERO_IDE_PREVIEW_WIDTH, height / HERO_IDE_PREVIEW_HEIGHT));
    };

    syncScale();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", syncScale);
      return () => window.removeEventListener("resize", syncScale);
    }

    const observer = new ResizeObserver(syncScale);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={previewFrameRef}
      className="landing-ide-preview ide-theme-blue"
      style={{ aspectRatio: `${HERO_IDE_PREVIEW_WIDTH} / ${HERO_IDE_PREVIEW_HEIGHT}` }}
    >
      <div
        className="landing-ide-preview__scaled"
        style={{
          width: HERO_IDE_PREVIEW_WIDTH,
          height: HERO_IDE_PREVIEW_HEIGHT,
          transform: `scale(${previewScale})`
        }}
      >
      <div className="ide-route ide-route--workspace">
      <div className="ide-shell ide-shell--workbench landing-ide-preview__shell">
        <aside className="activity-bar landing-ide-preview__activity">
          <div className="activity-bar__group">
            {activityItems.map((item, index) => (
              <button
                type="button"
                key={`${item.icon}-${index}`}
                aria-label={item.label}
                onClick={() => {
                  setActiveActivity(index);
                  if (item.id === "harness") {
                    setAgentOpen(true);
                    setWorkspaceOpen(false);
                  }
                  if (item.id === "explorer") {
                    setAgentOpen(true);
                    setWorkspaceOpen(true);
                  }
                  if (item.id === "ai") {
                    setAiMode("agent");
                  }
                }}
                className={index === activeActivity ? "activity-bar__item activity-bar__item--active" : "activity-bar__item"}
              >
                <span className="activity-bar__label activity-bar__icon-wrap">
                  <span className={`codicon ${item.icon} activity-bar__icon`} aria-hidden="true" />
                </span>
                {item.badge ? (
                  <span className="activity-bar__badge">{item.badge}</span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="activity-bar__group" style={{ marginTop: "auto" }}>
            <button type="button" className="activity-bar__item">
              <span className="activity-bar__label activity-bar__icon-wrap">
                <span className="codicon codicon-question activity-bar__icon" aria-hidden="true" />
              </span>
            </button>
          </div>
        </aside>

        <aside className="ide-shell__sidebar landing-ide-preview__sidebar">
          <div className="sidebar-header landing-ide-preview__sidebar-header">
            <div>
              <div className="panel-title">Explorer</div>
              <strong>탐색기</strong>
            </div>
          </div>
          <div className="sidebar-section landing-ide-preview__sidebar-section">
            <div className="agent-section">
              <button
                type="button"
                onClick={() => setAgentOpen((value) => !value)}
                className="agent-section__header"
              >
                <span>
                  <span className={`codicon ${agentOpen ? "codicon-chevron-down" : "codicon-chevron-right"} mr-[0.35em]`} aria-hidden="true" />
                  Agent 설정
                </span>
                <span className="agent-section__badge">4 files</span>
              </button>
              <button
                type="button"
                onClick={() => setAgentOpen((value) => !value)}
                className="agent-section__subtitle"
              >
                agent · skills · instruction · harness
              </button>
              <div className="tree-root__children" style={agentOpen ? undefined : { display: "none" }}>
                {agentFiles.map((item) => renderPreviewTreeItem(item))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setWorkspaceOpen((value) => !value)}
              className="section-toggle"
            >
              <span>
                <span className={`codicon ${workspaceOpen ? "codicon-chevron-down" : "codicon-chevron-right"} mr-[0.35em]`} aria-hidden="true" />
                Workspace
              </span>
              <small>ai</small>
            </button>
            <div className="tree-root__children" style={workspaceOpen ? undefined : { display: "none" }}>
              {workspaceFiles.map((item) => renderPreviewTreeItem(item))}
            </div>
          </div>
        </aside>

        <div className="pane-resizer pane-resizer--vertical" aria-hidden="true" />

        <main className="ide-shell__main landing-ide-preview__main">
          <div className="editor-tabbar editor-tabbar--global landing-ide-preview__global-tabbar">
            <div className="editor-tabbar__row editor-tabbar__row--meta landing-ide-preview__meta">
              <div className="editor-tabbar__context">
                <div className="solve-timer-bar">
                  <div className="solve-timer-bar__track">
                    <div className="solve-timer-bar__fill" style={{ width: "18%" }} />
                  </div>
                  <span className="solve-timer-bar__label">01:22</span>
                  <span className="solve-timer-bar__limit">45m</span>
                </div>
                <span className="editor-tabbar__meta">자동 저장 대기</span>
              </div>
              <div className="editor-tabbar__actions">
                <div className="ide-toolbar">
                  <button type="button" className="ide-toolbar__btn ide-toolbar__btn--active">Auto</button>
                  <button type="button" className="ide-toolbar__btn">
                    <Save size={13} strokeWidth={2} />
                  </button>
                  <span className="ide-toolbar__sep" />
                  <button type="button" className="ide-toolbar__btn">테스트</button>
                  <span className="ide-toolbar__sep" />
                  <button type="button" className="ide-toolbar__btn ide-toolbar__btn--submit">제출</button>
                  <span className="ide-toolbar__sep" />
                  <button type="button" className="ide-toolbar__btn ide-toolbar__btn--exit">
                    <LogOut size={13} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="editor-stage">
            <div className="editor-groups">
              <section className="editor-group editor-group--active">
                <div className="editor-tabbar editor-tabbar--group landing-ide-preview__tabbar">
                  <div className="editor-tabbar__row editor-tabbar__row--tabs">
                    <div className="editor-tabs">
                      <div className="editor-tabs__item editor-tabs__item--active">
                        <button type="button" className="editor-tabs__select">
                          <span className="file-icon file-icon--tab codicon codicon-book" data-file-kind="docs" aria-hidden="true" />
                          <span>README.md</span>
                        </button>
                        <button type="button" className="editor-tabs__close" aria-label="README.md 닫기">
                          ×
                        </button>
                      </div>
                    </div>
                    <div className="editor-tabs__tools">
                      <button type="button" className="editor-tabs__mode-button editor-tabs__mode-button--active">
                        <span className="codicon codicon-edit mr-[0.35em]" aria-hidden="true" />
                        편집
                      </button>
                      <button type="button" className="editor-tabs__mode-button editor-tabs__mode-button--icon" aria-label="오른쪽으로 분할">
                        <span className="codicon codicon-split-horizontal" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="editor-host editor-host--preview">
                  <article className="markdown-preview">
                    <h1>Todo CRUD API – Starter</h1>
                    <h2>시작하기</h2>
                    <pre className={linePulse ? "landing-ide-preview__pulse" : undefined}>
                      <code>{`# 빌드 + 테스트
./gradlew test
# 개발 서버 (포트 8080)
./gradlew bootRun`}</code>
                    </pre>
                    <h2>작성해야 하는 파일</h2>
                    <pre>
                      <code>{`src/main/java/com/aig/todo/todo/
├── TodoService.java        🔧 5개 메서드 구현
└── TodoController.java     🔧 5개 엔드포인트 구현`}</code>
                    </pre>
                    <p>자세한 명세는 과제 설명을 참고하세요.</p>
                    <h2>구조</h2>
                  </article>
                </div>
              </section>
            </div>

            <div className="pane-resizer pane-resizer--horizontal" aria-hidden="true" />
            <section className="bottom-panel landing-ide-preview__bottom-panel" style={{ height: 220 }}>
              <div className="bottom-panel__tabs">
                <div className="bottom-panel__tab-list">
                  <button type="button" className="bottom-panel__tab bottom-panel__tab--active">출력 <small>ready</small></button>
                  <button type="button" className="bottom-panel__tab">테스트 <small>idle</small></button>
                  <button type="button" className="bottom-panel__tab">제출 <small>idle</small></button>
                  <button type="button" className="bottom-panel__tab">Trace <small>2</small></button>
                </div>
              </div>

              <div className="bottom-panel__body">
                <div className="landing-ide-preview__mini-grid">
                  {["stdout\n아직 실행한 결과가 없습니다.", "stderr\n에러 출력 없음"].map((text) => {
                    const [title, body] = text.split("\n");
                    return (
                      <div key={title} className="mini-panel mini-panel--flat">
                        <strong>{title}</strong>
                        <p>{body}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="mini-panel mini-panel--flat">
                  <span className="font-black">실행 대기</span>
                  <span className="muted-copy">실행 버튼으로 결과를 확인하세요.</span>
                </div>
              </div>
            </section>
          </div>

          <div className="status-bar">
            <div className="status-bar__group"><span>main</span><span>MD</span><span>UTF-8</span><span>LF</span><span>56 lines</span></div>
            <div className="status-bar__group"><span>저장됨</span><span>Ln 1, Col 1</span><span>AIG Chat</span><span>OUTPUT</span></div>
          </div>
        </main>

        <div className="pane-resizer pane-resizer--vertical" aria-hidden="true" />

        <aside className="ide-shell__ai landing-ide-preview__ai">
          <div className="sidebar-header">
            <div>
              <span className="panel-title panel-title--compact">AIG Assistant</span>
              <div className="assistant-header__title">
                <strong>AI 보조 패널</strong>
                <span className="ai-context-chip assistant-version-chip">v0.1</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAiMode("agent")}
              className="button button--primary button--tiny assistant-build-button"
            >
              {aiMode === "agent" ? "Building" : "Agent Build"}
            </button>
          </div>

          <div className="ai-panel ai-panel--chat">
            <div className="ai-panel__head">
              <div className="ai-tabs">
                <button
                  type="button"
                  onClick={() => setAiMode("chat")}
                  className={`chip ${aiMode === "chat" ? "chip--active" : ""}`}
                >
                  chat mode
                </button>
                <button
                  type="button"
                  onClick={() => setAiMode("agent")}
                  className={`chip ${aiMode === "agent" ? "chip--active" : ""}`}
                >
                  agent mode
                </button>
              </div>
              <div className="ai-context-strip">
                {["README.md", "선택 없음", "AI quota 1/5"].map((tag) => (
                  <span key={tag} className="ai-context-chip">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="chat-stack chat-stack--panel">
              <div className="chat-bubble chat-bubble--user">
                <div className="chat-bubble__plain">{aiMode === "chat" ? "ㅎㅇ" : "TodoService 기준으로 패치 생성해줘"}</div>
              </div>
              <div className={`chat-bubble ${step >= 2 ? "landing-ide-preview__pulse" : ""}`}>
                <div className="chat-bubble__markdown">
                  {aiMode === "chat" ? (
                    <>
                      <p>안녕! 뭐 도와줄까?</p>
                      <p>[오류] AI 스트리밍 중 오류가 발생했습니다.</p>
                    </>
                  ) : (
                    <>
                      <p>Agent Mode가 선택되었습니다. 현재 README.md와 워크스페이스를 바탕으로 `.worktree`에 패치를 만들고 Trace를 남깁니다.</p>
                      <h3>실행 계획</h3>
                      <ul>
                        <li>관련 파일을 읽고 변경 범위를 좁힙니다.</li>
                        <li>테스트 가능한 단위로 패치를 생성합니다.</li>
                        <li>Diff와 Trace에서 근거를 확인합니다.</li>
                      </ul>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="chat-input-row">
              <textarea
                className="input input--textarea"
                readOnly
                value=""
                placeholder="현재 문제나 코드에 대해 질문하세요"
              />
              <button
                type="button"
                onClick={() => setAiMode((mode) => (mode === "chat" ? "agent" : "chat"))}
                className="button button--primary transition-transform active:scale-[0.98]"
              >
                {aiMode === "chat" ? "전송" : "패치 생성"}
              </button>
            </div>
          </div>
        </aside>
      </div>
      </div>
      </div>
    </div>
  );
}

export function LandingAIG() {
  const sectionRefs = useRef<Record<SectionId, HTMLElement | null>>({
    hero: null,
    showcase: null,
    features: null,
    workflow: null,
    demo: null,
    reports: null,
    cta: null
  });
  const previewRef = useRef<HTMLDivElement | null>(null);

  // Workflow step selector
  const [activeStep, setActiveStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const step = WORKFLOW[activeStep];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTransitioning(true);
      window.setTimeout(() => {
        setActiveStep((p) => (p + 1) % WORKFLOW.length);
        setTransitioning(false);
      }, 300);
    }, 4000);
    return () => window.clearInterval(timer);
  }, []);

  const goToStep = useCallback((i: number) => {
    setActiveStep((prev) => {
      if (i === prev) return prev;
      setTransitioning(true);
      window.setTimeout(() => {
        setActiveStep(i);
        setTransitioning(false);
      }, 250);
      return prev;
    });
  }, []);

  // IDE live demo
  const [ideStep, setIdeStep] = useState(0);
  const [ideCursor, setIdeCursor] = useState(true);
  const ideStepData = IDE_STEPS[ideStep];

  useEffect(() => {
    const t = window.setInterval(
      () => setIdeStep((p) => (p + 1) % IDE_STEPS.length),
      3200
    );
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setIdeCursor((p) => !p), 500);
    return () => window.clearInterval(t);
  }, []);

  const setSectionRef = useCallback(
    (id: SectionId) => (node: HTMLElement | null) => {
      sectionRefs.current[id] = node;
    },
    []
  );

  const scrollToSection = useCallback((id: SectionId) => {
    if (id === "hero") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (id === "showcase" && previewRef.current) {
      const top = previewRef.current.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      return;
    }
    const node = sectionRefs.current[id];
    if (!node) return;
    const top = node.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, []);

  const handleAnchorJump = useCallback(
    (id: SectionId) => (event: React.MouseEvent) => {
      event.preventDefault();
      scrollToSection(id);
    },
    [scrollToSection]
  );

  return (
    <div className="landing-scroll w-full max-w-none bg-[#0F0F2E] font-sans">
      {/* ────────────────── HERO SECTION (Dark) ────────────────── */}
      <section
        ref={setSectionRef("hero")}
        data-section="hero"
        id="hero"
        className="relative bg-[#0F0F2E] text-white flex flex-col overflow-visible"
      >
        {/* Background grid */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.15]" />
        </div>

        {/* Topbar */}
        <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-white/70 shadow-sm">
          <nav className="mx-auto h-14 max-w-6xl flex items-center justify-between px-6">
            <Link href="/" className="flex items-center space-x-2 font-display font-bold text-lg group cursor-pointer">
              <Image src="/brand/favicon.png" alt="AIG" width={35} height={35} className="rounded-lg object-cover" />
            </Link>
            <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-gray-700">
              <a href="#showcase" onClick={handleAnchorJump("showcase")} className="hover:text-indigo-600 transition-colors cursor-pointer">미리보기</a>
              <a href="#features" onClick={handleAnchorJump("features")} className="hover:text-indigo-600 transition-colors cursor-pointer">기능</a>
              <a href="#workflow" onClick={handleAnchorJump("workflow")} className="hover:text-indigo-600 transition-colors cursor-pointer">워크플로</a>
              <a href="#reports" onClick={handleAnchorJump("reports")} className="hover:text-indigo-600 transition-colors cursor-pointer">리포트</a>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors shadow-sm cursor-pointer"
            >
              <span>로그인</span>
              <ArrowRight size={14} strokeWidth={2.4} />
            </Link>
          </nav>
        </div>

        {/* Hero content */}
        <div className="relative z-10 flex flex-col items-center px-6 pt-6 pb-10 text-center max-w-4xl mx-auto w-full animate-slide-up md:pt-8">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight leading-[1.1] mb-3">
            <span className="block">하네스엔지니어링</span>
            <span className="block">워크스페이스</span>
          </h1>

          <div className="self-center inline-flex border-l-2 border-white/40 pl-3 text-xs font-semibold tracking-[0.12em] text-white/55 mb-4">
            SSAFY 14기 · D103 자율 프로젝트
          </div>

          <p className="text-base md:text-xl text-indigo-200/90 max-w-2xl mx-auto leading-relaxed mb-5">
            하네스 구성 문제를 풀고, AI와 함께 수정 근거를 남기고,
            <br className="hidden md:block" />
            Trace와 리포트로 풀이 과정을 다시 설명할 수 있게 만드세요.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/problems"
              className="inline-flex items-center space-x-2 bg-white text-indigo-900 hover:bg-indigo-50 font-semibold px-6 py-3.5 rounded-full transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 cursor-pointer"
            >
              <span>문제 보기</span>
              <ArrowRight size={16} strokeWidth={2.4} />
            </Link>
            <a
              href="#showcase"
              onClick={handleAnchorJump("showcase")}
              className="inline-flex items-center space-x-2 bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/20 text-white font-semibold px-6 py-3.5 rounded-full transition-colors cursor-pointer"
            >
              <PlayCircle size={18} strokeWidth={2.2} />
              <span>데모 보기</span>
            </a>
          </div>
        </div>

        {/* ── Floating preview — extends into showcase section ── */}
        <div
          ref={previewRef}
          className="relative z-20 flex justify-center px-6 md:px-10"
          style={{ marginBottom: "-160px" }}
        >
          <div className="w-full max-w-5xl">
            {/* Glass frame — padding + backdrop + deep shadow */}
            <div
              className="relative rounded-[20px] overflow-hidden backdrop-blur-sm"
              style={{
                background: "rgba(165,180,252,0.055)",
                border: "1px solid rgba(165,180,252,0.20)",
                padding: "8px",
                boxShadow: "0 0 0 1px rgba(165,180,252,0.07), 0 40px 80px rgba(0,0,0,0.65), 0 8px 24px rgba(0,0,0,0.45)"
              }}
            >

              <div className="relative overflow-hidden rounded-[14px]">
                <HeroIdePreviewMock step={ideStep} />
                {/* bottom fade */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0a0a20]/70 to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────── SHOWCASE (preview continues + stats) ────────────────── */}
      {/* padding-top matches margin-bottom on preview (-160px) so stats start exactly below preview */}
      <section
        ref={setSectionRef("showcase")}
        data-section="showcase"
        id="showcase"
        className="relative bg-[#0A0A20] text-white"
        style={{ paddingTop: "160px" }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.10),transparent_55%)]" />
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.06]" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-6 w-full py-10">
          <div className="grid grid-cols-4 gap-0 border-t border-white/10 pt-8 pb-12">
            {SHOWCASE_STATS.map((s, i) => (
              <div key={s.label} className={`text-center py-6 ${i < 3 ? "border-r border-white/10" : ""}`}>
                <div
                  className="text-4xl md:text-5xl font-display font-bold mb-2"
                  style={{ backgroundImage: "linear-gradient(90deg,#A5B4FC,#C4B5FD)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
                >
                  {s.value}
                </div>
                <div className="text-sm font-bold text-indigo-300/80 uppercase tracking-[0.12em]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────── FEATURES (Bento cards) ────────────────── */}
      <section
        ref={setSectionRef("features")}
        data-section="features"
        id="features"
        className="relative min-h-screen bg-[#EEF2FF] overflow-hidden flex flex-col justify-center py-20"
      >
        {/* Background grid */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-full overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.04]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 w-full">
          {/* heading */}
          <div className="mb-12">
            <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4 text-slate-950">
              하네스 과제를{" "}
              <span style={{ backgroundImage: "linear-gradient(90deg,#4338CA,#6D28D9,#0E7490)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                풀고, 기록하고
              </span>
              ,<br />근거로 설명합니다
            </h2>
            <p className="text-base text-slate-600 max-w-none leading-relaxed md:whitespace-nowrap">
              API 구현 과제를 AI와 함께 풀고, 에이전트가 어떻게 사고했는지 Trace로 남깁니다.
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

            {/* Chat Mode */}
            <div className="relative min-h-[360px] rounded-3xl border border-gray-200/80 bg-white overflow-hidden group transition-all duration-300 flex flex-col justify-start shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04),0_12px_28px_-16px_rgba(79,70,229,0.18)] hover:-translate-y-1 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,1),0_12px_24px_-12px_rgba(79,70,229,0.25)]">
              <div className="relative h-48 overflow-hidden border-b border-slate-100 bg-slate-100">
                <Image
                  src="/chatMode.png"
                  alt="Chat Mode 화면 미리보기"
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-contain object-center transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="px-8 pb-8 pt-5">
                <h3 className="text-3xl font-display font-bold text-slate-950 tracking-tight mb-4">Chat Mode</h3>
                <p className="text-base text-slate-600 leading-7">하네스 구조와 API 설계에 대해 AI에게 직접 질문하고 코드를 완성합니다. 프롬프트 품질이 곧 풀이 역량입니다.</p>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent" />
            </div>

            {/* Agent Mode */}
            <div className="relative min-h-[260px] rounded-3xl border border-gray-200/80 bg-white overflow-hidden group transition-all duration-300 p-8 flex flex-col justify-start shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04),0_12px_28px_-16px_rgba(79,70,229,0.18)] hover:-translate-y-1 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,1),0_12px_24px_-12px_rgba(79,70,229,0.25)]">
              <div className="min-w-0">
                <h3 className="text-3xl font-display font-bold text-slate-950 tracking-tight mb-5">Agent Mode</h3>
                <p className="text-base text-slate-600 leading-7">하네스 구성 문제를 에이전트에게 위임합니다. 자율 실행된 수정 흐름이 Diff와 Trace로 기록되어 근거를 검토할 수 있습니다.</p>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent" />
            </div>

            {/* AI 피드백 리포트 */}
            <div className="relative min-h-[260px] rounded-3xl border border-gray-200/80 bg-white overflow-hidden group transition-all duration-300 p-8 flex flex-col justify-start shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04),0_12px_28px_-16px_rgba(79,70,229,0.18)] hover:-translate-y-1 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,1),0_12px_24px_-12px_rgba(79,70,229,0.25)]">
              <div className="min-w-0">
                <h3 className="text-3xl font-display font-bold text-slate-950 tracking-tight mb-5">AI 피드백 리포트</h3>
                <p className="text-base text-slate-600 leading-7">하네스 품질 · 실행 품질 · Trace 활용, 3가지 기준으로 이번 풀이에서 무엇이 좋았고 무엇을 보완해야 하는지 수치로 확인합니다.</p>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent" />
            </div>

          </div>
        </div>
      </section>

      {/* ────────────────── WORKFLOW (Interactive step selector) ────────────────── */}
      <section
        ref={setSectionRef("workflow")}
        data-section="workflow"
        id="workflow"
        className="relative min-h-screen bg-[#EEF2FF] flex flex-col justify-center py-16 overflow-hidden"
      >
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-full overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.04]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 w-full">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-5xl font-display font-bold text-gray-900 tracking-tight mb-3">
              하네스 과제 시작부터
              <br />
              <span
                className="bg-gradient-animate"
                style={{
                  backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED, #14B8A6, #4F46E5)",
                  backgroundSize: "200% 200%",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  color: "transparent"
                }}
              >
                리포트까지 한 흐름으로
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-8 items-stretch">
            {/* Left — steps + terminal */}
            <div className="flex flex-col gap-3">
              {WORKFLOW.map((w, i) => {
                const active = i === activeStep;
                return (
                  <button
                    key={w.step}
                    type="button"
                    onClick={() => goToStep(i)}
                    className={`group w-full text-left flex items-center gap-4 px-5 py-2 rounded-2xl border transition-all cursor-pointer ${
                      active
                        ? "bg-white border-indigo-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_12px_28px_-16px_rgba(79,70,229,0.25)] -translate-y-0.5"
                        : "bg-white/80 border-gray-200/80 hover:bg-white hover:border-indigo-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04)]"
                    }`}
                  >
                    <span
                      className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center font-display font-bold text-sm transition-colors ${
                        active ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500 group-hover:bg-gray-200"
                      }`}
                    >
                      {w.step}
                    </span>
                    <span
                      className={`flex-1 font-semibold transition-colors ${
                        active ? "text-gray-900" : "text-gray-500 group-hover:text-gray-700"
                      }`}
                    >
                      {w.label}
                    </span>
                    {active && (
                      <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">
                        {w.tag}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Terminal card */}
              <div className="mt-1 rounded-2xl overflow-hidden border border-indigo-300/20 bg-indigo-950/80 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(165,180,252,0.15),inset_0_0_0_1px_rgba(165,180,252,0.06),0_12px_40px_rgba(49,46,129,0.35)]">
                <div className="flex items-center justify-between px-4 py-1.5 bg-indigo-950/40 border-b border-indigo-300/10">
                  <span className="text-[11px] font-mono text-indigo-200/70">aig-terminal</span>
                  <div className="flex items-center gap-1.5">
                    <Minus size={10} className="text-indigo-200/40" strokeWidth={3} />
                    <Square size={8} className="text-indigo-200/40" strokeWidth={3} />
                    <X size={10} className="text-indigo-200/40" strokeWidth={3} />
                  </div>
                </div>
                <div className="px-4 py-2 font-mono text-[13px] leading-6">
                  <div className="text-indigo-200/80">
                    <span className="text-teal-300">user@aig</span>
                    <span className="text-indigo-200/50">:</span>
                    <span className="text-indigo-300">~/workspace</span>
                    <span className="text-indigo-200/50">$ </span>
                  </div>
                  <div
                    className={`text-white font-medium transition-opacity duration-200 ${
                      transitioning ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    {step.cmd}
                  </div>
                  <div
                    className={`mt-2 text-xs text-indigo-200/70 leading-relaxed transition-opacity duration-200 ${
                      transitioning ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    {step.desc}
                  </div>
                </div>
              </div>
            </div>

            {/* Right — screenshot + progress dots */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 px-1 shrink-0">
                {WORKFLOW.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goToStep(i)}
                    aria-label={`단계 ${i + 1}로 이동`}
                    className={`flex-1 h-1.5 rounded-full transition-all cursor-pointer ${
                      i === activeStep
                        ? "bg-indigo-500"
                        : i < activeStep
                          ? "bg-indigo-300"
                          : "bg-gray-200 hover:bg-gray-300"
                    }`}
                  />
                ))}
              </div>
              <div className="relative flex-1 rounded-3xl border border-gray-200/80 bg-white p-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04),0_12px_28px_-16px_rgba(79,70,229,0.18)]">
                <div className="absolute -inset-10 -z-10 bg-gradient-to-br from-indigo-200/40 via-violet-200/30 to-teal-200/30 blur-3xl rounded-full" />
                <div className="relative h-full rounded-2xl overflow-hidden bg-gray-100">
                  <Image
                    src={step.img}
                    alt={step.alt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    className={`object-cover object-top transition-opacity duration-300 ${
                      transitioning ? "opacity-0" : "opacity-100"
                    }`}
                    priority={activeStep === 0}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────── IDE LIVE DEMO ────────────────── */}
      <section
        ref={setSectionRef("demo")}
        data-section="demo"
        id="demo"
        className="relative min-h-screen bg-[#2d2d44] text-white overflow-hidden flex flex-col justify-center py-16"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.1]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 w-full">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight mb-3">
              하네스 과제를 실제로 풀어보면
            </h2>
            <p className="text-base md:text-lg text-indigo-200/80 max-w-2xl mx-auto">
              IDE에서 문제를 파악하고, 에이전트에게 질문을 보내고, 수정 근거와 diff를 확인하는 흐름을 미리 체험하세요.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-5 items-stretch">
            {/* Left — IDE window mock */}
            <div className="relative rounded-2xl overflow-hidden border border-[#2a2a2a] bg-[#0d0d0d] shadow-[0_8px_40px_rgba(0,0,0,0.7)]">
              <div className="flex items-center justify-between px-3 py-2 bg-[#1a1a1a] border-b border-[#2a2a2a]">
                <span className="text-[11px] font-mono text-gray-500 truncate">/ide/session-e89y3kqx-mo6u209l</span>
                <div className="flex items-center">
                  <span className="flex items-center justify-center w-8 h-6 hover:bg-white/10 transition-colors cursor-default text-gray-400 hover:text-white text-xs">─</span>
                  <span className="flex items-center justify-center w-8 h-6 hover:bg-white/10 transition-colors cursor-default text-gray-400 hover:text-white text-xs">□</span>
                  <span className="flex items-center justify-center w-8 h-6 hover:bg-red-500 transition-colors cursor-default text-gray-400 hover:text-white text-xs rounded-tr-xl">✕</span>
                </div>
              </div>
              <div className="relative aspect-[16/10]">
                <Image
                  src="/problemsSession.png"
                  alt="실무 과제 풀이 세션"
                  fill
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover"
                />
                {/* Code focus overlay */}
                <div
                  className={`absolute left-[32%] top-[42%] w-[28%] h-[12%] rounded-lg border-2 border-indigo-400/70 bg-indigo-500/10 transition-all duration-500 ${
                    ideStep >= 0 ? "opacity-100" : "opacity-0"
                  }`}
                />
                {/* Cursor tooltip */}
                <div
                  className={`absolute left-[58%] top-[48%] transition-all duration-500 ${
                    ideStep <= 1 ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-600 text-white text-[11px] font-semibold shadow-lg shadow-indigo-900/50 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    드래그 후 질문
                  </div>
                </div>
                {/* Mini diff card */}
                <div
                  className={`absolute right-3 bottom-3 w-[40%] rounded-xl border border-[#2a2a2a] bg-[#111111] shadow-xl transition-all duration-500 ${
                    ideStep >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                >
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10">
                    <span className="text-[10px] font-semibold text-white">변경 제안 미리보기</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200 border border-amber-400/30">
                      Diff
                    </span>
                  </div>
                  <div className="relative aspect-[16/9]">
                    <Image
                      src="/problemsDIFF.png"
                      alt="코드 diff"
                      fill
                      sizes="260px"
                      className="object-cover"
                      priority
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right — Agent panel */}
            <div className="rounded-2xl overflow-hidden border border-[#2a2a2a] bg-[#0d0d0d] shadow-[0_8px_40px_rgba(0,0,0,0.7)] flex flex-col">
              <div className="flex items-start justify-between gap-3 px-4 py-3 bg-[#1a1a1a] border-b border-[#2a2a2a]">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-300 mb-1">Agent Mode</p>
                  <h3 className="text-[15px] font-bold text-white">선택한 코드에 대해 바로 묻기</h3>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-pulse" />
                  {ideStepData.label}
                </span>
              </div>

              <div className="flex-1 min-h-0 px-4 py-4 space-y-3">
                {/* User message */}
                <div className="space-y-1">
                  <span className="inline-block text-[10px] font-mono text-indigo-300/80 uppercase tracking-wider">질문</span>
                  <div className="rounded-xl rounded-tl-sm px-3 py-2 bg-[#2a2a3a] border border-[#3a3a4a] text-sm text-gray-200 leading-relaxed">
                    {ideStepData.question}
                  </div>
                </div>

                {/* Agent message */}
                <div
                  className={`space-y-1 transition-all duration-300 ${
                    ideStep < 2 ? "opacity-0 -translate-y-2 pointer-events-none" : "opacity-100"
                  }`}
                >
                  <span className="inline-block text-[10px] font-mono text-teal-300/80 uppercase tracking-wider">에이전트</span>
                  <div className="rounded-xl rounded-tl-sm px-3 py-2 bg-[#1e2a1e] border border-[#2a3a2a] text-sm text-green-400 leading-relaxed font-mono">
                    {ideStep === 2 ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-300 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    ) : (
                      ideStepData.answer
                    )}
                  </div>
                </div>

                {/* Note */}
                <div
                  className={`flex items-start gap-2 p-3 rounded-xl bg-amber-400/10 border border-amber-400/20 transition-all duration-300 ${
                    ideStep < 3 ? "opacity-0 -translate-y-2 pointer-events-none" : "opacity-100"
                  }`}
                >
                  <Sparkles size={14} className="shrink-0 mt-0.5 text-amber-300" />
                  <div className="text-xs leading-relaxed">
                    <strong className="text-amber-200 font-semibold">수정 제안</strong>{" "}
                    <span className="text-indigo-200/80">
                      오른쪽 답변과 함께 diff 미리보기가 열려 바로 적용 여부를 판단할 수 있습니다.
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-4 py-2 border-t border-[#2a2a2a] font-mono text-[11px] text-gray-500 flex items-center flex-wrap gap-x-1 bg-[#111]">
                <span className="text-green-500">agent@aig</span>
                <span className="text-gray-600">:</span>
                <span className="text-blue-400">~/selection</span>
                <span className="text-gray-600">$ </span>
                <span className="text-gray-300">{ideStepData.status}</span>
                <span style={{ opacity: ideCursor ? 1 : 0 }} className="ml-0.5 text-gray-300">▌</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────── REPORT TEASER ────────────────── */}
      <section
        ref={setSectionRef("reports")}
        data-section="reports"
        id="reports"
        className="relative min-h-screen bg-[#EEF2FF] overflow-hidden flex flex-col justify-center py-20"
      >
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-full overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.04]" />
        </div>
        <div className="max-w-6xl mx-auto px-6 w-full relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="animate-slide-up">
              <h2 className="text-4xl md:text-5xl font-display font-bold text-gray-900 tracking-tight leading-tight mb-6">
                하네스 풀이를
                <br />
                <span
                  style={{
                    backgroundImage: "linear-gradient(90deg, #0D9488, #4F46E5)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    color: "transparent"
                  }}
                >
                  근거로 설명할 수 있게
                </span>
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed mb-8">
                하네스 품질 · 실행 품질 · Trace 활용, 3가지 기준의 정량 분석과 함께
                어떤 수정이 왜 이루어졌는지 구체적인 사례로 확인합니다.
              </p>
              <Link
                href="/signup"
                className="inline-flex items-center space-x-2 text-white font-semibold px-6 py-3 rounded-full transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 cursor-pointer"
                style={{
                  backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED)",
                  boxShadow: "0 10px 25px -8px rgba(99, 102, 241, 0.5)"
                }}
              >
                <span>리포트 체험하기</span>
                <ArrowRight size={16} strokeWidth={2.4} />
              </Link>
            </div>

            {/* Mock score card */}
            <div className="relative animate-scale-in">
              <div className="absolute -inset-4 bg-gradient-to-br from-indigo-200/20 via-violet-200/20 to-teal-200/20 blur-2xl rounded-full pointer-events-none" />
              <div className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-white p-8 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04),0_12px_28px_-16px_rgba(79,70,229,0.18)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-indigo-50/40 to-transparent" />

                <div className="relative flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <div className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-indigo-500">
                      AI Utilization Score
                    </div>
                    <h3 className="font-display text-2xl font-bold tracking-tight text-gray-950">
                      종합 점수
                    </h3>
                    <p className="mt-2 max-w-[260px] text-sm leading-6 text-gray-500">
                      설계, 실행, Trace 활용을 합산한 AI 협업 역량 지표입니다.
                    </p>
                  </div>

                  <div className="relative shrink-0">
                    <div
                      className="flex h-32 w-32 items-center justify-center rounded-full p-2 shadow-[0_18px_40px_-22px_rgba(79,70,229,0.65)]"
                      style={{ background: "conic-gradient(from 220deg, #4F46E5 0deg 295deg, #E5E7EB 295deg 360deg)" }}
                    >
                      <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white">
                        <span className="font-display text-4xl font-bold leading-none text-gray-950">82</span>
                        <span className="mt-1 text-xs font-semibold text-gray-400">/100</span>
                      </div>
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700 ring-1 ring-teal-100">
                      상위 27%
                    </div>
                  </div>
                </div>

                <div className="relative mt-8 grid grid-cols-3 gap-2">
                  {[
                    { label: "등급", value: "A-" },
                    { label: "강점", value: "Trace" },
                    { label: "개선", value: "+8점" }
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3 text-center">
                      <div className="text-[11px] font-semibold text-gray-400">{item.label}</div>
                      <div className="mt-1 font-display text-lg font-bold text-gray-900">{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="relative mt-6 space-y-4 border-t border-gray-100 pt-5">
                  {[
                    { label: "하네스 품질", score: 85, note: "요구사항 분해 우수", bar: "linear-gradient(90deg, #6366F1, #4F46E5)" },
                    { label: "실행 품질", score: 78, note: "예외 처리 보강 필요", bar: "linear-gradient(90deg, #8B5CF6, #7C3AED)" },
                    { label: "Trace 활용", score: 84, note: "근거 기록 안정적", bar: "linear-gradient(90deg, #14B8A6, #0D9488)" }
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div>
                          <span className="text-sm font-semibold text-gray-800">{item.label}</span>
                          <span className="ml-2 text-xs text-gray-400">{item.note}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-950">{item.score}</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${item.score}%`,
                            backgroundImage: item.bar
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="relative mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                  <div className="text-sm font-bold text-indigo-900">다음 추천 액션</div>
                  <p className="mt-1 text-sm leading-6 text-indigo-900/70">
                    Agent Mode에서 테스트 실패 원인과 수정 근거를 함께 남기면 실행 품질 점수를 더 끌어올릴 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────── CTA + FOOTER ────────────────── */}
      <section
        ref={setSectionRef("cta")}
        data-section="cta"
        id="cta"
        className="relative min-h-screen bg-[#0F0F2E] text-white overflow-hidden flex flex-col"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.15]" />
        </div>

        <div className="relative flex-1 flex flex-col justify-center max-w-3xl mx-auto px-6 text-center w-full">
          <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-6 leading-tight">
            AI 시대의 개발자 역량,
            <br />
            <span
              className="bg-gradient-animate"
              style={{
                backgroundImage: "linear-gradient(90deg, #A5B4FC, #99F6E4, #C4B5FD, #A5B4FC)",
                backgroundSize: "200% 200%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                color: "transparent"
              }}
            >
              지금 증명하세요
            </span>
          </h2>
          <p className="text-lg text-indigo-200/80 mb-10 leading-relaxed">
            로그인 후 과제를 선택하고 AI와 함께 풀어보세요.
          </p>
          <div className="flex justify-center">
            <Link
              href="/problems"
              className="inline-flex items-center space-x-2 bg-white text-indigo-900 hover:bg-indigo-50 font-semibold px-8 py-4 rounded-full transition-all shadow-2xl hover:-translate-y-0.5 cursor-pointer"
            >
              <span>문제 보기</span>
              <ArrowRight size={16} strokeWidth={2.4} />
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="relative bg-[#0A0A20] text-indigo-200/80 py-10 border-t border-white/10">
          <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-6">
            <div>
              <Link href="/" className="inline-flex items-center space-x-2 text-white font-display font-bold text-lg mb-2 cursor-pointer">
                <Image src="/brand/favicon.png" alt="AIG" width={24} height={24} className="rounded-md object-cover" />
                <span>AIG</span>
              </Link>
              <p className="text-xs text-indigo-200/60 max-w-md leading-relaxed">
                AI-Based Integrated Ground · SSAFY 14기 D103 자율 프로젝트
              </p>
            </div>
            <div className="grid grid-cols-3 gap-8 text-xs">
              <div>
                <h4 className="text-white font-semibold mb-2 uppercase tracking-wider">Product</h4>
                <ul className="space-y-1.5 list-none pl-0 m-0">
                  <li><a href="#features" onClick={handleAnchorJump("features")} className="hover:text-white transition-colors cursor-pointer">기능</a></li>
                  <li><a href="#workflow" onClick={handleAnchorJump("workflow")} className="hover:text-white transition-colors cursor-pointer">워크플로</a></li>
                  <li><a href="#reports" onClick={handleAnchorJump("reports")} className="hover:text-white transition-colors cursor-pointer">리포트</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-2 uppercase tracking-wider">Start</h4>
                <ul className="space-y-1.5 list-none pl-0 m-0">
                  <li><Link href="/login" className="hover:text-white transition-colors cursor-pointer">로그인</Link></li>
                  <li><Link href="/signup" className="hover:text-white transition-colors cursor-pointer">회원가입</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-2 uppercase tracking-wider">Team</h4>
                <ul className="space-y-1.5 list-none pl-0 m-0">
                  <li>D103 띠링띠링</li>
                  <li className="text-indigo-200/50">SSAFY 14기</li>
                  <li>
                    <Link href="/terms" className="hover:text-white transition-colors cursor-pointer">
                      이용약관
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="max-w-6xl mx-auto px-6 mt-6 pt-4 border-t border-white/5 flex flex-wrap justify-between text-[11px] text-indigo-200/40">
            <span>© 2026 AIG · D103 띠링띠링</span>
            <span>Design the agent. Master the harness.</span>
          </div>
        </footer>
      </section>
    </div>
  );
}
