/* Main menu: profile, tracks, team, points, opportunities, help. */

const { Keyboard, InlineKeyboard } = require("grammy");
const { t } = require("./i18n");
const db = require("../lib/amb-db");
const { getBalance } = require("../lib/amb-points");

const ACCEPTED_ROLES = ["trainee", "ambassador", "active", "senior", "teamlead", "coordinator"];

function isAccepted(profile) {
  return profile && ACCEPTED_ROLES.includes(profile.program_role);
}

function envIdList(name) {
  return String(process.env[name] || "").split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
}

/* owner/admin resolved by Telegram ID (env bootstrap) or staff_role column. */
function isStaff(profile, telegramId) {
  const idStr = String(telegramId);
  if (envIdList("AMB_OWNER_TG_IDS").includes(idStr)) return "owner";
  if (envIdList("AMB_ADMIN_TG_IDS").includes(idStr)) return "admin";
  if (profile && (profile.staff_role === "owner" || profile.staff_role === "admin")) return profile.staff_role;
  return null;
}

/* Bot-facing role for menu selection: owner|admin|coordinator|team_leader|ambassador|candidate|regular_user */
function botRole(profile, telegramId) {
  const staff = isStaff(profile, telegramId);
  if (staff) return staff;
  if (!profile) return "regular_user";
  if (profile.program_role === "coordinator") return "coordinator";
  if (profile.program_role === "teamlead") return "team_leader";
  if (isAccepted(profile)) return "ambassador";
  if (profile.program_role === "candidate") return "candidate";
  return "regular_user";
}

/* Verification of existing ambassadors stays closed until the migration code +
   admin review are in place (stage 2). Off unless explicitly enabled. */
function isMigrationEnabled() {
  return process.env.AMB_MIGRATION_ENABLED === "1";
}

/* General entry menu for regular users (and staff without an ambassador cabinet). */
function generalMenuKeyboard(lang, showAdmin) {
  const kb = new Keyboard();
  if (isMigrationEnabled()) {
    kb.text(t(lang, "gmenu_current")).text(t(lang, "gmenu_join")).row();
  } else {
    kb.text(t(lang, "gmenu_join")).row();
  }
  kb.text(t(lang, "gmenu_vacancies")).text(t(lang, "gmenu_events")).row()
    .text(t(lang, "gmenu_training")).text(t(lang, "gmenu_ask")).row()
    .text(t(lang, "gmenu_about"));
  if (showAdmin) kb.row().text(t(lang, "gmenu_admin"));
  return kb.resized().persistent();
}

function candidateMenuKeyboard(lang, showAdmin) {
  const kb = new Keyboard()
    .text(t(lang, "menu_my_app")).text(t(lang, "gmenu_join")).row()
    .text(t(lang, "gmenu_ask")).text(t(lang, "gmenu_events")).row()
    .text(t(lang, "gmenu_about"));
  if (showAdmin) kb.row().text(t(lang, "gmenu_admin"));
  return kb.resized().persistent();
}

function cabinetMenuKeyboard(lang, showAdmin) {
  const kb = new Keyboard()
    .text(t(lang, "menu_profile")).text(t(lang, "menu_tracks")).row()
    .text(t(lang, "menu_team")).text(t(lang, "menu_tasks")).row()
    .text(t(lang, "menu_events")).text(t(lang, "menu_points")).row()
    .text(t(lang, "menu_report")).text(t(lang, "menu_opps")).row()
    .text(t(lang, "gmenu_ask")).text(t(lang, "menu_help"));
  if (showAdmin) kb.row().text(t(lang, "gmenu_admin"));
  return kb.resized().persistent();
}

async function showMenu(ctx, lang, profile) {
  const staff = isStaff(profile, ctx.from.id);
  if (isAccepted(profile)) {
    return ctx.reply(t(lang, "menu_hint"), { reply_markup: cabinetMenuKeyboard(lang, !!staff) });
  }
  if (profile && profile.program_role === "candidate") {
    return ctx.reply(t(lang, "menu_hint"), { reply_markup: candidateMenuKeyboard(lang, !!staff) });
  }
  return ctx.reply(t(lang, "gmenu_hint"), { reply_markup: generalMenuKeyboard(lang, !!staff) });
}

/* Match a message text against menu labels in both languages. */
function menuAction(text) {
  const map = [
    ["menu_profile", "profile"], ["menu_tracks", "tracks"], ["menu_team", "team"],
    ["menu_tasks", "tasks"], ["menu_events", "events"], ["menu_points", "points"],
    ["menu_report", "report"], ["menu_opps", "opps"], ["menu_help", "help"],
    ["menu_my_app", "my_app"],
    // general entry menu
    ["gmenu_current", "amb_current"], ["gmenu_join", "amb_join"],
    ["gmenu_vacancies", "vacancies"], ["gmenu_events", "events"],
    ["gmenu_training", "training"], ["gmenu_ask", "ask"],
    ["gmenu_about", "about"], ["gmenu_admin", "admin_panel"],
  ];
  for (const [key, action] of map) {
    if (t("ru", key) === text || t("kz", key) === text) return action;
  }
  return null;
}

