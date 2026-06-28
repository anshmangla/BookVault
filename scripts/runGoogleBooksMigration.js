const fs = require("node:fs");
const path = require("node:path");
const db = require("../db");

const migrationPath = path.join(
  __dirname,
  "..",
  "migrations",
  "001_google_books_metadata.sql"
);

async function run() {
  const sql =
    fs.readFileSync(
      migrationPath,
      "utf8"
    );

  await db.query(sql);
  console.log(
    "Google Books metadata migration completed."
  );
}

run()
  .catch(error => {
    console.error(
      "Google Books metadata migration failed:",
      error.message
    );
    process.exitCode = 1;
  })
  .finally(() => db.end());
