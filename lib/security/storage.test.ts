import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

const alice = "00000000-0000-4000-8000-000000000001";
const bob = "00000000-0000-4000-8000-000000000002";
const scanId = "00000000-0000-4000-8000-000000000003";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated, anon, service_role;
    grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('${alice}'), ('${bob}');`);
  const sql = await readFile(
    "supabase/migrations/20260906114947_security_scanner.sql",
    "utf8",
  );
  await db.exec(sql);
  await db.exec(sql); // Focused reconciliation is safely repeatable.
  await db.exec(`insert into public.security_scans (id,user_id,url,host,status) values ('${scanId}','${alice}','https://example.com','example.com','completed');
    insert into public.security_copilot_messages (scan_id,user_id,role,content) values ('${scanId}','${alice}','assistant','Private report guidance');`);
}, 20000);
afterAll(async () => {
  await db.close();
});

async function asUser(user: string, query: string) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`,
  );
  try {
    return await db.query(query);
  } finally {
    await db.exec("reset role");
  }
}

describe("private scanner storage", () => {
  it("lets the owner read their scans and copilot messages", async () => {
    expect(
      (await asUser(alice, "select * from security_scans")).rows,
    ).toHaveLength(1);
    expect(
      (await asUser(alice, "select * from security_copilot_messages")).rows,
    ).toHaveLength(1);
  });
  it("hides another user's scan and conversation even when the scan ID is known", async () => {
    expect(
      (await asUser(bob, `select * from security_scans where id = '${scanId}'`))
        .rows,
    ).toHaveLength(0);
    expect(
      (
        await asUser(
          bob,
          `select * from security_copilot_messages where scan_id = '${scanId}'`,
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("prevents client writes that bypass scanning or impersonate the assistant", async () => {
    await expect(
      asUser(
        alice,
        `update security_scans set score = 100 where id = '${scanId}'`,
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(
        alice,
        `insert into security_copilot_messages (scan_id,user_id,role,content) values ('${scanId}','${alice}','assistant','Forged')`,
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(alice, `delete from security_scans where id = '${scanId}'`),
    ).rejects.toThrow(/permission denied/);
  });
  it("rejects mismatched scan and message owners even for privileged server writes", async () => {
    await expect(
      db.exec(
        `insert into security_copilot_messages (scan_id,user_id,role,content) values ('${scanId}','${bob}','user','Mismatched')`,
      ),
    ).rejects.toThrow(/foreign key/);
  });
  it("does not expose either table to anonymous visitors", async () => {
    await db.exec("set role anon");
    try {
      await expect(db.query("select * from security_scans")).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        db.query("select * from security_copilot_messages"),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
  it("cascades scan history when its owning account is deleted", async () => {
    await db.exec(`begin; delete from auth.users where id = '${alice}';`);
    expect((await db.query("select * from security_scans")).rows).toHaveLength(
      0,
    );
    expect(
      (await db.query("select * from security_copilot_messages")).rows,
    ).toHaveLength(0);
    await db.exec("rollback");
  });
});
