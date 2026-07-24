/* Ambassador program: schema + seeds. See docs/ambassador-program/02-data-model.md */

const TRACKS = [
  { code: "diplomacy", ru: "Дипломатия и МО", kz: "Дипломатия және ХҚ" },
  { code: "gov", ru: "Государственная служба", kz: "Мемлекеттік қызмет" },
  { code: "business", ru: "Бизнес и предпринимательство", kz: "Бизнес және кәсіпкерлік" },
  { code: "media", ru: "Медиа, SMM и коммуникации", kz: "Медиа, SMM және коммуникация" },
  { code: "events", ru: "Организация мероприятий", kz: "Іс-шараларды ұйымдастыру" },
  { code: "education", ru: "Образование и исследования", kz: "Білім және зерттеулер" },
  { code: "social", ru: "Социальные проекты", kz: "Әлеуметтік жобалар" },
  { code: "volunteer", ru: "Волонтерство", kz: "Волонтерлік" },
  { code: "career_hr", ru: "Карьера и HR", kz: "Мансап және HR" },
  { code: "it", ru: "IT и цифровые направления", kz: "IT және цифрлық бағыттар" },
  { code: "technical", ru: "Рабочие и технические специальности", kz: "Жұмысшы және техникалық мамандықтар" },
];

async function initAmbDB(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS amb_profiles (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE NOT NULL,
      telegram_username TEXT,
      user_id INTEGER REFERENCES users(id),
      ambassador_number INTEGER UNIQUE,
      language TEXT NOT NULL DEFAULT 'ru' CHECK (language IN ('kz','ru')),
      first_name TEXT,
      last_name TEXT,
      birth_date DATE,
      city TEXT,
      phone TEXT,
      email TEXT,
      study_or_work TEXT,
      speciality TEXT,
      education_level TEXT,
      languages TEXT,
      skills TEXT,
      experience TEXT,
      motivation TEXT,
      availability TEXT,
      social_links TEXT,
      program_role TEXT NOT NULL DEFAULT 'candidate'
        CHECK (program_role IN ('candidate','trainee','ambassador','active','senior','teamlead','coordinator','alumni')),
      activity_status TEXT NOT NULL DEFAULT 'active'
        CHECK (activity_status IN ('active','probation','needs_support','unresponsive','recommended_promotion','suspended','reserve')),
      stream_id INTEGER,
      team_id INTEGER,
      is_minor BOOLEAN DEFAULT false,
      guardian_contact TEXT,
      consents JSONB DEFAULT '{}',
      source TEXT,
      onboarding_passed_at TIMESTAMP,
      trainee_until DATE,
      joined_at TIMESTAMP,
      tracks_updated_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS amb_profiles_team_idx ON amb_profiles (team_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS amb_profiles_stream_idx ON amb_profiles (stream_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS amb_streams (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      coordinator_id INTEGER REFERENCES amb_profiles(id),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS amb_teams (
      id SERIAL PRIMARY KEY,
      stream_id INTEGER NOT NULL REFERENCES amb_streams(id),
      name TEXT NOT NULL,
      teamlead_id INTEGER REFERENCES amb_profiles(id),
      capacity INTEGER DEFAULT 20,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS amb_tracks (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name_ru TEXT NOT NULL,
      name_kz TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS amb_profile_tracks (
      profile_id INTEGER NOT NULL REFERENCES amb_profiles(id) ON DELETE CASCADE,
      track_id INTEGER NOT NULL REFERENCES amb_tracks(id),
      is_primary BOOLEAN NOT NULL DEFAULT false,
      PRIMARY KEY (profile_id, track_id)
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS amb_profile_tracks_one_primary
    ON amb_profile_tracks (profile_id) WHERE is_primary
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS amb_applications (
      id SERIAL PRIMARY KEY,
      profile_id INTEGER NOT NULL REFERENCES amb_profiles(id),
      kind TEXT NOT NULL DEFAULT 'new' CHECK (kind IN ('new','migration')),
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','submitted','in_review','needs_revision','interview','accepted','reserve','rejected')),
      intro_task_type TEXT CHECK (intro_task_type IS NULL OR intro_task_type IN ('video','event_idea','post','problem','quiz')),
      intro_task_content TEXT,
      intro_task_file_id TEXT,
      quiz_score INTEGER,
      reviewer_id INTEGER REFERENCES users(id),
      internal_notes TEXT,
      decision_reason TEXT,
      submitted_at TIMESTAMP,
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS amb_applications_status_idx ON amb_applications (status)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS amb_tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('media','org','research','career','partner','other')),
      track_id INTEGER REFERENCES amb_tracks(id),
      audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all','stream','team','track')),
      audience_id INTEGER,
      points_min INTEGER NOT NULL DEFAULT 5,
      points_max INTEGER NOT NULL DEFAULT 5,
      deadline TIMESTAMP,
      max_participants INTEGER,
      report_format TEXT NOT NULL DEFAULT 'text' CHECK (report_format IN ('text','photo','file','link','none')),
      expected_result TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','closed','archived')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS amb_task_assignments (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES amb_tasks(id),
      profile_id INTEGER NOT NULL REFERENCES amb_profiles(id),
      status TEXT NOT NULL DEFAULT 'taken'
        CHECK (status IN ('taken','submitted','approved','rejected','expired','cancelled')),
      report_text TEXT,
      report_file_id TEXT,
      report_link TEXT,
      points_awarded INTEGER,
      reviewed_by INTEGER REFERENCES users(id),
      review_comment TEXT,
      resubmit_count INTEGER DEFAULT 0,
      deadline_reminded BOOLEAN DEFAULT false,
      taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      submitted_at TIMESTAMP,
      reviewed_at TIMESTAMP,
      UNIQUE (task_id, profile_id)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS amb_assignments_review_queue
    ON amb_task_assignments (status) WHERE status = 'submitted'
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS amb_points_ledger (
      id SERIAL PRIMARY KEY,
      profile_id INTEGER NOT NULL REFERENCES amb_profiles(id),
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      source_type TEXT NOT NULL
        CHECK (source_type IN ('task','event','weekly_streak','onboarding','mentoring','initiative','manual','penalty')),
      source_id INTEGER,
      awarded_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS amb_points_profile_idx ON amb_points_ledger (profile_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS amb_weekly_reports (
      id SERIAL PRIMARY KEY,
      profile_id INTEGER NOT NULL REFERENCES amb_profiles(id),
      week_start DATE NOT NULL,
      answers JSONB NOT NULL DEFAULT '{}',
      needs_help BOOLEAN DEFAULT false,
      reviewed_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (profile_id, week_start)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS amb_events (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      event_date TIMESTAMP NOT NULL,
      location TEXT,
      points INTEGER NOT NULL DEFAULT 5,
      audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all','stream','team','track')),
      audience_id INTEGER,
      qr_token TEXT UNIQUE,
      registration_open BOOLEAN DEFAULT true,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS amb_event_attendance (
      event_id INTEGER NOT NULL REFERENCES amb_events(id),
      profile_id INTEGER NOT NULL REFERENCES amb_profiles(id),
      registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      attended BOOLEAN DEFAULT false,
      confirmed_via TEXT CHECK (confirmed_via IS NULL OR confirmed_via IN ('qr','manual')),
      confirmed_by INTEGER REFERENCES users(id),
      confirmed_at TIMESTAMP,
      reminded BOOLEAN DEFAULT false,
      PRIMARY KEY (event_id, profile_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS amb_status_history (
      id SERIAL PRIMARY KEY,
      profile_id INTEGER NOT NULL REFERENCES amb_profiles(id),
      field TEXT NOT NULL CHECK (field IN ('program_role','activity_status','stream','team')),
      old_value TEXT,
      new_value TEXT,
      reason TEXT,
      changed_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS amb_bot_states (
      telegram_id BIGINT PRIMARY KEY,
      state TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS amb_meta (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  /* ---- Migrations (additive, idempotent) ---- */

  // Stage 1: regular_user becomes the base role for anyone who opens the bot.
  await pool.query(`ALTER TABLE amb_profiles DROP CONSTRAINT IF EXISTS amb_profiles_program_role_check`);
  await pool.query(`
    ALTER TABLE amb_profiles ADD CONSTRAINT amb_profiles_program_role_check
    CHECK (program_role IN ('regular_user','candidate','trainee','ambassador','active','senior','teamlead','coordinator','alumni'))
  `);
  await pool.query(`ALTER TABLE amb_profiles ALTER COLUMN program_role SET DEFAULT 'regular_user'`);

  // staff_role: owner/admin resolved for the bot side (coordinator/teamlead stay in program_role).
  await pool.query(`ALTER TABLE amb_profiles ADD COLUMN IF NOT EXISTS staff_role TEXT`);
  await pool.query(`
    ALTER TABLE amb_profiles DROP CONSTRAINT IF EXISTS amb_profiles_staff_role_check
  `);
  await pool.query(`
    ALTER TABLE amb_profiles ADD CONSTRAINT amb_profiles_staff_role_check
    CHECK (staff_role IS NULL OR staff_role IN ('owner','admin'))
  `);

  for (const t of TRACKS) {
    await pool.query(
      `INSERT INTO amb_tracks (code, name_ru, name_kz) VALUES ($1,$2,$3)
       ON CONFLICT (code) DO UPDATE SET name_ru = EXCLUDED.name_ru, name_kz = EXCLUDED.name_kz`,
      [t.code, t.ru, t.kz]
    );
  }

  console.log("Ambassador tables ready");
}

async function getProfileByTg(pool, telegramId) {
  const r = await pool.query(`SELECT * FROM amb_profiles WHERE telegram_id = $1`, [telegramId]);
  return r.rows[0] || null;
}

async function getState(pool, telegramId) {
  const r = await pool.query(`SELECT * FROM amb_bot_states WHERE telegram_id = $1`, [telegramId]);
  return r.rows[0] || null;
}

async function setState(pool, telegramId, state, payload) {
  await pool.query(
    `INSERT INTO amb_bot_states (telegram_id, state, payload, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (telegram_id)
     DO UPDATE SET state = $2, payload = $3, updated_at = CURRENT_TIMESTAMP`,
    [telegramId, state, JSON.stringify(payload || {})]
  );
}

async function clearState(pool, telegramId) {
  await pool.query(`DELETE FROM amb_bot_states WHERE telegram_id = $1`, [telegramId]);
}

async function logStatusChange(pool, profileId, field, oldValue, newValue, reason, changedBy) {
  await pool.query(
    `INSERT INTO amb_status_history (profile_id, field, old_value, new_value, reason, changed_by)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [profileId, field, oldValue == null ? null : String(oldValue), newValue == null ? null : String(newValue), reason || null, changedBy || null]
  );
}

async function nextAmbassadorNumber(client) {
  const r = await client.query(`SELECT COALESCE(MAX(ambassador_number), 0) + 1 AS n FROM amb_profiles`);
  return r.rows[0].n;
}

function formatKyd(n) {
  return "KYD-" + String(n).padStart(4, "0");
}

module.exports = {
  initAmbDB,
  TRACKS,
  getProfileByTg,
  getState,
  setState,
  clearState,
  logStatusChange,
  nextAmbassadorNumber,
  formatKyd,
};
