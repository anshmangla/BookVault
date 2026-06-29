const express = require("express");
const router = express.Router();
const multer = require("multer");
const csv = require("csv-parser");
const { Readable } = require("stream");
const db = require("../db");
const isAuthenticated = require("../middleware/auth");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit for CSV
});

/*
====================================
RENDER IMPORT PAGE
====================================
*/

router.get("/", isAuthenticated, (req, res) => {
  res.render("import", {
    pageTitle: "Import Data"
  });
});

/*
====================================
PROCESS GOODREADS CSV IMPORT
====================================
*/

router.post(
  "/goodreads",
  isAuthenticated,
  upload.single("csvFile"),
  (req, res, next) => {
    if (!req.file) {
      req.session.notice = {
        type: "danger",
        title: "Import Failed",
        message: "Please select a valid CSV file to upload."
      };
      return res.redirect("/import");
    }

    const results = [];
    const stream = Readable.from(req.file.buffer);

    stream
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        try {
          let insertedCount = 0;

          // Process rows sequentially to avoid overwhelming the database with too many connections at once
          for (const row of results) {
            const title = String(row["Title"] || "").trim();
            const author = String(row["Author"] || "").trim();
            
            // Skip rows without a title (e.g. empty lines)
            if (!title) continue;

            // Rating: Goodreads is 1-5, BookVault is 1-10.
            // Wait, we need to convert Goodreads rating (1-5) to BookVault rating (1-10) by multiplying by 2?
            // Actually, the app supports 1-10. Let's just multiply by 2 to map 5 stars to 10 points.
            let rating = parseInt(row["My Rating"], 10);
            if (isNaN(rating) || rating === 0) {
              rating = null;
            } else {
              rating = rating * 2;
            }

            // Date Read
            let dateRead = null;
            if (row["Date Read"]) {
              const parsedDate = new Date(row["Date Read"]);
              if (!isNaN(parsedDate)) {
                // Formatting as YYYY-MM-DD
                dateRead = parsedDate.toISOString().split("T")[0];
              }
            }

            // Status: Goodreads shelves are usually 'read', 'currently-reading', 'to-read'
            let status = "read";
            const shelf = String(row["Exclusive Shelf"] || "").trim().toLowerCase();
            if (shelf === "currently-reading") status = "currently_reading";
            else if (shelf === "to-read") status = "want_to_read";

            // Notes / Review
            // CSV Parser sometimes parses HTML if Goodreads includes it. We'll strip basic HTML tags just in case, or leave it.
            // Usually Goodreads exports plain text with some <br> tags.
            let notes = String(row["My Review"] || "").trim();
            if (notes) {
                // Strip <br> tags
                notes = notes.replace(/<br\s*[\/]?>/gi, "\n");
            }

            await db.query(
              `
              INSERT INTO books (
                user_id,
                title,
                author,
                rating,
                date_read,
                status,
                notes
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              `,
              [
                req.session.userId,
                title,
                author,
                rating,
                dateRead,
                status,
                notes
              ]
            );

            insertedCount++;
          }

          req.session.notice = {
            type: "success",
            title: "Import Complete",
            message: `Successfully imported ${insertedCount} books from your Goodreads CSV.`
          };
          res.redirect("/");

        } catch (err) {
          console.error("Goodreads import error:", err);
          req.session.notice = {
            type: "danger",
            title: "Import Error",
            message: "An error occurred while parsing your CSV file. Please make sure it is a valid Goodreads export."
          };
          res.redirect("/import");
        }
      })
      .on("error", (err) => {
        console.error("CSV Parsing error:", err);
        req.session.notice = {
          type: "danger",
          title: "Import Error",
          message: "Failed to read the uploaded CSV file."
        };
        res.redirect("/import");
      });
  }
);

module.exports = router;
