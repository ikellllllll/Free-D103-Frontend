"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  PlayCircle,
  LogOut,
  Save,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

const SECTION_IDS = ["hero", "showcase", "features", "workflow", "reports", "cta"] as const;
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
    label: "AGENTS.md 작성",
    status: "Agent 설정 파일에 역할과 작업 규칙을 입력합니다.",
    question: "TodoService를 문제 요구사항에 맞게 구현하고 테스트까지 실행해줘",
    answer: "먼저 AGENTS.md의 규칙을 읽고 실행 계획, 코드 수정, 테스트, Diff 제출 순서로 진행할게요."
  },
  {
    label: "AGENT 빌드",
    status: "AI 보조 패널에서 Agent Build를 실행합니다.",
    question: "TodoService를 문제 요구사항에 맞게 구현하고 테스트까지 실행해줘",
    answer: "Agent Build가 완료되면 .worktree에서 변경을 만들고 Trace를 남길 수 있습니다."
  },
  {
    label: "명령 입력",
    status: "빌드된 Agent에게 문제 해결 명령을 전달합니다.",
    question: "TodoService를 문제 요구사항에 맞게 구현하고 테스트까지 실행해줘",
    answer: "명령을 받았습니다. 실행 계획을 만들고 변경 범위를 좁히겠습니다."
  },
  {
    label: "계획 수립",
    status: "Agent가 실행 계획을 세우고 변경 범위를 고릅니다.",
    question: "TodoService를 문제 요구사항에 맞게 구현하고 테스트까지 실행해줘",
    answer: "TodoService 구현, Controller 연동 확인, 테스트 실행, Diff 제출 순서로 진행합니다."
  },
  {
    label: "실행",
    status: "Agent가 .worktree에서 파일을 수정하고 테스트합니다.",
    question: "TodoService를 문제 요구사항에 맞게 구현하고 테스트까지 실행해줘",
    answer: ".worktree/TodoService.java를 수정하고 ./gradlew test를 실행하고 있습니다."
  },
  {
    label: "결과 확인",
    status: "Diff와 Trace에서 실행 결과를 확인합니다.",
    question: "TodoService를 문제 요구사항에 맞게 구현하고 테스트까지 실행해줘",
    answer: "패치를 만들었습니다. Diff 탭에서 적용 전 변경 사항을 검토하고 Trace에서 작업 근거를 확인하세요."
  }
];

const SHOWCASE_STATS = [
  { value: "5종", label: "하네스 과제" },
  { value: "AI", label: "에이전트 협업" },
  { value: "3개", label: "평가 지표" },
  { value: "14기", label: "SSAFY" }
];

const REPORT_AXES = [
  { label: "목표", fullLabel: "목표 명확도", score: 86, color: "#4F46E5", softColor: "#EEF2FF", textColor: "#3730A3" },
  { label: "흐름", fullLabel: "작업 흐름 설계도", score: 56, color: "#8B5CF6", softColor: "#F5F3FF", textColor: "#6D28D9" },
  { label: "정보", fullLabel: "정보 제공 적절도", score: 88, color: "#0D9488", softColor: "#CCFBF1", textColor: "#0F766E" },
  { label: "스킬", fullLabel: "스킬 구성도", score: 52, color: "#2563EB", softColor: "#DBEAFE", textColor: "#1D4ED8" },
  { label: "검증", fullLabel: "검증 루프 설계도", score: 86, color: "#DB2777", softColor: "#FCE7F3", textColor: "#BE185D" }
];

const HERO_IDE_PREVIEW_WIDTH = 1440;
const HERO_IDE_PREVIEW_HEIGHT = 810;
const AGENT_COMMAND = "TodoService를 문제 요구사항에 맞게 구현하고 테스트까지 실행해줘";
const AGENTS_MD_TEMPLATE = `# AGENTS.md

## 역할
너는 Todo API 문제를 해결하는 Java 백엔드 Agent다.

## 작업 규칙
- 변경은 .worktree 안에서만 만든다.
- 먼저 실행 계획을 짧게 작성한다.
- Service, Controller, 테스트 결과를 Trace에 남긴다.
- 완료 후 Diff에서 적용/거절할 수 있게 패치를 제출한다.

## 검증
./gradlew test`;

