export type RoleName = "child" | "parent" | "teacher" | "admin";

export interface CurrentUser {
  id: string;
  email: string;
  is_active: boolean;
  roles: RoleName[];
  created_at: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}
