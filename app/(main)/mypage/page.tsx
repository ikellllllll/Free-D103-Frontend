"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
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
  CircleCheck,
  Wrench,
  FileText,
  User,
  Activity,
  BarChart2,
  Settings,
  AlertTriangle,
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
  logo: string;
  tint: string;
}[] = [
  { id: "anthropic", label: "Anthropic Claude", logo: "/AI_logo/icons8-claude-ai.svg", tint: "bg-orange-50" },
  { id: "openai", label: "OpenAI ChatGPT", logo: "/AI_logo/icons8-chatgpt.svg", tint: "bg-emerald-50" },
  { id: "google", label: "Google Gemini", logo: "/AI_logo/icons8-gemini-ai.svg", tint: "bg-sky-50" }
];

const BYOK_STORAGE_KEY = "aig-byok-keys-v1";
const PREF_STORAGE_KEY = "aig-user-preferences-v1";

interface UserPreferences {
  defaultLang: "java" | "python";
  notifyNewProblem: boolean;
  notifyWeekly: boolean;
  notifyTier: boolean;
  defaultModel: string;
}

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

/* ─── Nav ─── */

type TabId = "profile" | "activity" | "skills" | "apikeys" | "preferences" | "account";

interface NavItem {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "내 정보",
    items: [
      { id: "profile", label: "프로필", icon: User },
      { id: "activity", label: "최근 활동", icon: Activity }
    ]
  },
  {
    label: "역량",
    items: [
      { id: "skills", label: "역량 지표", icon: BarChart2 }
    ]
  },
  {
    label: "설정",
    items: [
      { id: "apikeys", label: "API 키", icon: Key },
      { id: "preferences", label: "환경 설정", icon: Settings }
    ]
  },
  {
    label: "계정",
    items: [
      { id: "account", label: "계정 관리", icon: AlertTriangle }
    ]
  }
];

/* ─── Page ─── */

