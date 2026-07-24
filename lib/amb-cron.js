/* Background jobs. Tick every 10 minutes; once-per-period jobs are deduped
   via amb_meta so restarts on Render do not double-send. Timezone: UTC+5 (Kazakhstan). */

const { t } = require("../bot/i18n");
const { currentWeekStart } = require("../bot/flows/weekly");
const { sendToTelegram } = require("../bot/notify");
const db = require("./amb-db");

const TICK_MS = 10 * 60 * 1000;
const ACCEPTED = `('trainee','ambassador','active','senior','teamlead','coordinator')`;

function almatyNow() {
  return new Date(Date.now() + 5 * 3600000); // read via getUTC* below
}

async function ranAlready(pool, key) {
  const r = await pool.query(`SELECT 1 FROM amb_meta WHERE key = $1`, [key]);
  return r.rows.length > 0;
}

async function markRan(pool, key) {
  await pool.query(
    `INSERT INTO amb_meta (key, value, updated_at) VALUES ($1, 'done', CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET updated_at = CURRENT_TIMESTAMP`,
    [key]
  );
}

/* Monday >= 10:00 — offer the weekly report to everyone active. */
async function weeklySend(pool, bot) {
  const week = currentWeekStart();
  const key = `weekly_send:${week}`;
  if (await ranAlready(pool, key)) return;
  await markRan(pool, key);
  const r = await pool.query(
    `SELECT p.id, p.telegram_id, p.language, p.first_name
     FROM amb_profiles p
     WHERE p.program_role IN ${ACCEPTED}
       AND p.activity_status NOT IN ('suspended','reserve')
       AND NOT EXISTS (SELECT 1 FROM amb_weekly_reports w WHERE w.profile_id = p.id AND w.week_start = $1)`,
    [week]
  );
  for (const p of r.rows) {
    await sendToTelegram(bot, p.telegram_id, t(p.language, "weekly_start", { name: p.first_name || "" }), {
      reply_markup: { inline_keyboard: [[{ text: t(p.language, "btn_weekly_start"), callback_data: "W:go" }]] },
    });
  }
  console.log(`[amb-cron] weekly report offered to ${r.rows.length} member(s)`);
}

/* Wednesday >= 18:00 — one reminder for those who have not submitted. */
async function weeklyRemind(pool, bot) {
  const week = currentWeekStart();
  const key = `weekly_remind:${week}`;
  if (await ranAlready(pool, key)) return;
  await markRan(pool, key);
  const r = await pool.query(
    `SELECT p.telegram_id, p.language
     FROM amb_profiles p
     WHERE p.program_role IN ${ACCEPTED}
       AND p.activity_status NOT IN ('suspended','reserve')
       AND NOT EXISTS (SELECT 1 FROM amb_weekly_reports w WHERE w.profile_id = p.id AND w.week_start = $1)`,
    [week]
  );
  for (const p of r.rows) {
    await sendToTelegram(bot, p.telegram_id, t(p.language, "weekly_remind"), {
      reply_markup: { inline_keyboard: [[{ text: t(p.language, "btn_weekly_start"), callback_data: "W:go" }]] },
    });
  }
}

/* Daily >= 09:00 — activity transitions + expirations. */
async function dailyJobs(pool, bot) {
  const day = almatyNow().toISOString().slice(0, 10);
  const key = `daily:${day}`;
  if (await ranAlready(pool, key)) return;
  await markRan(pool, key);

  // 3 weeks silent -> unresponsive, notify teamlead
  const silent = await pool.query(
    `SELECT p.id, p.first_name, p.last_name
     FROM amb_profiles p
     WHERE p.program_role IN ${ACCEPTED} AND p.activity_status = 'active'
       AND COALESCE(p.joined_at, p.created_at) < CURRENT_TIMESTAMP - INTERVAL '21 days'
       AND NOT EXISTS (SELECT 1 FROM amb_weekly_reports w
                       WHERE w.profile_id = p.id AND w.week_start > CURRENT_DATE - 21)`
  );
  for (const p of silent.rows) {
    await pool.query(`UPDATE amb_profiles SET activity_status='unresponsive' WHERE id=$1`, [p.id]);
    await db.logStatusChange(pool, p.id, "activity_status", "active", "unresponsive", "3 недели без отчетов (авто)", null);
    const { notifyTeamlead } = require("../bot/notify");
    await notifyTeamlead(pool, bot, p.id, `⚠️ ${[p.first_name, p.last_name].filter(Boolean).join(" ")} давно не выходит на связь (3+ недели без отчетов). Напиши человеку.`);
  }

  // 6 weeks silent -> reserve, gentle goodbye
  const gone = await pool.query(
    `SELECT p.id, p.telegram_id, p.language
     FROM amb_profiles p
     WHERE p.activity_status = 'unresponsive'
       AND NOT EXISTS (SELECT 1 FROM amb_weekly_reports w
                       WHERE w.profile_id = p.id AND w.week_start > CURRENT_DATE - 42)`
  );
  for (const p of gone.rows) {
    await pool.query(`UPDATE amb_profiles SET activity_status='reserve' WHERE id=$1`, [p.id]);
    await db.logStatusChange(pool, p.id, "activity_status", "unresponsive", "reserve", "6 недель без активности (авто)", null);
    await sendToTelegram(bot, p.telegram_id, t(p.language, "unresponsive_pause"));
  }

  // expire assignments past deadline
  const expired = await pool.query(
    `UPDATE amb_task_assignments a
     SET status='expired'
     FROM amb_tasks tk, amb_profiles p
     WHERE a.task_id = tk.id AND p.id = a.profile_id
       AND a.status = 'taken' AND tk.deadline IS NOT NULL AND tk.deadline < CURRENT_TIMESTAMP
     RETURNING a.id, tk.title, p.telegram_id, p.language`
  );
  for (const row of expired.rows) {
    await sendToTelegram(bot, row.telegram_id, t(row.language, "task_expired", { title: row.title }));
  }
}

