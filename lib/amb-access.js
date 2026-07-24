/* Role resolution and branch-scoping for the admin panel.
   head: users.role='admin' or email in AMB_HEAD_EMAILS (fallback OPPORTUNITIES_ADMIN_EMAIL).
   coordinator / teamlead: amb_profiles linked via user_id. Everyone sees only their branch. */

function headEmails() {
  const raw = process.env.AMB_HEAD_EMAILS || process.env.OPPORTUNITIES_ADMIN_EMAIL || "";
  return raw.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
}

async function getAdminContext(pool, req) {
  const userId = req.session && req.session.userId;
  if (!userId) return null;
  const ur = await pool.query(`SELECT id, email, role FROM users WHERE id = $1`, [userId]);
  const user = ur.rows[0];
  if (!user) return null;
  const email = String(user.email || "").toLowerCase();

  if (user.role === "admin" || headEmails().includes(email)) {
    return { userId, email, role: "head", profileId: null, streamIds: [], teamIds: [] };
  }

  const pr = await pool.query(
    `SELECT id, program_role FROM amb_profiles
     WHERE user_id = $1 AND program_role IN ('teamlead','coordinator')`,
    [userId]
  );
  const profile = pr.rows[0];
  if (!profile) return null;

  if (profile.program_role === "coordinator") {
    const streams = await pool.query(`SELECT id FROM amb_streams WHERE coordinator_id = $1`, [profile.id]);
    const streamIds = streams.rows.map((r) => r.id);
    if (!streamIds.length) return null;
    const teams = await pool.query(`SELECT id FROM amb_teams WHERE stream_id = ANY($1::int[])`, [streamIds]);
    return { userId, email, role: "coordinator", profileId: profile.id, streamIds, teamIds: teams.rows.map((r) => r.id) };
  }

  const teams = await pool.query(`SELECT id, stream_id FROM amb_teams WHERE teamlead_id = $1`, [profile.id]);
  const teamIds = teams.rows.map((r) => r.id);
  if (!teamIds.length) return null;
  return { userId, email, role: "teamlead", profileId: profile.id, streamIds: [...new Set(teams.rows.map((r) => r.stream_id))], teamIds };
}

/* WHERE fragment limiting amb_profiles rows (alias p) to the admin's branch.
   Returns { where, params } to append; params start at $<startIndex>. */
function profileScope(adminCtx, startIndex, alias) {
  const a = alias || "p";
  if (adminCtx.role === "head") return { where: "TRUE", params: [] };
  if (adminCtx.role === "coordinator") {
    return { where: `${a}.stream_id = ANY($${startIndex}::int[])`, params: [adminCtx.streamIds] };
  }
  return { where: `${a}.team_id = ANY($${startIndex}::int[])`, params: [adminCtx.teamIds] };
}

async function canAccessProfile(pool, adminCtx, profileId) {
  if (adminCtx.role === "head") return true;
  const r = await pool.query(`SELECT stream_id, team_id FROM amb_profiles WHERE id = $1`, [profileId]);
  const row = r.rows[0];
  if (!row) return false;
  if (adminCtx.role === "coordinator") return adminCtx.streamIds.includes(row.stream_id);
  return adminCtx.teamIds.includes(row.team_id);
}

module.exports = { getAdminContext, profileScope, canAccessProfile };
