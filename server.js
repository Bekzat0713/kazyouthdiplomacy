require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const nodemailer = require("nodemailer");

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
const KASPI_QR_URL = String(process.env.KASPI_QR_URL || "https://pay.kaspi.kz/pay/7tul3afi").trim();
const APP_BASE_URL = String(process.env.APP_BASE_URL || `http://localhost:${PORT}`);
const SESSION_SECRET = String(process.env.SESSION_SECRET || "").trim();
const SESSION_COOKIE_NAME = String(process.env.SESSION_COOKIE_NAME || "kyd.sid").trim() || "kyd.sid";
const MAIL_FROM = String(
  process.env.MAIL_FROM || process.env.SMTP_USER || "no-reply@kazyouthdiplomacy.local"
);
const SMTP_URL = String(process.env.SMTP_URL || "").trim();
const SMTP_HOST = String(process.env.SMTP_HOST || "").trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || "").toLowerCase() === "true";
const SMTP_USER = String(process.env.SMTP_USER || "").trim();
const SMTP_PASS = String(process.env.SMTP_PASS || "");
const EMAIL_VERIFICATION_ENABLED = String(
  process.env.EMAIL_VERIFICATION_ENABLED || "false"
).toLowerCase() === "true";
const EMAIL_VERIFY_TOKEN_TTL_MINUTES = Number(
  process.env.EMAIL_VERIFY_TOKEN_TTL_MINUTES || 60 * 24
);
const PASSWORD_RESET_TOKEN_TTL_MINUTES = Number(
  process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || 60
);
const EMAIL_RESEND_COOLDOWN_SECONDS = Number(
  process.env.EMAIL_RESEND_COOLDOWN_SECONDS || 60
);
const AUTH_MIN_PASSWORD_LENGTH = Number(process.env.AUTH_MIN_PASSWORD_LENGTH || 10);
const LOGIN_RATE_LIMIT_WINDOW_MINUTES = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES || 15);
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || 7);
const REGISTER_RATE_LIMIT_WINDOW_MINUTES = Number(process.env.REGISTER_RATE_LIMIT_WINDOW_MINUTES || 30);
const REGISTER_RATE_LIMIT_MAX_ATTEMPTS = Number(process.env.REGISTER_RATE_LIMIT_MAX_ATTEMPTS || 5);
const RESEND_RATE_LIMIT_WINDOW_MINUTES = Number(process.env.RESEND_RATE_LIMIT_WINDOW_MINUTES || 30);
const RESEND_RATE_LIMIT_MAX_ATTEMPTS = Number(process.env.RESEND_RATE_LIMIT_MAX_ATTEMPTS || 5);
const FORGOT_RATE_LIMIT_WINDOW_MINUTES = Number(process.env.FORGOT_RATE_LIMIT_WINDOW_MINUTES || 30);
const FORGOT_RATE_LIMIT_MAX_ATTEMPTS = Number(process.env.FORGOT_RATE_LIMIT_MAX_ATTEMPTS || 5);
const RESET_RATE_LIMIT_WINDOW_MINUTES = Number(process.env.RESET_RATE_LIMIT_WINDOW_MINUTES || 30);
const RESET_RATE_LIMIT_MAX_ATTEMPTS = Number(process.env.RESET_RATE_LIMIT_MAX_ATTEMPTS || 10);
const FREE_INTERNSHIP_PREVIEW_LIMIT = Number(process.env.FREE_INTERNSHIP_PREVIEW_LIMIT || 4);
const FREE_OPPORTUNITY_PREVIEW_LIMIT = Number(process.env.FREE_OPPORTUNITY_PREVIEW_LIMIT || 6);
const FREE_RESOURCE_PREVIEW_LIMIT = Number(process.env.FREE_RESOURCE_PREVIEW_LIMIT || 4);
const FREE_PREVIEW_LIMITS = {
  internships: FREE_INTERNSHIP_PREVIEW_LIMIT,
  opportunities: FREE_OPPORTUNITY_PREVIEW_LIMIT,
  resources: FREE_RESOURCE_PREVIEW_LIMIT,
};

const SUBSCRIPTION_PLANS = {
  monthly: {
    id: "monthly",
    label: "Старт",
    amount: 1090,
    access_days: 30,
  },
  quarterly: {
    id: "quarterly",
    label: "Оптимальный",
    amount: 2790,
    access_days: 90,
  },
  halfyear: {
    id: "halfyear",
    label: "Максимум",
    amount: 5990,
    access_days: 180,
  },
};

const SUBSCRIPTION_PENDING_STATUSES = new Set(["pending", "payment_pending", "pending_manual_review"]);

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

const recommendationEnglishLevels = new Set(["a1_a2", "b1_b2", "c1_plus", "any"]);
const recommendationExperienceLevels = new Set([
  "none",
  "little",
  "internships_or_projects",
  "already_working_in_field",
  "any",
]);
const recommendationRegionTypes = new Set([
  "kazakhstan",
  "international",
  "online",
  "hybrid",
  "any",
]);
const careerResourceTypes = new Set([
  "cv",
  "interview",
  "grants",
  "internships",
  "career_start",
]);
const savedEntityTypes = new Set(["internship", "opportunity"]);
const savedStatuses = new Set(["saved", "want_to_apply", "applied"]);

if (!databaseUrl) {
  console.error("DATABASE_URL is not configured");
  process.exit(1);
}

function isWeakSessionSecret(secret) {
  const normalized = String(secret || "").trim();
  if (!normalized) {
    return true;
  }

  const weakSecrets = new Set([
    "dev-secret",
    "supersecretkey",
    "change-me",
    "change-me-to-a-long-random-secret",
  ]);

  return normalized.length < 32 || weakSecrets.has(normalized.toLowerCase());
}

if (isProduction && isWeakSessionSecret(SESSION_SECRET)) {
  console.error("SESSION_SECRET is missing or too weak for production");
  process.exit(1);
}

if (!isProduction && isWeakSessionSecret(SESSION_SECRET)) {
  console.warn("SESSION_SECRET is weak. Generate a long random secret before deploying.");
}

if (isProduction && !APP_BASE_URL.startsWith("https://")) {
  console.error("APP_BASE_URL must use https:// in production");
  process.exit(1);
}

if (isProduction && !EMAIL_VERIFICATION_ENABLED) {
  console.warn("EMAIL_VERIFICATION_ENABLED is false in production. Turn it on before public launch.");
}

let mailTransporter;

/* ======================
   PostgreSQL
====================== */

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: shouldUseDbSsl ? { rejectUnauthorized: false } : undefined,
});

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
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15,
    }),
    name: SESSION_COOKIE_NAME,
    secret: SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    unset: "destroy",
    proxy: isProduction,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 12,
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
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS amount INTEGER,
      ADD COLUMN IF NOT EXISTS base_amount INTEGER,
      ADD COLUMN IF NOT EXISTS access_days INTEGER,
      ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'kaspi_qr',
      ADD COLUMN IF NOT EXISTS payment_code TEXT,
      ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS review_note TEXT
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
        first_name TEXT,
        last_name TEXT,
        birth_date DATE,
        university TEXT,
        workplace TEXT,
        bio TEXT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_verified BOOLEAN DEFAULT false,
        email_verified_at TIMESTAMP,
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
      ADD COLUMN IF NOT EXISTS first_name TEXT
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS last_name TEXT
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS birth_date DATE
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS university TEXT
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS workplace TEXT
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS bio TEXT
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT true
    `);

    await pool.query(`
      ALTER TABLE users
      ALTER COLUMN is_verified SET DEFAULT false
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP
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
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS email_verification_tokens_user_id_idx
      ON email_verification_tokens (user_id)
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx
      ON password_reset_tokens (user_id)
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

    await pool.query(`
      ALTER TABLE internships
      ADD COLUMN IF NOT EXISTS target_goals TEXT[] DEFAULT ARRAY[]::TEXT[],
      ADD COLUMN IF NOT EXISTS required_english_level TEXT DEFAULT 'any',
      ADD COLUMN IF NOT EXISTS experience_level TEXT DEFAULT 'any',
      ADD COLUMN IF NOT EXISTS region_type TEXT DEFAULT 'any',
      ADD COLUMN IF NOT EXISTS deadline_date DATE
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
      ADD COLUMN IF NOT EXISTS image_url TEXT,
      ADD COLUMN IF NOT EXISTS target_goals TEXT[] DEFAULT ARRAY[]::TEXT[],
      ADD COLUMN IF NOT EXISTS required_english_level TEXT DEFAULT 'any',
      ADD COLUMN IF NOT EXISTS experience_level TEXT DEFAULT 'any',
      ADD COLUMN IF NOT EXISTS region_type TEXT DEFAULT 'any',
      ADD COLUMN IF NOT EXISTS deadline_date DATE
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS saved_items (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        saved_status TEXT NOT NULL DEFAULT 'saved',
        reminder_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS saved_items_user_entity_unique
      ON saved_items (user_id, entity_type, entity_id)
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_actions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        action_value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS career_resources (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        body TEXT,
        resource_type TEXT NOT NULL,
        source_url TEXT,
        target_goals TEXT[] DEFAULT ARRAY[]::TEXT[],
        required_english_level TEXT DEFAULT 'any',
        experience_level TEXT DEFAULT 'any',
        region_type TEXT DEFAULT 'any',
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
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

    const resourcesCount = await pool.query(
      "SELECT COUNT(*)::INT AS total FROM career_resources"
    );

    if (resourcesCount.rows[0].total === 0) {
      await pool.query(
        `
        INSERT INTO career_resources (
          title,
          summary,
          body,
          resource_type,
          source_url,
          target_goals,
          required_english_level,
          experience_level,
          region_type
        ) VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9),
          ($10, $11, $12, $13, $14, $15, $16, $17, $18),
          ($19, $20, $21, $22, $23, $24, $25, $26, $27),
          ($28, $29, $30, $31, $32, $33, $34, $35, $36),
          ($37, $38, $39, $40, $41, $42, $43, $44, $45)
        `,
        [
          "CV checklist для первой сильной заявки",
          "Пошаговый чеклист, чтобы быстро проверить резюме перед откликом на стажировку или программу.",
          "Проверьте структуру, измеримые достижения, читабельность, язык и адаптацию под конкретную роль.",
          "cv",
          "",
          ["civil_service", "international_org", "national_company", "private_sector", "undecided"],
          "any",
          "none",
          "any",
          "Interview checklist: как не провалить мотивационные вопросы",
          "Быстрый гид по самопрезентации, STAR-ответам и работе с типичными вопросами на интервью.",
          "Подготовьте 5 кейсов о своём опыте, потренируйте короткую самопрезентацию и вопросы к работодателю.",
          "interview",
          "",
          ["international_org", "national_company", "private_sector", "civil_service", "undecided"],
          "b1_b2",
          "little",
          "any",
          "Guide по scholarship / grant application",
          "Разбор того, как собирать документы, писать мотивационное письмо и не теряться в дедлайнах.",
          "Соберите пакет документов заранее, разделите заявку на этапы и проверьте критерии отбора по каждой программе.",
          "grants",
          "",
          ["study_abroad", "masters"],
          "b1_b2",
          "none",
          "international",
          "Guide по internship application",
          "Как выбрать стажировку, адаптировать CV и подать первую сильную заявку без прокрастинации.",
          "Начните с 5 релевантных объявлений, адаптируйте резюме под каждое и следите за сроками подачи.",
          "internships",
          "",
          ["civil_service", "international_org", "national_company", "private_sector", "undecided"],
          "any",
          "none",
          "kazakhstan",
          "Career start toolkit",
          "Базовый набор материалов для тех, кто пока не определился и хочет выстроить карьерный фокус.",
          "Используйте этот набор, чтобы определить свой трек, оценить пробелы в навыках и выбрать первый карьерный шаг.",
          "career_start",
          "",
          ["undecided", "private_sector", "national_company", "civil_service"],
          "any",
          "none",
          "any",
        ]
      );
    }

    console.log("Tables ready");
  } catch (err) {
    console.error("DB Init Error:", err);
    throw err;
  }
}

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

function wantsJson(req) {
  const acceptHeader = String(req.get("accept") || "").toLowerCase();
  return req.path.startsWith("/api/") || acceptHeader.includes("application/json");
}

function respondWithAuthRateLimit(req, res, message, redirectPath) {
  if (wantsJson(req)) {
    return res.status(429).json({ error: message });
  }

  return res.redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}error=rate-limit`);
}

