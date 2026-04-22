"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  BookOpen,
  HelpCircle,
  Key,
  Sparkles,
  TrendingUp,
  User as UserIcon
} from "lucide-react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import { useAuthStore } from "@/store/authStore";

interface AvgScore {
  label: string;
  score: number;
  tone: "good" | "mid" | "warn";
}

interface LevelBreakdown {
  level: 1 | 2 | 3;
  total: number;
  completed: number;
}

const TONE_COLORS = {
  good: "bg-green-500",
  mid: "bg-indigo-500",
  warn: "bg-amber-500"
} as const;

const SCORE_TIPS: Record<string, string> = {
  "하네스 품질 점수": "HARNESS.md에 작성된 에이전트 지시 품질과 문제 문맥 명확성을 평가합니다.",
  "실행 품질 점수": "AI 제안 코드를 실행·테스트로 검증하고 결과를 코드에 반영한 정도를 측정합니다.",
  "트레이스 활용 점수": "에이전트 실행 트레이스를 얼마나 활용하고 디버깅에 적용했는지 평가합니다."
};

const BYOK_PROVIDERS = [
  { id: "anthropic", label: "Anthropic", placeholder: "sk-ant-..." },
  { id: "openai", label: "OpenAI", placeholder: "sk-..." },
  { id: "google", label: "Google AI", placeholder: "AIza..." },
  { id: "mistral", label: "Mistral", placeholder: "..." }
] as const;

type ProviderId = (typeof BYOK_PROVIDERS)[number]["id"];
const BYOK_STORAGE_KEY = "aig-byok-keys-v1";

function loadByokKeys(): Partial<Record<ProviderId, string>> {
  try {
    const raw = localStorage.getItem(BYOK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveByokKeys(keys: Partial<Record<ProviderId, string>>) {
  localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(keys));
}

function ByokSection() {
  const [keys, setKeys] = useState<Partial<Record<ProviderId, string>>>(() => loadByokKeys());
  const [saved, setSaved] = useState(false);

  const handleChange = (id: ProviderId, value: string) => {
    setKeys((prev) => ({ ...prev, [id]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    saveByokKeys(keys);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
      <div className="mb-5">
        <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">
          <Key size={14} />
          <span>API 키 (BYOK)</span>
        </div>
        <h2 className="text-lg font-display font-bold text-gray-900">개인 API 키 등록</h2>
        <p className="text-sm text-gray-500 mt-1">
          키는 브라우저 로컬 스토리지에만 저장됩니다. 서버로 전송되지 않습니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {BYOK_PROVIDERS.map(({ id, label, placeholder }) => (
          <label key={id} className="block">
            <span className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</span>
            <input
              type="password"
              placeholder={placeholder}
              value={keys[id] ?? ""}
              onChange={(e) => handleChange(id, e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 font-mono focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
            />
          </label>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <span>{saved ? "저장됨 ✓" : "저장"}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            const e: Partial<Record<ProviderId, string>> = {};
            setKeys(e);
            saveByokKeys(e);
          }}
          className="inline-flex items-center bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          초기화
        </button>
      </div>
    </section>
  );
}

export default function Dev2MyPage() {
  const { withPrefix } = useRouteScope();
  const user = useAuthStore((s) => s.user);
  const { data } = useQuery({
    queryKey: ["mypage", user?.id],
    queryFn: () => mockApi.getMyDashboard(user!.id),
    enabled: !!user
  });

  const avgScores = (data?.avgScores ?? []) as AvgScore[];
  const levelBreakdown = (data?.levelBreakdown ?? []) as LevelBreakdown[];

  return (
    <div className="bg-gradient-to-b from-indigo-50/30 via-white to-white min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-6">
        {/* Profile hero */}
        <section className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 bg-gradient-animate rounded-3xl p-8 md:p-10 text-white relative overflow-hidden animate-slide-up">
          <div className="absolute inset-0 bg-gradient-radial from-white/20 to-transparent opacity-30" />
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/10 blur-3xl animate-blob-1" />
          <div className="absolute bottom-0 left-10 w-48 h-48 rounded-full bg-purple-300/20 blur-3xl animate-blob-2" />
          <div className="relative flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-display font-bold">
                {data?.user.name.slice(0, 1) ?? "U"}
              </div>
              <div>
                <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-white/15 text-xs font-semibold mb-2">
                  <UserIcon size={12} strokeWidth={2.4} />
                  <span>마이페이지</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight">
                  {data?.user.name ?? "사용자"}
                </h1>
                <p className="text-sm text-indigo-100">
                  {data?.user.email ?? "user@email.com"} · AIG 실습 계정
                </p>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 md:ml-auto">
              {(data?.stats ?? []).map((stat) => (
                <div key={stat.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
                  <strong className="block text-2xl font-display font-bold mb-0.5">
                    {stat.value}
                  </strong>
                  <span className="block text-xs text-indigo-100 font-medium">{stat.label}</span>
                  <span className="block text-[10px] text-indigo-200 mt-0.5">{stat.note}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 stagger-children">
          {/* AI 점수 */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 animate-slide-up" style={{ animationFillMode: "both" }}>
            <div className="mb-5">
              <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">
                <Award size={14} />
                <span>역량</span>
              </div>
              <h2 className="text-lg font-display font-bold text-gray-900">AI 활용 점수</h2>
              <p className="text-sm text-gray-500 mt-1">
                {data?.history?.length ?? 0}회 제출 평균
              </p>
            </div>

            {avgScores.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                제출 완료 후 점수가 집계됩니다.
              </p>
            ) : (
              <div className="space-y-4">
                {avgScores.map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="inline-flex items-center space-x-1.5 text-sm font-medium text-gray-700">
                        <span>{item.label}</span>
                        {SCORE_TIPS[item.label] && (
                          <span title={SCORE_TIPS[item.label]} className="text-gray-400 cursor-help">
                            <HelpCircle size={12} />
                          </span>
                        )}
                      </span>
                      <strong className="text-sm font-bold text-gray-900">{item.score}</strong>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${TONE_COLORS[item.tone]}`}
                        style={{ width: `${item.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 풀이 기록 */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 flex flex-col animate-slide-up" style={{ animationFillMode: "both" }}>
            <div className="mb-5">
              <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">
                <TrendingUp size={14} />
                <span>풀이</span>
              </div>
              <h2 className="text-lg font-display font-bold text-gray-900">레벨별 현황</h2>
              <p className="text-sm text-gray-500 mt-1">진행 중·완료 과제 분포</p>
            </div>

            {levelBreakdown.length > 0 ? (
              <div className="space-y-3 flex-1">
                {levelBreakdown.map(({ level, total, completed }) => (
                  <div key={level} className="flex items-center space-x-3">
                    <span className="w-12 text-sm font-mono font-semibold text-indigo-600">
                      Lv {level}
                    </span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                        style={{ width: total > 0 ? `${(completed / total) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className="w-16 text-sm font-medium text-gray-600 text-right">
                      {completed}/{total}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4 flex-1">
                풀이 기록이 없습니다.
              </p>
            )}

            <Link
              href={withPrefix("/sessions")}
              className="mt-5 inline-flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              <BookOpen size={14} />
              <span>풀이 기록 전체 보기</span>
            </Link>
          </section>
        </div>

        {/* BYOK */}
        <ByokSection />
      </div>
    </div>
  );
}
