/* Weekly report (scenario E): 5 questions, needs_help escalation, streak bonus. */

const { InlineKeyboard } = require("grammy");
const { t } = require("../i18n");
const db = require("../../lib/amb-db");
const { maybeAwardWeeklyStreak } = require("../../lib/amb-points");
const { notifyTeamlead } = require("../notify");
const { fullName } = require("../menu");

/* Monday of the current week in Asia/Almaty (UTC+5), as YYYY-MM-DD. */
function currentWeekStart(now) {
  const almaty = new Date((now || Date.now()) + 5 * 3600000);
  const day = almaty.getUTCDay() || 7; // Mon=1..Sun=7
  almaty.setUTCDate(almaty.getUTCDate() - (day - 1));
  return almaty.toISOString().slice(0, 10);
}

async function alreadySubmitted(pool, profileId) {
  const r = await pool.query(
    `SELECT 1 FROM amb_weekly_reports WHERE profile_id = $1 AND week_start = $2`,
    [profileId, currentWeekStart()]
  );
  return r.rows.length > 0;
}

async function offerWeekly(ctx, deps, lang, profile) {
  if (await alreadySubmitted(deps.pool, profile.id)) {
    return ctx.reply(t(lang, "weekly_already"));
  }
  const kb = new InlineKeyboard().text(t(lang, "btn_weekly_start"), "W:go");
  return ctx.reply(t(lang, "weekly_start", { name: profile.first_name || "" }), { reply_markup: kb });
}

async function askQ(ctx, deps, lang, payload, n) {
  await db.setState(deps.pool, ctx.from.id, `weekly:q${n}`, payload);
  if (n === 1) {
    const kb = new InlineKeyboard().text(t(lang, "btn_weekly_nothing"), "W:a:none");
    return ctx.reply(t(lang, "weekly_q1"), { reply_markup: kb });
  }
  if (n === 2) {
    const kb = new InlineKeyboard().text(t(lang, "btn_weekly_no_events"), "W:a:none");
    return ctx.reply(t(lang, "weekly_q2"), { reply_markup: kb });
  }
  if (n === 3) {
    const kb = new InlineKeyboard().text(t(lang, "btn_skip"), "W:a:none");
    return ctx.reply(t(lang, "weekly_q3"), { reply_markup: kb });
  }
  if (n === 4) {
    const kb = new InlineKeyboard().text(t(lang, "btn_weekly_ok"), "W:a:ok");
    return ctx.reply(t(lang, "weekly_q4"), { reply_markup: kb });
  }
  const kb = new InlineKeyboard()
    .text(t(lang, "btn_yes"), "W:a:yes")
    .text(t(lang, "btn_partial"), "W:a:partial")
    .text(t(lang, "btn_no"), "W:a:no");
  return ctx.reply(t(lang, "weekly_q5"), { reply_markup: kb });
}

const KEYS = { 1: "done", 2: "events", 3: "skills", 4: "help", 5: "next_week" };

async function saveAnswer(ctx, deps, lang, profile, stateRow, value) {
  const n = Number(stateRow.state.slice(-1));
  const payload = stateRow.payload || {};
  payload.answers = payload.answers || {};
  payload.answers[KEYS[n]] = value;
  if (n < 5) return askQ(ctx, deps, lang, payload, n + 1);

  const needsHelp = Boolean(payload.answers.help && payload.answers.help !== "ok");
  await deps.pool.query(
    `INSERT INTO amb_weekly_reports (profile_id, week_start, answers, needs_help)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (profile_id, week_start)
     DO UPDATE SET answers = $3, needs_help = $4`,
    [profile.id, currentWeekStart(), JSON.stringify(payload.answers), needsHelp]
  );
  await db.clearState(deps.pool, ctx.from.id);
  await ctx.reply(t(lang, "weekly_thanks"));
  if (needsHelp) {
    await notifyTeamlead(deps.pool, deps.bot, profile.id,
      t("ru", "weekly_help_flag", { name: fullName(profile), text: payload.answers.help }));
  }
  const streak = await maybeAwardWeeklyStreak(deps.pool, profile.id, lang, t);
  if (streak) await ctx.reply(t(lang, "weekly_streak"));
  return true;
}

async function handleMessage(ctx, deps, stateRow, profile) {
  const lang = profile.language || "ru";
  const text = (ctx.message.text || "").trim();
  if (!text) return true;
  return saveAnswer(ctx, deps, lang, profile, stateRow, text);
}

async function handleCallback(ctx, deps, stateRow, profile) {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith("W:")) return false;
  const lang = profile.language || "ru";
  await ctx.answerCallbackQuery().catch(() => {});
  if (data === "W:go") {
    if (await alreadySubmitted(deps.pool, profile.id)) return ctx.reply(t(lang, "weekly_already"));
    return askQ(ctx, deps, lang, {}, 1);
  }
  if (data.startsWith("W:a:") && stateRow && stateRow.state.startsWith("weekly:q")) {
    const val = data.slice(4);
    const mapped = val === "none" ? null : val;
    return saveAnswer(ctx, deps, lang, profile, stateRow, mapped);
  }
  return true;
}

module.exports = { offerWeekly, handleMessage, handleCallback, currentWeekStart, alreadySubmitted };
