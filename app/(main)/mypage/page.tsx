"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Key,
  Shield,
  Check,
  Pencil,
  Trash2,
  Sun,
  Moon,
  Database,
  FileText,
  User,
  BarChart2,
  Settings,
  AlertTriangle,
  type LucideIcon
} from "lucide-react";

import { LangIcon } from "@/components/common/LangIcon";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { authApi } from "@/lib/api/authApi";
import { mockApi } from "@/lib/api/mockApi";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { useUiStore } from "@/store/uiStore";

/* ─── BYOK ─── */

type ProviderId = "anthropic" | "openai";

const BYOK_PROVIDERS: {
  id: ProviderId;
  label: string;
  logo: string;
  tint: string;
}[] = [
  { id: "anthropic", label: "Anthropic Claude", logo: "/AI_logo/icons8-claude-ai.svg", tint: "bg-orange-50" },
  { id: "openai", label: "OpenAI ChatGPT", logo: "/AI_logo/icons8-chatgpt.svg", tint: "bg-white" }
];

const BYOK_STORAGE_KEY = "aig-byok-keys-v1";
const PREF_STORAGE_KEY = "aig-user-preferences-v1";

interface UserPreferences {
  defaultLang: "java" | "python";
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

// "skills" 탭은 프로필 통합으로 제거. "activity" → 풀이 기록 (reports API) 으로 의미 변경하고 "history" 로 rename.
type TabId = "profile" | "history" | "apikeys" | "preferences" | "account";

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
      { id: "history", label: "풀이 기록", icon: FileText }
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

export default function MyPage() {
  const { withPrefix } = useRouteScope();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setAuthUser = useAuthStore((s) => s.setUser);
  const addToast = useUiStore((s) => s.addToast);
  const theme = useThemeStore((s) => s.theme);
  const hydrated = useThemeStore((s) => s.hydrated);
  const setTheme = useThemeStore((s) => s.setTheme);

  const [activeTab, setActiveTab] = useState<TabId>("profile");

  // 닉네임 수정
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);

