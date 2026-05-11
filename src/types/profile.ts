// src/types/profile.ts
export type Role = "usuario" | "admin";

export type Profile = {
  id: string;
  role: Role;
  display_name: string;
  avatar_url: string | null;
  whatsapp: string | null;
  paid: boolean;
  created_at: string;
  updated_at: string;
};
