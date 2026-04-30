"use client";

import { useState, useMemo } from "react";

/* ── Types ─────────────────────────────────────────────────── */

type WizardStep = 1 | 2 | 3 | 4;

interface AgentModel {
  id: string;
  name: string;
  desc: string;
  tags: string[];
  provider: "anthropic" | "openai" | "google";
}

interface Skill {
  id: string;
  name: string;
  desc: string;
  icon: string;
}

interface InstructionTemplate {
  id: string;
  name: string;
  desc: string;
  icon: string;
  content: string;
}

/* ── Static data ────────────────────────────────────────────── */

const AGENT_MODELS: AgentModel[] = [
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    desc: "추론과 코딩에 최적화된 균형형 모델",
    tags: ["추론 강함", "긴 컨텍스트"],
    provider: "anthropic",
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    desc: "빠른 응답이 필요한 경량 작업에 최적",
    tags: ["빠름", "경량"],
    provider: "anthropic",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    desc: "멀티모달 지원의 범용 고성능 모델",
    tags: ["범용", "멀티모달"],
    provider: "openai",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o mini",
    desc: "빠르고 비용 효율적인 경량 모델",
    tags: ["빠름", "저비용"],
    provider: "openai",
  },
];

const SKILLS: Skill[] = [
  { id: "web-search",  name: "웹 검색",   desc: "실시간 웹 정보 검색",        icon: "🌐" },
  { id: "code-runner", name: "코드 실행", desc: "코드 실행 및 결과 확인",      icon: "▶️" },
  { id: "file-reader", name: "파일 읽기", desc: "워크스페이스 파일 접근",      icon: "📂" },
  { id: "memory",      name: "메모리",    desc: "대화 컨텍스트 저장 및 참조",  icon: "🧠" },
  { id: "diff-viewer", name: "Diff 뷰어", desc: "코드 변경 사항 비교",        icon: "📊" },
  { id: "test-runner", name: "테스트",    desc: "자동 테스트 실행 및 리포트",  icon: "🧪" },
];

const INSTRUCTION_TEMPLATES: InstructionTemplate[] = [
  {
    id: "coding",
    name: "코딩 어시스턴트",
    desc: "코드 작성 · 디버깅 전문",
    icon: "💻",
    content: `당신은 숙련된 소프트웨어 엔지니어입니다.
사용자의 코드 작성, 디버깅, 리팩토링 요청을 도와주세요.

- 코드는 항상 명확하고 읽기 쉽게 작성합니다
- 버그를 발견하면 원인과 해결 방법을 함께 설명합니다
- 더 나은 패턴이 있다면 적극적으로 제안합니다`,
  },
  {
    id: "reviewer",
    name: "코드 리뷰어",
    desc: "품질 분석 · 개선 제안",
    icon: "🔍",
    content: `당신은 꼼꼼한 코드 리뷰어입니다.
제출된 코드를 분석하고 개선 사항을 제안해주세요.

- 가독성, 성능, 보안을 종합적으로 평가합니다
- 구체적인 개선 방법을 예시와 함께 제시합니다
- 잘 작성된 부분도 언급해 균형 잡힌 피드백을 줍니다`,
  },
  {
    id: "tutor",
    name: "학습 튜터",
    desc: "개념 설명 · 학습 가이드",
    icon: "📚",
    content: `당신은 친절한 프로그래밍 튜터입니다.
개념을 쉽고 명확하게 설명해주세요.

- 복잡한 개념은 비유와 예시를 들어 설명합니다
- 학습자의 수준에 맞게 설명을 조절합니다
- 실습 가능한 작은 예제를 함께 제공합니다`,
  },
  {
    id: "general",
    name: "범용 어시스턴트",
    desc: "일반 목적의 AI 도우미",
    icon: "🤖",
    content: `당신은 유능한 AI 어시스턴트입니다.
사용자의 다양한 요청을 정확하고 친절하게 처리해주세요.

- 불명확한 요청은 먼저 확인 후 진행합니다
- 한국어로 소통하되 필요 시 영어 표현도 활용합니다
- 모르는 내용은 솔직하게 인정합니다`,
  },
];

