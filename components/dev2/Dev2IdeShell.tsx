"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Sparkles,
  Pin,
  Play,
  Send,
  Code2,
  FileText,
  GitBranch,
  TestTube,
  Bot,
  FolderTree,
  Search,
  Plus,
  Save,
  Settings,
  Command,
  Sun,
  Moon,
  Wrench,
  Check,
  ChevronRight,
  ChevronDown,
  Paperclip,
  Slash,
  Mic,
  AlertCircle,
  Zap,
  ExternalLink,
  Filter,
  SlidersHorizontal,
  X,
  Clock,
  Trash2,
  SplitSquareVertical,
  ListChecks,
  type LucideIcon
} from "lucide-react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";

/* ───────────────────────────────────────────────── Types + mock data */

type TabKey = "code" | "problem" | "trace";
type RailKey = "files" | "problem" | "trace" | "tests" | "ai";

type TreeNode =
  | {
      kind: "folder";
      name: string;
      children: TreeNode[];
      defaultOpen?: boolean;
    }
  | {
      kind: "file";
      name: string;
      path: string;
      language?: "java" | "md" | "xml" | "yml";
      dirty?: boolean;
      tag?: "U" | "M" | "D" | "H";
    };

const MOCK_TREE: TreeNode[] = [
  {
    kind: "folder",
    name: "src",
    defaultOpen: true,
    children: [
      {
        kind: "folder",
        name: "main",
        defaultOpen: true,
        children: [
          {
            kind: "folder",
            name: "java/com.aig.todo",
            defaultOpen: true,
            children: [
              {
                kind: "file",
                name: "TodoApi.java",
                path: "src/main/java/com/aig/todo/TodoApi.java",
                language: "java",
                dirty: true
              },
              {
                kind: "file",
                name: "TodoService.java",
                path: "src/main/java/com/aig/todo/TodoService.java",
                language: "java"
              },
              {
                kind: "file",
                name: "Todo.java",
                path: "src/main/java/com/aig/todo/Todo.java",
                language: "java"
              }
            ]
          },
          { kind: "folder", name: "exceptions", children: [] },
          { kind: "folder", name: "resources", children: [] }
        ]
      },
      { kind: "folder", name: "test", children: [] }
    ]
  },
  {
    kind: "file",
    name: "pom.xml",
    path: "pom.xml",
    language: "xml"
  },
  {
    kind: "file",
    name: "HARNESS.md",
    path: "HARNESS.md",
    language: "md",
    tag: "H"
  },
  {
    kind: "file",
    name: "instuction.md",
    path: "instuction.md",
    language: "md",
    tag: "M"
  }
];

