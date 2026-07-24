/* Ambassador bot: update dispatcher. All texts in ./i18n.js, all flows in ./flows/. */

const { Bot, webhookCallback, InlineKeyboard } = require("grammy");
const { t } = require("./i18n");
const db = require("../lib/amb-db");
const menu = require("./menu");
const registration = require("./flows/registration");
const tasks = require("./flows/tasks");
const weekly = require("./flows/weekly");
const events = require("./flows/events");

const KNOWN_SOURCES = ["site", "inst", "wa", "whatsapp", "friend", "tiktok"];

/* Simple per-user rate limit: 20 actions per minute. */
const rateBuckets = new Map();
function rateLimited(telegramId) {
  const now = Date.now();
  const bucket = rateBuckets.get(telegramId) || [];
  const recent = bucket.filter((ts) => now - ts < 60000);
  recent.push(now);
  rateBuckets.set(telegramId, recent);
  if (rateBuckets.size > 5000) rateBuckets.clear(); // crude memory guard
  return recent.length > 20;
}

function createBot({ pool }) {
  const bot = new Bot(process.env.TG_BOT_TOKEN);
  const deps = { pool, bot: null, showMenu: null };
  deps.bot = bot;
  deps.showMenu = async (ctx, lang) => {
    const p = await db.getProfileByTg(pool, ctx.from.id);
    return menu.showMenu(ctx, lang, p);
  };

  bot.catch((err) => {
    console.error("[amb-bot] update error:", err.error || err);
  });

  bot.command("start", async (ctx) => {
    if (rateLimited(ctx.from.id)) return;
    const payload = (ctx.match || "").trim();
    let profile = await db.getProfileByTg(pool, ctx.from.id);
    const lang = (profile && profile.language) || "ru";

    // QR event check-in deep link (accepted members only)
    if (payload.startsWith("ev_") && profile && menu.isAccepted(profile)) {
      return events.checkin(ctx, deps, lang, profile, payload.slice(3));
    }

    // First contact ever — create a base regular_user profile and ask language once.
    const isFirstContact = !profile;
    if (!profile) {
      const source = payload === "migrate" ? "whatsapp" : (KNOWN_SOURCES.includes(payload) ? payload : (payload || null));
      await registration.ensureProfile(ctx, deps, source);
      profile = await db.getProfileByTg(pool, ctx.from.id);
    }

    if (isFirstContact) {
      await db.setState(pool, ctx.from.id, "start:lang", { deep: payload || null });
      const kb = new InlineKeyboard().text("Қазақша", "L:kz").text("Русский", "L:ru");
      return ctx.reply(t(lang, "welcome_lang"), { reply_markup: kb });
    }

    // Returning member coming back from reserve
    if (menu.isAccepted(profile) && profile.activity_status === "reserve") {
      await pool.query(`UPDATE amb_profiles SET activity_status='active' WHERE id=$1`, [profile.id]);
      await db.logStatusChange(pool, profile.id, "activity_status", "reserve", "active", "Вернулся сам через /start", null);
    }

    // /start always returns to the menu — drop any half-finished questionnaire/report state
    await db.clearState(pool, ctx.from.id);

    // Deep-link intent for a known member
    if (payload === "migrate" && !menu.isAccepted(profile)) {
      if (!menu.isMigrationEnabled()) {
        await ctx.reply(t(lang, "migration_closed"));
        return deps.showMenu(ctx, lang);
      }
      return registration.startMigration(ctx, deps);
    }

    return deps.showMenu(ctx, lang);
  });

  bot.command("menu", async (ctx) => {
    await db.clearState(pool, ctx.from.id);
    const profile = await db.getProfileByTg(pool, ctx.from.id);
    return deps.showMenu(ctx, (profile && profile.language) || "ru");
  });

  bot.command("lang", async (ctx) => {
    const kb = new InlineKeyboard().text("Қазақша", "L:kz").text("Русский", "L:ru");
    return ctx.reply(t("ru", "choose_lang"), { reply_markup: kb });
  });

  bot.command("cancel", async (ctx) => {
    const profile = await db.getProfileByTg(pool, ctx.from.id);
    await db.clearState(pool, ctx.from.id);
    return ctx.reply(t((profile && profile.language) || "ru", "cancelled"));
  });

  bot.command("help", async (ctx) => {
    const profile = await db.getProfileByTg(pool, ctx.from.id);
    return menu.showHelp(ctx, deps, (profile && profile.language) || "ru", profile);
  });

  // Utility: shows the caller's Telegram ID (used to grant owner/admin/coordinator access).
  bot.command("myid", async (ctx) => {
    const uname = ctx.from.username ? "@" + ctx.from.username : "—";
    await ctx.reply(`🆔 Твой Telegram ID: <code>${ctx.from.id}</code>\nUsername: ${uname}`, { parse_mode: "HTML" });
  });

  bot.on("callback_query:data", async (ctx) => {
    if (rateLimited(ctx.from.id)) {
      return ctx.answerCallbackQuery({ text: t("ru", "rate_limited") }).catch(() => {});
    }
    try {
      const data = ctx.callbackQuery.data;
      const profile = await db.getProfileByTg(pool, ctx.from.id);
      const lang = (profile && profile.language) || "ru";
      const stateRow = await db.getState(pool, ctx.from.id);

      if (data.startsWith("L:")) {
        const newLang = data.slice(2) === "kz" ? "kz" : "ru";
        await pool.query(`UPDATE amb_profiles SET language=$2 WHERE telegram_id=$1`, [ctx.from.id, newLang]);
        await ctx.answerCallbackQuery().catch(() => {});
        // First-contact language selection → honor deep-link intent, else show the general menu
        if (stateRow && stateRow.state === "start:lang") {
          const deep = (stateRow.payload || {}).deep;
          await db.clearState(pool, ctx.from.id);
          if (deep === "migrate" && menu.isMigrationEnabled()) {
            return registration.startMigration(ctx, deps);
          }
          if (deep === "migrate") await ctx.reply(t(newLang, "migration_closed"));
          return deps.showMenu(ctx, newLang);
        }
        if (stateRow && stateRow.state === "reg:lang") {
          const payload = stateRow.payload || {};
          if (payload.flow === "mig") {
            if (!menu.isMigrationEnabled()) {
              await ctx.reply(t(newLang, "migration_closed"));
              return deps.showMenu(ctx, newLang);
            }
            return registration.startMigration(ctx, deps);
          }
          return registration.startNew(ctx, deps, payload.source);
        }
        await ctx.reply(t(newLang, "lang_switched"));
        return deps.showMenu(ctx, newLang);
      }

      if (data.startsWith("R:") || data.startsWith("M:")) {
        return await registration.handleCallback(ctx, deps, stateRow);
      }

      if (data === "T:change") {
        await ctx.answerCallbackQuery().catch(() => {});
        if (!profile || !menu.isAccepted(profile)) return;
        if (profile.tracks_updated_at) {
          const nextAllowed = new Date(new Date(profile.tracks_updated_at).getTime() + 30 * 86400000);
          if (nextAllowed > new Date()) {
            return ctx.reply(t(lang, "tracks_change_cooldown", { date: nextAllowed.toLocaleDateString("ru-RU") }));
          }
        }
        const payload = { flow: "chg", tracks: { extra: [] } };
        return registration.askTrackPrimary(ctx, deps, lang, payload);
      }

      if (!profile || !menu.isAccepted(profile)) {
        return ctx.answerCallbackQuery().catch(() => {});
      }
      if (data.startsWith("TK:")) return await tasks.handleCallback(ctx, deps, profile);
      if (data.startsWith("W:")) return await weekly.handleCallback(ctx, deps, stateRow, profile);
      if (data.startsWith("EV:")) return await events.handleCallback(ctx, deps, profile);
      return ctx.answerCallbackQuery().catch(() => {});
    } catch (err) {
      console.error("[amb-bot] callback error:", err);
      const profile = await db.getProfileByTg(pool, ctx.from.id).catch(() => null);
      await ctx.reply(t((profile && profile.language) || "ru", "error_generic")).catch(() => {});
    }
  });

  bot.on("message", async (ctx) => {
    if (rateLimited(ctx.from.id)) return;
    try {
      const profile = await db.getProfileByTg(pool, ctx.from.id);
      const lang = (profile && profile.language) || "ru";
      const stateRow = await db.getState(pool, ctx.from.id);

      if (stateRow) {
        if (stateRow.state.startsWith("task:submit:")) {
          return await tasks.handleReportMessage(ctx, deps, stateRow);
        }
        if (stateRow.state.startsWith("weekly:q")) {
          return await weekly.handleMessage(ctx, deps, stateRow, profile);
        }
        if (stateRow.state.startsWith("reg:")) {
          const handled = await registration.handleMessage(ctx, deps, stateRow);
          if (handled !== null) return handled;
        }
      }

      const text = (ctx.message.text || "").trim();
      const action = menu.menuAction(text);

      // First contact via a plain message (no /start) — bootstrap like /start
      if (!profile) {
        await registration.ensureProfile(ctx, deps, null);
        await db.setState(pool, ctx.from.id, "start:lang", { deep: null });
        const kb = new InlineKeyboard().text("Қазақша", "L:kz").text("Русский", "L:ru");
        return ctx.reply(t(lang, "welcome_lang"), { reply_markup: kb });
      }

      if (!action) return ctx.reply(t(lang, "unknown_command"));

      // Available to everyone (regular users included)
      if (action === "help") return menu.showHelp(ctx, deps, lang, profile);
      if (action === "about") return menu.showAbout(ctx, deps, lang);
      if (action === "vacancies") return menu.showVacancies(ctx, deps, lang);
      if (action === "training") return menu.showTraining(ctx, deps, lang);
      if (action === "ask") return menu.showAskSoon(ctx, deps, lang);
      if (action === "admin_panel") {
        if (menu.isStaff(profile, ctx.from.id)) return menu.showAdminPanelLink(ctx, deps, lang);
        return ctx.reply(t(lang, "unknown_command"));
      }
      if (action === "amb_join") {
        if (menu.isAccepted(profile)) return deps.showMenu(ctx, lang);
        // Already under review — show status instead of starting a duplicate application
        const app = await pool.query(
          `SELECT status FROM amb_applications WHERE profile_id=$1 ORDER BY id DESC LIMIT 1`,
          [profile.id]
        );
        const st = app.rows[0] && app.rows[0].status;
        if (st && ["submitted", "in_review", "interview"].includes(st)) {
          return menu.showMyApplication(ctx, deps, lang, profile);
        }
        return registration.startNew(ctx, deps, profile.source || null);
      }
      if (action === "amb_current") {
        if (menu.isAccepted(profile)) return deps.showMenu(ctx, lang);
        if (!menu.isMigrationEnabled()) return ctx.reply(t(lang, "migration_closed"));
        return registration.startMigration(ctx, deps);
      }
      if (action === "events") {
        if (menu.isAccepted(profile)) return events.listEvents(ctx, deps, lang, profile);
        return menu.showPublicEvents(ctx, deps, lang);
      }
      if (action === "my_app") return menu.showMyApplication(ctx, deps, lang, profile);

      // Cabinet-only actions (accepted ambassadors and up)
      if (!menu.isAccepted(profile)) return ctx.reply(t(lang, "unknown_command"));
      if (action === "profile") return menu.showProfile(ctx, deps, lang, profile);
      if (action === "tracks") return menu.showTracks(ctx, deps, lang, profile);
      if (action === "team") return menu.showTeam(ctx, deps, lang, profile);
      if (action === "tasks") return tasks.showTasksMenu(ctx, deps, lang);
      if (action === "points") return menu.showPoints(ctx, deps, lang, profile);
      if (action === "report") return weekly.offerWeekly(ctx, deps, lang, profile);
      if (action === "opps") return menu.showOpportunities(ctx, deps, lang);
    } catch (err) {
      console.error("[amb-bot] message error:", err);
      const profile = await db.getProfileByTg(pool, ctx.from.id).catch(() => null);
      await ctx.reply(t((profile && profile.language) || "ru", "error_generic")).catch(() => {});
    }
  });

  return bot;
}

module.exports = { createBot, webhookCallback };