const PROVIDER_BADGE: Record<AgentModel["provider"], { label: string; color: string; bg: string }> = {
  anthropic: { label: "Anthropic", color: "#c9623f", bg: "#fff4f0" },
  openai:    { label: "OpenAI",    color: "#10a37f", bg: "#f0fdf9" },
  google:    { label: "Google",    color: "#4285f4", bg: "#f0f4ff" },
};

/* ── Step indicator ─────────────────────────────────────────── */

const STEPS: { num: WizardStep; label: string }[] = [
  { num: 1, label: "Agent" },
  { num: 2, label: "Skills" },
  { num: 3, label: "Instruction" },
  { num: 4, label: "확인" },
];

function StepIndicator({ current }: { current: WizardStep }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "14px 12px 10px", gap: 0 }}>
      {STEPS.map((s, i) => {
        const done    = s.num < current;
        const active  = s.num === current;
        const future  = s.num > current;

        const circleColor = done ? "#6366f1" : active ? "#6366f1" : "#d1d5db";
        const lineColor   = done ? "#6366f1" : "#e5e7eb";

        return (
          <div key={s.num} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                background: done || active ? circleColor : "white",
                border: `2px solid ${circleColor}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700,
                color: done || active ? "white" : "#9ca3af",
                flexShrink: 0,
                transition: "all 0.2s",
              }}>
                {done ? "✓" : s.num}
              </div>
              <span style={{
                fontSize: 9, fontWeight: active ? 700 : 500,
                color: active ? "#6366f1" : done ? "#374151" : "#9ca3af",
                whiteSpace: "nowrap",
              }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, background: lineColor,
                margin: "0 4px", marginBottom: 14,
                transition: "background 0.3s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Generated markdown ─────────────────────────────────────── */

function buildMarkdown(agent: string, skills: string[], instruction: string) {
  const model = AGENT_MODELS.find((m) => m.id === agent);
  const skillList = SKILLS.filter((s) => skills.includes(s.id));
  return [
    "# Harness Configuration",
    "",
    "## Agent",
    `model: ${model?.id ?? agent}`,
    "",
    "## Skills",
    skillList.length ? skillList.map((s) => `- ${s.id}`).join("\n") : "- (none)",
    "",
    "## Instruction",
    instruction.trim() || "(비어 있음)",
  ].join("\n");
}

/* ── Main component ─────────────────────────────────────────── */

export function HarnessPanel() {
  const [step, setStep]                       = useState<WizardStep>(1);
  const [selectedAgent, setSelectedAgent]     = useState<string | null>(null);
  const [selectedSkills, setSelectedSkills]   = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [instruction, setInstruction]         = useState("");
  const [mdExpanded, setMdExpanded]           = useState(false);
  const [applied, setApplied]                 = useState(false);

  const toggleSkill = (id: string) =>
    setSelectedSkills((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );

  const pickTemplate = (tpl: InstructionTemplate) => {
    setSelectedTemplate(tpl.id);
    setInstruction(tpl.content);
  };

  const canNext =
    (step === 1 && selectedAgent !== null) ||
    (step === 2) ||
    (step === 3) ||
    step === 4;

  const markdown = useMemo(
    () => buildMarkdown(selectedAgent ?? "", selectedSkills, instruction),
    [selectedAgent, selectedSkills, instruction],
  );

  const handleApply = () => {
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  /* ── Step renderers ── */

  const renderStep1 = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={hint}>모델을 선택하면 에이전트 실행 환경이 결정됩니다.</p>
      {AGENT_MODELS.map((m) => {
        const active = selectedAgent === m.id;
        const badge  = PROVIDER_BADGE[m.provider];
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelectedAgent(m.id)}
            style={{
              ...cardBase,
              borderColor: active ? "#6366f1" : "var(--line, rgba(0,0,0,0.08))",
              background:  active ? "#eef2ff" : "var(--subtle-bg, #fafafa)",
              boxShadow:   active ? "0 0 0 2px #6366f133" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: active ? "#4338ca" : "var(--text, #111827)" }}>
                    {m.name}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 4, background: badge.bg, color: badge.color }}>
                    {badge.label}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--muted, #6b7280)", lineHeight: 1.4 }}>{m.desc}</p>
              </div>
              <div style={{ flexShrink: 0, width: 16, height: 16, borderRadius: "50%", border: `2px solid ${active ? "#6366f1" : "#d1d5db"}`, background: active ? "#6366f1" : "white", marginTop: 2 }} />
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
              {m.tags.map((t) => (
                <span key={t} style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: active ? "#c7d2fe" : "#f3f4f6", color: active ? "#3730a3" : "#6b7280" }}>
                  {t}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );

  const renderStep2 = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={hint}>사용할 스킬을 선택하세요.</p>
        {selectedSkills.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "#eef2ff", color: "#6366f1" }}>
            {selectedSkills.length}개 선택
          </span>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {SKILLS.map((sk) => {
          const active = selectedSkills.includes(sk.id);
          return (
            <button
              key={sk.id}
              type="button"
              onClick={() => toggleSkill(sk.id)}
              style={{
                ...cardBase,
                padding: "9px 10px",
                borderColor: active ? "#6366f1" : "var(--line, rgba(0,0,0,0.08))",
                background:  active ? "#eef2ff" : "var(--subtle-bg, #fafafa)",
                boxShadow:   active ? "0 0 0 2px #6366f133" : "none",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 4 }}>{sk.icon}</div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: active ? "#4338ca" : "var(--text, #111827)", marginBottom: 2 }}>{sk.name}</div>
              <div style={{ fontSize: "0.67rem", color: "var(--muted, #6b7280)", lineHeight: 1.3 }}>{sk.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={hint}>용도에 맞는 템플릿을 선택하고 직접 수정할 수 있습니다.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {INSTRUCTION_TEMPLATES.map((tpl) => {
          const active = selectedTemplate === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => pickTemplate(tpl)}
              style={{
                ...cardBase,
                padding: "9px 10px",
                borderColor: active ? "#6366f1" : "var(--line, rgba(0,0,0,0.08))",
                background:  active ? "#eef2ff" : "var(--subtle-bg, #fafafa)",
                boxShadow:   active ? "0 0 0 2px #6366f133" : "none",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 16, marginBottom: 3 }}>{tpl.icon}</div>
              <div style={{ fontSize: "0.74rem", fontWeight: 700, color: active ? "#4338ca" : "var(--text, #111827)", marginBottom: 1 }}>{tpl.name}</div>
              <div style={{ fontSize: "0.66rem", color: "var(--muted, #6b7280)" }}>{tpl.desc}</div>
            </button>
          );
        })}
      </div>
      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="직접 입력하거나 위 템플릿을 선택하세요."
        rows={7}
        style={{
          width: "100%", resize: "vertical", boxSizing: "border-box",
          padding: "8px 10px", borderRadius: 8, fontSize: "0.74rem",
          border: "1px solid var(--line, rgba(0,0,0,0.1))",
          background: "var(--subtle-bg, #fafafa)", color: "var(--text, #111827)",
          fontFamily: "var(--font-mono, monospace)", lineHeight: 1.6, outline: "none",
        }}
      />
    </div>
  );

  const renderStep4 = () => {
    const model  = AGENT_MODELS.find((m) => m.id === selectedAgent);
    const skills = SKILLS.filter((s) => selectedSkills.includes(s.id));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Summary cards */}
        <SummaryRow label="Agent" value={model?.name ?? "—"} icon="🤖" onEdit={() => setStep(1)} />
        <SummaryRow
          label="Skills"
          value={skills.length ? skills.map((s) => s.name).join(", ") : "없음"}
          icon="🔧"
          onEdit={() => setStep(2)}
        />
        <SummaryRow
          label="Instruction"
          value={instruction.trim() ? instruction.slice(0, 40) + (instruction.length > 40 ? "…" : "") : "—"}
          icon="📋"
          onEdit={() => setStep(3)}
        />

        {/* Markdown preview */}
        <div style={{ border: "1px solid var(--line, rgba(0,0,0,0.08))", borderRadius: 8, overflow: "hidden" }}>
          <button
            type="button"
            onClick={() => setMdExpanded((v) => !v)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "7px 10px", background: "var(--subtle-bg, #f9fafb)", border: "none",
              cursor: "pointer", fontSize: "0.72rem", fontWeight: 600, color: "var(--muted, #6b7280)",
            }}
          >
            <span>생성될 마크다운 미리보기</span>
            <span style={{ fontSize: 10 }}>{mdExpanded ? "▲" : "▼"}</span>
          </button>
          {mdExpanded && (
            <pre style={{
              margin: 0, padding: "10px 12px", fontSize: "0.68rem",
              fontFamily: "var(--font-mono, monospace)", color: "var(--text, #111827)",
              background: "var(--subtle-bg-2, #f3f4f6)", overflowX: "auto",
              whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.6,
            }}>
              {markdown}
            </pre>
          )}
        </div>

        {/* Apply */}
        <button
          type="button"
          className="button button--primary"
          style={{ width: "100%", justifyContent: "center", fontSize: "0.82rem", padding: "9px 0" }}
          onClick={handleApply}
        >
          {applied ? "✓ 적용 완료" : "적용하기"}
        </button>
      </div>
    );
  };

  const stepContent = [renderStep1, renderStep2, renderStep3, renderStep4][step - 1];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Step indicator */}
      <div style={{ borderBottom: "1px solid var(--line, rgba(0,0,0,0.08))", flexShrink: 0 }}>
        <StepIndicator current={step} />
      </div>

      {/* Step title */}
      <div style={{ padding: "10px 14px 0", flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: "0.86rem", fontWeight: 700, color: "var(--text, #111827)" }}>
          {["Agent 선택", "Skills 선택", "Instruction 설정", "확인 및 적용"][step - 1]}
        </p>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px 14px" }}>
        {stepContent()}
      </div>

      {/* Navigation */}
      <div style={{
        display: "flex", gap: 6, padding: "10px 14px",
        borderTop: "1px solid var(--line, rgba(0,0,0,0.08))", flexShrink: 0,
      }}>
        {step > 1 && (
          <button
            type="button"
            className="button"
            style={{ flex: 1, justifyContent: "center", fontSize: "0.78rem" }}
            onClick={() => setStep((s) => (s - 1) as WizardStep)}
          >
            ← 이전
          </button>
        )}
        {step < 4 && (
          <button
            type="button"
            className="button button--primary"
            style={{ flex: 2, justifyContent: "center", fontSize: "0.78rem", opacity: canNext ? 1 : 0.5 }}
            disabled={!canNext}
            onClick={() => setStep((s) => (s + 1) as WizardStep)}
          >
            다음 →
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Small helpers ──────────────────────────────────────────── */

function SummaryRow({ label, value, icon, onEdit }: { label: string; value: string; icon: string; onEdit: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 10px", borderRadius: 8,
      border: "1px solid var(--line, rgba(0,0,0,0.08))",
      background: "var(--subtle-bg, #fafafa)",
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted, #6b7280)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
        <div style={{ fontSize: "0.74rem", fontWeight: 500, color: "var(--text, #111827)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        style={{ fontSize: 10, color: "#6366f1", fontWeight: 600, background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}
      >
        수정
      </button>
    </div>
  );
}

const hint: React.CSSProperties = {
  margin: 0,
  fontSize: "0.73rem",
  color: "var(--muted, #6b7280)",
  lineHeight: 1.5,
};

const cardBase: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1.5px solid",
  cursor: "pointer",
  transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s",
  textAlign: "left",
};
