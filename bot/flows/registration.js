/* Registration (scenario A) and migration verification (scenario B).
   Shared question engine; payload.flow = 'reg' | 'mig'. State prefix: reg:* */

const { InlineKeyboard, Keyboard } = require("grammy");
const { t, QUIZ } = require("../i18n");
const db = require("../../lib/amb-db");
const { notifyAdminChat } = require("../notify");

const CITIES = ["Астана", "Алматы", "Шымкент", "Караганда", "Актобе", "Тараз", "Павлодар", "Усть-Каменогорск", "Атырау"];
const EDU_LEVELS = ["school", "college", "bachelor", "master", "phd", "other"];

/* Question definitions. type: text | date | city | contact | email | edu | availability
   opt: skippable. min: minimum text length. */
const REG_QUESTIONS = [
  { key: "name", prompt: "q_name", type: "text", min: 3 },
  { key: "birth", prompt: "q_birth", type: "date" },
  { key: "city", prompt: "q_city", type: "city" },
  { key: "phone", prompt: "q_phone", type: "contact" },
  { key: "email", prompt: "q_email", type: "email" },
  { key: "study", prompt: "q_study", type: "text", min: 2 },
  { key: "speciality", prompt: "q_speciality", type: "text", min: 2 },
  { key: "edu", prompt: "q_edu", type: "edu" },
  { key: "languages", prompt: "q_languages", type: "text", min: 2 },
  { key: "skills", prompt: "q_skills", type: "text", opt: true },
  { key: "experience", prompt: "q_experience", type: "text", opt: true },
  { key: "motivation", prompt: "q_motivation", type: "text", min: 100, shortKey: "motivation_short" },
  { key: "availability", prompt: "q_availability", type: "availability" },
  { key: "socials", prompt: "q_socials", type: "text", opt: true },
];
const MIG_KEYS = ["name", "birth", "city", "phone", "email", "study", "speciality"];

function questionsFor(payload) {
  if (payload.flow === "mig") return REG_QUESTIONS.filter((q) => MIG_KEYS.includes(q.key));
  return REG_QUESTIONS;
}

const EDITABLE_KEYS = ["name", "birth", "city", "email", "study", "speciality", "languages", "skills", "experience", "motivation", "socials"];

/* ---------- entry points ---------- */

async function startNew(ctx, deps, source) {
  const lang = await ensureProfile(ctx, deps, source);
  await db.setState(deps.pool, ctx.from.id, "reg:intro", { flow: "reg", source });
  const kb = new InlineKeyboard().text(t(lang, "btn_start_reg"), "R:go").row().text(t(lang, "btn_more"), "R:more");
  await ctx.reply(t(lang, "welcome_intro"), { reply_markup: kb });
}

async function startMigration(ctx, deps) {
  const lang = await ensureProfile(ctx, deps, "whatsapp");
  await db.setState(deps.pool, ctx.from.id, "reg:intro", { flow: "mig", source: "whatsapp" });
  const kb = new InlineKeyboard().text(t(lang, "btn_migrate_start"), "R:go");
  await ctx.reply(t(lang, "migrate_intro"), { reply_markup: kb });
}

async function askResume(ctx, deps, lang) {
  const kb = new InlineKeyboard().text(t(lang, "btn_resume"), "R:res:yes").row().text(t(lang, "btn_restart"), "R:res:no");
  await ctx.reply(t(lang, "resume_reg"), { reply_markup: kb });
}

async function ensureProfile(ctx, deps, source) {
  const { pool } = deps;
  const existing = await db.getProfileByTg(pool, ctx.from.id);
  if (existing) return existing.language;
  await pool.query(
    `INSERT INTO amb_profiles (telegram_id, telegram_username, source) VALUES ($1,$2,$3)
     ON CONFLICT (telegram_id) DO NOTHING`,
    [ctx.from.id, ctx.from.username || null, source || null]
  );
  return "ru";
}

/* ---------- helpers ---------- */

async function getLang(deps, telegramId) {
  const p = await db.getProfileByTg(deps.pool, telegramId);
  return (p && p.language) || "ru";
}

function parseDate(text) {
  const m = String(text).trim().match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  if (d.getUTCDate() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1) return null;
  return d;
}

function ageOf(date) {
  return Math.floor((Date.now() - date.getTime()) / (365.25 * 86400000));
}

function isEmail(text) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(text).trim());
}

