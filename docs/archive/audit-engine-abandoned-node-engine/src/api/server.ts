import express, { Request, Response } from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import { loadDefaultParameterSet } from "../data/parameters";
import { calculateCase, calculateNae, findNaceEntry, searchNaceByDescription } from "../engine";
import { CalculationCaseInput, ParameterSet, SitePersonnelInput } from "../types";
import { pingDb } from "../db/pool";
import { getActiveParameterSet } from "../db/parameterSetRepo";
import { getCalculationCase, listCalculationCases, saveCalculationCase } from "../db/calculationCaseRepo";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Params are resolved once at boot: DB-backed if DB_* env vars + an active row
// exist, otherwise fall back to the in-memory bootstrap (CSV + transcribed
// catalogue) so local dev works with zero DB setup. dbAvailable gates the
// case-history endpoints, which have no in-memory fallback.
let params: ParameterSet = loadDefaultParameterSet();
let dbAvailable = false;

async function resolveParams(): Promise<void> {
  const dbUp = await pingDb().catch(() => false);
  if (!dbUp) {
    console.warn("[startup] No DB connection — using in-memory bootstrap parameter set. " +
      "Case history (/api/cases) will be unavailable. See .env.example.");
    return;
  }
  try {
    params = await getActiveParameterSet();
    dbAvailable = true;
    console.log(`[startup] Loaded active parameter set from DB: ${params.id} (v${params.version})`);
  } catch (e: any) {
    console.warn(`[startup] DB reachable but no active parameter set found (${e.message}). ` +
      "Run `npm run db:seed`. Falling back to in-memory bootstrap for now.");
  }
}

app.get("/health", async (_req: Request, res: Response) => {
  const dbUp = await pingDb().catch(() => false);
  res.json({
    status: "ok",
    parameterSetId: params.id,
    version: params.version,
    dbConnected: dbUp,
    dbBackedParameters: dbAvailable,
  });
});

app.get("/api/parameters", (_req: Request, res: Response) => {
  res.json(params);
});

app.get("/api/nace/search", (req: Request, res: Response) => {
  const q = String(req.query.q ?? "");
  if (!q) return res.status(400).json({ error: "query param 'q' is required" });
  res.json(searchNaceByDescription(q, params));
});

app.get("/api/nace/:code", (req: Request, res: Response) => {
  const code = String(req.params.code);
  const entry = findNaceEntry(code, params);
  if (!entry) return res.status(404).json({ error: `No NACE entry for code ${code}` });
  res.json(entry);
});

app.post("/api/nae", (req: Request, res: Response) => {
  try {
    const input = req.body as SitePersonnelInput;
    res.json(calculateNae(input));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/calculate", (req: Request, res: Response) => {
  try {
    const input = req.body as CalculationCaseInput;
    res.json(calculateCase(input, params));
  } catch (e: any) {
    res.status(400).json({ error: e.message, stack: e.stack });
  }
});

// --- Case history (DB-backed only) ---

function requireDb(res: Response): boolean {
  if (!dbAvailable) {
    res.status(503).json({
      error: "Database not configured/available. Case history requires a DB — see .env.example and `npm run db:seed`.",
    });
    return false;
  }
  return true;
}

app.post("/api/cases", async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const input = req.body as CalculationCaseInput;
    const result = calculateCase(input, params);
    const id = await saveCalculationCase(input, result);
    res.status(201).json({ id, result });
  } catch (e: any) {
    res.status(400).json({ error: e.message, stack: e.stack });
  }
});

app.get("/api/cases", async (_req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    res.json(await listCalculationCases());
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/cases/:id", async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const id = Number(req.params.id);
    const found = await getCalculationCase(id);
    if (!found) return res.status(404).json({ error: `No case with id ${id}` });
    res.json(found);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
if (require.main === module) {
  resolveParams().finally(() => {
    app.listen(PORT, () => {
      console.log(`Audit duration engine API listening on :${PORT}`);
    });
  });
}

export default app;