function createAuthRateLimiter(options) {
  return rateLimit({
    windowMs: options.windowMinutes * 60 * 1000,
    limit: options.maxAttempts,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: Boolean(options.skipSuccessfulRequests),
    handler(req, res) {
      return respondWithAuthRateLimit(req, res, options.message, options.redirectPath);
    },
  });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeProfileText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function validatePasswordStrength(password) {
  const value = String(password || "");
  const hasLetter = /[A-Za-zА-Яа-я]/.test(value);
  const hasDigit = /\d/.test(value);

  if (value.length < AUTH_MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Пароль должен содержать минимум ${AUTH_MIN_PASSWORD_LENGTH} символов.`,
    };
  }

  if (!hasLetter || !hasDigit) {
    return {
      ok: false,
      error: "Пароль должен содержать хотя бы одну букву и одну цифру.",
    };
  }

  return { ok: true };
}

function parseBirthDate(value) {
  const dateValue = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return null;
  }

  const parsedDate = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const now = new Date();
  if (parsedDate > now) {
    return null;
  }

  const minAllowedDate = new Date();
  minAllowedDate.setFullYear(minAllowedDate.getFullYear() - 100);
  if (parsedDate < minAllowedDate) {
    return null;
  }

  return dateValue;
}

function serializeDateOnly(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const serialized = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(serialized) ? serialized.slice(0, 10) : null;
}

function parseDeadlineDate(value) {
  const dateValue = String(value || "").trim();
  if (!dateValue) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return null;
  }

  const parsedDate = new Date(`${dateValue}T00:00:00Z`);
  return Number.isNaN(parsedDate.getTime()) ? null : dateValue;
}

function buildUserProfile(userRow) {
  return {
    first_name: normalizeProfileText(userRow.first_name),
    last_name: normalizeProfileText(userRow.last_name),
    birth_date: serializeDateOnly(userRow.birth_date),
    university: normalizeProfileText(userRow.university),
    workplace: normalizeProfileText(userRow.workplace),
    email: normalizeEmail(userRow.email),
    is_verified: !EMAIL_VERIFICATION_ENABLED || userRow.is_verified !== false,
  };
}

const surveyValueLabels = {
  current_status: {
    school: "Школьник",
    university: "Студент",
    working: "Работающий специалист",
    study_and_work: "Учусь и работаю",
  },
  main_goal: {
    study_abroad: "Поступить за границу",
    masters: "Поступить в магистратуру",
    civil_service: "Попасть на госслужбу",
    international_org: "Работать в международной организации",
    national_company: "Устроиться в национальную компанию",
    private_sector: "Работать в частном секторе",
    undecided: "Определиться с направлением",
  },
  goal_clarity: {
    none: "Пока нет ясности",
    roughly: "Есть общее понимание",
    partially: "Часть шагов уже ясна",
    clear: "План почти понятен",
  },
  main_blocker: {
    dont_know_start: "Неясно, с чего начать",
    too_much_info: "Слишком много информации",
    no_experience: "Не хватает опыта",
    lack_skills: "Не хватает навыков",
    low_confidence: "Не хватает уверенности",
    procrastination: "Мешает прокрастинация",
  },
  current_experience: {
    none: "Опыта пока нет",
    little: "Есть небольшой опыт",
    internships_or_projects: "Есть стажировки или проекты",
    already_working_in_field: "Уже работаю по направлению",
  },
  english_level: {
    a1_a2: "A1-A2",
    b1_b2: "B1-B2",
    c1_plus: "C1+",
  },
};

function getSurveyLabel(field, value) {
  return surveyValueLabels[field]?.[String(value || "").trim()] || "";
}

async function getRegistrationSurveyForUser(userId) {
  if (!userId) {
    return null;
  }

  const result = await pool.query(
    `
    SELECT survey_payload, submitted_at
    FROM registration_surveys
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    ...result.rows[0].survey_payload,
    submitted_at: result.rows[0].submitted_at,
  };
}

function buildRoadmapFromSurvey(survey) {
  if (!survey) {
    return null;
  }

  const goalLabel = getSurveyLabel("main_goal", survey.main_goal) || "Построить карьерный маршрут";
  const currentStatusLabel = getSurveyLabel("current_status", survey.current_status) || "Пользователь";
  const blockerLabel = getSurveyLabel("main_blocker", survey.main_blocker) || "Нет данных";
  const englishLabel = getSurveyLabel("english_level", survey.english_level) || "Не указан";
  const experienceLabel = getSurveyLabel("current_experience", survey.current_experience) || "Нет данных";
  const clarityLabel = getSurveyLabel("goal_clarity", survey.goal_clarity) || "Нет данных";

  const nextStepMap = {
    dont_know_start: {
      title: "Определить ближайшую цель на 30 дней",
      description: "Не пытайтесь охватить всё сразу. Выберите один трек, который даст первый реальный результат уже в этом месяце.",
      cta_label: "Смотреть возможности",
      cta_href: "/opportunities",
    },
    too_much_info: {
      title: "Сузить фокус до одной карьерной траектории",
      description: "Уберите лишний шум и работайте только с теми стажировками, грантами и материалами, которые ведут к вашей главной цели.",
      cta_label: "Перейти к публикациям",
      cta_href: "/opportunities",
    },
    no_experience: {
      title: "Набрать первый подтверждаемый опыт",
      description: "Начните со стажировки, волонтерского проекта или кейса, который можно добавить в резюме и использовать в откликах.",
      cta_label: "Найти стажировки",
      cta_href: "/internships",
    },
    lack_skills: {
      title: "Подтянуть один ключевой навык",
      description: "Сфокусируйтесь на одном навыке, который чаще всего требуется для вашей цели: английский, аналитика, письмо, публичные выступления.",
      cta_label: "Посмотреть публикации",
      cta_href: "/opportunities",
    },
    low_confidence: {
      title: "Собрать маленькие победы и первый отклик",
      description: "Уверенность растёт после действий. Начните с одной понятной заявки и зафиксируйте, что уже умеете и что уже сделали.",
      cta_label: "Перейти к стажировкам",
      cta_href: "/internships",
    },
    procrastination: {
      title: "Разбить путь на короткие еженедельные шаги",
      description: "Не ставьте себе абстрактную цель. Запланируйте одно действие на неделю: обновить CV, найти 5 программ, подать 1 заявку.",
      cta_label: "Открыть мой маршрут",
      cta_href: "/dashboard",
    },
  };

  const nextStep = nextStepMap[survey.main_blocker] || {
    title: "Сделать первый осознанный шаг по цели",
    description: "Сконцентрируйтесь на ближайшем действии, которое приближает вас к выбранному треку, и не распыляйтесь на всё сразу.",
    cta_label: "Смотреть возможности",
    cta_href: "/opportunities",
  };

  const steps = [
    {
      title: "Зафиксировать карьерный фокус",
      description: `Ваша текущая цель: ${goalLabel}. Уровень ясности сейчас: ${clarityLabel}. Сформулируйте, какой результат вы хотите получить в ближайшие 30-60 дней.`,
      cta_label: "Обновить фокус",
      cta_href: "/dashboard",
    },
    {
      title: "Усилить базу под выбранную цель",
      description: `Текущий статус: ${currentStatusLabel}. Опыт: ${experienceLabel}. Английский: ${englishLabel}. Определите, какого навыка или опыта вам сейчас не хватает больше всего.`,
      cta_label: "Смотреть публикации",
      cta_href: "/opportunities",
    },
    {
      title: "Собрать возможности под свой трек",
      description: "Выберите 5-10 релевантных стажировок, грантов или программ и отберите только те, что реально совпадают с вашей целью.",
      cta_label: "Открыть возможности",
      cta_href: "/opportunities",
    },
    {
      title: "Сделать первую сильную заявку",
      description: "Не ждите идеального момента. Подайте хотя бы одну качественную заявку, чтобы получить опыт, обратную связь и реальный прогресс.",
      cta_label: "Перейти к стажировкам",
      cta_href: "/internships",
    },
    {
      title: "Отслеживать прогресс каждую неделю",
      description: `Ваш главный барьер сейчас: ${blockerLabel}. Возвращайтесь к маршруту раз в неделю и сверяйте, что уже сделано и какой шаг следующий.`,
      cta_label: "Вернуться в кабинет",
      cta_href: "/dashboard",
    },
  ];

  return {
    goal_label: goalLabel,
    current_status_label: currentStatusLabel,
    blocker_label: blockerLabel,
    english_label: englishLabel,
    experience_label: experienceLabel,
    clarity_label: clarityLabel,
    summary: `${currentStatusLabel} с целью "${goalLabel}". Главный барьер сейчас: ${blockerLabel}.`,
    next_step: nextStep,
    steps,
  };
}

function buildFallbackRoadmap() {
  return {
    goal_label: "Определить карьерный трек",
    current_status_label: "Пользователь платформы",
    blocker_label: "Маршрут ещё не уточнён",
    english_label: "Уточним позже",
    experience_label: "Уточним позже",
    clarity_label: "Нужен первый фокус",
    summary: "Мы ещё не собрали вашу анкету, поэтому показываем стартовый маршрут. Его уже можно использовать как базовый план действий.",
    next_step: {
      title: "Выбрать один трек и сделать первый конкретный шаг",
      description: "Сфокусируйтесь на одном направлении на ближайший месяц: стажировка, грант, магистратура или карьерный старт. Дальше двигайтесь только по нему.",
      cta_label: "Смотреть возможности",
      cta_href: "/opportunities",
    },
    steps: [
      {
        title: "Определить приоритет на 30 дней",
        description: "Не пытайтесь охватить всё сразу. Выберите один карьерный трек, на котором будете держать фокус в ближайший месяц.",
        cta_label: "Открыть кабинет",
        cta_href: "/dashboard",
      },
      {
        title: "Собрать 5-10 релевантных возможностей",
        description: "Отберите программы, стажировки или гранты, которые реально совпадают с вашим интересом и уровнем подготовки.",
        cta_label: "Смотреть возможности",
        cta_href: "/opportunities",
      },
      {
        title: "Прокачать один слабый участок",
        description: "Выберите только один приоритетный дефицит: английский, резюме, опыт, мотивационное письмо или публичные выступления.",
        cta_label: "Перейти к публикациям",
        cta_href: "/opportunities",
      },
      {
        title: "Подать первую заявку",
        description: "Даже одна качественная заявка даст больше пользы, чем бесконечная подготовка без действий.",
        cta_label: "Найти стажировки",
        cta_href: "/internships",
      },
      {
        title: "Проверять прогресс раз в неделю",
        description: "Раз в неделю возвращайтесь в кабинет и фиксируйте, какой шаг уже сделали и что будет следующим.",
        cta_label: "Вернуться в кабинет",
        cta_href: "/dashboard",
      },
    ],
  };
}

function normalizeTextArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || "").trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[,\n;]+/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

function uniqueTextArray(values) {
  return Array.from(new Set(normalizeTextArray(values)));
}

function normalizeTargetGoals(value) {
  return uniqueTextArray(value).filter((goal) => preRegisterSurveyOptionSets.main_goal.has(goal));
}

function normalizeEnglishRequirement(value) {
  const normalized = String(value || "any").trim().toLowerCase();
  return recommendationEnglishLevels.has(normalized) ? normalized : "any";
}

function normalizeExperienceRequirement(value) {
  const normalized = String(value || "any").trim().toLowerCase();
  return recommendationExperienceLevels.has(normalized) ? normalized : "any";
}

function normalizeRegionType(value) {
  const normalized = String(value || "any").trim().toLowerCase();
  return recommendationRegionTypes.has(normalized) ? normalized : "any";
}

function getEnglishRank(level) {
  const levelRanks = {
    a1_a2: 1,
    b1_b2: 2,
    c1_plus: 3,
    any: 0,
  };

  return levelRanks[normalizeEnglishRequirement(level)] || 0;
}

function getExperienceRank(level) {
  const levelRanks = {
    none: 0,
    little: 1,
    internships_or_projects: 2,
    already_working_in_field: 3,
    any: 0,
  };

  return levelRanks[normalizeExperienceRequirement(level)] ?? 0;
}

function buildRecommendationProfile(survey) {
  if (!survey) {
    return {
      has_survey: false,
      goal: "",
      goal_label: buildFallbackRoadmap().goal_label,
      english_level: "any",
      experience_level: "any",
      preferred_region_types: ["any"],
    };
  }

  const goal = String(survey.main_goal || "").trim().toLowerCase();
  let preferredRegionTypes = ["any"];

  if (goal === "study_abroad" || goal === "masters" || goal === "international_org") {
    preferredRegionTypes = ["international", "online", "hybrid"];
  } else if (goal === "civil_service" || goal === "national_company" || goal === "private_sector") {
    preferredRegionTypes = ["kazakhstan", "hybrid", "online"];
  }

  return {
    has_survey: true,
    goal,
    goal_label: getSurveyLabel("main_goal", goal) || buildFallbackRoadmap().goal_label,
    english_level: normalizeEnglishRequirement(survey.english_level),
    experience_level: normalizeExperienceRequirement(survey.current_experience),
    preferred_region_types: preferredRegionTypes,
  };
}

function inferInternshipMetadata(row) {
  const category = String(row.category || "").trim().toLowerCase();
  const fallbackMap = {
    ministries: {
      target_goals: ["civil_service", "international_org"],
      required_english_level: "b1_b2",
      experience_level: "little",
      region_type: "kazakhstan",
    },
    akimats: {
      target_goals: ["civil_service"],
      required_english_level: "a1_a2",
      experience_level: "little",
      region_type: "kazakhstan",
    },
    quasi: {
      target_goals: ["national_company", "private_sector"],
      required_english_level: "b1_b2",
      experience_level: "little",
      region_type: "kazakhstan",
    },
    online: {
      target_goals: ["international_org", "private_sector", "undecided"],
      required_english_level: "b1_b2",
      experience_level: "none",
      region_type: "online",
    },
    other: {
      target_goals: [],
      required_english_level: "any",
      experience_level: "any",
      region_type: "any",
    },
  };

  return fallbackMap[category] || fallbackMap.other;
}

function inferOpportunityMetadata(row) {
  const type = String(row.content_type || "").trim().toLowerCase();
  const fallbackMap = {
    grants: {
      target_goals: ["study_abroad", "masters", "undecided"],
      required_english_level: "b1_b2",
      experience_level: "none",
      region_type: "international",
    },
    scholarships: {
      target_goals: ["study_abroad", "masters"],
      required_english_level: "b1_b2",
      experience_level: "none",
      region_type: "international",
    },
    news: {
      target_goals: [],
      required_english_level: "any",
      experience_level: "any",
      region_type: "any",
    },
    articles: {
      target_goals: ["undecided", "international_org", "private_sector", "civil_service"],
      required_english_level: "any",
      experience_level: "none",
      region_type: "online",
    },
  };

  return fallbackMap[type] || fallbackMap.news;
}