/* Hourly-ish: deadline (24h) reminders, event reminders, unfinished-registration nudge. */
async function rollingJobs(pool, bot) {
  const soon = await pool.query(
    `SELECT a.id, tk.title, p.telegram_id, p.language
     FROM amb_task_assignments a
     JOIN amb_tasks tk ON tk.id = a.task_id
     JOIN amb_profiles p ON p.id = a.profile_id
     WHERE a.status = 'taken' AND a.deadline_reminded = false
       AND tk.deadline BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '24 hours'`
  );
  for (const row of soon.rows) {
    await pool.query(`UPDATE amb_task_assignments SET deadline_reminded = true WHERE id = $1`, [row.id]);
    await sendToTelegram(bot, row.telegram_id, t(row.language, "task_deadline_soon", { title: row.title }));
  }

  const evs = await pool.query(
    `SELECT att.event_id, att.profile_id, e.title, e.event_date, e.location, p.telegram_id, p.language
     FROM amb_event_attendance att
     JOIN amb_events e ON e.id = att.event_id
     JOIN amb_profiles p ON p.id = att.profile_id
     WHERE att.reminded = false AND att.attended = false
       AND e.event_date BETWEEN CURRENT_TIMESTAMP + INTERVAL '12 hours' AND CURRENT_TIMESTAMP + INTERVAL '36 hours'`
  );
  for (const row of evs.rows) {
    await pool.query(
      `UPDATE amb_event_attendance SET reminded = true WHERE event_id = $1 AND profile_id = $2`,
      [row.event_id, row.profile_id]
    );
    const time = new Date(row.event_date).toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });
    await sendToTelegram(bot, row.telegram_id, t(row.language, "event_reminder", { title: row.title, time, location: row.location || "—" }));
  }

  const stale = await pool.query(
    `SELECT s.telegram_id, s.payload, p.language
     FROM amb_bot_states s
     LEFT JOIN amb_profiles p ON p.telegram_id = s.telegram_id
     WHERE s.state LIKE 'reg:%'
       AND s.updated_at BETWEEN CURRENT_TIMESTAMP - INTERVAL '48 hours' AND CURRENT_TIMESTAMP - INTERVAL '24 hours'
       AND COALESCE((s.payload->>'nudged')::boolean, false) = false`
  );
  for (const row of stale.rows) {
    const payload = row.payload || {};
    payload.nudged = true;
    await pool.query(
      `UPDATE amb_bot_states SET payload = $2 WHERE telegram_id = $1`,
      [row.telegram_id, JSON.stringify(payload)]
    );
    await sendToTelegram(bot, row.telegram_id, t((row && row.language) || "ru", "reg_nudge"));
  }
}

async function tick(pool, bot) {
  try {
    const now = almatyNow();
    const dow = now.getUTCDay(); // in shifted time: 1 = Monday
    const hour = now.getUTCHours();
    if (dow === 1 && hour >= 10) await weeklySend(pool, bot);
    if (dow === 3 && hour >= 18) await weeklyRemind(pool, bot);
    if (hour >= 9) await dailyJobs(pool, bot);
    await rollingJobs(pool, bot);
  } catch (err) {
    console.error("[amb-cron] tick error:", err);
  }
}

function startAmbCron({ pool, bot }) {
  if (!bot) {
    console.log("[amb-cron] bot not configured, cron disabled");
    return;
  }
  setInterval(() => tick(pool, bot), TICK_MS);
  setTimeout(() => tick(pool, bot), 30 * 1000); // first pass shortly after boot
  console.log("[amb-cron] started");
}

module.exports = { startAmbCron };
