require("dotenv").config();
const passport = require("./config/passport");
const express = require("express");
const methodOverride = require("method-override");
const session = require("express-session");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(methodOverride("_method"));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.userId = req.session.userId;
  res.locals.userName = req.session.userName;
  res.locals.currentPath = req.path;
  res.locals.pageTitle = "BookVault";
  res.locals.notice =
    req.session.notice || null;
  delete req.session.notice;
  next();
});

app.use((req, res, next) => {
  const hour = new Date().getHours();

  if (hour < 12) {
    res.locals.greeting = "Good Morning";
  } else if (hour < 18) {
    res.locals.greeting = "Good Afternoon";
  } else {
    res.locals.greeting = "Good Evening";
  }

  next();
});

app.set("view engine", "ejs");

const authRoutes = require("./routes/auth");
const bookRoutes = require("./routes/books");

app.use("/", authRoutes);
app.use("/", bookRoutes);

app.use((req, res) => {
  res.status(404).render("404", {
    pageTitle: "Page Not Found",
    message:
      "The page you requested could not be found."
  });
});

app.use((err, req, res, next) => {
  console.error(err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).render("error", {
    pageTitle: "Something Went Wrong",
    message:
      "Something went wrong while processing your request."
  });
});

if (require.main === module) {
  app.listen(process.env.PORT || 3000, () => {
    console.log("Server Running");
  });
}

module.exports = app;