const CODE_LINES: { n: number; tokens: { cls: string; text: string }[] }[] = [
  { n: 28, tokens: [{ cls: "text-indigo-700 font-semibold", text: "package" }, { cls: "text-gray-700", text: " com.aig.todo;" }] },
  { n: 29, tokens: [{ cls: "", text: "" }] },
  { n: 30, tokens: [
    { cls: "text-indigo-700 font-semibold", text: "import" },
    { cls: "text-gray-700", text: " org.springframework.http.ResponseEntity;" }
  ]},
  { n: 31, tokens: [
    { cls: "text-indigo-700 font-semibold", text: "import" },
    { cls: "text-gray-700", text: " org.springframework.web.bind.annotation.*;" }
  ]},
  { n: 32, tokens: [
    { cls: "text-indigo-700 font-semibold", text: "import" },
    { cls: "text-gray-700", text: " jakarta.validation.Valid;" }
  ]},
  { n: 33, tokens: [
    { cls: "text-indigo-700 font-semibold", text: "import" },
    { cls: "text-gray-700", text: " lombok.RequiredArgsConstructor;" }
  ]},
  { n: 34, tokens: [{ cls: "", text: "" }] },
  { n: 35, tokens: [{ cls: "text-teal-700", text: "@RestController" }] },
  { n: 36, tokens: [{ cls: "text-teal-700", text: "@RequestMapping" }, { cls: "text-gray-600", text: "(" }, { cls: "text-amber-700", text: "\"/api/todos\"" }, { cls: "text-gray-600", text: ")" }] },
  { n: 37, tokens: [{ cls: "text-teal-700", text: "@RequiredArgsConstructor" }] },
  { n: 38, tokens: [
    { cls: "text-indigo-700 font-semibold", text: "public class " },
    { cls: "text-teal-700 font-semibold", text: "TodoApi" },
    { cls: "text-gray-700", text: " {" }
  ]},
  { n: 39, tokens: [
    { cls: "text-gray-700", text: "  " },
    { cls: "text-indigo-700 font-semibold", text: "private final " },
    { cls: "text-teal-700", text: "TodoService" },
    { cls: "text-gray-700", text: " todoService;" }
  ]},
  { n: 40, tokens: [{ cls: "", text: "" }] },
  { n: 41, tokens: [{ cls: "text-gray-700", text: "  " }, { cls: "text-teal-700", text: "@PostMapping" }] },
  { n: 42, active: true, tokens: [
    { cls: "text-gray-700", text: "  " },
    { cls: "text-indigo-700 font-semibold", text: "public " },
    { cls: "text-teal-700", text: "ResponseEntity" },
    { cls: "text-gray-600", text: "<" },
    { cls: "text-teal-700", text: "Todo" },
    { cls: "text-gray-600", text: ">" },
    { cls: "text-gray-700", text: " create(" },
    { cls: "text-teal-700", text: "@Valid @RequestBody " },
    { cls: "text-teal-700", text: "Todo" },
    { cls: "text-gray-700", text: " todo) {" }
  ]} as { n: number; tokens: { cls: string; text: string }[]; active?: boolean; suggestion?: string },
  { n: 43, tokens: [
    { cls: "text-gray-700", text: "    " },
    { cls: "text-gray-400 italic", text: "// AI suggestion: validate email format before save" }
  ]},
  { n: 44, tokens: [
    { cls: "text-gray-700", text: "    " },
    { cls: "text-teal-700", text: "Todo" },
    { cls: "text-gray-700", text: " saved = todoService.create(todo);" }
  ]},
  { n: 45, tokens: [
    { cls: "text-gray-700", text: "    " },
    { cls: "text-indigo-700 font-semibold", text: "return" },
    { cls: "text-gray-700", text: " ResponseEntity.status(" },
    { cls: "text-amber-700", text: "201" },
    { cls: "text-gray-700", text: ").body(saved);" }
  ]},
  { n: 46, tokens: [{ cls: "text-gray-700", text: "  }" }] },
  { n: 47, tokens: [{ cls: "", text: "" }] },
  { n: 48, tokens: [{ cls: "text-gray-700", text: "  " }, { cls: "text-teal-700", text: "@GetMapping" }, { cls: "text-gray-600", text: "(" }, { cls: "text-amber-700", text: "\"/{id}\"" }, { cls: "text-gray-600", text: ")" }] },
  { n: 49, tokens: [
    { cls: "text-gray-700", text: "  " },
    { cls: "text-indigo-700 font-semibold", text: "public " },
    { cls: "text-teal-700", text: "ResponseEntity" },
    { cls: "text-gray-600", text: "<" },
    { cls: "text-teal-700", text: "Todo" },
    { cls: "text-gray-600", text: "> getById(" },
    { cls: "text-teal-700", text: "@PathVariable " },
    { cls: "text-teal-700", text: "Long" },
    { cls: "text-gray-700", text: " id) {" }
  ]},
  { n: 50, tokens: [
    { cls: "text-gray-700", text: "    " },
    { cls: "text-indigo-700 font-semibold", text: "return" },
    { cls: "text-gray-700", text: " todoService.getById(id)" }
  ]}
];

/* AI Pair mock messages */
type ChatMessage =
  | { kind: "system"; text: string }
  | { kind: "user"; time: string; text: string }
  | {
      kind: "ai";
      time: string;
      text: string;
      codeBlock?: string;
      actions?: { label: string; tone: "indigo" | "teal" | "gray" }[];
    }
  | { kind: "tool"; label: string; status: "ok" | "fail" }
  | { kind: "streaming"; text: string };

const MOCK_MESSAGES: ChatMessage[] = [
  {
    kind: "system",
    text: "I've read TodoApi.java and the 2 failing tests. Want me to propose a fix?"
  },
  { kind: "user", time: "10:43 AM", text: "Yes, focus on the NPE on line 42." },
  {
    kind: "ai",
    time: "10:43 AM",
    text: "The NPE occurs when todo is null on line 42. I'll add null checks and email validation before saving.",
    codeBlock: `if (todo == null) {
  throw new IllegalArgumentException("Todo cannot be null");
}
if (todo.getUserEmail() != null &&
    !EmailValidator.isValid(todo.getUserEmail())) {
  throw new IllegalArgumentException("Invalid email format");
}`,
    actions: [
      { label: "Apply patch", tone: "teal" },
      { label: "Show diff", tone: "gray" },
      { label: "Run tests again", tone: "gray" }
    ]
  },
  { kind: "tool", label: "run_tests() — 2/3 pass", status: "ok" },
  {
    kind: "streaming",
    text:
      "The tests improved! One failure remains in TodoServiceTest.testDuplicateTitle(). Working on it…"
  }
];

/* ───────────────────────────────────────────────── Root */

