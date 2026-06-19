require("dotenv").config();
const express = require("express");
const methodOverride = require("method-override");
const session = require("express-session");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(methodOverride("_method"));

app.use(
  session({
   secret:
    process.env.SESSION_SECRET,
 
   resave:false,
   saveUninitialized:false
  })
 );

 app.use((req, res, next) => {
  res.locals.userId = req.session.userId;
  next();
});

app.set("view engine", "ejs");

const authRoutes = require("./routes/auth");
const bookRoutes = require("./routes/books");

app.use("/", authRoutes);
app.use("/", bookRoutes);

app.listen(process.env.PORT || 3000, () => {
  console.log("Server Running");
});

app.use((req,res)=>{
    res.status(404).render("404");
});