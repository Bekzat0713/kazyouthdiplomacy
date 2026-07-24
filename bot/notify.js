/* Outgoing bot notifications. Never throw: a blocked user must not break a flow. */

async function sendToTelegram(bot, telegramId, text, extra) {
  if (!bot || !telegramId) return false;
  try {
    await bot.api.sendMessage(telegramId, text, extra);
    return true;
  } catch (err) {
    console.error(`[amb-bot] sendMessage to ${telegramId} failed:`, err.message);
    return false;
  }
}

async function notifyProfile(pool, bot, profileId, text, extra) {
  const r = await pool.query(`SELECT telegram_id FROM amb_profiles WHERE id = $1`, [profileId]);
  if (!r.rows[0]) return false;
  return sendToTelegram(bot, r.rows[0].telegram_id, text, extra);
}

/* Teamlead of a profile's team; falls back to admin chat if none. */
async function notifyTeamlead(pool, bot, profileId, text) {
  const r = await pool.query(
    `SELECT tl.telegram_id
     FROM amb_profiles p
     JOIN amb_teams tm ON tm.id = p.team_id
     JOIN amb_profiles tl ON tl.id = tm.teamlead_id
     WHERE p.id = $1`,
    [profileId]
  );
  if (r.rows[0] && r.rows[0].telegram_id) {
    return sendToTelegram(bot, r.rows[0].telegram_id, text);
  }
  return notifyAdminChat(bot, text);
}

async function notifyAdminChat(bot, text) {
  const chatId = process.env.TG_ADMIN_CHAT_ID;
  if (!chatId) return false;
  return sendToTelegram(bot, chatId, text);
}

module.exports = { sendToTelegram, notifyProfile, notifyTeamlead, notifyAdminChat };
