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

  async getFile(userHarnessFileId: number): Promise<UserHarnessFile> {
    const res = await authClient.get(`api/v1/user-harness/${userHarnessFileId}`)
      .json<ApiResponse<UserHarnessFile>>();
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
