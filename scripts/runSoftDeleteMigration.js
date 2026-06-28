const fs = require("node:fs");
const path = require("node:path");
const db = require("../db");

const migrationPath = path.join(
  __dirname,
  "..",
  "migrations",
  "002_soft_delete_books.sql"
);

async function run() {
  const sql =
    fs.readFileSync(
      migrationPath,
      "utf8"
    );

  await db.query(sql);
  console.log(
    "Book soft-delete migration completed."
  );
}

run()
  .catch(error => {
    console.error(
      "Book soft-delete migration failed:",
      error.message
    );
    process.exitCode = 1;
  })
  .finally(() => db.end());
