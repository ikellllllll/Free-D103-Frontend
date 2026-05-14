import { authClient } from "@/lib/api/authApi";

interface ApiResponse<T> {
  httpStatusCode: number;
  responseMessage: string;
  data: T;
  errorMessage?: string;
}

export type UserHarnessNodeType = "FILE" | "DIRECTORY";
export type UserHarnessFileType = "MARKDOWN" | "TOML" | "YAML";

export interface UserHarnessTreeItem {
  userHarnessFileId: number;
  path: string;
  name: string;
  nodeType: UserHarnessNodeType;
  fileType: UserHarnessFileType | null;
}

/** 단건 GET /user-harness/{id} 응답 — 백엔드 GetUserHarnessFileResponse 가 nodeType 을 안 줌.
 * 트리 응답에서 받아온 UserHarnessTreeItem 의 nodeType 을 사용해야 하기 때문에 단건 응답은
 * nodeType 을 optional 로 둔다 (현재는 트리 응답 + activeFile 매핑 방식이라 단건만 단독 사용
 * 안 함. 단독 사용 케이스가 추가되면 백엔드에 nodeType 추가 요청 필요). */
export interface UserHarnessFileDetail {
  userHarnessFileId: number;
  path: string;
  name: string;
  nodeType?: UserHarnessNodeType;
  fileType: UserHarnessFileType | null;
  content: string;
  sizeBytes?: number;
  updatedAt?: string;
}

/** POST 응답 (createFile) 은 nodeType 을 포함해서 트리 응답과 동일. 트리 캐시에 그대로 push 가능. */
export interface UserHarnessFile extends UserHarnessTreeItem {
  content: string;
  sizeBytes?: number;
  updatedAt?: string;
}

export interface CreateUserHarnessFileRequest {
  path: string;
  name: string;
  nodeType: UserHarnessNodeType;
  fileType?: UserHarnessFileType | null;
  content?: string | null;
}

export const userHarnessApi = {
  async getTree(): Promise<UserHarnessTreeItem[]> {
    const res = await authClient.get("api/v1/user-harness")
      .json<ApiResponse<UserHarnessTreeItem[]>>();
    return res.data ?? [];
  },

  async createFile(input: CreateUserHarnessFileRequest): Promise<UserHarnessFile> {
    const res = await authClient.post("api/v1/user-harness", { json: input })
      .json<ApiResponse<UserHarnessFile>>();
    return res.data;
  },

  async getFile(userHarnessFileId: number): Promise<UserHarnessFileDetail> {
    const res = await authClient.get(`api/v1/user-harness/${userHarnessFileId}`)
      .json<ApiResponse<UserHarnessFileDetail>>();
    return res.data;
  },

  async saveFile(userHarnessFileId: number, content: string): Promise<{ fileId: number; path: string; updatedAt: string }> {
    const res = await authClient.patch(`api/v1/user-harness/${userHarnessFileId}/content`, {
      json: { content }
    }).json<ApiResponse<{ fileId: number; path: string; updatedAt: string }>>();
    return res.data;
  },

  async moveFile(userHarnessFileId: number, toPath: string): Promise<{ toPath: string; updatedAt: string }> {
    const res = await authClient.patch(`api/v1/user-harness/${userHarnessFileId}/path`, {
      json: { toPath }
    }).json<ApiResponse<{ toPath: string; updatedAt: string }>>();
    return res.data;
  },

  async deleteFile(userHarnessFileId: number): Promise<void> {
    await authClient.delete(`api/v1/user-harness/${userHarnessFileId}`);
  }
};
