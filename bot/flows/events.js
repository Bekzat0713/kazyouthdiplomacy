/* Events (scenario F): list, register, QR check-in via /start ev_<token>. */

const { InlineKeyboard } = require("grammy");
const { t } = require("../i18n");
const { addPoints } = require("../../lib/amb-points");

function fmtDate(lang, date) {
  return new Date(date).toLocaleString(lang === "kz" ? "kk-KZ" : "ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Almaty",
  });
}

async function listEvents(ctx, deps, lang, profile) {
  const trackIds = (
    await deps.pool.query(`SELECT track_id FROM amb_profile_tracks WHERE profile_id = $1`, [profile.id])
  ).rows.map((r) => r.track_id);
  const r = await deps.pool.query(
    `SELECT e.*,
       EXISTS (SELECT 1 FROM amb_event_attendance a WHERE a.event_id = e.id AND a.profile_id = $1) AS registered
     FROM amb_events e
     WHERE e.event_date > CURRENT_TIMESTAMP - INTERVAL '6 hours'
       AND (
         e.audience = 'all'
         OR (e.audience = 'stream' AND e.audience_id = $2)
         OR (e.audience = 'team' AND e.audience_id = $3)
         OR (e.audience = 'track' AND e.audience_id = ANY($4::int[]))
       )
     ORDER BY e.event_date ASC LIMIT 5`,
    [profile.id, profile.stream_id || 0, profile.team_id || 0, trackIds.length ? trackIds : [0]]
  );
  if (!r.rows.length) return ctx.reply(t(lang, "events_none"));
  for (const ev of r.rows) {
    const kb = new InlineKeyboard();
    if (ev.registration_open) {
      if (ev.registered) kb.text(t(lang, "btn_event_unreg"), `EV:unreg:${ev.id}`);
      else kb.text(t(lang, "btn_event_reg"), `EV:reg:${ev.id}`);
    }
    await ctx.reply(
      t(lang, "event_card", {
        title: ev.title,
        date: fmtDate(lang, ev.event_date),
        location: ev.location || "—",
        points: ev.points,
        description: ev.description || "",
      }),
      { reply_markup: kb.inline_keyboard && kb.inline_keyboard.length ? kb : undefined }
    );
  }
}

async function handleCallback(ctx, deps, profile) {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith("EV:")) return false;
  const lang = profile.language || "ru";
  await ctx.answerCallbackQuery().catch(() => {});
  const [, action, idStr] = data.split(":");
  const eventId = Number(idStr);
  if (action === "reg") {
    const ev = (await deps.pool.query(`SELECT title FROM amb_events WHERE id=$1 AND registration_open`, [eventId])).rows[0];
    if (!ev) return ctx.reply(t(lang, "event_not_found"));
    await deps.pool.query(
      `INSERT INTO amb_event_attendance (event_id, profile_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [eventId, profile.id]
    );
    return ctx.reply(t(lang, "event_registered", { title: ev.title }));
  }
  if (action === "unreg") {
    await deps.pool.query(
      `DELETE FROM amb_event_attendance WHERE event_id=$1 AND profile_id=$2 AND attended = false`,
      [eventId, profile.id]
    );
    return ctx.reply(t(lang, "event_unregistered"));
  }
  return true;
}

/* QR check-in: /start ev_<token>. Valid on the event day ±1 day. */
async function checkin(ctx, deps, lang, profile, token) {
  const { pool } = deps;
  const r = await pool.query(`SELECT * FROM amb_events WHERE qr_token = $1`, [token]);
  const ev = r.rows[0];
  if (!ev) return ctx.reply(t(lang, "event_not_found"));
  const dayMs = 86400000;
  const diff = Math.abs(new Date(ev.event_date).getTime() - Date.now());
  if (diff > 1.5 * dayMs) return ctx.reply(t(lang, "event_checkin_wrong_day"));

  const existing = await pool.query(
    `SELECT attended FROM amb_event_attendance WHERE event_id=$1 AND profile_id=$2`,
    [ev.id, profile.id]
  );
  if (existing.rows[0] && existing.rows[0].attended) {
    return ctx.reply(t(lang, "event_checkin_already"));
  }
  await pool.query(
    `INSERT INTO amb_event_attendance (event_id, profile_id, attended, confirmed_via, confirmed_at)
     VALUES ($1,$2,true,'qr',CURRENT_TIMESTAMP)
     ON CONFLICT (event_id, profile_id)
     DO UPDATE SET attended=true, confirmed_via='qr', confirmed_at=CURRENT_TIMESTAMP`,
    [ev.id, profile.id]
  );
  if (ev.points > 0) {
    await addPoints(pool, {
      profileId: profile.id,
      delta: ev.points,
      reason: (lang === "kz" ? "Іс-шараға қатысу: " : "Участие в мероприятии: ") + ev.title,
      sourceType: "event",
      sourceId: ev.id,
    });
  }
  return ctx.reply(t(lang, "event_checkin_ok", { title: ev.title, points: ev.points }));
}

module.exports = { listEvents, handleCallback, checkin };
