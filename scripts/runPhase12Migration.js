const fs = require("node:fs");
const path = require("node:path");
const db = require("../db");

const migrationPath = path.join(
  __dirname,
  "..",
  "migrations",
  "007_reading_status.sql"
);

async function run() {
  const sql = fs.readFileSync(
    migrationPath,
    "utf8"
  );

  await db.query(sql);
  console.log(
    "Phase 12 migration completed: reading status column added."
  );
}

run()
  .catch(error => {
    console.error(
      "Phase 12 migration failed:",
      error.message
    );
    process.exitCode = 1;
  })
  .finally(() => db.end());