async function showAbout(ctx, deps, lang) {
  const site = process.env.APP_BASE_URL || "https://kazyouthdiplomacy.com";
  await ctx.reply(t(lang, "about_text", { site }), { parse_mode: "HTML", disable_web_page_preview: true });
}

async function showVacancies(ctx, deps, lang) {
  const url = (process.env.APP_BASE_URL || "https://kazyouthdiplomacy.com") + "/internships.html";
  await ctx.reply(t(lang, "vacancies_text", { url }), { parse_mode: "HTML", disable_web_page_preview: true });
}

async function showTraining(ctx, deps, lang) {
  const url = process.env.CORE_SKILLS_URL || (process.env.APP_BASE_URL || "https://kazyouthdiplomacy.com");
  await ctx.reply(t(lang, "training_text", { url }), { parse_mode: "HTML", disable_web_page_preview: true });
}

async function showAskSoon(ctx, deps, lang) {
  const admin = process.env.TG_SUPPORT_CONTACT || "@KazYouthDiplomacy";
  await ctx.reply(t(lang, "ask_soon", { admin }), { parse_mode: "HTML" });
}

async function showAdminPanelLink(ctx, deps, lang) {
  const url = process.env.APP_BASE_URL || "https://kazyouthdiplomacy.com";
  await ctx.reply(t(lang, "admin_panel_link", { url }), { parse_mode: "HTML", disable_web_page_preview: true });
}

async function showPublicEvents(ctx, deps, lang) {
  const r = await deps.pool.query(
    `SELECT title, event_date, location, description FROM amb_events
     WHERE event_date > CURRENT_TIMESTAMP - INTERVAL '6 hours' AND audience = 'all'
     ORDER BY event_date ASC LIMIT 5`
  );
  if (!r.rows.length) return ctx.reply(t(lang, "events_public_empty"));
  await ctx.reply(t(lang, "events_public_intro"), { parse_mode: "HTML" });
  for (const ev of r.rows) {
    const date = new Date(ev.event_date).toLocaleString(lang === "kz" ? "kk-KZ" : "ru-RU", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty",
    });
    await ctx.reply(
      t(lang, "events_public_item", { title: ev.title, date, location: ev.location || "—", description: ev.description || "" }),
      { parse_mode: "HTML", disable_web_page_preview: true }
    );
  }
}

async function showProfile(ctx, deps, lang, profile) {
  const { pool } = deps;
  const [balance, counts, org] = await Promise.all([
    getBalance(pool, profile.id),
    pool.query(
      `SELECT
        (SELECT COUNT(*)::INT FROM amb_task_assignments WHERE profile_id=$1 AND status='approved') AS tasks,
        (SELECT COUNT(*)::INT FROM amb_event_attendance WHERE profile_id=$1 AND attended) AS events`,
      [profile.id]
    ),
    getOrgInfo(pool, profile),
  ]);
  const c = counts.rows[0];
  await ctx.reply(
    t(lang, "profile_card", {
      name: fullName(profile),
      kyd: profile.ambassador_number ? db.formatKyd(profile.ambassador_number) : "—",
      role: t(lang, "role_" + profile.program_role),
      stream: org.streamName || t(lang, "not_assigned"),
      team: org.teamName || t(lang, "not_assigned"),
      teamlead: org.teamleadName || t(lang, "not_assigned"),
      points: balance,
      tasks: c.tasks,
      events: c.events,
    })
  );
}

async function showTracks(ctx, deps, lang, profile) {
  const r = await deps.pool.query(
    `SELECT tr.name_ru, tr.name_kz, pt.is_primary
     FROM amb_profile_tracks pt JOIN amb_tracks tr ON tr.id = pt.track_id
     WHERE pt.profile_id = $1 ORDER BY pt.is_primary DESC, tr.id`,
    [profile.id]
  );
  const name = (row) => (lang === "kz" ? row.name_kz : row.name_ru);
  const primary = r.rows.find((x) => x.is_primary);
  const extra = r.rows.filter((x) => !x.is_primary).map(name).join(", ") || "—";
  const kb = new InlineKeyboard().text(t(lang, "btn_change_tracks"), "T:change");
  await ctx.reply(
    t(lang, "my_tracks", { primary: primary ? name(primary) : "—", extra }),
    { reply_markup: kb }
  );
}

