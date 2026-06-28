const express = require("express");
const passport = require("passport");
const router = express.Router();

const bcrypt = require("bcrypt");
const db = require("../db");

/*
=========================
REGISTER PAGE
=========================
*/

router.get("/register", (req, res) => {
  res.render("register", {
    pageTitle: "Create Account"
  });
});

/*
=========================
REGISTER USER
=========================
*/

router.post("/register", async (req, res, next) => {
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
    next(err);
  }
});

/*
=========================
LOGIN PAGE
=========================
*/

router.get("/login", (req, res) => {
  res.render("login", {
    pageTitle: "Log In"
  });
});

/*
=========================
LOGIN USER
=========================
*/

router.post("/login", async (req, res, next) => {

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
      return res.status(401).render(
        "login",
        {
          pageTitle: "Log In",
          error:
            "The email or password is incorrect."
        }
      );
    }

    const user =
      result.rows[0];

    const validPassword =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!validPassword) {
      return res.status(401).render(
        "login",
        {
          pageTitle: "Log In",
          error:
            "The email or password is incorrect."
        }
      );
    }

    req.session.userId =
      user.id;

    req.session.userName =
      user.username;

    res.redirect("/");

  } catch (err) {
    next(err);

  }

});

/*
=========================
GOOGLE LOGIN
=========================
*/

router.get(
  "/auth/google",
  
  passport.authenticate(
  "google",
  {
  scope:[
  "profile",
  "email"
  ]
  }
  )
  
  );

  router.get(

    "/auth/google/callback",
    
    passport.authenticate(
    "google",
    {
    failureRedirect:
    "/login"
    }
    ),
    
    (req,res)=>{
    
    req.session.userId =
    req.user.id;
    
    req.session.userName =
    req.user.username;
    
    res.redirect("/");
    
    }
    
    );

/*
=========================
LOGOUT
=========================
*/

router.get(
  "/logout",
  (req,res,next)=>{
  
  req.logout(
  (err)=>{
  
  if(err){
  
  return next(err);
  
  }
  
  req.session.destroy(
  ()=>{
  
  res.redirect(
  "/login"
  );
  
  });
  
  });
  
  });

  module.exports = router;