export function Dev2IdeShell({ sessionId }: { sessionId: string }) {
  const { withPrefix } = useRouteScope();
  const [activeRail, setActiveRail] = useState<RailKey>("files");
  const [activeTab, setActiveTab] = useState<TabKey>("code");
  const [composerValue, setComposerValue] = useState("");
  const [attachments, setAttachments] = useState<string[]>([
    "TodoApi.java",
    "test/TodoApiTest.java"
  ]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#FAFAFC] overflow-hidden">
      <TopBar sessionId={sessionId} withPrefix={withPrefix} />

      {/* Body */}
      <div className="flex-1 flex min-h-0 gap-2 p-2">
        <ActivityRail active={activeRail} onChange={setActiveRail} />

        <SecondaryPanel railKey={activeRail} />

        <div className="flex-1 flex flex-col min-w-0 gap-2">
          <MainWorkspace
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          <BottomTray />
        </div>

        <AiPairPanel
          composerValue={composerValue}
          setComposerValue={setComposerValue}
          attachments={attachments}
          setAttachments={setAttachments}
        />
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────── TopBar */

function TopBar({
  sessionId,
  withPrefix
}: {
  sessionId: string;
  withPrefix: (p: string) => string;
}) {
  const shortId = sessionId.replace(/^session-/, "").slice(0, 6);
  return (
    <header className="h-14 shrink-0 bg-white border-b border-gray-100 flex items-center px-4 gap-4">
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href={withPrefix("/problems")}
          className="inline-flex items-center gap-1.5 font-display font-bold text-gray-900"
        >
          <Sparkles size={18} strokeWidth={2.2} className="text-indigo-600" />
          <span>AIG</span>
        </Link>
        <span className="h-5 w-px bg-gray-200" />
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 font-mono truncate">
          <Link href={withPrefix("/problems")} className="hover:text-indigo-600 transition-colors">
            problems
          </Link>
          <ChevronRight size={12} className="text-gray-300" />
          <Link
            href={withPrefix("/problems/jwt-auth")}
            className="hover:text-indigo-600 transition-colors"
          >
            jwt-auth
          </Link>
          <ChevronRight size={12} className="text-gray-300" />
          <span className="text-gray-700">session #{shortId || "a1b2c3"}</span>
        </nav>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700">
          Lv 2
        </span>
      </div>

      {/* Center status */}
      <div className="flex-1 flex items-center justify-center gap-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-indigo-500 opacity-60 animate-ping" />
            <span className="relative w-2 h-2 rounded-full bg-indigo-500" />
          </span>
          <span className="text-xs font-semibold text-indigo-700">Status: solving</span>
        </div>
        <span className="text-xs font-mono text-gray-700 tabular-nums">24:18</span>
        <span className="text-xs text-gray-400">autosaved 2s ago</span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-teal-300 text-teal-700 text-sm font-semibold hover:bg-teal-50 transition-colors"
        >
          <Play size={13} strokeWidth={2.4} fill="currentColor" />
          <span>Run tests</span>
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-white text-sm font-bold transition-all shadow-sm hover:shadow-md"
          style={{
            backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED)"
          }}
        >
          <Send size={13} strokeWidth={2.4} />
          <span>Submit</span>
        </button>
        <div className="ml-2 w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
          JD
        </div>
      </div>
    </header>
  );
}

/* ───────────────────────────────────────────────── ActivityRail */

function ActivityRail({
  active,
  onChange
}: {
  active: RailKey;
  onChange: (k: RailKey) => void;
}) {
  const items: { key: RailKey; icon: LucideIcon; label: string }[] = [
    { key: "files", icon: FolderTree, label: "Files" },
    { key: "problem", icon: ListChecks, label: "Problem" },
    { key: "trace", icon: GitBranch, label: "Trace" },
    { key: "tests", icon: TestTube, label: "Tests" },
    { key: "ai", icon: Bot, label: "AI" }
  ];
  return (
    <aside className="w-14 shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center py-3 gap-1">
      {items.map((it) => {
        const isActive = it.key === active;
        const Icon = it.icon;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            title={it.label}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
              isActive
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            <Icon size={16} strokeWidth={2.2} />
          </button>
        );
      })}
      <div className="flex-1" />
      <div className="w-8 h-px bg-gray-100 my-1" />
      <button
        type="button"
        title="Shortcuts (Ctrl+K)"
        className="w-9 h-9 rounded-xl text-gray-500 hover:bg-gray-100 flex items-center justify-center transition-colors"
      >
        <Command size={14} strokeWidth={2.2} />
      </button>
      <button
        type="button"
        title="Theme"
        className="w-9 h-9 rounded-xl text-gray-500 hover:bg-gray-100 flex items-center justify-center transition-colors"
      >
        <Sun size={14} strokeWidth={2.2} />
      </button>
    </aside>
  );
}

/* ───────────────────────────────────────────────── SecondaryPanel (Files tree, etc.) */

function SecondaryPanel({ railKey }: { railKey: RailKey }) {
  if (railKey === "files") return <FilesPanel />;
  if (railKey === "tests") return <SidePlaceholder title="Test Runs" />;
  if (railKey === "problem") return <SidePlaceholder title="Problem Outline" />;
  if (railKey === "trace") return <SidePlaceholder title="Trace Sessions" />;
  return <SidePlaceholder title="Assistants" />;
}