function inferResourceMetadata(row) {
  const type = String(row.resource_type || "").trim().toLowerCase();
  const fallbackMap = {
    cv: {
      target_goals: ["civil_service", "international_org", "national_company", "private_sector", "undecided"],
      required_english_level: "any",
      experience_level: "none",
      region_type: "any",
    },
    interview: {
      target_goals: ["civil_service", "international_org", "national_company", "private_sector", "undecided"],
      required_english_level: "any",
      experience_level: "little",
      region_type: "any",
    },
    grants: {
      target_goals: ["study_abroad", "masters"],
      required_english_level: "b1_b2",
      experience_level: "none",
      region_type: "international",
    },
    internships: {
      target_goals: ["civil_service", "international_org", "national_company", "private_sector", "undecided"],
      required_english_level: "any",
      experience_level: "none",
      region_type: "kazakhstan",
    },
    career_start: {
      target_goals: ["undecided", "civil_service", "private_sector", "national_company"],
      required_english_level: "any",
      experience_level: "none",
      region_type: "any",
    },
  };

  return fallbackMap[type] || fallbackMap.career_start;
}

function getRecommendationMetadata(row, fallbackMetadata) {
  const fallback = fallbackMetadata || {};

  return {
    target_goals: normalizeTargetGoals(row.target_goals).length
      ? normalizeTargetGoals(row.target_goals)
      : normalizeTargetGoals(fallback.target_goals),
    required_english_level: normalizeEnglishRequirement(
      row.required_english_level || fallback.required_english_level
    ),
    experience_level: normalizeExperienceRequirement(
      row.experience_level || fallback.experience_level
    ),
    region_type: normalizeRegionType(row.region_type || fallback.region_type),
  };
}

function buildRecommendationForItem(row, survey, fallbackMetadata) {
  const metadata = getRecommendationMetadata(row, fallbackMetadata);
  const profile = buildRecommendationProfile(survey);

  if (!profile.has_survey) {
    return {
      score: 0,
      is_recommended: false,
      reasons: [],
      metadata,
    };
  }

  let score = 0;
  let signalCount = 0;
  const reasons = [];
  const goalMatch = metadata.target_goals.includes(profile.goal);
  const englishMatch =
    metadata.required_english_level !== "any" &&
    getEnglishRank(profile.english_level) >= getEnglishRank(metadata.required_english_level);
  const experienceMatch =
    metadata.experience_level !== "any" &&
    getExperienceRank(profile.experience_level) >= getExperienceRank(metadata.experience_level);
  const regionMatch =
    metadata.region_type !== "any" &&
    profile.preferred_region_types.includes(metadata.region_type);
  const hasSpecificMetadata =
    metadata.target_goals.length > 0 ||
    metadata.required_english_level !== "any" ||
    metadata.experience_level !== "any" ||
    metadata.region_type !== "any";

  if (goalMatch) {
    score += 5;
    signalCount += 1;
    reasons.push(`совпадает с вашей целью: ${profile.goal_label.toLowerCase()}`);
  }

  if (englishMatch) {
    score += 2;
    signalCount += 1;
    reasons.push(`уровень английского подходит: ${getSurveyLabel("english_level", profile.english_level)}`);
  }

  if (experienceMatch) {
    score += 2;
    signalCount += 1;
    reasons.push(`уровень опыта подходит: ${getSurveyLabel("current_experience", profile.experience_level)}`);
  }

  if (regionMatch) {
    score += 1;
    signalCount += 1;
    reasons.push("формат и регион совпадают с вашим треком");
  }

  return {
    score,
    is_recommended: goalMatch || (hasSpecificMetadata && signalCount >= 2 && score >= 4),
    reasons,
    metadata,
  };
}

function buildPersonalizationMeta(survey, items, entityLabel) {
  const profile = buildRecommendationProfile(survey);
  const recommendedCount = items.filter((item) => item.is_recommended).length;

  return {
    has_survey: profile.has_survey,
    goal_key: profile.goal,
    goal_label: profile.goal_label,
    recommended_count: recommendedCount,
    entity_label: entityLabel,
    section_title: profile.has_survey
      ? `Для вашей цели: ${profile.goal_label}`
      : "Стартовая подборка",
    section_description: profile.has_survey
      ? `Мы отобрали ${entityLabel.toLowerCase()}, которые лучше совпадают с вашей анкетой.`
      : `Заполненная анкета даст более точные рекомендации, а пока здесь базовые ${entityLabel.toLowerCase()}.`,
  };
}

function pickForGoalItems(items, limit = 3) {
  return items
    .filter((item) => item.is_recommended)
    .sort((left, right) => {
      if (right.recommendation_score !== left.recommendation_score) {
        return right.recommendation_score - left.recommendation_score;
      }

      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    })
    .slice(0, limit);
}

function normalizeSavedEntityType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return savedEntityTypes.has(normalized) ? normalized : "";
}

function normalizeSavedStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return savedStatuses.has(normalized) ? normalized : "saved";
}

async function logUserAction(userId, entityType, entityId, actionType, actionValue) {
  if (!userId) {
    return;
  }

  try {
    await pool.query(
      `
      INSERT INTO user_actions (user_id, entity_type, entity_id, action_type, action_value)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        userId,
        normalizeSavedEntityType(entityType) || String(entityType || "").trim().toLowerCase(),
        Number(entityId),
        String(actionType || "").trim().toLowerCase(),
        actionValue ? String(actionValue).trim().toLowerCase() : null,
      ]
    );
  } catch (err) {
    console.error("User action log error:", err);
  }
}

async function getSavedStatusMap(userId, entityType, entityIds) {
  if (!userId || !entityIds.length) {
    return new Map();
  }

  const result = await pool.query(
    `
    SELECT entity_id, saved_status
    FROM saved_items
    WHERE user_id = $1
      AND entity_type = $2
      AND entity_id = ANY($3::int[])
    `,
    [userId, entityType, entityIds]
  );

  return new Map(
    result.rows.map((row) => [Number(row.entity_id), normalizeSavedStatus(row.saved_status)])
  );
}

function buildSavedSummary(items) {
  const counts = {
    total: items.length,
    saved: 0,
    want_to_apply: 0,
    applied: 0,
  };

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const inTwoWeeks = addDays(now, 14);

  const upcomingDeadlines = items
    .filter((item) => item.deadline_date)
    .map((item) => {
      const deadlineDate = new Date(`${item.deadline_date}T00:00:00Z`);
      const msDiff = deadlineDate.getTime() - now.getTime();
      const daysLeft = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
      return {
        ...item,
        days_left: daysLeft,
      };
    })
    .filter((item) => {
      if (!item.deadline_date) {
        return false;
      }

      const deadlineDate = new Date(`${item.deadline_date}T00:00:00Z`);
      return deadlineDate >= now && deadlineDate <= inTwoWeeks;
    })
    .sort((left, right) => {
      return new Date(`${left.deadline_date}T00:00:00Z`).getTime()
        - new Date(`${right.deadline_date}T00:00:00Z`).getTime();
    });

  for (const item of items) {
    const status = normalizeSavedStatus(item.saved_status);
    if (counts[status] !== undefined) {
      counts[status] += 1;
    }
  }

  return {
    counts,
    upcoming_deadlines: upcomingDeadlines,
  };
}

async function getSavedItemsForUser(userId, options = {}) {
  if (!userId) {
    return { items: [], summary: buildSavedSummary([]) };
  }

  const requestedStatus = String(options.status || "").trim().toLowerCase();
  const limit = Number.parseInt(options.limit, 10);
  const hasStatusFilter = savedStatuses.has(requestedStatus);
  const limitClause = Number.isInteger(limit) && limit > 0 ? `LIMIT ${Math.min(limit, 50)}` : "";
  const params = hasStatusFilter ? [userId, requestedStatus] : [userId];
  const statusClause = hasStatusFilter ? "AND s.saved_status = $2" : "";

  const result = await pool.query(
    `
    SELECT
      s.id AS saved_id,
      s.entity_type,
      s.entity_id,
      s.saved_status,
      s.reminder_enabled,
      s.created_at AS saved_at,
      s.updated_at,
      i.title,
      i.organization,
      i.apply_url AS external_url,
      i.deadline_date,
      i.location AS subtitle,
      NULL::text AS deadline_label,
      '/internships'::text AS page_path
    FROM saved_items s
    JOIN internships i
      ON s.entity_type = 'internship'
     AND i.id = s.entity_id
    WHERE s.user_id = $1
      ${statusClause}

    UNION ALL

    SELECT
      s.id AS saved_id,
      s.entity_type,
      s.entity_id,
      s.saved_status,
      s.reminder_enabled,
      s.created_at AS saved_at,
      s.updated_at,
      o.title,
      o.organization,
      o.source_url AS external_url,
      o.deadline_date,
      o.country AS subtitle,
      o.deadline AS deadline_label,
      '/opportunities'::text AS page_path
    FROM saved_items s
    JOIN opportunities o
      ON s.entity_type = 'opportunity'
     AND o.id = s.entity_id
    WHERE s.user_id = $1
      ${statusClause}

    ORDER BY updated_at DESC, saved_id DESC
    ${limitClause}
    `,
    params
  );

  const items = result.rows.map((row) => ({
    id: Number(row.saved_id),
    entity_type: normalizeSavedEntityType(row.entity_type),
    entity_id: Number(row.entity_id),
    saved_status: normalizeSavedStatus(row.saved_status),
    reminder_enabled: row.reminder_enabled !== false,
    saved_at: row.saved_at,
    updated_at: row.updated_at,
    title: row.title,
    organization: row.organization,
    subtitle: row.subtitle,
    external_url: row.external_url,
    deadline_date: serializeDateOnly(row.deadline_date),
    deadline_label: row.deadline_label,
    page_path: row.page_path,
  }));

  return {
    items,
    summary: buildSavedSummary(items),
  };
}

async function findSavableEntity(entityType, entityId) {
  if (!Number.isInteger(entityId) || entityId <= 0) {
    return null;
  }

  if (entityType === "internship") {
    const result = await pool.query(
      "SELECT id FROM internships WHERE id = $1 LIMIT 1",
      [entityId]
    );
    return result.rows[0] || null;
  }

  if (entityType === "opportunity") {
    const result = await pool.query(
      "SELECT id FROM opportunities WHERE id = $1 LIMIT 1",
      [entityId]
    );
    return result.rows[0] || null;
  }

  return null;
}

function getSubscriptionPlanConfig(planId) {
  return SUBSCRIPTION_PLANS[String(planId || "").trim()] || null;
}

function serializeSubscriptionPlanCatalog() {
  return Object.values(SUBSCRIPTION_PLANS);
}

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + Number(days || 0));
  return value;
}

function isSubscriptionActiveRecord(subscription, now = new Date()) {
  if (!subscription || !subscription.active) {
    return false;
  }

  if (!subscription.expires_at) {
    return true;
  }

  const expiresAt = new Date(subscription.expires_at);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt > now;
}

function serializeSubscription(subscription) {
  if (!subscription) {
    return null;
  }

  return {
    id: subscription.id,
    plan: subscription.plan,
    active: isSubscriptionActiveRecord(subscription),
    status: subscription.status,
    amount: subscription.amount,
    base_amount: subscription.base_amount,
    access_days: subscription.access_days,
    payment_method: subscription.payment_method,
    payment_code: subscription.payment_code,
    prepared_at: subscription.prepared_at,
    submitted_at: subscription.submitted_at,
    started_at: subscription.started_at,
    expires_at: subscription.expires_at,
    reviewed_at: subscription.reviewed_at,
    review_note: subscription.review_note,
  };
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

function hashVerificationToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function buildAppUrl(pathname) {
  const baseUrl = APP_BASE_URL.replace(/\/+$/g, "");
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${baseUrl}${normalizedPath}`;
}

function generateSubscriptionPaymentCode(planId) {
  const normalizedPlan = String(planId || "subscription")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase() || "SB";
  const timestampPart = Date.now().toString().slice(-4);
  const randomPart = crypto.randomInt(10, 100);
  return `${normalizedPlan}-${timestampPart}${randomPart}`;
}

async function allocateUniqueSubscriptionAmount(client, baseAmount, userId) {
  const normalizedBaseAmount = Number(baseAmount || 0);
  await client.query("SELECT pg_advisory_xact_lock($1)", [normalizedBaseAmount]);

  const result = await client.query(
    `
    SELECT amount
    FROM subscriptions
    WHERE status IN ('payment_pending', 'pending_manual_review')
      AND amount IS NOT NULL
      AND amount BETWEEN $1 AND $2
      AND ($3::integer IS NULL OR user_id <> $3)
    `,
    [normalizedBaseAmount + 1, normalizedBaseAmount + 99, userId || null]
  );

  const usedAmounts = new Set(
    result.rows
      .map((row) => Number(row.amount))
      .filter((value) => Number.isInteger(value) && value > normalizedBaseAmount)
  );

  const now = new Date();
  const seed = (now.getMinutes() * 60) + now.getSeconds();
  for (let index = 0; index < 99; index += 1) {
    const suffix = ((seed + index) % 99) + 1;
    const candidateAmount = normalizedBaseAmount + suffix;
    if (!usedAmounts.has(candidateAmount)) {
      return candidateAmount;
    }
  }

  return normalizedBaseAmount;
}

function isEmailDeliveryConfigured() {
  return Boolean(SMTP_URL || (SMTP_HOST && SMTP_USER && SMTP_PASS));
}

function getMailTransporter() {
  if (mailTransporter) {
    return mailTransporter;
  }

  if (SMTP_URL) {
    mailTransporter = nodemailer.createTransport(SMTP_URL);
    return mailTransporter;
  }

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    mailTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE || SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
    return mailTransporter;
  }

  // Development fallback: keep the flow testable even if SMTP is not configured yet.
  mailTransporter = nodemailer.createTransport({
    jsonTransport: true,
  });
  return mailTransporter;
}

async function createEmailVerificationToken(userId) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashVerificationToken(rawToken);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TOKEN_TTL_MINUTES * 60 * 1000);

  await pool.query(
    "DELETE FROM email_verification_tokens WHERE user_id = $1 AND used_at IS NULL",
    [userId]
  );

  await pool.query(
    `
    INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    `,
    [userId, tokenHash, expiresAt.toISOString()]
  );

  return {
    token: rawToken,
    expiresAt,
  };
}

