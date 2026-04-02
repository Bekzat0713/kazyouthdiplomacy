require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const helmet = require("helmet");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === "production";
const databaseUrl = String(process.env.DATABASE_URL || "");
const shouldUseDbSsl =
  isProduction ||
  String(process.env.PGSSLMODE || "").toLowerCase() === "require" ||
  databaseUrl.includes("render.com");

const KASPI_MERCHANT_ID = String(process.env.KASPI_MERCHANT_ID || "");
const KASPI_API_KEY = String(process.env.KASPI_API_KEY || "");
const KASPI_CALLBACK_URL = String(process.env.KASPI_CALLBACK_URL || "");

const preRegisterSurveyOptionSets = {
  current_status: new Set(["school", "university", "working", "study_and_work"]),
  age_group: new Set(["under_17", "18_20", "21_23", "24_30", "30_plus"]),
  main_goal: new Set([
    "study_abroad",
    "masters",
    "civil_service",
    "international_org",
    "national_company",
    "private_sector",
    "undecided",
  ]),
  goal_clarity: new Set(["none", "roughly", "partially", "clear"]),
  main_blocker: new Set([
    "dont_know_start",
    "too_much_info",
    "no_experience",
    "lack_skills",
    "low_confidence",
    "procrastination",
  ]),
  current_experience: new Set([
    "none",
    "little",
    "internships_or_projects",
    "already_working_in_field",
  ]),
  english_level: new Set(["a1_a2", "b1_b2", "c1_plus"]),
  discovery_channels: new Set([
    "telegram",
    "instagram",
    "tiktok",
    "google_sites",
    "friends",
  ]),
  needs_action_plan: new Set(["yes_very", "rather_yes", "not_sure", "no"]),
};

if (!databaseUrl) {
  console.error("DATABASE_URL is not configured");
  process.exit(1);
}


/* ======================
   PostgreSQL
====================== */

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: shouldUseDbSsl ? { rejectUnauthorized: false } : undefined,
});

pool.connect()
  .then(() => console.log("PostgreSQL connected"))
  .catch((err) => console.error("DB connection error:", err));

/* ======================
   Middleware
====================== */

