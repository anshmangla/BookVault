const express = require("express");
const router = express.Router();

const db = require("../db");
const {
  getVolume,
  searchVolumes
} = require("../services/googleBooks");

const isAuthenticated =
  require("../middleware/auth");

function calculateLibraryStats(books) {
  const ratedBooks =
    books.filter(
      book =>
        book.rating !== null &&
        book.rating !== undefined
    );

  const avgRating =
    ratedBooks.length > 0
      ? (
          ratedBooks.reduce(
            (sum, book) =>
              sum + Number(book.rating),
            0
          ) / ratedBooks.length
        ).toFixed(1)
      : 0;

  const topBook =
    ratedBooks.length > 0
      ? ratedBooks.reduce((top, book) =>
          Number(book.rating) >
          Number(top.rating)
            ? book
            : top
        )
      : null;

  return {
    totalBooks: books.length,
    avgRating,
    topBook
  };
}

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

    const sort = req.query.sort;

    let query = `
      SELECT *
      FROM books
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;

    if (sort === "rating") {
      query = `
        SELECT *
        FROM books
        WHERE user_id = $1
        ORDER BY rating DESC NULLS LAST
      `;
    }

    if (sort === "recent") {
      query = `
        SELECT *
        FROM books
        WHERE user_id = $1
        ORDER BY date_read DESC NULLS LAST
      `;
    }

    const result =
      await db.query(
        query,
        [req.session.userId]
      );

    const books = result.rows;

    const {
      totalBooks,
      avgRating,
      topBook
    } = calculateLibraryStats(books);

    res.render("index", {
      pageTitle: "My Library",
      books,
      totalBooks,
      avgRating,
      topBook
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
  try {

    const searchTerm =
      req.query.q;
      if (!searchTerm) {
        return res.redirect("/");
      }

    const result =
      await db.query(
        `
        SELECT *
        FROM books
        WHERE user_id = $1
        AND (
          LOWER(title) LIKE LOWER($2)
          OR LOWER(author) LIKE LOWER($2)
        )
        ORDER BY created_at DESC
        `,
        [
          req.session.userId,
          `%${searchTerm}%`
        ]
      );

    const books =
      result.rows;

    const {
      totalBooks,
      avgRating,
      topBook
    } = calculateLibraryStats(books);

    res.render("index", {
      pageTitle: searchTerm
        ? `Search: ${searchTerm}`
        : "My Library",
      books,
      totalBooks,
      avgRating,
      topBook
    });

  } catch (err) {
    next(err);

  }
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
      google_volume_id
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
        language
      )
      VALUES
      (
        $1,$2,$3,$4,
        $5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,
        $16,$17,$18
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
        googleBook?.language || null
      ]
    );

    res.redirect(
      `/book/${createdBook.rows[0].id}`
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

    res.render("book-details", {
      pageTitle: book.title,
      book
    });

  } catch(err){
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

    res.render("edit", {
      pageTitle: `Edit ${result.rows[0].title}`,
      book: result.rows[0]
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
      date_read
    } = req.body;

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

    await db.query(
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
        date_read = $8
      WHERE id = $9
      AND user_id = $10
      `,
      [
        title,
        author,
        isbn,
        publish_year || null,
        rating || null,
        notes,
        review,
        date_read || null,
        req.params.id,
        req.session.userId
      ]
    );

    res.redirect("/");

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

    await db.query(
      `
      DELETE FROM books
      WHERE id = $1
      AND user_id = $2
      `,
      [
        req.params.id,
        req.session.userId
      ]
    );

    res.redirect("/");

  } catch (err) {
    next(err);

  }
});

/*
====================================
BOOK ANALYTICS
====================================
*/

router.get("/stats", isAuthenticated, async (req,res,next)=>{

  try{
  
  const books =
  await db.query(
  `
  SELECT *
  FROM books
  WHERE user_id=$1
  `,
  [
  req.session.userId
  ]
  );
  
  const rows =
  books.rows;
  
  const totalBooks =
  rows.length;
  
  const { avgRating } =
  calculateLibraryStats(rows);
  
  const booksThisYear =
  rows.filter(book=>{
  
  if(!book.date_read)
  return false;
  
  return (
  new Date(
  book.date_read
  ).getFullYear()
  ===
  new Date()
  .getFullYear()
  );
  
  }).length;
  
  res.render(
  "stats",
  {
  pageTitle: "Reading Analytics",
  totalBooks,
  avgRating,
  booksThisYear,
  books:rows
  }
  );
  
  }catch(err){
  next(err);
  
  }
  
  });

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

      const q = req.query.q;

      if (!q || q.length < 2) {
        return res.json([]);
      }

      const result =
        await db.query(
          `
          SELECT
            id,
            title,
            author
          FROM books
          WHERE user_id = $1
          AND (
            LOWER(title)
            LIKE LOWER($2)
            OR LOWER(author)
            LIKE LOWER($2)
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