async function createPasswordResetToken(userId) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashVerificationToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await pool.query(
    "DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL",
    [userId]
  );

  await pool.query(
    `
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    `,
    [userId, tokenHash, expiresAt.toISOString()]
  );

  return {
    token: rawToken,
    expiresAt,
  };
}

async function sendVerificationEmail(email, token) {
  const verifyUrl = buildAppUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  const transporter = getMailTransporter();

  const info = await transporter.sendMail({
    from: MAIL_FROM,
    to: email,
    subject: "Подтвердите ваш аккаунт",
    text: [
      "Здравствуйте!",
      "",
      "Чтобы подтвердить аккаунт, откройте ссылку:",
      verifyUrl,
      "",
      `Ссылка действует ${EMAIL_VERIFY_TOKEN_TTL_MINUTES} минут.`,
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;">
        <h2 style="margin-bottom:16px;">Подтвердите ваш аккаунт</h2>
        <p style="margin-bottom:16px;">Нажмите на кнопку ниже, чтобы завершить регистрацию.</p>
        <p style="margin-bottom:24px;">
          <a href="${verifyUrl}" style="display:inline-block;padding:12px 20px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:8px;">
            Подтвердить почту
          </a>
        </p>
        <p style="margin-bottom:8px;">Если кнопка не открывается, используйте эту ссылку:</p>
        <p style="word-break:break-all;">${verifyUrl}</p>
        <p style="margin-top:24px;color:#475569;">Ссылка действует ${EMAIL_VERIFY_TOKEN_TTL_MINUTES} минут.</p>
      </div>
    `,
  });

  if (!isEmailDeliveryConfigured()) {
    console.warn("SMTP is not configured. Verification link for %s: %s", email, verifyUrl);
    console.warn("Local email preview payload: %s", info.message);
  }

  return {
    verifyUrl,
    delivered: isEmailDeliveryConfigured(),
  };
}

async function sendPasswordResetEmail(email, token) {
  const resetUrl = buildAppUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  const transporter = getMailTransporter();

  const info = await transporter.sendMail({
    from: MAIL_FROM,
    to: email,
    subject: "Сброс пароля KazYouthDiplomacy",
    text: [
      "Здравствуйте!",
      "",
      "Чтобы задать новый пароль, откройте ссылку:",
      resetUrl,
      "",
      `Ссылка действует ${PASSWORD_RESET_TOKEN_TTL_MINUTES} минут.`,
      "Если вы не запрашивали сброс, просто проигнорируйте это письмо.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;">
        <h2 style="margin-bottom:16px;">Сброс пароля</h2>
        <p style="margin-bottom:16px;">Нажмите на кнопку ниже, чтобы задать новый пароль для аккаунта KazYouthDiplomacy.</p>
        <p style="margin-bottom:24px;">
          <a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:8px;">
            Задать новый пароль
          </a>
        </p>
        <p style="margin-bottom:8px;">Если кнопка не открывается, используйте эту ссылку:</p>
        <p style="word-break:break-all;">${resetUrl}</p>
        <p style="margin-top:24px;color:#475569;">Ссылка действует ${PASSWORD_RESET_TOKEN_TTL_MINUTES} минут. Если вы не запрашивали сброс, ничего делать не нужно.</p>
      </div>
    `,
  });

  if (!isEmailDeliveryConfigured()) {
    console.warn("SMTP is not configured. Password reset link for %s: %s", email, resetUrl);
    console.warn("Local password reset preview payload: %s", info.message);
  }

  return {
    resetUrl,
    delivered: isEmailDeliveryConfigured(),
  };
}

function renderVerificationPage(title, message, actionHref, actionLabel) {
  const safeActionHref = actionHref || "/login";
  const safeActionLabel = actionLabel || "Перейти ко входу";

  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          min-height: 100vh;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #0f172a, #1e293b);
          color: #e2e8f0;
        }
        .card {
          width: min(92vw, 520px);
          background: rgba(15, 23, 42, 0.92);
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 18px;
          padding: 32px;
          box-shadow: 0 20px 60px rgba(2, 6, 23, 0.45);
        }
        h1 {
          margin-top: 0;
          margin-bottom: 16px;
          font-size: 28px;
        }
        p {
          margin: 0 0 24px;
          color: #cbd5e1;
          line-height: 1.6;
        }
        a {
          display: inline-block;
          padding: 12px 18px;
          border-radius: 10px;
          background: #38bdf8;
          color: #082f49;
          text-decoration: none;
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <main class="card">
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="${safeActionHref}">${safeActionLabel}</a>
      </main>
    </body>
    </html>
  `;
}

async function invalidateSessionsForUser(userId) {
  if (!userId) {
    return;
  }

  try {
    await pool.query(
      `
      DELETE FROM user_sessions
      WHERE sess::jsonb ->> 'userId' = $1
      `,
      [String(userId)]
    );
  } catch (err) {
    console.error("Failed to invalidate sessions for user:", err);
  }
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

async function canManageSubscriptions(req) {
  const userId = req.session.userId;
  const sessionEmail = normalizeEmail(req.session.email);
  const sessionRole = String(req.session.role || "").toLowerCase();
  const configuredEmails = new Set([
    ...parseManagerEmails(process.env.SUBSCRIPTION_MANAGER_EMAIL),
    ...parseManagerEmails(process.env.SUBSCRIPTION_MANAGER_EMAILS),
  ]);

  if (OPPORTUNITIES_ADMIN_EMAIL) {
    configuredEmails.add(OPPORTUNITIES_ADMIN_EMAIL);
  }

  if (sessionRole === "admin") {
    return true;
  }

  if (sessionEmail && configuredEmails.has(sessionEmail)) {
    return true;
  }

  if (!userId) {
    return false;
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
  const userRole = String(user.role || "").toLowerCase();

  return userRole === "admin" || configuredEmails.has(userEmail);
}

async function getCurrentSubscriptionForUser(userId) {
  const result = await pool.query(
    `
    SELECT
      id,
      user_id,
      plan,
      active,
      status,
      order_id,
      started_at,
      expires_at,
      amount,
      base_amount,
      access_days,
      payment_method,
      payment_code,
      prepared_at,
      submitted_at,
      reviewed_at,
      review_note
    FROM subscriptions
    WHERE user_id = $1
    ORDER BY id DESC
    LIMIT 1
    `,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const subscription = result.rows[0];
  if (
    subscription.active &&
    subscription.status === "active" &&
    subscription.expires_at &&
    new Date(subscription.expires_at) <= new Date()
  ) {
    const updated = await pool.query(
      `
      UPDATE subscriptions
      SET active = false,
          status = 'expired'
      WHERE id = $1
      RETURNING
        id,
        user_id,
        plan,
        active,
        status,
        order_id,
        started_at,
        expires_at,
        amount,
        base_amount,
        access_days,
        payment_method,
        payment_code,
        prepared_at,
        submitted_at,
        reviewed_at,
        review_note
      `,
      [subscription.id]
    );
    return updated.rows[0];
  }

  return subscription;
}

async function userHasActiveSubscription(userId) {
  const subscription = await getCurrentSubscriptionForUser(userId);
  return isSubscriptionActiveRecord(subscription);
}

function buildAccessPolicy(hasPlusAccess, subscription) {
  const normalizedStatus = String(subscription?.status || "").trim().toLowerCase();

  if (hasPlusAccess) {
    return {
      stage: "plus_active",
      access_label: "Plus",
      access_message: "Plus активен: открыт полный каталог, персональный roadmap, рекомендации и сохранения.",
      restrictions_message: "Ограничения Free сейчас не действуют.",
      pending_review: false,
      keeps_free_access: false,
      requires_admin_confirmation: false,
      preview_limits: null,
      upgrade_cta_label: "Plus уже активен",
      upgrade_cta_href: "/dashboard",
    };
  }

  if (normalizedStatus === "payment_pending") {
    return {
      stage: "payment_pending",
      access_label: "Free до подтверждения Plus",
      access_message: "Заявка на оплату подготовлена, но доступ пока остаётся на уровне Free. Plus включится только после оплаты и подтверждения.",
      restrictions_message: "Пока заявка не подтверждена, действуют ограничения Free: часть базы, без roadmap, рекомендаций и сохранений.",
      pending_review: false,
      keeps_free_access: true,
      requires_admin_confirmation: true,
      preview_limits: FREE_PREVIEW_LIMITS,
      upgrade_cta_label: "Завершить оплату",
      upgrade_cta_href: "/subscribe",
    };
  }

  if (normalizedStatus === "pending_manual_review") {
    return {
      stage: "pending_manual_review",
      access_label: "Free до подтверждения оплаты",
      access_message: "Оплата отправлена на проверку. Пока админ не подтвердит платёж, у пользователя остаётся только Free-доступ.",
      restrictions_message: "До подтверждения оплаты доступны только лимиты Free: часть базы, без roadmap, рекомендаций и сохранений.",
      pending_review: true,
      keeps_free_access: true,
      requires_admin_confirmation: true,
      preview_limits: FREE_PREVIEW_LIMITS,
      upgrade_cta_label: "Ждём подтверждение",
      upgrade_cta_href: "/subscribe",
    };
  }

  if (normalizedStatus === "expired") {
    return {
      stage: "expired",
      access_label: "Free после окончания Plus",
      access_message: "Срок Plus закончился. Пользователь автоматически возвращается на Free, пока не продлит доступ.",
      restrictions_message: "После окончания Plus снова действуют ограничения Free: часть базы, без roadmap, рекомендаций и сохранений.",
      pending_review: false,
      keeps_free_access: true,
      requires_admin_confirmation: false,
      preview_limits: FREE_PREVIEW_LIMITS,
      upgrade_cta_label: "Продлить Plus",
      upgrade_cta_href: "/subscribe",
    };
  }

  if (normalizedStatus === "rejected") {
    return {
      stage: "rejected",
      access_label: "Free",
      access_message: "Заявка отклонена, поэтому доступ остаётся только на уровне Free.",
      restrictions_message: "До новой подтверждённой оплаты работают только ограничения Free: часть базы, без roadmap, рекомендаций и сохранений.",
      pending_review: false,
      keeps_free_access: true,
      requires_admin_confirmation: false,
      preview_limits: FREE_PREVIEW_LIMITS,
      upgrade_cta_label: "Создать новую заявку",
      upgrade_cta_href: "/subscribe",
    };
  }

  return {
    stage: "free",
    access_label: "Free",
    access_message: "Free даёт мягкий вход: часть стажировок, часть возможностей и часть материалов без оплаты.",
    restrictions_message: "На Free недоступны полный каталог, персональный roadmap, рекомендации и сохранения.",
    pending_review: false,
    keeps_free_access: true,
    requires_admin_confirmation: false,
    preview_limits: FREE_PREVIEW_LIMITS,
    upgrade_cta_label: "Открыть Plus",
    upgrade_cta_href: "/subscribe",
  };
}

function buildFeatureAccess(hasPlusAccess) {
  return {
    full_catalog: hasPlusAccess,
    roadmap: hasPlusAccess,
    recommendations: hasPlusAccess,
    saved_items: hasPlusAccess,
    preview_limits: hasPlusAccess ? null : FREE_PREVIEW_LIMITS,
  };
}

function buildAccessState(hasPlusAccess, subscription = null) {
  return {
    access_tier: hasPlusAccess ? "plus" : "free",
    has_plus_access: hasPlusAccess,
    feature_access: buildFeatureAccess(hasPlusAccess),
    access_policy: buildAccessPolicy(hasPlusAccess, subscription),
  };
}

function getPreviewLimit(entityType) {
  if (entityType === "internship") {
    return FREE_INTERNSHIP_PREVIEW_LIMIT;
  }

  if (entityType === "resource") {
    return FREE_RESOURCE_PREVIEW_LIMIT;
  }

  return FREE_OPPORTUNITY_PREVIEW_LIMIT;
}

function applyCatalogAccessPolicy(items, options = {}) {
  const hasPlusAccess = Boolean(options.hasPlusAccess);
  const entityType = String(options.entityType || "opportunity");
  const teaserLimit = Math.max(1, Math.min(2, getPreviewLimit(entityType)));

  if (hasPlusAccess) {
    return {
      visible_items: items,
      for_goal_items: pickForGoalItems(items),
      personalization: {
        ...buildPersonalizationMeta(options.survey, items, options.entityLabel || "материалы"),
        upgrade_required: false,
      },
      access: buildAccessState(true, options.subscription),
    };
  }

  const previewLimit = getPreviewLimit(entityType);
  const teaserItems = pickForGoalItems(items, teaserLimit);
  const visibleItems = options.requestedFilter === "recommended"
    ? teaserItems
    : items.slice(0, previewLimit);

  return {
    visible_items: visibleItems,
    for_goal_items: teaserItems.slice(0, 1),
    personalization: {
      ...buildPersonalizationMeta(options.survey, items, options.entityLabel || "материалы"),
      upgrade_required: true,
      section_title: "Персональная подборка доступна в Plus",
      section_description: `На Free вы видите только часть базы. Лимиты Free: ${FREE_PREVIEW_LIMITS.internships} стажировок, ${FREE_PREVIEW_LIMITS.opportunities} возможностей и ${FREE_PREVIEW_LIMITS.resources} материалов. Plus открывает полный каталог, roadmap, подборки и инструменты для трекинга.`,
    },
    access: buildAccessState(false, options.subscription),
  };
}

async function requireSubscriptionManager(req, res, next) {
  if (await canManageSubscriptions(req)) {
    return next();
  }

  if (wantsJson(req)) {
    return res.status(403).json({ error: "Subscription manager access required" });
  }

  return res.redirect("/dashboard");
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

const loginRateLimiter = createAuthRateLimiter({
  windowMinutes: LOGIN_RATE_LIMIT_WINDOW_MINUTES,
  maxAttempts: LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  skipSuccessfulRequests: true,
  message: "Слишком много попыток входа. Попробуйте снова немного позже.",
  redirectPath: "/login",
});

const registerRateLimiter = createAuthRateLimiter({
  windowMinutes: REGISTER_RATE_LIMIT_WINDOW_MINUTES,
  maxAttempts: REGISTER_RATE_LIMIT_MAX_ATTEMPTS,
  skipSuccessfulRequests: false,
  message: "Слишком много попыток регистрации. Попробуйте снова немного позже.",
  redirectPath: "/register",
});

const resendVerificationRateLimiter = createAuthRateLimiter({
  windowMinutes: RESEND_RATE_LIMIT_WINDOW_MINUTES,
  maxAttempts: RESEND_RATE_LIMIT_MAX_ATTEMPTS,
  skipSuccessfulRequests: false,
  message: "Слишком много запросов на повторную отправку письма. Попробуйте позже.",
  redirectPath: "/login",
});

const forgotPasswordRateLimiter = createAuthRateLimiter({
  windowMinutes: FORGOT_RATE_LIMIT_WINDOW_MINUTES,
  maxAttempts: FORGOT_RATE_LIMIT_MAX_ATTEMPTS,
  skipSuccessfulRequests: false,
  message: "Слишком много запросов на сброс пароля. Попробуйте позже.",
  redirectPath: "/forgot-password",
});

const resetPasswordRateLimiter = createAuthRateLimiter({
  windowMinutes: RESET_RATE_LIMIT_WINDOW_MINUTES,
  maxAttempts: RESET_RATE_LIMIT_MAX_ATTEMPTS,
  skipSuccessfulRequests: false,
  message: "Слишком много попыток сброса пароля. Попробуйте позже.",
  redirectPath: "/forgot-password",
});

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

app.get("/forgot-password", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "forgot-password.html"))
);

app.get("/forgot-password.html", (req, res) =>
  res.redirect("/forgot-password")
);

app.get("/reset-password", async (req, res) => {
  const token = String(req.query.token || "").trim();

  if (!token) {
    return res
      .status(400)
      .send(renderVerificationPage("Ссылка неполная", "В ссылке нет токена для сброса пароля.", "/forgot-password", "Запросить новую ссылку"));
  }

  try {
    const tokenHash = hashVerificationToken(token);
    const result = await pool.query(
      `
      SELECT id, user_id, expires_at, used_at
      FROM password_reset_tokens
      WHERE token_hash = $1
      LIMIT 1
      `,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res
        .status(400)
        .send(renderVerificationPage("Ссылка недействительна", "Этот токен сброса не найден или уже заменён новым.", "/forgot-password", "Запросить новую ссылку"));
    }

    const resetToken = result.rows[0];
    const expiresAt = new Date(resetToken.expires_at);

    if (resetToken.used_at) {
      return res
        .status(400)
        .send(renderVerificationPage("Ссылка уже использована", "Этот токен сброса уже был использован. Запросите новую ссылку, если пароль всё ещё нужно сменить.", "/forgot-password", "Запросить новую ссылку"));
    }

    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      return res
        .status(400)
        .send(renderVerificationPage("Ссылка истекла", "Срок действия ссылки для сброса пароля закончился. Запросите новую ссылку.", "/forgot-password", "Запросить новую ссылку"));
    }

    return res.sendFile(path.join(__dirname, "public", "reset-password.html"));
  } catch (err) {
    console.error("Reset password page error:", err);
    return res
      .status(500)
      .send(renderVerificationPage("Ошибка", "Не получилось открыть страницу сброса пароля. Попробуйте ещё раз немного позже.", "/forgot-password", "Запросить новую ссылку"));
  }
});

app.get("/reset-password.html", (req, res) => {
  const token = String(req.query.token || "").trim();
  const suffix = token ? `?token=${encodeURIComponent(token)}` : "";
  return res.redirect(`/reset-password${suffix}`);
});

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

app.get("/subscribe", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "subscribe.html"))
);

app.get("/opportunities", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "opportunities.html"))
);

app.get("/resources", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "resources.html"))
);

app.get("/opportunities.html", (req, res) =>
  res.redirect("/opportunities")
);

app.get("/resources.html", (req, res) =>
  res.redirect("/resources")
);

app.get("/subscriptions-review", requireAuth, requireSubscriptionManager, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "subscriptions-review.html"))
);

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.status(200).json({
      ok: true,
      db: "up",
      uptime_seconds: Math.round(process.uptime()),
    });
  } catch (err) {
    console.error("Health check error:", err);
    return res.status(503).json({
      ok: false,
      db: "down",
    });
  }
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

app.post("/register", registerRateLimiter, async (req, res) => {
  if (!req.session.preRegisterSurveyCompleted || !req.session.preRegisterSurvey) {
    return res.redirect("/register-survey?error=required");
  }

  const {
    firstName,
    lastName,
    birthDate,
    university,
    workplace,
    email,
    password,
    confirmPassword,
  } = req.body;
  const normalizedFirstName = normalizeProfileText(firstName);
  const normalizedLastName = normalizeProfileText(lastName);
  const normalizedBirthDate = parseBirthDate(birthDate);
  const normalizedUniversity = normalizeProfileText(university);
  const normalizedWorkplace = normalizeProfileText(workplace);
  const normalizedEmail = normalizeEmail(email);

  if (
    !normalizedFirstName ||
    !normalizedLastName ||
    !normalizedBirthDate ||
    !normalizedUniversity ||
    !normalizedEmail ||
    !password ||
    !confirmPassword ||
    normalizedFirstName.length > 80 ||
    normalizedLastName.length > 80 ||
    normalizedUniversity.length > 180 ||
    normalizedWorkplace.length > 180
  ) {
    console.warn("Register failed: invalid input");
    return res.redirect("/register?error=invalid");
  }

  if (password !== confirmPassword) {
    console.warn("Register failed: passwords do not match");
    return res.redirect("/register?error=password-match");
  }

  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.ok) {
    console.warn("Register failed: weak password");
    return res.redirect("/register?error=password-weak");
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
    /*
        error: "Сначала получите точную сумму для оплаты по выбранному тарифу.",
      });
    }

    */
    const result = await pool.query(
      `
      INSERT INTO users (
        first_name,
        last_name,
        birth_date,
        university,
        workplace,
        email,
        password,
        is_verified
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, false)
      RETURNING *
      `,
      [
        normalizedFirstName,
        normalizedLastName,
        normalizedBirthDate,
        normalizedUniversity,
        normalizedWorkplace || null,
        normalizedEmail,
        hashed,
      ]
    );

    const user = result.rows[0];

    if (!EMAIL_VERIFICATION_ENABLED) {
      await pool.query(
        `
        UPDATE users
        SET is_verified = true,
            email_verified_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [user.id]
      );
      user.is_verified = true;
      user.email_verified_at = new Date();
    }

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

    req.session.preRegisterSurvey = null;
    req.session.preRegisterSurveyCompleted = false;

    if (!EMAIL_VERIFICATION_ENABLED) {
      return saveSessionAndRedirect(req, res, user, "/dashboard");
    }

    const { token } = await createEmailVerificationToken(user.id);
    let verificationNotice = "verify-email";

    try {
      const delivery = await sendVerificationEmail(user.email, token);
      if (!delivery.delivered) {
        verificationNotice = "verify-email-preview";
      }
    } catch (emailErr) {
      console.error("Verification email send error:", emailErr);
      verificationNotice = "verify-email-error";
    }

    return req.session.save((saveErr) => {
      if (saveErr) {
        console.error("Session save error after register:", saveErr);
      }

      return res.redirect(
        `/login?notice=${encodeURIComponent(verificationNotice)}&email=${encodeURIComponent(user.email)}`
      );
    });
  } catch (err) {
    console.error("Register server error:", err);
    return res.redirect("/register?error=server");
  }
});

