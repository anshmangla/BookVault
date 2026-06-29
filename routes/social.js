const express = require("express");
const router = express.Router();
const db = require("../db");
const isAuthenticated = require("../middleware/auth");

/*
====================================
FOLLOW USER
====================================
*/

router.post("/u/:username/follow", isAuthenticated, async (req, res, next) => {
  try {
    // 1. Get the target user ID
    const userResult = await db.query(
      `SELECT id FROM users WHERE username = $1`,
      [req.params.username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const targetUserId = userResult.rows[0].id;

    if (targetUserId === req.session.userId) {
      return res.status(400).json({ error: "You cannot follow yourself" });
    }

    // 2. Toggle follow status
    const existingFollow = await db.query(
      `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
      [req.session.userId, targetUserId]
    );

    let isFollowing = false;

    if (existingFollow.rows.length > 0) {
      // Unfollow
      await db.query(
        `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`,
        [req.session.userId, targetUserId]
      );
    } else {
      // Follow
      await db.query(
        `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)`,
        [req.session.userId, targetUserId]
      );
      isFollowing = true;
    }

    res.json({ is_following: isFollowing });
  } catch (err) {
    next(err);
  }
});

/*
====================================
ACTIVITY FEED
====================================
*/

router.get("/feed", isAuthenticated, async (req, res, next) => {
  try {
    // Fetch activities from users the current user follows
    const feedResult = await db.query(
      `
      SELECT 
        a.id as activity_id, 
        a.action_type, 
        a.created_at as activity_date,
        u.username,
        u.avatar_url,
        b.id as book_id,
        b.title,
        b.author,
        b.cover_url,
        b.review,
        b.rating,
        b.has_spoilers,
        COALESCE(al.likes_count, 0) as likes_count,
        CASE WHEN ul.user_id IS NOT NULL THEN true ELSE false END as user_liked
      FROM activities a
      JOIN users u ON a.user_id = u.id
      JOIN books b ON a.book_id = b.id
      JOIN follows f ON f.following_id = a.user_id
      LEFT JOIN (
        SELECT activity_id, COUNT(*) as likes_count
        FROM activity_likes
        GROUP BY activity_id
      ) al ON al.activity_id = a.id
      LEFT JOIN activity_likes ul ON ul.activity_id = a.id AND ul.user_id = $1
      WHERE f.follower_id = $1
      AND b.deleted_at IS NULL
      AND b.visibility = 'public'
      ORDER BY a.created_at DESC
      LIMIT 50
      `,
      [req.session.userId]
    );

    res.render("feed", {
      pageTitle: "Activity Feed",
      activities: feedResult.rows
    });
  } catch (err) {
    next(err);
  }
});

/*
====================================
LIKE ACTIVITY
====================================
*/

router.post("/activity/:id/like", isAuthenticated, async (req, res, next) => {
  try {
    const activityId = parseInt(req.params.id, 10);
    
    const existingLike = await db.query(
      `SELECT 1 FROM activity_likes WHERE user_id = $1 AND activity_id = $2`,
      [req.session.userId, activityId]
    );

    let isLiked = false;

    if (existingLike.rows.length > 0) {
      await db.query(
        `DELETE FROM activity_likes WHERE user_id = $1 AND activity_id = $2`,
        [req.session.userId, activityId]
      );
    } else {
      await db.query(
        `INSERT INTO activity_likes (user_id, activity_id) VALUES ($1, $2)`,
        [req.session.userId, activityId]
      );
      isLiked = true;
    }

    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM activity_likes WHERE activity_id = $1`,
      [activityId]
    );

    res.json({ 
      is_liked: isLiked, 
      likes_count: parseInt(countResult.rows[0].count, 10) 
    });
  } catch (err) {
    next(err);
  }
});

/*
====================================
SEARCH USERS
====================================
*/

router.get("/community/search", isAuthenticated, async (req, res, next) => {
  try {
    const query = String(req.query.q || "").trim();
    let users = [];

    if (query) {
      const searchResult = await db.query(
        `
        SELECT 
          u.id, 
          u.username, 
          u.avatar_url, 
          u.bio,
          EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.following_id = u.id) as is_following
        FROM users u
        WHERE u.is_public = true
        AND u.id != $1
        AND u.username ILIKE $2
        ORDER BY u.username ASC
        LIMIT 50
        `,
        [req.session.userId, `%${query}%`]
      );
      users = searchResult.rows;
    }

    res.render("find-users", {
      pageTitle: "Find Friends",
      searchQuery: query,
      users
    });
  } catch (err) {
    next(err);
  }
});

/*
====================================
CONNECTIONS
====================================
*/

router.get("/u/:username/followers", async (req, res, next) => {
  try {
    const userResult = await db.query(
      `SELECT id, username, is_public FROM users WHERE username = $1`,
      [req.params.username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).render("404", { pageTitle: "Not Found", message: "User not found." });
    }

    const profileUser = userResult.rows[0];

    if (!profileUser.is_public && profileUser.id !== req.session.userId) {
      return res.status(403).render("404", { pageTitle: "Private Profile", message: "This profile is private." });
    }

    const followersResult = await db.query(
      `
      SELECT 
        u.id, 
        u.username, 
        u.avatar_url, 
        u.bio,
        EXISTS(SELECT 1 FROM follows f2 WHERE f2.follower_id = $2 AND f2.following_id = u.id) as is_following
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = $1
      ORDER BY u.username ASC
      `,
      [profileUser.id, req.session.userId || -1]
    );

    res.render("connections", {
      pageTitle: `${profileUser.username}'s Followers`,
      profileUser,
      activeTab: "followers",
      users: followersResult.rows
    });
  } catch (err) {
    next(err);
  }
});

router.get("/u/:username/following", async (req, res, next) => {
  try {
    const userResult = await db.query(
      `SELECT id, username, is_public FROM users WHERE username = $1`,
      [req.params.username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).render("404", { pageTitle: "Not Found", message: "User not found." });
    }

    const profileUser = userResult.rows[0];

    if (!profileUser.is_public && profileUser.id !== req.session.userId) {
      return res.status(403).render("404", { pageTitle: "Private Profile", message: "This profile is private." });
    }

    const followingResult = await db.query(
      `
      SELECT 
        u.id, 
        u.username, 
        u.avatar_url, 
        u.bio,
        EXISTS(SELECT 1 FROM follows f2 WHERE f2.follower_id = $2 AND f2.following_id = u.id) as is_following
      FROM follows f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = $1
      ORDER BY u.username ASC
      `,
      [profileUser.id, req.session.userId || -1]
    );

    res.render("connections", {
      pageTitle: `People ${profileUser.username} Follows`,
      profileUser,
      activeTab: "following",
      users: followingResult.rows
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
