const express = require("express");
const router = express.Router();
const db = require("../db");
const isAuthenticated = require("../middleware/auth");

/*
====================================
PROFILE SETTINGS (Authenticated)
====================================
*/

router.get("/settings", isAuthenticated, async (req, res, next) => {
  try {
    const result = await db.query(
      `
      SELECT id, username, email, is_public, bio, avatar_url, username_changed
      FROM users
      WHERE id = $1
      `,
      [req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).render("404", {
        pageTitle: "Not Found",
        message: "User not found."
      });
    }

    res.render("settings", {
      pageTitle: "Profile Settings",
      userProfile: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

router.put("/settings", isAuthenticated, async (req, res, next) => {
  try {
    const { bio, avatar_url, is_public } = req.body;

    await db.query(
      `
      UPDATE users
      SET
        bio = $1,
        avatar_url = $2,
        is_public = $3
      WHERE id = $4
      `,
      [
        String(bio || "").trim(),
        String(avatar_url || "").trim(),
        is_public === "on" || is_public === "true",
        req.session.userId
      ]
    );

    req.session.notice = {
      type: "success",
      title: "Settings updated",
      message: "Your profile settings have been saved."
    };

    res.redirect("/settings");
  } catch (err) {
    next(err);
  }
});

router.put("/settings/username", isAuthenticated, async (req, res, next) => {
  try {
    const { username } = req.body;
    const cleanUsername = String(username || "").trim();

    if (!cleanUsername || cleanUsername.length < 3 || !/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      req.session.notice = {
        type: "danger",
        title: "Invalid Username",
        message: "Username must be at least 3 characters and contain only letters, numbers, and underscores."
      };
      return res.redirect("/settings");
    }

    // Check if user has already changed their username
    const userResult = await db.query(
      `SELECT username_changed FROM users WHERE id = $1`,
      [req.session.userId]
    );

    if (userResult.rows[0].username_changed) {
      req.session.notice = {
        type: "danger",
        title: "Action Denied",
        message: "You have already changed your username once."
      };
      return res.redirect("/settings");
    }

    // Check if username is taken
    const existingResult = await db.query(
      `SELECT id FROM users WHERE username = $1 AND id != $2`,
      [cleanUsername, req.session.userId]
    );

    if (existingResult.rows.length > 0) {
      req.session.notice = {
        type: "danger",
        title: "Username Taken",
        message: "That username is already in use by another account."
      };
      return res.redirect("/settings");
    }

    // Update username
    await db.query(
      `UPDATE users SET username = $1, username_changed = true WHERE id = $2`,
      [cleanUsername, req.session.userId]
    );

    req.session.userName = cleanUsername;
    req.session.notice = {
      type: "success",
      title: "Username Updated",
      message: "Your username has been successfully changed."
    };

    res.redirect("/settings");
  } catch (err) {
    next(err);
  }
});

/*
====================================
PUBLIC PROFILE (Unauthenticated)
====================================
*/

router.get("/u/:username", async (req, res, next) => {
  try {
    // 1. Fetch user by username and ensure they are public
    const userResult = await db.query(
      `
      SELECT id, username, bio, avatar_url, is_public, created_at
      FROM users
      WHERE username = $1
      `,
      [req.params.username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).render("404", {
        pageTitle: "Profile Not Found",
        message: "We couldn't find a user with that username."
      });
    }

    const profileUser = userResult.rows[0];

    // If profile is private, and it's NOT the logged-in user viewing their own profile
    if (!profileUser.is_public && profileUser.id !== req.session.userId) {
      return res.status(403).render("404", {
        pageTitle: "Private Profile",
        message: "This profile is private."
      });
    }

    // 2. Fetch public books for this user
    // Only fetch books where visibility = 'public' and deleted_at is null
    const activeStatus = req.query.status || 'all';
    
    let statusCondition = '';
    const queryParams = [profileUser.id];
    
    if (['read', 'currently_reading', 'want_to_read', 'dnf'].includes(activeStatus)) {
      statusCondition = 'AND status = $2';
      queryParams.push(activeStatus);
    }

    const booksResult = await db.query(
      `
      SELECT id, title, author, rating, date_read, cover_url, review, has_spoilers, status
      FROM books
      WHERE user_id = $1
      AND deleted_at IS NULL
      AND visibility = 'public'
      ${statusCondition}
      ORDER BY date_read DESC NULLS LAST, created_at DESC
      `,
      queryParams
    );

    const books = booksResult.rows;

    // 3. Stats for public profile
    const totalBooks = books.length;
    const avgRating = totalBooks > 0
      ? (books.reduce((acc, b) => acc + (b.rating || 0), 0) / books.filter(b => b.rating).length).toFixed(1)
      : 0;

    // 4. Follows
    const followersResult = await db.query(
      `SELECT COUNT(*) as count FROM follows WHERE following_id = $1`,
      [profileUser.id]
    );
    const followingResult = await db.query(
      `SELECT COUNT(*) as count FROM follows WHERE follower_id = $1`,
      [profileUser.id]
    );
    
    let isFollowing = false;
    if (req.session.userId && req.session.userId !== profileUser.id) {
      const isFollowingResult = await db.query(
        `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
        [req.session.userId, profileUser.id]
      );
      isFollowing = isFollowingResult.rows.length > 0;
    }

    res.render("public-profile", {
      pageTitle: `${profileUser.username}'s Library`,
      profileUser,
      books,
      totalBooks,
      avgRating,
      followersCount: parseInt(followersResult.rows[0].count, 10),
      followingCount: parseInt(followingResult.rows[0].count, 10),
      isFollowing,
      activeStatus
    });

  } catch (err) {
    next(err);
  }
});

/*
====================================
PUBLIC REVIEW (Unauthenticated)
====================================
*/

router.get("/u/:username/review/:id", async (req, res, next) => {
  try {
    // 1. Verify user is public (or it's the owner)
    const userResult = await db.query(
      `
      SELECT id, username, avatar_url, is_public
      FROM users
      WHERE username = $1
      `,
      [req.params.username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).render("404", {
        pageTitle: "Not Found",
        message: "User not found."
      });
    }

    const profileUser = userResult.rows[0];

    if (!profileUser.is_public && profileUser.id !== req.session.userId) {
      return res.status(403).render("404", {
        pageTitle: "Private Review",
        message: "This profile is private."
      });
    }

    // 2. Fetch book
    const bookResult = await db.query(
      `
      SELECT *
      FROM books
      WHERE id = $1
      AND user_id = $2
      AND deleted_at IS NULL
      AND visibility = 'public'
      `,
      [req.params.id, profileUser.id]
    );

    if (bookResult.rows.length === 0) {
      return res.status(404).render("404", {
        pageTitle: "Review Not Found",
        message: "That review could not be found or is private."
      });
    }

    const book = bookResult.rows[0];

    // Fetch tags for the book as well
    const tagsResult = await db.query(
      `SELECT t.name
       FROM tags t
       JOIN book_tags bt ON bt.tag_id = t.id
       WHERE bt.book_id = $1
       ORDER BY t.name`,
      [book.id]
    );
    const tags = tagsResult.rows.map(r => r.name);

    res.render("public-review", {
      pageTitle: `Review of ${book.title} by ${profileUser.username}`,
      profileUser,
      book,
      tags
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