app.get("/verify-email", async (req, res) => {
  if (!EMAIL_VERIFICATION_ENABLED) {
    return res.send(
      renderVerificationPage(
        "Подтверждение отключено",
        "Сейчас подтверждение почты временно выключено. Можно просто войти в аккаунт.",
        "/login",
        "Войти"
      )
    );
  }

  const token = String(req.query.token || "").trim();

  if (!token) {
    return res
      .status(400)
      .send(renderVerificationPage("Ссылка неполная", "В ссылке нет токена подтверждения.", "/login", "Ко входу"));
  }

  try {
    const tokenHash = hashVerificationToken(token);
    const result = await pool.query(
      `
      SELECT
        evt.id,
        evt.user_id,
        evt.expires_at,
        evt.used_at,
        u.email,
        u.role,
        u.is_verified
      FROM email_verification_tokens evt
      JOIN users u ON u.id = evt.user_id
      WHERE evt.token_hash = $1
      LIMIT 1
      `,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res
        .status(400)
        .send(renderVerificationPage("Ссылка недействительна", "Этот токен подтверждения не найден или уже заменён новым.", "/login", "Ко входу"));
    }

    const verification = result.rows[0];
    const expiresAt = new Date(verification.expires_at);

    if (verification.used_at || verification.is_verified) {
      return res.send(
        renderVerificationPage(
          "Почта уже подтверждена",
          "Этот аккаунт уже активирован. Можно просто войти в систему.",
          "/login",
          "Войти"
        )
      );
    }

    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      return res
        .status(400)
        .send(renderVerificationPage("Ссылка истекла", "Срок действия ссылки закончился. Запросите письмо повторно на странице входа.", "/login", "Запросить заново"));
    }

    await pool.query(
      `
      UPDATE users
      SET is_verified = true,
          email_verified_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [verification.user_id]
    );

    await pool.query(
      "UPDATE email_verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1",
      [verification.id]
    );

    return saveSessionAndRedirect(
      req,
      res,
      {
        id: verification.user_id,
        email: verification.email,
        role: verification.role,
      },
      "/dashboard"
    );
  } catch (err) {
    console.error("Verify email error:", err);
    return res
      .status(500)
      .send(renderVerificationPage("Ошибка подтверждения", "Не получилось подтвердить почту. Попробуйте ещё раз немного позже.", "/login", "Ко входу"));
  }
});

app.post("/resend-verification", resendVerificationRateLimiter, async (req, res) => {
  if (!EMAIL_VERIFICATION_ENABLED) {
    if (wantsJson(req)) {
      return res.json({ ok: true, message: "Подтверждение почты сейчас отключено." });
    }
    return res.redirect("/login");
  }

  const email = normalizeEmail(req.body.email);
  const respondWithJson = wantsJson(req);

  if (!email) {
    if (respondWithJson) {
      return res.status(400).json({ error: "Укажите email для повторной отправки." });
    }
    return res.redirect("/login?error=invalid");
  }

  try {
    const result = await pool.query(
      "SELECT id, email, is_verified FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      const genericMessage = "Если аккаунт существует, письмо отправлено повторно.";
      if (respondWithJson) {
        return res.json({ ok: true, message: genericMessage });
      }
      return res.redirect(`/login?notice=verify-email&email=${encodeURIComponent(email)}`);
    }

    const user = result.rows[0];
    if (user.is_verified) {
      const message = "Этот аккаунт уже подтверждён. Можно входить.";
      if (respondWithJson) {
        return res.json({ ok: true, message });
      }
      return res.redirect(`/login?notice=already-verified&email=${encodeURIComponent(user.email)}`);
    }

    const lastTokenResult = await pool.query(
      `
      SELECT created_at
      FROM email_verification_tokens
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [user.id]
    );

    const lastCreatedAt = lastTokenResult.rows[0]?.created_at
      ? new Date(lastTokenResult.rows[0].created_at)
      : null;

    if (
      lastCreatedAt &&
      Date.now() - lastCreatedAt.getTime() < EMAIL_RESEND_COOLDOWN_SECONDS * 1000
    ) {
      const waitMessage = `Подождите ${EMAIL_RESEND_COOLDOWN_SECONDS} сек. перед повторной отправкой.`;
      if (respondWithJson) {
        return res.status(429).json({ error: waitMessage });
      }
      return res.redirect(`/login?error=verify-rate&email=${encodeURIComponent(user.email)}`);
    }

    const { token } = await createEmailVerificationToken(user.id);
    const delivery = await sendVerificationEmail(user.email, token);
    const message = delivery.delivered
      ? "Письмо отправлено повторно. Проверьте входящие и папку Спам."
      : "SMTP пока не настроен. Ссылка для подтверждения выведена в логах сервера.";

    if (respondWithJson) {
      return res.json({ ok: true, message, delivered: delivery.delivered });
    }

    const noticeCode = delivery.delivered ? "verify-resent" : "verify-email-preview";
    return res.redirect(`/login?notice=${noticeCode}&email=${encodeURIComponent(user.email)}`);
  } catch (err) {
    console.error("Resend verification error:", err);
    const message = "Не удалось отправить письмо повторно.";
    if (respondWithJson) {
      return res.status(500).json({ error: message });
    }
    return res.redirect(`/login?error=server&email=${encodeURIComponent(email)}`);
  }
});

