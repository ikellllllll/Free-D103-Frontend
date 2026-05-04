"use client";

import dynamic from "next/dynamic";
import { Sun, Moon, Copy, Check, LogOut, Play, Save, Eye, PencilLine } from "lucide-react";
import { useRouter } from "next/navigation";
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { flushSync } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Badge } from "@/components/common/Badge";
import { Card } from "@/components/common/Card";
import { LangIcon } from "@/components/common/LangIcon";
import { isV0ThemeTone, useDevTheme } from "@/components/dev/DevThemeContext";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { TracePanel } from "@/components/ide/TracePanel";
import { HarnessPanel } from "@/components/ide/HarnessPanel";
import { TraceWorkbench } from "@/components/ide/TraceWorkbench";
import { useAiChat } from "@/hooks/useAiChat";
import { mockApi } from "@/lib/api/mockApi";
import { problemApi } from "@/lib/api/problemApi";
import { isBackendProblemId, isBackendSessionId, sessionApi } from "@/lib/api/sessionApi";
import { parseApiDateTime } from "@/lib/dateTime";
import { getProblemById } from "@/lib/mock-data";
import type { TraceEvent } from "@/lib/types/ai";
import type { WorkspaceFile } from "@/lib/types/session";
import type { AgentPatch, AgentRunTrace } from "@/lib/types/trace";
import type { BottomPanelTab, SelectionRange, SidebarView } from "@/store/ideStore";
import { useIdeStore } from "@/store/ideStore";
import { useThemeStore } from "@/store/themeStore";
import { useUiStore } from "@/store/uiStore";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="editor-loading">에디터를 불러오는 중...</div>
});

const MonacoDiffEditor = dynamic(() => import("@monaco-editor/react").then((mod) => mod.DiffEditor), {
  ssr: false,
  loading: () => <div className="editor-loading">Diff 에디터를 불러오는 중...</div>
});

const activityItems: Array<{ id: SidebarView; icon: string; label: string; description: string }> = [
  { id: "explorer",   icon: "codicon-files",      label: "탐색기",      description: "파일 트리" },
  { id: "search",     icon: "codicon-search",     label: "검색",        description: "파일명과 코드 검색" },
  { id: "trace",      icon: "codicon-pulse",      label: "Trace",       description: "에이전트 실행 기록" },
  { id: "extensions", icon: "codicon-extensions",   label: "확장",   description: "설치된 워크벤치 도구" },
  { id: "harness",    icon: "codicon-circuit-board", label: "하네스", description: "에이전트·스킬·인스트럭션 구성" }
];

const bottomTabs: Array<{ id: BottomPanelTab; label: string }> = [
  { id: "output", label: "출력" },
  { id: "tests", label: "테스트" },
  { id: "trace", label: "Trace" }
];

const AI_REQUEST_QUOTA = 5;
const SOLVE_TIMER_INTERVAL_MS = 1000;
const MAX_SELECTED_CODE_CHARS = 12000;
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_CLOSE_WIDTH = 170;
const AI_PANEL_MIN_WIDTH = 280;
const AI_PANEL_CLOSE_WIDTH = 230;
const BOTTOM_PANEL_MIN_HEIGHT = 140;
const BOTTOM_PANEL_CLOSE_HEIGHT = 105;
const SIDEBAR_REOPEN_WIDTH = SIDEBAR_CLOSE_WIDTH + 1;
const AI_PANEL_REOPEN_WIDTH = AI_PANEL_CLOSE_WIDTH + 1;
const BOTTOM_PANEL_REOPEN_HEIGHT = BOTTOM_PANEL_CLOSE_HEIGHT + 1;

const extensionItems = [
  {
    name: "AIG Assistant",
    summary: "AI 채팅, 코드 수정, 제출 흐름을 IDE 안에서 묶어 주는 보조 패널",
    state: "활성"
  },
  {
    name: "Extension Pack for Java",
    summary: "Java 편집, 테스트 실행, 패키지 구조 탐색용 기본 확장 묶음",
    state: "설치됨"
  },
  {
    name: "Spring Boot Dashboard",
    summary: "서비스 실행과 테스트 흐름을 시각적으로 정리하는 보조 도구",
    state: "설치됨"
  },
  {
    name: "REST Client",
    summary: "엔드포인트 확인과 요청 흐름 점검에 쓰는 API 실험 도구",
    state: "추천"
  }
];

const INITIAL_AGENT_SNAPSHOT_VERSION = 1;

type ExplorerSectionKey = "agent" | "project";
type DragMode = "sidebar" | "ai" | "bottom";

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  collapsed: boolean;
}

interface TreeNode {
  key: string;
  name: string;
  path: string | null;
  kind: "folder" | "file";
  file?: ExplorerFile;
  children: TreeNode[];
}

interface ExplorerFile extends WorkspaceFile {
  isVirtual?: boolean;
  badge?: string;
}

interface AgentPatchPreview {
  patchId: string;
  filePath: string;
  worktreePath: string;
  additions: number;
  deletions: number;
  summary: string | null;
  sourceFile?: WorkspaceFile;
  previewFile: ExplorerFile;
}

interface MockDiffFileDetail {
  fileId: number;
  path: string;
  name: string;
  language: string;
  content: string;
  updatedAt?: string;
  originType?: string;
  presenceStatus?: string;
}

interface MockAgentDiffPreset {
  source?: MockDiffFileDetail;
  worktree?: MockDiffFileDetail;
  sourceContent?: string;
  modifiedContent?: string;
}

interface ExplorerContextMenuState {
  x: number;
  y: number;
  parentPath: string | null;
  targetPath: string | null;
  targetKind: "root" | "folder" | "file";
}

interface ExplorerCreateDraft {
  kind: "file" | "folder";
  parentPath: string | null;
  value: string;
}

interface ExplorerRenameDraft {
  targetPath: string;
  targetKind: "folder" | "file";
  parentPath: string | null;
  value: string;
}

interface FileWorkspaceTab {
  id: string;
  kind: "file";
  path: string;
  title: string;
  file: WorkspaceFile;
}

interface DiffWorkspaceTab {
  id: string;
  kind: "diff";
  path: string;
  title: string;
  sourcePath: string;
  sourceFile: WorkspaceFile;
  targetFile: ExplorerFile;
}

type WorkspaceTab = FileWorkspaceTab | DiffWorkspaceTab;
type SavePromptAction =
  | { type: "close-tab"; tabId: string; path: string }
  | { type: "run" }
  | { type: "end-session" }
  | { type: "navigate"; href: string };

const AUTO_SAVE_INTERVAL_MS = 30_000;
const AUTO_SAVE_STORAGE_KEY = "aig:ide-auto-save";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const reorderItems = (items: string[], fromId: string, toId: string, position: "before" | "after") => {
  if (fromId === toId) {
    return items;
  }

  const next = items.filter((item) => item !== fromId);
  const targetIndex = next.indexOf(toId);

  if (targetIndex < 0) {
    return items;
  }

  const insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
  next.splice(insertIndex, 0, fromId);
  return next;
};
const areStringArraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);
const pad2 = (value: number) => String(value).padStart(2, "0");
const toTimestamp = (value?: string | null) => {
  if (!value) return Date.now();
  const timestamp = parseApiDateTime(value)?.getTime() ?? Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : Date.now();
};
const formatSolveElapsed = (elapsedMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}일 ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  }

  if (hours > 0) {
    return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  }

  return `${pad2(minutes)}:${pad2(seconds)}`;
};

const parseEstimateMs = (estimate: string): number => {
  const minKr = estimate.match(/(\d+(?:\.\d+)?)\s*분/);
  if (minKr) return parseFloat(minKr[1]) * 60000;
  const hr = estimate.match(/(\d+(?:\.\d+)?)\s*h/);
  if (hr) return parseFloat(hr[1]) * 3600000;
  const min = estimate.match(/(\d+(?:\.\d+)?)\s*m/);
  if (min) return parseFloat(min[1]) * 60000;
  return 0;
};
const clampSelectionCode = (code: string) =>
  code.length > MAX_SELECTED_CODE_CHARS ? `${code.slice(0, MAX_SELECTED_CODE_CHARS)}\n/* selection truncated */` : code;
const getFileName = (path: string) => path.split("/").pop() ?? path;
const getFolderPath = (path: string) => path.split("/").slice(0, -1).join("/");
const getFileExtension = (file: Pick<WorkspaceFile, "path" | "language">) => {
  const name = getFileName(file.path);
  const extension = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "";
  return extension || file.language.toLowerCase();
};

const isMarkdownWorkspaceFile = (file?: Pick<WorkspaceFile, "path" | "language"> | null) => {
  if (!file) {
    return false;
  }

  const lowerPath = file.path.toLowerCase();
  const language = file.language.toLowerCase();
  return lowerPath.endsWith(".md") || lowerPath.endsWith(".mdx") || language === "markdown" || language === "mdx";
};

const MOCK_AGENT_DIFF_PRESETS: Record<string, MockAgentDiffPreset> = {};

const MOCK_AGENT_DIFF_API_PRESETS: Record<string, MockAgentDiffPreset> = {
  "starter/src/main/java/com/example/starter/dto/UserResponse.java": {
    source: {
      fileId: 109,
      path: "starter/src/main/java/com/example/starter/dto/UserResponse.java",
      name: "UserResponse.java",
      language: "java",
      content: `package com.example.starter.dto;

public record UserResponse (Long id, String name, String email) {
}`,
      updatedAt: "2026-04-28T00:33:16.194678"
    },
    worktree: {
      fileId: 2109,
      path: "starter/src/main/java/com/example/starter/dto/UserResponse.java",
      name: "UserResponse.java",
      language: "java",
      content: `package com.example.starter.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record UserResponse(
        Long id,
        String name,
        String email,
        @JsonProperty("isActive")
        boolean active
) {
}`,
      originType: "MODIFIED",
      presenceStatus: "ACTIVE"
    }
  },
  "starter/src/main/java/com/example/starter/controller/UserController.java": {
    source: {
      fileId: 107,
      path: "starter/src/main/java/com/example/starter/controller/UserController.java",
      name: "UserController.java",
      language: "java",
      content: `package com.example.starter.controller;

import com.example.starter.dto.UserResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class UserController {

    @GetMapping("/users")
    public List<UserResponse> getUsers() {
        // TODO: 회원 목록을 name 오름차순으로 조회하여 반환하세요.
        return List.of();
    }
}`,
      updatedAt: "2026-04-28T00:33:16.194678"
    },
    worktree: {
      fileId: 2107,
      path: "starter/src/main/java/com/example/starter/controller/UserController.java",
      name: "UserController.java",
      language: "java",
      content: `package com.example.starter.controller;

import com.example.starter.dto.UserResponse;
import com.example.starter.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Comparator;
import java.util.List;

@RestController
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/users")
    public List<UserResponse> getUsers() {
        return userService.getUsers().stream()
                .sorted(Comparator.comparing(UserResponse::name))
                .toList();
    }
}`,
      originType: "MODIFIED",
      presenceStatus: "ACTIVE"
    }
  },
  "starter/src/main/java/com/example/starter/service/UserService.java": {
    source: {
      fileId: 115,
      path: "starter/src/main/java/com/example/starter/service/UserService.java",
      name: "UserService.java",
      language: "java",
      content: `package com.example.starter.service;

public class UserService {
}`,
      updatedAt: "2026-04-28T00:33:16.194678"
    },
    worktree: {
      fileId: 2115,
      path: "starter/src/main/java/com/example/starter/service/UserService.java",
      name: "UserService.java",
      language: "java",
      content: `package com.example.starter.service;

import com.example.starter.dto.UserResponse;
import com.example.starter.entity.User;
import com.example.starter.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public List<UserResponse> getUsers() {
        return userRepository.findAll().stream()
                .map(u -> new UserResponse(u.getId(), u.getName(), u.getEmail(), u.isActive()))
                .toList();
    }
}`,
      originType: "MODIFIED",
      presenceStatus: "ACTIVE"
    }
  },
  "starter/src/main/java/com/example/starter/entity/User.java": {
    source: {
      fileId: 111,
      path: "starter/src/main/java/com/example/starter/entity/User.java",
      name: "User.java",
      language: "java",
      content: `package com.example.starter.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private String email;

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getEmail() { return email; }
}`,
      updatedAt: "2026-04-28T00:33:16.194678"
    },
    worktree: {
      fileId: 2111,
      path: "starter/src/main/java/com/example/starter/entity/User.java",
      name: "User.java",
      language: "java",
      content: `package com.example.starter.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private String email;

    private boolean active;

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public boolean isActive() { return active; }
}`,
      originType: "MODIFIED",
      presenceStatus: "ACTIVE"
    }
  },
  "starter/src/main/java/com/example/starter/repository/UserRepository.java": {
    source: {
      fileId: 113,
      path: "starter/src/main/java/com/example/starter/repository/UserRepository.java",
      name: "UserRepository.java",
      language: "java",
      content: `package com.example.starter.repository;

import com.example.starter.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {
}`,
      updatedAt: "2026-04-28T00:33:16.194678"
    },
    worktree: {
      fileId: 2113,
      path: "starter/src/main/java/com/example/starter/repository/UserRepository.java",
      name: "UserRepository.java",
      language: "java",
      content: `package com.example.starter.repository;

import com.example.starter.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface UserRepository extends JpaRepository<User, Long> {

    @Query("SELECT u FROM User u WHERE u.active = true ORDER BY u.name")
    List<User> findAllActiveOrderByName();
}`,
      originType: "MODIFIED",
      presenceStatus: "ACTIVE"
    }
  }
};

const getMockAgentDiffPreset = (path: string) =>
  MOCK_AGENT_DIFF_API_PRESETS[path] ?? MOCK_AGENT_DIFF_PRESETS[path] ?? null;
