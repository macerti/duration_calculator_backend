import mysql from "mysql2/promise";
import * as dotenv from "dotenv";

dotenv.config();

let pool: mysql.Pool | null = null;

/**
 * Lazily-created connection pool. Reads standard cPanel-style env vars:
 * DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.
 * On cPanel, DB_USER/DB_NAME are typically prefixed like `cpaneluser_dbname`.
 */
export function getPool(): mysql.Pool {
  if (pool) return pool;

  const required = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required DB env vars: ${missing.join(", ")}. Copy .env.example to .env and fill them in.`
    );
  }

  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5, // conservative default for shared hosting connection caps
    queueLimit: 0,
  });

  return pool;
}

export async function pingDb(): Promise<boolean> {
  try {
    const conn = await getPool().getConnection();
    await conn.ping();
    conn.release();
    return true;
  } catch {
    return false;
  }
}