app.post("/forgot-password", forgotPasswordRateLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const respondWithJson = wantsJson(req);
  const genericMessage = "Если аккаунт с таким email существует, мы отправили ссылку для сброса пароля.";

  if (!email) {
    if (respondWithJson) {
      return res.status(400).json({ error: "Укажите email для сброса пароля." });
    }
    return res.redirect("/forgot-password?error=invalid");
  }

  try {
    const result = await pool.query(
      "SELECT id, email FROM users WHERE email = $1 LIMIT 1",
      [email]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const { token } = await createPasswordResetToken(user.id);
      const delivery = await sendPasswordResetEmail(user.email, token);

      if (respondWithJson) {
        return res.json({
          ok: true,
          message: delivery.delivered
            ? genericMessage
            : "SMTP пока не настроен. Ссылка для сброса выведена в логах сервера.",
          delivered: delivery.delivered,
        });
      }

      const notice = delivery.delivered ? "reset-sent" : "reset-preview";
      return res.redirect(`/forgot-password?notice=${notice}&email=${encodeURIComponent(email)}`);
    }

    if (respondWithJson) {
      return res.json({ ok: true, message: genericMessage });
    }

    return res.redirect(`/forgot-password?notice=reset-sent&email=${encodeURIComponent(email)}`);
  } catch (err) {
    console.error("Forgot password error:", err);
    if (respondWithJson) {
      return res.status(500).json({ error: "Не удалось отправить письмо для сброса пароля." });
    }
    return res.redirect(`/forgot-password?error=server&email=${encodeURIComponent(email)}`);
  }
});

app.post("/reset-password", resetPasswordRateLimiter, async (req, res) => {
  const token = String(req.body.token || "").trim();
  const password = String(req.body.password || "");
  const confirmPassword = String(req.body.confirmPassword || "");
  const respondWithJson = wantsJson(req);

  if (!token) {
    if (respondWithJson) {
      return res.status(400).json({ error: "Missing reset token" });
    }
    return res.redirect("/forgot-password?error=reset-invalid");
  }

  if (!password || !confirmPassword) {
    if (respondWithJson) {
      return res.status(400).json({ error: "Введите новый пароль и его подтверждение." });
    }
    return res.redirect(`/reset-password?token=${encodeURIComponent(token)}&error=invalid`);
  }

  if (password !== confirmPassword) {
    if (respondWithJson) {
      return res.status(400).json({ error: "Пароли должны совпадать." });
    }
    return res.redirect(`/reset-password?token=${encodeURIComponent(token)}&error=password-match`);
  }

  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.ok) {
    if (respondWithJson) {
      return res.status(400).json({ error: passwordValidation.error });
    }
    return res.redirect(`/reset-password?token=${encodeURIComponent(token)}&error=password-weak`);
  }

  try {
    const tokenHash = hashVerificationToken(token);
    const result = await pool.query(
      `
      SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at, u.email
      FROM password_reset_tokens prt
      JOIN users u ON u.id = prt.user_id
      WHERE prt.token_hash = $1
      LIMIT 1
      `,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      if (respondWithJson) {
        return res.status(400).json({ error: "Ссылка для сброса недействительна." });
      }
      return res.redirect("/forgot-password?error=reset-invalid");
    }

    const resetToken = result.rows[0];
    const expiresAt = new Date(resetToken.expires_at);

    if (resetToken.used_at) {
      if (respondWithJson) {
        return res.status(400).json({ error: "Ссылка уже использована." });
      }
      return res.redirect("/forgot-password?error=reset-used");
    }

    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      if (respondWithJson) {
        return res.status(400).json({ error: "Ссылка для сброса истекла." });
      }
      return res.redirect("/forgot-password?error=reset-expired");
    }

    const hashed = await bcrypt.hash(password, 10);
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashed, resetToken.user_id]);
    await pool.query("UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1", [resetToken.id]);
    await pool.query("DELETE FROM password_reset_tokens WHERE user_id = $1 AND id <> $2", [resetToken.user_id, resetToken.id]);
    await invalidateSessionsForUser(resetToken.user_id);

    if (req.session && req.session.userId === resetToken.user_id) {
      await new Promise((resolve) => req.session.destroy(() => resolve()));
      res.clearCookie(SESSION_COOKIE_NAME);
    }

    if (respondWithJson) {
      return res.json({ ok: true, message: "Пароль обновлён. Теперь можно войти с новым паролем." });
    }

    return res.redirect(`/login?notice=password-reset-success&email=${encodeURIComponent(resetToken.email)}`);
  } catch (err) {
    console.error("Reset password error:", err);
    if (respondWithJson) {
      return res.status(500).json({ error: "Не удалось обновить пароль." });
    }
    return res.redirect(`/reset-password?token=${encodeURIComponent(token)}&error=server`);
  }
});

/* ======================
   LOGIN
====================== */

