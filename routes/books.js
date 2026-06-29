const express = require("express");
const router = express.Router();

const db = require("../db");
const {
  getVolume,
  searchVolumes
} = require("../services/googleBooks");
const {
  buildLibraryWhere,
  normalizeLibraryQuery,
  sortOrder
} = require("../services/libraryQuery");
const {
  buildAnalytics
} = require("../services/analytics");

const isAuthenticated =
  require("../middleware/auth");

const LIBRARY_PAGE_SIZE = 12;

/*
====================================
HELPER: Tag sync
====================================
Parses a comma-separated tag string, upserts each
tag for the user, then replaces all book_tags rows.
Returns the final tag names array.
*/
async function syncBookTags(bookId, userId, rawTags) {
  // Parse and normalise tag names
  const tagNames = String(rawTags || "")
    .split(",")
    .map(t => t.trim().toLowerCase().replace(/[^a-z0-9\-_#]/g, "").slice(0, 64))
    .filter(Boolean);

  // Remove old associations first
  await db.query(
    `DELETE FROM book_tags
     WHERE book_id = $1
     AND tag_id IN (
       SELECT id FROM tags WHERE user_id = $2
     )`,
    [bookId, userId]
  );

  if (tagNames.length === 0) return [];

  // Upsert each tag, then link
  for (const name of tagNames) {
    const tagResult = await db.query(
      `INSERT INTO tags (user_id, name)
       VALUES ($1, $2)
       ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [userId, name]
    );
    const tagId = tagResult.rows[0].id;
    await db.query(
      `INSERT INTO book_tags (book_id, tag_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [bookId, tagId]
    );
  }

  return tagNames;
}

/*
====================================
HELPER: Fetch tags for a single book
====================================
*/
async function getBookTags(bookId, userId) {
  const result = await db.query(
    `SELECT t.name
     FROM tags t
     JOIN book_tags bt ON bt.tag_id = t.id
     WHERE bt.book_id = $1
     AND t.user_id = $2
     ORDER BY t.name`,
    [bookId, userId]
  );
  return result.rows.map(r => r.name);
}

/*
====================================
HELPER: Fetch all tags for a user
====================================
*/
async function getUserTags(userId) {
  const result = await db.query(
    `SELECT DISTINCT t.name
     FROM tags t
     WHERE t.user_id = $1
     ORDER BY t.name`,
    [userId]
  );
  return result.rows.map(r => r.name);
}

/*
====================================
HELPER: Duplicate detection
====================================
*/
async function addDuplicateInfo(
  books,
  userId
) {
  if (!books.length) {
    return books;
  }

  const volumeIds =
    books
      .map(book => book.google_volume_id)
      .filter(Boolean);

  const isbns =
    books
      .map(book => book.isbn)
      .filter(Boolean);

  const result = await db.query(
    `
    SELECT
      id,
      title,
      google_volume_id,
      isbn
    FROM books
    WHERE user_id = $1
    AND deleted_at IS NULL
    AND (
      google_volume_id = ANY($2::text[])
      OR isbn = ANY($3::text[])
    )
    `,
    [userId, volumeIds, isbns]
  );

  return books.map(book => {
    const duplicate =
      result.rows.find(existing =>
        (
          book.google_volume_id &&
          existing.google_volume_id ===
            book.google_volume_id
        ) ||
        (
          book.isbn &&
          existing.isbn === book.isbn
        )
      );

    return {
      ...book,
      duplicate: duplicate
        ? {
            id: duplicate.id,
            title: duplicate.title
          }
        : null
    };
  });
}

/*
====================================
HOME PAGE
====================================
*/

router.get("/", isAuthenticated, async (req, res, next) => {
  try {
    const filters =
      normalizeLibraryQuery(req.query);

    // Tag filter (not part of libraryQuery service)
    const selectedTag = String(req.query.tag || "").trim().toLowerCase() || null;

    const {
      whereClause,
      values
    } = buildLibraryWhere(
      req.session.userId,
      filters
    );

    // If a tag filter is active, we add a subquery condition
    let tagWhere = whereClause;
    let tagValues = [...values];

    if (selectedTag) {
      const tagParamIdx = tagValues.length + 1;
      const tagUserParamIdx = tagValues.length + 2;
      tagWhere += ` AND id IN (
        SELECT bt.book_id FROM book_tags bt
        JOIN tags t ON t.id = bt.tag_id
        WHERE t.user_id = $${tagUserParamIdx}
        AND t.name = $${tagParamIdx}
      )`;
      tagValues.push(selectedTag, req.session.userId);
    }

    const [
      countResult,
      statsResult,
      topBookResult,
      yearsResult,
      userTagsResult
    ] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS count FROM books WHERE ${tagWhere}`,
        tagValues
      ),
      db.query(
        `SELECT COUNT(*)::int AS total_books, AVG(rating) AS avg_rating
         FROM books WHERE user_id = $1 AND deleted_at IS NULL`,
        [req.session.userId]
      ),
      db.query(
        `SELECT * FROM books WHERE user_id = $1 AND deleted_at IS NULL
         AND rating IS NOT NULL ORDER BY rating DESC, created_at DESC LIMIT 1`,
        [req.session.userId]
      ),
      db.query(
        `SELECT DISTINCT EXTRACT(YEAR FROM date_read)::int AS year
         FROM books WHERE user_id = $1 AND deleted_at IS NULL
         AND date_read IS NOT NULL ORDER BY year DESC`,
        [req.session.userId]
      ),
      db.query(
        `SELECT DISTINCT t.name FROM tags t WHERE t.user_id = $1 ORDER BY t.name`,
        [req.session.userId]
      )
    ]);

    const totalResults =
      Number(countResult.rows[0].count);

    const totalPages =
      Math.max(
        1,
        Math.ceil(
          totalResults /
          LIBRARY_PAGE_SIZE
        )
      );

    const currentPage =
      Math.min(
        filters.page,
        totalPages
      );

    const limitPlaceholder =
      tagValues.length + 1;
    const offsetPlaceholder =
      tagValues.length + 2;

    const booksResult =
      await db.query(
        `
        SELECT *
        FROM books
        WHERE ${tagWhere}
        ORDER BY ${sortOrder(filters.sort)}
        LIMIT $${limitPlaceholder}
        OFFSET $${offsetPlaceholder}
        `,
        [
          ...tagValues,
          LIBRARY_PAGE_SIZE,
          (
            currentPage - 1
          ) * LIBRARY_PAGE_SIZE
        ]
      );

    // Fetch tags for each book on this page
    const books = await Promise.all(
      booksResult.rows.map(async book => ({
        ...book,
        tags: await getBookTags(book.id, req.session.userId)
      }))
    );

    const totalBooks =
      Number(
        statsResult.rows[0].total_books
      );
    const avgRating =
      statsResult.rows[0].avg_rating
        ? Number(
            statsResult.rows[0].avg_rating
          ).toFixed(1)
        : 0;
    const topBook =
      topBookResult.rows[0] || null;
    const availableYears =
      yearsResult.rows.map(
        row => row.year
      );
    const userTags =
      userTagsResult.rows.map(r => r.name);

    res.render("index", {
      pageTitle: filters.favorites
        ? "Favorites"
        : filters.q
          ? `Search: ${filters.q}`
          : "My Library",
      books,
      totalBooks,
      avgRating,
      topBook,
      totalResults,
      availableYears,
      userTags,
      selectedTag,
      filters: {
        ...filters,
        page: currentPage
      },
      pagination: {
        currentPage,
        totalPages,
        pageSize: LIBRARY_PAGE_SIZE
      }
    });

  } catch (err) {
    next(err);

  }
});

/*
====================================
SEARCH BOOKS
====================================
*/

router.get("/search", isAuthenticated, async (req, res, next) => {
  const searchTerm =
    String(req.query.q || "").trim();

  if (!searchTerm) {
    return res.redirect("/");
  }

  res.redirect(
    `/?q=${encodeURIComponent(searchTerm)}`
  );
});

router.get("/search-book", isAuthenticated, (req, res) => {
  res.render("search-book", {
    pageTitle: "Add Book"
  });
});

router.get(
  "/api/google-books/search",
  isAuthenticated,
  async (req, res) => {
    try {
      const result =
        await searchVolumes(
          req.query.q,
          {
            startIndex:
              req.query.startIndex,
            maxResults:
              req.query.maxResults,
            searchBy:
              req.query.searchBy
          }
        );

      const books =
        await addDuplicateInfo(
          result.books,
          req.session.userId
        );

      res.json({
        ...result,
        books
      });
    } catch (err) {
      console.error(
        "Google Books search failed:",
        err.message
      );

      res.status(502).json({
        error:
          "Book search is temporarily unavailable.",
        books: [],
        totalItems: 0,
        startIndex: 0
      });
    }
  }
);

router.get(
  "/api/google-books/:volumeId",
  isAuthenticated,
  async (req, res) => {
    try {
      const book =
        await getVolume(
          req.params.volumeId
        );

      if (!book) {
        return res.status(404).json({
          error: "Book not found."
        });
      }

      res.json({ book });
    } catch (err) {
      console.error(
        "Google Books lookup failed:",
        err.message
      );

      res.status(502).json({
        error:
          "Book details are temporarily unavailable."
      });
    }
  }
);

/*
====================================
ADD BOOK PAGE
====================================
*/

router.get("/add", isAuthenticated, (req, res) => {
  res.redirect("/search-book?manual=1");
});

/*
====================================
CREATE BOOK
====================================
*/

router.post("/add", isAuthenticated, async (req, res, next) => {

  try {

    const {
      title,
      author,
      isbn,
      publish_year,
      rating,
      notes,
      review,
      date_read,
      google_volume_id,
      tags,
      has_spoilers,
      visibility
    } = req.body;

    const cleanTitle =
      String(title || "").trim();
    const cleanAuthor =
      String(author || "").trim();
    const cleanIsbn =
      String(isbn || "").trim();

    if (
      rating &&
      (rating < 1 || rating > 10)
    ) {
      return res
        .status(400)
        .send(
          "Rating must be between 1 and 10."
        );
    }

    if (!cleanTitle) {
      return res.status(400).render(
        "error",
        {
          pageTitle: "Title Required",
          message:
            "A title is required before a book can be saved."
        }
      );
    }

    if (google_volume_id || cleanIsbn) {
      const duplicate =
        await db.query(
          `
          SELECT id
          FROM books
          WHERE user_id = $1
          AND deleted_at IS NULL
          AND (
            (
              $2::text IS NOT NULL
              AND google_volume_id = $2
            )
            OR
            (
              $3::text IS NOT NULL
              AND isbn = $3
            )
          )
          LIMIT 1
          `,
          [
            req.session.userId,
            google_volume_id || null,
            cleanIsbn || null
          ]
        );

      if (duplicate.rows.length > 0) {
        return res.redirect(
          `/book/${duplicate.rows[0].id}`
        );
      }
    }

    let googleBook = null;

    if (google_volume_id) {
      try {
        googleBook =
          await getVolume(
            google_volume_id
          );
      } catch (apiError) {
        console.error(
          "Google Books verification failed:",
          apiError.message
        );

        return res.status(502).render(
          "error",
          {
            pageTitle:
              "Book Lookup Unavailable",
            message:
              "We could not verify that Google Books result. Please try adding it again."
          }
        );
      }
    }

    const createdBook =
      await db.query(
      `
      INSERT INTO books
      (
        title,
        author,
        isbn,
        publish_year,
        rating,
        notes,
        review,
        cover_url,
        date_read,
        user_id,
        google_volume_id,
        subtitle,
        publisher,
        published_date,
        description,
        page_count,
        categories,
        language,
        has_spoilers,
        visibility
      )
      VALUES
      (
        $1,$2,$3,$4,
        $5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,
        $16,$17,$18,$19,$20
      )
      RETURNING id
      `,
      [
        cleanTitle,
        cleanAuthor,
        cleanIsbn,
        publish_year || null,
        rating || null,
        notes,
        review,
        googleBook?.cover_url || "",
        date_read || null,
        req.session.userId,
        googleBook?.google_volume_id ||
          null,
        googleBook?.subtitle || null,
        googleBook?.publisher || null,
        googleBook?.published_date ||
          null,
        googleBook?.description || null,
        googleBook?.page_count || null,
        googleBook?.categories || [],
        googleBook?.language || null,
        has_spoilers === "on" || has_spoilers === "true",
        visibility === 'private' ? 'private' : 'public'
      ]
    );

    const newBookId = createdBook.rows[0].id;

    // Save tags
    await syncBookTags(newBookId, req.session.userId, tags);

    res.redirect(
      `/book/${newBookId}`
    );

  } catch (err) {
    next(err);

  }
});

/*
====================================
BOOK DETAILS PAGE
====================================
*/

router.get("/book/:id", isAuthenticated, async (req, res, next) => {

  try {

    const result =
      await db.query(
        `
        SELECT *
        FROM books
        WHERE id = $1
        AND user_id = $2
        AND deleted_at IS NULL
        `,
        [
          req.params.id,
          req.session.userId
        ]
      );

    if(result.rows.length === 0){

      return res
      .status(404)
      .render("404", {
        pageTitle: "Book Not Found",
        message:
          "That book could not be found in your library."
      });

    }

    const book = result.rows[0];
    const bookTags = await getBookTags(book.id, req.session.userId);

    res.render("book-details", {
      pageTitle: book.title,
      book,
      bookTags
    });

  } catch(err){
    next(err);

  }

});

/*
====================================
FAVORITE TOGGLE
====================================
*/

router.post("/book/:id/favorite", isAuthenticated, async (req, res, next) => {
  try {
    const result = await db.query(
      `UPDATE books
       SET is_favorite = NOT is_favorite
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING is_favorite`,
      [req.params.id, req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Book not found." });
    }

    res.json({ is_favorite: result.rows[0].is_favorite });
  } catch (err) {
    next(err);
  }
});

/*
====================================
EDIT PAGE
====================================
*/

router.get("/edit/:id", isAuthenticated, async (req, res, next) => {

  try {

    const result =
      await db.query(
        `
        SELECT *
        FROM books
        WHERE id = $1
        AND user_id = $2
        AND deleted_at IS NULL
        `,
        [
          req.params.id,
          req.session.userId
        ]
      );

    if (
      result.rows.length === 0
    ) {

      return res
        .status(404)
        .render("404", {
          pageTitle: "Book Not Found",
          message:
            "That book could not be found in your library."
        });

    }

    const book = result.rows[0];
    const bookTags = await getBookTags(book.id, req.session.userId);

    res.render("edit", {
      pageTitle: `Edit ${book.title}`,
      book,
      bookTags
    });

  } catch (err) {
    next(err);

  }
});

/*
====================================
UPDATE BOOK
====================================
*/

router.put("/edit/:id", isAuthenticated, async (req, res, next) => {

  try {

    const {
      title,
      author,
      isbn,
      publish_year,
      rating,
      notes,
      review,
      date_read,
      tags,
      has_spoilers,
      visibility
    } = req.body;

    const cleanTitle =
      String(title || "").trim();
    const cleanAuthor =
      String(author || "").trim();
    const cleanIsbn =
      String(isbn || "").trim();

    if (!cleanTitle) {
      return res.status(400).render(
        "error",
        {
          pageTitle: "Title Required",
          message:
            "A title is required before a book can be updated."
        }
      );
    }

    if (
      rating &&
      (rating < 1 || rating > 10)
    ) {

      return res
        .status(400)
        .send(
          "Rating must be between 1 and 10."
        );

    }

    const result = await db.query(
      `
      UPDATE books
      SET
        title = $1,
        author = $2,
        isbn = $3,
        publish_year = $4,
        rating = $5,
        notes = $6,
        review = $7,
        date_read = $8,
        has_spoilers = $9,
        visibility = $10
      WHERE id = $11
      AND user_id = $12
      AND deleted_at IS NULL
      RETURNING id
      `,
      [
        cleanTitle,
        cleanAuthor,
        cleanIsbn,
        publish_year || null,
        rating || null,
        notes,
        review,
        date_read || null,
        has_spoilers === "on" || has_spoilers === "true",
        visibility === 'private' ? 'private' : 'public',
        req.params.id,
        req.session.userId
      ]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .render("404", {
          pageTitle: "Book Not Found",
          message:
            "That book could not be found in your library."
        });
    }

    // Sync tags
    await syncBookTags(req.params.id, req.session.userId, tags);

    req.session.notice = {
      type: "success",
      title: "Book updated",
      message:
        `Your changes to "${cleanTitle}" were saved.`
    };

    res.redirect(`/book/${req.params.id}`);

  } catch (err) {
    next(err);

  }
});

/*
====================================
DELETE BOOK
====================================
*/

router.delete("/delete/:id", isAuthenticated, async (req, res, next) => {

  try {

    const result = await db.query(
      `
      UPDATE books
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1
      AND user_id = $2
      AND deleted_at IS NULL
      RETURNING id, title
      `,
      [
        req.params.id,
        req.session.userId
      ]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .render("404", {
          pageTitle: "Book Not Found",
          message:
            "That book could not be found in your library."
        });
    }

    req.session.notice = {
      type: "info",
      title: "Book removed",
      message:
        `"${result.rows[0].title}" was removed from your library.`,
      undoBookId: result.rows[0].id
    };

    res.redirect("/");

  } catch (err) {
    next(err);

  }
});

router.post("/book/:id/undo", isAuthenticated, async (req, res, next) => {
  try {
    const result =
      await db.query(
        `
        UPDATE books
        SET deleted_at = NULL
        WHERE id = $1
        AND user_id = $2
        AND deleted_at IS NOT NULL
        RETURNING id, title
        `,
        [
          req.params.id,
          req.session.userId
        ]
      );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .render("404", {
          pageTitle: "Book Not Found",
          message:
            "That deleted book could not be restored."
        });
    }

    req.session.notice = {
      type: "success",
      title: "Book restored",
      message:
        `"${result.rows[0].title}" is back in your library.`
    };

    res.redirect(`/book/${result.rows[0].id}`);
  } catch (err) {
    next(err);
  }
});

/*
====================================
BOOK ANALYTICS
====================================
*/

router.get("/stats", isAuthenticated, async (req, res, next) => {
  try {
    const currentYear =
      new Date().getFullYear();

    const [
      booksResult,
      userResult
    ] = await Promise.all([
      db.query(
        `
        SELECT
          id,
          title,
          author,
          rating,
          date_read,
          cover_url
        FROM books
        WHERE user_id = $1
        AND deleted_at IS NULL
        `,
        [req.session.userId]
      ),
      db.query(
        `
        SELECT reading_goal
        FROM users
        WHERE id = $1
        `,
        [req.session.userId]
      )
    ]);

    const analytics =
      buildAnalytics(
        booksResult.rows,
        {
          year: currentYear,
          readingGoal:
            userResult.rows[0]?.reading_goal
        }
      );

    res.render("stats", {
      pageTitle: "Reading Analytics",
      analytics
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/stats/goal",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const readingGoal =
        Number.parseInt(
          req.body.reading_goal,
          10
        );

      if (
        !Number.isInteger(readingGoal) ||
        readingGoal < 1 ||
        readingGoal > 1000
      ) {
        req.session.notice = {
          type: "info",
          title: "Goal not changed",
          message:
            "Choose a reading goal between 1 and 1,000 books."
        };

        return res.redirect("/stats");
      }

      await db.query(
        `
        UPDATE users
        SET reading_goal = $1
        WHERE id = $2
        `,
        [
          readingGoal,
          req.session.userId
        ]
      );

      req.session.notice = {
        type: "success",
        title: "Reading goal updated",
        message:
          `Your ${new Date().getFullYear()} goal is ${readingGoal} books.`
      };

      res.redirect("/stats");
    } catch (err) {
      next(err);
    }
  }
);

/*
====================================
AUTOCOMPLETE SEARCH
====================================
*/

router.get(
  "/api/search-books",
  isAuthenticated,
  async (req, res) => {

    try {

      const q =
        String(req.query.q || "")
          .trim()
          .slice(0, 120);

      if (!q || q.length < 2) {
        return res.json([]);
      }

      const result =
        await db.query(
          `
          SELECT
            id,
            title,
            author,
            isbn
          FROM books
          WHERE user_id = $1
          AND deleted_at IS NULL
          AND (
            title ILIKE $2
            OR author ILIKE $2
            OR isbn ILIKE $2
          )
          ORDER BY title
          LIMIT 10
          `,
          [
            req.session.userId,
            `%${q}%`
          ]
        );

      res.json(
        result.rows
      );

    } catch (err) {

      console.error(err);

      res.json([]);

    }

  }
);

module.exports = router;
