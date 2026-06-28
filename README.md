# 📚 BookVault

A full-stack book tracking and review platform that helps readers organize their personal library, store notes, write reviews, and track reading history. BookVault retrieves book metadata and covers using the Google Books API and stores user data in PostgreSQL.

## 🚀 Live Demo

**Live Application:** https://bookvault-elmm.onrender.com/

**GitHub Repository:** https://github.com/anshmangla/BookVault

---

## 📖 Overview

BookVault is a personal reading companion inspired by online book journals. Users can maintain a collection of books they have read, record notes and reviews, assign ratings, and browse their reading history through a clean and responsive interface.

The application integrates with the Google Books API to retrieve titles, authors, ISBNs, publication details, descriptions, categories, and cover images.

---

## ✨ Features

### Book Management

* Add books to your personal library
* Edit book information, ratings, notes, and reviews
* Delete books from your collection
* Store ISBN information
* Track reading dates

### Search & Sorting

* Search books by title
* Search books by author
* Sort books by rating
* Sort books by recently read
* View all books in a responsive card layout

### Google Books API Integration

* Searches the Google Books catalog
* Imports normalized book metadata and cover images
* Handles missing fields and cover images gracefully
* Keeps the Google Books API key on the server

### Analytics Dashboard

* Total books count
* Average rating across all books
* Top-rated book display

### User Experience

* Responsive Bootstrap UI
* Dark Mode support
* Mobile-friendly design
* Persistent theme preferences using Local Storage

---

## 🛠️ Tech Stack

### Frontend

* HTML5
* CSS3
* Bootstrap 5
* JavaScript
* EJS

### Backend

* Node.js
* Express.js

### Database

* PostgreSQL
* Neon Database

### APIs

* Google Books API

### Deployment

* Render

---

## 🏗️ Project Architecture

```text
Client Browser
      │
      ▼
Express.js Server
      │
      ├── EJS Templates
      │
      ├── Google Books API
      │
      ▼
PostgreSQL (Neon)
```

---

## 📂 Project Structure

```text
BookVault/
│
├── public/
│   ├── css/
│   │   └── style.css
│
├── views/
│   ├── partials/
│   │   ├── header.ejs
│   │   └── footer.ejs
│   │
│   ├── index.ejs
│   ├── add.ejs
│   ├── edit.ejs
│   └── 404.ejs
│
├── routes/
│   └── books.js
│
├── db.js
├── app.js
├── package.json
├── .env
└── README.md
```

---

## 🗄️ Database Schema

```sql
CREATE TABLE books (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255),
  isbn VARCHAR(30),
  rating INTEGER CHECK(rating BETWEEN 1 AND 10),
  notes TEXT,
  review TEXT,
  cover_url TEXT,
  google_volume_id TEXT,
  subtitle TEXT,
  publisher TEXT,
  published_date TEXT,
  description TEXT,
  page_count INTEGER,
  categories TEXT[],
  language VARCHAR(16),
  date_read DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## ⚙️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/bookvault.git
cd bookvault
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL=your_neon_database_url
SESSION_SECRET=your_session_secret
GOOGLE_BOOKS_API_KEY=your_google_books_api_key
PORT=3000
```

### 4. Start the Application

Development Mode:

```bash
npm run dev
```

Production Mode:

```bash
npm start
```

### 5. Open in Browser

```text
http://localhost:3000
```

---

## 🔌 API Used

### Google Books API

Used to search for books and import normalized metadata.

Example:

```http
GET https://www.googleapis.com/books/v1/volumes?q=Atomic%20Habits&printType=books
```

The API key is stored as `GOOGLE_BOOKS_API_KEY` and requests are proxied through BookVault’s authenticated server endpoints.

---

## 📸 Screenshots

### Home Page


<img width="1917" height="913" alt="image" src="https://github.com/user-attachments/assets/b52eef29-628a-4703-bea5-0c3fd146fe46" />


### Add Book Page


<img width="1335" height="905" alt="image" src="https://github.com/user-attachments/assets/1cb8bfdd-1a60-4b0c-be91-e66d278fbbba" />


### Dark Mode


<img width="1919" height="916" alt="image" src="https://github.com/user-attachments/assets/4dd0b1d4-0f28-41ad-803d-ae0b992e6cc2" />


---

## 🎯 Learning Outcomes

This project demonstrates:

* RESTful CRUD operations
* PostgreSQL database integration
* Express.js server-side development
* EJS templating
* API consumption using Axios
* Environment variable management
* Deployment on Render
* Responsive UI design
* Error handling and validation

---

## 🔮 Future Improvements

* User Authentication
* Personal Reading Goals
* Reading Streak Tracking
* Author Statistics
* Reading Analytics Dashboard
* Pagination
* Book Categories and Tags
* Favorites List
* Export Reading History
* Multi-user Support

---

## 👨‍💻 Author

**Ansh Mangla**

B.Tech (Artificial Intelligence & Machine Learning)

Passionate about AI, Machine Learning, Generative AI, and Full-Stack Development.

GitHub: https://github.com/anshmangla

LinkedIn: https://linkedin.com/in/anshmangla

---

## 📜 License

This project is developed for educational and portfolio purposes.