function FilesPanel() {
  return (
    <aside className="w-64 shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-gray-900 text-[15px]">Files</span>
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
            4
          </span>
        </div>
        <button
          type="button"
          className="w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-indigo-600 flex items-center justify-center transition-colors"
          title="New file"
        >
          <Plus size={14} strokeWidth={2.4} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <Search
            size={12}
            strokeWidth={2}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            placeholder="Search files"
            className="w-full pl-7 pr-2 py-1.5 rounded-md bg-gray-50 border border-gray-100 text-xs text-gray-700 placeholder-gray-400 focus:bg-white focus:border-indigo-300 outline-none"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-2 px-2 text-sm">
        <div className="mb-1 px-2 text-[10px] font-mono text-gray-400 uppercase tracking-wider">
          src/main/java/...
        </div>
        <TreeView nodes={MOCK_TREE} activePath="src/main/java/com/aig/todo/TodoApi.java" />
      </div>

      {/* Run output collapsed card */}
      <div className="border-t border-gray-100 px-3 py-2.5">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-5 h-5 rounded bg-green-100 text-green-700 flex items-center justify-center shrink-0">
              <Check size={11} strokeWidth={3} />
            </span>
            <span className="text-xs text-gray-700 truncate">
              <strong className="font-semibold">Run output</strong>
              <span className="text-gray-400"> · build successful · 3.8s</span>
            </span>
          </span>
          <ChevronDown size={12} className="text-gray-400 shrink-0" />
        </button>
      </div>
    </aside>
  );
}

function TreeView({
  nodes,
  activePath,
  depth = 0
}: {
  nodes: TreeNode[];
  activePath: string;
  depth?: number;
}) {
  return (
    <div>
      {nodes.map((node, i) => (
        <TreeNodeRow key={i} node={node} activePath={activePath} depth={depth} />
      ))}
    </div>
  );
}

function TreeNodeRow({
  node,
  activePath,
  depth
}: {
  node: TreeNode;
  activePath: string;
  depth: number;
}) {
  const [open, setOpen] = useState(
    node.kind === "folder" ? Boolean(node.defaultOpen) : false
  );

  if (node.kind === "folder") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-50 text-left text-gray-700"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {open ? (
            <ChevronDown size={12} className="text-gray-400 shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-gray-400 shrink-0" />
          )}
          <FolderTree size={13} className="text-indigo-500 shrink-0" />
          <span className="text-sm font-mono truncate">{node.name}</span>
        </button>
        {open && (
          <TreeView nodes={node.children} activePath={activePath} depth={depth + 1} />
        )}
      </div>
    );
  }

  const isActive = node.path === activePath;
  return (
    <div
      className={`relative flex items-center gap-1.5 py-1 rounded-md text-[13px] font-mono cursor-pointer transition-colors ${
        isActive ? "bg-indigo-50/70" : "hover:bg-gray-50"
      }`}
      style={{ paddingLeft: `${depth * 12 + 18}px`, paddingRight: "8px" }}
    >
      {isActive && (
        <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-indigo-500 rounded-r" />
      )}
      <FileIcon node={node} />
      <span
        className={`flex-1 truncate ${
          isActive ? "text-indigo-900 font-semibold" : "text-gray-700"
        }`}
      >
        {node.name}
      </span>
      {node.dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />}
      {node.tag && (
        <span
          className={`text-[9px] font-bold uppercase shrink-0 px-1 rounded ${
            node.tag === "H"
              ? "bg-indigo-100 text-indigo-700"
              : node.tag === "M"
                ? "bg-gray-100 text-gray-600"
                : "bg-amber-100 text-amber-700"
          }`}
        >
          {node.tag}
        </span>
      )}
    </div>
  );
}

function FileIcon({ node }: { node: TreeNode }) {
  if (node.kind !== "file") return null;
  const letter =
    node.language === "java"
      ? "J"
      : node.language === "md"
        ? "M"
        : node.language === "yml"
          ? "Y"
          : node.language === "xml"
            ? "X"
            : "T";
  const tint =
    node.language === "java"
      ? "bg-orange-100 text-orange-700"
      : node.language === "md"
        ? "bg-slate-100 text-slate-600"
        : node.language === "yml"
          ? "bg-teal-100 text-teal-700"
          : node.language === "xml"
            ? "bg-amber-100 text-amber-700"
            : "bg-gray-100 text-gray-600";
  return (
    <span
      className={`shrink-0 w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center ${tint}`}
    >
      {letter}
    </span>
  );
}

function SidePlaceholder({ title }: { title: string }) {
  return (
    <aside className="w-64 shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100">
        <span className="font-display font-bold text-gray-900 text-[15px]">{title}</span>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 text-center">
        <p className="text-xs text-gray-400">곧 추가될 예정입니다.</p>
      </div>
    </aside>
  );
}

/* ───────────────────────────────────────────────── MainWorkspace */

