const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

function numberRating(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const rating = Number(value);

  return Number.isFinite(rating)
    ? rating
    : null;
}

function dateParts(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return {
      year: value.getFullYear(),
      month: value.getMonth(),
      day: value.getDate()
    };
  }

  const match =
    String(value)
      .slice(0, 10)
      .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: Number(match[3])
  };
}

function compareText(left, right) {
  return String(left || "").localeCompare(
    String(right || ""),
    undefined,
    { sensitivity: "base" }
  );
}

function buildAnalytics(
  books,
  {
    year = new Date().getFullYear(),
    readingGoal = 24
  } = {}
) {
  const rows =
    Array.isArray(books) ? books : [];
  const ratedBooks =
    rows.filter(
      book => numberRating(book.rating) !== null
    );

  const averageRating =
    ratedBooks.length
      ? (
          ratedBooks.reduce(
            (sum, book) =>
              sum + numberRating(book.rating),
            0
          ) / ratedBooks.length
        ).toFixed(1)
      : null;

  const ratingDistribution =
    Array.from(
      { length: 10 },
      (_, index) => ({
        rating: index + 1,
        count: 0
      })
    );

  for (const book of ratedBooks) {
    const rating =
      Math.round(numberRating(book.rating));

    if (rating >= 1 && rating <= 10) {
      ratingDistribution[rating - 1].count += 1;
    }
  }

  const booksByMonth =
    MONTH_LABELS.map(label => ({
      label,
      count: 0
    }));

  const datedBooks =
    rows
      .map(book => ({
        ...book,
        readDate: dateParts(book.date_read)
      }))
      .filter(book => book.readDate);

  for (const book of datedBooks) {
    if (
      book.readDate.year === year &&
      book.readDate.month >= 0 &&
      book.readDate.month <= 11
    ) {
      booksByMonth[book.readDate.month].count += 1;
    }
  }

  const booksThisYear =
    booksByMonth.reduce(
      (sum, month) => sum + month.count,
      0
    );
  const goalTarget =
    Number.isInteger(Number(readingGoal)) &&
    Number(readingGoal) > 0
      ? Number(readingGoal)
      : 24;
  const goalPercent =
    Math.round(
      (booksThisYear / goalTarget) * 100
    );

  const highestRated =
    [...ratedBooks]
      .sort(
        (left, right) =>
          numberRating(right.rating) -
            numberRating(left.rating) ||
          compareText(left.title, right.title)
      )
      .slice(0, 5);

  const authorCounts = new Map();

  for (const book of datedBooks) {
    const author =
      String(book.author || "").trim();

    if (!author) {
      continue;
    }

    const key = author.toLocaleLowerCase();
    const current =
      authorCounts.get(key) || {
        author,
        count: 0
      };

    current.count += 1;
    authorCounts.set(key, current);
  }

  const mostReadAuthors =
    [...authorCounts.values()]
      .sort(
        (left, right) =>
          right.count - left.count ||
          compareText(left.author, right.author)
      )
      .slice(0, 5);

  const recentActivity =
    datedBooks
      .sort((left, right) => {
        const leftKey =
          `${left.readDate.year}-${String(
            left.readDate.month + 1
          ).padStart(2, "0")}-${String(
            left.readDate.day
          ).padStart(2, "0")}`;
        const rightKey =
          `${right.readDate.year}-${String(
            right.readDate.month + 1
          ).padStart(2, "0")}-${String(
            right.readDate.day
          ).padStart(2, "0")}`;

        return (
          rightKey.localeCompare(leftKey) ||
          compareText(left.title, right.title)
        );
      })
      .slice(0, 5);

  return {
    year,
    totalBooks: rows.length,
    ratedCount: ratedBooks.length,
    averageRating,
    booksThisYear,
    ratingDistribution,
    booksByMonth,
    goal: {
      target: goalTarget,
      current: booksThisYear,
      percent: goalPercent,
      barPercent: Math.min(goalPercent, 100)
    },
    highestRated,
    mostReadAuthors,
    recentActivity
  };
}

module.exports = {
  buildAnalytics,
  dateParts
};
