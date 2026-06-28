const fs = require("node:fs");
const path = require("node:path");
const db = require("../db");

const migrationPath = path.join(
  __dirname,
  "..",
  "migrations",
  "003_reading_goal.sql"
);

async function run() {
  const sql =
    fs.readFileSync(
      migrationPath,
      "utf8"
    );

  await db.query(sql);
  console.log(
    "Analytics reading-goal migration completed."
  );
}

run()
  .catch(error => {
    console.error(
      "Analytics migration failed:",
      error.message
    );
    process.exitCode = 1;
  })
  .finally(() => db.end());
