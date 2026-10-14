// Run SQL files against the TEST project only (aligned-test), reading the
// connection string from .env.development.local (TEST_DATABASE_URL). It
// refuses to run if that string points at the live project.
//   node --env-file=.env.development.local scripts/test-db.mjs file1.sql [file2.sql ...]
//   node --env-file=.env.development.local scripts/test-db.mjs --query "select 1"
import fs from "node:fs";
import pg from "pg";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("TEST_DATABASE_URL is not set in .env.development.local");
  process.exit(1);
}
if (url.includes("yeedrmvikdjcrjvfyceo")) {
  console.error("Refusing: that connection string is the LIVE project.");
  process.exit(1);
}
if (!url.includes("yutrlsjitrjbteyukyfc")) {
  console.error("Refusing: the connection string isn't the aligned-test project.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const args = process.argv.slice(2);
  if (args[0] === "--query") {
    const r = await client.query(args[1]);
    console.table(r.rows);
  } else {
    for (const f of args) {
      await client.query(fs.readFileSync(f, "utf8"));
      console.log("applied", f);
    }
  }
} catch (e) {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
