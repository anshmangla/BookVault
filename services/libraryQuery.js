const SORT_ORDERS = {
  newest:
    "created_at DESC",
  recent:
    "date_read DESC NULLS LAST, created_at DESC",
  rating:
    "rating DESC NULLS LAST, title ASC",
  title:
    "LOWER(title) ASC, created_at DESC",
  author:
    "LOWER(author) ASC NULLS LAST, LOWER(title) ASC"
};

const RATING_FILTERS =
  new Set(["all", "rated", "unrated"]);

function positiveInteger(value, fallback) {
  const parsed =
    Number.parseInt(value, 10);

  return Number.isInteger(parsed) &&
    parsed > 0
    ? parsed
    : fallback;
}

function normalizeLibraryQuery(query = {}) {
  const q =
    String(query.q || "")
      .trim()
      .slice(0, 120);

  const sort =
    Object.hasOwn(
      SORT_ORDERS,
      query.sort
    )
      ? query.sort
      : "newest";

  const rating =
    RATING_FILTERS.has(query.rating)
      ? query.rating
      : "all";

  const yearValue =
    String(query.year || "").trim();
  const year =
    /^\d{4}$/.test(yearValue)
      ? Number(yearValue)
      : null;

  return {
    q,
    sort,
    rating,
    year,
    page: positiveInteger(query.page, 1)
  };
}

function buildLibraryWhere(
  userId,
  filters
) {
  const conditions = [
    "user_id = $1",
    "deleted_at IS NULL"
  ];
  const values = [userId];

  if (filters.q) {
    values.push(`%${filters.q}%`);
    conditions.push(
      `(
        title ILIKE $${values.length}
        OR author ILIKE $${values.length}
        OR isbn ILIKE $${values.length}
      )`
    );
  }

  if (filters.rating === "rated") {
    conditions.push(
      "rating IS NOT NULL"
    );
  }

  if (filters.rating === "unrated") {
    conditions.push(
      "rating IS NULL"
    );
  }

  if (filters.year) {
    values.push(filters.year);
    conditions.push(
      `EXTRACT(YEAR FROM date_read) = $${values.length}`
    );
  }

  return {
    whereClause:
      conditions.join("\nAND "),
    values
  };
}

function sortOrder(sort) {
  return (
    SORT_ORDERS[sort] ||
    SORT_ORDERS.newest
  );
}

module.exports = {
  buildLibraryWhere,
  normalizeLibraryQuery,
  sortOrder
};
