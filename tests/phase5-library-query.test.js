const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildLibraryWhere,
  normalizeLibraryQuery
} = require("../services/libraryQuery");

test("library queries always exclude soft-deleted books", () => {
  const filters =
    normalizeLibraryQuery({});
  const result =
    buildLibraryWhere(42, filters);

  assert.match(
    result.whereClause,
    /user_id = \$1/
  );
  assert.match(
    result.whereClause,
    /deleted_at IS NULL/
  );
  assert.deepEqual(result.values, [42]);
});

test("soft-delete condition is retained with filters", () => {
  const filters =
    normalizeLibraryQuery({
      q: "earthsea",
      rating: "rated",
      year: "2024"
    });
  const result =
    buildLibraryWhere(7, filters);

  assert.match(
    result.whereClause,
    /deleted_at IS NULL/
  );
  assert.match(
    result.whereClause,
    /rating IS NOT NULL/
  );
  assert.match(
    result.whereClause,
    /EXTRACT\(YEAR FROM date_read\)/
  );
});
