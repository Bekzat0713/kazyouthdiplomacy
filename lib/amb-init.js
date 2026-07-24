/* Single integration point: server.js calls initAmbProgram({ app, pool }) once at startup.
   Creates tables, mounts the bot webhook + admin API, starts cron. */

const { initAmbDB } = require("./amb-db");
const { startAmbCron } = require("./amb-cron");
const { createAmbRouter } = require("../routes/amb-admin");

async function initAmbProgram({ app, pool }) {
  await initAmbDB(pool);

  let bot = null;
  const token = process.env.TG_BOT_TOKEN;
  if (token) {
    const { createBot, webhookCallback } = require("../bot");
    bot = createBot({ pool });

    const secret = process.env.TG_WEBHOOK_SECRET || "";
    const webhookPath = `/api/tg/webhook${secret ? "/" + secret : ""}`;

    if (process.env.TG_USE_POLLING === "1") {
      // local development without a public https URL
      bot.start({ drop_pending_updates: true });
      console.log("[amb-bot] started in polling mode");
    } else {
      app.use(webhookPath, (req, res, next) => {
        if (secret && req.get("X-Telegram-Bot-Api-Secret-Token") !== secret) {
          return res.status(403).end();
        }
        return webhookCallback(bot, "express")(req, res, next);
      });
      const baseUrl = process.env.APP_BASE_URL;
      if (baseUrl && baseUrl.startsWith("https://")) {
        try {
          await bot.api.setWebhook(baseUrl + webhookPath, secret ? { secret_token: secret } : undefined);
          console.log("[amb-bot] webhook set:", baseUrl + webhookPath.replace(secret, "***"));
        } catch (err) {
          console.error("[amb-bot] setWebhook failed:", err.message);
        }
      } else {
        console.log("[amb-bot] APP_BASE_URL is not https — webhook not registered (set TG_USE_POLLING=1 for local dev)");
      }
    }
  } else {
    console.log("[amb-bot] TG_BOT_TOKEN not set — bot disabled, admin panel still works");
  }

  app.use("/api/amb", createAmbRouter({ pool, bot }));
  startAmbCron({ pool, bot });
  return { bot };
}

module.exports = { initAmbProgram };
