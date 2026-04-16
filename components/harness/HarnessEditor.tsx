"use client";

import { useEffect, useRef, useState } from "react";

import { Card } from "@/components/common/Card";
import { useUiStore } from "@/store/uiStore";

/* ── Agent file definitions ─────────────────────────────────── */
interface AgentFile {
  id: string;
  label: string;
  path: string;
  tag: string;
  defaultContent: string;
}

const AGENT_FILES: AgentFile[] = [
  {
    id: "harness",
    label: "HARNESS.md",
    path: "agent/HARNESS.md",
    tag: "main",
    defaultContent: `# Harness

에이전트 실행 환경을 정의하는 파일입니다.

## 목적
- 에이전트가 풀이 세션에서 사용할 기본 지침을 담습니다.
- \`instuction.md\`와 함께 읽힙니다.

## 실행 규칙
- 코드 변경 전 반드시 테스트를 먼저 읽어라.
- 스택 트레이스 전체를 읽고 근본 원인을 파악해라.
- 한 번에 하나의 변경만 하고 결과를 확인해라.
`
  },
  {
    id: "instruction",
    label: "instuction.md",
    path: "agent/instuction.md",
    tag: "meta",
    defaultContent: `# Instruction

에이전트 행동 지침서입니다.

## 기본 원칙
1. 질문보다 먼저 파일을 읽어라.
2. 가정보다 검증을 우선해라.
3. 에러 메시지를 그대로 사용자에게 전달하지 마라.

## 코딩 규칙
- 한 함수에 하나의 책임만 부여한다.
- 명시적인 예외 처리를 작성한다.
- 테스트 가능한 구조를 유지한다.
`
  },
  {
    id: "sandbox",
    label: ".sandbox/README.md",
    path: "agent/.sandbox/README.md",
    tag: "temp",
    defaultContent: `# Sandbox

에이전트의 임시 작업 공간입니다.

## 용도
- 실험적 코드 스니펫을 임시 저장합니다.
- 풀이 도중 메모할 내용을 남깁니다.
- 세션 종료 시 초기화됩니다.

## 주의
이 파일의 내용은 세션 평가에 포함되지 않습니다.
`
  },
  {
    id: "skills",
    label: "skills/README.md",
    path: "agent/skills/README.md",
    tag: "meta",
    defaultContent: `# Skills

에이전트가 사용할 수 있는 스킬 목록입니다.

## 등록된 스킬
- \`read_file\` — 파일 내용을 읽습니다.
- \`write_file\` — 파일에 내용을 씁니다.
- \`run_tests\` — 테스트를 실행하고 결과를 반환합니다.
- \`search_code\` — 코드베이스에서 패턴을 검색합니다.

## 스킬 추가 방법
새 스킬 파일을 \`agent/skills/\` 디렉터리에 추가하고 이 목록을 갱신하세요.
`
  }
];

/* ── BYOK provider definitions ──────────────────────────────── */
interface ApiProvider {
  id: string;
  label: string;
  placeholder: string;
  prefix: string;
}

const API_PROVIDERS: ApiProvider[] = [
  { id: "anthropic", label: "Anthropic (Claude)", placeholder: "sk-ant-...", prefix: "sk-ant-" },
  { id: "openai",    label: "OpenAI (GPT)",       placeholder: "sk-...",     prefix: "sk-" },
  { id: "google",    label: "Google (Gemini)",     placeholder: "AIza...",    prefix: "AIza" },
  { id: "mistral",   label: "Mistral",             placeholder: "...",        prefix: "" }
];

const STORAGE_KEY = "aig-harness-files-v1";
const BYOK_STORAGE_KEY = "aig-byok-keys-v1";