function MainWorkspace({
  activeTab,
  onTabChange
}: {
  activeTab: TabKey;
  onTabChange: (t: TabKey) => void;
}) {
  const tabs: {
    key: TabKey;
    label: string;
    icon: LucideIcon;
    dirty?: boolean;
    count?: number;
  }[] = [
    { key: "code", label: "Code", icon: Code2, dirty: true },
    { key: "problem", label: "Problem", icon: ListChecks },
    { key: "trace", label: "Trace", icon: GitBranch, count: 12 }
  ];

  return (
    <section className="flex-1 min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
      {/* Tab strip */}
      <div className="flex items-end border-b border-gray-100 px-3 pt-2 gap-1">
        {tabs.map((t) => {
          const active = activeTab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onTabChange(t.key)}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm transition-colors ${
                active
                  ? "bg-white text-indigo-700 font-bold"
                  : "text-gray-500 hover:text-gray-700 font-medium"
              }`}
            >
              <Icon
                size={14}
                strokeWidth={2.2}
                className={active ? "text-indigo-600" : "text-gray-400"}
              />
              <span>{t.label}</span>
              {t.dirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
              {t.count != null && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    active ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {t.count}
                </span>
              )}
              {active && (
                <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === "code" && <CodeView />}
        {activeTab === "problem" && <ProblemView />}
        {activeTab === "trace" && <TraceView />}
      </div>
    </section>
  );
}

/* ─── Code View ─── */

function CodeView() {
  return (
    <>
      {/* Sub-toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/50 gap-3">
        <div className="flex items-center gap-2.5 min-w-0 text-sm">
          <code className="font-mono text-gray-700 truncate">
            src/main/java/com/aig/todo/TodoApi.java
          </code>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
            unsaved
          </span>
          <span className="text-xs text-gray-400 tabular-nums">34 lines</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ToolbarBtn icon={SlidersHorizontal} label="Format" />
          <ToolbarBtn icon={Search} label="Find" />
          <ToolbarBtn icon={Command} label="Vim off" muted />
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Line numbers + code */}
        <div className="flex-1 min-w-0 overflow-auto bg-[#FAFAFB] font-mono text-[13px] leading-6">
          <pre className="flex">
            {/* Line numbers */}
            <span className="select-none shrink-0 w-12 text-right pr-3 py-3 text-gray-400">
              {CODE_LINES.map((l, i) => (
                <div key={i}>{l.n}</div>
              ))}
            </span>
            {/* Code */}
            <code className="flex-1 py-3 pr-6">
              {CODE_LINES.map((l, i) => {
                const active = (l as { active?: boolean }).active;
                return (
                  <div
                    key={i}
                    className={`relative min-h-[24px] ${active ? "bg-indigo-50" : ""}`}
                  >
                    {active && (
                      <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-indigo-500" />
                    )}
                    {l.tokens.map((t, ti) => (
                      <span key={ti} className={t.cls}>
                        {t.text}
                      </span>
                    ))}
                    {active && (
                      <span className="ml-3 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-900 text-gray-100 align-middle">
                        <span className="font-mono text-[9px] bg-white/20 px-1 rounded">
                          Tab
                        </span>
                        accept
                      </span>
                    )}
                  </div>
                );
              })}
            </code>
          </pre>
        </div>

        {/* Minimap */}
        <div className="hidden xl:block w-20 shrink-0 border-l border-gray-100 bg-[#FAFAFB] relative overflow-hidden">
          <div className="absolute inset-0 p-1 flex flex-col gap-[2px]">
            {Array.from({ length: 40 }).map((_, i) => {
              const w = 20 + ((i * 7) % 60);
              const color =
                i === 14
                  ? "bg-indigo-500/70"
                  : i % 5 === 0
                    ? "bg-teal-400/40"
                    : i % 3 === 0
                      ? "bg-indigo-400/30"
                      : "bg-gray-300/40";
              return (
                <span
                  key={i}
                  className={`h-1 rounded-sm ${color}`}
                  style={{ width: `${w}%` }}
                />
              );
            })}
          </div>
          {/* Viewport box */}
          <div className="absolute left-0 right-0 h-20 top-32 bg-indigo-500/5 border-y border-indigo-300" />
        </div>
      </div>

      {/* Status bar */}
      <div className="h-6 shrink-0 flex items-center justify-between px-4 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-500">
        <span>Ln 42, Col 16 · UTF-8 · LF · Java 17</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          AI context: 3 files attached
        </span>
      </div>
    </>
  );
}

function ToolbarBtn({
  icon: Icon,
  label,
  muted
}: {
  icon: LucideIcon;
  label: string;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold border transition-colors ${
        muted
          ? "text-gray-400 border-gray-100 hover:bg-gray-50"
          : "text-gray-600 border-gray-200 bg-white hover:border-indigo-300 hover:text-indigo-600"
      }`}
    >
      <Icon size={11} strokeWidth={2.2} />
      <span>{label}</span>
    </button>
  );
}

/* ─── Problem View ─── */

function ProblemView() {
  const requirements = [
    "Login with email & password returns access + refresh tokens",
    "Refresh token issues a new access token",
    "Access to /api/me requires a valid access token",
    "Logout invalidates the refresh token",
    "Use RS256 signing and store refresh tokens securely",
    "Write unit and integration tests"
  ];

  const endpoints = [
    { method: "POST", path: "/api/auth/login", desc: "Authenticate user", auth: "None", req: "{ email, password }", res: "{ accessToken, refreshToken }" },
    { method: "POST", path: "/api/auth/refresh", desc: "Refresh access token", auth: "None", req: "{ refreshToken }", res: "{ accessToken }" },
    { method: "GET", path: "/api/me", desc: "Get current user", auth: "Bearer", req: "—", res: "{ user }" },
    { method: "POST", path: "/api/auth/logout", desc: "Logout user", auth: "Bearer", req: "—", res: "{ message }" }
  ];

  return (
    <div className="flex-1 min-h-0 overflow-auto px-8 py-7">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-3xl font-display font-bold text-gray-900 tracking-tight">
          JWT Authentication Flow
        </h1>
        <span className="text-[10px] font-bold px-2 py-1 rounded bg-indigo-100 text-indigo-700">
          API Impl
        </span>
        <span className="text-[10px] font-bold px-2 py-1 rounded bg-amber-100 text-amber-700">
          Lv 2
        </span>
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:border-indigo-300 hover:text-indigo-600 text-sm font-semibold text-gray-700 transition-colors"
        >
          <ExternalLink size={13} strokeWidth={2.2} />
          <span>Open in editor</span>
        </button>
      </div>

      <p className="text-[15px] text-gray-600 leading-relaxed mb-6 max-w-3xl">
        Implement a secure JWT-based authentication flow for the REST API. Users should
        be able to login, refresh tokens, access their profile, and logout. Access to
        protected endpoints must require a valid access token.
      </p>

      <h2 className="font-display font-bold text-gray-900 text-lg mb-3">Requirements</h2>
      <ul className="space-y-2 mb-8">
        {requirements.map((r) => (
          <li key={r} className="flex items-start gap-2.5 text-[15px] text-gray-700">
            <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600">
              <Check size={11} strokeWidth={3} />
            </span>
            <span>{r}</span>
          </li>
        ))}
      </ul>

      <h2 className="font-display font-bold text-gray-900 text-lg mb-3">API Endpoints</h2>
      <div className="rounded-xl border border-gray-200 overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Method</th>
              <th className="text-left px-3 py-2 font-semibold">Endpoint</th>
              <th className="text-left px-3 py-2 font-semibold">Description</th>
              <th className="text-left px-3 py-2 font-semibold">Auth</th>
              <th className="text-left px-3 py-2 font-semibold">Request</th>
              <th className="text-left px-3 py-2 font-semibold">Response</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.map((e) => (
              <tr key={e.path} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  <span
                    className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                      e.method === "GET"
                        ? "bg-green-100 text-green-700"
                        : "bg-indigo-100 text-indigo-700"
                    }`}
                  >
                    {e.method}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-gray-700">{e.path}</td>
                <td className="px-3 py-2 text-gray-600">{e.desc}</td>
                <td className="px-3 py-2 text-gray-500">{e.auth}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-gray-500">{e.req}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-gray-500">{e.res}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-start justify-between gap-4 p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
        <div>
          <h3 className="font-display font-bold text-gray-900 text-[15px] mb-2">
            Notes & Acceptance Criteria
          </h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• Access token TTL: 15m, Refresh token TTL: 7d</li>
            <li>• Refresh token rotation on each use</li>
            <li>• Revoked refresh tokens cannot be reused</li>
            <li>• All endpoints return appropriate HTTP status codes</li>
            <li>• 100% tests passing</li>
          </ul>
        </div>
        <div className="shrink-0 text-center bg-white rounded-xl border border-indigo-100 px-5 py-3">
          <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-1">
            <Clock size={10} />
            Estimated time
          </div>
          <div className="font-display font-bold text-gray-900">90–120 min</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Trace View ─── */

function TraceView() {
  const spans = [
    { name: "orchestrator", kind: "root", start: 0, dur: 6420 },
    { name: "plan-next-step", kind: "llm", start: 0, dur: 1210, active: true },
    { name: "reasoning", kind: "llm", start: 1210, dur: 980 },
    { name: "list_checks", kind: "tool", start: 2190, dur: 780 },
    { name: "read_problem_brief", kind: "tool", start: 2970, dur: 420 },
    { name: "search_codebase", kind: "tool", start: 3390, dur: 680 },
    { name: "apply_patch (attempt 1)", kind: "patch", start: 4070, dur: 1520 },
    { name: "run_tests", kind: "tool", start: 4070, dur: 1080 },
    { name: "apply_patch (retry 2)", kind: "patch", start: 5150, dur: 1330 },
    { name: "run_tests", kind: "tool", start: 5150, dur: 890 }
  ];
  const total = 6420;

  return (
    <div className="flex-1 min-h-0 overflow-auto p-5">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="inline-flex items-center gap-1.5 font-mono text-sm text-gray-700">
          <GitBranch size={14} className="text-indigo-600" />
          Run a1b2c3f4
        </span>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-500 tabular-nums">10:41:02 AM</span>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-700 font-semibold tabular-nums">6.42s</span>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-700 font-semibold tabular-nums">42 spans</span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Live
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <ToolbarBtn icon={Filter} label="Filters" />
          <ToolbarBtn icon={SlidersHorizontal} label="View options" />
        </div>
      </div>

      {/* Waterfall */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {/* Time ticks header */}
        <div className="flex items-center text-[10px] text-gray-400 font-mono border-b border-gray-100 px-3 py-2">
          <span className="w-56 shrink-0" />
          <div className="flex-1 relative h-3">
            {[0, 1, 2, 3, 4, 5, 6].map((s) => (
              <span
                key={s}
                className="absolute top-0 tabular-nums"
                style={{ left: `${((s * 1000) / total) * 100}%` }}
              >
                {s}s
              </span>
            ))}
          </div>
        </div>

        {spans.map((s, i) => {
          const left = (s.start / total) * 100;
          const width = (s.dur / total) * 100;
          const color =
            s.kind === "llm"
              ? "#A78BFA"
              : s.kind === "tool"
                ? "#5EEAD4"
                : s.kind === "patch"
                  ? "#FCD34D"
                  : "#818CF8";
          return (
            <div
              key={i}
              className={`flex items-center text-xs px-3 py-1.5 border-b border-gray-50 last:border-b-0 ${
                s.active ? "bg-indigo-50/60" : "hover:bg-gray-50"
              }`}
            >
              <div
                className={`w-56 shrink-0 flex items-center gap-2 font-mono truncate pl-${Math.min(3, i) * 2}`}
                style={{ paddingLeft: i === 0 ? 0 : `${Math.min(i, 3) * 12}px` }}
              >
                {s.kind === "root" ? (
                  <ChevronDown size={10} className="text-gray-400" />
                ) : (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                )}
                <span
                  className={`truncate ${s.active ? "text-indigo-900 font-semibold" : "text-gray-700"}`}
                >
                  {s.name}
                </span>
              </div>
              <div className="flex-1 relative h-5">
                <div
                  className="absolute top-0.5 h-4 rounded-sm"
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(width, 0.5)}%`,
                    backgroundColor: color,
                    opacity: s.active ? 1 : 0.85
                  }}
                />
                <span
                  className="absolute top-0.5 h-4 flex items-center text-[10px] text-gray-500 font-mono tabular-nums"
                  style={{ left: `calc(${left + width}% + 6px)` }}
                >
                  {s.dur < 1000 ? `${s.dur}ms` : `${(s.dur / 1000).toFixed(2)}s`}
                </span>
              </div>
            </div>
          );
        })}

        {/* Legend */}
        <div className="flex items-center gap-5 px-3 py-2 border-t border-gray-100 bg-gray-50/50">
          <LegendDot color="#A78BFA" label="LLM" />
          <LegendDot color="#5EEAD4" label="Tool" />
          <LegendDot color="#FCD34D" label="Patch / Retry" />
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

