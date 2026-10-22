import pg from 'pg';

export const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgres://creator:creator_dev_password@127.0.0.1:5432/creatorfriendly',
  max: 10,
});

export const query = (text, params) => pool.query(text, params);

export async function one(text, params) {
  const { rows } = await pool.query(text, params);
  return rows[0] || null;
}

// Runs fn inside a transaction, passing a dedicated client
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Applies schema.sql (all statements are idempotent) so existing volumes pick up new columns
export async function migrate() {
  const { readFile } = await import('node:fs/promises');
  const sql = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
}
