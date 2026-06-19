const express = require("express");
const methodOverride = require("method-override");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(methodOverride("_method"));

app.set("view engine", "ejs");

const bookRoutes = require("./routes/books");

app.use("/", bookRoutes);

app.listen(process.env.PORT || 3000, () => {
  console.log("Server Running");
});

app.use((req,res)=>{
    res.status(404).render("404");
});