async function askQuestion(ctx, deps, lang, payload, index, viaEdit) {
  const questions = questionsFor(payload);
  const q = questions[index];
  const progress = viaEdit ? "" : t(lang, "progress", { n: index + 1, total: questions.length }) + "\n";
  const prompt = progress + t(lang, q.prompt);
  const stateName = viaEdit ? `reg:edit:${q.key}` : `reg:q:${index}`;
  await db.setState(deps.pool, ctx.from.id, stateName, payload);

  if (q.type === "city") {
    const kb = new InlineKeyboard();
    CITIES.forEach((c, i) => {
      kb.text(c, `R:city:${i}`);
      if (i % 2 === 1) kb.row();
    });
    kb.row().text(t(lang, "btn_city_other"), "R:city:x");
    return ctx.reply(prompt, { reply_markup: kb });
  }
  if (q.type === "contact") {
    const kb = new Keyboard().requestContact(t(lang, "btn_share_contact")).resized().oneTime();
    return ctx.reply(prompt, { reply_markup: kb });
  }
  if (q.type === "edu") {
    const kb = new InlineKeyboard();
    EDU_LEVELS.forEach((code, i) => {
      kb.text(t(lang, "edu_" + code), `R:edu:${code}`);
      if (i % 2 === 1) kb.row();
    });
    return ctx.reply(prompt, { reply_markup: kb });
  }
  if (q.type === "availability") {
    const kb = new InlineKeyboard().text("1–3", "R:av:1-3").text("4–6", "R:av:4-6").text("7+", "R:av:7+");
    return ctx.reply(prompt, { reply_markup: kb });
  }
  if (q.opt) {
    const kb = new InlineKeyboard().text(t(lang, "btn_skip"), "R:skip");
    return ctx.reply(prompt, { reply_markup: kb });
  }
  return ctx.reply(prompt, { reply_markup: { remove_keyboard: true } });
}

async function advance(ctx, deps, lang, payload, currentIndex) {
  const questions = questionsFor(payload);
  const next = currentIndex + 1;
  if (next < questions.length) {
    return askQuestion(ctx, deps, lang, payload, next);
  }
  return askTrackPrimary(ctx, deps, lang, payload);
}

async function saveAnswer(ctx, deps, lang, payload, index, value, viaEdit) {
  const questions = questionsFor(payload);
  const q = questions[index];
  payload.answers = payload.answers || {};
  payload.answers[q.key] = value;

  if (q.key === "birth") {
    const date = parseDate(value);
    const minor = ageOf(date) < 18;
    payload.answers.is_minor = minor;
    if (minor && !payload.answers.guardian_contact) {
      await db.setState(deps.pool, ctx.from.id, "reg:guardian", payload);
      return ctx.reply(t(lang, "minor_guardian"));
    }
  }
  if (viaEdit) return showSummary(ctx, deps, lang, payload);
  return advance(ctx, deps, lang, payload, index);
}

/* ---------- tracks ---------- */

async function trackKeyboard(deps, lang, prefix, selected) {
  const r = await deps.pool.query(`SELECT id, name_ru, name_kz FROM amb_tracks WHERE is_active ORDER BY id`);
  const kb = new InlineKeyboard();
  r.rows.forEach((row) => {
    const name = lang === "kz" ? row.name_kz : row.name_ru;
    const mark = selected && selected.includes(row.id) ? "✅ " : "";
    kb.text(mark + name, `${prefix}${row.id}`).row();
  });
  return kb;
}

async function askTrackPrimary(ctx, deps, lang, payload) {
  payload.tracks = payload.tracks || { extra: [] };
  await db.setState(deps.pool, ctx.from.id, "reg:track_primary", payload);
  const kb = await trackKeyboard(deps, lang, "R:tp:");
  await ctx.reply(t(lang, "track_primary"), { reply_markup: kb });
}

async function askTrackExtra(ctx, deps, lang, payload) {
  await db.setState(deps.pool, ctx.from.id, "reg:track_extra", payload);
  const kb = await trackKeyboard(deps, lang, "R:tx:", payload.tracks.extra);
  kb.row().text(t(lang, "btn_done"), "R:tx:done").text(t(lang, "btn_no_extra"), "R:tx:none");
  await ctx.reply(t(lang, "track_extra"), { reply_markup: kb });
}

