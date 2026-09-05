import { useCallback } from "react";
import { API_BASE_URL } from "../config/api";

/** Matches db/roleRepo.php's listRoles()/createRole()/getRoleById(). */
export interface Role {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
}

/** Matches db/permissionRepo.php's listPermissions(). */
export interface Permission {
  id: number;
  key: string;
  label: string;
  description: string | null;
}

/** Matches db/userRepo.php's listUsers(). */
export interface AdminUser {
  id: number;
  name: string;
  email: string;
  status: string;
  emailVerified: boolean;
  role: { id: number; name: string };
  lastLoginAt: string | null;
  createdAt: string;
}

export class AdminApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "AdminApiError";
  }
}

/**
 * /admin/* client. Every mutating call here requires both an authenticated
 * session (requirePermission('manage_roles'|'manage_users') server-side)
 * and the X-CSRF-Token header (requireCsrf()) — see auth/Guard.php. Reads
 * (GET) only require the permission, no CSRF token, matching the backend.
 *
 * Takes csrfToken from the caller (useAuth()'s own state) rather than
 * managing its own — there is exactly one session/CSRF source of truth
 * per docs/DEV_STATUS.md's account-model constraint, and this hook is not
 * it.
 */
export function useAdminApi(csrfToken: string | null) {
  const request = useCallback(
    async <T>(path: string, init?: RequestInit): Promise<T> => {
      let res: Response;
      try {
        res = await fetch(`${API_BASE_URL}${path}`, {
          ...init,
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
            ...(init?.headers ?? {}),
          },
        });
      } catch (e: any) {
        throw new AdminApiError(0, `Impossible de joindre le serveur. (${e?.message ?? "network error"})`);
      }
      const text = await res.text();
      const body = text ? JSON.parse(text) : undefined;
      if (!res.ok) {
        throw new AdminApiError(res.status, body?.error ?? `La requête a échoué (${res.status}).`);
      }
      return body as T;
    },
    [csrfToken]
  );

  return {
    listRoles: () => request<Role[]>("/admin/roles"),
    createRole: (name: string, description: string | null, permissions: string[]) =>
      request<Role>("/admin/roles", { method: "POST", body: JSON.stringify({ name, description, permissions }) }),
    updateRole: (id: number, name: string, description: string | null, permissions: string[]) =>
      request<Role>(`/admin/roles/${id}`, { method: "PUT", body: JSON.stringify({ name, description, permissions }) }),
    deleteRole: (id: number) => request<{ deleted: number }>(`/admin/roles/${id}`, { method: "DELETE" }),

    listPermissions: () => request<Permission[]>("/admin/permissions"),
    createPermission: (key: string, label: string, description: string | null) =>
      request<Permission>("/admin/permissions", { method: "POST", body: JSON.stringify({ key, label, description }) }),
    updatePermission: (id: number, label: string, description: string | null) =>
      request<Permission>(`/admin/permissions/${id}`, { method: "PUT", body: JSON.stringify({ label, description }) }),
    deletePermission: (id: number) => request<{ deleted: number }>(`/admin/permissions/${id}`, { method: "DELETE" }),

    listUsers: () => request<AdminUser[]>("/admin/users"),
    updateUser: (id: number, fields: { roleId?: number; status?: string }) =>
      request<AdminUser>(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify(fields) }),
  };
}
