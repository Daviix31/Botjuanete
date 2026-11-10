import "@noxis/shared/env";
import pg, { type QueryResultRow, type PoolClient } from "pg";
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000,
  ...(process.env.DATABASE_SSL === "true" ? { ssl: { rejectUnauthorized: true } } : {}),
});
pool.on("error", () => console.error("NOXIS DB: conexión inactiva interrumpida"));
export const query = <T extends QueryResultRow = QueryResultRow>(
  sql: string,
  values: unknown[] = [],
) => pool.query<T>(sql, values);
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export const closeDatabase = () => pool.end();