/* ───────────────────────────────────────────────── AI Pair */

function AiPairPanel({
  composerValue,
  setComposerValue,
  attachments,
  setAttachments
}: {
  composerValue: string;
  setComposerValue: (s: string) => void;
  attachments: string[];
  setAttachments: (a: string[]) => void;
}) {
  const [mode, setMode] = useState<"chat" | "agent">("chat");
  return (
    <aside className="w-96 shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-gray-900 text-[16px]">AI Pair</span>
            <span className="inline-flex items-center text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              claude-sonnet-4-6
            </span>
          </div>
          {/* Chat / Agent toggle */}
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-xs font-semibold">
            {(["chat", "agent"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-2.5 py-1 rounded-md transition-colors capitalize ${
                  mode === m ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="text-[11px] text-gray-500 tabular-nums">
          Tokens 1.2k/8k · Cost $0.03
        </div>
      </div>

      {/* Conversation */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
        {MOCK_MESSAGES.map((msg, i) => (
          <ChatRow key={i} msg={msg} />
        ))}
      </div>

      {/* Composer */}
      <div className="border-t border-gray-100 p-3">
        {/* Attachment chips */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {attachments.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full"
              >
                {a}
                <button
                  type="button"
                  onClick={() => setAttachments(attachments.filter((x) => x !== a))}
                  className="text-gray-400 hover:text-rose-600"
                  aria-label="Remove"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="rounded-xl border border-gray-200 bg-white focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
          <textarea
            value={composerValue}
            onChange={(e) => setComposerValue(e.target.value)}
            placeholder="Ask, or describe what you want built…"
            rows={2}
            className="w-full px-3 py-2 text-sm text-gray-800 placeholder-gray-400 bg-transparent outline-none resize-none"
          />
          <div className="flex items-center justify-between px-2 py-1.5 border-t border-gray-100">
            <div className="flex items-center gap-0.5">
              <IconBtn icon={Paperclip} label="Attach" />
              <IconBtn icon={Slash} label="Commands" />
              <IconBtn icon={Mic} label="Dictate" />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-indigo-600 px-2 py-1 rounded border border-gray-200 hover:border-indigo-300"
              >
                <span>Sonnet 4.6</span>
                <ChevronDown size={10} />
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold shadow-sm hover:shadow-md transition-all"
                style={{ backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED)" }}
              >
                <Send size={12} strokeWidth={2.4} />
                <span>Send</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function IconBtn({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      title={label}
      className="w-7 h-7 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition-colors"
    >
      <Icon size={13} strokeWidth={2} />
    </button>
  );
}

function ChatRow({ msg }: { msg: ChatMessage }) {
  if (msg.kind === "system") {
    return (
      <div className="inline-flex items-start gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-700">
        <AlertCircle size={14} className="shrink-0 mt-0.5 text-gray-400" />
        <span>{msg.text}</span>
      </div>
    );
  }
  if (msg.kind === "user") {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2 text-sm text-white"
          style={{ backgroundImage: "linear-gradient(90deg, #4F46E5, #6366F1)" }}
        >
          {msg.text}
        </div>
      </div>
    );
  }
  if (msg.kind === "ai") {
    return (
      <div className="flex items-start gap-2.5">
        <span className="shrink-0 w-7 h-7 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
          <Sparkles size={13} strokeWidth={2.2} />
        </span>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="text-xs text-gray-400 tabular-nums">{msg.time}</div>
          <p className="text-sm text-gray-800 leading-relaxed">{msg.text}</p>
          {msg.codeBlock && (
            <div className="relative bg-[#0F0C2F] text-gray-100 rounded-lg p-3 text-[12px] font-mono leading-5 whitespace-pre overflow-x-auto">
              <button
                type="button"
                className="absolute top-2 right-2 text-gray-400 hover:text-white"
                aria-label="Copy"
              >
                <Paperclip size={12} />
              </button>
              {msg.codeBlock}
            </div>
          )}
          {msg.actions && (
            <div className="flex flex-wrap items-center gap-1.5">
              {msg.actions.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md border transition-colors ${
                    a.tone === "indigo"
                      ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
                      : a.tone === "teal"
                        ? "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100"
                        : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                  }`}
                >
                  {a.tone === "teal" && <Check size={10} strokeWidth={3} />}
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
  if (msg.kind === "tool") {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-100 text-sm text-teal-800 font-mono">
        <Wrench size={12} className="text-teal-600" />
        <span>{msg.label}</span>
        <ChevronDown size={12} className="text-teal-600 ml-auto" />
      </div>
    );
  }
  if (msg.kind === "streaming") {
    return (
      <div className="flex items-start gap-2.5">
        <span className="shrink-0 w-7 h-7 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
          <Sparkles size={13} className="animate-pulse" />
        </span>
        <div className="flex-1 min-w-0 text-sm text-gray-800 leading-relaxed">
          {msg.text}
          <span className="inline-block w-1.5 h-4 bg-indigo-500 ml-0.5 align-text-bottom animate-pulse" />
        </div>
      </div>
    );
  }
  return null;
}

/* ───────────────────────────────────────────────── BottomTray */

function BottomTray() {
  const [activeTab, setActiveTab] = useState<"terminal" | "tests" | "problems" | "output">(
    "terminal"
  );
  const tabs: { key: typeof activeTab; label: string; count?: number }[] = [
    { key: "terminal", label: "Terminal" },
    { key: "tests", label: "Test Runs" },
    { key: "problems", label: "Problems", count: 2 },
    { key: "output", label: "Output" }
  ];
  return (
    <section className="h-48 shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 gap-2">
        <div className="flex items-center gap-1">
          {tabs.map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  active ? "bg-indigo-50 text-indigo-700" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <span>{t.label}</span>
                {t.count != null && (
                  <span
                    className={`text-[9px] font-bold px-1 py-0 rounded ${
                      active ? "bg-indigo-100 text-indigo-700" : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <IconBtn icon={Plus} label="New terminal" />
          <IconBtn icon={SplitSquareVertical} label="Split" />
          <IconBtn icon={Trash2} label="Clear" />
        </div>
      </div>
      <div className="flex-1 min-h-0 p-3 bg-[#0F0C2F] font-mono text-xs text-gray-200 overflow-auto">
        {activeTab === "terminal" && (
          <pre className="leading-5">
            <span className="text-gray-400">$</span>{" "}
            <span className="text-teal-300">mvn</span> test{"\n"}
            <span className="text-indigo-300">[INFO]</span> Tests run: 12, Failures: 0, Errors: 0, Skipped: 0{"\n"}
            <span className="text-indigo-300">[INFO]</span> BUILD SUCCESS in 3.826s{"\n"}
            <span className="text-gray-400">$</span> <span className="inline-block w-2 h-4 bg-gray-300 align-text-bottom animate-pulse" />
          </pre>
        )}
        {activeTab === "tests" && (
          <div className="text-gray-400">테스트 실행 로그가 없습니다.</div>
        )}
        {activeTab === "problems" && (
          <div className="space-y-1">
            <div className="text-rose-400">
              ✕ TodoServiceTest.testDuplicateTitle — expected 409, got 500
            </div>
            <div className="text-amber-400">
              ⚠ TodoApi.java:42 — Possible null dereference
            </div>
          </div>
        )}
        {activeTab === "output" && <div className="text-gray-400">No output.</div>}
      </div>
    </section>
  );
}