const DIFF_TAB_PREFIX = "diff:";
const isDiffTabId = (value: string) => value.startsWith(DIFF_TAB_PREFIX);
const createDiffTabId = (path: string) => `${DIFF_TAB_PREFIX}${path}`;
const getWorktreeSourcePath = (path: string) => path.replace(/^\.worktree\//, "");
const ENDPOINT_LINE_REGEX = /^-\s+`((?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+[^`]+)`/;
const inferLanguageFromPath = (path: string) => {
  const lower = path.toLowerCase();
  const extension = lower.includes(".") ? lower.split(".").pop() : "";

  switch (extension) {
    case "java":
      return "java";
    case "kt":
      return "kotlin";
    case "js":
      return "javascript";
    case "jsx":
      return "javascript";
    case "ts":
      return "typescript";
    case "tsx":
      return "typescript";
    case "json":
      return "json";
    case "yml":
    case "yaml":
      return "yaml";
    case "md":
      return "markdown";
    case "xml":
      return "xml";
    case "html":
      return "html";
    case "css":
      return "css";
    case "scss":
      return "scss";
    case "sql":
      return "sql";
    case "properties":
      return "properties";
    default:
      return "plaintext";
  }
};
const replacePathPrefix = (path: string, fromPrefix: string, toPrefix: string) =>
  path === fromPrefix ? toPrefix : path.startsWith(`${fromPrefix}/`) ? `${toPrefix}${path.slice(fromPrefix.length)}` : path;
const appendLocalFolder = (folders: string[], folderPath: string | null) => {
  if (!folderPath || folders.includes(folderPath)) {
    return folders;
  }

  return [...folders, folderPath];
};

function ProblemBriefCodeBlock({ language, code }: { language?: string; code: string }) {
  const [isCopied, setIsCopied] = useState(false);
  const lines = code.trimEnd().split("\n");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code.trimEnd());
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1500);
    } catch {
      // noop
    }
  };

  return (
    <div className="problem-brief-codeblock">
      {language ? (
        <div className="problem-brief-codeblock__lang">
          {language}
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleCopy}
        className="problem-brief-codeblock__copy"
        aria-label="복사"
      >
        {isCopied ? <Check size={14} strokeWidth={2.4} className="problem-brief-codeblock__copied" /> : <Copy size={14} strokeWidth={2} />}
      </button>
      <div className="problem-brief-codeblock__body">
        <div className="problem-brief-codeblock__lines">
          {lines.map((_, index) => (
            <div key={index} className="problem-brief-codeblock__line">
              {index + 1}
            </div>
          ))}
        </div>
        <pre className="problem-brief-codeblock__content">
          {lines.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </pre>
      </div>
    </div>
  );
}

const problemBriefMarkdownComponents = {
  pre({ children }: { children?: React.ReactNode }) {
    const child = Array.isArray(children) ? children[0] : children;
    if (!child || typeof child !== "object") {
      return <pre>{children}</pre>;
    }

    const element = child as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
    const className = element.props.className ?? "";
    const match = /language-(\w+)/.exec(className);
    const code = String(element.props.children ?? "").replace(/\n$/, "");

    return <ProblemBriefCodeBlock language={match?.[1]} code={code} />;
  }
};

function renderHighlightedEndpoint(line: string) {
  const match = line.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.*)$/);
  if (!match) {
    return <span>{line}</span>;
  }

  const [, verb, rest] = match;
  const verbColor =
    verb === "GET"
      ? "text-green-400"
      : verb === "POST"
        ? "text-blue-400"
        : verb === "PUT" || verb === "PATCH"
          ? "text-amber-400"
          : verb === "DELETE"
            ? "text-rose-400"
            : "text-gray-300";

  return (
    <>
      <span className={`${verbColor} font-bold`}>{verb}</span>
      <span className="text-slate-200"> {rest}</span>
    </>
  );
}

const getMaxSidebarWidth = (viewportWidth: number) => {
  if (viewportWidth <= 0) {
    return 280;
  }

  if (viewportWidth <= 1180) {
    return clamp(Math.round(viewportWidth * 0.22), 200, 228);
  }

  if (viewportWidth <= 1360) {
    return clamp(Math.round(viewportWidth * 0.23), 220, 248);
  }

  return clamp(Math.round(viewportWidth * 0.26), 248, 420);
};

const getMaxAiPanelWidth = (viewportWidth: number) => {
  if (viewportWidth <= 0) {
    return 360;
  }

  if (viewportWidth <= 1180) {
    return clamp(Math.round(viewportWidth * 0.25), 240, 280);
  }

  if (viewportWidth <= 1360) {
    return clamp(Math.round(viewportWidth * 0.28), 280, 320);
  }

  return clamp(Math.round(viewportWidth * 0.28), 320, 520);
};

const getMaxBottomPanelHeight = (viewportHeight: number) => {
  if (viewportHeight <= 0) {
    return 220;
  }

  return clamp(Math.round(viewportHeight * 0.3), 168, 360);
};

const getFolderIconSpec = (folderName: string, folderPath: string | null, isOpen: boolean) => {
  const normalized = folderName.toLowerCase();
  const isPackageFolder =
    folderName.includes(".") &&
    typeof folderPath === "string" &&
    (folderPath.includes("/java/") || folderPath.endsWith("/java") || folderPath.includes("/kotlin/"));

  if (isPackageFolder) {
    return {
      iconClass: "codicon codicon-symbol-namespace",
      kind: "package"
    };
  }

  if (normalized === "java" || normalized === "src" || normalized === "main" || normalized === "test") {
    return {
      iconClass: isOpen ? "codicon codicon-folder-opened" : "codicon codicon-folder",
      kind: "source"
    };
  }

  if (normalized === "resources" || normalized === "static" || normalized === "templates") {
    return {
      iconClass: isOpen ? "codicon codicon-folder-opened" : "codicon codicon-folder",
      kind: "resources"
    };
  }

  if (normalized === ".worktree" || normalized === "worktree") {
    return {
      iconClass: isOpen ? "codicon codicon-folder-opened" : "codicon codicon-folder",
      kind: "worktree"
    };
  }

  return {
    iconClass: isOpen ? "codicon codicon-folder-opened" : "codicon codicon-folder",
    kind: "default"
  };
};

const getFolderDisplayName = (folderName: string, folderPath: string | null) => {
  if (folderName === ".worktree" && folderPath === ".worktree") {
    return "worktree";
  }

  return folderName;
};

const getFileIconSpec = (file: Pick<WorkspaceFile, "path" | "language">) => {
  const fileName = getFileName(file.path).toLowerCase();
  const extension = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() : "";

  if (extension === "java") {
    return { iconClass: "codicon codicon-symbol-class", kind: "java" };
  }

  if (
    fileName === "application.properties" ||
    extension === "properties" ||
    extension === "yml" ||
    extension === "yaml"
  ) {
    return { iconClass: "codicon codicon-settings-gear", kind: "config" };
  }

  if (
    fileName === "build.gradle" ||
    fileName === "settings.gradle" ||
    fileName === "gradlew" ||
    fileName === "gradlew.bat" ||
    extension === "gradle"
  ) {
    return { iconClass: "codicon codicon-gear", kind: "gradle" };
  }

  if (fileName === ".gitignore") {
    return { iconClass: "codicon codicon-source-control", kind: "git" };
  }

  if (extension === "md") {
    return { iconClass: "codicon codicon-book", kind: "docs" };
  }

  if (extension === "json") {
    return { iconClass: "codicon codicon-file-code", kind: "json" };
  }

  if (
    extension === "ts" ||
    extension === "tsx" ||
    extension === "js" ||
    extension === "jsx" ||
    extension === "py" ||
    extension === "sql" ||
    extension === "xml" ||
    extension === "html" ||
    extension === "css" ||
    extension === "scss"
  ) {
    return { iconClass: "codicon codicon-file-code", kind: "code" };
  }

  return { iconClass: "codicon codicon-file", kind: "default" };
};

const compressJavaPackageFolders = (nodes: TreeNode[], insideJavaRoot = false): TreeNode[] =>
  nodes.map((node) => {
    if (node.kind === "file") {
      return node;
    }

    const nodePath = node.path ?? "";
    const isJavaRoot = nodePath === "src/main/java" || nodePath === "src/test/java" || nodePath.endsWith("/java");
    const nextInsideJavaRoot = insideJavaRoot || isJavaRoot;

    let mergedName = node.name;
    let mergedKey = node.key;
    let mergedPath = node.path;
    let mergedChildren = node.children;

    if (nextInsideJavaRoot) {
      while (
        mergedChildren.length === 1 &&
        mergedChildren[0]?.kind === "folder" &&
        mergedChildren[0].children.every((child) => child.kind === "folder" || child.kind === "file")
      ) {
        const onlyChild = mergedChildren[0];
        const childHasOnlyFolderDescendants = onlyChild.children.filter((child) => child.kind === "folder").length <= 1;

        mergedName = `${mergedName}.${onlyChild.name}`;
        mergedKey = onlyChild.key;
        mergedPath = onlyChild.path;
        mergedChildren = onlyChild.children;

        if (!childHasOnlyFolderDescendants) {
          break;
        }

        if (onlyChild.children.some((child) => child.kind === "file")) {
          break;
        }
      }
    }

    return {
      ...node,
      key: mergedKey,
      name: mergedName,
      path: mergedPath,
      children: compressJavaPackageFolders(mergedChildren, nextInsideJavaRoot)
    };
  });

const createMockWorktreeContent = (
  sourceFile: WorkspaceFile | undefined,
  patch: AgentPatch,
  summary: string | null
) => {
  const preset = getMockAgentDiffPreset(patch.filePath);
  if (preset?.worktree) {
    return preset.worktree.content;
  }
  if (preset?.modifiedContent) {
    return preset.modifiedContent;
  }

  const base = sourceFile?.content ?? "";

  if (patch.filePath.endsWith(".java")) {
    if (!sourceFile) {
      const className = getFileName(patch.filePath).replace(/\.java$/i, "");
      return [
        `public class ${className} {`,
        "  // Mock AI-generated worktree preview",
        `  // ${summary ?? "Agent generated a new file preview."}`,
        "}"
      ].join("\n");
    }

    let next = base;
    if (next.includes(".get()")) {
      next = next.replace(".get()", '.orElseThrow(() -> new IllegalStateException("Mock preview"))');
    }
    if (next === base && next.includes("return")) {
      next = next.replace("return", "// Mock AI patch preview\n    return");
    }
    if (next === base) {
      next = `${base}\n\n// Mock AI patch preview\n// ${summary ?? `${getFileName(patch.filePath)} updated in worktree.`}`;
    }
    return next;
  }

  if (patch.filePath.endsWith(".yml") || patch.filePath.endsWith(".yaml")) {
    return `${base}\n# Mock AI patch preview\n# ${summary ?? `${getFileName(patch.filePath)} updated.`}`.trim();
  }

  if (patch.filePath.endsWith(".properties")) {
    return `${base}\n# Mock AI patch preview\n# ${summary ?? `${getFileName(patch.filePath)} updated.`}`.trim();
  }

  if (!base) {
    return `# Mock worktree preview\n# ${summary ?? `${getFileName(patch.filePath)} generated by agent`}\n`;
  }

  return `${base}\n\n# Mock AI patch preview\n# ${summary ?? `${getFileName(patch.filePath)} updated in worktree.`}`;
};

const buildAgentPatchPreviews = (files: WorkspaceFile[], runs: AgentRunTrace[]): AgentPatchPreview[] => {
  const latestRunWithPatches = runs.find((run) => run.spans.some((span) => span.patches.length > 0)) ?? runs[0] ?? null;

  if (!latestRunWithPatches) {
    return [];
  }

  const previews = latestRunWithPatches.spans.flatMap((span) =>
    span.patches.map((patch) => {
      const preset = getMockAgentDiffPreset(patch.filePath);
      const sourceFile =
        files.find((file) => file.path === patch.filePath) ??
        (preset?.source
          ? {
              path: preset.source.path,
              language: preset.source.language.toLowerCase(),
              content: preset.source.content
            }
          : preset?.sourceContent
            ? {
                path: patch.filePath,
                language: inferLanguageFromPath(patch.filePath),
                content: preset.sourceContent
              }
          : undefined);
      const worktreePath = `.worktree/${patch.filePath}`;
      const language =
        preset?.worktree?.language.toLowerCase() ?? sourceFile?.language ?? inferLanguageFromPath(patch.filePath);

      return {
        patchId: patch.patchId,
        filePath: patch.filePath,
        worktreePath,
        additions: patch.additions,
        deletions: patch.deletions,
        summary: latestRunWithPatches.summaryText,
        sourceFile,
        previewFile: {
          path: worktreePath,
          language,
          content: createMockWorktreeContent(sourceFile, patch, latestRunWithPatches.summaryText),
          isVirtual: true,
          badge: "ai"
        }
      } satisfies AgentPatchPreview;
    })
  );

  return previews.filter(
    (preview, index, list) => list.findIndex((item) => item.worktreePath === preview.worktreePath) === index
  );
};

const buildExplorerFiles = (files: WorkspaceFile[], injectedVirtualFiles: ExplorerFile[] = []): ExplorerFile[] => {
  const sourceFiles = files.map((file) => ({
    ...file,
    isVirtual: file.path.startsWith(".worktree/"),
    badge: file.path.startsWith(".worktree/") ? "ai" : undefined
  }));
  const existingPaths = new Set(sourceFiles.map((file) => file.path));
  const previewFiles = injectedVirtualFiles.filter((file) => !existingPaths.has(file.path));

  const agentSupportFiles: ExplorerFile[] = [
    {
      path: "agent/skills/README.md",
      language: "markdown",
      content: "# Agent Skills\n\n가상 탐색기 구조용 보조 파일입니다.",
      isVirtual: true,
      badge: "meta"
    },
    {
      path: "agent/.sandbox/README.md",
      language: "markdown",
      content: "# Agent Sandbox\n\n임시 실행 흔적을 두는 가상 디렉터리입니다.",
      isVirtual: true,
      badge: "temp"
    },
    {
      path: "agent/instruction.md",
      language: "markdown",
      content: "# Agent Instruction\n\n에이전트 보조 지시를 두는 가상 파일입니다.",
      isVirtual: true,
      badge: "meta"
    }
  ].filter((file) => !existingPaths.has(file.path));

  return [...sourceFiles, ...previewFiles, ...agentSupportFiles];
};

const buildFileTree = (files: ExplorerFile[], extraFolders: string[] = []) => {
  const root: TreeNode = {
    key: "root",
    name: "root",
    path: null,
    kind: "folder",
    children: []
  };

  files.forEach((file) => {
    const segments = file.path.split("/");
    let current = root;
    let currentPath = "";

    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const isFile = index === segments.length - 1;

      if (isFile) {
        current.children.push({
          key: currentPath,
          name: segment,
          path: file.path,
          kind: "file",
          file,
          children: []
        });
        return;
      }

      let folder = current.children.find((node) => node.kind === "folder" && node.name === segment);

      if (!folder) {
        folder = {
          key: currentPath,
          name: segment,
          path: currentPath,
          kind: "folder",
          children: []
        };
        current.children.push(folder);
      }

      current = folder;
    });
  });

  extraFolders.forEach((folderPath) => {
    const segments = folderPath.split("/").filter(Boolean);
    let current = root;
    let currentPath = "";

    segments.forEach((segment) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;

      let folder = current.children.find((node) => node.kind === "folder" && node.name === segment);

      if (!folder) {
        folder = {
          key: currentPath,
          name: segment,
          path: currentPath,
          kind: "folder",
          children: []
        };
        current.children.push(folder);
      }

      current = folder;
    });
  });

  const sortNodes = (nodes: TreeNode[]): TreeNode[] =>
    [...nodes]
      .sort((left, right) => {
        const rootFolderOrder: Record<string, number> = {
          src: 0,
          agent: 1,
          ".worktree": 2,
          starter: 3
        };

        const leftRank = left.kind === "folder" && left.path && !left.path.includes("/") ? rootFolderOrder[left.name] ?? 99 : 99;
        const rightRank = right.kind === "folder" && right.path && !right.path.includes("/") ? rootFolderOrder[right.name] ?? 99 : 99;

        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        if (left.kind !== right.kind) {
          return left.kind === "folder" ? -1 : 1;
        }

        return left.name.localeCompare(right.name);
      })
      .map((node) => ({
        ...node,
        children: sortNodes(node.children)
      }));

  return compressJavaPackageFolders(sortNodes(root.children));
};

const isAgentConfigExplorerPath = (path: string) => {
  const normalizedPath = path.replace(/\\/g, "/").toLowerCase();
  const fileName = normalizedPath.split("/").pop() ?? normalizedPath;
  const isMarkdownFile = fileName.endsWith(".md") || fileName.endsWith(".mdx");

  return (
    normalizedPath === "agent" ||
    normalizedPath.startsWith("agent/") ||
    normalizedPath === "agents" ||
    normalizedPath.startsWith("agents/") ||
    normalizedPath === ".agents" ||
    normalizedPath.startsWith(".agents/") ||
    normalizedPath === "skills" ||
    normalizedPath.startsWith("skills/") ||
    normalizedPath.includes("/skills/") ||
    fileName === "agent.md" ||
    fileName === "agents.md" ||
    fileName === "harness.md" ||
    (isMarkdownFile && /(instruction|instuction|instructions|prompt|skill|harness)/.test(fileName))
  );
};

