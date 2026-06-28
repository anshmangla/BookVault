const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const express = require("express");
const methodOverride = require("method-override");

const db = require("../db");

const attemptedQueries = [];

db.query = async (sql, values) => {
  attemptedQueries.push({
    sql: String(sql),
    values
  });

  return { rows: [] };
};

const bookRoutes = require("../routes/books");

function createTestApp() {
  const app = express();

  app.set("view engine", "ejs");
  app.set(
    "views",
    path.join(__dirname, "..", "views")
  );
  app.use(express.urlencoded({ extended: true }));
  app.use(methodOverride("_method"));
  app.use((req, res, next) => {
    req.session = {
      userId: 202,
      userName: "Other reader"
    };
    res.locals.userId = 202;
    res.locals.userName = "Other reader";
    res.locals.currentPath = req.path;
    res.locals.notice = null;
    next();
  });
  app.use(bookRoutes);

  return app;
}

async function withServer(run) {
  const server =
    createTestApp().listen(0, "127.0.0.1");

  await new Promise(resolve =>
    server.once("listening", resolve)
  );

  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve =>
      server.close(resolve)
    );
  }
}

test(
  "another user cannot view, edit, delete, or restore a book",
  { concurrency: false },
  async () => {
    attemptedQueries.length = 0;

    await withServer(async baseUrl => {
      const requests = [
        fetch(`${baseUrl}/book/101`),
        fetch(`${baseUrl}/edit/101`),
        fetch(
          `${baseUrl}/edit/101?_method=PUT`,
          {
            method: "POST",
            headers: {
              "content-type":
                "application/x-www-form-urlencoded"
            },
            body:
              "title=Someone+Else%27s+Book"
          }
        ),
        fetch(
          `${baseUrl}/delete/101?_method=DELETE`,
          {
            method: "POST"
          }
        ),
        fetch(
          `${baseUrl}/book/101/undo`,
          {
            method: "POST"
          }
        )
      ];

      const responses =
        await Promise.all(requests);

      assert.deepEqual(
        responses.map(response => response.status),
        [404, 404, 404, 404, 404]
      );
    });

    assert.equal(attemptedQueries.length, 5);

    for (const query of attemptedQueries) {
      assert.match(
        query.sql,
        /user_id = \$\d+/
      );
      assert.match(
        query.sql,
        query.sql.includes("SET deleted_at = NULL")
          ? /deleted_at IS NOT NULL/
          : /deleted_at IS NULL/
      );
      assert.equal(
        query.values.at(-1),
        202
      );
      assert.ok(
        query.values.includes("101")
      );
    }
  }
);
