# BookVault Social & Organization Expansion Plan

This document outlines the phase-wise implementation roadmap for adding advanced organization and social networking features to BookVault.

## Overview of New Features
- Custom Tags & Categories
- Favorites List
- Spoiler-tagged reviews
- Social Profiles & Shareable Reviews
- Public or private shelves
- Follow friends
- Activity feed

---

## Phase 9 — Organization & Review Enhancements
**Focus:** Giving users better tools to organize their own libraries and write more nuanced reviews before introducing the social layer.

### 1. Favorites List
- **Database**: Add an `is_favorite` boolean column to the `books` table (default `false`).
- **UI/UX**: Add a "Heart" toggle button on book cards and the book details page.
- **Functionality**: Update the library dashboard to include a "Favorites" filter to quickly view all-time favorite reads.

### 2. Custom Tags & Categories
- **Database**: Create a `tags` table and a `book_tags` join table for many-to-many relationships, allowing users to define their own tags (e.g., `#sci-fi`, `#summer-read`, `#dnf`).
- **UI/UX**: Add a tag input field with autocomplete to the Add/Edit book forms. Display tags as visual pills on book cards.
- **Functionality**: Allow filtering the main library view by one or multiple tags.

### 3. Spoiler-Tagged Reviews
- **Database**: Add a `has_spoilers` boolean column to the `books` table.
- **UI/UX**: Add a checkbox on the review form: "This review contains spoilers".
- **Functionality**: On the book details page (and future public pages), visually blur or hide the review text if the flag is true, requiring a click to reveal.

---

## Phase 10 — Public Profiles & Privacy
**Focus:** Establishing the foundation for the social network by giving users a public face and granular control over their data privacy.

### 1. Social Profiles
- **Database**: Add `is_public` (boolean), `bio` (text), and `avatar_url` (text) to the `users` table. Ensure usernames are strictly unique and URL-safe.
- **UI/UX**: Create a new settings page for users to update their bio, avatar, and toggle their profile visibility.
- **Functionality**: Generate a public-facing URL (e.g., `bookvault.app/u/username`) that displays a user's library and stats if their profile is public.

### 2. Public vs. Private Shelves
- **Database**: Add a `visibility` enum/string column to the `books` table (e.g., `public`, `private`).
- **Functionality**: Allow users with public profiles to keep specific "guilty pleasure" reads or private notes hidden from their public feed.
- **UI/UX**: Add a visibility toggle during the Add/Edit book flow.

### 3. Shareable Book Reviews
- **Functionality**: Create a dedicated, unauthenticated route for single book reviews (e.g., `/u/username/review/book-id`).
- **UI/UX**: Add "Share" buttons (copy link, Twitter, etc.) to book detail pages for public books, generating meta tags for rich link previews in messaging apps.

---

## Phase 11 — Connections & Activity Feed
**Focus:** Connecting users together and driving engagement through a dynamic feed of reading updates.

### 1. Follow Friends
- **Database**: Create a `follows` join table mapping `follower_id` to `following_id`.
- **Functionality**: Allow users to follow/unfollow other public profiles.
- **UI/UX**: Show follower/following counts on public profiles. Add a "Follow" button to user profiles.

### 2. Activity Feed
- **Database**: Create an `activities` table to track events (e.g., "User added a book", "User wrote a review", "User hit their reading goal"), OR dynamically generate the feed by querying the `books` table based on followed users.
- **UI/UX**: Create a new "Community" or "Feed" tab in the main navigation.
- **Functionality**: Display a chronologically sorted feed of recent activity from followed users. Include basic interactions like "Liking" an activity item.

---

## Technical Considerations & Prerequisites

- **Database Migrations**: Each phase will require thoughtful PostgreSQL migrations. Relationships (many-to-many for tags and followers) will require indexing for performance.
- **Privacy First**: By default, all profiles and shelves should remain private unless explicitly opted-in by the user to prevent accidental data sharing.
- **Query Optimization**: The Activity Feed (Phase 11) will require optimized SQL queries to aggregate recent actions from multiple users without slowing down the application.
