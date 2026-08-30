import { getPool } from "./pool";
import { CalculationCaseInput } from "../types";
import { CaseCalculationResult } from "../engine/case";

export interface SavedCaseSummary {
  id: number;
  dossierRef: string;
  commercial: string | null;
  totalDays: number | null;
  createdAt: string;
  updatedAt: string;
}

export async function saveCalculationCase(
  input: CalculationCaseInput,
  result: CaseCalculationResult
): Promise<number> {
  const pool = getPool();
  const [res]: any = await pool.query(
    `INSERT INTO calculation_cases
      (dossier_ref, parameter_set_id, commercial, scope_text, input_json, result_json, total_days)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.dossierRef,
      input.parameterSetId,
      input.commercial ?? null,
      input.scopeText ?? null,
      JSON.stringify(input),
      JSON.stringify(result),
      result.totalDaysAllSites,
    ]
  );
  return res.insertId as number;
}

export async function listCalculationCases(limit = 50): Promise<SavedCaseSummary[]> {
  const [rows] = await getPool().query(
    `SELECT id, dossier_ref, commercial, total_days, created_at, updated_at
     FROM calculation_cases ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
  return (rows as any[]).map((r) => ({
    id: r.id,
    dossierRef: r.dossier_ref,
    commercial: r.commercial,
    totalDays: r.total_days,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function getCalculationCase(
  id: number
): Promise<{ input: CalculationCaseInput; result: CaseCalculationResult } | null> {
  const [rows] = await getPool().query(
    "SELECT input_json, result_json FROM calculation_cases WHERE id = ?",
    [id]
  );
  const list = rows as { input_json: string; result_json: string }[];
  if (list.length === 0) return null;
  return {
    input: JSON.parse(list[0].input_json),
    result: JSON.parse(list[0].result_json),
  };
}
