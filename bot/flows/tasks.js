/* Tasks in the bot: browse available, take, submit reports (scenario D). */

const { InlineKeyboard } = require("grammy");
const { t } = require("../i18n");
const db = require("../../lib/amb-db");
const { notifyTeamlead } = require("../notify");

function fmtDeadline(lang, deadline) {
  if (!deadline) return t(lang, "no_deadline");
  const d = new Date(deadline);
  return d.toLocaleString(lang === "kz" ? "kk-KZ" : "ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });
}

function pointsLabel(task) {
  return task.points_min === task.points_max ? String(task.points_max) : `${task.points_min}–${task.points_max}`;
}

async function showTasksMenu(ctx, deps, lang) {
  const kb = new InlineKeyboard()
    .text(t(lang, "btn_tasks_available"), "TK:list")
    .text(t(lang, "btn_tasks_mine"), "TK:mine");
  await ctx.reply(t(lang, "tasks_which"), { reply_markup: kb });
}

async function availableTasks(deps, profile) {
  const trackIds = (
    await deps.pool.query(`SELECT track_id FROM amb_profile_tracks WHERE profile_id = $1`, [profile.id])
  ).rows.map((r) => r.track_id);
  const r = await deps.pool.query(
    `SELECT tk.*,
       (SELECT COUNT(*)::INT FROM amb_task_assignments a
        WHERE a.task_id = tk.id AND a.status NOT IN ('cancelled')) AS taken_count,
       EXISTS (SELECT 1 FROM amb_task_assignments a
        WHERE a.task_id = tk.id AND a.profile_id = $1) AS already
     FROM amb_tasks tk
     WHERE tk.status = 'open'
       AND (tk.deadline IS NULL OR tk.deadline > CURRENT_TIMESTAMP)
       AND (
         tk.audience = 'all'
         OR (tk.audience = 'stream' AND tk.audience_id = $2)
         OR (tk.audience = 'team' AND tk.audience_id = $3)
         OR (tk.audience = 'track' AND tk.audience_id = ANY($4::int[]))
       )
     ORDER BY tk.deadline NULLS LAST, tk.id DESC
     LIMIT 10`,
    [profile.id, profile.stream_id || 0, profile.team_id || 0, trackIds.length ? trackIds : [0]]
  );
  return r.rows.filter((task) => !task.already && (!task.max_participants || task.taken_count < task.max_participants));
}

async function listAvailable(ctx, deps, lang, profile) {
  const tasks = await availableTasks(deps, profile);
  if (!tasks.length) return ctx.reply(t(lang, "tasks_none"));
  for (const task of tasks) {
    const slots = task.max_participants ? Math.max(0, task.max_participants - task.taken_count) : "∞";
    const kb = new InlineKeyboard().text(t(lang, "btn_take_task"), `TK:take:${task.id}`);
    await ctx.reply(
      t(lang, "task_card", {
        title: task.title,
        category: t(lang, "cat_" + task.category),
        points: pointsLabel(task),
        deadline: fmtDeadline(lang, task.deadline),
        slots,
        description: task.description,
        expected: task.expected_result || "—",
        format: t(lang, "fmt_" + task.report_format),
      }),
      { reply_markup: kb }
    );
  }
}

async function listMine(ctx, deps, lang, profile) {
  const r = await deps.pool.query(
    `SELECT a.id AS assignment_id, a.status AS a_status, tk.*
     FROM amb_task_assignments a JOIN amb_tasks tk ON tk.id = a.task_id
     WHERE a.profile_id = $1 AND a.status IN ('taken','submitted','rejected')
     ORDER BY a.taken_at DESC LIMIT 10`,
    [profile.id]
  );
  if (!r.rows.length) return ctx.reply(t(lang, "tasks_mine_none"));
  const statusIcon = { taken: "🔵", submitted: "🟡", rejected: "🔄" };
  for (const row of r.rows) {
    const kb = new InlineKeyboard();
    if (row.a_status === "taken" || row.a_status === "rejected") {
      kb.text(t(lang, "btn_submit_report"), `TK:sub:${row.assignment_id}`);
    }
    await ctx.reply(
      `${statusIcon[row.a_status] || ""} ${row.title}\n${t(lang, "cat_" + row.category)} · ${pointsLabel(row)} ⭐ · ${fmtDeadline(lang, row.deadline)}`,
      { reply_markup: kb.inline_keyboard && kb.inline_keyboard.length ? kb : undefined }
    );
  }
}

async function takeTask(ctx, deps, lang, profile, taskId) {
  const { pool } = deps;
  const r = await pool.query(`SELECT * FROM amb_tasks WHERE id = $1 AND status = 'open'`, [taskId]);
  const task = r.rows[0];
  if (!task) return ctx.reply(t(lang, "tasks_none"));
  if (task.max_participants) {
    const cnt = await pool.query(
      `SELECT COUNT(*)::INT AS n FROM amb_task_assignments WHERE task_id = $1 AND status NOT IN ('cancelled')`,
      [taskId]
    );
    if (cnt.rows[0].n >= task.max_participants) return ctx.reply(t(lang, "task_full"));
  }
  try {
    await pool.query(
      `INSERT INTO amb_task_assignments (task_id, profile_id) VALUES ($1,$2)`,
      [taskId, profile.id]
    );
  } catch (err) {
    if (err.code === "23505") return ctx.reply(t(lang, "task_already"));
    throw err;
  }
  return ctx.reply(t(lang, "task_taken", { title: task.title, deadline: fmtDeadline(lang, task.deadline) }));
}

async function askReport(ctx, deps, lang, profile, assignmentId) {
  const r = await deps.pool.query(
    `SELECT a.id, a.status, tk.title, tk.report_format
     FROM amb_task_assignments a JOIN amb_tasks tk ON tk.id = a.task_id
     WHERE a.id = $1 AND a.profile_id = $2`,
    [assignmentId, profile.id]
  );
  const row = r.rows[0];
  if (!row || !["taken", "rejected"].includes(row.status)) return ctx.reply(t(lang, "tasks_mine_none"));
  if (row.report_format === "none") {
    return submitReport(ctx, deps, lang, profile, { assignmentId, text: "—" });
  }
  const promptKey = { text: "report_ask_text", photo: "report_ask_photo", file: "report_ask_file", link: "report_ask_link" }[row.report_format] || "report_ask_text";
  await db.setState(deps.pool, ctx.from.id, `task:submit:${assignmentId}`, { format: row.report_format, title: row.title });
  return ctx.reply(t(lang, promptKey, { title: row.title }));
}

async function handleReportMessage(ctx, deps, stateRow) {
  const lang = (await db.getProfileByTg(deps.pool, ctx.from.id) || {}).language || "ru";
  const profile = await db.getProfileByTg(deps.pool, ctx.from.id);
  const assignmentId = Number(stateRow.state.split(":")[2]);
  const { format } = stateRow.payload;
  const msg = ctx.message;

  const report = { assignmentId };
  if (format === "text") {
    const text = (msg.text || "").trim();
    if (text.length < 20) return ctx.reply(t(lang, "report_wrong_format", { format: t(lang, "fmt_text") + " (≥20)" }));
    report.text = text;
  } else if (format === "photo") {
    if (!msg.photo || !msg.photo.length) return ctx.reply(t(lang, "report_wrong_format", { format: t(lang, "fmt_photo") }));
    report.fileId = msg.photo[msg.photo.length - 1].file_id;
    report.text = msg.caption || null;
  } else if (format === "file") {
    if (!msg.document) return ctx.reply(t(lang, "report_wrong_format", { format: t(lang, "fmt_file") }));
    report.fileId = msg.document.file_id;
    report.text = msg.caption || null;
  } else if (format === "link") {
    const text = (msg.text || "").trim();
    if (!/^https?:\/\/\S+$/i.test(text)) return ctx.reply(t(lang, "report_wrong_format", { format: t(lang, "fmt_link") }));
    report.link = text;
  }
  return submitReport(ctx, deps, lang, profile, report);
}

async function submitReport(ctx, deps, lang, profile, report) {
  const { pool } = deps;
  const r = await pool.query(
    `UPDATE amb_task_assignments
     SET status='submitted', report_text=$3, report_file_id=$4, report_link=$5,
         submitted_at=CURRENT_TIMESTAMP,
         resubmit_count = resubmit_count + CASE WHEN status='rejected' THEN 1 ELSE 0 END
     WHERE id=$1 AND profile_id=$2 AND status IN ('taken','rejected')
     RETURNING task_id`,
    [report.assignmentId, profile.id, report.text || null, report.fileId || null, report.link || null]
  );
  if (!r.rows[0]) return ctx.reply(t(lang, "error_generic"));
  await db.clearState(pool, ctx.from.id);
  await ctx.reply(t(lang, "report_saved"));
  const taskTitle = (await pool.query(`SELECT title FROM amb_tasks WHERE id=$1`, [r.rows[0].task_id])).rows[0].title;
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  await notifyTeamlead(pool, deps.bot, profile.id, `📥 Отчет на проверку: «${taskTitle}» от ${name}. Панель: ${process.env.APP_BASE_URL || ""}/amb-admin.html`);
}

async function handleCallback(ctx, deps, profile) {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith("TK:")) return false;
  const lang = profile.language || "ru";
  await ctx.answerCallbackQuery().catch(() => {});
  if (data === "TK:list") return listAvailable(ctx, deps, lang, profile);
  if (data === "TK:mine") return listMine(ctx, deps, lang, profile);
  if (data.startsWith("TK:take:")) return takeTask(ctx, deps, lang, profile, Number(data.slice(8)));
  if (data.startsWith("TK:sub:")) return askReport(ctx, deps, lang, profile, Number(data.slice(7)));
  return true;
}

module.exports = { showTasksMenu, handleCallback, handleReportMessage };