export function IdeShell({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { withPrefix } = useRouteScope();
  const { themeTone } = useDevTheme();
  const queryClient = useQueryClient();
  const addToast = useUiStore((state) => state.addToast);
  const setWorkspace = useIdeStore((state) => state.setWorkspace);
  const resetSession = useIdeStore((state) => state.resetSession);
  const activePath = useIdeStore((state) => state.activePath);
  const files = useIdeStore((state) => state.files);
  const unsavedPaths = useIdeStore((state) => state.unsavedPaths);
  const setActivePath = useIdeStore((state) => state.setActivePath);
  const createWorkspaceFile = useIdeStore((state) => state.createWorkspaceFile);
  const renameWorkspaceFile = useIdeStore((state) => state.renameWorkspaceFile);
  const removeWorkspaceFile = useIdeStore((state) => state.removeWorkspaceFile);
  const discardFileChanges = useIdeStore((state) => state.discardFileChanges);
  const hydrateFileContent = useIdeStore((state) => state.hydrateFileContent);
  const markSaved = useIdeStore((state) => state.markSaved);
  const updateFileContent = useIdeStore((state) => state.updateFileContent);
  const selectedCode = useIdeStore((state) => state.selectedCode);
  const selectedRange = useIdeStore((state) => state.selectedRange);
  const setSelection = useIdeStore((state) => state.setSelection);
  const editInstruction = useIdeStore((state) => state.editInstruction);
  const setEditInstruction = useIdeStore((state) => state.setEditInstruction);
  const suggestion = useIdeStore((state) => state.suggestion);
  const setSuggestion = useIdeStore((state) => state.setSuggestion);
  const aiMode = useIdeStore((state) => state.aiMode);
  const setAiMode = useIdeStore((state) => state.setAiMode);
  const runResult = useIdeStore((state) => state.runResult);
  const testResult = useIdeStore((state) => state.testResult);
  const setRunResult = useIdeStore((state) => state.setRunResult);
  const setTestResult = useIdeStore((state) => state.setTestResult);
  const lastSavedAt = useIdeStore((state) => state.lastSavedAt);
  const sidebarView = useIdeStore((state) => state.sidebarView);
  const sidebarOpen = useIdeStore((state) => state.sidebarOpen);
  const sidebarWidth = useIdeStore((state) => state.sidebarWidth);
  const aiOpen = useIdeStore((state) => state.aiOpen);
  const aiPanelWidth = useIdeStore((state) => state.aiPanelWidth);
  const bottomPanelOpen = useIdeStore((state) => state.bottomPanelOpen);
  const bottomPanelTab = useIdeStore((state) => state.bottomPanelTab);
  const bottomPanelHeight = useIdeStore((state) => state.bottomPanelHeight);
  const setSidebarView = useIdeStore((state) => state.setSidebarView);
  const setSidebarOpen = useIdeStore((state) => state.setSidebarOpen);
  const setSidebarWidth = useIdeStore((state) => state.setSidebarWidth);
  const toggleAiOpen = useIdeStore((state) => state.toggleAiOpen);
  const setAiOpen = useIdeStore((state) => state.setAiOpen);
  const setAiPanelWidth = useIdeStore((state) => state.setAiPanelWidth);
  const setBottomPanelOpen = useIdeStore((state) => state.setBottomPanelOpen);
  const setBottomPanelTab = useIdeStore((state) => state.setBottomPanelTab);
  const setBottomPanelHeight = useIdeStore((state) => state.setBottomPanelHeight);
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  const editorRef = useRef<any>(null);
  const diffEditorRef = useRef<any>(null);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const monacoRef = useRef<any>(null);
  const editorDisposablesRef = useRef<Array<{ dispose: () => void }>>([]);
  const trackedModelUrisRef = useRef<Set<string>>(new Set());
  const selectionDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedBackendFilesRef = useRef<Set<string>>(new Set());
  const allowNextPopStateRef = useRef(false);
  const isDirtyRef = useRef(false);
  const savedBackTargetRef = useRef<string | null>(null);
  const sessionTimeoutHandledRef = useRef(false);
  const routerRef = useRef(router);

  const [chatInput, setChatInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [endSessionLoading, setEndSessionLoading] = useState(false);
  const [extensionQuery, setExtensionQuery] = useState("");
  const [agentSnapshotVersion, setAgentSnapshotVersion] = useState(INITIAL_AGENT_SNAPSHOT_VERSION);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [activeWorkbenchTab, setActiveWorkbenchTab] = useState<"code" | "problem" | "trace">("code");
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [openTabPaths, setOpenTabPaths] = useState<string[]>([]);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [tabDropHint, setTabDropHint] = useState<{ targetId: string; position: "before" | "after" } | null>(null);
  const [explorerContextMenu, setExplorerContextMenu] = useState<ExplorerContextMenuState | null>(null);
  const [explorerCreateDraft, setExplorerCreateDraft] = useState<ExplorerCreateDraft | null>(null);
  const [explorerRenameDraft, setExplorerRenameDraft] = useState<ExplorerRenameDraft | null>(null);
  const [localFolders, setLocalFolders] = useState<string[]>([]);
  const [draggedExplorerPath, setDraggedExplorerPath] = useState<string | null>(null);
  const [folderDropTargetPath, setFolderDropTargetPath] = useState<string | null>(null);
  const [solveNow, setSolveNow] = useState(() => Date.now());
  const [markdownPreviewOpen, setMarkdownPreviewOpen] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [explorerSections, setExplorerSections] = useState<Record<ExplorerSectionKey, boolean>>({
    agent: true,
    project: true
  });
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set());
  const [savePromptAction, setSavePromptAction] = useState<SavePromptAction | null>(null);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      return window.localStorage.getItem(AUTO_SAVE_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const isV0 = isV0ThemeTone(themeTone);

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => mockApi.getSession(sessionId)
  });
  const { data: workspace } = useQuery({
    queryKey: ["workspace", sessionId],
    queryFn: () => (isBackendSessionId(sessionId) ? sessionApi.getWorkspace(sessionId) : mockApi.getWorkspace(sessionId)),
    enabled: !!session
  });
  const { data: mockAgentRuns = [] } = useQuery({
    queryKey: ["agentTraces", sessionId],
    queryFn: () =>
      isBackendSessionId(sessionId)
        ? sessionApi.getAgentTraces(sessionId)
        : mockApi.getAgentTraces(sessionId),
    enabled: !!session,
    staleTime: 60_000
  });
  const isApiProblem = isBackendProblemId(session?.problemId ?? "");
  const { data: apiProblem } = useQuery({
    queryKey: ["problem", session?.problemId],
    queryFn: () => problemApi.getProblemDetail(session!.problemId),
    enabled: !!session?.problemId && isApiProblem
  });

  const maxSidebarWidth = getMaxSidebarWidth(viewportSize.width);
  const maxAiPanelWidth = getMaxAiPanelWidth(viewportSize.width);
  const maxBottomPanelHeight = getMaxBottomPanelHeight(viewportSize.height);
  const effectiveSidebarWidth = Math.min(sidebarWidth, maxSidebarWidth);
  const effectiveAiPanelWidth = Math.min(aiPanelWidth, maxAiPanelWidth);
  const effectiveBottomPanelHeight = Math.min(bottomPanelHeight, maxBottomPanelHeight);

  const requestEditorLayout = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const editor = activeTabId && isDiffTabId(activeTabId) ? diffEditorRef.current : editorRef.current;
        const host = editorHostRef.current;

        if (!editor || !host || typeof editor.layout !== "function") {
          return;
        }

        const width = host.clientWidth;
        const height = host.clientHeight;

        if (!width || !height) {
          return;
        }

        editor.layout({ width, height });
      });
    });
  }, []);

  const syncMonacoAuxInputs = useCallback(() => {
    const host = editorHostRef.current;

    if (!host) {
      return;
    }

    const imeTextarea = host.querySelector<HTMLTextAreaElement>("textarea.ime-text-area");

    if (imeTextarea) {
      imeTextarea.id = "ide-ime-textarea";
      imeTextarea.setAttribute("name", "ide-ime-textarea");
    }
  }, []);

  const updateCursorPosition = useCallback((next: { line: number; column: number }) => {
    setCursorPosition((current) =>
      current.line === next.line && current.column === next.column ? current : next
    );
  }, []);

  const cleanupEditorSubscriptions = useCallback(() => {
    if (selectionDebounceTimerRef.current) {
      clearTimeout(selectionDebounceTimerRef.current);
      selectionDebounceTimerRef.current = null;
    }

    editorDisposablesRef.current.forEach((disposable) => disposable.dispose());
    editorDisposablesRef.current = [];
  }, []);

  const trackMonacoModels = useCallback((editor: any, monaco?: any) => {
    if (monaco) {
      monacoRef.current = monaco;
    }

    const model = editor?.getModel?.();
    const models = model?.original || model?.modified
      ? [model.original, model.modified]
      : model
        ? [model]
        : [];

    models.forEach((item) => {
      const uri = item?.uri?.toString?.();
      if (uri) {
        trackedModelUrisRef.current.add(uri);
      }
    });
  }, []);

  const disposeTrackedMonacoModels = useCallback(() => {
    const monaco = monacoRef.current;
    const trackedUris = trackedModelUrisRef.current;

    if (!monaco?.editor?.getModels || trackedUris.size === 0) {
      return;
    }

    monaco.editor.getModels().forEach((model: any) => {
      const uri = model?.uri?.toString?.();
      if (uri && trackedUris.has(uri)) {
        model.dispose?.();
      }
    });

    trackedUris.clear();
  }, []);

  const { messages, streaming, requestCount, loadMessages, send } = useAiChat(sessionId);

  useEffect(() => {
    const syncViewport = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  useEffect(() => {
    return () => {
      resetSession();
    };
  }, [resetSession]);

  useEffect(() => {
    loadedBackendFilesRef.current.clear();
  }, [sessionId]);

  useEffect(() => {
    return () => {
      cleanupEditorSubscriptions();
      disposeTrackedMonacoModels();
      editorRef.current = null;
      diffEditorRef.current = null;
      monacoRef.current = null;
    };
  }, [cleanupEditorSubscriptions, disposeTrackedMonacoModels]);

  useEffect(() => {
    if (workspace?.files?.length) {
      setWorkspace(workspace.files, workspace.files[1]?.path ?? workspace.files[0]?.path);
    }
  }, [setWorkspace, workspace]);

  const ensureBackendFileContent = useCallback(
    async (path: string) => {
      if (!isBackendSessionId(sessionId)) {
        return;
      }

      const currentFile = useIdeStore.getState().files.find((file) => file.path === path);
      if (!currentFile) {
        return;
      }

      if (loadedBackendFilesRef.current.has(path)) {
        return;
      }

      if (currentFile.content.trim().length > 0) {
        loadedBackendFilesRef.current.add(path);
        return;
      }

      loadedBackendFilesRef.current.add(path);

      try {
        const payload = await sessionApi.getFileContent(sessionId, path);
        if (payload) {
          hydrateFileContent(path, payload.content, payload.language);
        }
      } catch {
        loadedBackendFilesRef.current.delete(path);
      }
    },
    [hydrateFileContent, sessionId]
  );

  useEffect(() => {
    if (session) {
      void loadMessages();
    }
  }, [loadMessages, session]);

  useEffect(() => {
    if (!session?.createdAt) {
      return;
    }

    const syncSolveNow = () => setSolveNow(Date.now());
    syncSolveNow();

    const timerId = window.setInterval(syncSolveNow, SOLVE_TIMER_INTERVAL_MS);
    document.addEventListener("visibilitychange", syncSolveNow);

    return () => {
      window.clearInterval(timerId);
      document.removeEventListener("visibilitychange", syncSolveNow);
    };
  }, [session?.createdAt]);

  useEffect(() => {
    setCollapsedFolders(new Set());
  }, [sessionId]);

  useEffect(() => {
    if (selectedCode) {
      setAiOpen(true);
    }
  }, [selectedCode, setAiOpen]);

  useEffect(() => {
    if (!chatScrollRef.current) {
      return;
    }

    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages, streaming]);

  useEffect(() => {
    if (!editorHostRef.current || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      requestEditorLayout();
    });

    observer.observe(editorHostRef.current);

    return () => {
      observer.disconnect();
    };
  }, [activeWorkbenchTab, requestEditorLayout]);

  useEffect(() => {
    if (!editorHostRef.current || typeof MutationObserver === "undefined") {
      return;
    }

    syncMonacoAuxInputs();

    const observer = new MutationObserver(() => {
      syncMonacoAuxInputs();
    });

    observer.observe(editorHostRef.current, {
      childList: true,
      subtree: true
    });

    return () => {
      observer.disconnect();
    };
  }, [activeWorkbenchTab, syncMonacoAuxInputs]);

  useEffect(() => {
    const clampWorkbenchLayout = () => {
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const nextBottomMax = getMaxBottomPanelHeight(viewportHeight);
      if (bottomPanelHeight > nextBottomMax) {
        setBottomPanelHeight(nextBottomMax);
      }

      const nextAiMax = getMaxAiPanelWidth(viewportWidth);
      if (aiPanelWidth > nextAiMax) {
        setAiPanelWidth(nextAiMax);
      }

      const nextSidebarMax = getMaxSidebarWidth(viewportWidth);
      if (sidebarWidth > nextSidebarMax) {
        setSidebarWidth(nextSidebarMax);
      }
    };

    clampWorkbenchLayout();
    window.addEventListener("resize", clampWorkbenchLayout);

    return () => {
      window.removeEventListener("resize", clampWorkbenchLayout);
    };
  }, [aiPanelWidth, bottomPanelHeight, setAiPanelWidth, setBottomPanelHeight, setSidebarWidth, sidebarWidth]);

  useEffect(() => {
    requestEditorLayout();
  }, [
    activePath,
    activeWorkbenchTab,
    aiOpen,
    bottomPanelOpen,
    effectiveAiPanelWidth,
    effectiveBottomPanelHeight,
    effectiveSidebarWidth,
    requestEditorLayout,
    sidebarOpen,
    viewportSize.height,
    viewportSize.width
  ]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;

      if (!dragState) {
        return;
      }

      if (dragState.mode === "sidebar") {
        const rawWidth = dragState.startWidth + (event.clientX - dragState.startX);
        const startedCollapsed = dragState.startWidth === SIDEBAR_CLOSE_WIDTH;
        if (rawWidth <= SIDEBAR_CLOSE_WIDTH) {
          setSidebarOpen(false);
          dragState.collapsed = true;
          return;
        }

        dragState.collapsed = false;
        setSidebarOpen(true);
        const nextWidth = startedCollapsed
          ? clamp(
              Math.max(rawWidth - SIDEBAR_CLOSE_WIDTH, SIDEBAR_REOPEN_WIDTH),
              SIDEBAR_REOPEN_WIDTH,
              maxSidebarWidth
            )
          : clamp(rawWidth, SIDEBAR_MIN_WIDTH, maxSidebarWidth);
        setSidebarWidth(nextWidth);
        return;
      }

      if (dragState.mode === "ai") {
        const rawWidth = dragState.startWidth - (event.clientX - dragState.startX);
        const startedCollapsed = dragState.startWidth === AI_PANEL_CLOSE_WIDTH;
        if (rawWidth <= AI_PANEL_CLOSE_WIDTH) {
          setAiOpen(false);
          dragState.collapsed = true;
          return;
        }

        dragState.collapsed = false;
        setAiOpen(true);
        const nextWidth = startedCollapsed
          ? clamp(
              Math.max(rawWidth - AI_PANEL_CLOSE_WIDTH, AI_PANEL_REOPEN_WIDTH),
              AI_PANEL_REOPEN_WIDTH,
              maxAiPanelWidth
            )
          : clamp(rawWidth, AI_PANEL_MIN_WIDTH, maxAiPanelWidth);
        setAiPanelWidth(nextWidth);
        return;
      }

      const rawHeight = dragState.startHeight - (event.clientY - dragState.startY);
      const startedCollapsed = dragState.startHeight === BOTTOM_PANEL_CLOSE_HEIGHT;
      if (rawHeight <= BOTTOM_PANEL_CLOSE_HEIGHT) {
        setBottomPanelOpen(false);
        dragState.collapsed = true;
        return;
      }

      dragState.collapsed = false;
      setBottomPanelOpen(true);
      const nextHeight = startedCollapsed
        ? clamp(
            Math.max(rawHeight - BOTTOM_PANEL_CLOSE_HEIGHT, BOTTOM_PANEL_REOPEN_HEIGHT),
            BOTTOM_PANEL_REOPEN_HEIGHT,
            maxBottomPanelHeight
          )
        : clamp(rawHeight, BOTTOM_PANEL_MIN_HEIGHT, maxBottomPanelHeight);
      setBottomPanelHeight(nextHeight);
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [
    maxAiPanelWidth,
    maxBottomPanelHeight,
    maxSidebarWidth,
    setAiOpen,
    setAiPanelWidth,
    setBottomPanelHeight,
    setBottomPanelOpen,
    setSidebarOpen,
    setSidebarWidth
  ]);

  const problem = useMemo(
    () => apiProblem ?? getProblemById(session?.problemId ?? "todo-api"),
    [apiProblem, session?.problemId]
  );
  const traces = useMemo(() => session?.traces ?? [], [session?.traces]);
  const agentPatchPreviews = useMemo(() => buildAgentPatchPreviews(files, mockAgentRuns), [files, mockAgentRuns]);
  const explorerFiles = useMemo(
    () => buildExplorerFiles(files, agentPatchPreviews.map((preview) => preview.previewFile)),
    [agentPatchPreviews, files]
  );
  const agentExplorerFiles = useMemo(
    () => explorerFiles.filter((file) => isAgentConfigExplorerPath(file.path)),
    [explorerFiles]
  );
  const workspaceExplorerFiles = useMemo(
    () => explorerFiles.filter((file) => !isAgentConfigExplorerPath(file.path)),
    [explorerFiles]
  );
  const agentFileTree = useMemo(() => buildFileTree(agentExplorerFiles), [agentExplorerFiles]);
  const workspaceFileTree = useMemo(() => {
    const extraFolders = Array.from(new Set([...localFolders, ".worktree"]));
    const workspaceFolders = extraFolders.filter((folder) => !isAgentConfigExplorerPath(folder));

    return buildFileTree(workspaceExplorerFiles, workspaceFolders);
  }, [localFolders, workspaceExplorerFiles]);
  const openTabs = useMemo(
    () =>
      openTabPaths
        .map((path): WorkspaceTab | null => {
          if (isDiffTabId(path)) {
            const targetPath = path.slice(DIFF_TAB_PREFIX.length);
            const targetFile = explorerFiles.find((file) => file.path === targetPath && file.isVirtual);
            const sourcePath = getWorktreeSourcePath(targetPath);
            const preset = getMockAgentDiffPreset(sourcePath);
            const sourceFile = (() => {
              const existing = files.find((file) => file.path === sourcePath);
              if (existing && existing.content.trim().length > 0) {
                return existing;
              }

              if (preset) {
                if (preset.source) {
                  return {
                    path: preset.source.path,
                    language: preset.source.language.toLowerCase(),
                    content: preset.source.content
                  } satisfies WorkspaceFile;
                }

                return {
                  path: sourcePath,
                  language: targetFile?.language ?? inferLanguageFromPath(sourcePath),
                  content: preset.sourceContent ?? ""
                } satisfies WorkspaceFile;
              }

              if (existing) {
                return existing;
              }

              if (targetFile) {
                return {
                  path: sourcePath,
                  language: targetFile.language,
                  content: ""
                } satisfies WorkspaceFile;
              }

              return undefined;
            })();

            if (!targetFile || !sourceFile) {
              return null;
            }

            return {
              id: path,
              kind: "diff",
              path,
              title: `${getFileName(sourcePath)} diff`,
              sourcePath,
              sourceFile,
              targetFile
            };
          }

          const file = explorerFiles.find((item) => item.path === path);

          if (!file) {
            return null;
          }

          return {
            id: path,
            kind: "file",
            path,
            title: getFileName(path),
            file
          };
        })
        .filter((tab): tab is WorkspaceTab => Boolean(tab)),
    [explorerFiles, files, openTabPaths]
  );
  const activeTab = useMemo(
    () => openTabs.find((tab) => tab.id === activeTabId) ?? openTabs[0] ?? null,
    [activeTabId, openTabs]
  );
  const activeFile = useMemo(() => {
    if (activeTab?.kind === "diff") {
      return activeTab.sourceFile;
    }

    if (activeTab?.kind === "file") {
      return activeTab.file;
    }

    return files.find((file) => file.path === activePath) ?? files[0] ?? null;
  }, [activePath, activeTab, files]);
  const latestAgentPatchSummary = agentPatchPreviews[0]?.summary ?? null;

  useEffect(() => {
    const handleDismissExplorerMenu = () => {
      setExplorerContextMenu(null);
    };

    window.addEventListener("click", handleDismissExplorerMenu);
    window.addEventListener("resize", handleDismissExplorerMenu);

    return () => {
      window.removeEventListener("click", handleDismissExplorerMenu);
      window.removeEventListener("resize", handleDismissExplorerMenu);
    };
  }, []);

  useEffect(() => {
    setExplorerContextMenu(null);
    setExplorerCreateDraft(null);
    setExplorerRenameDraft(null);
    setLocalFolders([]);
    setDraggedExplorerPath(null);
    setFolderDropTargetPath(null);
  }, [sessionId]);

  useEffect(() => {
    if (!files.length) {
      setOpenTabPaths((state) => (state.length ? [] : state));
      setActiveTabId((state) => (state === null ? state : null));
      return;
    }

    const fallbackPath = activePath ?? files[0].path;

    setOpenTabPaths((state) => {
      const filtered = state.filter((path) => {
        if (isDiffTabId(path)) {
          const targetPath = path.slice(DIFF_TAB_PREFIX.length);
          return explorerFiles.some((file) => file.path === targetPath && file.isVirtual);
        }

        return files.some((file) => file.path === path) || explorerFiles.some((file) => file.path === path && file.isVirtual);
      });

      const next = activeTabId || filtered.length ? filtered : [fallbackPath];
      return areStringArraysEqual(state, next) ? state : next;
    });

    if (!activeTabId) {
      setActiveTabId(fallbackPath);
    }
  }, [activePath, activeTabId, explorerFiles, files]);

  useEffect(() => {
    if (!openTabs.length) {
      if (activeTabId) {
        setActiveTabId(null);
      }
      return;
    }

    if (!activeTabId || !openTabs.some((tab) => tab.id === activeTabId)) {
      setActiveTabId(openTabs[0].id);
    }
  }, [activeTabId, openTabs]);

  useEffect(() => {
    if (!activeTab) {
      return;
    }

    const nextPath = activeTab.kind === "diff" ? activeTab.sourcePath : activeTab.path;

    if (nextPath !== activePath) {
      setActivePath(nextPath);
    }

    if (activeTab.kind === "diff") {
      setSelection("", null);
      setSuggestion(null);
      setAiMode("chat");
    }
  }, [activePath, activeTab, setActivePath, setAiMode, setSelection, setSuggestion]);

  useEffect(() => {
    if (!activeFile?.path) {
      return;
    }

    if (activeTab?.kind === "diff") {
      return;
    }

    void ensureBackendFileContent(activeFile.path);
  }, [activeFile?.path, activeTab?.kind, ensureBackendFileContent]);

  const searchMatches = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    if (!keyword) {
      return [];
    }

    return files.flatMap((file) => {
      const pathMatch = file.path.toLowerCase().includes(keyword)
        ? [
            {
              key: `${file.path}-path`,
              path: file.path,
              lineNumber: 1,
              preview: file.path
            }
          ]
        : [];

      const lineMatches = file.content
        .split("\n")
        .map((line, index) => ({ line, lineNumber: index + 1 }))
        .filter((line) => line.line.toLowerCase().includes(keyword))
        .slice(0, 5)
        .map((line) => ({
          key: `${file.path}-${line.lineNumber}`,
          path: file.path,
          lineNumber: line.lineNumber,
          preview: line.line.trim() || "(빈 줄)"
        }));

      return [...pathMatch, ...lineMatches];
    });
  }, [files, searchQuery]);
  const extensionMatches = useMemo(() => {
    const keyword = extensionQuery.trim().toLowerCase();

    if (!keyword) {
      return extensionItems;
    }

    return extensionItems.filter((item) =>
      `${item.name} ${item.summary} ${item.state}`.toLowerCase().includes(keyword)
    );
  }, [extensionQuery]);

  const selectionSummary = selectedRange
    ? `${selectedRange.startLineNumber}:${selectedRange.startColumn} - ${selectedRange.endLineNumber}:${selectedRange.endColumn}`
    : "선택 없음";
  const selectionLabel = selectedRange
    ? `${Math.abs(selectedRange.endLineNumber - selectedRange.startLineNumber) + 1}줄 선택`
    : `Ln ${cursorPosition.line}, Col ${cursorPosition.column}`;
  const lineCount = activeFile?.content.split("\n").length ?? 0;
  const requestTotal = requestCount || session?.aiRequestCount || 0;
  const aiQuotaLabel = `${Math.min(requestTotal, AI_REQUEST_QUOTA)}/${AI_REQUEST_QUOTA}`;
  const agentSnapshotLabel = `v0.${agentSnapshotVersion}`;
  const dirtyCount = unsavedPaths.length;
  const canPreviewActiveMarkdown = activeTab?.kind === "file" && isMarkdownWorkspaceFile(activeFile);
  useEffect(() => {
    setMarkdownPreviewOpen(canPreviewActiveMarkdown);
  }, [activeFile?.path, canPreviewActiveMarkdown]);

  const parsedProblemBrief = useMemo(() => {
    if (!problem?.description) {
      return { beforeDescription: "", afterDescription: "", parsedEndpoints: [] as string[] };
    }

    const lines = problem.description.split("\n");
    const parsedEndpoints: string[] = [];
    let firstEndpointIndex = -1;
    let lastEndpointIndex = -1;

    lines.forEach((line, index) => {
      const match = line.match(ENDPOINT_LINE_REGEX);
      if (!match) {
        return;
      }

      if (firstEndpointIndex === -1) {
        firstEndpointIndex = index;
      }

      lastEndpointIndex = index;
      parsedEndpoints.push(match[1].trim());
    });

    if (firstEndpointIndex === -1) {
      return {
        beforeDescription: problem.description.trim(),
        afterDescription: "",
        parsedEndpoints
      };
    }

    return {
      beforeDescription: lines.slice(0, firstEndpointIndex).join("\n").trim(),
      afterDescription: lines.slice(lastEndpointIndex + 1).join("\n").trim(),
      parsedEndpoints
    };
  }, [problem?.description]);
  const resolvedProblemEndpoints = parsedProblemBrief.parsedEndpoints.length
    ? parsedProblemBrief.parsedEndpoints
    : (problem?.endpoints ?? []);
  const resolvedProblemRequirements = problem?.requirements?.length
    ? problem.requirements
    : [];
  const resolvedProblemCases = problem?.publicCases?.length
    ? problem.publicCases
    : [];
  const resolvedProblemCriteria = problem?.criteria?.length
    ? problem.criteria
    : [];
  const problemRequirementsCount = resolvedProblemRequirements.length;
  const problemCasesCount = resolvedProblemCases.length;
  const problemEndpointCount = resolvedProblemEndpoints.length;
  const breadcrumbParts =
    activeWorkbenchTab === "problem"
      ? ["problem", problem?.title ?? "brief"]
      : activeWorkbenchTab === "trace"
        ? ["trace", "에이전트 실행 기록"]
        : activeFile?.path.split("/") ?? [];
  const bottomTabMeta: Record<BottomPanelTab, string> = {
    output: runResult ? `code ${runResult.exitCode}` : "ready",
    tests: testResult ? `${testResult.passed}/${testResult.total}` : "idle",
    trace: `${traces.length}`
  };
  const activityMeta: Record<SidebarView | "ai" | "output", string | null> = {
    explorer: dirtyCount ? `${dirtyCount}` : openTabs.length ? `${openTabs.length}` : `${files.length}`,
    search: searchQuery.trim() ? `${searchMatches.length}` : null,
    trace: null,
    extensions: `${extensionItems.length}`,
    harness: null,
    ai: aiQuotaLabel,
    output: testResult ? `${testResult.failed}` : traces.length ? `${traces.length}` : null
  };
  const lastSavedDate = parseApiDateTime(lastSavedAt);
  const lastSavedLabel = lastSavedDate
    ? `저장 ${lastSavedDate.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      })}`
    : "자동 저장 대기";
  const savePromptTitle =
    savePromptAction?.type === "close-tab"
      ? `${getFileName(savePromptAction.path)}을(를) 저장할까요?`
      : savePromptAction?.type === "navigate"
        ? "페이지를 이동하기 전에 저장할까요?"
        : savePromptAction?.type === "end-session"
          ? "세션을 종료하기 전에 저장할까요?"
          : "실행 전에 저장할까요?";
  const savePromptDescription =
    savePromptAction?.type === "close-tab"
      ? "저장하지 않으면 이 파일의 마지막 저장 이후 변경 내용이 사라집니다."
      : savePromptAction?.type === "navigate"
        ? `${unsavedPaths.length}개의 저장되지 않은 파일이 있습니다. 저장하지 않으면 변경 내용이 사라질 수 있습니다.`
        : savePromptAction?.type === "end-session"
          ? `${unsavedPaths.length}개의 저장되지 않은 파일이 있습니다. 세션 종료 후에는 파일 저장, 실행, 제출이 차단될 수 있습니다.`
          : `${unsavedPaths.length}개의 저장되지 않은 파일이 있습니다. 저장 후 실행하면 현재 수정사항으로 실행됩니다.`;
  const solveElapsedMs = solveNow - toTimestamp(session?.createdAt);
  const solveElapsedLabel = formatSolveElapsed(solveElapsedMs);
  const estimateLimitMs = parseEstimateMs(problem?.estimate ?? "");
  const isTimeExpired = estimateLimitMs > 0 && solveElapsedMs >= estimateLimitMs;
  const isOvertime = estimateLimitMs > 0 && solveElapsedMs > estimateLimitMs;
  const overtimeMs = isOvertime ? solveElapsedMs - estimateLimitMs : 0;
  const timerProgress = estimateLimitMs > 0 ? Math.min(1, solveElapsedMs / estimateLimitMs) : 0;
  const timerPhase = isOvertime ? "overtime" : timerProgress >= 0.85 ? "warning" : "normal";
  const showEmptyEditor = activeWorkbenchTab === "code" && openTabs.length === 0;
  const showBottomPanel = bottomPanelOpen;

  useEffect(() => {
    sessionTimeoutHandledRef.current = false;
  }, [sessionId]);

  useEffect(() => {
    if (!session || !problem || !isTimeExpired || sessionTimeoutHandledRef.current) {
      return;
    }

    sessionTimeoutHandledRef.current = true;
    setSavePromptOpen(false);
    setSavePromptAction(null);
    addToast("제한 시간이 지나 세션이 종료되었습니다.", "warning");

    void queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    router.replace(withPrefix("/problems"));
  }, [addToast, isTimeExpired, problem, queryClient, router, session, sessionId, withPrefix]);

  const handleMount = (editor: any, monaco: any) => {
    cleanupEditorSubscriptions();
    editorRef.current = editor;
    trackMonacoModels(editor, monaco);
    const initialPosition = editor.getPosition();

    if (initialPosition) {
      updateCursorPosition({
        line: initialPosition.lineNumber,
        column: initialPosition.column
      });
    }

    const selectionDisposable = editor.onDidChangeCursorSelection(() => {
      if (selectionDebounceTimerRef.current) clearTimeout(selectionDebounceTimerRef.current);
      selectionDebounceTimerRef.current = setTimeout(() => {
        const selection = editor.getSelection();

        if (!selection || selection.isEmpty()) {
          const position = editor.getPosition();

          if (position) {
            updateCursorPosition({
              line: position.lineNumber,
              column: position.column
            });
          }

          setSelection("", null);
          return;
        }

        const position = selection.getPosition();
        const model = editor.getModel();
        if (!model) return;

        const code = clampSelectionCode(model.getValueInRange(selection) ?? "");
        const lineCount = model.getLineCount();
        const startLine = Math.min(selection.startLineNumber, lineCount);
        const endLine = Math.min(selection.endLineNumber, lineCount);
        const range: SelectionRange = {
          startLineNumber: startLine,
          startColumn: selection.startColumn,
          endLineNumber: endLine,
          endColumn: selection.endColumn
        };

        updateCursorPosition({
          line: position.lineNumber,
          column: position.column
        });
        setSelection(code, range);
      }, 80);
    });
    editorDisposablesRef.current.push(selectionDisposable);

    requestEditorLayout();
    syncMonacoAuxInputs();
  };

  const handleDiffMount = (editor: any, monaco: any) => {
    diffEditorRef.current = editor;
    trackMonacoModels(editor, monaco);
    requestEditorLayout();
  };

  const handleTabRailWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    const rail = event.currentTarget;

    if (rail.scrollWidth <= rail.clientWidth) {
      return;
    }

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;

    if (!delta) {
      return;
    }

    rail.scrollLeft += delta;
  }, []);

  const beginResize = (mode: DragMode) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    dragStateRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startWidth:
        mode === "sidebar"
          ? sidebarOpen
            ? effectiveSidebarWidth
            : SIDEBAR_CLOSE_WIDTH
          : aiOpen
            ? effectiveAiPanelWidth
            : AI_PANEL_CLOSE_WIDTH,
      startHeight: bottomPanelOpen ? effectiveBottomPanelHeight : BOTTOM_PANEL_CLOSE_HEIGHT,
      collapsed: false
    };

    document.body.style.cursor = mode === "bottom" ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
  };

  const focusLine = (path: string, lineNumber?: number) => {
    setActiveWorkbenchTab("code");
    setOpenTabPaths((state) => (state.includes(path) ? state : [...state, path]));
    setActiveTabId(path);
    setActivePath(path);

    window.requestAnimationFrame(() => {
      if (!editorRef.current || !lineNumber) {
        return;
      }

      editorRef.current.focus();
      editorRef.current.revealLineInCenter(lineNumber);
      editorRef.current.setPosition({ lineNumber, column: 1 });
    });
  };

  const openDiffTab = (targetPath: string) => {
    const diffTabId = createDiffTabId(targetPath);

    setActiveWorkbenchTab("code");
    setOpenTabPaths((state) => (state.includes(diffTabId) ? state : [...state, diffTabId]));
    setActiveTabId(diffTabId);
    setSelection("", null);
    setSuggestion(null);
    setAiMode("chat");
  };

  const handleOpenCodeWorkbench = () => {
    setActiveWorkbenchTab("code");
  };

  const handleActivityClick = (view: SidebarView) => {
    handleOpenCodeWorkbench();

    if (sidebarView === view && sidebarOpen) {
      setSidebarOpen(false);
      return;
    }

    setSidebarView(view);
  };

  const handleToggleSidebarPanel = () => {
    handleOpenCodeWorkbench();
    setSidebarOpen(!sidebarOpen);
  };

  const handleToggleBottomPanel = () => {
    handleOpenCodeWorkbench();
    setBottomPanelOpen(!bottomPanelOpen);
  };

  const handleToggleAiPanel = () => {
    handleOpenCodeWorkbench();
    toggleAiOpen();
  };

  const refreshSession = () => {
    void queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
  };

  const hasDirtyDescendant = useCallback(
    (path: string | null) => {
      if (!path) {
        return false;
      }

      return unsavedPaths.some((item) => item === path || item.startsWith(`${path}/`));
    },
    [unsavedPaths]
  );

  const closeTabImmediate = useCallback(
    (tabId: string) => {
      setOpenTabPaths((state) => {
        const currentIndex = state.indexOf(tabId);
        const next = state.filter((item) => item !== tabId);

        if (activeTabId === tabId) {
          const fallback = next[currentIndex] ?? next[currentIndex - 1] ?? next[0] ?? null;

          setActiveTabId(fallback);
          setActiveWorkbenchTab("code");

          if (!fallback) {
            setSelection("", null);
            setSuggestion(null);
          }
        }

        return next;
      });
    },
    [activeTabId, setSelection, setSuggestion]
  );

  const savePaths = useCallback(
    async (paths: string[]) => {
      const uniquePaths = [...new Set(paths.filter(Boolean))];
      if (!uniquePaths.length) {
        return true;
      }

      const targetFiles = uniquePaths
        .map((path) => files.find((file) => file.path === path))
        .filter((file): file is WorkspaceFile => Boolean(file));

      if (!targetFiles.length) {
        return true;
      }

      setSaving(true);
      try {
        const results = await Promise.allSettled(
          targetFiles.map((file) =>
            isBackendSessionId(sessionId)
              ? sessionApi.saveFile(sessionId, {
                  path: file.path,
                  content: file.content,
                  language: file.language
                })
              : mockApi.saveFile(sessionId, file.path, file.content)
          )
        );

        const savedAt = new Date().toISOString();
        const failedFiles: Array<{ name: string; reason: string }> = [];

        results.forEach((result, i) => {
          const file = targetFiles[i];
          if (result.status === "fulfilled") {
            markSaved(file.path, savedAt);
          } else {
            failedFiles.push({
              name: file.path.split("/").pop() ?? file.path,
              reason: result.reason instanceof Error ? result.reason.message : "저장 실패"
            });
          }
        });

        if (failedFiles.length > 0) {
          const names = failedFiles.map((f) => f.name).join(", ");
          const detail = failedFiles.length === 1 ? ` — ${failedFiles[0].reason}` : "";
          addToast(
            failedFiles.length === 1
              ? `저장 실패: ${names}${detail}`
              : `${failedFiles.length}개 파일 저장 실패: ${names}`,
            "error"
          );
          return false;
        }

        refreshSession();
        return true;
      } finally {
        setSaving(false);
      }
    },
    [addToast, files, markSaved, sessionId]
  );

  const saveActiveFile = useCallback(async () => {
    if (!activeFile || activeTab?.kind !== "file") {
      return false;
    }

    return savePaths([activeFile.path]);
  }, [activeFile, activeTab?.kind, savePaths]);

  const saveAllDirtyFiles = useCallback(async () => {
    return savePaths(unsavedPaths);
  }, [savePaths, unsavedPaths]);

  const executeRun = useCallback(async () => {
    setRunLoading(true);
    try {
      const result = await mockApi.runCode(sessionId);
      setRunResult(result);
      refreshSession();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "실행에 실패했습니다.", "error");
    } finally {
      setRunLoading(false);
    }
  }, [addToast, sessionId, setRunResult]);


  const toggleExplorerSection = (key: ExplorerSectionKey) => {
    setExplorerSections((state) => ({
      ...state,
      [key]: !state[key]
    }));
  };

  const handleOpenProblemTab = () => {
    setActiveWorkbenchTab("problem");
  };

  const handleIdeContextMenu = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
  }, []);

  const openExplorerContextMenu = useCallback(
    (
      event: ReactMouseEvent<HTMLElement>,
      target: { parentPath: string | null; targetPath: string | null; targetKind: "root" | "folder" | "file" }
    ) => {
      event.preventDefault();
      event.stopPropagation();
      setExplorerContextMenu({
        x: event.clientX,
        y: event.clientY,
        parentPath: target.parentPath,
        targetPath: target.targetPath,
        targetKind: target.targetKind
      });
    },
    []
  );

  const beginExplorerCreate = useCallback(
    (kind: "file" | "folder", parentPath: string | null) => {
      setExplorerContextMenu(null);
      setExplorerCreateDraft({ kind, parentPath, value: "" });

      if (parentPath) {
        setCollapsedFolders((prev) => {
          if (!prev.has(parentPath)) {
            return prev;
          }

          const next = new Set(prev);
          next.delete(parentPath);
          return next;
        });
      }
    },
    []
  );

  const cancelExplorerCreate = useCallback(() => {
    setExplorerCreateDraft(null);
  }, []);

  const beginExplorerRename = useCallback(() => {
    if (!explorerContextMenu?.targetPath || explorerContextMenu.targetKind === "root") {
      return;
    }

    setExplorerContextMenu(null);
    setExplorerRenameDraft({
      targetPath: explorerContextMenu.targetPath,
      targetKind: explorerContextMenu.targetKind,
      parentPath:
        explorerContextMenu.targetKind === "folder"
          ? getFolderPath(explorerContextMenu.targetPath) || null
          : explorerContextMenu.parentPath,
      value: getFileName(explorerContextMenu.targetPath)
    });
  }, [explorerContextMenu]);

  const cancelExplorerRename = useCallback(() => {
    setExplorerRenameDraft(null);
  }, []);

  const commitExplorerCreate = useCallback(async () => {
    if (!explorerCreateDraft) {
      return;
    }

    const rawName = explorerCreateDraft.value.trim().replace(/^\/+|\/+$/g, "");
    if (!rawName) {
      setExplorerCreateDraft(null);
      return;
    }

    const nextPath = explorerCreateDraft.parentPath ? `${explorerCreateDraft.parentPath}/${rawName}` : rawName;

    if (explorerCreateDraft.kind === "folder") {
      setLocalFolders((state) => (state.includes(nextPath) ? state : [...state, nextPath]));
      setExplorerCreateDraft(null);
      addToast(`폴더 '${rawName}' 생성 준비 완료`, "success");
      return;
    }

    if (files.some((file) => file.path === nextPath)) {
      addToast("같은 이름의 파일이 이미 있습니다.", "warning");
      return;
    }

    const nextLanguage = inferLanguageFromPath(nextPath);

    if (isBackendSessionId(sessionId)) {
      try {
        const workspaceResult = await sessionApi.createFile(sessionId, {
          path: nextPath,
          nodeType: "FILE",
          language: nextLanguage,
          content: ""
        });

        setWorkspace(workspaceResult.files, nextPath);
        setOpenTabPaths((state) => (state.includes(nextPath) ? state : [...state, nextPath]));
        setActiveTabId(nextPath);
        setActivePath(nextPath);
        setExplorerCreateDraft(null);
        void queryClient.invalidateQueries({ queryKey: ["workspace", sessionId] });
        void queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
        addToast(`파일 '${rawName}'을 생성했어요.`, "success");
        return;
      } catch (error) {
        addToast(error instanceof Error ? error.message : "파일 생성에 실패했습니다.", "error");
        return;
      }
    }

    createWorkspaceFile(
      {
        path: nextPath,
        language: nextLanguage,
        content: ""
      },
      true
    );
    setOpenTabPaths((state) => (state.includes(nextPath) ? state : [...state, nextPath]));
    setActiveTabId(nextPath);
    setActivePath(nextPath);
    setExplorerCreateDraft(null);
    addToast(`파일 '${rawName}' 생성 준비 완료`, "success");
  }, [addToast, createWorkspaceFile, explorerCreateDraft, files, queryClient, sessionId, setActivePath, setWorkspace]);

  const commitExplorerRename = useCallback(() => {
    if (!explorerRenameDraft) {
      return;
    }

    const rawName = explorerRenameDraft.value.trim().replace(/^\/+|\/+$/g, "");
    if (!rawName) {
      setExplorerRenameDraft(null);
      return;
    }

    const nextPath = explorerRenameDraft.parentPath ? `${explorerRenameDraft.parentPath}/${rawName}` : rawName;

    if (nextPath === explorerRenameDraft.targetPath) {
      setExplorerRenameDraft(null);
      return;
    }

    if (explorerRenameDraft.targetKind === "file") {
      if (files.some((file) => file.path === nextPath)) {
        addToast("같은 이름의 파일이 이미 있습니다.", "warning");
        return;
      }

      setLocalFolders((state) => appendLocalFolder(state, getFolderPath(explorerRenameDraft.targetPath) || null));
      renameWorkspaceFile(explorerRenameDraft.targetPath, nextPath);
      setOpenTabPaths((state) => state.map((path) => (path === explorerRenameDraft.targetPath ? nextPath : path)));
      setActiveTabId((state) => (state === explorerRenameDraft.targetPath ? nextPath : state));
      setExplorerRenameDraft(null);
      addToast(`파일 이름을 '${rawName}'로 변경했어요.`, "success");
      return;
    }

    if (
      localFolders.some(
        (folder) => folder !== explorerRenameDraft.targetPath && (folder === nextPath || folder.startsWith(`${nextPath}/`))
      )
    ) {
      addToast("같은 이름의 폴더가 이미 있습니다.", "warning");
      return;
    }

    setLocalFolders((state) => state.map((folder) => replacePathPrefix(folder, explorerRenameDraft.targetPath, nextPath)));
    files
      .filter((file) => file.path.startsWith(`${explorerRenameDraft.targetPath}/`))
      .forEach((file) => {
        renameWorkspaceFile(file.path, replacePathPrefix(file.path, explorerRenameDraft.targetPath, nextPath));
      });
    setOpenTabPaths((state) => state.map((path) => replacePathPrefix(path, explorerRenameDraft.targetPath, nextPath)));
    setActiveTabId((state) => (state ? replacePathPrefix(state, explorerRenameDraft.targetPath, nextPath) : state));
    setExplorerRenameDraft(null);
    addToast(`폴더 이름을 '${rawName}'로 변경했어요.`, "success");
  }, [addToast, explorerRenameDraft, files, localFolders, renameWorkspaceFile]);

  const handleExplorerDelete = useCallback(() => {
    if (!explorerContextMenu?.targetPath || explorerContextMenu.targetKind === "root") {
      return;
    }

    const targetPath = explorerContextMenu.targetPath;
    const targetKind = explorerContextMenu.targetKind;
    setExplorerContextMenu(null);

    if (targetKind === "file") {
      setLocalFolders((state) => appendLocalFolder(state, getFolderPath(targetPath) || null));
      removeWorkspaceFile(targetPath);
      setOpenTabPaths((state) => state.filter((path) => path !== targetPath));
      setActiveTabId((state) => (state === targetPath ? null : state));
      addToast(`파일 '${getFileName(targetPath)}'을 삭제했어요.`, "success");
      return;
    }

    setLocalFolders((state) => state.filter((folder) => folder !== targetPath && !folder.startsWith(`${targetPath}/`)));
    files
      .filter((file) => file.path.startsWith(`${targetPath}/`))
      .forEach((file) => removeWorkspaceFile(file.path));
    setOpenTabPaths((state) => state.filter((path) => !path.startsWith(`${targetPath}/`)));
    setActiveTabId((state) => (state && state.startsWith(`${targetPath}/`) ? null : state));
    addToast(`폴더 '${getFileName(targetPath)}'을 삭제했어요.`, "success");
  }, [addToast, explorerContextMenu, files, removeWorkspaceFile]);

  const handleExplorerFileDragStart = useCallback((event: ReactDragEvent<HTMLElement>, path: string) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", path);
    setDraggedExplorerPath(path);
    setFolderDropTargetPath(null);
  }, []);

  const handleExplorerFolderDragOver = useCallback(
    (event: ReactDragEvent<HTMLElement>, targetFolderPath: string) => {
      const sourcePath = draggedExplorerPath || event.dataTransfer.getData("text/plain");
      if (!sourcePath || sourcePath === targetFolderPath || getFolderPath(sourcePath) === targetFolderPath) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setFolderDropTargetPath((current) => (current === targetFolderPath ? current : targetFolderPath));
    },
    [draggedExplorerPath]
  );

  const clearExplorerDragState = useCallback(() => {
    setDraggedExplorerPath(null);
    setFolderDropTargetPath(null);
  }, []);

  const handleExplorerFolderDrop = useCallback(
    (event: ReactDragEvent<HTMLElement>, targetFolderPath: string) => {
      event.preventDefault();
      const sourcePath = draggedExplorerPath || event.dataTransfer.getData("text/plain");
      clearExplorerDragState();

      if (!sourcePath || getFolderPath(sourcePath) === targetFolderPath) {
        return;
      }

      const file = files.find((item) => item.path === sourcePath);
      if (!file) {
        return;
      }

      const nextPath = `${targetFolderPath}/${getFileName(sourcePath)}`;
      if (files.some((item) => item.path === nextPath)) {
        addToast("같은 이름의 파일이 이미 있어 이동할 수 없어요.", "warning");
        return;
      }

      setLocalFolders((state) => appendLocalFolder(state, getFolderPath(sourcePath) || null));
      renameWorkspaceFile(sourcePath, nextPath);
      setOpenTabPaths((state) => state.map((path) => (path === sourcePath ? nextPath : path)));
      setActiveTabId((state) => (state === sourcePath ? nextPath : state));
      addToast(`파일을 '${getFileName(targetFolderPath)}' 폴더로 이동했어요.`, "success");
    },
    [addToast, clearExplorerDragState, draggedExplorerPath, files, renameWorkspaceFile]
  );

  const handleCloseFileTab = (tabId: string) => {
    const targetTab = openTabs.find((tab) => tab.id === tabId);
    if (!targetTab) {
      return;
    }

    if (targetTab.kind === "file" && unsavedPaths.includes(targetTab.path)) {
      setSavePromptAction({ type: "close-tab", tabId, path: targetTab.path });
      setSavePromptOpen(true);
      return;
    }

    closeTabImmediate(tabId);
  };

  const clearTabDragState = useCallback(() => {
    setDraggedTabId(null);
    setTabDropHint(null);
  }, []);

  const handleTabDragStart = useCallback((event: ReactDragEvent<HTMLDivElement>, tabId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", tabId);
    setDraggedTabId(tabId);
    setTabDropHint(null);
  }, []);

  const handleTabDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, targetId: string) => {
      if (!draggedTabId || draggedTabId === targetId) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";

      const bounds = event.currentTarget.getBoundingClientRect();
      const position = event.clientX - bounds.left > bounds.width / 2 ? "after" : "before";

      setTabDropHint((current) =>
        current?.targetId === targetId && current.position === position ? current : { targetId, position }
      );
    },
    [draggedTabId]
  );

  const handleTabDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, targetId: string) => {
      event.preventDefault();

      const sourceId = draggedTabId || event.dataTransfer.getData("text/plain");
      if (!sourceId || sourceId === targetId || !tabDropHint || tabDropHint.targetId !== targetId) {
        clearTabDragState();
        return;
      }

      setOpenTabPaths((state) => reorderItems(state, sourceId, targetId, tabDropHint.position));
      clearTabDragState();
    },
    [clearTabDragState, draggedTabId, tabDropHint]
  );

  const handleTabDragEnd = useCallback(() => {
    clearTabDragState();
  }, [clearTabDragState]);

  const handleRequestEdit = async () => {
    if (!selectedCode) {
      addToast("먼저 에디터에서 코드를 선택하세요.", "warning");
      return;
    }

    setEditLoading(true);
    try {
      const nextSuggestion = await mockApi.requestAiEdit(
        sessionId,
        activeFile.path,
        activeFile.content,
        selectedCode,
        editInstruction
      );
      setSuggestion(nextSuggestion);
      addToast("AI 수정 제안을 불러왔습니다.", "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "AI 수정 요청에 실패했습니다.", "error");
    } finally {
      setEditLoading(false);
    }
  };

  const handleApplyEdit = async () => {
    if (!editorRef.current || !selectedRange || !suggestion || !activeFile) {
      return;
    }

    const model = editorRef.current.getModel();
    if (!model) return;

    const lineCount = model.getLineCount();
    const clampedRange = {
      startLineNumber: Math.min(selectedRange.startLineNumber, lineCount),
      startColumn: selectedRange.startColumn,
      endLineNumber: Math.min(selectedRange.endLineNumber, lineCount),
      endColumn: selectedRange.endColumn
    };

    editorRef.current.executeEdits("ai-edit", [
      {
        range: clampedRange,
        text: suggestion.replacement
      }
    ]);

    const nextContent = model.getValue() ?? "";
    updateFileContent(activeFile.path, nextContent);
    await mockApi.applyAiEdit(sessionId, activeFile.path, nextContent, suggestion.summary);
    setSuggestion(null);
    setAiMode("chat");
    refreshSession();
    addToast("AI 제안을 에디터에 반영했습니다.", "success");
  };

  const handleRun = async () => {
    if (unsavedPaths.length) {
      setSavePromptAction({ type: "run" });
      setSavePromptOpen(true);
      return;
    }

    await executeRun();
  };

  const executeEndSession = useCallback(async () => {
    if (endSessionLoading) {
      return;
    }

    setEndSessionLoading(true);
    try {
      if (isBackendSessionId(sessionId)) {
        const result = await sessionApi.endSession(sessionId);
        addToast(`세션이 종료되었습니다. 리포트 생성을 시작합니다. (${result.endedAt})`, "success");
      } else {
        addToast("세션이 종료되었습니다.", "success");
      }

      await queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      router.push(withPrefix("/problems"));
    } catch (error) {
      addToast(error instanceof Error ? error.message : "세션 종료에 실패했습니다.", "error");
    } finally {
      setEndSessionLoading(false);
    }
  }, [addToast, endSessionLoading, queryClient, router, sessionId, withPrefix]);

  const handleEndSession = useCallback(() => {
    if (unsavedPaths.length) {
      setSavePromptAction({ type: "end-session" });
      setSavePromptOpen(true);
      return;
    }

    void executeEndSession();
  }, [executeEndSession, unsavedPaths.length]);

  const handleNavigateRequest = useCallback(
    (href: string) => {
      if (unsavedPaths.length) {
        setSavePromptAction({ type: "navigate", href });
        setSavePromptOpen(true);
        return;
      }

      router.push(href);
    },
    [router, unsavedPaths.length]
  );

  const handleSavePromptCancel = useCallback(() => {
    if (saving) {
      return;
    }

    setSavePromptOpen(false);
    setSavePromptAction(null);
  }, [saving]);

  const handleSavePromptDiscard = useCallback(async () => {
    if (!savePromptAction || saving) {
      return;
    }

    setSavePromptOpen(false);
    setSavePromptAction(null);

    if (savePromptAction.type === "close-tab") {
      discardFileChanges(savePromptAction.path);
      closeTabImmediate(savePromptAction.tabId);
    } else if (savePromptAction.type === "navigate") {
      savedBackTargetRef.current = null;
      router.push(savePromptAction.href);
    } else if (savePromptAction.type === "end-session") {
      await executeEndSession();
    } else {
      await executeRun();
    }
  }, [closeTabImmediate, discardFileChanges, executeEndSession, executeRun, router, savePromptAction, saving]);

  const handleSavePromptSave = useCallback(async () => {
    if (!savePromptAction || saving) {
      return;
    }

    const pathsToSave = savePromptAction.type === "close-tab" ? [savePromptAction.path] : [...unsavedPaths];
    const didSave = await savePaths(pathsToSave);
    if (!didSave) {
      return;
    }

    setSavePromptOpen(false);
    setSavePromptAction(null);

    if (savePromptAction.type === "close-tab") {
      closeTabImmediate(savePromptAction.tabId);
    } else if (savePromptAction.type === "navigate") {
      savedBackTargetRef.current = null;
      router.push(savePromptAction.href);
    } else if (savePromptAction.type === "end-session") {
      await executeEndSession();
    } else {
      await executeRun();
    }
  }, [closeTabImmediate, executeEndSession, executeRun, router, savePaths, savePromptAction, saving, unsavedPaths]);

  useEffect(() => {
    const handleWindowKeydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveAllDirtyFiles();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveActiveFile();
      }
    };

    window.addEventListener("keydown", handleWindowKeydown);
    return () => window.removeEventListener("keydown", handleWindowKeydown);
  }, [saveActiveFile, saveAllDirtyFiles]);

  useEffect(() => {
    try {
      window.localStorage.setItem(AUTO_SAVE_STORAGE_KEY, autoSaveEnabled ? "1" : "0");
    } catch {
      // noop
    }
  }, [autoSaveEnabled]);

  useEffect(() => {
    if (!autoSaveEnabled) {
      return;
    }

    const timer = window.setInterval(() => {
      if (!unsavedPaths.length || saving) {
        return;
      }

      void saveAllDirtyFiles();
    }, AUTO_SAVE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [autoSaveEnabled, saveAllDirtyFiles, saving, unsavedPaths.length]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (
        !unsavedPaths.length ||
        savePromptOpen ||
        saving ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) {
        return;
      }

      const nextHref = `${url.pathname}${url.search}${url.hash}`;
      const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextHref === currentHref) {
        return;
      }

      event.preventDefault();
      setSavePromptAction({ type: "navigate", href: nextHref });
      setSavePromptOpen(true);
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [savePromptOpen, saving, unsavedPaths.length]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!unsavedPaths.length) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [unsavedPaths.length]);

  // Keep refs in sync so the persistent popstate handler always sees current values
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    isDirtyRef.current = unsavedPaths.length > 0;
    if (!unsavedPaths.length) {
      savedBackTargetRef.current = null;
    }
  }, [unsavedPaths.length]);

  // Register popstate guard ONCE on mount. Uses refs so it never needs re-registration.
  useEffect(() => {
    const ideHref = window.location.pathname + window.location.search + window.location.hash;

    const showModal = (target: string) => {
      // flushSync forces React to render the modal synchronously before any
      // concurrent re-render (e.g. from Next.js router) can reset the state.
      flushSync(() => {
        setSavePromptAction({ type: "navigate", href: target });
        setSavePromptOpen(true);
      });
      // Belt-and-suspenders: if Next.js already started navigating despite
      // stopImmediatePropagation, replace back to the IDE page to cancel it.
      routerRef.current.replace(ideHref as any);
    };

    const handlePopState = (e: PopStateEvent) => {
      if (!isDirtyRef.current) {
        return;
      }

      if (allowNextPopStateRef.current) {
        allowNextPopStateRef.current = false;
        return;
      }

      const targetHref = window.location.pathname + window.location.search + window.location.hash;

      if (targetHref === ideHref) {
        // Back from a guard entry to the original ide entry (same URL).
        // Re-push guard so no extra press is ever needed.
        if (savedBackTargetRef.current) {
          e.stopImmediatePropagation();
          window.history.pushState(null, "", ideHref);
          showModal(savedBackTargetRef.current);
        }
        return;
      }

      // New back/forward navigation: block, restore URL, show modal.
      e.stopImmediatePropagation();
      window.history.pushState(null, "", ideHref);
      savedBackTargetRef.current = targetHref;
      showModal(targetHref);
    };

    window.addEventListener("popstate", handlePopState, true);
    return () => window.removeEventListener("popstate", handlePopState, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTest = async () => {
    setTestLoading(true);
    try {
      const result = await mockApi.runTests(sessionId);
      setTestResult(result);
      refreshSession();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "테스트 실행에 실패했습니다.", "error");
    } finally {
      setTestLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitLoading(true);
    try {
      const submission = await mockApi.submitSession(sessionId);
      addToast("제출이 생성되었습니다.", "success");
      router.push(withPrefix(`/submissions/${submission.id}`));
    } catch (error) {
      addToast(error instanceof Error ? error.message : "제출에 실패했습니다.", "error");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleAgentBuild = () => {
    const nextVersion = agentSnapshotVersion + 1;

    setAgentSnapshotVersion(nextVersion);
    addToast(`Agent Build를 준비했습니다. 스냅샷 v0.${nextVersion}`, "success");
  };

  const handleSend = async () => {
    if (!chatInput.trim()) {
      return;
    }

    const message = chatInput.trim();
    setChatInput("");

    try {
      await send(message, activeFile?.path);
      refreshSession();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "AI 요청에 실패했습니다.", "error");
    }
  };

  const renderSectionToggle = (key: ExplorerSectionKey, label: string, meta?: string) => (
    <button type="button" className="section-toggle" onClick={() => toggleExplorerSection(key)}>
      <span className="section-toggle__caret">{explorerSections[key] ? "v" : ">"}</span>
      <span>{label}</span>
      {meta ? <small>{meta}</small> : null}
    </button>
  );

  const toggleFolder = useCallback((folderKey: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderKey)) {
        next.delete(folderKey);
      } else {
        next.add(folderKey);
      }
      return next;
    });
  }, []);

  const renderTreeNodes = (nodes: TreeNode[], depth = 0): Array<JSX.Element> =>
    nodes.flatMap((node, index) => {
      const isLast = index === nodes.length - 1;
      const treeGuideLeft = `${6 + depth * 7}px`;
      const treeGuideBottom = isLast ? "50%" : "-4px";

      if (node.kind === "folder") {
        const collapsed = collapsedFolders.has(node.key);
        const folderIcon = getFolderIconSpec(node.name, node.path, !collapsed);
        const folderDisplayName = getFolderDisplayName(node.name, node.path);
        const isCreateTarget = explorerCreateDraft?.parentPath === node.path;
        const isContextTarget = explorerContextMenu?.targetKind === "folder" && explorerContextMenu.targetPath === node.path;
        const isRenameTarget = explorerRenameDraft?.targetKind === "folder" && explorerRenameDraft.targetPath === node.path;
        const isDropTarget = folderDropTargetPath === node.path;
        const isDirtyFolder = collapsed && hasDirtyDescendant(node.path);
        const isWorktreeFolder = node.path === ".worktree";
        return [
          <div key={node.key} className={"tree-branch" + (collapsed ? " tree-branch--closed" : " tree-branch--open")}>
            <button
              type="button"
              className={
                "tree-folder" +
                (collapsed ? " tree-folder--closed" : " tree-folder--open") +
                (isCreateTarget ? " tree-folder--create-target" : "") +
                (isContextTarget ? " tree-folder--context-target" : "") +
                (isDropTarget ? " tree-folder--drop-target" : "")
              }
              aria-expanded={!collapsed}
              style={{
                ["--tree-depth" as string]: depth,
                ["--tree-guide-left" as string]: treeGuideLeft,
                ["--tree-guide-bottom" as string]: treeGuideBottom,
                paddingLeft: `${7 + depth * 7}px`
              }}
              onClick={() => toggleFolder(node.key)}
              onDragOver={(event) => handleExplorerFolderDragOver(event, node.path ?? "")}
              onDrop={(event) => handleExplorerFolderDrop(event, node.path ?? "")}
              onDragLeave={() => setFolderDropTargetPath((current) => (current === node.path ? null : current))}
              onContextMenu={(event) =>
                openExplorerContextMenu(event, {
                  parentPath: node.path,
                  targetPath: node.path,
                  targetKind: "folder"
                })
              }
            >
              <span
                className={"tree-row__twistie codicon " + (collapsed ? "codicon-chevron-right" : "codicon-chevron-down")}
                aria-hidden
              />
              <span
                className={"tree-folder__icon " + folderIcon.iconClass}
                data-folder-kind={folderIcon.kind}
                aria-hidden
              />
              {isRenameTarget ? (
                <input
                  autoFocus
                  className="tree-create-row__input"
                  value={explorerRenameDraft.value}
                  onChange={(event) =>
                    setExplorerRenameDraft((state) => (state ? { ...state, value: event.target.value } : state))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitExplorerRename();
                    }

                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelExplorerRename();
                    }
                  }}
                  onBlur={cancelExplorerRename}
                  onClick={(event) => event.stopPropagation()}
                />
                ) : (
                  <>
                    <span className={isDirtyFolder ? "tree-row__folder tree-row__folder--dirty" : "tree-row__folder"}>{folderDisplayName}</span>
                    {isDirtyFolder ? <span className="file-row__dot file-row__dot--folder" /> : null}
                    {isWorktreeFolder ? <span className="tree-row__badge">ai</span> : null}
                  </>
                )}
            </button>
            {!collapsed ? (
              <div className="tree-branch__children">
                {explorerCreateDraft?.parentPath === node.path ? (
                  <div
                    className="tree-create-row"
                    style={{ paddingLeft: `${9 + (depth + 1) * 7}px` }}
                  >
                    <span
                      className={
                        explorerCreateDraft.kind === "folder"
                          ? "tree-folder__icon codicon codicon-new-folder"
                          : "file-icon codicon codicon-new-file"
                      }
                      aria-hidden
                    />
                    <input
                      autoFocus
                      className="tree-create-row__input"
                      value={explorerCreateDraft.value}
                      placeholder={explorerCreateDraft.kind === "folder" ? "폴더 이름" : "파일 이름"}
                      onChange={(event) =>
                        setExplorerCreateDraft((state) => (state ? { ...state, value: event.target.value } : state))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitExplorerCreate();
                        }

                        if (event.key === "Escape") {
                          event.preventDefault();
                          cancelExplorerCreate();
                        }
                      }}
                      onBlur={cancelExplorerCreate}
                    />
                  </div>
                ) : null}
                {renderTreeNodes(node.children, depth + 1)}
              </div>
            ) : null}
          </div>
        ];
      }

      const file = node.file;

      if (!file) {
        return [];
      }

      if (file.isVirtual) {
        const isWorktree = file.path.startsWith(".worktree/");
        const isActiveVirtual = isWorktree
          ? activeTabId === createDiffTabId(file.path)
          : activeTabId === file.path;
        const isContextTarget = explorerContextMenu?.targetKind === "file" && explorerContextMenu.targetPath === file.path;
        const fileIcon = getFileIconSpec(file);
        return [
          <button
            key={node.key}
            type="button"
            className={
              isActiveVirtual
                ? "tree-row tree-row--file tree-row--virtual tree-row--active" + (isContextTarget ? " tree-row--context-target" : "")
                : "tree-row tree-row--file tree-row--virtual" + (isContextTarget ? " tree-row--context-target" : "")
            }
            style={{
              ["--tree-depth" as string]: depth,
              ["--tree-guide-left" as string]: treeGuideLeft,
              ["--tree-guide-bottom" as string]: treeGuideBottom,
              paddingLeft: `${9 + depth * 7}px`
            }}
            onClick={() => isWorktree ? openDiffTab(file.path) : focusLine(file.path)}
            onContextMenu={(event) =>
              openExplorerContextMenu(event, {
                parentPath: getFolderPath(file.path) || null,
                targetPath: file.path,
                targetKind: "file"
              })
            }
          >
            <span className="tree-row__main">
              <span
                className={"file-icon " + fileIcon.iconClass}
                data-file-ext={getFileExtension(file)}
                data-file-kind={fileIcon.kind}
                aria-hidden
              />
              <span className="tree-row__label">{node.name}</span>
            </span>
            {file.badge ? <span className="tree-row__badge">{file.badge}</span> : null}
          </button>
        ];
      }

      const fileIcon = getFileIconSpec(file);
      const isContextTarget = explorerContextMenu?.targetKind === "file" && explorerContextMenu.targetPath === file.path;
      const isRenameTarget = explorerRenameDraft?.targetKind === "file" && explorerRenameDraft.targetPath === file.path;
      const isDirtyFile = unsavedPaths.includes(file.path);
      return [
        <button
          key={node.key}
          type="button"
          className={
            file.path === activePath
              ? "tree-row tree-row--file tree-row--active" + (isContextTarget ? " tree-row--context-target" : "")
              : "tree-row tree-row--file" + (isContextTarget ? " tree-row--context-target" : "")
          }
          style={{
            ["--tree-depth" as string]: depth,
            ["--tree-guide-left" as string]: treeGuideLeft,
            ["--tree-guide-bottom" as string]: treeGuideBottom,
            paddingLeft: `${9 + depth * 7}px`
          }}
          draggable
          onDragStart={(event) => handleExplorerFileDragStart(event, file.path)}
          onDragEnd={clearExplorerDragState}
          onClick={() => focusLine(file.path)}
          onContextMenu={(event) =>
            openExplorerContextMenu(event, {
              parentPath: getFolderPath(file.path) || null,
              targetPath: file.path,
              targetKind: "file"
            })
          }
        >
          <span className="tree-row__main">
            <span
              className={"file-icon " + fileIcon.iconClass}
              data-file-ext={getFileExtension(file)}
              data-file-kind={fileIcon.kind}
              aria-hidden
            />
            {isRenameTarget ? (
              <input
                autoFocus
                className="tree-create-row__input"
                value={explorerRenameDraft.value}
                onChange={(event) =>
                  setExplorerRenameDraft((state) => (state ? { ...state, value: event.target.value } : state))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitExplorerRename();
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelExplorerRename();
                  }
                }}
                onBlur={cancelExplorerRename}
                onClick={(event) => event.stopPropagation()}
              />
            ) : (
              <span className={isDirtyFile ? "tree-row__label tree-row__label--dirty" : "tree-row__label"}>{node.name}</span>
            )}
          </span>
          {isDirtyFile ? <span className="file-row__dot" /> : null}
        </button>
      ];
    });

  const renderSidebarBody = () => {
    if (sidebarView === "search") {
      return (
        <div className="sidebar-section">
          <div className="sidebar-summary">
            <strong>전역 검색</strong>
            <span>열린 워크스페이스 {files.length}개 파일 기준</span>
          </div>

          <label className="field">
            <span>검색</span>
            <input
              id="ide-search-query"
              name="searchQuery"
              className="input input--compact"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="파일명 또는 코드 검색"
            />
          </label>

          <div className="search-results">
            {searchQuery.trim() ? (
              searchMatches.length ? (
                searchMatches.map((match) => (
                  <button
                    key={match.key}
                    type="button"
                    className="search-result"
                    onClick={() => focusLine(match.path, match.lineNumber)}
                  >
                    <strong>{match.path.split("/").pop()}</strong>
                    <span>{match.path}</span>
                    <small>
                      {match.lineNumber}행 · {match.preview}
                    </small>
                  </button>
                ))
              ) : (
                <div className="empty-inline">검색 결과가 없습니다.</div>
              )
            ) : (
              <div className="empty-inline">검색어를 입력하면 파일과 코드 줄을 함께 찾습니다.</div>
            )}
          </div>
        </div>
      );
    }

    if (sidebarView === "trace") {
      return <TracePanel sessionId={sessionId} />;
    }

    if (sidebarView === "harness") {
      return <HarnessPanel />;
    }

    if (sidebarView === "extensions") {
      return (
        <div className="sidebar-section">
          <div className="sidebar-summary">
            <strong>확장 도구</strong>
            <span>실행 흐름에 필요한 확장을 모아 둔 패널입니다.</span>
          </div>

          <label className="field">
            <span>확장 검색</span>
            <input
              id="ide-extension-query"
              name="extensionQuery"
              className="input input--compact"
              value={extensionQuery}
              onChange={(event) => setExtensionQuery(event.target.value)}
              placeholder="도구 이름 또는 설명 검색"
            />
          </label>

          {extensionMatches.map((item) => (
            <div key={item.name} className="extension-card">
              <div className="extension-card__head">
                <strong>{item.name}</strong>
                <Badge tone={item.state === "추천" ? "amber" : "accent"}>{item.state}</Badge>
              </div>
              <p>{item.summary}</p>
            </div>
          ))}

          {!extensionMatches.length ? <div className="empty-inline">조건에 맞는 확장이 없습니다.</div> : null}
        </div>
      );
    }

    return (
      <div
        className="sidebar-section"
        onContextMenu={(event) =>
          openExplorerContextMenu(event, {
            parentPath: null,
            targetPath: null,
            targetKind: "root"
          })
        }
      >
        <div className="section-block">
          <div className="tree-root tree-root--flat">
            {explorerCreateDraft?.parentPath === null ? (
              <div className="tree-create-row tree-create-row--root" style={{ paddingLeft: "8px" }}>
                <span
                  className={
                    explorerCreateDraft.kind === "folder"
                      ? "tree-folder__icon codicon codicon-new-folder"
                      : "file-icon codicon codicon-new-file"
                  }
                  aria-hidden
                />
                <input
                  autoFocus
                  className="tree-create-row__input"
                  value={explorerCreateDraft.value}
                  placeholder={explorerCreateDraft.kind === "folder" ? "폴더 이름" : "파일 이름"}
                  onChange={(event) =>
                    setExplorerCreateDraft((state) => (state ? { ...state, value: event.target.value } : state))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitExplorerCreate();
                    }

                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelExplorerCreate();
                    }
                  }}
                  onBlur={cancelExplorerCreate}
                />
              </div>
            ) : null}
            {agentFileTree.length ? (
              <div className="agent-section">
                <button
                  type="button"
                  className="agent-section__header"
                  onClick={() => toggleExplorerSection("agent")}
                >
                  <span>{explorerSections.agent ? "v" : ">"} Agent 설정</span>
                </button>
                {explorerSections.agent ? (
                  <div className="agent-section__subtitle">agent · skills · instruction · harness</div>
                ) : null}
                {explorerSections.agent ? <div className="mt-1">{renderTreeNodes(agentFileTree, 0)}</div> : null}
              </div>
            ) : null}
            {workspaceFileTree.length ? (
              <div>
                <button
                  type="button"
                  className="w-full px-2 pb-1 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                  onClick={() => toggleExplorerSection("project")}
                >
                  {explorerSections.project ? "v" : ">"} Workspace
                </button>
                {explorerSections.project ? renderTreeNodes(workspaceFileTree, 0) : null}
              </div>
            ) : null}
          </div>
        </div>
        {explorerContextMenu ? (
          <div
            className="explorer-context-menu"
            style={{ left: explorerContextMenu.x, top: explorerContextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="explorer-context-menu__item"
              onClick={() => beginExplorerCreate("file", explorerContextMenu.parentPath)}
            >
              <span className="codicon codicon-new-file" aria-hidden />
              <span>새 파일</span>
            </button>
            <button
              type="button"
              className="explorer-context-menu__item"
              onClick={() => beginExplorerCreate("folder", explorerContextMenu.parentPath)}
            >
              <span className="codicon codicon-new-folder" aria-hidden />
              <span>새 폴더</span>
            </button>
            {explorerContextMenu.targetKind !== "root" ? (
              <button type="button" className="explorer-context-menu__item" onClick={beginExplorerRename}>
                <span className="codicon codicon-edit" aria-hidden />
                <span>이름 바꾸기</span>
              </button>
            ) : null}
            {explorerContextMenu.targetKind !== "root" ? (
              <button type="button" className="explorer-context-menu__item" onClick={handleExplorerDelete}>
                <span className="codicon codicon-trash" aria-hidden />
                <span>삭제</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const renderBottomPanel = () => {
    if (bottomPanelTab === "tests") {
      return (
        <div className="bottom-panel__body">
          <div className="bottom-summary">
            <strong>{testResult ? `${testResult.passed} / ${testResult.total} 통과` : "테스트 결과 없음"}</strong>
            <span>{testResult ? `${testResult.failed}개 실패` : "아직 테스트를 실행하지 않았습니다."}</span>
          </div>

          <div className="stack-12">
            {testResult
              ? testResult.results.map((result) => (
                  <div key={result.id} className="test-row">
                    <span>{result.name}</span>
                    <Badge tone={result.status === "PASS" ? "green" : "red"}>{result.status}</Badge>
                    <small>{result.time}</small>
                  </div>
                ))
              : null}
          </div>
        </div>
      );
    }

    if (bottomPanelTab === "trace") {
      return (
        <div className="bottom-panel__body">
          {traces.length ? (
            <div className="trace-list">
              {traces.map((trace: TraceEvent) => (
                <div key={trace.id} className="trace-row">
                  <span className="trace-row__time">{trace.time}</span>
                  <div className="trace-row__body">
                    <strong>{trace.type}</strong>
                    <span>{trace.summary}</span>
                    <small>{trace.detail ?? "상세 정보 없음"}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-inline">아직 기록된 Trace가 없습니다.</div>
          )}
        </div>
      );
    }

    return (
      <div className="bottom-panel__body">
        <div className="output-grid">
          <Card className="mini-panel mini-panel--flat">
            <strong>stdout</strong>
            <pre>{runResult?.stdout ?? "아직 실행한 결과가 없습니다."}</pre>
          </Card>

          <Card className="mini-panel mini-panel--flat">
            <strong>stderr</strong>
            <pre>{runResult?.stderr || "에러 출력 없음"}</pre>
          </Card>
        </div>

        <div className="bottom-summary">
          <strong>{runResult ? `exit code ${runResult.exitCode}` : "실행 대기"}</strong>
          <span>{runResult ? `${runResult.durationMs}ms` : "실행 버튼으로 결과를 확인하세요."}</span>
        </div>
      </div>
    );
  };

  const renderProblemWorkspace = () => {
    if (!problem) {
      return <div className="problem-workspace problem-workspace--empty">문제 정보를 불러오지 못했습니다.</div>;
    }

    return (
      <div className="problem-workspace">
        <aside className="problem-workspace__rail">
          <div className="problem-card problem-card--primary">
            <h2>{problem.title}</h2>
            <p className="muted-copy">{problem.summary}</p>

            <div className="problem-card__pills">
              <span className="problem-pill">Lv.{problem.level}</span>
              <span className="problem-pill">{problem.category}</span>
              <span className="problem-pill">{problem.estimate}</span>
              <span className="problem-pill">{problem.status}</span>
              <span className="problem-pill">{lastSavedLabel}</span>
            </div>

            <div className="problem-card__actions">
              <button
                type="button"
                className="ide-command-button ide-command-button--danger"
                onClick={handleEndSession}
                disabled={endSessionLoading}
                aria-label="종료"
                title="종료"
              >
                <LogOut size={13} strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="problem-card">
            <strong>문제 체크포인트</strong>
            <ul className="problem-list">
              <li>요구사항 {problemRequirementsCount}개</li>
              <li>공개 테스트 {problemCasesCount}개</li>
              <li>엔드포인트 {problemEndpointCount}개</li>
              <li>현재 세션 AI quota {aiQuotaLabel}</li>
            </ul>
          </div>
        </aside>

        <div className="problem-workspace__main">
          <section className="problem-card problem-card--feature">
            <div className="markdown-block problem-workspace__markdown">
              {parsedProblemBrief.beforeDescription ? (
                <Markdown remarkPlugins={[remarkGfm]} components={problemBriefMarkdownComponents}>{parsedProblemBrief.beforeDescription}</Markdown>
              ) : (
                <p className="muted-copy">문제 설명이 아직 등록되지 않았습니다.</p>
              )}
            </div>
            {resolvedProblemEndpoints.length ? (
              <div className="problem-brief-codeblock problem-brief-codeblock--endpoints">
                <div className="problem-brief-codeblock__body">
                  <div className="problem-brief-codeblock__lines">
                    {resolvedProblemEndpoints.map((_, index) => (
                      <div key={index} className="problem-brief-codeblock__line">
                        {index + 1}
                      </div>
                    ))}
                  </div>
                  <pre className="problem-brief-codeblock__content">
                    {resolvedProblemEndpoints.map((endpoint) => (
                      <div key={endpoint}>{renderHighlightedEndpoint(endpoint)}</div>
                    ))}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="muted-copy">엔드포인트 정보가 아직 등록되지 않았습니다.</p>
            )}
            {parsedProblemBrief.afterDescription ? (
              <div className="markdown-block problem-workspace__markdown">
                <Markdown remarkPlugins={[remarkGfm]} components={problemBriefMarkdownComponents}>{parsedProblemBrief.afterDescription}</Markdown>
              </div>
            ) : null}
          </section>

          {resolvedProblemRequirements.length ? (
            <section className="problem-card problem-card--feature">
              <strong>핵심 요구사항</strong>
              <ul className="problem-list">
                {resolvedProblemRequirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="problem-workspace__aside">
          {resolvedProblemCases.length ? (
            <section className="problem-card">
              <strong>공개 테스트</strong>
              <div className="problem-cases">
                {resolvedProblemCases.map((testCase) => (
                  <div key={testCase.id} className="problem-case">
                    <div className="problem-case__head">
                      <span>{testCase.name}</span>
                      <Badge tone="teal">{testCase.result}</Badge>
                    </div>
                    <small>{testCase.detail}</small>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {resolvedProblemCriteria.length ? (
            <section className="problem-card">
              <strong>평가 기준</strong>
              <ul className="problem-list">
                {resolvedProblemCriteria.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {problem.aiGuide ? (
            <section className="problem-card">
              <strong>AI 활용 팁</strong>
              <p className="muted-copy">{problem.aiGuide}</p>
            </section>
          ) : null}
        </aside>
      </div>
    );
  };

  const renderEditorTabs = () => (
    <div className="editor-tabbar">
      <div className="editor-tabbar__row editor-tabbar__row--tabs">
        <div className="editor-tabs" onWheel={handleTabRailWheel}>
          {openTabs.map((tab) => (
            <div
              key={tab.id}
              className={
                [
                  "editor-tabs__item",
                  activeWorkbenchTab === "code" && tab.id === activeTab?.id ? "editor-tabs__item--active" : "",
                  draggedTabId === tab.id ? "editor-tabs__item--dragging" : "",
                  tabDropHint?.targetId === tab.id
                    ? tabDropHint.position === "before"
                      ? "editor-tabs__item--drop-before"
                      : "editor-tabs__item--drop-after"
                    : ""
                ]
                  .filter(Boolean)
                  .join(" ")
              }
              draggable
              onDragStart={(event) => handleTabDragStart(event, tab.id)}
              onDragOver={(event) => handleTabDragOver(event, tab.id)}
              onDrop={(event) => handleTabDrop(event, tab.id)}
              onDragEnd={handleTabDragEnd}
            >
              <button
                type="button"
                className="editor-tabs__select"
                onClick={() => {
                  if (tab.kind === "diff") {
                    openDiffTab(tab.targetFile.path);
                    return;
                  }

                  focusLine(tab.path);
                }}
              >
                {tab.kind === "diff" ? (
                  <span className="file-icon file-icon--tab codicon codicon-diff" data-file-kind="git" aria-hidden />
                ) : (
                  <span
                    className={"file-icon file-icon--tab " + getFileIconSpec(tab.file).iconClass}
                    data-file-kind={getFileIconSpec(tab.file).kind}
                    aria-hidden
                  />
                )}
                <span>{tab.title}</span>
                {tab.kind === "file" && unsavedPaths.includes(tab.path) ? <span className="editor-tabs__dot" /> : null}
              </button>
              <button
                type="button"
                className="editor-tabs__close"
                aria-label={`${tab.title} 닫기`}
                onClick={() => handleCloseFileTab(tab.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {canPreviewActiveMarkdown ? (
          <div className="editor-tabs__tools">
            <button
              type="button"
              className={markdownPreviewOpen ? "editor-tabs__mode-button editor-tabs__mode-button--active" : "editor-tabs__mode-button"}
              onClick={() => setMarkdownPreviewOpen((state) => !state)}
              aria-pressed={markdownPreviewOpen}
              aria-label={markdownPreviewOpen ? "Markdown 편집" : "Markdown 미리보기"}
              title={markdownPreviewOpen ? "Markdown 편집" : "Markdown 미리보기"}
            >
              {markdownPreviewOpen ? <PencilLine size={14} strokeWidth={2} /> : <Eye size={14} strokeWidth={2} />}
              <span>{markdownPreviewOpen ? "편집" : "미리보기"}</span>
            </button>
          </div>
        ) : null}
      </div>

      <div className="editor-tabbar__row editor-tabbar__row--meta">
        <div className="editor-tabbar__context">
          {estimateLimitMs > 0 ? (
            <div className={`solve-timer-bar solve-timer-bar--${timerPhase}`}>
              <div className="solve-timer-bar__track">
                <div
                  className="solve-timer-bar__fill"
                  style={{ width: isOvertime ? "100%" : `${timerProgress * 100}%` }}
                />
              </div>
              <span className="solve-timer-bar__label">
                {isOvertime ? `+${formatSolveElapsed(overtimeMs)}` : solveElapsedLabel}
              </span>
              <span className="solve-timer-bar__limit">{problem?.estimate}</span>
            </div>
          ) : (
            <span className="editor-tabbar__metric editor-tabbar__metric--time">풀이 {solveElapsedLabel}</span>
          )}
          <span className="editor-tabbar__meta">{lastSavedLabel}</span>
        </div>

        <div className="editor-tabbar__actions">
          {session?.aiModel && session.aiModel !== "aig-default" && (
            <span className="ide-model-badge">{session.aiModel}</span>
          )}

          <div className="ide-toolbar">
            <button
              type="button"
              className={autoSaveEnabled ? "ide-toolbar__btn ide-toolbar__btn--active" : "ide-toolbar__btn"}
              onClick={() => setAutoSaveEnabled((state) => !state)}
              aria-pressed={autoSaveEnabled}
              title={autoSaveEnabled ? "자동 저장 끄기" : "자동 저장 켜기"}
            >
              Auto
            </button>
            <button
              type="button"
              className="ide-toolbar__btn"
              onClick={() => void saveAllDirtyFiles()}
              disabled={!dirtyCount || saving}
              aria-label="모두 저장"
              title="모두 저장"
            >
              <Save size={13} strokeWidth={2} />
            </button>

            <span className="ide-toolbar__sep" />

            <button
              type="button"
              className="ide-toolbar__btn"
              onClick={handleRun}
              disabled={runLoading}
              aria-label="실행"
              title="실행"
            >
              <Play size={13} strokeWidth={2} />
            </button>
            <button type="button" className="ide-toolbar__btn" onClick={handleTest} disabled={testLoading}>
              {testLoading ? "..." : "테스트"}
            </button>

            <span className="ide-toolbar__sep" />

            <button
              type="button"
              className="ide-toolbar__btn ide-toolbar__btn--submit"
              onClick={handleSubmit}
              disabled={submitLoading}
            >
              {submitLoading ? "제출 중..." : "제출"}
            </button>

            <span className="ide-toolbar__sep" />

            <button
              type="button"
              className="ide-toolbar__btn ide-toolbar__btn--exit"
              onClick={handleEndSession}
              disabled={endSessionLoading}
              aria-label="종료"
              title="종료"
            >
              <LogOut size={13} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (isLoading || !session || !activeFile) {
    return (
      <div className="center-shell">
        <div className="loader-card">
          <span className="eyebrow">워크스페이스</span>
          <strong>IDE를 준비하고 있습니다.</strong>
        </div>
      </div>
    );
  }

  return (
    <div
      className={"ide-route ide-route--workspace" + (isV0 ? " ide-route--v0" : "")}
      data-v0-ide={isV0 ? themeTone : undefined}
      onContextMenu={handleIdeContextMenu}
    >
      <section className="ide-shell ide-shell--workbench">
        <aside className="activity-bar">
          <div className="activity-bar__group">
            <button
              type="button"
              className={activeWorkbenchTab === "problem" ? "activity-bar__item activity-bar__item--active" : "activity-bar__item"}
              title="문제"
              onClick={handleOpenProblemTab}
            >
              <span className="activity-bar__label activity-bar__icon-wrap">
                <span className="codicon codicon-book activity-bar__icon" aria-hidden="true" />
              </span>
              <span className="activity-bar__badge">{problemRequirementsCount}</span>
            </button>

            {activityItems.filter((item) => item.id !== "extensions").map((item) =>
              item.id === "trace" ? (
                <button
                  key={item.id}
                  type="button"
                  className={
                    activeWorkbenchTab === "trace"
                      ? "activity-bar__item activity-bar__item--active"
                      : "activity-bar__item"
                  }
                  title={item.label}
                  onClick={() => setActiveWorkbenchTab("trace")}
                >
                  <span className="activity-bar__label activity-bar__icon-wrap">
                    <span className={`codicon ${item.icon} activity-bar__icon`} aria-hidden="true" />
                  </span>
                  {activityMeta[item.id] ? <span className="activity-bar__badge">{activityMeta[item.id]}</span> : null}
                </button>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  className={
                    activeWorkbenchTab === "code" && sidebarOpen && sidebarView === item.id
                      ? "activity-bar__item activity-bar__item--active"
                      : "activity-bar__item"
                  }
                  title={item.label}
                  onClick={() => handleActivityClick(item.id)}
                >
                  <span className="activity-bar__label activity-bar__icon-wrap">
                    <span className={`codicon ${item.icon} activity-bar__icon`} aria-hidden="true" />
                  </span>
                  {activityMeta[item.id] ? <span className="activity-bar__badge">{activityMeta[item.id]}</span> : null}
                </button>
              )
            )}

            <button
              type="button"
              className={activeWorkbenchTab === "code" && showBottomPanel ? "activity-bar__item activity-bar__item--active" : "activity-bar__item"}
              title="콘솔"
              onClick={handleToggleBottomPanel}
            >
              <span className="activity-bar__label activity-bar__icon-wrap">
                <span className="codicon codicon-terminal activity-bar__icon" aria-hidden="true" />
              </span>
              {activityMeta.output ? <span className="activity-bar__badge">{activityMeta.output}</span> : null}
            </button>

            <button
              type="button"
              className={activeWorkbenchTab === "code" && aiOpen ? "activity-bar__item activity-bar__item--active" : "activity-bar__item"}
              title="AI 보조 패널"
              onClick={handleToggleAiPanel}
            >
              <span className="activity-bar__label activity-bar__icon-wrap">
                <span className="codicon codicon-hubot activity-bar__icon" aria-hidden="true" />
              </span>
              {activityMeta.ai ? <span className="activity-bar__badge">{activityMeta.ai}</span> : null}
            </button>
          </div>
          <div className="activity-bar__group" style={{ marginTop: "auto" }}>
            <button
              type="button"
              className="activity-bar__item"
              title={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun size={14} strokeWidth={1.8} /> : <Moon size={14} strokeWidth={1.8} />}
              <span className="sr-only">{theme === "dark" ? "라이트 모드" : "다크 모드"}</span>
            </button>
          </div>
        </aside>

        {activeWorkbenchTab === "trace" ? (
          <div className="ide-shell__trace-wb">
            <TraceWorkbench sessionId={sessionId} onClose={() => setActiveWorkbenchTab("code")} />
          </div>
        ) : activeWorkbenchTab === "problem" ? (
          <div className="ide-shell__problem">
            <div className="problem-stage">{renderProblemWorkspace()}</div>
            <div className="status-bar">
              <div className="status-bar__group">
                <span>problem</span>
                <span>Lv.{problem?.level ?? 1}</span>
                <span>{problem?.category ?? "문제"}</span>
                <span>공개케이스 {problemCasesCount}개</span>
              </div>
              <div className="status-bar__group">
                <span>{problem?.estimate ?? "예상 시간 없음"}</span>
                <span>AI quota {aiQuotaLabel}</span>
                <span>{dirtyCount ? `미저장 ${dirtyCount}개` : "저장됨"}</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {sidebarOpen ? (
              <>
                <aside className="ide-shell__sidebar" style={{ width: effectiveSidebarWidth }}>
                  <div className="sidebar-header">
                    <div>
                      <span className="panel-title panel-title--compact">{sidebarView}</span>
                      <strong>{activityItems.find((item) => item.id === sidebarView)?.label ?? "탐색기"}</strong>
                    </div>
                  </div>

                  {renderSidebarBody()}
                </aside>

                <div
                  className="pane-resizer pane-resizer--vertical"
                  onMouseDown={beginResize("sidebar")}
                  aria-hidden="true"
                />
              </>
            ) : (
              <div
                className="pane-resizer pane-resizer--vertical pane-resizer--collapsed pane-resizer--sidebar-collapsed"
                onMouseDown={beginResize("sidebar")}
                aria-hidden="true"
              />
            )}

            <div className="ide-shell__main">
              {renderEditorTabs()}

              <div className="editor-stage">
                {showEmptyEditor ? (
                  <div className="editor-empty-state">
                    <strong>열린 탭이 없습니다.</strong>
                    <span>왼쪽 탐색기에서 파일을 열거나, 문제 아이콘으로 문제 화면을 확인하세요.</span>
                  </div>
                ) : (
                  <div
                    ref={editorHostRef}
                    className={markdownPreviewOpen && canPreviewActiveMarkdown ? "editor-host editor-host--preview" : "editor-host"}
                  >
                    {markdownPreviewOpen && canPreviewActiveMarkdown ? (
                      <div className="markdown-preview">
                        <Markdown remarkPlugins={[remarkGfm]} components={problemBriefMarkdownComponents}>
                          {activeFile.content || "_미리볼 Markdown 내용이 없습니다._"}
                        </Markdown>
                      </div>
                    ) : activeTab?.kind === "diff" ? (
                      <MonacoDiffEditor
                        key={activeTab.id}
                        theme={theme === "dark" ? "vs-dark" : "vs"}
                        height="100%"
                        original={activeTab.sourceFile.content}
                        modified={activeTab.targetFile.content}
                        language={activeTab.sourceFile.language}
                        onMount={handleDiffMount}
                        options={{
                          readOnly: true,
                          renderSideBySide: viewportSize.width > 1480,
                          originalEditable: false,
                          fontSize: 13,
                          scrollBeyondLastLine: false,
                          fontFamily: "var(--font-mono)",
                          lineHeight: 22,
                          automaticLayout: true,
                          smoothScrolling: true,
                          stickyScroll: { enabled: false },
                          overviewRulerBorder: false,
                          minimap: { enabled: false }
                        }}
                      />
                    ) : (
                      <MonacoEditor
                        path={activeFile.path}
                        theme={theme === "dark" ? "vs-dark" : "vs"}
                        height="100%"
                        language={activeFile.language}
                        value={activeFile.content}
                        onMount={handleMount}
                        onChange={(value) => {
                          const nextContent = value ?? "";
                          if (nextContent !== activeFile.content) {
                            updateFileContent(activeFile.path, nextContent);
                          }
                        }}
                        options={{
                          minimap: { enabled: true, scale: 0.9, showSlider: "mouseover" },
                          fontSize: 13,
                          scrollBeyondLastLine: false,
                          fontFamily: "var(--font-mono)",
                          lineHeight: 22,
                          automaticLayout: false,
                          smoothScrolling: true,
                          padding: { top: 14 },
                          stickyScroll: { enabled: false },
                          overviewRulerBorder: false
                        }}
                      />
                    )}
                  </div>
                )}

                {showBottomPanel ? (
                  <>
                    <div
                      className="pane-resizer pane-resizer--horizontal"
                      onMouseDown={beginResize("bottom")}
                      aria-hidden="true"
                    />
                    <section className="bottom-panel" style={{ height: effectiveBottomPanelHeight }}>
                      <div className="bottom-panel__tabs">
                        <div className="bottom-panel__tab-list">
                          {bottomTabs.map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              className={
                                bottomPanelTab === tab.id
                                  ? "bottom-panel__tab bottom-panel__tab--active"
                                  : "bottom-panel__tab"
                              }
                              onClick={() => setBottomPanelTab(tab.id)}
                            >
                              {tab.label}
                              <small>{bottomTabMeta[tab.id]}</small>
                            </button>
                          ))}
                        </div>
                      </div>

                      {renderBottomPanel()}
                    </section>
                  </>
                ) : (
                  <div
                    className="pane-resizer pane-resizer--horizontal pane-resizer--collapsed pane-resizer--bottom-collapsed"
                    onMouseDown={beginResize("bottom")}
                    aria-hidden="true"
                  />
                )}
              </div>

              <div className="status-bar">
                <div className="status-bar__group">
                  <span>main</span>
                  <span>{activeFile.language.toUpperCase()}</span>
                  <span>UTF-8</span>
                  <span>LF</span>
                  <span>{lineCount} lines</span>
                </div>

                <div className="status-bar__group">
                  <span>{dirtyCount ? `미저장 ${dirtyCount}개` : "저장됨"}</span>
                  <span>{selectionLabel}</span>
                  <span>{aiMode === "chat" ? "AIG Chat" : "AIG Edit"}</span>
                  <span>{activeTab?.kind === "diff" ? "DIFF" : bottomPanelTab.toUpperCase()}</span>
                </div>
              </div>
            </div>

            {aiOpen ? (
              <>
                <div
                  className="pane-resizer pane-resizer--vertical"
                  onMouseDown={beginResize("ai")}
                  aria-hidden="true"
                />

                <aside className="ide-shell__ai" style={{ width: effectiveAiPanelWidth }}>
                  <div className="sidebar-header">
                    <div>
                      <span className="panel-title panel-title--compact">aig assistant</span>
                      <div className="assistant-header__title">
                        <strong>AI 보조 패널</strong>
                        <span className="ai-context-chip assistant-version-chip">{agentSnapshotLabel}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="button button--primary button--tiny assistant-build-button"
                      onClick={handleAgentBuild}
                    >
                      Agent Build
                    </button>
                  </div>

                  {aiMode === "chat" ? (
                    <div className="ai-panel ai-panel--chat">
                      <div className="ai-panel__head">
                        <div className="ai-tabs">
                          <button
                            type="button"
                            className="chip chip--active"
                            onClick={() => {
                              setAiMode("chat");
                              setSuggestion(null);
                            }}
                          >
                            chat mode
                          </button>
                          <button
                            type="button"
                            className="chip"
                            onClick={() => setAiMode("edit")}
                          >
                            agent mode
                          </button>
                        </div>

                        <div className="ai-context-strip">
                          <span className="ai-context-chip">{getFileName(activeFile.path)}</span>
                          <span className="ai-context-chip">{selectedRange ? selectionSummary : "선택 없음"}</span>
                          <span className="ai-context-chip">AI quota {aiQuotaLabel}</span>
                        </div>
                      </div>

                      <div ref={chatScrollRef} className="chat-stack chat-stack--panel">
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            className={message.role === "user" ? "chat-bubble chat-bubble--user" : "chat-bubble"}
                          >
                            {message.content}
                          </div>
                        ))}
                        {streaming ? <div className="chat-status">AI 응답 생성 중...</div> : null}
                      </div>

                      <div className="chat-input-row">
                        <textarea
                          id="ide-chat-input"
                          name="chatPrompt"
                          className="input input--textarea"
                          value={chatInput}
                          onChange={(event) => setChatInput(event.target.value)}
                          placeholder="현재 문제나 코드에 대해 질문하세요"
                        />
                        <button className="button button--primary" onClick={handleSend}>
                          전송
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="ai-panel ai-panel--edit">
                      <div className="ai-panel__head">
                        <div className="ai-tabs">
                          <button
                            type="button"
                            className="chip"
                            onClick={() => {
                              setAiMode("chat");
                              setSuggestion(null);
                            }}
                          >
                            chat mode
                          </button>
                          <button
                            type="button"
                            className="chip chip--active"
                            onClick={() => setAiMode("edit")}
                          >
                            agent mode
                          </button>
                        </div>

                        <div className="ai-context-strip">
                          <span className="ai-context-chip">{getFolderPath(activeFile.path) || "workspace"}</span>
                          <span className="ai-context-chip">{selectionLabel}</span>
                          <span className="ai-context-chip">AI quota {aiQuotaLabel}</span>
                        </div>
                      </div>

                      {agentPatchPreviews.length ? (
                        <Card className="mini-panel mini-panel--flat assistant-changes-card">
                          <div className="assistant-changes__head">
                            <div>
                              <strong>변경 파일</strong>
                              <p className="muted-copy">
                                Agent가 {agentPatchPreviews.length}개 파일 변경 제안을 준비했어요.
                              </p>
                            </div>
                            <span className="ai-context-chip">{agentPatchPreviews.length} files</span>
                          </div>
                          {latestAgentPatchSummary ? (
                            <p className="muted-copy assistant-changes__summary">{latestAgentPatchSummary}</p>
                          ) : null}
                          <div className="assistant-changes__list">
                            {agentPatchPreviews.map((preview) => (
                              <button
                                key={preview.patchId}
                                type="button"
                                className="assistant-change-row"
                                onClick={() => openDiffTab(preview.worktreePath)}
                              >
                                <span className="assistant-change-row__main">
                                  <strong>{getFileName(preview.filePath)}</strong>
                                  <small>{preview.filePath}</small>
                                </span>
                                <span className="assistant-change-row__stats">
                                  <span className="assistant-change-row__add">+{preview.additions}</span>
                                  <span className="assistant-change-row__del">-{preview.deletions}</span>
                                </span>
                              </button>
                            ))}
                          </div>
                        </Card>
                      ) : null}

                      <Card className="mini-panel mini-panel--flat">
                        <strong>선택 코드</strong>
                        <pre>{selectedCode || "에디터에서 코드를 선택하면 AI 수정 모드가 활성화됩니다."}</pre>
                      </Card>

                      <label className="field">
                        <span>수정 지시</span>
                        <textarea
                          id="ide-edit-instruction"
                          name="editInstruction"
                          className="input input--textarea"
                          value={editInstruction}
                          onChange={(event) => setEditInstruction(event.target.value)}
                        />
                      </label>

                      <button className="button" onClick={handleRequestEdit} disabled={editLoading}>
                        {editLoading ? "생성 중..." : "AI 수정 제안 받기"}
                      </button>

                      {suggestion ? (
                        <Card className="mini-panel mini-panel--flat">
                          <strong>AI 제안</strong>
                          <div className="diff-block">
                            <span className="diff-block__remove">- {suggestion.original}</span>
                            <span className="diff-block__add">+ {suggestion.replacement}</span>
                          </div>
                          <p className="muted-copy">{suggestion.summary}</p>
                          <div className="hero-actions">
                            <button className="button" onClick={() => setSuggestion(null)}>
                              닫기
                            </button>
                            <button className="button button--primary" onClick={handleApplyEdit}>
                              반영
                            </button>
                          </div>
                        </Card>
                      ) : null}
                    </div>
                  )}
                </aside>
              </>
            ) : (
              <div
                className="pane-resizer pane-resizer--vertical pane-resizer--collapsed pane-resizer--ai-collapsed"
                onMouseDown={beginResize("ai")}
                aria-hidden="true"
              />
            )}
          </>
        )}
      </section>
      {savePromptOpen && savePromptAction ? (
        <div className="ide-save-modal-backdrop" role="presentation" onClick={handleSavePromptCancel}>
          <div
            className="ide-save-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ide-save-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ide-save-modal__head">
              <strong id="ide-save-modal-title">{savePromptTitle}</strong>
              <span>{savePromptDescription}</span>
            </div>
            <div className="ide-save-modal__actions">
              <button type="button" className="button" onClick={handleSavePromptCancel} disabled={saving}>
                취소
              </button>
              <button type="button" className="button" onClick={() => void handleSavePromptDiscard()} disabled={saving}>
                저장 안 함
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={() => void handleSavePromptSave()}
                disabled={saving}
              >
                {saving
                  ? "저장 중..."
                  : savePromptAction.type === "run"
                    ? "저장 후 실행"
                    : savePromptAction.type === "navigate"
                      ? "저장 후 이동"
                      : savePromptAction.type === "end-session"
                        ? "저장 후 종료"
                      : "저장"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