const AGENT_PLAN_LINES = [
  "TodoService의 CRUD 요구사항과 예외 흐름 확인",
  "TodoController 응답 DTO와 상태 코드 연결",
  "Gradle 테스트 실행 후 실패 로그를 Trace에 기록",
  "완성 패치를 Diff 탭으로 제출"
];

function HeroIdePreviewMock({ step }: { step: number }) {
  const [activeActivity, setActiveActivity] = useState(1);
  const [agentOpen, setAgentOpen] = useState(true);
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const [aiMode, setAiMode] = useState<"chat" | "agent">("chat");
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const previewStep = step % IDE_STEPS.length;
  const currentPreview = IDE_STEPS[previewStep];
  const guidedActivity = previewStep >= 1 ? 6 : activeActivity;
  const effectiveAiMode = previewStep >= 1 ? "agent" : aiMode;
  const activeEditorFile = previewStep >= 4 ? "TodoService.java" : "AGENTS.md";
  const showDiff = previewStep >= 5;
  const [typedAgentsCount, setTypedAgentsCount] = useState(0);
  const [typedCommandCount, setTypedCommandCount] = useState(0);

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
    ["", "codicon-symbol-class", "TodoController.java", 7, ""],
    ["codicon-chevron-down", "codicon-folder-opened", "service", 6, ""],
    ["", "codicon-symbol-class", "TodoService.java", 7, previewStep >= 4 ? "AI" : ""]
  ] as const;

  const linePulse = previewStep >= 2;
  const typedAgentsText = AGENTS_MD_TEMPLATE.slice(0, typedAgentsCount);
  const typedCommand = AGENT_COMMAND.slice(0, typedCommandCount);

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
    if (previewStep !== 0) {
      setTypedAgentsCount(AGENTS_MD_TEMPLATE.length);
      return;
    }

    setTypedAgentsCount(0);
    const tick = window.setInterval(() => {
      setTypedAgentsCount((count) => Math.min(AGENTS_MD_TEMPLATE.length, count + 7));
    }, 34);

    return () => window.clearInterval(tick);
  }, [previewStep]);

  useEffect(() => {
    if (previewStep !== 2) {
      setTypedCommandCount(previewStep > 2 ? AGENT_COMMAND.length : 0);
      return;
    }

    setTypedCommandCount(0);
    const tick = window.setInterval(() => {
      setTypedCommandCount((count) => Math.min(AGENT_COMMAND.length, count + 2));
    }, 48);

    return () => window.clearInterval(tick);
  }, [previewStep]);

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
                className={index === guidedActivity ? "activity-bar__item activity-bar__item--active" : "activity-bar__item"}
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
                {agentFiles.map((item) => renderPreviewTreeItem(item, activeEditorFile))}
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
              {workspaceFiles.map((item) => renderPreviewTreeItem(item, activeEditorFile))}
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
                          {showDiff ? (
                            <span className="file-icon file-icon--tab codicon codicon-diff" data-file-kind="git" aria-hidden="true" />
                          ) : (
                            <span className="file-icon file-icon--tab codicon codicon-book" data-file-kind={activeEditorFile.endsWith(".java") ? "java" : "docs"} aria-hidden="true" />
                          )}
                          <span>{showDiff ? "TodoService.java diff" : activeEditorFile}</span>
                        </button>
                        <button type="button" className="editor-tabs__close" aria-label={`${activeEditorFile} 닫기`}>
                          ×
                        </button>
                      </div>
                      <div className="editor-tabs__item">
                        <button type="button" className="editor-tabs__select">
                          <span className="file-icon file-icon--tab codicon codicon-book" data-file-kind="docs" aria-hidden="true" />
                          <span>README.md</span>
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
                  {showDiff ? (
                    <div className="diff-pane landing-diff-preview landing-diff-preview--ide">
                      <div className="diff-pane__actions">
                        <div className="diff-pane__label">
                          <span className="codicon codicon-diff" aria-hidden />
                          <span>AI 워크트리 수정 제안 — 적용 시 원본 파일이 덮어써집니다</span>
                        </div>
                        <div className="diff-pane__buttons">
                          <button type="button" className="button button--ghost button--tiny">거절</button>
                          <button type="button" className="button button--primary button--tiny">적용</button>
                        </div>
                      </div>
                      <div className="landing-monaco-diff monaco-diff-editor" aria-label="TodoService.java 원본과 Agent 변경 diff 미리보기">
                        <div className="landing-monaco-diff__columns">
                          <section className="landing-monaco-diff__column">
                            <div className="landing-monaco-diff__column-head">
                              <span className="codicon codicon-file-code" aria-hidden />
                              <strong>원본</strong>
                              <span>src/TodoService.java</span>
                            </div>
                            <div className="landing-monaco-diff__editor">
                              {[
                                { no: 41, kind: "same", sign: "", text: "public Todo create(CreateTodoRequest request) {" },
                                { no: 42, kind: "removed", sign: "-", text: "  return null;" },
                                { no: 43, kind: "same", sign: "", text: "}" },
                                { no: 44, kind: "same", sign: "", text: "" },
                                { no: 45, kind: "same", sign: "", text: "public List<Todo> findAll() {" },
                                { no: 46, kind: "removed", sign: "-", text: "  return List.of();" },
                                { no: 47, kind: "same", sign: "", text: "}" }
                              ].map((line) => (
                                <div key={`original-${line.no}-${line.kind}`} className={`landing-monaco-diff__line landing-monaco-diff__line--${line.kind}`}>
                                  <span className="landing-monaco-diff__no">{line.no}</span>
                                  <span className="landing-monaco-diff__sign">{line.sign}</span>
                                  <code>{line.text}</code>
                                </div>
                              ))}
                            </div>
                          </section>
                          <section className="landing-monaco-diff__column landing-monaco-diff__column--modified">
                            <div className="landing-monaco-diff__column-head">
                              <span className="codicon codicon-git-pull-request" aria-hidden />
                              <strong>Agent</strong>
                              <span>.worktree/src/TodoService.java</span>
                            </div>
                            <div className="landing-monaco-diff__editor">
                              {[
                                { no: 41, kind: "same", sign: "", text: "public Todo create(CreateTodoRequest request) {" },
                                { no: 42, kind: "added", sign: "+", text: "  Todo todo = Todo.create(request.title());" },
                                { no: 43, kind: "added", sign: "+", text: "  return repository.save(todo);" },
                                { no: 44, kind: "same", sign: "", text: "}" },
                                { no: 45, kind: "same", sign: "", text: "public List<Todo> findAll() {" },
                                { no: 46, kind: "added", sign: "+", text: "  return repository.findAllByOrderByIdAsc();" },
                                { no: 47, kind: "same", sign: "", text: "}" }
                              ].map((line) => (
                                <div key={`modified-${line.no}-${line.kind}`} className={`landing-monaco-diff__line landing-monaco-diff__line--${line.kind}`}>
                                  <span className="landing-monaco-diff__no">{line.no}</span>
                                  <span className="landing-monaco-diff__sign">{line.sign}</span>
                                  <code>{line.text}</code>
                                </div>
                              ))}
                            </div>
                          </section>
                          <div className="landing-monaco-diff__ruler" aria-hidden="true">
                            <span className="landing-monaco-diff__ruler-mark landing-monaco-diff__ruler-mark--removed" />
                            <span className="landing-monaco-diff__ruler-mark landing-monaco-diff__ruler-mark--added" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : activeEditorFile === "AGENTS.md" ? (
                    <div className="landing-code-editor landing-code-editor--agents">
                      <div className="landing-code-editor__banner">
                        <strong>{currentPreview.label}</strong>
                        <span>{currentPreview.status}</span>
                      </div>
                      <pre className={linePulse ? "landing-ide-preview__pulse" : undefined}>
                        <code>{typedAgentsText}</code>
                        {previewStep === 0 ? <span className="landing-code-editor__caret" aria-hidden="true" /> : null}
                      </pre>
                    </div>
                  ) : (
                    <div className="landing-code-editor landing-code-editor--java">
                      <div className="landing-code-editor__banner">
                        <strong>TodoService.java</strong>
                        <span>Agent가 .worktree에서 구현 중</span>
                      </div>
                      {[
                        "package com.aig.todo.todo.service;",
                        "",
                        "public class TodoService {",
                        "  public Todo create(CreateTodoRequest request) {",
                        "    Todo todo = Todo.create(request.title());",
                        "    return repository.save(todo);",
                        "  }",
                        "",
                        "  public Todo complete(Long id) {",
                        "    Todo todo = findById(id);",
                        "    todo.complete();",
                        "    return repository.save(todo);",
                        "  }",
                        "}"
                      ].map((line, index) => (
                        <div key={`${line}-${index}`} className={`landing-code-editor__line ${index >= 4 && index <= 11 ? "landing-code-editor__line--added" : ""}`}>
                          <span className="landing-code-editor__no">{index + 1}</span>
                          <code>{line}</code>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="pane-resizer pane-resizer--horizontal" aria-hidden="true" />
            <section className="bottom-panel landing-ide-preview__bottom-panel" style={{ height: 220 }}>
              <div className="bottom-panel__tabs">
                <div className="bottom-panel__tab-list">
                  <button type="button" className={`bottom-panel__tab ${previewStep < 4 ? "bottom-panel__tab--active" : ""}`}>출력 <small>{previewStep < 4 ? "ready" : "done"}</small></button>
                  <button type="button" className="bottom-panel__tab">테스트 <small>{previewStep >= 4 ? "passed" : "idle"}</small></button>
                  <button type="button" className={`bottom-panel__tab ${showDiff ? "bottom-panel__tab--active" : ""}`}>Diff <small>{showDiff ? "4" : "idle"}</small></button>
                  <button type="button" className={`bottom-panel__tab ${previewStep >= 4 && !showDiff ? "bottom-panel__tab--active" : ""}`}>Trace <small>{previewStep >= 4 ? "6" : "0"}</small></button>
                </div>
              </div>

              <div className="bottom-panel__body">
                {showDiff ? (
                  <div className="landing-result-strip">
                    <div className="mini-panel mini-panel--flat">
                      <strong>Diff</strong>
                      <p>TodoService.java 수정 1개 파일, 추가 8줄</p>
                    </div>
                    <div className="mini-panel mini-panel--flat">
                      <strong>Trace</strong>
                      <p>plan → edit → test → diff 제출 완료</p>
                    </div>
                    <div className="mini-panel mini-panel--flat mini-panel--success">
                      <strong>./gradlew test</strong>
                      <p>BUILD SUCCESSFUL in 4s</p>
                    </div>
                  </div>
                ) : previewStep >= 4 ? (
                  <div className="landing-trace-list">
                    {[
                      ["plan", "TodoService 변경 범위 확정"],
                      ["read", "README.md, TodoController.java 참조"],
                      ["edit", ".worktree/TodoService.java 패치 작성"],
                      ["test", "./gradlew test 실행 중"]
                    ].map(([kind, text], index) => (
                      <div key={kind} className={`landing-trace-list__item ${index === 3 ? "landing-trace-list__item--active" : ""}`}>
                        <span>{kind}</span>
                        <p>{text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="landing-ide-preview__mini-grid">
                      {["stdout\nAgent 명령을 기다리는 중입니다.", "stderr\n에러 출력 없음"].map((text) => {
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
                      <span className="font-black">{currentPreview.label}</span>
                      <span className="muted-copy">{currentPreview.status}</span>
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>

          <div className="status-bar">
            <div className="status-bar__group"><span>main</span><span>{activeEditorFile.endsWith(".java") ? "JAVA" : "MARKDOWN"}</span><span>UTF-8</span><span>LF</span><span>{activeEditorFile === "AGENTS.md" ? "15" : "68"} lines</span></div>
            <div className="status-bar__group"><span>{previewStep === 0 ? "미저장 1개" : "저장됨"}</span><span>Ln 7, Col 18</span><span>AIG Agent</span><span>{showDiff ? "DIFF" : "OUTPUT"}</span></div>
          </div>
        </main>

        <div className="pane-resizer pane-resizer--vertical" aria-hidden="true" />

        <aside className="ide-shell__ai landing-ide-preview__ai">
          <div className="sidebar-header">
            <div>
              <span className="panel-title panel-title--compact">AIG Assistant</span>
              <div className="assistant-header__title">
                <strong>AI 보조 패널</strong>
                <span className="ai-context-chip assistant-version-chip">{previewStep >= 2 ? "v0.2" : "v0.1"}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAiMode("agent")}
              className={`button button--primary button--tiny assistant-build-button landing-agent-build-button ${previewStep === 1 ? "landing-agent-build-button--running" : ""}`}
            >
              {previewStep === 1 ? "Building" : previewStep >= 2 ? "Built" : "Agent Build"}
            </button>
          </div>

          <div className="ai-panel ai-panel--chat">
            <div className="ai-panel__head">
              <div className="ai-tabs">
                <button
                  type="button"
                  onClick={() => setAiMode("chat")}
                  className={`chip ${effectiveAiMode === "chat" ? "chip--active" : ""}`}
                >
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => setAiMode("agent")}
                  className={`chip ${effectiveAiMode === "agent" ? "chip--active" : ""}`}
                >
                  Agent
                </button>
              </div>
              <div className="ai-context-strip">
                {["AGENTS.md", previewStep >= 2 ? "Build OK" : "선택 없음", "GPT-5 Mini"].map((tag) => (
                  <span key={tag} className="ai-context-chip">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="chat-stack chat-stack--panel">
              {previewStep >= 2 ? (
                <div className="chat-bubble chat-bubble--user">
                  <div className="chat-bubble__plain">
                    {typedCommand}
                    {previewStep === 2 ? <span className="landing-code-editor__caret" aria-hidden="true" /> : null}
                  </div>
                </div>
              ) : null}

              <div className={`chat-bubble ${previewStep >= 1 ? "landing-ide-preview__pulse" : ""}`}>
                <div className="chat-bubble__markdown">
                  {previewStep === 0 ? (
                    <>
                      <p>AGENTS.md를 작성하면 Agent가 어떤 파일을 수정하고 어떤 검증을 해야 하는지 기억합니다.</p>
                      <p>저장 후 Agent Build를 눌러 실행 환경을 준비하세요.</p>
                    </>
                  ) : previewStep === 1 ? (
                    <div className="landing-build-card">
                      <strong>Agent Build</strong>
                      <span>AGENTS.md 파싱</span>
                      <span>runtimeConfig 생성</span>
                      <span>검증 오류 없음</span>
                      <div className="landing-build-card__bar" aria-hidden="true">
                        <span />
                      </div>
                    </div>
                  ) : previewStep === 2 ? (
                    <>
                      <p>명령을 받았습니다. 실행 계획을 만들고 .worktree에서 변경을 준비합니다.</p>
                    </>
                  ) : previewStep === 3 ? (
                    <>
                      <h3>실행 계획</h3>
                      <ol>
                        {AGENT_PLAN_LINES.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ol>
                    </>
                  ) : previewStep === 4 ? (
                    <>
                      <h3>실행 중</h3>
                      <ul>
                        <li>TodoService.java 수정</li>
                        <li>Controller 흐름 확인</li>
                        <li>./gradlew test 실행</li>
                      </ul>
                    </>
                  ) : (
                    <>
                      <p>패치를 만들었습니다. Diff 탭에서 변경 내용을 확인하고 Trace에서 작업 순서를 검토할 수 있습니다.</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="chat-input-row">
              <textarea
                className="input input--textarea"
                readOnly
                value={previewStep === 2 ? typedCommand : ""}
                placeholder={previewStep < 2 ? "Agent Build 후 명령을 입력하세요" : "빌드된 Agent에게 명령하세요"}
              />
              <button
                type="button"
                onClick={() => setAiMode((mode) => (mode === "chat" ? "agent" : "chat"))}
                className="button button--primary transition-transform active:scale-[0.98]"
              >
                {showDiff ? "Diff 열기" : previewStep >= 2 ? "실행" : "전송"}
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

function LandingScoreRadar() {
  const SIZE = 230;
  const CENTER = SIZE / 2;
  const MAX_RADIUS = 76;
  const N = REPORT_AXES.length;
  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const pointFor = (i: number, radius: number) => {
    const a = angleFor(i);
    return { x: CENTER + radius * Math.cos(a), y: CENTER + radius * Math.sin(a) };
  };
  const rings = [25, 50, 75, 100];
  const points = REPORT_AXES.map((axis, i) => {
    const p = pointFor(i, (axis.score / 100) * MAX_RADIUS);
    return `${p.x},${p.y}`;
  }).join(" ");

  return (
    <div className="grid gap-5 md:grid-cols-[230px_1fr] md:items-center">
      <div className="relative mx-auto h-[230px] w-[230px]">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="overflow-visible">
          <defs>
            <radialGradient id="landingRadarFill" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.5" />
              <stop offset="55%" stopColor="#60A5FA" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.22" />
            </radialGradient>
            <linearGradient id="landingRadarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4F46E5" />
              <stop offset="42%" stopColor="#8B5CF6" />
              <stop offset="72%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#DB2777" />
            </linearGradient>
          </defs>

          {rings.map((ring) => {
            const ringPoints = REPORT_AXES.map((_, i) => {
              const p = pointFor(i, (ring / 100) * MAX_RADIUS);
              return `${p.x},${p.y}`;
            }).join(" ");
            return (
              <polygon
                key={ring}
                points={ringPoints}
                fill={ring === 100 ? "#F8FAFC" : "none"}
                stroke="#E5E7EB"
                strokeWidth={1}
              />
            );
          })}

          {REPORT_AXES.map((_, i) => {
            const end = pointFor(i, MAX_RADIUS);
            return <line key={i} x1={CENTER} y1={CENTER} x2={end.x} y2={end.y} stroke="#E5E7EB" strokeWidth={1} />;
          })}

          <polygon points={points} fill="url(#landingRadarFill)" stroke="url(#landingRadarStroke)" strokeWidth={2.5} />
          {REPORT_AXES.map((axis, i) => {
            const p = pointFor(i, (axis.score / 100) * MAX_RADIUS);
            return (
              <g key={axis.label}>
                <circle cx={p.x} cy={p.y} r={5.5} fill="white" stroke={axis.color} strokeWidth={2.5} />
                <circle cx={p.x} cy={p.y} r={2.3} fill={axis.color} />
              </g>
            );
          })}

          {REPORT_AXES.map((axis, i) => {
            const label = pointFor(i, MAX_RADIUS + 21);
            const a = angleFor(i);
            const anchor = Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
            return (
              <text key={axis.fullLabel} x={label.x} y={label.y} textAnchor={anchor} dominantBaseline="middle" fill="#334155" fontSize="11" fontWeight="800">
                {axis.label}
              </text>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-white/90 px-3 py-2 text-center shadow-sm ring-1 ring-gray-100">
            <div className="font-display text-2xl font-black leading-none text-gray-950">84</div>
            <div className="text-[10px] font-bold text-gray-400">TOTAL</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {REPORT_AXES.map((axis) => (
          <div
            key={axis.fullLabel}
            className="relative overflow-hidden rounded-xl px-3 py-2 text-xs font-bold ring-1 ring-black/5"
            style={{ backgroundColor: axis.softColor, color: axis.textColor }}
          >
            <div
              className="absolute inset-y-0 left-0 opacity-20"
              style={{
                width: `${axis.score}%`,
                backgroundColor: axis.color
              }}
              aria-hidden="true"
            />
            <div className="relative flex items-center justify-between gap-3">
              <span className="truncate">{axis.fullLabel}</span>
              <span className="tabular-nums">{axis.score}</span>
            </div>
          </div>
        ))}
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
    reports: null,
    cta: null
  });
  const previewRef = useRef<HTMLDivElement | null>(null);

  // Workflow step selector
  const [activeStep, setActiveStep] = useState(0);
  const [displayStep, setDisplayStep] = useState(0);
  const [previousStep, setPreviousStep] = useState<number | null>(null);
  const step = WORKFLOW[activeStep];

  const startWorkflowTransition = useCallback((nextStep: number) => {
    setDisplayStep((current) => {
      if (nextStep === current) return current;
      setPreviousStep(current);
      window.setTimeout(() => setPreviousStep(null), 520);
      return nextStep;
    });
    setActiveStep(nextStep);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      startWorkflowTransition((activeStep + 1) % WORKFLOW.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [activeStep, startWorkflowTransition]);

  const goToStep = useCallback((i: number) => {
    startWorkflowTransition(i);
  }, [startWorkflowTransition]);

  // IDE live demo
  const [ideStep, setIdeStep] = useState(0);

  useEffect(() => {
    const t = window.setInterval(
      () => setIdeStep((p) => (p + 1) % IDE_STEPS.length),
      3200
    );
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
        className="relative min-h-screen bg-[#2d2d44] text-white flex flex-col justify-center py-16 overflow-hidden"
      >
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-full overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.1]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(99,102,241,0.18),transparent_54%)]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 w-full">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-5xl font-display font-bold text-white tracking-tight mb-3">
              하네스 과제 시작부터
              <br />
              <span
                className="bg-gradient-animate"
                style={{
                  backgroundImage: "linear-gradient(90deg, #A5B4FC, #C4B5FD, #5EEAD4, #A5B4FC)",
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

          <div className="mx-auto max-w-5xl">
            <div className="relative rounded-[28px] border border-white/[0.13] bg-white/[0.07] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_24px_56px_rgba(10,10,32,0.42)]">
              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
                {WORKFLOW.map((w, i) => (
                  <button
                    key={w.step}
                    type="button"
                    onClick={() => goToStep(i)}
                    aria-label={`${w.step} ${w.label}`}
                    className={`min-w-0 rounded-2xl border px-3 py-3 text-left backdrop-blur-2xl transition-all cursor-pointer ${
                      i === activeStep
                        ? "border-white/55 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.34),inset_0_-1px_0_rgba(255,255,255,0.08),0_18px_36px_-24px_rgba(255,255,255,0.55)]"
                        : "border-white/[0.2] bg-white/[0.015] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(255,255,255,0.04)] hover:border-sky-100/35 hover:bg-white/[0.03]"
                    }`}
                  >
                    <span className={`block font-mono text-[11px] font-black ${i === activeStep ? "text-white" : "text-indigo-100/[0.74]"}`}>
                      {w.step}
                    </span>
                    <span className={`mt-1 block truncate text-sm font-black ${i === activeStep ? "text-white" : "text-indigo-100/[0.74]"}`}>
                      {w.label}
                    </span>
                    <span
                      className={`mt-2 inline-flex max-w-full rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        i === activeStep
                          ? "border-white/40 bg-white/[0.045] text-white"
                          : "border-white/[0.16] bg-white/[0.018] text-indigo-100/[0.7]"
                      }`}
                    >
                      <span className="truncate">{w.tag}</span>
                    </span>
                  </button>
                ))}
              </div>

              <div
                className="relative overflow-hidden rounded-2xl border border-white/[0.18] bg-white/[0.025] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(255,255,255,0.05),0_18px_44px_-28px_rgba(125,211,252,0.45)] backdrop-blur-xl"
                style={{ aspectRatio: "1.88 / 1" }}
              >
                <div className="relative h-full w-full overflow-hidden rounded-[14px] bg-[#111124] ring-1 ring-white/[0.12]">
                  {WORKFLOW.map((item, index) => (
                    <Image
                      key={item.step}
                      src={item.img}
                      alt={item.alt}
                      fill
                      sizes="(max-width: 1024px) 100vw, 720px"
                      className={`landing-workflow-image object-contain object-center ${
                        index === displayStep
                          ? "landing-workflow-image--enter"
                          : index === previousStep
                            ? "landing-workflow-image--exit"
                            : "landing-workflow-image--hidden"
                      }`}
                      priority={index === 0}
                    />
                  ))}
                  <span key={`wipe-${displayStep}`} className="landing-workflow-image__wipe" aria-hidden="true" />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => goToStep((activeStep - 1 + WORKFLOW.length) % WORKFLOW.length)}
                  className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/12 bg-[#111124]/70 px-3 text-sm font-bold text-indigo-50 transition-colors hover:bg-white/[0.1]"
                >
                  <ChevronLeft size={16} strokeWidth={2.3} />
                  이전
                </button>
                <div className="min-w-0 px-3 text-center">
                  <div className="truncate text-sm font-black text-white">{step.label}</div>
                  <div className="mt-0.5 text-xs font-bold text-sky-100/85">{step.tag}</div>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep((activeStep + 1) % WORKFLOW.length)}
                  className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/12 bg-[#111124]/70 px-3 text-sm font-bold text-indigo-50 transition-colors hover:bg-white/[0.1]"
                >
                  다음
                  <ChevronRight size={16} strokeWidth={2.3} />
                </button>
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
                      Feedback Report
                    </div>
                    <h3 className="font-display text-2xl font-bold tracking-tight text-gray-950">
                      Todo CRUD API 구현 리포트
                    </h3>
                    <p className="mt-2 max-w-[260px] text-sm leading-6 text-gray-500">
                      문제 요구사항 파악, 하네스 구성, 검증 루프를 합산한 AI 협업 리포트입니다.
                    </p>
                  </div>

                  <div className="relative shrink-0">
                    <div
                      className="flex h-32 w-32 items-center justify-center rounded-full p-2 shadow-[0_18px_40px_-22px_rgba(79,70,229,0.65)]"
                      style={{ background: "conic-gradient(from 220deg, #4F46E5 0deg 302deg, #E5E7EB 302deg 360deg)" }}
                    >
                      <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white">
                        <span className="font-display text-4xl font-bold leading-none text-gray-950">84</span>
                        <span className="mt-1 text-xs font-semibold text-gray-400">/100</span>
                      </div>
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700 ring-1 ring-teal-100">
                      우수
                    </div>
                  </div>
                </div>

                <div className="relative mt-8 grid grid-cols-3 gap-2">
                  {[
                    { label: "등급", value: "B+" },
                    { label: "테스트", value: "8/10" },
                    { label: "Trace", value: "12 span" }
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3 text-center">
                      <div className="text-[11px] font-semibold text-gray-400">{item.label}</div>
                      <div className="mt-1 font-display text-lg font-bold text-gray-900">{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="relative mt-6 border-t border-gray-100 pt-5">
                  <LandingScoreRadar />
                </div>

                <div className="relative mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                  <div className="text-sm font-bold text-indigo-900">검증 루프 강화</div>
                  <p className="mt-1 text-sm leading-6 text-indigo-900/70">
                    수정 직후 테스트 실행 결과를 Trace에 함께 남기면 회귀 오류를 줄이고 리포트 품질을 높일 수 있습니다.
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
