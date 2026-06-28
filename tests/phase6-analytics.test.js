const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildAnalytics,
  dateParts
} = require("../services/analytics");

const books = [
  {
    id: 1,
    title: "A",
    author: "Author One",
    rating: 10,
    date_read: "2026-01-04"
  },
  {
    id: 2,
    title: "B",
    author: "Author One",
    rating: null,
    date_read: "2026-01-20"
  },
  {
    id: 3,
    title: "C",
    author: "Author Two",
    rating: 8,
    date_read: "2025-12-31"
  },
  {
    id: 4,
    title: "D",
    author: "Unread Author",
    rating: 8,
    date_read: null
  }
];

test("builds useful reading insights from rated and dated books", () => {
  const analytics =
    buildAnalytics(books, {
      year: 2026,
      readingGoal: 4
    });

  assert.equal(analytics.totalBooks, 4);
  assert.equal(analytics.ratedCount, 3);
  assert.equal(analytics.averageRating, "8.7");
  assert.equal(analytics.booksThisYear, 2);
  assert.equal(analytics.booksByMonth[0].count, 2);
  assert.equal(analytics.ratingDistribution[7].count, 2);
  assert.equal(analytics.ratingDistribution[9].count, 1);
  assert.deepEqual(
    analytics.goal,
    {
      target: 4,
      current: 2,
      percent: 50,
      barPercent: 50
    }
  );
  assert.equal(
    analytics.mostReadAuthors[0].author,
    "Author One"
  );
  assert.equal(
    analytics.mostReadAuthors.some(
      item => item.author === "Unread Author"
    ),
    false
  );
  assert.deepEqual(
    analytics.recentActivity.map(book => book.title),
    ["B", "A", "C"]
  );
});

test("excludes unrated books from averages and handles empty data", () => {
  const analytics =
    buildAnalytics(
      [{ title: "Unread", rating: null }],
      { year: 2026 }
    );

  assert.equal(analytics.averageRating, null);
  assert.equal(analytics.ratedCount, 0);
  assert.equal(analytics.booksThisYear, 0);
  assert.deepEqual(analytics.highestRated, []);
  assert.deepEqual(analytics.recentActivity, []);
});

test("caps the visual goal bar without hiding overachievement", () => {
  const analytics =
    buildAnalytics(
      [
        { date_read: "2026-01-01" },
        { date_read: "2026-02-01" },
        { date_read: "2026-03-01" }
      ],
      {
        year: 2026,
        readingGoal: 2
      }
    );

  assert.equal(analytics.goal.percent, 150);
  assert.equal(analytics.goal.barPercent, 100);
});

test("parses database dates without timezone conversion", () => {
  assert.deepEqual(
    dateParts("2026-06-28T00:00:00.000Z"),
    {
      year: 2026,
      month: 5,
      day: 28
    }
  );
  assert.deepEqual(
    dateParts(new Date(2026, 5, 28)),
    {
      year: 2026,
      month: 5,
      day: 28
    }
  );
  assert.equal(dateParts("not-a-date"), null);
});
