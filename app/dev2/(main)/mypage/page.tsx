"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  Key,
  Trophy,
  Flame,
  Shield,
  Check,
  Pencil,
  Trash2,
  Bell,
  Sun,
  Moon,
  Database,
  AlertTriangle,
  CircleCheck,
  Wrench,
  Code2,
  FileText,
  type LucideIcon
} from "lucide-react";

import { LangIcon } from "@/components/common/LangIcon";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { useUiStore } from "@/store/uiStore";

/* ─── BYOK ─── */

type ProviderId = "anthropic" | "openai" | "google";

const BYOK_PROVIDERS: {
  id: ProviderId;
  label: string;
  logo: string; // letter mark or emoji
  tint: string;
}[] = [
  { id: "anthropic", label: "Anthropic Claude", logo: "A", tint: "bg-orange-100 text-orange-700" },
  { id: "openai", label: "OpenAI", logo: "O", tint: "bg-emerald-100 text-emerald-700" },
  { id: "google", label: "Google Gemini", logo: "G", tint: "bg-sky-100 text-sky-700" }
];

const BYOK_STORAGE_KEY = "aig-byok-keys-v1";

function loadByokKeys(): Partial<Record<ProviderId, string>> {
  if (typeof window === "undefined") return {};
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
function maskKey(k: string): string {
  if (!k) return "";
  if (k.length <= 10) return `${k.slice(0, 4)}•••${k.slice(-2)}`;
  return `${k.slice(0, 6)}•••••${k.slice(-4)}`;
}

/* ─── Page ─── */

export default function Dev2MyPage() {
  const { withPrefix } = useRouteScope();
  const user = useAuthStore((s) => s.user);
  const addToast = useUiStore((s) => s.addToast);
  const theme = useThemeStore((s) => s.theme);
  const hydrated = useThemeStore((s) => s.hydrated);
  const setTheme = useThemeStore((s) => s.setTheme);

  const { data } = useQuery({
    queryKey: ["mypage", user?.id],
    queryFn: () => mockApi.getMyDashboard(user!.id),
    enabled: !!user
  });

  const name = data?.user.name ?? user?.name ?? "사용자";
  const email = data?.user.email ?? user?.email ?? "user@email.com";
  const initials = name.slice(0, 2).toUpperCase();

  /* Skills — always 5 axes for radar shape */
  const skills = useMemo(() => {
    const base = (data?.avgScores ?? []) as { label: string; score: number }[];
    const find = (l: string, fallback: number) =>
      base.find((b) => b.label.includes(l))?.score ?? fallback;

    return [
      { label: "하네스 품질", score: find("하네스", 72) },
      { label: "실행 품질", score: find("실행", 64) },
      { label: "Trace 활용", score: find("트레이스", 58) },
      { label: "프롬프트 설계", score: Math.round(find("하네스", 72) * 0.9) },
      { label: "자기 피드백", score: Math.round(find("실행", 64) * 1.05) }
    ];
  }, [data]);

  const avgSkill =
    Math.round(skills.reduce((a, s) => a + s.score, 0) / skills.length) || 0;

  /* Recent activity */
  const activity = useMemo(() => {
    if (!data) return [];
    type Row = {
      id: string;
      time: string;
      icon: LucideIcon;
      tint: string;
      title: React.ReactNode;
      sub: string;
      href?: string;
      action?: string;
    };

    const rows: Row[] = [];

    data.history.slice(0, 3).forEach((h) => {
      if (!h) return;
      rows.push({
        id: `sub-${h.id}`,
        time: h.date,
        icon: CircleCheck,
        tint: "bg-green-100 text-green-600",
        title: (
          <>
            <strong className="font-bold text-gray-900">{h.title}</strong> 제출 · {h.passRate}
          </>
        ),
        sub: `AI 활용: ${h.aiUsage}`,
        href: h.href,
        action: "리포트 보기"
      });
    });

    data.resumableSessions.slice(0, 2).forEach((s) => {
      if (!s) return;
      rows.push({
        id: `ses-${s.sessionId}`,
        time: new Date(s.lastSavedAt).toLocaleDateString("ko-KR"),
        icon: Wrench,
        tint: "bg-indigo-100 text-indigo-600",
        title: (
          <>
            <strong className="font-bold text-gray-900">{s.title}</strong> 풀이 중
          </>
        ),
        sub: `Lv ${s.level} · ${s.category} · AI ${s.aiRequestCount}회`,
        href: s.href,
        action: "이어가기"
      });
    });

    return rows.slice(0, 5);
  }, [data]);

  /* Preferences */
  const [defaultLang, setDefaultLang] = useState<"java" | "python">("java");
  const [notifyNewProblem, setNotifyNewProblem] = useState(true);
  const [notifyWeekly, setNotifyWeekly] = useState(true);
  const [notifyTier, setNotifyTier] = useState(true);
  const [defaultModel, setDefaultModel] = useState("AIG Default Model");

  /* BYOK */
  const [byokKeys, setByokKeys] = useState<Partial<Record<ProviderId, string>>>({});
  const [editingProvider, setEditingProvider] = useState<ProviderId | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    setByokKeys(loadByokKeys());
  }, []);

  const openEdit = (id: ProviderId) => {
    setEditingProvider(id);
    setEditValue(byokKeys[id] ?? "");
  };
  const saveEdit = () => {
    if (!editingProvider) return;
    const next = { ...byokKeys, [editingProvider]: editValue.trim() };
    setByokKeys(next);
    saveByokKeys(next);
    addToast(`${editingProvider} 키가 저장되었습니다.`, "success");
    setEditingProvider(null);
    setEditValue("");
  };
  const removeKey = (id: ProviderId) => {
    const next = { ...byokKeys };
    delete next[id];
    setByokKeys(next);
    saveByokKeys(next);
    addToast(`${id} 키가 삭제되었습니다.`, "success");
  };

  /* Danger zone */
  const resetMockData = () => {
    if (!window.confirm("모든 mock 데이터를 초기화할까요? 되돌릴 수 없습니다.")) return;
    localStorage.removeItem("aig-mock-db-v2");
    localStorage.removeItem(BYOK_STORAGE_KEY);
    addToast("mock 데이터가 초기화되었습니다. 새로고침해 주세요.", "success");
  };

  return (
    <div className="relative bg-gradient-to-b from-indigo-50/30 via-white to-white min-h-screen overflow-hidden">
      {/* Floating orbs */}
      <div className="absolute top-0 left-0 right-0 h-[800px] pointer-events-none overflow-hidden">
        <div className="absolute -top-10 -left-40 w-[480px] h-[480px] rounded-full bg-indigo-400/25 blur-3xl animate-blob-1" />
        <div className="absolute top-[12%] -right-40 w-[480px] h-[480px] rounded-full bg-violet-400/25 blur-3xl animate-blob-2" />
        <div className="absolute inset-0 bg-grid-pattern opacity-25" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 pt-28 pb-16 space-y-6">
        {/* ── PROFILE HERO ── */}
        <section
          className="relative rounded-3xl overflow-hidden text-white animate-slide-up"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #4338CA 0%, #4F46E5 35%, #7C3AED 75%, #6D28D9 100%)"
          }}
        >
          <div className="absolute -top-12 -right-16 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-12 -left-20 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute top-6 left-[25%] w-5 h-5 rounded-full bg-white/20 blur-sm" />
          <div className="absolute top-[45%] left-[65%] w-3 h-3 rounded-full bg-white/30 blur-[2px]" />

          <div className="relative flex flex-col md:flex-row md:items-center gap-8 p-8 md:p-10">
            {/* Left: avatar + name */}
            <div className="flex items-center gap-5 min-w-0">
              <div className="relative shrink-0">
                <div className="w-[104px] h-[104px] rounded-full bg-white/95 text-indigo-700 flex items-center justify-center font-display font-bold text-3xl shadow-xl">
                  {initials}
                </div>
                <span className="absolute bottom-2 right-2 w-4 h-4 rounded-full bg-green-400 ring-4 ring-white/90" />
              </div>
              <div className="min-w-0">
                <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight leading-[1.1] mb-2">
                  {name}
                </h1>
                <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-semibold mb-2">
                  <Sparkles size={12} strokeWidth={2.4} />
                  <span>AIG Member since Jan 2026</span>
                </div>
                <p className="text-sm text-white/80 truncate">
                  SSAFY 14기 D103 · {email}
                </p>
              </div>
            </div>

            {/* Right: 3 stat chips */}
            <div className="md:ml-auto grid grid-cols-3 gap-3 shrink-0">
              <StatChip icon={Trophy} label="RANK" value="Top 12%" />
              <StatChip icon={Flame} label="STREAK" value="7 days" suffix="🔥" />
              <StatChip icon={Shield} label="TIER" value="Silver II" />
            </div>
          </div>
        </section>

        {/* ── SKILL RADAR + RECENT ACTIVITY ── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Skill radar */}
          <div
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-7 animate-slide-up"
            style={{ animationFillMode: "both" }}
          >
            <div className="mb-4">
              <h2 className="font-display font-bold text-gray-900 text-[17px]">
                AI 활용 역량
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                최근 10개 세션 평균 · 내 평균 {avgSkill}점
              </p>
            </div>
            <SkillRadar skills={skills} />
            <div className="flex items-center justify-center gap-5 text-xs text-gray-500 mt-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-indigo-500" />내 평균
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-gray-400" />전체 평균
              </span>
            </div>
          </div>

          {/* Recent activity */}
          <div
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-7 animate-slide-up"
            style={{ animationFillMode: "both", animationDelay: "0.05s" }}
          >
            <h2 className="font-display font-bold text-gray-900 text-[17px] mb-4">
              최근 활동
            </h2>
            {activity.length === 0 ? (
              <p className="text-sm text-gray-400 py-10 text-center">
                아직 활동 내역이 없어요.
              </p>
            ) : (
              <div className="space-y-3">
                {activity.map((row) => {
                  const Icon = row.icon;
                  return (
                    <div key={row.id} className="flex items-start gap-3 py-1.5">
                      <span
                        className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full ${row.tint}`}
                      >
                        <Icon size={15} strokeWidth={2.2} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-400 font-mono mb-0.5 tabular-nums">
                          {row.time}
                        </div>
                        <div className="text-sm text-gray-700 leading-relaxed">
                          {row.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {row.sub}
                        </div>
                      </div>
                      {row.href && row.action && (
                        <Link
                          href={withPrefix(row.href)}
                          className="shrink-0 self-center text-sm font-semibold text-gray-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-indigo-300 transition-colors"
                        >
                          {row.action}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── API KEYS + PREFERENCES ── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* API Keys */}
          <div
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-7 animate-slide-up"
            style={{ animationFillMode: "both" }}
          >
            <div className="flex items-start gap-3 mb-5">
              <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600">
                <Key size={16} strokeWidth={2.2} />
              </span>
              <div>
                <h2 className="font-display font-bold text-gray-900 text-[17px]">API 키</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  내 OpenAI · Anthropic · Google 키를 안전하게 연결
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {BYOK_PROVIDERS.map((p) => {
                const connected = Boolean(byokKeys[p.id]);
                const isEditing = editingProvider === p.id;
                return (
                  <div key={p.id}>
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                      <span
                        className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg ${p.tint} font-display font-bold text-sm`}
                      >
                        {p.logo}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900">
                          {p.label}
                        </div>
                        {connected ? (
                          <div className="text-xs text-gray-500 font-mono mt-0.5 truncate">
                            {maskKey(byokKeys[p.id]!)}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 mt-0.5">-</div>
                        )}
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                          connected
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {connected && <Check size={10} strokeWidth={3} />}
                        <span>{connected ? "연결됨" : "미연결"}</span>
                      </span>
                      <div className="shrink-0 flex items-center">
                        <button
                          type="button"
                          onClick={() => openEdit(p.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          aria-label="편집"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={!connected}
                          onClick={() => removeKey(p.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                          aria-label="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="mt-2 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                        <input
                          type="password"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder={`${p.label} API 키를 붙여넣으세요`}
                          autoFocus
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 font-mono focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={saveEdit}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProvider(null);
                              setEditValue("");
                            }}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer banner */}
            <div className="mt-4 flex items-start gap-2.5 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 text-xs text-indigo-700">
              <Shield size={13} strokeWidth={2.2} className="shrink-0 mt-0.5" />
              <span>키는 브라우저에만 저장되며 서버에는 전송되지 않아요.</span>
            </div>
          </div>

          {/* Preferences */}
          <div
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-7 animate-slide-up"
            style={{ animationFillMode: "both", animationDelay: "0.05s" }}
          >
            <h2 className="font-display font-bold text-gray-900 text-[17px] mb-5">
              환경 설정
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* 기본 언어 */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.14em] text-gray-500 mb-2">
                  기본 언어
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["java", "python"] as const).map((l) => {
                    const active = defaultLang === l;
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setDefaultLang(l)}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
                          active
                            ? "border-indigo-500 bg-indigo-50/50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <LangIcon language={l} size={18} />
                        <span className={active ? "text-indigo-700" : "text-gray-700"}>
                          {l === "java" ? "Java" : "Python"}
                        </span>
                        {active && (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-600 text-white">
                            <Check size={10} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 기본 AI 모델 */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.14em] text-gray-500 mb-2">
                  기본 AI 모델
                </label>
                <select
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-sm font-semibold text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                >
                  <option>AIG Default Model</option>
                  <option>Claude Sonnet 4.6</option>
                  <option>GPT-5.4</option>
                  <option>Gemini 2.5 Pro</option>
                </select>
              </div>

              {/* 알림 */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-[0.14em] text-gray-500 mb-2">
                  알림
                </label>
                <div className="space-y-1.5">
                  <ToggleRow
                    icon={Bell}
                    label="새 과제 알림"
                    checked={notifyNewProblem}
                    onChange={setNotifyNewProblem}
                  />
                  <ToggleRow
                    icon={FileText}
                    label="주간 리포트"
                    checked={notifyWeekly}
                    onChange={setNotifyWeekly}
                  />
                  <ToggleRow
                    icon={Trophy}
                    label="티어 변동 알림"
                    checked={notifyTier}
                    onChange={setNotifyTier}
                  />
                </div>
              </div>

              {/* 테마 */}
              {hydrated && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-[0.14em] text-gray-500 mb-2">
                    테마
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["light", "dark"] as const).map((t) => {
                      const active = theme === t;
                      const Icon = t === "light" ? Sun : Moon;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTheme(t)}
                          className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
                            active
                              ? "border-indigo-500 bg-indigo-50/50"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          <Icon size={16} strokeWidth={2} />
                          <span className={active ? "text-indigo-700" : "text-gray-700"}>
                            {t === "light" ? "라이트" : "다크"}
                          </span>
                          {active && (
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-600 text-white">
                              <Check size={10} strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── DANGER ZONE ── */}
        <section
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slide-up"
          style={{ animationFillMode: "both" }}
        >
          <div className="min-w-0">
            <h2 className="font-display font-bold text-gray-900 text-[17px] mb-0.5">
              계정 관리
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              계정 데이터를 관리하거나 삭제할 수 있습니다. 이 작업은 되돌릴 수 없어요.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={resetMockData}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold transition-colors"
            >
              <Database size={14} strokeWidth={2.2} />
              <span>데이터 초기화</span>
            </button>
            <button
              type="button"
              onClick={() => addToast("프로토타입에서는 계정 삭제가 제한됩니다.", "warning")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 text-sm font-semibold transition-colors"
            >
              <Trash2 size={14} strokeWidth={2.2} />
              <span>계정 삭제</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ─── StatChip ─── */

function StatChip({
  icon: Icon,
  label,
  value,
  suffix
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 min-w-[120px]">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/80 mb-1.5">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20">
          <Icon size={11} strokeWidth={2.4} />
        </span>
        <span>{label}</span>
      </div>
      <div className="font-display font-bold text-xl tracking-tight leading-none">
        {value}
        {suffix && <span className="ml-1">{suffix}</span>}
      </div>
    </div>
  );
}

/* ─── ToggleRow ─── */

function ToggleRow({
  icon: Icon,
  label,
  checked,
  onChange
}: {
  icon: LucideIcon;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-gray-500">
          <Icon size={13} strokeWidth={2.2} />
        </span>
        <span className="text-sm text-gray-700 font-medium">{label}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`shrink-0 relative w-11 h-6 rounded-full transition-colors ${
          checked ? "bg-indigo-600" : "bg-gray-200"
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
            checked ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

/* ─── SkillRadar (custom SVG) ─── */

function SkillRadar({
  skills
}: {
  skills: { label: string; score: number }[];
}) {
  const SIZE = 280;
  const CENTER = SIZE / 2;
  const MAX_RADIUS = 100;
  const N = skills.length;
  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const pointFor = (i: number, radius: number) => {
    const a = angleFor(i);
    return { x: CENTER + radius * Math.cos(a), y: CENTER + radius * Math.sin(a) };
  };

  // Concentric rings at 20, 40, 60, 80, 100
  const rings = [20, 40, 60, 80, 100];

  // My average polygon
  const myPoints = skills
    .map((s, i) => {
      const p = pointFor(i, (s.score / 100) * MAX_RADIUS);
      return `${p.x},${p.y}`;
    })
    .join(" ");

  // Everyone's average (fake, slightly below user)
  const avgPoints = skills
    .map((_, i) => {
      const p = pointFor(i, ((55 + ((i * 7) % 18)) / 100) * MAX_RADIUS);
      return `${p.x},${p.y}`;
    })
    .join(" ");

  return (
    <div className="flex justify-center">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="overflow-visible">
        <defs>
          <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0.25" />
          </radialGradient>
        </defs>

        {/* Concentric rings */}
        {rings.map((r) => {
          const points = skills
            .map((_, i) => {
              const p = pointFor(i, (r / 100) * MAX_RADIUS);
              return `${p.x},${p.y}`;
            })
            .join(" ");
          return (
            <polygon
              key={r}
              points={points}
              fill="none"
              stroke="#E5E7EB"
              strokeWidth={1}
            />
          );
        })}

        {/* Axes */}
        {skills.map((_, i) => {
          const end = pointFor(i, MAX_RADIUS);
          return (
            <line
              key={i}
              x1={CENTER}
              y1={CENTER}
              x2={end.x}
              y2={end.y}
              stroke="#E5E7EB"
              strokeWidth={1}
            />
          );
        })}

        {/* Everyone's avg (dashed) */}
        <polygon
          points={avgPoints}
          fill="none"
          stroke="#9CA3AF"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />

        {/* My avg (filled) */}
        <polygon
          points={myPoints}
          fill="url(#radarFill)"
          stroke="#4F46E5"
          strokeWidth={2}
        />
        {skills.map((s, i) => {
          const p = pointFor(i, (s.score / 100) * MAX_RADIUS);
          return <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#4F46E5" />;
        })}

        {/* Labels */}
        {skills.map((s, i) => {
          const label = pointFor(i, MAX_RADIUS + 20);
          const a = angleFor(i);
          // anchor based on angle
          const anchor =
            Math.abs(Math.cos(a)) < 0.2
              ? "middle"
              : Math.cos(a) > 0
                ? "start"
                : "end";
          return (
            <text
              key={i}
              x={label.x}
              y={label.y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fill="#374151"
              fontSize="12"
              fontWeight="600"
            >
              {s.label}
            </text>
          );
        })}

        {/* Ring value labels (20/40/60/80/100 on top axis only) */}
        {rings.map((r) => (
          <text
            key={r}
            x={CENTER + 4}
            y={CENTER - (r / 100) * MAX_RADIUS}
            fill="#9CA3AF"
            fontSize="9"
            dominantBaseline="middle"
          >
            {r}
          </text>
        ))}
      </svg>
    </div>
  );
}