app.post("/login", loginRateLimiter, async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const invalidLoginRedirect = "/login?error=credentials";

  if (!normalizedEmail || !password) {
    console.warn("Login failed: invalid input");
    return res.redirect(invalidLoginRedirect);
  }

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      console.warn("Login failed: user not found", normalizedEmail);
      return res.redirect(invalidLoginRedirect);
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
      return res.redirect(invalidLoginRedirect);
    }

    if (!EMAIL_VERIFICATION_ENABLED && user.is_verified === false) {
      await pool.query(
        `
        UPDATE users
        SET is_verified = true,
            email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP)
        WHERE id = $1
        `,
        [user.id]
      );
      user.is_verified = true;
    }

    if (EMAIL_VERIFICATION_ENABLED && user.is_verified === false) {
      console.warn("Login failed: email is not verified", normalizedEmail);
      return res.redirect(`/login?error=unverified&email=${encodeURIComponent(normalizedEmail)}`);
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
    res.clearCookie(SESSION_COOKIE_NAME);
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
    const userResult = await pool.query(
      `
      SELECT
        id,
        first_name,
        last_name,
        birth_date,
        university,
        workplace,
        email,
        is_verified
      FROM users
      WHERE id = $1
      `,
      [req.session.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const [canManageInternshipsValue, canManageOpportunitiesValue, canManageSubscriptionsValue, subscription, registrationSurvey] = await Promise.all([
      canManageInternships(req),
      canManageOpportunities(req),
      canManageSubscriptions(req),
      getCurrentSubscriptionForUser(req.session.userId),
      getRegistrationSurveyForUser(req.session.userId),
    ]);
    const hasPlusAccess = Boolean(
      canManageInternshipsValue ||
      canManageOpportunitiesValue ||
      isSubscriptionActiveRecord(subscription)
    );
    const actualRoadmap = buildRoadmapFromSurvey(registrationSurvey) || buildFallbackRoadmap();

    return res.json({
      email: normalizeEmail(req.session.email),
      profile: buildUserProfile(userResult.rows[0]),
      subscription: serializeSubscription(subscription),
      roadmap: hasPlusAccess ? actualRoadmap : null,
      roadmap_preview: !hasPlusAccess
        ? {
            title: "Персональный roadmap доступен в Plus",
            description: "На Plus открывается персональный маршрут, подборки под вашу цель и рабочие инструменты для движения по карьерному треку.",
          }
        : null,
      ...buildAccessState(hasPlusAccess, subscription),
      can_manage_internships: canManageInternshipsValue,
      can_manage_opportunities: canManageOpportunitiesValue,
      can_manage_subscriptions: canManageSubscriptionsValue,
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
  const allowedCategories = new Set([
    "all",
    "recommended",
    "ministries",
    "akimats",
    "quasi",
    "online",
    "other",
  ]);

  if (!allowedCategories.has(category)) {
    return res.status(400).json({ error: "Unknown internships filter type" });
  }

  try {
    const [canManage, registrationSurvey, subscription] = await Promise.all([
      canManageInternships(req),
      getRegistrationSurveyForUser(req.session.userId),
      getCurrentSubscriptionForUser(req.session.userId),
    ]);
    const hasPlusAccess = Boolean(canManage || isSubscriptionActiveRecord(subscription));

    const sql = category === "all" || category === "recommended"
      ? `
        SELECT
          id,
          title,
          organization,
          description,
          category,
          location,
          duration,
          apply_url,
          deadline_date,
          target_goals,
          required_english_level,
          experience_level,
          region_type,
          created_at,
          created_by
        FROM internships
        ORDER BY created_at DESC, id DESC
      `
      : `
        SELECT
          id,
          title,
          organization,
          description,
          category,
          location,
          duration,
          apply_url,
          deadline_date,
          target_goals,
          required_english_level,
          experience_level,
          region_type,
          created_at,
          created_by
        FROM internships
        WHERE category = $1
        ORDER BY created_at DESC, id DESC
      `;

    const params = category === "all" || category === "recommended" ? [] : [category];
    const result = await pool.query(sql, params);
    const savedStatusMap = await getSavedStatusMap(
      req.session.userId,
      "internship",
      result.rows.map((row) => Number(row.id))
    );
    const internships = result.rows.map((row) => {
      const recommendation = buildRecommendationForItem(
        row,
        registrationSurvey,
        inferInternshipMetadata(row)
      );

      return {
        id: row.id,
        title: row.title,
        organization: row.organization,
        description: row.description,
        category: row.category,
        location: row.location,
        duration: row.duration,
        apply_url: row.apply_url,
        deadline_date: serializeDateOnly(row.deadline_date),
        target_goals: recommendation.metadata.target_goals,
        required_english_level: recommendation.metadata.required_english_level,
        experience_level: recommendation.metadata.experience_level,
        region_type: recommendation.metadata.region_type,
        recommendation_score: recommendation.score,
        is_recommended: recommendation.is_recommended,
        recommendation_reasons: recommendation.reasons,
        saved_status: savedStatusMap.get(Number(row.id)) || null,
        created_at: row.created_at,
        can_delete: canManage,
      };
    });
    const accessPolicy = applyCatalogAccessPolicy(internships, {
      hasPlusAccess,
      entityType: "internship",
      entityLabel: "стажировки",
      requestedFilter: category,
      survey: registrationSurvey,
      subscription,
    });

    return res.json({
      can_manage: canManage,
      internships: accessPolicy.visible_items,
      for_goal: accessPolicy.for_goal_items,
      personalization: accessPolicy.personalization,
      ...accessPolicy.access,
    });
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

app.get("/api/opportunities", requireAuth, async (req, res) => {
  const requestedType = String(req.query.type || "all").trim().toLowerCase();
  const allowedTypes = new Set(["all", "recommended", "grants", "scholarships", "news", "articles"]);

  if (!allowedTypes.has(requestedType)) {
    return res.status(400).json({ error: "Unknown opportunities filter type" });
  }

  let canManage = false;
  let registrationSurvey = null;
  let subscription = null;
  try {
    const accessResult = await Promise.all([
      canManageOpportunities(req),
      getRegistrationSurveyForUser(req.session.userId),
      getCurrentSubscriptionForUser(req.session.userId),
    ]);
    canManage = accessResult[0];
    registrationSurvey = accessResult[1];
    subscription = accessResult[2];
  } catch (accessErr) {
    console.error("Opportunities access check error:", accessErr);
  }

  try {
    const sql = requestedType === "all" || requestedType === "recommended"
      ? `
        SELECT
          id,
          title,
          organization,
          summary,
          content_type,
          country,
          deadline,
          deadline_date,
          source_url,
          image_url,
          target_goals,
          required_english_level,
          experience_level,
          region_type,
          created_at
        FROM opportunities
        ORDER BY created_at DESC, id DESC
      `
      : `
        SELECT
          id,
          title,
          organization,
          summary,
          content_type,
          country,
          deadline,
          deadline_date,
          source_url,
          image_url,
          target_goals,
          required_english_level,
          experience_level,
          region_type,
          created_at
        FROM opportunities
        WHERE content_type = $1
        ORDER BY created_at DESC, id DESC
      `;

    const params = requestedType === "all" || requestedType === "recommended" ? [] : [requestedType];
    const result = await pool.query(sql, params);
    const savedStatusMap = await getSavedStatusMap(
      req.session.userId,
      "opportunity",
      result.rows.map((row) => Number(row.id))
    );
    const opportunities = result.rows.map((row) => {
      const recommendation = buildRecommendationForItem(
        row,
        registrationSurvey,
        inferOpportunityMetadata(row)
      );

      return {
        id: row.id,
        title: row.title,
        organization: row.organization,
        summary: row.summary,
        content_type: row.content_type,
        country: row.country,
        deadline: row.deadline,
        deadline_date: serializeDateOnly(row.deadline_date),
        source_url: row.source_url,
        image_url: row.image_url,
        target_goals: recommendation.metadata.target_goals,
        required_english_level: recommendation.metadata.required_english_level,
        experience_level: recommendation.metadata.experience_level,
        region_type: recommendation.metadata.region_type,
        recommendation_score: recommendation.score,
        is_recommended: recommendation.is_recommended,
        recommendation_reasons: recommendation.reasons,
        saved_status: savedStatusMap.get(Number(row.id)) || null,
        created_at: row.created_at,
        can_delete: canManage,
      };
    });

    const hasPlusAccess = Boolean(canManage || isSubscriptionActiveRecord(subscription));
    const accessPolicy = applyCatalogAccessPolicy(opportunities, {
      hasPlusAccess,
      entityType: "opportunity",
      entityLabel: "материалы и возможности",
      requestedFilter: requestedType,
      survey: registrationSurvey,
      subscription,
    });

    return res.json({
      can_manage: canManage,
      opportunities: accessPolicy.visible_items,
      for_goal: accessPolicy.for_goal_items,
      personalization: accessPolicy.personalization,
      ...accessPolicy.access,
    });
  } catch (err) {
    console.error("Fetch opportunities error:", err);
    return res.status(500).json({ error: "Failed to fetch opportunities" });
  }
});

app.get("/api/resources", requireAuth, async (req, res) => {
  const requestedType = String(req.query.type || "all").trim().toLowerCase();
  const allowedTypes = new Set(["all", "recommended", ...careerResourceTypes]);

  if (!allowedTypes.has(requestedType)) {
    return res.status(400).json({ error: "Unknown resources filter type" });
  }

  try {
    const [canManage, registrationSurvey, subscription] = await Promise.all([
      canManageOpportunities(req),
      getRegistrationSurveyForUser(req.session.userId),
      getCurrentSubscriptionForUser(req.session.userId),
    ]);
    const hasPlusAccess = Boolean(canManage || isSubscriptionActiveRecord(subscription));

    const sql = requestedType === "all" || requestedType === "recommended"
      ? `
        SELECT
          id,
          title,
          summary,
          body,
          resource_type,
          source_url,
          target_goals,
          required_english_level,
          experience_level,
          region_type,
          created_at
        FROM career_resources
        ORDER BY created_at DESC, id DESC
      `
      : `
        SELECT
          id,
          title,
          summary,
          body,
          resource_type,
          source_url,
          target_goals,
          required_english_level,
          experience_level,
          region_type,
          created_at
        FROM career_resources
        WHERE resource_type = $1
        ORDER BY created_at DESC, id DESC
      `;
    const params = requestedType === "all" || requestedType === "recommended" ? [] : [requestedType];
    const result = await pool.query(sql, params);
    const resources = result.rows.map((row) => {
      const recommendation = buildRecommendationForItem(
        row,
        registrationSurvey,
        inferResourceMetadata(row)
      );

      return {
        id: row.id,
        title: row.title,
        summary: row.summary,
        body: row.body,
        resource_type: row.resource_type,
        source_url: row.source_url,
        target_goals: recommendation.metadata.target_goals,
        required_english_level: recommendation.metadata.required_english_level,
        experience_level: recommendation.metadata.experience_level,
        region_type: recommendation.metadata.region_type,
        recommendation_score: recommendation.score,
        is_recommended: recommendation.is_recommended,
        recommendation_reasons: recommendation.reasons,
        created_at: row.created_at,
        can_delete: canManage,
      };
    });

    const accessPolicy = applyCatalogAccessPolicy(resources, {
      hasPlusAccess,
      entityType: "resource",
      entityLabel: "карьерные материалы",
      requestedFilter: requestedType,
      survey: registrationSurvey,
      subscription,
    });

    return res.json({
      can_manage: canManage,
      resources: accessPolicy.visible_items,
      for_goal: accessPolicy.for_goal_items,
      personalization: accessPolicy.personalization,
      ...accessPolicy.access,
    });
  } catch (err) {
    console.error("Fetch resources error:", err);
    return res.status(500).json({ error: "Failed to fetch resources" });
  }
});

app.get("/api/saved", requireAuth, async (req, res) => {
  try {
    const [subscription, canManageInternshipsValue, canManageOpportunitiesValue] = await Promise.all([
      getCurrentSubscriptionForUser(req.session.userId),
      canManageInternships(req),
      canManageOpportunities(req),
    ]);
    const hasPlusAccess = Boolean(
      canManageInternshipsValue ||
      canManageOpportunitiesValue ||
      isSubscriptionActiveRecord(subscription)
    );

    if (!hasPlusAccess) {
      return res.json({
        items: [],
        summary: buildSavedSummary([]),
        ...buildAccessState(false, subscription),
        upgrade_required: true,
        upgrade_message: "Избранное, статусы откликов и дедлайны доступны в Plus.",
      });
    }

    const savedPayload = await getSavedItemsForUser(req.session.userId, {
      status: req.query.status,
      limit: req.query.limit,
    });

    return res.json({
      ...savedPayload,
      ...buildAccessState(true, subscription),
      upgrade_required: false,
    });
  } catch (err) {
    console.error("Fetch saved items error:", err);
    return res.status(500).json({ error: "Failed to fetch saved items" });
  }
});

app.post("/api/saved", requireAuth, async (req, res) => {
  const entityType = normalizeSavedEntityType(req.body.entityType);
  const entityId = Number.parseInt(req.body.entityId, 10);
  const savedStatus = normalizeSavedStatus(req.body.savedStatus);
  const reminderEnabled = req.body.reminderEnabled !== false;

  if (!entityType || !Number.isInteger(entityId) || entityId <= 0) {
    return res.status(400).json({ error: "Invalid saved item payload" });
  }

  try {
    const [subscription, canManageInternshipsValue, canManageOpportunitiesValue] = await Promise.all([
      getCurrentSubscriptionForUser(req.session.userId),
      canManageInternships(req),
      canManageOpportunities(req),
    ]);
    const hasPlusAccess = Boolean(
      canManageInternshipsValue ||
      canManageOpportunitiesValue ||
      isSubscriptionActiveRecord(subscription)
    );

    if (!hasPlusAccess) {
      return res.status(402).json({
        error: "Избранное и трекинг откликов доступны в Plus.",
        redirect: "/subscribe",
      });
    }

    const entity = await findSavableEntity(entityType, entityId);
    if (!entity) {
      return res.status(404).json({ error: "Content item not found" });
    }

    const existing = await pool.query(
      `
      SELECT id, saved_status
      FROM saved_items
      WHERE user_id = $1
        AND entity_type = $2
        AND entity_id = $3
      LIMIT 1
      `,
      [req.session.userId, entityType, entityId]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `
        UPDATE saved_items
        SET saved_status = $1,
            reminder_enabled = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING id, entity_type, entity_id, saved_status, reminder_enabled, created_at, updated_at
        `,
        [savedStatus, reminderEnabled, existing.rows[0].id]
      );
    } else {
      result = await pool.query(
        `
        INSERT INTO saved_items (
          user_id,
          entity_type,
          entity_id,
          saved_status,
          reminder_enabled
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id, entity_type, entity_id, saved_status, reminder_enabled, created_at, updated_at
        `,
        [req.session.userId, entityType, entityId, savedStatus, reminderEnabled]
      );
    }

    await logUserAction(
      req.session.userId,
      entityType,
      entityId,
      existing.rows.length > 0 ? "status_changed" : "saved",
      savedStatus
    );

    return res.status(existing.rows.length > 0 ? 200 : 201).json({
      ok: true,
      item: {
        id: result.rows[0].id,
        entity_type: result.rows[0].entity_type,
        entity_id: result.rows[0].entity_id,
        saved_status: normalizeSavedStatus(result.rows[0].saved_status),
        reminder_enabled: result.rows[0].reminder_enabled !== false,
        created_at: result.rows[0].created_at,
        updated_at: result.rows[0].updated_at,
      },
    });
  } catch (err) {
    console.error("Save item error:", err);
    return res.status(500).json({ error: "Failed to save item" });
  }
});

app.delete("/api/saved/:entityType/:entityId", requireAuth, async (req, res) => {
  const entityType = normalizeSavedEntityType(req.params.entityType);
  const entityId = Number.parseInt(req.params.entityId, 10);

  if (!entityType || !Number.isInteger(entityId) || entityId <= 0) {
    return res.status(400).json({ error: "Invalid saved item request" });
  }

  try {
    const [subscription, canManageInternshipsValue, canManageOpportunitiesValue] = await Promise.all([
      getCurrentSubscriptionForUser(req.session.userId),
      canManageInternships(req),
      canManageOpportunities(req),
    ]);
    const hasPlusAccess = Boolean(
      canManageInternshipsValue ||
      canManageOpportunitiesValue ||
      isSubscriptionActiveRecord(subscription)
    );

    if (!hasPlusAccess) {
      return res.status(402).json({
        error: "Избранное и трекинг откликов доступны в Plus.",
        redirect: "/subscribe",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM saved_items
      WHERE user_id = $1
        AND entity_type = $2
        AND entity_id = $3
      RETURNING id
      `,
      [req.session.userId, entityType, entityId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Saved item not found" });
    }

    await logUserAction(req.session.userId, entityType, entityId, "unsaved", null);
    return res.json({ ok: true });
  } catch (err) {
    console.error("Delete saved item error:", err);
    return res.status(500).json({ error: "Failed to remove saved item" });
  }
});

app.get("/api/subscription", requireAuth, async (req, res) => {
  try {
    const [subscription, canManageSubscriptionsValue] = await Promise.all([
      getCurrentSubscriptionForUser(req.session.userId),
      canManageSubscriptions(req),
    ]);
    const hasPlusAccess = isSubscriptionActiveRecord(subscription);

    return res.json({
      hasSubscription: Boolean(subscription),
      hasActiveSubscription: isSubscriptionActiveRecord(subscription),
      can_manage_subscriptions: canManageSubscriptionsValue,
      kaspi_qr_url: KASPI_QR_URL,
      plans: serializeSubscriptionPlanCatalog(),
      subscription: serializeSubscription(subscription),
      ...buildAccessState(hasPlusAccess, subscription),
    });
  } catch (err) {
    console.error("Subscription status error:", err);
    return res.status(500).json({ error: "Failed to get subscription status" });
  }
});

app.post("/api/subscription/prepare", requireAuth, async (req, res) => {
  const plan = String(req.body.plan || "").trim();
  const planConfig = getSubscriptionPlanConfig(plan);
  if (!planConfig) {
    return res.status(400).json({ error: "Unknown subscription plan" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingResult = await client.query(
      `
      SELECT
        id,
        user_id,
        plan,
        active,
        status,
        order_id,
        started_at,
        expires_at,
        amount,
        base_amount,
        access_days,
        payment_method,
        payment_code,
        prepared_at,
        submitted_at,
        reviewed_at,
        review_note
      FROM subscriptions
      WHERE user_id = $1
      ORDER BY id DESC
      LIMIT 1
      FOR UPDATE
      `,
      [req.session.userId]
    );

    const existingSubscription = existingResult.rows[0] || null;
    if (isSubscriptionActiveRecord(existingSubscription)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "У вас уже есть активная подписка." });
    }

    if (
      existingSubscription &&
      String(existingSubscription.status || "").toLowerCase() === "pending_manual_review"
    ) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Ваша заявка уже отправлена на проверку. Дождитесь подтверждения.",
      });
    }

    if (
      existingSubscription &&
      String(existingSubscription.status || "").toLowerCase() === "payment_pending" &&
      existingSubscription.plan === planConfig.id &&
      Number.isInteger(Number(existingSubscription.amount))
    ) {
      await client.query("COMMIT");
      return res.json({
        ok: true,
        kaspi_qr_url: KASPI_QR_URL,
        exact_amount: Number(existingSubscription.amount),
        payment_code: existingSubscription.payment_code,
        subscription: serializeSubscription(existingSubscription),
        reused: true,
      });
    }

    const exactAmount = await allocateUniqueSubscriptionAmount(client, planConfig.amount, req.session.userId);
    const paymentCode = generateSubscriptionPaymentCode(planConfig.id);

    let preparedSubscriptionResult;
    if (existingSubscription) {
      preparedSubscriptionResult = await client.query(
        `
        UPDATE subscriptions
        SET plan = $1,
            active = false,
            status = 'payment_pending',
            order_id = NULL,
            started_at = NULL,
            expires_at = NULL,
            amount = $2,
            base_amount = $3,
            access_days = $4,
            payment_method = 'kaspi_qr',
            payment_code = $5,
            prepared_at = CURRENT_TIMESTAMP,
            submitted_at = NULL,
            reviewed_at = NULL,
            review_note = NULL
        WHERE id = $6
        RETURNING
          id,
          user_id,
          plan,
          active,
          status,
          order_id,
          started_at,
          expires_at,
          amount,
          base_amount,
          access_days,
          payment_method,
          payment_code,
          prepared_at,
          submitted_at,
          reviewed_at,
          review_note
        `,
        [
          planConfig.id,
          exactAmount,
          planConfig.amount,
          planConfig.access_days,
          paymentCode,
          existingSubscription.id,
        ]
      );
    } else {
      preparedSubscriptionResult = await client.query(
        `
        INSERT INTO subscriptions (
          user_id,
          plan,
          active,
          status,
          order_id,
          started_at,
          expires_at,
          amount,
          base_amount,
          access_days,
          payment_method,
          payment_code,
          prepared_at,
          submitted_at,
          reviewed_at,
          review_note
        )
        VALUES (
          $1,
          $2,
          false,
          'payment_pending',
          NULL,
          NULL,
          NULL,
          $3,
          $4,
          $5,
          'kaspi_qr',
          $6,
          CURRENT_TIMESTAMP,
          NULL,
          NULL,
          NULL
        )
        RETURNING
          id,
          user_id,
          plan,
          active,
          status,
          order_id,
          started_at,
          expires_at,
          amount,
          base_amount,
          access_days,
          payment_method,
          payment_code,
          prepared_at,
          submitted_at,
          reviewed_at,
          review_note
        `,
        [
          req.session.userId,
          planConfig.id,
          exactAmount,
          planConfig.amount,
          planConfig.access_days,
          paymentCode,
        ]
      );
    }

    await client.query("COMMIT");

    return res.json({
      ok: true,
      kaspi_qr_url: KASPI_QR_URL,
      exact_amount: exactAmount,
      payment_code: paymentCode,
      subscription: serializeSubscription(preparedSubscriptionResult.rows[0]),
      reused: false,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Subscription prepare error:", err);
    return res.status(500).json({ error: "Failed to prepare subscription payment" });
  } finally {
    client.release();
  }
});

app.post("/api/subscription/manual-request", requireAuth, async (req, res) => {
  try {
    const plan = String(req.body.plan || "").trim();
    const planConfig = getSubscriptionPlanConfig(plan);
    if (!planConfig) {
      return res.status(400).json({ error: "Unknown subscription plan" });
    }

    const existingSubscription = await getCurrentSubscriptionForUser(req.session.userId);
    if (isSubscriptionActiveRecord(existingSubscription)) {
      return res.status(409).json({ error: "У вас уже есть активная подписка." });
    }

    if (
      existingSubscription &&
      String(existingSubscription.status || "").toLowerCase() === "pending_manual_review"
    ) {
      return res.status(409).json({ error: "Ваша заявка уже отправлена и ждёт проверки." });
    }

    if (
      !existingSubscription ||
      String(existingSubscription.status || "").toLowerCase() !== "payment_pending" ||
      existingSubscription.plan !== planConfig.id
    ) {
      return res.status(409).json({
        error: "Сначала получите точную сумму для оплаты по выбранному тарифу.",
      });
    }

    const manualRequestResult = await pool.query(
      `
      UPDATE subscriptions
      SET active = false,
          status = 'pending_manual_review',
          order_id = NULL,
          started_at = NULL,
          expires_at = NULL,
          amount = $1,
          base_amount = $2,
          access_days = $3,
          payment_method = 'kaspi_qr',
          submitted_at = CURRENT_TIMESTAMP,
          reviewed_at = NULL,
          review_note = $4
      WHERE id = $5
      RETURNING
        id,
        user_id,
        plan,
        active,
        status,
        order_id,
        started_at,
        expires_at,
        amount,
        base_amount,
        access_days,
        payment_method,
        payment_code,
        prepared_at,
        submitted_at,
        reviewed_at,
        review_note
      `,
      [
        Number(existingSubscription.amount || planConfig.amount),
        planConfig.amount,
        planConfig.access_days,
        "Ожидает сверки оплаты по уникальной сумме.",
        existingSubscription.id,
      ]
    );

    return res.json({
      ok: true,
      exact_amount: Number(manualRequestResult.rows[0].amount || existingSubscription.amount || 0),
      payment_code: manualRequestResult.rows[0].payment_code || existingSubscription.payment_code || null,
      subscription: serializeSubscription(manualRequestResult.rows[0]),
      message: "Заявка отправлена. После подтверждения оплаты доступ откроется автоматически.",
    });
  } catch (err) {
    console.error("Manual subscription request error:", err);
    return res.status(500).json({ error: "Failed to submit manual subscription request" });
  }
});

app.get("/api/subscription/review-queue", requireAuth, requireSubscriptionManager, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        s.id,
        s.user_id,
        s.plan,
        s.amount,
        s.base_amount,
        s.access_days,
        s.status,
        s.payment_code,
        s.prepared_at,
        s.submitted_at,
        s.reviewed_at,
        s.review_note,
        u.email,
        u.first_name,
        u.last_name,
        u.university,
        u.workplace
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      WHERE s.status = 'pending_manual_review'
      ORDER BY s.submitted_at DESC NULLS LAST, s.id DESC
      `
    );

    return res.json({
      requests: result.rows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        plan: row.plan,
        amount: row.amount,
        base_amount: row.base_amount,
        access_days: row.access_days,
        status: row.status,
        payment_code: row.payment_code,
        prepared_at: row.prepared_at,
        submitted_at: row.submitted_at,
        reviewed_at: row.reviewed_at,
        review_note: row.review_note,
        email: normalizeEmail(row.email),
        first_name: normalizeProfileText(row.first_name),
        last_name: normalizeProfileText(row.last_name),
        university: normalizeProfileText(row.university),
        workplace: normalizeProfileText(row.workplace),
      })),
    });
  } catch (err) {
    console.error("Subscription review queue error:", err);
    return res.status(500).json({ error: "Failed to load subscription review queue" });
  }
});

app.post("/api/subscription/review/:subscriptionId/approve", requireAuth, requireSubscriptionManager, async (req, res) => {
  const subscriptionId = Number.parseInt(req.params.subscriptionId, 10);
  if (!Number.isInteger(subscriptionId) || subscriptionId <= 0) {
    return res.status(400).json({ error: "Invalid subscription id" });
  }

  try {
    const result = await pool.query(
      `
      SELECT id, user_id, plan, status
      FROM subscriptions
      WHERE id = $1
      LIMIT 1
      `,
      [subscriptionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Subscription request not found" });
    }

    const subscription = result.rows[0];
    if (String(subscription.status || "").toLowerCase() !== "pending_manual_review") {
      return res.status(409).json({
        error: "Подтвердить можно только заявку, которая уже отправлена на ручную проверку.",
      });
    }

    const planConfig = getSubscriptionPlanConfig(subscription.plan);
    if (!planConfig) {
      return res.status(400).json({ error: "Unknown plan in subscription request" });
    }

    const startedAt = new Date();
    const expiresAt = addDays(startedAt, planConfig.access_days);

    await pool.query(
      `UPDATE subscriptions
       SET active = true,
           status = 'active',
           base_amount = $1,
           access_days = $2,
           started_at = $3,
           expires_at = $4,
           reviewed_at = CURRENT_TIMESTAMP,
           review_note = $5
       WHERE id = $6`,
      [
        planConfig.amount,
        planConfig.access_days,
        startedAt.toISOString(),
        expiresAt.toISOString(),
        "Оплата подтверждена администратором.",
        subscriptionId,
      ]
    );

    return res.json({
      ok: true,
      message: `Подписка активирована до ${expiresAt.toISOString().slice(0, 10)}.`,
    });
  } catch (err) {
    console.error("Subscription approval error:", err);
    return res.status(500).json({ error: "Failed to approve subscription" });
  }
});

app.post("/api/subscription/review/:subscriptionId/reject", requireAuth, requireSubscriptionManager, async (req, res) => {
  const subscriptionId = Number.parseInt(req.params.subscriptionId, 10);
  const reviewNote = normalizeProfileText(req.body.reviewNote || "Платёж не подтверждён.");

  if (!Number.isInteger(subscriptionId) || subscriptionId <= 0) {
    return res.status(400).json({ error: "Invalid subscription id" });
  }

  try {
    const existing = await pool.query(
      "SELECT id, status FROM subscriptions WHERE id = $1 LIMIT 1",
      [subscriptionId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Subscription request not found" });
    }

    if (String(existing.rows[0].status || "").toLowerCase() !== "pending_manual_review") {
      return res.status(409).json({
        error: "Отклонить можно только заявку, которая уже ждёт ручной проверки.",
      });
    }

    await pool.query(
      `
      UPDATE subscriptions
      SET active = false,
          status = 'rejected',
          reviewed_at = CURRENT_TIMESTAMP,
          review_note = $1,
          started_at = NULL,
          expires_at = NULL
      WHERE id = $2
      `,
      [reviewNote || "Платёж не подтверждён.", subscriptionId]
    );

    return res.json({ ok: true, message: "Заявка отклонена." });
  } catch (err) {
    console.error("Subscription rejection error:", err);
    return res.status(500).json({ error: "Failed to reject subscription" });
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
  const deadlineDate = parseDeadlineDate(req.body.deadlineDate);
  const targetGoals = normalizeTargetGoals(req.body.targetGoals);
  const requiredEnglishLevel = normalizeEnglishRequirement(req.body.requiredEnglishLevel);
  const experienceLevel = normalizeExperienceRequirement(req.body.experienceLevel);
  const regionType = normalizeRegionType(req.body.regionType);

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
        title,
        organization,
        description,
        category,
        location,
        duration,
        apply_url,
        deadline_date,
        target_goals,
        required_english_level,
        experience_level,
        region_type,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10, $11, $12, $13)
      RETURNING
        id,
        title,
        organization,
        description,
        category,
        location,
        duration,
        apply_url,
        deadline_date,
        target_goals,
        required_english_level,
        experience_level,
        region_type,
        created_at
      `,
      [
        title,
        organization,
        description,
        category,
        location,
        duration,
        applyUrl || null,
        deadlineDate,
        targetGoals,
        requiredEnglishLevel,
        experienceLevel,
        regionType,
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
  const deadlineDate = parseDeadlineDate(req.body.deadlineDate);
  const sourceUrl = String(req.body.sourceUrl || "").trim();
  const imageUrl = String(req.body.imageUrl || "").trim();
  const targetGoals = normalizeTargetGoals(req.body.targetGoals);
  const requiredEnglishLevel = normalizeEnglishRequirement(req.body.requiredEnglishLevel);
  const experienceLevel = normalizeExperienceRequirement(req.body.experienceLevel);
  const regionType = normalizeRegionType(req.body.regionType);

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
        title,
        organization,
        summary,
        content_type,
        country,
        deadline,
        deadline_date,
        source_url,
        image_url,
        target_goals,
        required_english_level,
        experience_level,
        region_type,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[], $11, $12, $13, $14)
      RETURNING
        id,
        title,
        organization,
        summary,
        content_type,
        country,
        deadline,
        deadline_date,
        source_url,
        image_url,
        target_goals,
        required_english_level,
        experience_level,
        region_type,
        created_at
      `,
      [
        title,
        organization,
        summary,
        contentType,
        country,
        deadline || null,
        deadlineDate,
        sourceUrl || null,
        imageUrl || null,
        targetGoals,
        requiredEnglishLevel,
        experienceLevel,
        regionType,
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

app.post("/api/resources", requireAuth, async (req, res) => {
  const canManage = await canManageOpportunities(req);
  if (!canManage) {
    return res.status(403).json({ error: "Only admin can publish career resources" });
  }

  const title = String(req.body.title || "").trim();
  const summary = String(req.body.summary || "").trim();
  const body = String(req.body.body || "").trim();
  const resourceType = String(req.body.resourceType || "").trim().toLowerCase();
  const sourceUrl = String(req.body.sourceUrl || "").trim();
  const targetGoals = normalizeTargetGoals(req.body.targetGoals);
  const requiredEnglishLevel = normalizeEnglishRequirement(req.body.requiredEnglishLevel);
  const experienceLevel = normalizeExperienceRequirement(req.body.experienceLevel);
  const regionType = normalizeRegionType(req.body.regionType);

  if (!title || !summary || !careerResourceTypes.has(resourceType)) {
    return res.status(400).json({ error: "Invalid resource payload" });
  }

  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
    return res.status(400).json({ error: "sourceUrl must start with http:// or https://" });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO career_resources (
        title,
        summary,
        body,
        resource_type,
        source_url,
        target_goals,
        required_english_level,
        experience_level,
        region_type,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8, $9, $10)
      RETURNING
        id,
        title,
        summary,
        body,
        resource_type,
        source_url,
        target_goals,
        required_english_level,
        experience_level,
        region_type,
        created_at
      `,
      [
        title,
        summary,
        body || null,
        resourceType,
        sourceUrl || null,
        targetGoals,
        requiredEnglishLevel,
        experienceLevel,
        regionType,
        req.session.userId,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Create resource error:", err);
    return res.status(500).json({ error: "Failed to create resource" });
  }
});

app.delete("/api/resources/:id", requireAuth, async (req, res) => {
  const canManage = await canManageOpportunities(req);
  if (!canManage) {
    return res.status(403).json({ error: "Only admin can delete career resources" });
  }

  const resourceId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(resourceId) || resourceId <= 0) {
    return res.status(400).json({ error: "Invalid resource id" });
  }

  try {
    const existing = await pool.query(
      "SELECT id FROM career_resources WHERE id = $1",
      [resourceId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Resource not found" });
    }

    await pool.query("DELETE FROM career_resources WHERE id = $1", [resourceId]);
    return res.json({ ok: true });
  } catch (err) {
    console.error("Delete resource error:", err);
    return res.status(500).json({ error: "Failed to delete resource" });
  }
});

/* ======================
   Start Server
====================== */

async function startServer() {
  try {
    await pool.query("SELECT 1");
    console.log("PostgreSQL connected");
    await initDB();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Startup failed:", err);
    process.exit(1);
  }
}

void startServer();
