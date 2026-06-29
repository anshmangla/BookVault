const fs = require("node:fs");
const path = require("node:path");
const db = require("../db");

const migrationPath = path.join(
  __dirname,
  "..",
  "migrations",
  "006_social_feed.sql"
);

async function run() {
  const sql = fs.readFileSync(
    migrationPath,
    "utf8"
  );

  await db.query(sql);
  console.log(
    "Phase 11 migration completed: follows, activities, and activity_likes tables created."
  );
}

run()
  .catch(error => {
    console.error(
      "Phase 11 migration failed:",
      error.message
    );
    process.exitCode = 1;
  })
  .finally(() => db.end());