app.disable("x-powered-by");
if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    // Keep CSP off for now to avoid breaking inline styles/scripts in existing HTML.
    contentSecurityPolicy: false,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: process.env.SESSION_COOKIE_NAME || "kyd.sid",
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    proxy: isProduction,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
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
        email TEXT,
        active BOOLEAN DEFAULT false
      )
    `);

    await pool.query(`
      ALTER TABLE subscriptions
      ADD COLUMN IF NOT EXISTS user_id INTEGER,
      ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'monthly',
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS order_id TEXT,
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_unique ON subscriptions (user_id)
      WHERE user_id IS NOT NULL
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_order_id_unique ON subscriptions (order_id)
      WHERE order_id IS NOT NULL
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS registration_surveys (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        survey_payload JSONB NOT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS internships (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        organization TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        location TEXT NOT NULL,
        duration TEXT NOT NULL,
        apply_url TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const internshipsCount = await pool.query(
      "SELECT COUNT(*)::INT AS total FROM internships"
    );

    if (internshipsCount.rows[0].total === 0) {
      await pool.query(
        `
        INSERT INTO internships (title, organization, description, category, location, duration, apply_url)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7),
          ($8, $9, $10, $11, $12, $13, $14),
          ($15, $16, $17, $18, $19, $20, $21)
        `,
        [
          "Программа аналитической стажировки",
          "Министерство иностранных дел",
          "Работа с международными проектами, аналитическими справками и официальными документами.",
          "ministries",
          "Астана",
          "2 месяца",
          "",
          "Стажировка в отделе молодежных программ",
          "Акимат города Алматы",
          "Поддержка городских инициатив и участие в проектах для молодежи.",
          "akimats",
          "Алматы",
          "1 месяц",
          "",
          "Internship in Digital Policy",
          "Национальная компания",
          "Проектная работа в области цифровых решений и стратегической аналитики.",
          "quasi",
          "Онлайн",
          "3 месяца",
          "",
        ]
      );
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS opportunities (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        organization TEXT NOT NULL,
        summary TEXT NOT NULL,
        content_type TEXT NOT NULL,
        country TEXT NOT NULL,
        deadline TEXT,
        source_url TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      ALTER TABLE opportunities
      ADD COLUMN IF NOT EXISTS image_url TEXT
    `);

    const opportunitiesCount = await pool.query(
      "SELECT COUNT(*)::INT AS total FROM opportunities"
    );

    if (opportunitiesCount.rows[0].total === 0) {
      await pool.query(
        `
        INSERT INTO opportunities (
          title, organization, summary, content_type, country, deadline, source_url
        ) VALUES
          ($1, $2, $3, $4, $5, $6, $7),
          ($8, $9, $10, $11, $12, $13, $14),
          ($15, $16, $17, $18, $19, $20, $21),
          ($22, $23, $24, $25, $26, $27, $28)
        `,
        [
          "Global Youth Climate Grant 2026",
          "UN Climate Youth Initiative",
          "Funding for youth-led sustainability projects with mentorship and international visibility.",
          "grants",
          "Global",
          "Deadline: May 20, 2026",
          "https://www.un.org/",
          "Erasmus Mobility Scholarship",
          "Erasmus+",
          "Scholarship support for semester exchange and mobility in EU partner universities.",
          "scholarships",
          "European Union",
          "Deadline: June 15, 2026",
          "https://erasmus-plus.ec.europa.eu/",
          "Youth Diplomacy Forum Opened Registration",
          "KazYouthDiplomacy",
          "Annual forum gathers students, researchers and diplomats for policy dialogue sessions.",
          "news",
          "Kazakhstan",
          "Event date: July 12, 2026",
          "https://www.instagram.com/kazyouthdiplomacy",
          "How To Build A Strong Scholarship Portfolio",
          "KazYouthDiplomacy Editorial",
          "Practical article on motivation letters, recommendation strategy and profile positioning.",
          "articles",
          "Online",
          "Published: March 2026",
          "https://t.me/wydaopportunities",
        ]
      );
    }

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
    if (req.path.startsWith("/api/") || req.accepts("json")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.redirect("/login");
  }
  return next();
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

const OPPORTUNITIES_ADMIN_EMAIL = normalizeEmail(
  process.env.OPPORTUNITIES_ADMIN_EMAIL || "alibiayap@gmail.com"
);

function stripWrappingQuotes(value) {
  return String(value || "")
    .trim()
    .replace(/^["']+|["']+$/g, "");
}

function parseManagerEmails(rawValue) {
  return String(rawValue || "")
    .split(/[,\s;]+/)
    .map((email) => normalizeEmail(stripWrappingQuotes(email)))
    .filter(Boolean);
}

function getInternshipManagerEmails() {
  const emailSet = new Set();
  const candidates = [
    process.env.INTERNSHIP_MANAGER_EMAIL,
    process.env.INTERNSHIP_MANAGER_EMAILS,
    process.env.internship_manager_email,
    process.env.internship_manager_emails,
  ];

  for (const candidate of candidates) {
    for (const email of parseManagerEmails(candidate)) {
      emailSet.add(email);
    }
  }

  try {
    const envPath = path.join(__dirname, ".env");
    if (fs.existsSync(envPath)) {
      const envRaw = fs.readFileSync(envPath, "utf8");
      const parsed = require("dotenv").parse(envRaw);
      const fileCandidates = [
        parsed.INTERNSHIP_MANAGER_EMAIL,
        parsed.INTERNSHIP_MANAGER_EMAILS,
        parsed.internship_manager_email,
        parsed.internship_manager_emails,
      ];

      for (const candidate of fileCandidates) {
        for (const email of parseManagerEmails(candidate)) {
          emailSet.add(email);
        }
      }

      // Fallback: if the key in .env is accidentally left commented, still read it.
      if (emailSet.size === 0) {
        const commentedCandidates = [];
        for (const line of envRaw.split(/\r?\n/)) {
          const match = line.match(/^\s*#\s*(INTERNSHIP_MANAGER_EMAILS?|internship_manager_emails?)\s*=\s*(.+)\s*$/);
          if (match) {
            commentedCandidates.push(match[2]);
          }
        }

        for (const candidate of commentedCandidates) {
          for (const email of parseManagerEmails(candidate)) {
            emailSet.add(email);
          }
        }
      }
    }
  } catch (envReadError) {
    console.warn("Could not read .env for internship manager emails:", envReadError.message);
  }

  return emailSet;
}

async function canManageInternships(req) {
  const userId = req.session.userId;
  const sessionEmail = normalizeEmail(req.session.email);
  const sessionRole = String(req.session.role || "").toLowerCase();
  const internshipManagerEmails = getInternshipManagerEmails();

  if (internshipManagerEmails.size > 0 && sessionEmail) {
    return internshipManagerEmails.has(sessionEmail);
  }

  const result = await pool.query(
    "SELECT email, role FROM users WHERE id = $1",
    [userId]
  );
  if (result.rows.length === 0) {
    return false;
  }

  const user = result.rows[0];
  const userEmail = normalizeEmail(user.email);
  const userRole = String(user.role || "user").toLowerCase();

  if (internshipManagerEmails.size > 0) {
    return internshipManagerEmails.has(userEmail);
  }

  return sessionRole === "admin" || userRole === "admin";
}

function isOpportunitiesAdminEmail(email) {
  return normalizeEmail(email) === OPPORTUNITIES_ADMIN_EMAIL;
}

async function canManageOpportunities(req) {
  const userId = req.session.userId;
  const sessionEmail = normalizeEmail(req.session.email);

  if (sessionEmail && isOpportunitiesAdminEmail(sessionEmail)) {
    return true;
  }

  if (!userId) {
    return false;
  }

  const result = await pool.query(
    "SELECT email FROM users WHERE id = $1",
    [userId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  return isOpportunitiesAdminEmail(result.rows[0].email);
}

function saveSessionAndRedirect(req, res, user, targetPath) {
  req.session.regenerate((regenErr) => {
    if (regenErr) {
      console.error("Session regenerate error:", regenErr);
      return res.redirect("/login?error=session");
    }

    req.session.userId = user.id;
    req.session.email = normalizeEmail(user.email);
    req.session.role = user.role || "user";

    return req.session.save((saveErr) => {
      if (saveErr) {
        console.error("Session save error:", saveErr);
        return res.redirect("/login?error=session");
      }
      return res.redirect(targetPath);
    });
  });
}

function normalizeSurveyAnswer(value) {
  return String(value || "").trim();
}

function validatePreRegisterSurveyPayload(payload) {
  const normalized = {
    current_status: normalizeSurveyAnswer(payload.current_status),
    age_group: normalizeSurveyAnswer(payload.age_group),
    main_goal: normalizeSurveyAnswer(payload.main_goal),
    goal_clarity: normalizeSurveyAnswer(payload.goal_clarity),
    main_blocker: normalizeSurveyAnswer(payload.main_blocker),
    current_experience: normalizeSurveyAnswer(payload.current_experience),
    english_level: normalizeSurveyAnswer(payload.english_level),
    discovery_channels: Array.isArray(payload.discovery_channels)
      ? payload.discovery_channels.map(normalizeSurveyAnswer).filter(Boolean)
      : [],
    needs_action_plan: normalizeSurveyAnswer(payload.needs_action_plan),
  };

  for (const [key, allowedValues] of Object.entries(preRegisterSurveyOptionSets)) {
    if (key === "discovery_channels") {
      continue;
    }

    if (!allowedValues.has(normalized[key])) {
      return {
        ok: false,
        error: `Invalid value for ${key}`,
      };
    }
  }

  if (normalized.discovery_channels.length === 0) {
    return {
      ok: false,
      error: "Choose at least one discovery channel",
    };
  }

  const uniqueChannels = Array.from(new Set(normalized.discovery_channels));
  if (uniqueChannels.some((channel) => !preRegisterSurveyOptionSets.discovery_channels.has(channel))) {
    return {
      ok: false,
      error: "Invalid value for discovery_channels",
    };
  }

  normalized.discovery_channels = uniqueChannels;

  return {
    ok: true,
    survey: normalized,
  };
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

app.get("/register-survey", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "register-survey.html"))
);

app.get("/register-survey.html", (req, res) =>
  res.redirect("/register-survey")
);

app.get("/register", (req, res) => {
  if (!req.session.preRegisterSurveyCompleted) {
    return res.redirect("/register-survey");
  }

  return res.sendFile(path.join(__dirname, "public", "register.html"));
});

app.get("/subscribe", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "subscribe.html"))
);

app.get("/opportunities", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "opportunities.html"))
);

app.get("/opportunities.html", (req, res) =>
  res.redirect("/opportunities")
);

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

app.post("/api/register-survey", (req, res) => {
  const validation = validatePreRegisterSurveyPayload(req.body || {});
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  req.session.preRegisterSurvey = validation.survey;
  req.session.preRegisterSurveyCompleted = true;

  return req.session.save((saveErr) => {
    if (saveErr) {
      console.error("Failed to save pre-register survey session:", saveErr);
      return res.status(500).json({ error: "Failed to save survey" });
    }

    return res.json({ ok: true, redirect: "/register" });
  });
});

/* ======================
   REGISTER
====================== */

app.post("/register", async (req, res) => {
  if (!req.session.preRegisterSurveyCompleted || !req.session.preRegisterSurvey) {
    return res.redirect("/register-survey?error=required");
  }

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

    try {
      await pool.query(
        `
        INSERT INTO registration_surveys (user_id, survey_payload, submitted_at)
        VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE
        SET survey_payload = EXCLUDED.survey_payload,
            submitted_at = CURRENT_TIMESTAMP
        `,
        [user.id, JSON.stringify(req.session.preRegisterSurvey)]
      );
    } catch (surveySaveErr) {
      console.error("Could not save registration survey:", surveySaveErr);
    }

    return saveSessionAndRedirect(req, res, user, "/dashboard");
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

    return saveSessionAndRedirect(req, res, user, "/dashboard");
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

app.get("/api/account/access", requireAuth, async (req, res) => {
  try {
    const [canManageInternshipsValue, canManageOpportunitiesValue] = await Promise.all([
      canManageInternships(req),
      canManageOpportunities(req),
    ]);

    return res.json({
      email: normalizeEmail(req.session.email),
      can_manage_internships: canManageInternshipsValue,
      can_manage_opportunities: canManageOpportunitiesValue,
      opportunities_admin_email: OPPORTUNITIES_ADMIN_EMAIL,
    });
  } catch (err) {
    console.error("Account access check error:", err);
    return res.status(500).json({ error: "Failed to check account access" });
  }
});

/* ======================
   Internships API
====================== */

app.get("/api/internships", requireAuth, async (req, res) => {
  const category = String(req.query.category || "all").trim().toLowerCase();

  try {
    const canManage = await canManageInternships(req);

    const sql = category === "all"
      ? `
        SELECT id, title, organization, description, category, location, duration, apply_url, created_at, created_by
        FROM internships
        ORDER BY created_at DESC, id DESC
      `
      : `
        SELECT id, title, organization, description, category, location, duration, apply_url, created_at, created_by
        FROM internships
        WHERE category = $1
        ORDER BY created_at DESC, id DESC
      `;

    const params = category === "all" ? [] : [category];
    const result = await pool.query(sql, params);
    const internships = result.rows.map((row) => {
      return {
        id: row.id,
        title: row.title,
        organization: row.organization,
        description: row.description,
        category: row.category,
        location: row.location,
        duration: row.duration,
        apply_url: row.apply_url,
        created_at: row.created_at,
        can_delete: canManage,
      };
    });
    return res.json({ can_manage: canManage, internships });
  } catch (err) {
    console.error("Fetch internships error:", err);
    return res.status(500).json({ error: "Failed to fetch internships" });
  }
});

app.get("/api/internships/access", requireAuth, async (req, res) => {
  try {
    const managerEmails = Array.from(getInternshipManagerEmails());
    const canManage = await canManageInternships(req);
    return res.json({
      can_manage: canManage,
      session_email: normalizeEmail(req.session.email),
      manager_emails: managerEmails,
    });
  } catch (err) {
    console.error("Internship access debug error:", err);
    return res.status(500).json({ error: "Failed to check access" });
  }
});

app.get("/api/opportunities", async (req, res) => {
  const requestedType = String(req.query.type || "all").trim().toLowerCase();
  const allowedTypes = new Set(["all", "grants", "scholarships", "news", "articles"]);

  if (!allowedTypes.has(requestedType)) {
    return res.status(400).json({ error: "Unknown opportunities filter type" });
  }

  let canManage = false;
  try {
    canManage = await canManageOpportunities(req);
  } catch (accessErr) {
    console.error("Opportunities access check error:", accessErr);
  }

  try {
    const sql = requestedType === "all"
      ? `
        SELECT id, title, organization, summary, content_type, country, deadline, source_url, image_url, created_at
        FROM opportunities
        ORDER BY created_at DESC, id DESC
      `
      : `
        SELECT id, title, organization, summary, content_type, country, deadline, source_url, image_url, created_at
        FROM opportunities
        WHERE content_type = $1
        ORDER BY created_at DESC, id DESC
      `;

    const params = requestedType === "all" ? [] : [requestedType];
    const result = await pool.query(sql, params);
    const opportunities = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      organization: row.organization,
      summary: row.summary,
      content_type: row.content_type,
      country: row.country,
      deadline: row.deadline,
      source_url: row.source_url,
      image_url: row.image_url,
      created_at: row.created_at,
      can_delete: canManage,
    }));

    return res.json({ can_manage: canManage, opportunities });
  } catch (err) {
    console.error("Fetch opportunities error:", err);
    return res.status(500).json({ error: "Failed to fetch opportunities" });
  }
});

app.get("/api/subscription", requireAuth, async (req, res) => {
  try {
    const [ subscription ] = (await pool.query(
      `SELECT id, plan, active, status, started_at, expires_at FROM subscriptions WHERE user_id = $1 ORDER BY id DESC LIMIT 1`,
      [req.session.userId]
    )).rows;

    if (!subscription) {
      return res.json({ hasSubscription: false });
    }

    const now = new Date();
    const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : null;
    const isActive = subscription.active && (!expiresAt || expiresAt > now);

    return res.json({
      hasSubscription: true,
      subscription: {
        plan: subscription.plan,
        active: isActive,
        status: subscription.status,
        started_at: subscription.started_at,
        expires_at: subscription.expires_at,
      },
    });
  } catch (err) {
    console.error("Subscription status error:", err);
    return res.status(500).json({ error: "Failed to get subscription status" });
  }
});

app.post("/api/subscription/create", requireAuth, async (req, res) => {
  if (!KASPI_MERCHANT_ID || !KASPI_API_KEY || !KASPI_CALLBACK_URL) {
    console.error("Kaspi settings missing", {
      KASPI_MERCHANT_ID,
      KASPI_API_KEY,
      KASPI_CALLBACK_URL,
    });
    return res.status(500).json({ error: "Kaspi payment configuration is missing" });
  }

  try {
    const plan = String(req.body.plan || "monthly").trim();
    const amount = plan === "monthly" ? 990 : 990;
    const orderId = `sub_${req.session.userId}_${Date.now()}`;

    await pool.query(
      `INSERT INTO subscriptions (user_id, email, plan, active, status, order_id, started_at, expires_at)
       VALUES ($1, $2, $3, false, 'pending', $4, NOW(), NULL)
       ON CONFLICT (user_id) DO UPDATE SET
         email = EXCLUDED.email,
         plan = EXCLUDED.plan,
         active = false,
         status = 'pending',
         order_id = EXCLUDED.order_id,
         started_at = NOW(),
         expires_at = NULL`,
      [req.session.userId, req.session.email, plan, orderId]
    );

    const encodedReturn = encodeURIComponent(`${KASPI_CALLBACK_URL}?orderId=${orderId}`);
    const kaspiPayUrl = `https://kaspi.kz/pay?merchant=${encodeURIComponent(KASPI_MERCHANT_ID)}&amount=${amount}&orderId=${encodeURIComponent(orderId)}&returnUrl=${encodedReturn}`;

    return res.json({
      payment_url: kaspiPayUrl,
      order_id: orderId,
    });
  } catch (err) {
    console.error("Create subscription error:", err);
    return res.status(500).json({ error: "Failed to initialize subscription" });
  }
});

app.get("/subscription/pay", requireAuth, async (req, res) => {
  if (!KASPI_MERCHANT_ID || !KASPI_API_KEY || !KASPI_CALLBACK_URL) {
    return res.status(500).send("Kaspi payment config is missing");
  }

  try {
    const plan = String(req.query.plan || "monthly").trim();
    const amount = plan === "monthly" ? 990 : 990;
    const orderId = `sub_${req.session.userId}_${Date.now()}`;

    await pool.query(
      `INSERT INTO subscriptions (user_id, email, plan, active, status, order_id, started_at, expires_at)
       VALUES ($1, $2, $3, false, 'pending', $4, NOW(), NULL)
       ON CONFLICT (user_id) DO UPDATE SET
         email = EXCLUDED.email,
         plan = EXCLUDED.plan,
         active = false,
         status = 'pending',
         order_id = EXCLUDED.order_id,
         started_at = NOW(),
         expires_at = NULL`,
      [req.session.userId, req.session.email, plan, orderId]
    );

    const encodedReturn = encodeURIComponent(`${KASPI_CALLBACK_URL}?orderId=${orderId}`);
    const kaspiPayUrl = `https://kaspi.kz/pay?merchant=${encodeURIComponent(KASPI_MERCHANT_ID)}&amount=${amount}&orderId=${encodeURIComponent(orderId)}&returnUrl=${encodedReturn}`;

    return res.redirect(kaspiPayUrl);
  } catch (err) {
    console.error("Subscription pay redirect error:", err);
    return res.status(500).send("Failed to create kaspi order");
  }
});

app.get("/kaspi/return", async (req, res) => {
  const orderId = String(req.query.orderId || "");

  if (!orderId) {
    return res.status(400).send("Missing orderId");
  }

  try {
    const result = await pool.query(
      `SELECT id, user_id FROM subscriptions WHERE order_id = $1 LIMIT 1`,
      [orderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Subscription order not found");
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await pool.query(
      `UPDATE subscriptions
       SET active = true, status = 'active', expires_at = $1
       WHERE order_id = $2`,
      [expiresAt.toISOString(), orderId]
    );

    return res.send(`Оплата прошла успешно. Подписка активна до ${expiresAt.toISOString().slice(0, 10)}.`);
  } catch (err) {
    console.error("Kaspi return handling error:", err);
    return res.status(500).send("Ошибка обработки подписки");
  }
});

app.post("/api/kaspi/webhook", async (req, res) => {
  // Под webhook'ом обычно Kaspi отправляет событие об успешной оплате.
  // Здесь нужно проверять подпись (HMAC) и обновлять subscription по orderId.
  const { orderId, status } = req.body;

  if (!orderId || !status) {
    return res.status(400).json({ error: "Bad webhook payload" });
  }

  if (String(status).toLowerCase() !== "paid") {
    return res.status(400).json({ error: "Payment not completed" });
  }

  try {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await pool.query(
      `UPDATE subscriptions SET active = true, status = 'active', expires_at = $1 WHERE order_id = $2`,
      [expiresAt.toISOString(), orderId]
    );

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Kaspi webhook update error:", err);
    return res.status(500).json({ error: "Failed to update subscription" });
  }
});

app.post("/api/internships", requireAuth, async (req, res) => {
  const canManage = await canManageInternships(req);
  if (!canManage) {
    return res.status(403).json({ error: "Only internship manager can create internships" });
  }

  const title = String(req.body.title || "").trim();
  const organization = String(req.body.organization || "").trim();
  const description = String(req.body.description || "").trim();
  const category = String(req.body.category || "").trim().toLowerCase();
  const location = String(req.body.location || "").trim();
  const duration = String(req.body.duration || "").trim();
  const applyUrl = String(req.body.applyUrl || "").trim();

  const allowedCategories = new Set([
    "ministries",
    "akimats",
    "quasi",
    "online",
    "other",
  ]);

  if (
    !title ||
    !organization ||
    !description ||
    !location ||
    !duration ||
    !allowedCategories.has(category)
  ) {
    return res.status(400).json({ error: "Invalid internship payload" });
  }

  if (applyUrl && !/^https?:\/\//i.test(applyUrl)) {
    return res.status(400).json({ error: "applyUrl must start with http:// or https://" });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO internships (
        title, organization, description, category, location, duration, apply_url, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, title, organization, description, category, location, duration, apply_url, created_at
      `,
      [
        title,
        organization,
        description,
        category,
        location,
        duration,
        applyUrl || null,
        req.session.userId,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Create internship error:", err);
    return res.status(500).json({ error: "Failed to create internship" });
  }
});

app.delete("/api/internships/:id", requireAuth, async (req, res) => {
  const canManage = await canManageInternships(req);
  if (!canManage) {
    return res.status(403).json({ error: "Only internship manager can delete internships" });
  }

  const internshipId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(internshipId) || internshipId <= 0) {
    return res.status(400).json({ error: "Invalid internship id" });
  }

  try {
    const internshipResult = await pool.query(
      "SELECT id, created_by FROM internships WHERE id = $1",
      [internshipId]
    );

    if (internshipResult.rows.length === 0) {
      return res.status(404).json({ error: "Internship not found" });
    }

    await pool.query("DELETE FROM internships WHERE id = $1", [internshipId]);
    return res.json({ ok: true });
  } catch (err) {
    console.error("Delete internship error:", err);
    return res.status(500).json({ error: "Failed to delete internship" });
  }
});

app.post("/api/opportunities", requireAuth, async (req, res) => {
  const canManage = await canManageOpportunities(req);
  if (!canManage) {
    return res.status(403).json({ error: "Only alibiayap@gmail.com can publish grants and publications" });
  }

  const title = String(req.body.title || "").trim();
  const organization = String(req.body.organization || "").trim();
  const summary = String(req.body.summary || "").trim();
  const contentType = String(req.body.contentType || "").trim().toLowerCase();
  const country = String(req.body.country || "").trim();
  const deadline = String(req.body.deadline || "").trim();
  const sourceUrl = String(req.body.sourceUrl || "").trim();
  const imageUrl = String(req.body.imageUrl || "").trim();

  const allowedTypes = new Set(["grants", "scholarships", "news", "articles"]);

  if (
    !title ||
    !organization ||
    !summary ||
    !country ||
    !allowedTypes.has(contentType)
  ) {
    return res.status(400).json({ error: "Invalid opportunity payload" });
  }

  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
    return res.status(400).json({ error: "sourceUrl must start with http:// or https://" });
  }

  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    return res.status(400).json({ error: "imageUrl must start with http:// or https://" });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO opportunities (
        title, organization, summary, content_type, country, deadline, source_url, image_url, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, title, organization, summary, content_type, country, deadline, source_url, image_url, created_at
      `,
      [
        title,
        organization,
        summary,
        contentType,
        country,
        deadline || null,
        sourceUrl || null,
        imageUrl || null,
        req.session.userId,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Create opportunity error:", err);
    return res.status(500).json({ error: "Failed to create opportunity" });
  }
});

app.delete("/api/opportunities/:id", requireAuth, async (req, res) => {
  const canManage = await canManageOpportunities(req);
  if (!canManage) {
    return res.status(403).json({ error: "Only alibiayap@gmail.com can delete grants and publications" });
  }

  const opportunityId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(opportunityId) || opportunityId <= 0) {
    return res.status(400).json({ error: "Invalid opportunity id" });
  }

  try {
    const existing = await pool.query(
      "SELECT id FROM opportunities WHERE id = $1",
      [opportunityId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Opportunity not found" });
    }

    await pool.query("DELETE FROM opportunities WHERE id = $1", [opportunityId]);
    return res.json({ ok: true });
  } catch (err) {
    console.error("Delete opportunity error:", err);
    return res.status(500).json({ error: "Failed to delete opportunity" });
  }
});

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
