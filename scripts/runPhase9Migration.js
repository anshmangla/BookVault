const fs = require("node:fs");
const path = require("node:path");
const db = require("../db");

const migrationPath = path.join(
  __dirname,
  "..",
  "migrations",
  "004_favorites_and_tags.sql"
);

async function run() {
  const sql =
    fs.readFileSync(
      migrationPath,
      "utf8"
    );

  await db.query(sql);
  console.log(
    "Phase 9 migration completed: favorites, tags, and spoiler columns added."
  );
}

run()
  .catch(error => {
    console.error(
      "Phase 9 migration failed:",
      error.message
    );
    process.exitCode = 1;
  })
  .finally(() => db.end());
