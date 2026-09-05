import { API_BASE_URL } from "../config/api";
import {
  CalculationCaseInput,
  SitePersonnelInput,
  ParameterSet,
  NaceRiskEntry,
  Client,
  CaseSummary,
} from "../types/engine";

export interface NaeApiResult {
  siteId: string;
  crossCheckOk: boolean;
  crossCheckMessage?: string;
  shiftLines: { label: string; headcount: number; pctRepetitiveOrSimilar: number; nae: number; explanation: string }[];
  nonShiftLine: { label: string; headcount: number; pctRepetitiveOrSimilar: number; nae: number; explanation: string };
  indirectLine: { label: string; headcount: number; pctRepetitiveOrSimilar: number; nae: number; explanation: string };
  directShiftAdjusted: number;
  directNonShift: number;
  indirectAdjusted: number;
  totalNae: number;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      // credentials: 'include' is required now that /clients and /cases
      // are gated behind requireAuth() (see docs/BUGLOG.md BUG-046): the
      // browser's default 'same-origin' fetch policy silently drops the
      // session cookie on any cross-origin call (e.g. the Expo dev server
      // talking to the PHP dev server on a different port), which reads
      // as an unauthenticated 401 with no indication the cookie was ever
      // the problem. useAuth.ts's own fetch calls already did this
      // correctly for the exact same reason — this brings the shared
      // client in line with that precedent instead of leaving a second,
      // inconsistent copy of the same fix.
      credentials: "include",
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (e: any) {
    throw new ApiError(0, `Could not reach the API at ${API_BASE_URL}. Is it running and reachable from this device? (${e.message})`);
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `Request failed with status ${res.status}`);
  }
  return body as T;
}

export const api = {
  health: () =>
    request<{ status: string; parameterSetId: string; version: number; dbConnected: boolean; dbBackedParameters: boolean }>(
      "/health"
    ),

  getParameters: () => request<ParameterSet>("/parameters"),

  searchNace: (query: string) => request<NaceRiskEntry[]>(`/nace/search?q=${encodeURIComponent(query)}`),

  getNaceEntry: (code: string) => request<NaceRiskEntry>(`/nace/${encodeURIComponent(code)}`),

  calculateNae: (input: SitePersonnelInput) =>
    request<NaeApiResult>("/nae", { method: "POST", body: JSON.stringify(input) }),

  calculateCase: (input: CalculationCaseInput) =>
    request<any>("/calculate", { method: "POST", body: JSON.stringify(input) }),

  saveCase: (input: CalculationCaseInput & { clientId?: number; status?: string; wizardState?: unknown }) =>
    request<{ id: number; result: any }>("/cases", { method: "POST", body: JSON.stringify(input) }),

  updateCase: (
    id: number,
    input: CalculationCaseInput,
    status?: string,
    roundingOverrides?: Record<string, number>,
    wizardState?: unknown
  ) =>
    request<{ id: number; result: any }>(`/cases/${id}`, {
      method: "PUT",
      body: JSON.stringify({ input, status, roundingOverrides, wizardState }),
    }),

  listCases: () => request<CaseSummary[]>("/cases"),

  getCase: (id: number) =>
    request<{
      input: CalculationCaseInput;
      result: any;
      clientId: number | null;
      status: string;
      roundingOverrides: Record<string, number> | null;
      wizardState: unknown | null;
    }>(`/cases/${id}`),

  // --- Clients ---
  createClient: (name: string) => request<{ id: number; name: string }>("/clients", { method: "POST", body: JSON.stringify({ name }) }),

  listClients: () => request<Client[]>("/clients"),

  getClient: (id: number) => request<Client>(`/clients/${id}`),

  updateClientName: (id: number, name: string) =>
    request<{ id: number; name: string }>(`/clients/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),

  deleteClient: (id: number) => request<{ deleted: number }>(`/clients/${id}`, { method: "DELETE" }),

  listClientCases: (clientId: number) => request<CaseSummary[]>(`/clients/${clientId}/cases`),

  deleteCase: (id: number) => request<{ deleted: number }>(`/cases/${id}`, { method: "DELETE" }),
};

export { ApiError };
