require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("../db");

async function runMigration() {
  try {
    console.log("Starting Phase 13 migration (Username Changed)...");

    const sqlPath = path.join(__dirname, "..", "migrations", "008_username_changed.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");

    await db.query(sql);

    console.log("Migration successful: added username_changed to users.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

runMigration();