  const { data } = useQuery({
    queryKey: ["mypage", user?.id],
    queryFn: () => mockApi.getMyDashboard(user!.id),
    enabled: !!user
  });

  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: () => authApi.getMe(),
    enabled: !!user
  });

  // 프로필 활동 요약 (총 제출 / 평균 점수 / 진행 중) — 백엔드 endpoint.
  // 실패 시 mock dashboard 값으로 자연스럽게 fallback 되도록 catch.
  const { data: profileSummary } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      try {
        return await authApi.getUserProfile();
      } catch {
        return null;
      }
    },
    enabled: !!user
  });

  // 풀이 기록 (제출 후 리포트 목록) — 백엔드 endpoint. 실패 시 null 로 폴백.
  const [reportsPage, setReportsPage] = useState(0);
  const REPORTS_PAGE_SIZE = 10;
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ["userReports", user?.id, reportsPage],
    queryFn: async () => {
      try {
        return await authApi.getUserReports(reportsPage, REPORTS_PAGE_SIZE);
      } catch {
        return null;
      }
    },
    enabled: !!user
  });

  useEffect(() => {
    if (!profile) return;
    setAuthUser({
      id: String(profile.userId),
      name: profile.nickname,
      email: profile.email,
      provider: profile.provider,
      createdAt: profile.createdAt
    });
  }, [profile, setAuthUser]);

  const name = profile?.nickname ?? user?.name ?? data?.user.name ?? "사용자";
  const email = profile?.email ?? user?.email ?? data?.user.email ?? "user@email.com";
  const initials = name.slice(0, 2).toUpperCase();

  // 신규 사용자: 제출 기록 + 진행 중 세션이 모두 0 이면 가입 직후로 간주.
  // 백엔드 profileSummary 가 있으면 그걸 우선 보고, 없으면 mock dashboard 데이터로 폴백.
  const isNewUser = profileSummary
    ? profileSummary.totalSubmissionCount === 0 && profileSummary.inProgressCount === 0
    : !data ||
      ((data.history?.length ?? 0) === 0 && (data.resumableSessions?.length ?? 0) === 0);

  const skills = useMemo(() => {
    const base = (data?.avgScores ?? []) as { label: string; score: number }[];
    const find = (l: string, fallback: number) =>
      base.find((b) => b.label.includes(l))?.score ?? fallback;

    // 신규 사용자에겐 가짜 점수 대신 0 표시 (집계 데이터 없음)
    const fb = isNewUser ? 0 : null;

    return [
      { label: "하네스 품질", score: fb ?? find("하네스", 72) },
      { label: "실행 품질", score: fb ?? find("실행", 64) },
      { label: "Trace 활용", score: fb ?? find("트레이스", 58) },
      { label: "프롬프트 설계", score: fb ?? Math.round(find("하네스", 72) * 0.9) },
      { label: "자기 피드백", score: fb ?? Math.round(find("실행", 64) * 1.05) }
    ];
  }, [data, isNewUser]);

  const avgSkill =
    Math.round(skills.reduce((a, s) => a + s.score, 0) / skills.length) || 0;


  const [defaultLang, setDefaultLang] = useState<"java" | "python">("java");
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
    const prefs: UserPreferences = { defaultLang, defaultModel };
    localStorage.setItem(PREF_STORAGE_KEY, JSON.stringify(prefs));
  }, [defaultLang, defaultModel, prefsHydrated]);

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

  const startEditNickname = () => {
    setNicknameInput(name);
    setEditingNickname(true);
  };

  const cancelEditNickname = () => {
    setEditingNickname(false);
    setNicknameInput("");
  };

  const saveNickname = async () => {
    const next = nicknameInput.trim();
    if (!next) {
      addToast("닉네임을 입력해 주세요.", "error");
      return;
    }
    if (next.length > 20) {
      addToast("닉네임은 20자 이내여야 합니다.", "error");
      return;
    }
    if (next === name) {
      cancelEditNickname();
      return;
    }
    setSavingNickname(true);
    try {
      const res = await authApi.updateNickname(next);
      setAuthUser({ name: res.nickname });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      addToast("닉네임이 변경되었습니다.", "success");
      setEditingNickname(false);
      setNicknameInput("");
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "닉네임 변경에 실패했습니다.",
        "error"
      );
    } finally {
      setSavingNickname(false);
    }
  };

  return (
    <div className="mypage-page relative min-h-screen bg-[#EEF2FF] overflow-hidden">
      {/* Background grid */}
      <div className="absolute top-0 left-0 right-0 h-[800px] pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      </div>
      <div className="relative max-w-6xl mx-auto px-6 pt-28 pb-16">
        <div className="flex gap-6 items-start">

          {/* ── LEFT SIDEBAR ── */}
          <aside className="w-56 shrink-0 sticky top-28">
            {/* Profile mini card */}
            <div className="mb-4 p-4 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0 ring-1 ring-indigo-100">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-900 truncate">{name}</div>
                <div className="text-xs text-gray-500 truncate" title={email}>{email}</div>
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
                        className={`relative w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors duration-200 ${
                          active
                            ? isDanger
                              ? "bg-white text-rose-600 font-semibold shadow-sm ring-1 ring-rose-100"
                              : "bg-white text-indigo-700 font-semibold shadow-sm ring-1 ring-indigo-100"
                            : isDanger
                              ? "text-rose-400 hover:bg-white/70 hover:text-rose-600"
                              : "text-gray-500 hover:bg-white/70 hover:text-gray-900"
                        }`}
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

                {/* Hero — avatar + 닉네임 + 이메일 + provider 배지 */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700 bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-violet-950/40 shadow-sm">
                  <div className="relative px-6 py-7 flex items-center gap-5">
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 rounded-full blur-2xl bg-indigo-400/30 scale-110" aria-hidden="true" />
                      <div className="relative w-20 h-20 rounded-full bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-display font-black text-2xl shadow-[0_8px_24px_-6px_rgba(99,102,241,0.35)] ring-1 ring-indigo-100 dark:ring-indigo-900/60">
                        {initials}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      {editingNickname ? (
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            value={nicknameInput}
                            onChange={(e) => setNicknameInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void saveNickname();
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                cancelEditNickname();
                              }
                            }}
                            disabled={savingNickname}
                            maxLength={20}
                            autoFocus
                            placeholder="닉네임"
                            className="w-full px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-base font-bold text-gray-900 dark:text-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all disabled:opacity-60"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void saveNickname()}
                              disabled={savingNickname || !nicknameInput.trim()}
                              className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              {savingNickname ? "저장 중..." : "저장"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditNickname}
                              disabled={savingNickname}
                              className="px-3 py-1.5 rounded-md border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              취소
                            </button>
                            <span className="text-[11px] text-gray-400 ml-1 tabular-nums">
                              {nicknameInput.length}/20
                            </span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <h2 className="font-bold text-gray-900 dark:text-slate-100 text-2xl leading-tight truncate">{name}</h2>
                            <button
                              type="button"
                              onClick={startEditNickname}
                              className="shrink-0 p-1.5 rounded-md text-gray-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                              aria-label="닉네임 수정"
                              title="닉네임 수정"
                            >
                              <Pencil size={14} strokeWidth={2.2} />
                            </button>
                            {profile?.provider === "GITHUB" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-900 dark:bg-slate-700 text-white">
                                <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                                GitHub 연결
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
                                LOCAL
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 dark:text-slate-400 truncate" title={email}>{email}</p>
                          {profile?.createdAt && (
                            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                              {new Date(profile.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })} 가입
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats — 백엔드 GET /users/me/profile 우선, 없으면 mock dashboard */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: "총 제출",
                      value: profileSummary?.totalSubmissionCount ?? data?.history.length ?? 0,
                      unit: "회"
                    },
                    {
                      label: "평균 점수",
                      value: profileSummary?.averageScore ?? avgSkill,
                      unit: "점"
                    },
                    {
                      label: "이어가기",
                      value: profileSummary?.inProgressCount ?? data?.resumableSessions.length ?? 0,
                      unit: "개"
                    }
                  ].map((item) => (
                    <div key={item.label} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm px-5 py-4 text-center">
                      <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{item.value}<span className="text-sm font-semibold text-gray-400 dark:text-slate-500 ml-1">{item.unit}</span></div>
                      <div className="text-xs text-gray-500 dark:text-slate-400 mt-1 font-medium">{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* Skills (역량 지표 통합) */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-6">
                  <div className="flex items-baseline justify-between mb-5">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 tracking-tight inline-flex items-center gap-2">
                        <BarChart2 size={16} className="text-indigo-500 dark:text-indigo-400" strokeWidth={2.2} />
                        역량 지표
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">최근 10개 세션 평균 (백엔드 집계 준비 중 — 임시 mock 표시)</p>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">AVG</div>
                      <div className="font-display font-black text-3xl leading-none text-indigo-600 dark:text-indigo-400 tabular-nums">{avgSkill}</div>
                    </div>
                  </div>
                  <SkillRadar skills={skills} />
                  <div className="flex items-center justify-center gap-5 text-xs text-gray-500 dark:text-slate-400 mt-4">
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

            {/* HISTORY (풀이 기록) — GET /users/me/reports 백엔드 endpoint */}
            {activeTab === "history" && (
              <div className="animate-slide-up">
                <SectionHeader title="풀이 기록" desc="제출 후 생성된 리포트 — 점수 / 통과 / 일자" />
                <ReportsTable
                  data={reportsData}
                  loading={reportsLoading}
                  page={reportsPage}
                  setPage={setReportsPage}
                  pageSize={REPORTS_PAGE_SIZE}
                  withPrefix={withPrefix}
                />
              </div>
            )}

            {/* API KEYS */}
            {activeTab === "apikeys" && (
              <div className="animate-slide-up">
                <SectionHeader title="API 키" desc="백엔드 저장 API가 없어 현재는 브라우저에만 저장됩니다." />
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
                <SectionHeader title="환경 설정" desc="기본 언어, AI 모델, 테마" />
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
                        <option>Claude 4.5 Sonnet</option>
                        <option>Claude 4.5 Opus</option>
                        <option>Claude 4.5 Haiku</option>
                        <option>GPT-5.2</option>
                        <option>GPT-5</option>
                        <option>GPT-5 Mini</option>
                        <option>GPT-5 Nano</option>
                      </select>
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

/* ─── ReportsTable (풀이 기록) ─── */

function ReportsTable({
  data,
  loading,
  page,
  setPage,
  pageSize,
  withPrefix
}: {
  data: import("@/lib/api/authApi").UserReportListResponse | null | undefined;
  loading: boolean;
  page: number;
  setPage: (n: number) => void;
  pageSize: number;
  withPrefix: (path: string) => string;
}) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-10 text-center">
        <div className="text-sm text-gray-400 dark:text-slate-500">불러오는 중...</div>
      </div>
    );
  }

  if (!data || data.reports.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 shadow-sm p-10 text-center">
        <div className="text-sm text-gray-400 dark:text-slate-500">아직 제출 후 생성된 리포트가 없어요.</div>
        <div className="text-xs text-gray-400 dark:text-slate-500 mt-1">문제를 풀고 제출하면 여기에 누적돼요.</div>
      </div>
    );
  }

  const totalPages = Math.max(1, data.totalPages || 1);

  const formatScore = (raw: number | string | null | undefined) => {
    if (raw == null) return "—";
    const n = typeof raw === "string" ? parseFloat(raw) : raw;
    return Number.isFinite(n) ? n.toFixed(1) : "—";
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <ul className="divide-y divide-gray-100 dark:divide-slate-800">
        {data.reports.map((report) => {
          const passRate = report.totalCount > 0 ? Math.round((report.passedCount / report.totalCount) * 100) : 0;
          const scoreColor =
            passRate >= 80 ? "text-emerald-600 dark:text-emerald-400" :
            passRate >= 60 ? "text-indigo-600 dark:text-indigo-400" :
            "text-rose-600 dark:text-rose-400";
          return (
            <li key={report.feedbackReportId}>
              <Link
                href={withPrefix(`/submissions/${report.feedbackReportId}/report`)}
                className="group block px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-400 dark:text-slate-500 tabular-nums shrink-0">
                        #{report.problemId}
                      </span>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {report.problemTitle}
                      </h4>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400">
                      <span className="tabular-nums">
                        {new Date(report.createdAt).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-gray-300 dark:text-slate-600">·</span>
                      <span className="tabular-nums">
                        {report.passedCount}<span className="text-gray-300 dark:text-slate-600 mx-0.5">/</span>{report.totalCount} 통과
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xl font-bold tabular-nums ${scoreColor}`}>
                      {formatScore(report.overallScore)}
                      <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 ml-0.5">점</span>
                    </div>
                    <div className="text-[11px] text-gray-400 dark:text-slate-500 tabular-nums">{passRate}% 통과</div>
                  </div>
                  <ChevronRightSmall />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
          <div className="text-xs text-gray-500 dark:text-slate-400">
            총 <span className="font-bold text-gray-700 dark:text-slate-200 tabular-nums">{data.totalCount}</span>개 · {page + 1}/{totalPages} 페이지
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              이전
            </button>
            <button
              type="button"
              onClick={() => setPage(page + 1)}
              disabled={!data.hasNext}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronRightSmall() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 dark:text-slate-600 group-hover:text-indigo-500 transition-colors shrink-0">
      <polyline points="6 4 10 8 6 12" />
    </svg>
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