async function showTeam(ctx, deps, lang, profile) {
  if (!profile.team_id) return ctx.reply(t(lang, "team_none"));
  const { pool } = deps;
  const r = await pool.query(
    `SELECT tm.name AS team_name, s.name AS stream_name,
            tl.first_name AS tl_fn, tl.last_name AS tl_ln, tl.telegram_username AS tl_un,
            co.first_name AS co_fn, co.last_name AS co_ln
     FROM amb_teams tm
     JOIN amb_streams s ON s.id = tm.stream_id
     LEFT JOIN amb_profiles tl ON tl.id = tm.teamlead_id
     LEFT JOIN amb_profiles co ON co.id = s.coordinator_id
     WHERE tm.id = $1`,
    [profile.team_id]
  );
  if (!r.rows[0]) return ctx.reply(t(lang, "team_none"));
  const info = r.rows[0];
  const members = await pool.query(
    `SELECT first_name, last_name FROM amb_profiles
     WHERE team_id = $1 AND activity_status <> 'reserve' ORDER BY first_name LIMIT 25`,
    [profile.team_id]
  );
  const memberList = members.rows.map((m, i) => `${i + 1}. ${[m.first_name, m.last_name].filter(Boolean).join(" ")}`).join("\n") || "—";
  const tlName = [info.tl_fn, info.tl_ln].filter(Boolean).join(" ") + (info.tl_un ? ` (@${info.tl_un})` : "");
  await ctx.reply(
    t(lang, "team_card", {
      team: info.team_name,
      stream: info.stream_name,
      teamlead: tlName.trim() || t(lang, "not_assigned"),
      coordinator: [info.co_fn, info.co_ln].filter(Boolean).join(" ") || t(lang, "not_assigned"),
      members: memberList,
    })
  );
}

async function showPoints(ctx, deps, lang, profile) {
  const { pool } = deps;
  const balance = await getBalance(pool, profile.id);
  const hist = await pool.query(
    `SELECT delta, reason, created_at FROM amb_points_ledger
     WHERE profile_id = $1 ORDER BY id DESC LIMIT 10`,
    [profile.id]
  );
  const history = hist.rows.length
    ? hist.rows.map((h) => `${h.delta > 0 ? "+" : ""}${h.delta} — ${h.reason}`).join("\n")
    : t(lang, "points_empty");
  await ctx.reply(t(lang, "points_card", { points: balance, history }) + "\n\n" + t(lang, "points_note"));
}

async function showOpportunities(ctx, deps, lang) {
  const careerUrl = process.env.APP_BASE_URL || "https://kazyouthdiplomacy.com";
  const coreUrl = process.env.CORE_SKILLS_URL || careerUrl;
  await ctx.reply(t(lang, "opps_card", { careerUrl, coreUrl }));
}

async function showHelp(ctx, deps, lang, profile) {
  let teamlead = "—";
  if (profile && profile.team_id) {
    const r = await deps.pool.query(
      `SELECT tl.first_name, tl.telegram_username
       FROM amb_teams tm JOIN amb_profiles tl ON tl.id = tm.teamlead_id
       WHERE tm.id = $1`,
      [profile.team_id]
    );
    if (r.rows[0]) {
      teamlead = r.rows[0].telegram_username ? `@${r.rows[0].telegram_username}` : r.rows[0].first_name || "—";
    }
  }
  const admin = process.env.TG_SUPPORT_CONTACT || "@KazYouthDiplomacy";
  await ctx.reply(t(lang, "help_card", { teamlead, admin }));
}

async function showMyApplication(ctx, deps, lang, profile) {
  const r = await deps.pool.query(
    `SELECT status, decision_reason FROM amb_applications
     WHERE profile_id = $1 ORDER BY id DESC LIMIT 1`,
    [profile.id]
  );
  const app = r.rows[0];
  if (!app) return ctx.reply(t(lang, "unknown_command"));
  const reason = app.decision_reason || "";
  const byStatus = {
    submitted: "app_pending",
    in_review: "app_pending",
    needs_revision: "app_revision",
    interview: "app_interview",
    reserve: "app_reserve",
    rejected: "app_rejected",
  };
  return ctx.reply(t(lang, byStatus[app.status] || "app_pending", { reason }));
}

async function getOrgInfo(pool, profile) {
  const out = { streamName: null, teamName: null, teamleadName: null };
  if (profile.team_id) {
    const r = await pool.query(
      `SELECT tm.name AS team_name, s.name AS stream_name,
              tl.first_name AS tl_fn, tl.last_name AS tl_ln
       FROM amb_teams tm
       JOIN amb_streams s ON s.id = tm.stream_id
       LEFT JOIN amb_profiles tl ON tl.id = tm.teamlead_id
       WHERE tm.id = $1`,
      [profile.team_id]
    );
    if (r.rows[0]) {
      out.teamName = r.rows[0].team_name;
      out.streamName = r.rows[0].stream_name;
      out.teamleadName = [r.rows[0].tl_fn, r.rows[0].tl_ln].filter(Boolean).join(" ") || null;
    }
  } else if (profile.stream_id) {
    const r = await pool.query(`SELECT name FROM amb_streams WHERE id = $1`, [profile.stream_id]);
    if (r.rows[0]) out.streamName = r.rows[0].name;
  }
  return out;
}

function fullName(profile) {
  return [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "—";
}

module.exports = {
  isAccepted, isStaff, botRole, showMenu, menuAction, isMigrationEnabled,
  showProfile, showTracks, showTeam, showPoints,
  showOpportunities, showHelp, showMyApplication, fullName,
  showAbout, showVacancies, showTraining, showAskSoon, showAdminPanelLink, showPublicEvents,
};
