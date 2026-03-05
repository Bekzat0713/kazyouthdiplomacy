require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const app = express();
const PORT = 3000;

/* ======================
   PostgreSQL
====================== */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.connect()
  .then(() => console.log("PostgreSQL connected"))
  .catch((err) => console.error("DB connection error:", err));

/* ======================
   Middleware
====================== */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

app.use(express.static(path.join(__dirname, "public")));

/* ======================
   Init Tables
====================== */

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ambassadors (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE,
        name TEXT,
        region TEXT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE,
        active BOOLEAN
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        phone TEXT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration for old schema versions where users had phone/password but no email.
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email TEXT
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'phone'
            AND is_nullable = 'NO'
        ) THEN
          ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
        END IF;
      END $$;
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
      ON users (email)
      WHERE email IS NOT NULL
    `);

    console.log("Tables ready");
  } catch (err) {
    console.error("DB Init Error:", err);
  }
}

initDB();

/* ======================
   Auth Helpers
====================== */

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  return next();
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function saveSessionAndRedirect(req, res, user, targetPath) {
  req.session.regenerate((regenErr) => {
    if (regenErr) {
      console.error("Session regenerate error:", regenErr);
      return res.redirect("/login?error=session");
    }

    req.session.userId = user.id;
    req.session.email = user.email;

    return req.session.save((saveErr) => {
      if (saveErr) {
        console.error("Session save error:", saveErr);
        return res.redirect("/login?error=session");
      }
      return res.redirect(targetPath);
    });
  });
}

/* ======================
   Routes
====================== */

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "web.html"))
);

app.get("/about", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "about.html"))
);

app.get("/login", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);

app.get("/register", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "register.html"))
);

app.get("/subscribe", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "subscribe.html"))
);

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

/* ======================
   REGISTER
====================== */

app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password || password.length < 6) {
    console.warn("Register failed: invalid input");
    return res.redirect("/register?error=invalid");
  }

  try {
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (existing.rows.length > 0) {
      console.warn("Register failed: email exists", normalizedEmail);
      return res.redirect("/register?error=exists");
    }

    const hashed = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
      [normalizedEmail, hashed]
    );

    const user = result.rows[0];
    return saveSessionAndRedirect(req, res, user, "/internships");
  } catch (err) {
    console.error("Register server error:", err);
    return res.redirect("/register?error=server");
  }
});

/* ======================
   LOGIN
====================== */

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    console.warn("Login failed: invalid input");
    return res.redirect("/login?error=invalid");
  }

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      console.warn("Login failed: user not found", normalizedEmail);
      return res.redirect("/login?error=user");
    }

    const user = result.rows[0];
    let match = false;

    // Backward compatibility: if old records have plain text passwords, allow login once and migrate.
    try {
      match = await bcrypt.compare(password, user.password);
    } catch (compareErr) {
      match = password === user.password;
      if (match) {
        const upgradedHash = await bcrypt.hash(password, 10);
        await pool.query("UPDATE users SET password = $1 WHERE id = $2", [upgradedHash, user.id]);
      }
    }

    if (!match) {
      console.warn("Login failed: wrong password", normalizedEmail);
      return res.redirect("/login?error=password");
    }

    return saveSessionAndRedirect(req, res, user, "/internships");
  } catch (err) {
    console.error("Login server error:", err);
    return res.redirect("/login?error=server");
  }
});

/* ======================
   LOGOUT
====================== */

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

/* ======================
   Protected Pages
====================== */

app.get("/dashboard", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "dashboard.html"))
);

app.get("/internships", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "internships.html"))
);

app.get("/internships.html", requireAuth, (req, res) =>
  res.redirect("/internships")
);

/* ======================
   DEBUG ROUTE (TEMP)
====================== */

app.get("/debug-users", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, role, created_at FROM users ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Debug error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

/* ======================
   Start Server
====================== */

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
