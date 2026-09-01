import { getPool } from "./pool";
import { ParameterSet } from "../types";
import { loadDefaultParameterSet as loadBootstrapParameterSet } from "../data/parameters";

/** Reads the currently-active parameter set from the DB. Throws if none is active. */
export async function getActiveParameterSet(): Promise<ParameterSet> {
  const [rows] = await getPool().query(
    "SELECT id, data FROM parameter_sets WHERE is_active = 1 LIMIT 1"
  );
  const list = rows as { id: string; data: string }[];
  if (list.length === 0) {
    throw new Error("No active parameter set in DB — run `npm run db:seed` first.");
  }
  return JSON.parse(list[0].data) as ParameterSet;
}

/** Inserts a new parameter set version and (optionally) activates it, deactivating others. */
export async function saveParameterSet(
  params: ParameterSet,
  opts: { activate: boolean; changedBy?: string; changeSummary?: string } = { activate: false }
): Promise<void> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      "INSERT INTO parameter_sets (id, version, is_active, change_note, data) VALUES (?, ?, 0, ?, ?)",
      [params.id, params.version, params.changeNote ?? null, JSON.stringify(params)]
    );

    if (opts.activate) {
      await conn.query("UPDATE parameter_sets SET is_active = 0");
      await conn.query("UPDATE parameter_sets SET is_active = 1 WHERE id = ?", [params.id]);
    }

    if (opts.changeSummary) {
      await conn.query(
        "INSERT INTO parameter_change_log (parameter_set_id, changed_by, change_summary) VALUES (?, ?, ?)",
        [params.id, opts.changedBy ?? null, opts.changeSummary]
      );
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Seeds the DB with the bootstrap parameter set (built from the source CSVs +
 * transcribed factor catalogue) and activates it. Safe to run once; will throw
 * on a duplicate id if run twice — check first via `getActiveParameterSet`.
 */
export async function seedDefaultParameterSet(): Promise<ParameterSet> {
  const bootstrap = loadBootstrapParameterSet();
  await saveParameterSet(bootstrap, {
    activate: true,
    changedBy: "system",
    changeSummary: "Initial seed from source CSVs + GS0106 spec transcription",
  });
  return bootstrap;
}
