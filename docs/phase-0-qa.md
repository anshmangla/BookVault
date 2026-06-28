# Phase 0 QA Checklist

Run this checklist at desktop, tablet, and mobile widths in both light and dark themes.

## Authentication

- Register a new account.
- Log in with valid credentials.
- Confirm invalid credentials show a friendly message.
- Log in with Google.
- Log out and confirm protected pages redirect to `/login`.

## Library

- Load an empty library.
- Load a library containing rated and unrated books.
- Confirm the average rating excludes unrated books.
- Confirm Highest Rated is empty when no books have ratings.
- Search by title and author.
- Sort by rating and recently read.

## Book management

- Add a book with all fields.
- Add a book with only its required title.
- Open its details page.
- Edit every field and confirm the changes persist.
- Delete a book and confirm it disappears.
- Confirm a book belonging to another user cannot be viewed, edited, or deleted.

## Failure states

- Visit an unknown URL and confirm the 404 page is shown.
- Visit a missing book ID and confirm the 404 page is shown.
- Simulate a database failure and confirm the 500 page is shown without exposing technical details.
- Simulate a Google Books failure and confirm manual book entry remains possible.

## Visual checks

- Check navigation wrapping and collapse behavior.
- Check forms for clipping or horizontal scrolling.
- Check book covers and missing-cover placeholders.
- Check keyboard focus visibility.
- Check that all visible symbols render correctly.
