import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SYNC_TABLES } from '../db';
import { SQL_TYPES, TABLE_COLUMNS } from './columns';

const sql = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20261112000100_sync_tables.sql'),
  'utf8',
);
const rules = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20261112000200_sync_rules.sql'),
  'utf8',
);

function sqlColumns(table: string): Record<string, string> {
  const match = new RegExp(`create table public\\.${table} \\(([\\s\\S]*?)\\n\\);`).exec(sql);
  if (!match) throw new Error(`no table ${table} in the migration`);
  const out: Record<string, string> = {};
  for (const line of match[1]!.split('\n')) {
    const m = /^\s*"?(\w+)"?\s+(timestamptz|double precision|\w+)/.exec(line);
    if (m) out[m[1]!] = m[2]!;
  }
  return out;
}

describe('server schema mirrors the local schema', () => {
  it.each(SYNC_TABLES)('%s has the same columns and types', (table) => {
    const expected = Object.fromEntries(
      Object.entries(TABLE_COLUMNS[table]).map(([c, type]) => [c, SQL_TYPES[type]]),
    );
    expect(sqlColumns(table)).toEqual({ ...expected, server_updated_at: 'timestamptz' });
  });

  it('lists every syncable table for the sync functions, in the same order', () => {
    const list = /array\[([\s\S]*?)\]::text\[\]/.exec(rules)![1]!;
    expect([...list.matchAll(/'(\w+)'/g)].map((m) => m[1])).toEqual([...SYNC_TABLES]);
  });
});
