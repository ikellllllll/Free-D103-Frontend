export interface AuthUser {
  id: string;
  name: string;
  email: string;
  provider: "LOCAL" | "GITHUB";
  createdAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SignupInput extends LoginInput {
  name: string;
}
