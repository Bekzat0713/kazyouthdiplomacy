/* Points ledger helpers. Balance is always SUM(delta) — never stored. */

async function addPoints(db, { profileId, delta, reason, sourceType, sourceId, awardedBy }) {
  await db.query(
    `INSERT INTO amb_points_ledger (profile_id, delta, reason, source_type, source_id, awarded_by)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [profileId, delta, reason, sourceType, sourceId || null, awardedBy || null]
  );
}

async function getBalance(db, profileId) {
  const r = await db.query(
    `SELECT COALESCE(SUM(delta), 0)::INT AS balance FROM amb_points_ledger WHERE profile_id = $1`,
    [profileId]
  );
  return r.rows[0].balance;
}

/* Anti-farm cap: only 3 approved media tasks per calendar month count for points. */
async function countApprovedThisMonth(db, profileId, category) {
  const r = await db.query(
    `SELECT COUNT(*)::INT AS n
     FROM amb_task_assignments a
     JOIN amb_tasks t ON t.id = a.task_id
     WHERE a.profile_id = $1 AND a.status = 'approved' AND t.category = $2
       AND a.reviewed_at >= date_trunc('month', CURRENT_TIMESTAMP)`,
    [profileId, category]
  );
  return r.rows[0].n;
}

/* +10 for 4 consecutive weekly reports, at most once per 4 weeks. */
async function maybeAwardWeeklyStreak(db, profileId, lang, t) {
  const weeks = await db.query(
    `SELECT week_start FROM amb_weekly_reports
     WHERE profile_id = $1 ORDER BY week_start DESC LIMIT 4`,
    [profileId]
  );
  if (weeks.rows.length < 4) return false;
  for (let i = 0; i < 3; i++) {
    const a = new Date(weeks.rows[i].week_start);
    const b = new Date(weeks.rows[i + 1].week_start);
    const diffDays = Math.round((a - b) / 86400000);
    if (diffDays !== 7) return false;
  }
  const recent = await db.query(
    `SELECT 1 FROM amb_points_ledger
     WHERE profile_id = $1 AND source_type = 'weekly_streak'
       AND created_at >= CURRENT_TIMESTAMP - INTERVAL '22 days'`,
    [profileId]
  );
  if (recent.rows.length > 0) return false;
  await addPoints(db, {
    profileId,
    delta: 10,
    reason: lang === "kz" ? "Тұрақты белсенділік: қатарынан 4 апталық есеп" : "Стабильная активность: 4 еженедельных отчета подряд",
    sourceType: "weekly_streak",
  });
  return true;
}

module.exports = { addPoints, getBalance, countApprovedThisMonth, maybeAwardWeeklyStreak };
