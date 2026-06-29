const fs = require("node:fs");
const path = require("node:path");
const db = require("../db");

const migrationPath = path.join(
  __dirname,
  "..",
  "migrations",
  "005_social_profiles.sql"
);

async function run() {
  const sql =
    fs.readFileSync(
      migrationPath,
      "utf8"
    );

  await db.query(sql);
  console.log(
    "Phase 10 migration completed: is_public, bio, avatar_url added to users, visibility added to books."
  );
}

run()
  .catch(error => {
    console.error(
      "Phase 10 migration failed:",
      error.message
    );
    process.exitCode = 1;
  })
  .finally(() => db.end());
