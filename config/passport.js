const passport =
require("passport");

const GoogleStrategy =
require("passport-google-oauth20")
.Strategy;

const db =
require("../db");

passport.use(

new GoogleStrategy(

{
clientID:
process.env.GOOGLE_CLIENT_ID,

clientSecret:
process.env.GOOGLE_CLIENT_SECRET,

callbackURL: process.env.GOOGLE_CALLBACK_URL

},

async (
accessToken,
refreshToken,
profile,
done
)=>{

try{

let existingUser =
await db.query(
`
SELECT *
FROM users
WHERE google_id = $1
`,
[
profile.id
]
);

if(
existingUser.rows.length > 0
){

return done(
null,
existingUser.rows[0]
);

}

const email =
profile.emails[0].value;

let emailUser =
await db.query(
`
SELECT *
FROM users
WHERE email = $1
`,
[
email
]
);

if(
emailUser.rows.length > 0
){

const updated =
await db.query(
`
UPDATE users
SET google_id=$1
WHERE id=$2
RETURNING *
`,
[
profile.id,
emailUser.rows[0].id
]
);

return done(
null,
updated.rows[0]
);

}

const newUser =
await db.query(
`
INSERT INTO users
(
 google_id,
 username,
 email
)
VALUES
(
 $1,$2,$3
)
RETURNING *
`,
[
profile.id,
profile.displayName,
email
]
);

done(
null,
newUser.rows[0]
);

}catch(err){

done(err);

}

}
));

passport.serializeUser(
(user,done)=>{

done(
null,
user.id
);

}
);

passport.deserializeUser(
async(id,done)=>{

try{

const result =
await db.query(
`
SELECT *
FROM users
WHERE id=$1
`,
[id]
);

done(
null,
result.rows[0]
);

}catch(err){

done(err);

}

}
);

module.exports = passport;