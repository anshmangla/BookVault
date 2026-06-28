const axios = require("axios");

const GOOGLE_BOOKS_BASE_URL =
  "https://www.googleapis.com/books/v1";

const VOLUME_FIELDS = [
  "id",
  "volumeInfo(title,subtitle,authors,publisher,publishedDate,description,industryIdentifiers,pageCount,categories,language,imageLinks)"
].join(",");

function asHttps(url) {
  if (!url) {
    return "";
  }

  return url.replace(/^http:\/\//i, "https://");
}

function findIdentifier(identifiers, type) {
  return (
    identifiers.find(
      identifier =>
        identifier.type === type
    )?.identifier || ""
  );
}

function publicationYear(publishedDate) {
  const match =
    String(publishedDate || "")
      .match(/^\d{4}/);

  return match
    ? Number(match[0])
    : null;
}

function descriptionText(description) {
  return String(description || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeVolume(volume = {}) {
  const info = volume.volumeInfo || {};
  const authors = Array.isArray(info.authors)
    ? info.authors.filter(Boolean)
    : [];
  const identifiers =
    Array.isArray(info.industryIdentifiers)
      ? info.industryIdentifiers
      : [];
  const categories =
    Array.isArray(info.categories)
      ? info.categories.filter(Boolean)
      : [];
  const isbn13 =
    findIdentifier(identifiers, "ISBN_13");
  const isbn10 =
    findIdentifier(identifiers, "ISBN_10");
  const imageLinks = info.imageLinks || {};

  return {
    google_volume_id: volume.id || "",
    title: info.title || "Untitled",
    subtitle: info.subtitle || "",
    authors,
    author: authors.join(", "),
    isbn: isbn13 || isbn10,
    isbn_13: isbn13,
    isbn_10: isbn10,
    publisher: info.publisher || "",
    published_date:
      info.publishedDate || "",
    publish_year:
      publicationYear(info.publishedDate),
    description:
      descriptionText(info.description),
    page_count:
      Number.isInteger(info.pageCount)
        ? info.pageCount
        : null,
    categories,
    language: info.language || "",
    cover_url: asHttps(
      imageLinks.thumbnail ||
      imageLinks.smallThumbnail ||
      imageLinks.small ||
      ""
    )
  };
}

function googleBooksParams(extra = {}) {
  if (!process.env.GOOGLE_BOOKS_API_KEY) {
    const error = new Error(
      "GOOGLE_BOOKS_API_KEY is not configured."
    );

    error.code =
      "GOOGLE_BOOKS_NOT_CONFIGURED";

    throw error;
  }

  return {
    ...extra,
    key: process.env.GOOGLE_BOOKS_API_KEY
  };
}

function buildSearchQuery(query, searchBy) {
  const cleanQuery =
    String(query || "").trim();

  switch (searchBy) {
    case "title":
      return `intitle:${cleanQuery}`;
    case "author":
      return `inauthor:${cleanQuery}`;
    case "isbn":
      return `isbn:${cleanQuery.replace(/[^0-9X]/gi, "")}`;
    default:
      return cleanQuery;
  }
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const apiCache = new Map();

function getCached(key) {
  const cached = apiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  if (cached) {
    apiCache.delete(key);
  }
  return null;
}

function setCache(key, data) {
  apiCache.set(key, { data, timestamp: Date.now() });
}

async function searchVolumes(
  query,
  {
    startIndex = 0,
    maxResults = 12,
    searchBy = "all"
  } = {}
) {
  const cleanQuery =
    String(query || "").trim();

  if (cleanQuery.length < 3) {
    return {
      books: [],
      totalItems: 0,
      startIndex: 0
    };
  }

  if (
    searchBy === "isbn" &&
    cleanQuery
      .replace(/[^0-9X]/gi, "")
      .length < 10
  ) {
    return {
      books: [],
      totalItems: 0,
      startIndex: 0
    };
  }

  const safeStartIndex =
    Math.max(
      0,
      Number.parseInt(startIndex, 10) || 0
    );

  const safeMaxResults =
    Math.min(
      40,
      Math.max(
        1,
        Number.parseInt(maxResults, 10) || 12
      )
    );

  const cacheKey = `search:${cleanQuery}:${searchBy}:${safeStartIndex}:${safeMaxResults}`;
  const cachedData = getCached(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  const response = await axios.get(
    `${GOOGLE_BOOKS_BASE_URL}/volumes`,
    {
      params: googleBooksParams({
        q: buildSearchQuery(
          cleanQuery,
          searchBy
        ),
        printType: "books",
        orderBy: "relevance",
        startIndex: safeStartIndex,
        maxResults: safeMaxResults,
        fields:
          `totalItems,items(${VOLUME_FIELDS})`
      }),
      timeout: 7000
    }
  );

  const items =
    Array.isArray(response.data.items)
      ? response.data.items
      : [];

  const result = {
    books: items.map(normalizeVolume),
    totalItems:
      Number(response.data.totalItems) || 0,
    startIndex: safeStartIndex
  };

  setCache(cacheKey, result);
  return result;
}

async function getVolume(volumeId) {
  const cleanVolumeId =
    String(volumeId || "").trim();

  if (!cleanVolumeId) {
    return null;
  }

  const cacheKey = `volume:${cleanVolumeId}`;
  const cachedData = getCached(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  const response = await axios.get(
    `${GOOGLE_BOOKS_BASE_URL}/volumes/${encodeURIComponent(cleanVolumeId)}`,
    {
      params: googleBooksParams({
        fields: VOLUME_FIELDS
      }),
      timeout: 7000
    }
  );

  const result = normalizeVolume(response.data);
  setCache(cacheKey, result);
  return result;
}

module.exports = {
  buildSearchQuery,
  getVolume,
  normalizeVolume,
  searchVolumes
};