async function afterTracks(ctx, deps, lang, payload) {
  if (payload.flow === "mig") return startQuiz(ctx, deps, lang, payload);
  if (payload.flow === "chg") return saveTracksOnly(ctx, deps, lang, payload);
  return askIntroChoice(ctx, deps, lang, payload);
}

/* Track change from the main menu (flow 'chg'): save and finish. */
async function saveTracksOnly(ctx, deps, lang, payload) {
  const { pool } = deps;
  const profile = await db.getProfileByTg(pool, ctx.from.id);
  if (!profile) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM amb_profile_tracks WHERE profile_id=$1`, [profile.id]);
    await client.query(`INSERT INTO amb_profile_tracks (profile_id, track_id, is_primary) VALUES ($1,$2,true)`, [profile.id, payload.tracks.primary]);
    for (const trackId of (payload.tracks.extra || []).slice(0, 2)) {
      if (trackId === payload.tracks.primary) continue;
      await client.query(`INSERT INTO amb_profile_tracks (profile_id, track_id, is_primary) VALUES ($1,$2,false) ON CONFLICT DO NOTHING`, [profile.id, trackId]);
    }
    await client.query(`UPDATE amb_profiles SET tracks_updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [profile.id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  await db.clearState(pool, ctx.from.id);
  return ctx.reply(t(lang, "tracks_updated"));
}

/* ---------- intro task ---------- */

async function askIntroChoice(ctx, deps, lang, payload) {
  payload.intro = payload.intro || {};
  await db.setState(deps.pool, ctx.from.id, "reg:intro_choose", payload);
  const kb = new InlineKeyboard()
    .text(t(lang, "intro_video_btn"), "R:i:video").row()
    .text(t(lang, "intro_idea_btn"), "R:i:event_idea").row()
    .text(t(lang, "intro_post_btn"), "R:i:post").row()
    .text(t(lang, "intro_problem_btn"), "R:i:problem").row()
    .text(t(lang, "intro_quiz_btn"), "R:i:quiz");
  await ctx.reply(t(lang, "intro_choose"), { reply_markup: kb });
}

const INTRO_PROMPTS = { video: "intro_video", event_idea: "intro_idea", post: "intro_post", problem: "intro_problem" };

async function startQuiz(ctx, deps, lang, payload) {
  payload.quiz = { idx: 0, correct: 0, attempts: (payload.quiz && payload.quiz.attempts) || 0 };
  await db.setState(deps.pool, ctx.from.id, "reg:quiz", payload);
  await ctx.reply(t(lang, "quiz_intro"));
  return sendQuizQuestion(ctx, deps, lang, payload);
}

async function sendQuizQuestion(ctx, deps, lang, payload) {
  const quiz = QUIZ[lang] || QUIZ.ru;
  const [question, options] = quiz[payload.quiz.idx];
  const kb = new InlineKeyboard();
  options.forEach((opt, i) => kb.text(opt, `R:qz:${payload.quiz.idx}:${i}`).row());
  await db.setState(deps.pool, ctx.from.id, "reg:quiz", payload);
  await ctx.reply(`${payload.quiz.idx + 1}/5. ${question}`, { reply_markup: kb });
}

/* ---------- summary & submit ---------- */

function summaryText(lang, payload) {
  const a = payload.answers || {};
  const lines = [
    t(lang, "summary_title"),
    "",
    `👤 ${a.name || "—"}`,
    `🎂 ${a.birth || "—"}  📍 ${a.city || "—"}`,
    `📱 ${a.phone || "—"}  ✉️ ${a.email || "—"}`,
    `🎓 ${a.study || "—"} · ${a.speciality || "—"} · ${a.edu || "—"}`,
    `🗣 ${a.languages || "—"}`,
    a.skills ? `🛠 ${a.skills}` : null,
    a.experience ? `📦 ${a.experience}` : null,
    `💬 ${a.motivation || "—"}`,
    `⏰ ${a.availability || "—"} ч/нед`,
    a.socials ? `🔗 ${a.socials}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

async function showSummary(ctx, deps, lang, payload) {
  await db.setState(deps.pool, ctx.from.id, "reg:summary", payload);
  const kb = new InlineKeyboard().text(t(lang, "btn_send_app"), "R:fin:send").row().text(t(lang, "btn_edit"), "R:fin:edit");
  await ctx.reply(summaryText(lang, payload), { reply_markup: kb });
}

async function submitApplication(ctx, deps, lang, payload) {
  const { pool } = deps;
  const a = payload.answers || {};
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const birth = parseDate(a.birth);
    const [firstName, ...rest] = String(a.name || "").trim().split(/\s+/);
    const pr = await client.query(
      `UPDATE amb_profiles SET
        first_name=$2, last_name=$3, birth_date=$4, city=$5, phone=$6, email=$7,
        study_or_work=$8, speciality=$9, education_level=$10, languages=$11,
        skills=$12, experience=$13, motivation=$14, availability=$15, social_links=$16,
        is_minor=$17, guardian_contact=$18, consents=$19, telegram_username=$20,
        program_role = CASE WHEN program_role = 'regular_user' THEN 'candidate' ELSE program_role END,
        tracks_updated_at=CURRENT_TIMESTAMP
       WHERE telegram_id=$1 RETURNING id`,
      [
        ctx.from.id, firstName || null, rest.join(" ") || null,
        birth ? birth.toISOString().slice(0, 10) : null,
        a.city || null, a.phone || null, a.email || null, a.study || null,
        a.speciality || null, a.edu || null, a.languages || null, a.skills || null,
        a.experience || null, a.motivation || null, a.availability || null, a.socials || null,
        Boolean(a.is_minor), a.guardian_contact || null,
        JSON.stringify(payload.consents || {}), ctx.from.username || null,
      ]
    );
    const profileId = pr.rows[0].id;

    await client.query(`DELETE FROM amb_profile_tracks WHERE profile_id=$1`, [profileId]);
    if (payload.tracks && payload.tracks.primary) {
      await client.query(
        `INSERT INTO amb_profile_tracks (profile_id, track_id, is_primary) VALUES ($1,$2,true)`,
        [profileId, payload.tracks.primary]
      );
      for (const trackId of (payload.tracks.extra || []).slice(0, 2)) {
        if (trackId === payload.tracks.primary) continue;
        await client.query(
          `INSERT INTO amb_profile_tracks (profile_id, track_id, is_primary) VALUES ($1,$2,false)
           ON CONFLICT DO NOTHING`,
          [profileId, trackId]
        );
      }
    }

    const intro = payload.intro || {};
    const existing = await client.query(
      `SELECT id FROM amb_applications WHERE profile_id=$1 AND kind='new'
         AND status IN ('draft','needs_revision') ORDER BY id DESC LIMIT 1`,
      [profileId]
    );
    if (existing.rows[0]) {
      await client.query(
        `UPDATE amb_applications SET status='submitted', intro_task_type=$2, intro_task_content=$3,
           intro_task_file_id=$4, quiz_score=$5, submitted_at=CURRENT_TIMESTAMP WHERE id=$1`,
        [existing.rows[0].id, intro.type || null, intro.content || null, intro.fileId || null, intro.quizScore || null]
      );
    } else {
      await client.query(
        `INSERT INTO amb_applications (profile_id, kind, status, intro_task_type, intro_task_content,
           intro_task_file_id, quiz_score, submitted_at)
         VALUES ($1,'new','submitted',$2,$3,$4,$5,CURRENT_TIMESTAMP)`,
        [profileId, intro.type || null, intro.content || null, intro.fileId || null, intro.quizScore || null]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  await db.clearState(deps.pool, ctx.from.id);
  await ctx.reply(t(lang, "app_submitted"), { reply_markup: { remove_keyboard: true } });
  await notifyAdminChat(deps.bot, `📥 Новая заявка: ${a.name || "?"} (${a.city || "?"}), источник: ${payload.source || "?"}`);
}

async function finalizeMigration(ctx, deps, lang, payload, wantsReserve) {
  const { pool } = deps;
  const a = payload.answers || {};
  const client = await pool.connect();
  let kyd = null;
  try {
    await client.query("BEGIN");
    const birth = parseDate(a.birth);
    const [firstName, ...rest] = String(a.name || "").trim().split(/\s+/);
    const pr = await client.query(
      `UPDATE amb_profiles SET
        first_name=$2, last_name=$3, birth_date=$4, city=$5, phone=$6, email=$7,
        study_or_work=$8, speciality=$9, is_minor=$10, consents=$11,
        telegram_username=$12, tracks_updated_at=CURRENT_TIMESTAMP
       WHERE telegram_id=$1 RETURNING id, ambassador_number, program_role`,
      [
        ctx.from.id, firstName || null, rest.join(" ") || null,
        birth ? birth.toISOString().slice(0, 10) : null,
        a.city || null, a.phone || null, a.email || null, a.study || null, a.speciality || null,
        Boolean(a.is_minor), JSON.stringify(payload.consents || {}), ctx.from.username || null,
      ]
    );
    const profile = pr.rows[0];

    await client.query(`DELETE FROM amb_profile_tracks WHERE profile_id=$1`, [profile.id]);
    if (payload.tracks && payload.tracks.primary) {
      await client.query(`INSERT INTO amb_profile_tracks (profile_id, track_id, is_primary) VALUES ($1,$2,true)`, [profile.id, payload.tracks.primary]);
      for (const trackId of (payload.tracks.extra || []).slice(0, 2)) {
        if (trackId === payload.tracks.primary) continue;
        await client.query(`INSERT INTO amb_profile_tracks (profile_id, track_id, is_primary) VALUES ($1,$2,false) ON CONFLICT DO NOTHING`, [profile.id, trackId]);
      }
    }

    const status = wantsReserve ? "reserve" : "accepted";
    await client.query(
      `INSERT INTO amb_applications (profile_id, kind, status, quiz_score, submitted_at, reviewed_at)
       VALUES ($1,'migration',$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      [profile.id, status, (payload.quiz && payload.quiz.lastScore) || null]
    );

    if (wantsReserve) {
      await client.query(`UPDATE amb_profiles SET activity_status='reserve' WHERE id=$1`, [profile.id]);
      await db.logStatusChange(client, profile.id, "activity_status", profile.program_role, "reserve", "Верификация: сам выбрал резерв", null);
    } else {
      let number = profile.ambassador_number;
      if (!number) number = await db.nextAmbassadorNumber(client);
      await client.query(
        `UPDATE amb_profiles SET program_role='ambassador', activity_status='active',
           ambassador_number=$2, joined_at=COALESCE(joined_at, CURRENT_TIMESTAMP) WHERE id=$1`,
        [profile.id, number]
      );
      await db.logStatusChange(client, profile.id, "program_role", profile.program_role, "ambassador", "Цифровая верификация действующего амбассадора", null);
      kyd = db.formatKyd(number);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  await db.clearState(deps.pool, ctx.from.id);
  if (wantsReserve) {
    await ctx.reply(t(lang, "migrate_reserve_done"), { reply_markup: { remove_keyboard: true } });
  } else {
    await ctx.reply(t(lang, "migrate_done", { kyd }), { reply_markup: { remove_keyboard: true } });
    await deps.showMenu(ctx, lang);
  }
  await notifyAdminChat(deps.bot, `🔁 Верификация: ${a.name || "?"} (${a.city || "?"}) — ${wantsReserve ? "резерв" : kyd}`);
}

/* ---------- update handlers (called from bot/index.js dispatcher) ---------- */

async function handleMessage(ctx, deps, stateRow) {
  const lang = await getLang(deps, ctx.from.id);
  const payload = stateRow.payload || {};
  const state = stateRow.state;
  const questions = questionsFor(payload);

  if (state === "reg:guardian") {
    const text = (ctx.message.text || "").trim();
    if (text.length < 5) return ctx.reply(t(lang, "minor_guardian"));
    payload.answers.guardian_contact = text;
    const kb = new InlineKeyboard().text(t(lang, "btn_guardian_ok"), "R:g:ok");
    await db.setState(deps.pool, ctx.from.id, "reg:guardian_confirm", payload);
    return ctx.reply(t(lang, "minor_confirm"), { reply_markup: kb });
  }

  const editMatch = state.match(/^reg:edit:(.+)$/);
  const qMatch = state.match(/^reg:q:(\d+)$/);
  let index = null;
  let viaEdit = false;
  if (qMatch) index = Number(qMatch[1]);
  if (editMatch) {
    index = questions.findIndex((q) => q.key === editMatch[1]);
    viaEdit = true;
  }

  if (index != null && index >= 0) {
    const q = questions[index];
    if (q.type === "contact") {
      const contact = ctx.message.contact;
      if (!contact || (contact.user_id && contact.user_id !== ctx.from.id)) {
        return ctx.reply(t(lang, "phone_button_only"));
      }
      return saveAnswer(ctx, deps, lang, payload, index, contact.phone_number, viaEdit);
    }
    const text = (ctx.message.text || "").trim();
    if (!text) return ctx.reply(t(lang, q.prompt));
    if (q.type === "date") {
      const date = parseDate(text);
      if (!date) return ctx.reply(t(lang, "bad_date"));
      const age = ageOf(date);
      if (age < 14 || age > 55) return ctx.reply(t(lang, "age_range"));
      return saveAnswer(ctx, deps, lang, payload, index, text, viaEdit);
    }
    if (q.type === "email") {
      if (!isEmail(text)) return ctx.reply(t(lang, "bad_email"));
      return saveAnswer(ctx, deps, lang, payload, index, text.toLowerCase(), viaEdit);
    }
    if (q.type === "city") {
      return saveAnswer(ctx, deps, lang, payload, index, text, viaEdit);
    }
    if (q.type === "edu" || q.type === "availability") {
      return ctx.reply(t(lang, q.prompt)); // buttons only
    }
    if (q.min && text.length < q.min) {
      return ctx.reply(t(lang, q.shortKey || q.prompt, { n: text.length }));
    }
    return saveAnswer(ctx, deps, lang, payload, index, text, viaEdit);
  }

  if (state === "reg:city_other") {
    const text = (ctx.message.text || "").trim();
    if (!text) return ctx.reply(t(lang, "q_city_other"));
    const idx = questions.findIndex((q) => q.key === "city");
    return saveAnswer(ctx, deps, lang, payload, idx, text, payload.editingCity === true);
  }

  if (state === "reg:intro_text") {
    const text = (ctx.message.text || "").trim();
    if (text.length < 200) return ctx.reply(t(lang, "intro_text_short", { n: text.length }));
    payload.intro.content = text;
    return showSummary(ctx, deps, lang, payload);
  }

  if (state === "reg:intro_video") {
    const video = ctx.message.video || ctx.message.video_note;
    if (!video) return ctx.reply(t(lang, "intro_video_expected"));
    if (video.duration && video.duration > 75) return ctx.reply(t(lang, "intro_video_long"));
    payload.intro.fileId = video.file_id;
    payload.intro.content = "video";
    return showSummary(ctx, deps, lang, payload);
  }

  // states waiting for a button press
  return null;
}

async function handleCallback(ctx, deps, stateRow) {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith("R:")) return false;
  const lang = await getLang(deps, ctx.from.id);
  const payload = (stateRow && stateRow.payload) || {};
  const state = (stateRow && stateRow.state) || "";
  const questions = questionsFor(payload);
  await ctx.answerCallbackQuery().catch(() => {});

  if (data === "R:more") {
    return ctx.reply(t(lang, "more_info"));
  }
  if (data === "R:go" && state === "reg:intro") {
    payload.consents = {};
    await db.setState(deps.pool, ctx.from.id, "reg:consents", payload);
    return sendConsents(ctx, deps, lang, payload);
  }
  if (data === "R:res:yes" && state) {
    return resumeState(ctx, deps, lang, stateRow);
  }
  if (data === "R:res:no") {
    const flow = payload.flow || "reg";
    if (flow === "mig") return startMigration(ctx, deps);
    return startNew(ctx, deps, payload.source);
  }

  if (data.startsWith("R:c:") && state === "reg:consents") {
    const key = data.slice(4);
    if (key === "ok") {
      const c = payload.consents || {};
      if (!(c.pdn && c.rules && c.code && c.mailing)) {
        return ctx.reply(t(lang, "consents_need_all"));
      }
      const now = new Date().toISOString();
      payload.consents = { pdn: now, rules: now, code: now, mailing: now };
      payload.answers = payload.answers || {};
      return askQuestion(ctx, deps, lang, payload, 0);
    }
    payload.consents = payload.consents || {};
    payload.consents[key] = !payload.consents[key];
    await db.setState(deps.pool, ctx.from.id, "reg:consents", payload);
    return updateConsents(ctx, deps, lang, payload);
  }

  if (data === "R:g:ok" && state === "reg:guardian_confirm") {
    const idx = questions.findIndex((q) => q.key === "city");
    return askQuestion(ctx, deps, lang, payload, idx);
  }

  if (data.startsWith("R:city:")) {
    const val = data.slice(7);
    const idx = questions.findIndex((q) => q.key === "city");
    const viaEdit = state.startsWith("reg:edit:");
    if (val === "x") {
      payload.editingCity = viaEdit;
      await db.setState(deps.pool, ctx.from.id, "reg:city_other", payload);
      return ctx.reply(t(lang, "q_city_other"));
    }
    return saveAnswer(ctx, deps, lang, payload, idx, CITIES[Number(val)] || CITIES[0], viaEdit);
  }

  if (data.startsWith("R:edu:")) {
    const idx = questions.findIndex((q) => q.key === "edu");
    return saveAnswer(ctx, deps, lang, payload, idx, data.slice(6), state.startsWith("reg:edit:"));
  }

  if (data.startsWith("R:av:")) {
    const idx = questions.findIndex((q) => q.key === "availability");
    return saveAnswer(ctx, deps, lang, payload, idx, data.slice(5), false);
  }

  if (data === "R:skip") {
    const qMatch = state.match(/^reg:q:(\d+)$/);
    if (!qMatch) return true;
    const index = Number(qMatch[1]);
    payload.answers = payload.answers || {};
    payload.answers[questions[index].key] = null;
    return advance(ctx, deps, lang, payload, index);
  }

  if (data.startsWith("R:tp:") && state === "reg:track_primary") {
    payload.tracks = { primary: Number(data.slice(5)), extra: [] };
    return askTrackExtra(ctx, deps, lang, payload);
  }

  if (data.startsWith("R:tx:") && state === "reg:track_extra") {
    const val = data.slice(5);
    if (val === "done" || val === "none") {
      if (val === "none") payload.tracks.extra = [];
      return afterTracks(ctx, deps, lang, payload);
    }
    const trackId = Number(val);
    if (trackId === payload.tracks.primary) return true;
    const pos = payload.tracks.extra.indexOf(trackId);
    if (pos >= 0) payload.tracks.extra.splice(pos, 1);
    else if (payload.tracks.extra.length >= 2) return ctx.reply(t(lang, "track_extra_limit"));
    else payload.tracks.extra.push(trackId);
    await db.setState(deps.pool, ctx.from.id, "reg:track_extra", payload);
    const kb = await trackKeyboard(deps, lang, "R:tx:", payload.tracks.extra);
    kb.row().text(t(lang, "btn_done"), "R:tx:done").text(t(lang, "btn_no_extra"), "R:tx:none");
    return ctx.editMessageReplyMarkup({ reply_markup: kb }).catch(() => {});
  }

  if (data.startsWith("R:i:") && state === "reg:intro_choose") {
    const type = data.slice(4);
    payload.intro = { type };
    if (type === "quiz") return startQuiz(ctx, deps, lang, payload);
    if (type === "video") {
      await db.setState(deps.pool, ctx.from.id, "reg:intro_video", payload);
      return ctx.reply(t(lang, "intro_video"));
    }
    await db.setState(deps.pool, ctx.from.id, "reg:intro_text", payload);
    return ctx.reply(t(lang, INTRO_PROMPTS[type] || "intro_idea"));
  }

  if (data.startsWith("R:qz:") && state === "reg:quiz") {
    const [, , qIdxStr, optStr] = data.split(":");
    const qIdx = Number(qIdxStr);
    if (qIdx !== payload.quiz.idx) return true; // stale button
    const quiz = QUIZ[lang] || QUIZ.ru;
    if (Number(optStr) === quiz[qIdx][2]) payload.quiz.correct += 1;
    payload.quiz.idx += 1;
    if (payload.quiz.idx < quiz.length) return sendQuizQuestion(ctx, deps, lang, payload);

    const score = payload.quiz.correct;
    const need = payload.flow === "mig" ? 3 : 4;
    payload.quiz.lastScore = score;
    if (score >= need) {
      await ctx.reply(t(lang, "quiz_pass", { score }));
      if (payload.flow === "mig") return askMigrateConfirm(ctx, deps, lang, payload);
      payload.intro = { type: "quiz", quizScore: score, content: `quiz ${score}/5` };
      return showSummary(ctx, deps, lang, payload);
    }
    payload.quiz.attempts += 1;
    if (payload.quiz.attempts < 2) {
      await ctx.reply(t(lang, "quiz_fail_retry", { score, need }));
      return startQuiz(ctx, deps, lang, payload);
    }
    if (payload.flow === "mig") {
      // do not block long-standing members on a quiz — record the score and continue
      return askMigrateConfirm(ctx, deps, lang, payload);
    }
    await ctx.reply(t(lang, "quiz_fail_final"));
    return askIntroChoice(ctx, deps, lang, payload);
  }

  if (data === "R:fin:send" && state === "reg:summary") {
    return submitApplication(ctx, deps, lang, payload);
  }
  if (data === "R:fin:edit" && state === "reg:summary") {
    const kb = new InlineKeyboard();
    EDITABLE_KEYS.filter((k) => questions.some((q) => q.key === k)).forEach((key, i) => {
      const q = questions.find((x) => x.key === key);
      kb.text(t(lang, q.prompt).slice(0, 30), `R:e:${key}`);
      if (i % 2 === 1) kb.row();
    });
    kb.row().text(t(lang, "btn_back_summary"), "R:e:back");
    await db.setState(deps.pool, ctx.from.id, "reg:summary", payload);
    return ctx.reply(t(lang, "edit_which"), { reply_markup: kb });
  }
  if (data.startsWith("R:e:")) {
    const key = data.slice(4);
    if (key === "back") return showSummary(ctx, deps, lang, payload);
    const idx = questions.findIndex((q) => q.key === key);
    if (idx < 0) return true;
    return askQuestion(ctx, deps, lang, payload, idx, true);
  }

  if (data === "M:yes" && state === "reg:mig_confirm") {
    return finalizeMigration(ctx, deps, lang, payload, false);
  }
  if (data === "M:res" && state === "reg:mig_confirm") {
    return finalizeMigration(ctx, deps, lang, payload, true);
  }

  return true; // R:* callback consumed even if state mismatched (stale button)
}

async function askMigrateConfirm(ctx, deps, lang, payload) {
  await db.setState(deps.pool, ctx.from.id, "reg:mig_confirm", payload);
  const kb = new InlineKeyboard().text(t(lang, "btn_migrate_yes"), "M:yes").row().text(t(lang, "btn_migrate_reserve"), "M:res");
  return ctx.reply(t(lang, "migrate_confirm"), { reply_markup: kb });
}

async function sendConsents(ctx, deps, lang, payload) {
  const kb = consentsKeyboard(lang, payload.consents || {});
  return ctx.reply(t(lang, "consents_title"), { reply_markup: kb });
}

async function updateConsents(ctx, deps, lang, payload) {
  const kb = consentsKeyboard(lang, payload.consents || {});
  return ctx.editMessageReplyMarkup({ reply_markup: kb }).catch(() => {});
}

function consentsKeyboard(lang, c) {
  const mark = (v) => (v ? "☑" : "▫️");
  return new InlineKeyboard()
    .text(`${mark(c.pdn)} ${t(lang, "consent_pdn")}`, "R:c:pdn").row()
    .text(`${mark(c.rules)} ${t(lang, "consent_rules")}`, "R:c:rules").row()
    .text(`${mark(c.code)} ${t(lang, "consent_code")}`, "R:c:code").row()
    .text(`${mark(c.mailing)} ${t(lang, "consent_mailing")}`, "R:c:mailing").row()
    .text(t(lang, "btn_confirm_all"), "R:c:ok");
}

/* Re-ask the question matching the saved state (used by "Продолжить"). */
async function resumeState(ctx, deps, lang, stateRow) {
  const payload = stateRow.payload || {};
  const state = stateRow.state;
  const questions = questionsFor(payload);
  const qMatch = state.match(/^reg:q:(\d+)$/);
  if (qMatch) return askQuestion(ctx, deps, lang, payload, Number(qMatch[1]));
  if (state === "reg:consents") return sendConsents(ctx, deps, lang, payload);
  if (state === "reg:track_primary") return askTrackPrimary(ctx, deps, lang, payload);
  if (state === "reg:track_extra") return askTrackExtra(ctx, deps, lang, payload);
  if (state === "reg:intro_choose") return askIntroChoice(ctx, deps, lang, payload);
  if (state === "reg:summary") return showSummary(ctx, deps, lang, payload);
  if (state === "reg:quiz") return startQuiz(ctx, deps, lang, payload);
  if (state === "reg:mig_confirm") return askMigrateConfirm(ctx, deps, lang, payload);
  if (state === "reg:intro") {
    if (payload.flow === "mig") return startMigration(ctx, deps);
    return startNew(ctx, deps, payload.source);
  }
  // text-input states: just repeat the last prompt generically
  return askQuestion(ctx, deps, lang, payload, 0);
}

module.exports = { startNew, startMigration, askResume, handleMessage, handleCallback, ensureProfile, askTrackPrimary };
