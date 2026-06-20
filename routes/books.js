const express = require("express");
const router = express.Router();

const axios = require("axios");
const db = require("../db");

const isAuthenticated =
  require("../middleware/auth");

/*
====================================
PROTECT ALL ROUTES
====================================
*/

router.use(isAuthenticated);

/*
====================================
HOME PAGE
====================================
*/

router.get("/", async (req, res) => {
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

    const totalBooks = books.length;

    const avgRating =
      books.length > 0
        ? (
            books.reduce(
              (sum, b) =>
                sum + (b.rating || 0),
              0
            ) / books.length
          ).toFixed(1)
        : 0;

    const topBook =
      books.length > 0
        ? books.reduce((a, b) =>
            (a.rating || 0) >
            (b.rating || 0)
              ? a
              : b
          )
        : null;

    res.render("index", {
      books,
      totalBooks,
      avgRating,
      topBook
    });

  } catch (err) {

    console.error(err);

    res
      .status(500)
      .send("Failed to load books.");

  }
});

/*
====================================
SEARCH BOOKS
====================================
*/

router.get("/search", async (req, res) => {
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

    const totalBooks =
      books.length;

    const avgRating =
      books.length > 0
        ? (
            books.reduce(
              (sum, b) =>
                sum + (b.rating || 0),
              0
            ) / books.length
          ).toFixed(1)
        : 0;

    const topBook =
      books.length > 0
        ? books.reduce((a, b) =>
            (a.rating || 0) >
            (b.rating || 0)
              ? a
              : b
          )
        : null;

    res.render("index", {
      books,
      totalBooks,
      avgRating,
      topBook
    });

  } catch (err) {

    console.error(err);

    res
      .status(500)
      .send("Search failed.");

  }
});

router.get("/search-book", (req, res) => {
  res.render("search-book");
});

router.get("/api/books", async (req, res) => {

  try {

    const query = req.query.q;

    if (!query) {
      return res.json([]);
    }

    const response =
      await axios.get(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}`
      );

    const books =
      response.data.docs
      .filter(book => book.cover_i)
      .slice(0, 10)
      .map(book => ({

        title: book.title,

        author:
          book.author_name?.[0] || "",

        isbn:
          book.isbn?.[0] || "",

        publish_year:
          book.first_publish_year || "",

        cover_url:
          book.cover_i
            ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
            : ""

      }));

    res.json(books);

  } catch (err) {

    console.error(err);

    res.status(500).json([]);

  }

});

/*
====================================
ADD BOOK PAGE
====================================
*/

router.get("/add", (req, res) => {
  res.render("add");
});

/*
====================================
CREATE BOOK
====================================
*/

router.post("/add", async (req, res) => {

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

    let cover_url = "";

    try {

      const apiResponse =
        await axios.get(
          `https://openlibrary.org/search.json?title=${encodeURIComponent(
            title
          )}&author=${encodeURIComponent(
            author || ""
          )}`
        );

      if (
        apiResponse.data.docs.length > 0
      ) {

        const book =
          apiResponse.data.docs[0];

        if (book.cover_i) {

          cover_url =
            `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`;

        }

      }

    } catch (apiError) {

      console.error(
        "Open Library Error:",
        apiError.message
      );

    }

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
        user_id
      )
      VALUES
      (
        $1,$2,$3,$4,
        $5,$6,$7,$8,$9,$10
      )
      `,
      [
        title,
        author,
        isbn,
        publish_year || null,
        rating || null,
        notes,
        review,
        cover_url,
        date_read || null,
        req.session.userId
      ]
    );

    res.redirect("/");

  } catch (err) {

    console.error(err);

    res
      .status(500)
      .send("Failed to add book.");

  }
});

/*
====================================
BOOK DETAILS PAGE
====================================
*/

router.get("/book/:id", async (req, res) => {

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
      .send("Book not found");

    }

    res.render(
      "book-details",
      {
        book: result.rows[0]
      }
    );

  } catch(err){

    console.error(err);

    res.status(500)
    .send("Error");

  }

});

/*
====================================
EDIT PAGE
====================================
*/

router.get("/edit/:id", async (req, res) => {

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
        .send("Book not found.");

    }

    res.render("edit", {
      book: result.rows[0]
    });

  } catch (err) {

    console.error(err);

    res
      .status(500)
      .send("Failed to load book.");

  }
});

/*
====================================
UPDATE BOOK
====================================
*/

router.put("/edit/:id", async (req, res) => {

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
        publish_year = $4
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

    console.error(err);

    res
      .status(500)
      .send("Failed to update book.");

  }
});

/*
====================================
DELETE BOOK
====================================
*/

router.delete("/delete/:id", async (req, res) => {

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

    console.error(err);

    res
      .status(500)
      .send("Failed to delete book.");

  }
});

/*
====================================
BOOK ANALYTICS
====================================
*/

router.get("/stats", async (req,res)=>{

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
  
  const avgRating =
  rows.length
  ?
  (
  rows.reduce(
  (sum,b)=>
  sum+(b.rating||0),
  0
  )
  /
  rows.length
  ).toFixed(1)
  :
  0;
  
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
  totalBooks,
  avgRating,
  booksThisYear,
  books:rows
  }
  );
  
  }catch(err){
  
  console.error(err);
  
  res.send("Error");
  
  }
  
  });

module.exports = router;