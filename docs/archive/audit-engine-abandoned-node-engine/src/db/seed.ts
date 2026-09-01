import { getActiveParameterSet, seedDefaultParameterSet } from "./parameterSetRepo";
import { pingDb } from "./pool";

async function main() {
  const ok = await pingDb();
  if (!ok) {
    console.error("Could not connect to the database. Check your .env DB_* values.");
    process.exit(1);
  }

  try {
    const existing = await getActiveParameterSet();
    console.log(`An active parameter set already exists: ${existing.id} (v${existing.version}). Nothing to do.`);
    process.exit(0);
  } catch {
    // no active set — proceed to seed
  }

  const seeded = await seedDefaultParameterSet();
  console.log(`Seeded and activated parameter set: ${seeded.id} (v${seeded.version})`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