function loadFiles(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveFiles(files: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

function loadByokKeys(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(BYOK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveByokKeys(keys: Record<string, string>) {
  localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(keys));
}

function maskKey(key: string): string {
  if (!key || key.length < 8) return key;
  return key.slice(0, 6) + "••••••••" + key.slice(-4);
}

/* ── Component ───────────────────────────────────────────────── */
export function HarnessEditor() {
  const addToast = useUiStore((state) => state.addToast);
  const [activeId, setActiveId] = useState<string>(AGENT_FILES[0].id);
  const [contents, setContents] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [byokKeys, setByokKeys] = useState<Record<string, string>>({});
  const [byokVisible, setByokVisible] = useState<Record<string, boolean>>({});
  const [byokEditing, setByokEditing] = useState<Record<string, string>>({});
  const [byokEditMode, setByokEditMode] = useState<Record<string, boolean>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = loadFiles();
    const initial: Record<string, string> = {};
    for (const f of AGENT_FILES) {
      initial[f.id] = saved[f.id] ?? f.defaultContent;
    }
    setContents(initial);

    const keys = loadByokKeys();
    setByokKeys(keys);
  }, []);

  const activeFile = AGENT_FILES.find((f) => f.id === activeId)!;
  const activeContent = contents[activeId] ?? "";

  const handleContentChange = (value: string) => {
    setContents((prev) => ({ ...prev, [activeId]: value }));
    setDirty((prev) => new Set(prev).add(activeId));
  };

  const handleSave = () => {
    saveFiles(contents);
    setDirty(new Set());
    addToast("에이전트 파일이 저장되었습니다.", "success");
  };

  const handleSaveFile = (id: string) => {
    saveFiles(contents);
    setDirty((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    addToast(`${AGENT_FILES.find((f) => f.id === id)?.label} 저장되었습니다.`, "success");
  };

  const handleReset = (id: string) => {
    const file = AGENT_FILES.find((f) => f.id === id)!;
    setContents((prev) => ({ ...prev, [id]: file.defaultContent }));
    setDirty((prev) => new Set(prev).add(id));
  };

  /* BYOK handlers */
  const handleByokSave = (providerId: string) => {
    const value = byokEditing[providerId] ?? "";
    const next = { ...byokKeys, [providerId]: value };
    setByokKeys(next);
    saveByokKeys(next);
    setByokEditMode((prev) => ({ ...prev, [providerId]: false }));
    addToast("API 키가 저장되었습니다.", "success");
  };

  const handleByokDelete = (providerId: string) => {
    const next = { ...byokKeys };
    delete next[providerId];
    setByokKeys(next);
    saveByokKeys(next);
    setByokEditMode((prev) => ({ ...prev, [providerId]: false }));
    addToast("API 키가 삭제되었습니다.", "success");
  };

  const handleByokEdit = (providerId: string) => {
    setByokEditing((prev) => ({ ...prev, [providerId]: byokKeys[providerId] ?? "" }));
    setByokEditMode((prev) => ({ ...prev, [providerId]: true }));
  };

  const totalDirty = dirty.size;

  return (
    <div className="harness-layout">
      {/* ── Left: file tree ───────────────────────────────────── */}
      <aside className="harness-tree">
        <div className="harness-tree__header">
          <span className="eyebrow">Agent Files</span>
        </div>

        <nav className="harness-tree__nav">
          {AGENT_FILES.map((file) => (
            <button
              key={file.id}
              type="button"
              className={`harness-file-item${activeId === file.id ? " harness-file-item--active" : ""}`}
              onClick={() => setActiveId(file.id)}
            >
              <span className="harness-file-item__icon">
                {file.id === "harness" ? "📋" : file.id === "instruction" ? "📝" : file.id === "sandbox" ? "🧪" : "⚡"}
              </span>
              <span className="harness-file-item__info">
                <span className="harness-file-item__name">{file.label}</span>
                <span className="harness-file-item__path">{file.path}</span>
              </span>
              <span className={`harness-file-tag harness-file-tag--${file.tag}`}>{file.tag}</span>
              {dirty.has(file.id) && <span className="harness-dirty-dot" title="저장 안 됨" />}
            </button>
          ))}
        </nav>

        <div className="harness-tree__footer">
          {totalDirty > 0 && (
            <button className="button button--primary harness-save-all" onClick={handleSave}>
              전체 저장 ({totalDirty})
            </button>
          )}
        </div>
      </aside>

      {/* ── Center: editor ────────────────────────────────────── */}
      <main className="harness-editor-area">
        <div className="harness-editor-header">
          <div className="harness-editor-header__left">
            <code className="harness-editor-path">{activeFile.path}</code>
            {dirty.has(activeId) && <span className="harness-unsaved-badge">저장 안 됨</span>}
          </div>
          <div className="harness-editor-header__actions">
            <button
              className="button"
              onClick={() => handleReset(activeId)}
              title="기본값으로 초기화"
            >
              초기화
            </button>
            <button
              className="button button--primary"
              onClick={() => handleSaveFile(activeId)}
              disabled={!dirty.has(activeId)}
            >
              저장
            </button>
          </div>
        </div>

        <div className="harness-editor-body">
          <textarea
            ref={textareaRef}
            className="harness-textarea"
            value={activeContent}
            onChange={(e) => handleContentChange(e.target.value)}
            spellCheck={false}
          />
        </div>
      </main>

      {/* ── Right: BYOK panel ─────────────────────────────────── */}
      <aside className="harness-byok-panel">
        <Card>
          <div className="stack-12">
            <div>
              <span className="eyebrow">BYOK</span>
              <h2 className="harness-byok-title">API 키 설정</h2>
              <p className="muted-copy harness-byok-desc">
                에이전트가 사용할 LLM 제공사 키를 등록합니다. 브라우저 로컬에만 저장됩니다.
              </p>
            </div>

            <div className="harness-byok-list">
              {API_PROVIDERS.map((provider) => {
                const hasKey = !!byokKeys[provider.id];
                const isEditing = byokEditMode[provider.id];
                const isVisible = byokVisible[provider.id];

                return (
                  <div key={provider.id} className="harness-byok-item">
                    <div className="harness-byok-item__head">
                      <span className="harness-byok-item__label">{provider.label}</span>
                      <span className={`harness-byok-status ${hasKey ? "harness-byok-status--set" : "harness-byok-status--empty"}`}>
                        {hasKey ? "등록됨" : "미설정"}
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="harness-byok-item__edit">
                        <input
                          type={isVisible ? "text" : "password"}
                          className="input harness-byok-input"
                          placeholder={provider.placeholder}
                          value={byokEditing[provider.id] ?? ""}
                          onChange={(e) =>
                            setByokEditing((prev) => ({ ...prev, [provider.id]: e.target.value }))
                          }
                          autoComplete="off"
                        />
                        <div className="harness-byok-item__edit-actions">
                          <button
                            className="button"
                            type="button"
                            onClick={() =>
                              setByokVisible((prev) => ({ ...prev, [provider.id]: !prev[provider.id] }))
                            }
                          >
                            {isVisible ? "숨기기" : "보기"}
                          </button>
                          <button
                            className="button"
                            type="button"
                            onClick={() => setByokEditMode((prev) => ({ ...prev, [provider.id]: false }))}
                          >
                            취소
                          </button>
                          <button
                            className="button button--primary"
                            type="button"
                            onClick={() => handleByokSave(provider.id)}
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="harness-byok-item__display">
                        <code className="harness-byok-value">
                          {hasKey ? maskKey(byokKeys[provider.id]) : "—"}
                        </code>
                        <div className="harness-byok-item__display-actions">
                          <button
                            className="button"
                            type="button"
                            onClick={() => handleByokEdit(provider.id)}
                          >
                            {hasKey ? "변경" : "등록"}
                          </button>
                          {hasKey && (
                            <button
                              className="button harness-byok-delete"
                              type="button"
                              onClick={() => handleByokDelete(provider.id)}
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </aside>
    </div>
  );
}