export default function Dev2MyPage() {
  const { withPrefix } = useRouteScope();
  const user = useAuthStore((s) => s.user);
  const addToast = useUiStore((s) => s.addToast);
  const theme = useThemeStore((s) => s.theme);
  const hydrated = useThemeStore((s) => s.hydrated);
  const setTheme = useThemeStore((s) => s.setTheme);

  const [activeTab, setActiveTab] = useState<TabId>("profile");

  const { data } = useQuery({
    queryKey: ["mypage", user?.id],
    queryFn: () => mockApi.getMyDashboard(user!.id),
    enabled: !!user
  });

  const name = data?.user.name ?? user?.name ?? "사용자";
  const email = data?.user.email ?? user?.email ?? "user@email.com";
  const initials = name.slice(0, 2).toUpperCase();

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
        sub: "리포트 업데이트됨",
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
        sub: `Lv ${s.level} · ${s.category}`,
        href: s.href,
        action: "이어가기"
      });
    });

    return rows.slice(0, 5);
  }, [data]);

  const [defaultLang, setDefaultLang] = useState<"java" | "python">("java");
  const [notifyNewProblem, setNotifyNewProblem] = useState(true);
  const [notifyWeekly, setNotifyWeekly] = useState(true);
  const [notifyTier, setNotifyTier] = useState(true);
  const [defaultModel, setDefaultModel] = useState("자동 추천");
  const [prefsHydrated, setPrefsHydrated] = useState(false);

  const [byokKeys, setByokKeys] = useState<Partial<Record<ProviderId, string>>>({});
  const [editingProvider, setEditingProvider] = useState<ProviderId | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    setByokKeys(loadByokKeys());
    try {
      const raw = localStorage.getItem(PREF_STORAGE_KEY);
      if (raw) {
        const prefs = JSON.parse(raw) as Partial<UserPreferences>;
        if (prefs.defaultLang === "java" || prefs.defaultLang === "python") {
          setDefaultLang(prefs.defaultLang);
        }
        if (typeof prefs.notifyNewProblem === "boolean") setNotifyNewProblem(prefs.notifyNewProblem);
        if (typeof prefs.notifyWeekly === "boolean") setNotifyWeekly(prefs.notifyWeekly);
        if (typeof prefs.notifyTier === "boolean") setNotifyTier(prefs.notifyTier);
        if (typeof prefs.defaultModel === "string" && prefs.defaultModel.trim()) {
          setDefaultModel(prefs.defaultModel);
        }
      }
    } catch {
      /* ignore corrupted preferences */
    } finally {
      setPrefsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;
    const prefs: UserPreferences = {
      defaultLang,
      notifyNewProblem,
      notifyWeekly,
      notifyTier,
      defaultModel
    };
    localStorage.setItem(PREF_STORAGE_KEY, JSON.stringify(prefs));
  }, [defaultLang, notifyNewProblem, notifyWeekly, notifyTier, defaultModel, prefsHydrated]);

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

  const resetMockData = () => {
    if (!window.confirm("모든 mock 데이터를 초기화할까요? 되돌릴 수 없습니다.")) return;
    localStorage.removeItem("aig-mock-db-v2");
    localStorage.removeItem(BYOK_STORAGE_KEY);
    localStorage.removeItem(PREF_STORAGE_KEY);
    addToast("mock 데이터가 초기화되었습니다. 새로고침해 주세요.", "success");
  };

  return (
    <div className="relative min-h-screen bg-[#EEF2FF] overflow-hidden">
      {/* Background grid */}
      <div className="absolute top-0 left-0 right-0 h-[800px] pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      </div>
      <div className="relative max-w-6xl mx-auto px-6 pt-28 pb-16">
        <div className="flex gap-6 items-start">

          {/* ── LEFT SIDEBAR ── */}
          <aside className="w-56 shrink-0 sticky top-28">
            {/* Profile mini card */}
            <div className="mb-4 p-4 rounded-2xl bg-white/60 backdrop-blur-md border border-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_16px_-4px_rgba(99,102,241,0.12)] flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0 shadow-[0_2px_8px_-2px_rgba(99,102,241,0.2)] ring-1 ring-indigo-100">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-900 truncate">{name}</div>
                <div className="text-xs text-gray-500 truncate">{email}</div>
              </div>
            </div>

            {/* Nav groups */}
            <nav className="flex flex-col gap-1">
              {NAV_GROUPS.map((group) => (
                <div key={group.label} className="mb-2">
                  <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-400/80">
                    {group.label}
                  </div>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    const isDanger = item.id === "account";
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveTab(item.id)}
                        className={`relative w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                          active
                            ? isDanger
                              ? "text-rose-600 font-semibold"
                              : "text-indigo-700 font-semibold"
                            : isDanger
                              ? "text-rose-400 hover:text-rose-600"
                              : "text-gray-500 hover:text-gray-900"
                        }`}
                        style={active ? {
                          background: isDanger
                            ? "linear-gradient(135deg, rgba(254,226,226,0.7) 0%, rgba(255,241,242,0.55) 100%)"
                            : "linear-gradient(135deg, rgba(224,231,255,0.75) 0%, rgba(237,233,254,0.55) 100%)",
                          backdropFilter: "blur(12px)",
                          WebkitBackdropFilter: "blur(12px)",
                          border: isDanger
                            ? "1px solid rgba(252,165,165,0.45)"
                            : "1px solid rgba(165,180,252,0.45)",
                          boxShadow: isDanger
                            ? "inset 0 1px 0 rgba(255,255,255,0.85), 0 4px 12px -4px rgba(239,68,68,0.18), 0 1px 3px rgba(239,68,68,0.08)"
                            : "inset 0 1px 0 rgba(255,255,255,0.85), 0 4px 12px -4px rgba(99,102,241,0.22), 0 1px 3px rgba(99,102,241,0.08)"
                        } : {
                          background: "transparent",
                          border: "1px solid transparent"
                        }}
                      >
                        <Icon
                          size={15}
                          strokeWidth={active ? 2.2 : 1.8}
                          className={
                            active
                              ? isDanger ? "text-rose-500" : "text-indigo-500"
                              : isDanger ? "text-rose-400" : "text-gray-400"
                          }
                        />
                        {item.label}
                        {active && (
                          <span
                            className={`ml-auto w-1.5 h-1.5 rounded-full shadow-sm ${isDanger ? "bg-rose-400" : "bg-indigo-400"}`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
          </aside>

          {/* ── RIGHT CONTENT ── */}
          <main className="flex-1 min-w-0">

            {/* PROFILE */}
            {activeTab === "profile" && (
              <div className="animate-slide-up space-y-4">
                <SectionHeader title="프로필" desc="내 계정 정보와 활동 현황" />

                {/* Top row: avatar card + stat cards */}
                <div className="flex gap-4 items-stretch">
                  {/* Avatar + info */}
                  <div className="relative overflow-hidden bg-white rounded-2xl border border-gray-200 shadow-sm p-7 flex flex-col items-center text-center w-52 shrink-0">
                    {/* Subtle gradient top */}
                    <div
                      className="absolute inset-x-0 top-0 h-24 opacity-60"
                      style={{ background: "linear-gradient(180deg, #eef2ff 0%, transparent 100%)" }}
                      aria-hidden="true"
                    />
                    <div className="relative mb-4">
                      {/* Glow ring */}
                      <div className="absolute inset-0 rounded-full blur-xl bg-indigo-400/30 scale-110" aria-hidden="true" />
                      <div className="relative w-20 h-20 rounded-full bg-white text-indigo-700 flex items-center justify-center font-display font-black text-2xl shadow-[0_4px_16px_-4px_rgba(99,102,241,0.25)] ring-1 ring-indigo-100">
                        {initials}
                      </div>
                      <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-emerald-400 ring-2 ring-white shadow-sm" />
                    </div>
                    <h2 className="relative font-bold text-gray-900 text-base leading-tight mb-1">{name}</h2>
                    <p className="relative text-xs text-gray-500 mb-3 truncate max-w-full">{email}</p>
                    <div className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-semibold text-indigo-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      SSAFY 14기 D103
                    </div>
                  </div>

                  {/* Stat cards grid */}
                  <div className="flex-1 grid grid-cols-1 gap-3">
                    {[
                      { icon: Trophy, label: "랭킹", value: "Top 12%", sub: "전체 참여자 기준", color: "text-amber-500", bg: "bg-amber-50", ring: "ring-amber-100" },
                      { icon: Flame, label: "연속 출석", value: "7일", sub: "현재 streak 유지 중", color: "text-orange-500", bg: "bg-orange-50", ring: "ring-orange-100" },
                      { icon: Shield, label: "티어", value: "Silver II", sub: "다음 티어까지 조금 더", color: "text-slate-500", bg: "bg-slate-50", ring: "ring-slate-200" }
                    ].map((stat) => {
                      const Icon = stat.icon;
                      return (
                        <div key={stat.label} className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                          <span className={`shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl ${stat.bg} ring-1 ${stat.ring} ${stat.color}`}>
                            <Icon size={18} strokeWidth={2} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{stat.label}</div>
                            <div className="text-sm text-gray-500">{stat.sub}</div>
                          </div>
                          <div className="text-lg font-bold text-gray-900 tabular-nums shrink-0">{stat.value}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Info row */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "총 제출", value: data?.history.length ?? 0, unit: "회" },
                    { label: "평균 점수", value: avgSkill, unit: "점" },
                    { label: "이어가기", value: data?.resumableSessions.length ?? 0, unit: "개" }
                  ].map((item) => (
                    <div key={item.label} className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 text-center">
                      <div className="text-2xl font-bold text-indigo-600 tabular-nums">{item.value}<span className="text-sm font-semibold text-gray-400 ml-1">{item.unit}</span></div>
                      <div className="text-xs text-gray-500 mt-1 font-medium">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ACTIVITY */}
            {activeTab === "activity" && (
              <div className="animate-slide-up">
                <SectionHeader title="최근 활동" desc="최근 제출 및 풀이 중인 문제" />
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  {activity.length === 0 ? (
                    <p className="text-sm text-gray-400 py-10 text-center">아직 활동 내역이 없어요.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {activity.map((row) => {
                        const Icon = row.icon;
                        return (
                          <div
                            key={row.id}
                            className="group flex items-center gap-3 px-3 py-3 rounded-xl bg-gray-50 border border-gray-100 transition-all duration-300 hover:bg-white hover:-translate-y-0.5 hover:shadow-sm"
                          >
                            <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gray-100 ring-1 ring-gray-200">
                              <Icon size={15} strokeWidth={2.2} />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] text-gray-400 font-mono mb-0.5 tabular-nums">{row.time}</div>
                              <div className="text-sm text-gray-700">{row.title}</div>
                              <div className="text-xs text-gray-500 mt-0.5">{row.sub}</div>
                            </div>
                            {row.href && row.action && (
                              <Link
                                href={withPrefix(row.href)}
                                className="shrink-0 text-xs font-bold text-gray-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg bg-white ring-1 ring-inset ring-gray-200 hover:ring-indigo-200 transition-colors"
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
              </div>
            )}

            {/* SKILLS */}
            {activeTab === "skills" && (
              <div className="animate-slide-up">
                <SectionHeader title="역량 지표" desc="최근 10개 세션 평균 점수" />
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <div className="flex items-baseline justify-between mb-6">
                    <p className="text-sm text-gray-500">5개 역량 축의 평균 점수입니다.</p>
                    <div className="text-right">
                      <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">AVG</div>
                      <div className="font-display font-black text-3xl leading-none text-indigo-600 tabular-nums">{avgSkill}</div>
                    </div>
                  </div>
                  <SkillRadar skills={skills} />
                  <div className="flex items-center justify-center gap-5 text-xs text-gray-500 mt-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-indigo-500" />내 평균
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-0.5 border-t border-dashed border-gray-400" />전체 평균
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* API KEYS */}
            {activeTab === "apikeys" && (
              <div className="animate-slide-up">
                <SectionHeader title="API 키" desc="내 OpenAI · Anthropic · Google 키를 안전하게 연결" />
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <div className="flex flex-col gap-2">
                    {BYOK_PROVIDERS.map((p) => {
                      const connected = Boolean(byokKeys[p.id]);
                      const isEditing = editingProvider === p.id;
                      return (
                        <div key={p.id}>
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 transition-all duration-300 hover:bg-white hover:-translate-y-0.5 hover:shadow-sm">
                            <span className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg ${p.tint}`}>
                              <Image src={p.logo} alt={p.label} width={22} height={22} />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-gray-900">{p.label}</div>
                              {connected ? (
                                <div className="text-xs text-gray-500 font-mono mt-0.5 truncate">{maskKey(byokKeys[p.id]!)}</div>
                              ) : (
                                <div className="text-xs text-gray-400 mt-0.5">-</div>
                              )}
                            </div>
                            <span
                              className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                                connected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
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
                                  onClick={() => { setEditingProvider(null); setEditValue(""); }}
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

                  <div className="mt-4 flex items-start gap-2.5 bg-indigo-50/70 ring-1 ring-inset ring-indigo-100 rounded-xl px-4 py-2.5 text-xs text-indigo-700">
                    <Shield size={13} strokeWidth={2.2} className="shrink-0 mt-0.5" />
                    <span>키는 브라우저에만 저장되며 서버에는 전송되지 않아요.</span>
                  </div>
                </div>
              </div>
            )}

            {/* PREFERENCES */}
            {activeTab === "preferences" && (
              <div className="animate-slide-up">
                <SectionHeader title="환경 설정" desc="언어, 모델, 알림, 테마 설정" />
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* 기본 언어 */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.14em] text-gray-500 mb-2">기본 언어</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["java", "python"] as const).map((l) => {
                          const active = defaultLang === l;
                          return (
                            <button
                              key={l}
                              type="button"
                              onClick={() => setDefaultLang(l)}
                              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 active:scale-[0.97] ${
                                active
                                  ? "bg-indigo-50 ring-2 ring-inset ring-indigo-400 text-indigo-700"
                                  : "bg-gray-50 ring-1 ring-inset ring-gray-200 text-gray-700 hover:bg-white hover:-translate-y-0.5"
                              }`}
                            >
                              <LangIcon language={l} size={18} />
                              <span>{l === "java" ? "Java" : "Python"}</span>
                              {active && <Check size={14} strokeWidth={2.8} className="text-indigo-600" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 기본 AI 모델 */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.14em] text-gray-500 mb-2">기본 모델</label>
                      <select
                        value={defaultModel}
                        onChange={(e) => setDefaultModel(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-sm font-semibold text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                      >
                        <option>자동 추천</option>
                        <option>Claude Sonnet 4.6</option>
                        <option>GPT-5.4</option>
                        <option>Gemini 2.5 Pro</option>
                      </select>
                    </div>

                    {/* 알림 */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-[0.14em] text-gray-500 mb-2">알림</label>
                      <div className="space-y-1.5">
                        <ToggleRow icon={Bell} label="새 과제 알림" checked={notifyNewProblem} onChange={setNotifyNewProblem} />
                        <ToggleRow icon={FileText} label="주간 리포트" checked={notifyWeekly} onChange={setNotifyWeekly} />
                        <ToggleRow icon={Trophy} label="티어 변동 알림" checked={notifyTier} onChange={setNotifyTier} />
                      </div>
                    </div>

                    {/* 테마 */}
                    {hydrated && (
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold uppercase tracking-[0.14em] text-gray-500 mb-2">테마</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(["light", "dark"] as const).map((t) => {
                            const active = theme === t;
                            const Icon = t === "light" ? Sun : Moon;
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setTheme(t)}
                                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 active:scale-[0.97] ${
                                  active
                                    ? "bg-indigo-50 ring-2 ring-inset ring-indigo-400 text-indigo-700"
                                    : "bg-gray-50 ring-1 ring-inset ring-gray-200 text-gray-700 hover:bg-white hover:-translate-y-0.5"
                                }`}
                              >
                                <Icon size={16} strokeWidth={2} />
                                <span>{t === "light" ? "라이트" : "다크"}</span>
                                {active && <Check size={14} strokeWidth={2.8} className="text-indigo-600" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ACCOUNT */}
            {activeTab === "account" && (
              <div className="animate-slide-up">
                <SectionHeader title="계정 관리" desc="계정 데이터를 관리하거나 삭제할 수 있습니다." />
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <div className="flex items-center gap-2.5 p-4 mb-4 rounded-xl bg-rose-50 border border-rose-100">
                    <AlertTriangle size={15} className="text-rose-500 shrink-0" strokeWidth={2} />
                    <p className="text-sm text-rose-700">이 작업들은 되돌릴 수 없습니다. 신중하게 진행해 주세요.</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">데이터 초기화</div>
                        <div className="text-xs text-gray-500 mt-0.5">모든 mock 데이터와 저장된 API 키를 삭제합니다.</div>
                      </div>
                      <button
                        type="button"
                        onClick={resetMockData}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white ring-1 ring-inset ring-gray-300 text-gray-700 text-sm font-semibold transition-all hover:bg-gray-50 active:scale-[0.97]"
                      >
                        <Database size={14} strokeWidth={2.2} />
                        초기화
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-rose-50/60 border border-rose-100">
                      <div>
                        <div className="text-sm font-semibold text-rose-800">계정 삭제</div>
                        <div className="text-xs text-rose-600 mt-0.5">계정을 영구적으로 삭제합니다.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addToast("프로토타입에서는 계정 삭제가 제한됩니다.", "warning")}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white ring-1 ring-inset ring-rose-200 text-rose-600 text-sm font-semibold transition-all hover:bg-rose-50 active:scale-[0.97]"
                      >
                        <Trash2 size={14} strokeWidth={2.2} />
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </main>
        </div>
      </div>
    </div>
  );
}


/* ─── SectionHeader ─── */

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h2>
      <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
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
    <div className="relative overflow-hidden rounded-2xl px-4 py-3 min-w-[100px] bg-white/15 backdrop-blur-md ring-1 ring-inset ring-white/25 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)] transition-all duration-500 hover:bg-white/20 hover:-translate-y-0.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/85 mb-1.5">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/25 ring-1 ring-inset ring-white/30">
          <Icon size={11} strokeWidth={2.4} />
        </span>
        <span>{label}</span>
      </div>
      <div className="font-display font-black text-xl tracking-tight leading-none">
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
        className={`shrink-0 relative w-11 h-6 rounded-full transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] shadow-[inset_0_2px_4px_rgba(17,24,39,0.12)] ${
          checked ? "bg-gradient-to-br from-indigo-500 to-violet-600" : "bg-gray-300/70"
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-[0_2px_6px_rgba(17,24,39,0.2)] transition-[left,transform] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
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

  const rings = [20, 40, 60, 80, 100];

  const myPoints = skills
    .map((s, i) => {
      const p = pointFor(i, (s.score / 100) * MAX_RADIUS);
      return `${p.x},${p.y}`;
    })
    .join(" ");

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

        {rings.map((r) => {
          const points = skills
            .map((_, i) => {
              const p = pointFor(i, (r / 100) * MAX_RADIUS);
              return `${p.x},${p.y}`;
            })
            .join(" ");
          return <polygon key={r} points={points} fill="none" stroke="#E5E7EB" strokeWidth={1} />;
        })}

        {skills.map((_, i) => {
          const end = pointFor(i, MAX_RADIUS);
          return <line key={i} x1={CENTER} y1={CENTER} x2={end.x} y2={end.y} stroke="#E5E7EB" strokeWidth={1} />;
        })}

        <polygon points={avgPoints} fill="none" stroke="#9CA3AF" strokeWidth={1.5} strokeDasharray="4 4" />
        <polygon points={myPoints} fill="url(#radarFill)" stroke="#4F46E5" strokeWidth={2} />
        {skills.map((s, i) => {
          const p = pointFor(i, (s.score / 100) * MAX_RADIUS);
          return <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#4F46E5" />;
        })}

        {skills.map((s, i) => {
          const label = pointFor(i, MAX_RADIUS + 20);
          const a = angleFor(i);
          const anchor =
            Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
          return (
            <text key={i} x={label.x} y={label.y} textAnchor={anchor} dominantBaseline="middle" fill="#374151" fontSize="12" fontWeight="600">
              {s.label}
            </text>
          );
        })}

        {rings.map((r) => (
          <text key={r} x={CENTER + 4} y={CENTER - (r / 100) * MAX_RADIUS} fill="#9CA3AF" fontSize="9" dominantBaseline="middle">
            {r}
          </text>
        ))}
      </svg>
    </div>
  );
}
