const express = require("express");
const router = express.Router();

const bcrypt = require("bcrypt");
const db = require("../db");

/*
=========================
REGISTER PAGE
=========================
*/

router.get("/register", (req, res) => {
  res.render("register");
});

/*
=========================
REGISTER USER
=========================
*/

router.post("/register", async (req, res) => {
  try {
    const {
      username,
      email,
      password
    } = req.body;

    const hashedPassword =
      await bcrypt.hash(password, 10);

    await db.query(
      `
      INSERT INTO users
      (username,email,password)
      VALUES($1,$2,$3)
      `,
      [
        username,
        email,
        hashedPassword
      ]
    );

    res.redirect("/login");

  } catch (err) {
    console.error(err);
    res.send("Registration failed");
  }
});

/*
=========================
LOGIN PAGE
=========================
*/

router.get("/login", (req, res) => {
  res.render("login");
});

/*
=========================
LOGIN USER
=========================
*/

router.post("/login", async (req, res) => {

  try {

    const {
      email,
      password
    } = req.body;

    const result =
      await db.query(
        `
        SELECT *
        FROM users
        WHERE email = $1
        `,
        [email]
      );

    if (result.rows.length === 0) {
      return res.send("User not found");
    }

    const user =
      result.rows[0];

    const validPassword =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!validPassword) {
      return res.send(
        "Invalid password"
      );
    }

    req.session.userId =
      user.id;

    req.session.username =
      user.username;

    res.redirect("/");

  } catch (err) {

    console.error(err);

    res.send("Login failed");

  }

});

/*
=========================
LOGOUT
=========================
*/

router.get("/logout", (req, res) => {

  req.session.destroy(() => {

    res.redirect("/login");

  });

});

module.exports = router;