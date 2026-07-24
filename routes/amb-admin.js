/* Admin API for the ambassador program: /api/amb/*
   Every endpoint resolves the caller's role and limits data to their branch. */

const express = require("express");
const crypto = require("crypto");
const QRCode = require("qrcode");
const { getAdminContext, profileScope, canAccessProfile } = require("../lib/amb-access");
const { addPoints, getBalance, countApprovedThisMonth } = require("../lib/amb-points");
const { t } = require("../bot/i18n");
const db = require("../lib/amb-db");
const { notifyProfile } = require("../bot/notify");

const ACCEPTED = `('trainee','ambassador','active','senior','teamlead','coordinator')`;
const PROGRAM_ROLES = ["candidate", "trainee", "ambassador", "active", "senior", "teamlead", "coordinator", "alumni"];
const ACTIVITY_STATUSES = ["active", "probation", "needs_support", "unresponsive", "recommended_promotion", "suspended", "reserve"];

function createAmbRouter({ pool, bot }) {
  const router = express.Router();

  router.use(async (req, res, next) => {
    try {
      const ctx = await getAdminContext(pool, req);
      if (!ctx) return res.status(403).json({ error: "Ambassador admin access required" });
      req.amb = ctx;
      res.set("Cache-Control", "no-store");
      next();
    } catch (err) {
      next(err);
    }
  });

  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  const isCoordPlus = (req) => ["head", "coordinator"].includes(req.amb.role);

  /* ---------- me / dictionaries ---------- */

  router.get("/me", wrap(async (req, res) => {
    res.json({ role: req.amb.role, email: req.amb.email, streamIds: req.amb.streamIds, teamIds: req.amb.teamIds });
  }));

  router.get("/tracks", wrap(async (req, res) => {
    const r = await pool.query(`SELECT id, code, name_ru, name_kz FROM amb_tracks WHERE is_active ORDER BY id`);
    res.json(r.rows);
  }));

  router.get("/streams", wrap(async (req, res) => {
    const streams = await pool.query(`
      SELECT s.*, co.first_name AS co_first, co.last_name AS co_last,
        (SELECT COUNT(*)::INT FROM amb_profiles p WHERE p.stream_id = s.id AND p.program_role IN ${ACCEPTED}) AS members
      FROM amb_streams s LEFT JOIN amb_profiles co ON co.id = s.coordinator_id
      WHERE s.is_active ORDER BY s.id`);
    const teams = await pool.query(`
      SELECT tm.*, tl.first_name AS tl_first, tl.last_name AS tl_last,
        (SELECT COUNT(*)::INT FROM amb_profiles p WHERE p.team_id = tm.id AND p.program_role IN ${ACCEPTED}) AS members
      FROM amb_teams tm LEFT JOIN amb_profiles tl ON tl.id = tm.teamlead_id
      WHERE tm.is_active ORDER BY tm.stream_id, tm.id`);
    res.json({ streams: streams.rows, teams: teams.rows });
  }));

  router.post("/streams", wrap(async (req, res) => {
    if (req.amb.role !== "head") return res.status(403).json({ error: "head only" });
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "name required" });
    const r = await pool.query(`INSERT INTO amb_streams (name) VALUES ($1) RETURNING *`, [name]);
    res.json(r.rows[0]);
  }));

  router.patch("/streams/:id", wrap(async (req, res) => {
    if (req.amb.role !== "head") return res.status(403).json({ error: "head only" });
    const id = Number(req.params.id);
    const { name, coordinator_profile_id } = req.body;
    if (name) await pool.query(`UPDATE amb_streams SET name=$2 WHERE id=$1`, [id, String(name).trim()]);
    if (coordinator_profile_id !== undefined) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`UPDATE amb_streams SET coordinator_id=$2 WHERE id=$1`, [id, coordinator_profile_id || null]);
        if (coordinator_profile_id) {
          const old = await client.query(`SELECT program_role FROM amb_profiles WHERE id=$1`, [coordinator_profile_id]);
          await client.query(`UPDATE amb_profiles SET program_role='coordinator', stream_id=$2 WHERE id=$1`, [coordinator_profile_id, id]);
          await db.logStatusChange(client, coordinator_profile_id, "program_role", old.rows[0] && old.rows[0].program_role, "coordinator", "Назначен координатором потока", req.amb.userId);
        }
        await client.query("COMMIT");
        if (coordinator_profile_id) {
          const p = await pool.query(`SELECT language FROM amb_profiles WHERE id=$1`, [coordinator_profile_id]);
          await notifyProfile(pool, bot, coordinator_profile_id, t(p.rows[0].language, "promo_role", { role: t(p.rows[0].language, "role_coordinator") }));
        }
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }
    res.json({ ok: true });
  }));

  router.post("/teams", wrap(async (req, res) => {
    if (!isCoordPlus(req)) return res.status(403).json({ error: "coordinator+ only" });
    const streamId = Number(req.body.stream_id);
    if (req.amb.role === "coordinator" && !req.amb.streamIds.includes(streamId)) {
      return res.status(403).json({ error: "not your stream" });
    }
    const name = String(req.body.name || "").trim();
    if (!name || !streamId) return res.status(400).json({ error: "name and stream_id required" });
    const r = await pool.query(
      `INSERT INTO amb_teams (stream_id, name, capacity) VALUES ($1,$2,$3) RETURNING *`,
      [streamId, name, Number(req.body.capacity) || 20]
    );
    res.json(r.rows[0]);
  }));

  router.patch("/teams/:id", wrap(async (req, res) => {
    if (!isCoordPlus(req)) return res.status(403).json({ error: "coordinator+ only" });
    const id = Number(req.params.id);
    const team = (await pool.query(`SELECT * FROM amb_teams WHERE id=$1`, [id])).rows[0];
    if (!team) return res.status(404).json({ error: "team not found" });
    if (req.amb.role === "coordinator" && !req.amb.streamIds.includes(team.stream_id)) {
      return res.status(403).json({ error: "not your stream" });
    }
    const { name, capacity, teamlead_profile_id } = req.body;
    if (name) await pool.query(`UPDATE amb_teams SET name=$2 WHERE id=$1`, [id, String(name).trim()]);
    if (capacity) await pool.query(`UPDATE amb_teams SET capacity=$2 WHERE id=$1`, [id, Number(capacity)]);
    if (teamlead_profile_id !== undefined) {
      if (req.amb.role !== "head") return res.status(403).json({ error: "head assigns teamleads" });
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`UPDATE amb_teams SET teamlead_id=$2 WHERE id=$1`, [id, teamlead_profile_id || null]);
        if (teamlead_profile_id) {
          const old = await client.query(`SELECT program_role FROM amb_profiles WHERE id=$1`, [teamlead_profile_id]);
          await client.query(
            `UPDATE amb_profiles SET program_role='teamlead', team_id=$2, stream_id=$3 WHERE id=$1`,
            [teamlead_profile_id, id, team.stream_id]
          );
          await db.logStatusChange(client, teamlead_profile_id, "program_role", old.rows[0] && old.rows[0].program_role, "teamlead", "Назначен тимлидом команды " + team.name, req.amb.userId);
        }
        await client.query("COMMIT");
        if (teamlead_profile_id) {
          const p = await pool.query(`SELECT language FROM amb_profiles WHERE id=$1`, [teamlead_profile_id]);
          await notifyProfile(pool, bot, teamlead_profile_id, t(p.rows[0].language, "promo_role", { role: t(p.rows[0].language, "role_teamlead") }));
        }
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }
    res.json({ ok: true });
  }));

  /* ---------- dashboard ---------- */

  router.get("/dashboard", wrap(async (req, res) => {
    const scope = profileScope(req.amb, 1);
    const P = scope.params;
    const W = scope.where;
    const [funnel, roles, activity, streams, tracks, tasksInfo, weeklyInfo, sources, alerts] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*)::INT FROM amb_applications) AS apps_total,
          (SELECT COUNT(*)::INT FROM amb_applications WHERE submitted_at >= NOW() - INTERVAL '7 days') AS apps_week,
          (SELECT COUNT(*)::INT FROM amb_applications WHERE status IN ('submitted','in_review','interview')) AS apps_pending,
          (SELECT COUNT(*)::INT FROM amb_applications WHERE status = 'accepted') AS apps_accepted`),
      pool.query(`SELECT program_role, COUNT(*)::INT AS n FROM amb_profiles p WHERE ${W} GROUP BY program_role`, P),
      pool.query(`SELECT activity_status, COUNT(*)::INT AS n FROM amb_profiles p WHERE ${W} AND p.program_role IN ${ACCEPTED} GROUP BY activity_status`, P),
      pool.query(`
        SELECT s.id, s.name,
          (SELECT COUNT(*)::INT FROM amb_teams tm WHERE tm.stream_id = s.id AND tm.is_active) AS teams,
          (SELECT COUNT(*)::INT FROM amb_profiles p WHERE p.stream_id = s.id AND p.program_role IN ${ACCEPTED}) AS members,
          (SELECT COUNT(*)::INT FROM amb_weekly_reports w JOIN amb_profiles p ON p.id = w.profile_id
             WHERE p.stream_id = s.id AND w.week_start = date_trunc('week', CURRENT_DATE)::date) AS weekly_done
        FROM amb_streams s WHERE s.is_active ORDER BY s.id`),
      pool.query(`
        SELECT tr.name_ru, pt.is_primary, COUNT(*)::INT AS n
        FROM amb_profile_tracks pt
        JOIN amb_tracks tr ON tr.id = pt.track_id
        JOIN amb_profiles p ON p.id = pt.profile_id
        WHERE ${W}
        GROUP BY tr.name_ru, pt.is_primary ORDER BY n DESC`, P),
      pool.query(`
        SELECT
          (SELECT COUNT(*)::INT FROM amb_tasks WHERE status = 'open') AS open_tasks,
          (SELECT COUNT(*)::INT FROM amb_task_assignments a JOIN amb_profiles p ON p.id = a.profile_id
             WHERE a.status = 'submitted' AND ${W}) AS review_queue,
          (SELECT COUNT(*)::INT FROM amb_task_assignments a JOIN amb_profiles p ON p.id = a.profile_id
             WHERE a.status = 'expired' AND a.taken_at >= NOW() - INTERVAL '30 days' AND ${W}) AS expired_30d`, P),
      pool.query(`
        SELECT
          (SELECT COUNT(*)::INT FROM amb_profiles p WHERE ${W} AND p.program_role IN ${ACCEPTED}
             AND p.activity_status NOT IN ('suspended','reserve')) AS should_report,
          (SELECT COUNT(*)::INT FROM amb_weekly_reports w JOIN amb_profiles p ON p.id = w.profile_id
             WHERE ${W} AND w.week_start = date_trunc('week', CURRENT_DATE)::date) AS reported,
          (SELECT COUNT(*)::INT FROM amb_weekly_reports w JOIN amb_profiles p ON p.id = w.profile_id
             WHERE ${W} AND w.week_start = date_trunc('week', CURRENT_DATE)::date AND w.needs_help) AS needs_help`, P),
      pool.query(`SELECT COALESCE(source,'unknown') AS source, COUNT(*)::INT AS n FROM amb_profiles GROUP BY 1 ORDER BY n DESC`),
      pool.query(`
        SELECT
          (SELECT COUNT(*)::INT FROM amb_profiles p WHERE ${W} AND p.activity_status = 'unresponsive') AS unresponsive,
          (SELECT COUNT(*)::INT FROM amb_profiles p WHERE ${W} AND p.activity_status = 'needs_support') AS needs_support,
          (SELECT COUNT(*)::INT FROM amb_applications WHERE status IN ('submitted','in_review')
             AND submitted_at < NOW() - INTERVAL '7 days') AS stale_apps,
          (SELECT COUNT(*)::INT FROM amb_profiles p WHERE ${W} AND p.program_role IN ${ACCEPTED} AND p.team_id IS NULL) AS unassigned`, P),
    ]);
    res.json({
      funnel: funnel.rows[0],
      roles: roles.rows,
      activity: activity.rows,
      streams: streams.rows,
      tracks: tracks.rows,
      tasks: tasksInfo.rows[0],
      weekly: weeklyInfo.rows[0],
      sources: req.amb.role === "head" ? sources.rows : [],
      alerts: alerts.rows[0],
    });
  }));

  /* ---------- applications ---------- */

  router.get("/applications", wrap(async (req, res) => {
    if (!isCoordPlus(req)) return res.status(403).json({ error: "coordinator+ only" });
    const params = [];
    let where = "TRUE";
    if (req.query.status) {
      params.push(req.query.status);
      where += ` AND a.status = $${params.length}`;
    } else {
      where += ` AND a.status NOT IN ('draft')`;
    }
    if (req.query.kind) {
      params.push(req.query.kind);
      where += ` AND a.kind = $${params.length}`;
    }
    const r = await pool.query(
      `SELECT a.id, a.kind, a.status, a.intro_task_type, a.quiz_score, a.submitted_at,
              p.id AS profile_id, p.first_name, p.last_name, p.city, p.birth_date, p.is_minor, p.source
       FROM amb_applications a JOIN amb_profiles p ON p.id = a.profile_id
       WHERE ${where}
       ORDER BY a.submitted_at ASC NULLS LAST LIMIT 300`,
      params
    );
    res.json(r.rows);
  }));

  router.get("/applications/:id", wrap(async (req, res) => {
    if (!isCoordPlus(req)) return res.status(403).json({ error: "coordinator+ only" });
    const r = await pool.query(
      `SELECT a.*, p.* , a.id AS application_id, a.status AS app_status
       FROM amb_applications a JOIN amb_profiles p ON p.id = a.profile_id WHERE a.id = $1`,
      [Number(req.params.id)]
    );
    if (!r.rows[0]) return res.status(404).json({ error: "not found" });
    const tracks = await pool.query(
      `SELECT tr.name_ru, pt.is_primary FROM amb_profile_tracks pt
       JOIN amb_tracks tr ON tr.id = pt.track_id WHERE pt.profile_id = $1
       ORDER BY pt.is_primary DESC`,
      [r.rows[0].profile_id]
    );
    res.json({ ...r.rows[0], tracks: tracks.rows });
  }));

  router.post("/applications/:id/decision", wrap(async (req, res) => {
    if (!isCoordPlus(req)) return res.status(403).json({ error: "coordinator+ only" });
    const id = Number(req.params.id);
    const { action, reason, note } = req.body;
    const map = { accept: "accepted", reject: "rejected", reserve: "reserve", revision: "needs_revision", interview: "interview", in_review: "in_review" };
    const status = map[action];
    if (!status) return res.status(400).json({ error: "bad action" });

    const appRow = (await pool.query(`SELECT * FROM amb_applications WHERE id=$1`, [id])).rows[0];
    if (!appRow) return res.status(404).json({ error: "not found" });
    const profile = (await pool.query(`SELECT * FROM amb_profiles WHERE id=$1`, [appRow.profile_id])).rows[0];
    const lang = profile.language || "ru";

    const client = await pool.connect();
    let kyd = null;
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE amb_applications SET status=$2, decision_reason=$3,
           internal_notes = CASE WHEN $4::text IS NULL OR $4 = '' THEN internal_notes
             ELSE COALESCE(internal_notes,'') || E'\n' || $4 END,
           reviewer_id=$5, reviewed_at=CURRENT_TIMESTAMP WHERE id=$1`,
        [id, status, reason || null, note || null, req.amb.userId]
      );
      if (status === "accepted" && profile.program_role === "candidate") {
        let number = profile.ambassador_number;
        if (!number) number = await db.nextAmbassadorNumber(client);
        await client.query(
          `UPDATE amb_profiles SET program_role='trainee', activity_status='probation',
             ambassador_number=$2, joined_at=CURRENT_TIMESTAMP,
             trainee_until=CURRENT_DATE + 30 WHERE id=$1`,
          [profile.id, number]
        );
        await db.logStatusChange(client, profile.id, "program_role", "candidate", "trainee", "Заявка принята", req.amb.userId);
        kyd = db.formatKyd(number);
      } else if (["rejected", "reserve"].includes(status) && profile.program_role === "candidate") {
        // Release the candidate back to the general menu so they can browse and re-apply later.
        await client.query(`UPDATE amb_profiles SET program_role='regular_user' WHERE id=$1`, [profile.id]);
        await db.logStatusChange(client, profile.id, "program_role", "candidate", "regular_user",
          status === "reserve" ? "Заявка переведена в резерв" : "Заявка отклонена", req.amb.userId);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    const msgByStatus = {
      accepted: () => t(lang, "app_accepted", { name: profile.first_name || "", kyd }),
      rejected: () => t(lang, "app_rejected", { reason: reason || "" }),
      reserve: () => t(lang, "app_reserve"),
      needs_revision: () => t(lang, "app_revision", { reason: reason || "" }),
      interview: () => t(lang, "app_interview"),
      in_review: () => t(lang, "app_pending"),
    };
    await notifyProfile(pool, bot, profile.id, msgByStatus[status]());
    res.json({ ok: true, status, kyd });
  }));

  /* Forward an intro-task video to the reviewer's own Telegram via the bot. */
  router.post("/applications/:id/send-intro-file", wrap(async (req, res) => {
    if (!isCoordPlus(req)) return res.status(403).json({ error: "coordinator+ only" });
    const chatId = req.body.chat_id || process.env.TG_ADMIN_CHAT_ID;
    if (!bot || !chatId) return res.status(400).json({ error: "bot/chat not configured" });
    const r = await pool.query(`SELECT intro_task_file_id FROM amb_applications WHERE id=$1`, [Number(req.params.id)]);
    if (!r.rows[0] || !r.rows[0].intro_task_file_id) return res.status(404).json({ error: "no file" });
    try {
      await bot.api.sendVideo(chatId, r.rows[0].intro_task_file_id);
    } catch {
      await bot.api.sendDocument(chatId, r.rows[0].intro_task_file_id).catch(() => {});
    }
    res.json({ ok: true });
  }));

  /* ---------- people ---------- */

  router.get("/people", wrap(async (req, res) => {
    const params = [];
    const scope = profileScope(req.amb, 1);
    params.push(...scope.params);
    let where = scope.where;
    if (req.query.role) { params.push(req.query.role); where += ` AND p.program_role = $${params.length}`; }
    else where += ` AND p.program_role NOT IN ('candidate','regular_user')`;
    if (req.query.activity) { params.push(req.query.activity); where += ` AND p.activity_status = $${params.length}`; }
    if (req.query.stream_id) { params.push(Number(req.query.stream_id)); where += ` AND p.stream_id = $${params.length}`; }
    if (req.query.team_id) { params.push(Number(req.query.team_id)); where += ` AND p.team_id = $${params.length}`; }
    if (req.query.unassigned === "1") where += ` AND p.team_id IS NULL`;
    if (req.query.q) {
      params.push("%" + String(req.query.q).toLowerCase() + "%");
      where += ` AND (LOWER(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) LIKE $${params.length} OR LOWER(COALESCE(p.city,'')) LIKE $${params.length})`;
    }
    const r = await pool.query(
      `SELECT p.id, p.ambassador_number, p.first_name, p.last_name, p.city, p.program_role,
              p.activity_status, p.stream_id, p.team_id, p.is_minor, p.joined_at,
              s.name AS stream_name, tm.name AS team_name,
              COALESCE((SELECT SUM(delta)::INT FROM amb_points_ledger l WHERE l.profile_id = p.id), 0) AS points,
              (SELECT MAX(week_start) FROM amb_weekly_reports w WHERE w.profile_id = p.id) AS last_report
       FROM amb_profiles p
       LEFT JOIN amb_streams s ON s.id = p.stream_id
       LEFT JOIN amb_teams tm ON tm.id = p.team_id
       WHERE ${where}
       ORDER BY p.ambassador_number NULLS LAST, p.id LIMIT 500`,
      params
    );
    res.json(r.rows);
  }));

  router.get("/people/:id", wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!(await canAccessProfile(pool, req.amb, id))) return res.status(403).json({ error: "outside your branch" });
    const [profile, tracks, ledger, history, assignments, attendance, weeklies] = await Promise.all([
      pool.query(
        `SELECT p.*, s.name AS stream_name, tm.name AS team_name
         FROM amb_profiles p
         LEFT JOIN amb_streams s ON s.id = p.stream_id
         LEFT JOIN amb_teams tm ON tm.id = p.team_id WHERE p.id = $1`, [id]),
      pool.query(`SELECT tr.name_ru, pt.is_primary FROM amb_profile_tracks pt JOIN amb_tracks tr ON tr.id=pt.track_id WHERE pt.profile_id=$1 ORDER BY pt.is_primary DESC`, [id]),
      pool.query(`SELECT delta, reason, source_type, created_at FROM amb_points_ledger WHERE profile_id=$1 ORDER BY id DESC LIMIT 30`, [id]),
      pool.query(`SELECT field, old_value, new_value, reason, created_at FROM amb_status_history WHERE profile_id=$1 ORDER BY id DESC LIMIT 30`, [id]),
      pool.query(`SELECT a.status, a.points_awarded, a.submitted_at, tk.title FROM amb_task_assignments a JOIN amb_tasks tk ON tk.id=a.task_id WHERE a.profile_id=$1 ORDER BY a.id DESC LIMIT 30`, [id]),
      pool.query(`SELECT e.title, e.event_date, att.attended, att.confirmed_via FROM amb_event_attendance att JOIN amb_events e ON e.id=att.event_id WHERE att.profile_id=$1 ORDER BY e.event_date DESC LIMIT 30`, [id]),
      pool.query(`SELECT week_start, answers, needs_help FROM amb_weekly_reports WHERE profile_id=$1 ORDER BY week_start DESC LIMIT 12`, [id]),
    ]);
    if (!profile.rows[0]) return res.status(404).json({ error: "not found" });
    const row = profile.rows[0];
    // minors' guardian data only for coordinator+
    if (!isCoordPlus(req)) delete row.guardian_contact;
    res.json({
      profile: row,
      points: await getBalance(pool, id),
      tracks: tracks.rows, ledger: ledger.rows, history: history.rows,
      assignments: assignments.rows, attendance: attendance.rows, weeklies: weeklies.rows,
    });
  }));

  router.post("/people/:id/status", wrap(async (req, res) => {
    const id = Number(req.params.id);
    const { field, value, reason } = req.body;
    if (!(await canAccessProfile(pool, req.amb, id))) return res.status(403).json({ error: "outside your branch" });
    if (!reason || !String(reason).trim()) return res.status(400).json({ error: "reason required" });

    if (field === "program_role") {
      if (req.amb.role !== "head") return res.status(403).json({ error: "program_role is changed by head only" });
      if (!PROGRAM_ROLES.includes(value)) return res.status(400).json({ error: "bad value" });
    } else if (field === "activity_status") {
      if (!ACTIVITY_STATUSES.includes(value)) return res.status(400).json({ error: "bad value" });
      if (req.amb.role === "teamlead" && !["needs_support", "active", "recommended_promotion"].includes(value)) {
        return res.status(403).json({ error: "teamlead can set: needs_support, active, recommended_promotion" });
      }
    } else {
      return res.status(400).json({ error: "bad field" });
    }

    const old = (await pool.query(`SELECT ${field}, language FROM amb_profiles WHERE id=$1`, [id])).rows[0];
    await pool.query(`UPDATE amb_profiles SET ${field}=$2 WHERE id=$1`, [id, value]);
    await db.logStatusChange(pool, id, field, old[field], value, reason, req.amb.userId);
    if (field === "program_role") {
      await notifyProfile(pool, bot, id, t(old.language, "promo_role", { role: t(old.language, "role_" + value) }));
    }
    res.json({ ok: true });
  }));

  router.post("/people/:id/assign", wrap(async (req, res) => {
    if (!isCoordPlus(req)) return res.status(403).json({ error: "coordinator+ only" });
    const id = Number(req.params.id);
    const teamId = Number(req.body.team_id);
    const team = (await pool.query(`SELECT tm.*, s.name AS stream_name FROM amb_teams tm JOIN amb_streams s ON s.id=tm.stream_id WHERE tm.id=$1`, [teamId])).rows[0];
    if (!team) return res.status(404).json({ error: "team not found" });
    if (req.amb.role === "coordinator" && !req.amb.streamIds.includes(team.stream_id)) {
      return res.status(403).json({ error: "not your stream" });
    }
    const profile = (await pool.query(`SELECT * FROM amb_profiles WHERE id=$1`, [id])).rows[0];
    if (!profile) return res.status(404).json({ error: "profile not found" });
    if (req.amb.role === "coordinator" && profile.stream_id && !req.amb.streamIds.includes(profile.stream_id)) {
      return res.status(403).json({ error: "outside your branch" });
    }
    await pool.query(`UPDATE amb_profiles SET team_id=$2, stream_id=$3 WHERE id=$1`, [id, teamId, team.stream_id]);
    await db.logStatusChange(pool, id, "team", profile.team_id, teamId, req.body.reason || "Распределение", req.amb.userId);
    if (profile.stream_id !== team.stream_id) {
      await db.logStatusChange(pool, id, "stream", profile.stream_id, team.stream_id, req.body.reason || "Распределение", req.amb.userId);
    }
    const tl = team.teamlead_id
      ? (await pool.query(`SELECT first_name, last_name, telegram_username FROM amb_profiles WHERE id=$1`, [team.teamlead_id])).rows[0]
      : null;
    const tlName = tl ? [tl.first_name, tl.last_name].filter(Boolean).join(" ") + (tl.telegram_username ? ` (@${tl.telegram_username})` : "") : "—";
    await notifyProfile(pool, bot, id, t(profile.language, "assigned", { stream: team.stream_name, team: team.name, teamlead: tlName }));
    res.json({ ok: true });
  }));

  router.post("/people/:id/points", wrap(async (req, res) => {
    if (!isCoordPlus(req)) return res.status(403).json({ error: "coordinator+ only" });
    const id = Number(req.params.id);
    if (!(await canAccessProfile(pool, req.amb, id))) return res.status(403).json({ error: "outside your branch" });
    const delta = Number(req.body.delta);
    const reason = String(req.body.reason || "").trim();
    if (!delta || !reason) return res.status(400).json({ error: "delta and reason required" });
    await addPoints(pool, {
      profileId: id, delta, reason,
      sourceType: delta < 0 ? "penalty" : String(req.body.source_type || "manual"),
      awardedBy: req.amb.userId,
    });
    const lang = (await pool.query(`SELECT language FROM amb_profiles WHERE id=$1`, [id])).rows[0].language;
    await notifyProfile(pool, bot, id,
      delta > 0 ? t(lang, "points_manual_plus", { points: delta, reason }) : t(lang, "points_manual_minus", { points: -delta, reason }));
    res.json({ ok: true, balance: await getBalance(pool, id) });
  }));

  router.post("/people/:id/link-user", wrap(async (req, res) => {
    if (req.amb.role !== "head") return res.status(403).json({ error: "head only" });
    const email = String(req.body.email || "").trim().toLowerCase();
    const u = (await pool.query(`SELECT id FROM users WHERE LOWER(email)=$1`, [email])).rows[0];
    if (!u) return res.status(404).json({ error: "site user not found" });
    await pool.query(`UPDATE amb_profiles SET user_id=$2 WHERE id=$1`, [Number(req.params.id), u.id]);
    res.json({ ok: true });
  }));

  router.post("/people/:id/message", wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!(await canAccessProfile(pool, req.amb, id))) return res.status(403).json({ error: "outside your branch" });
    const text = String(req.body.text || "").trim();
    if (!text) return res.status(400).json({ error: "text required" });
    const ok = await notifyProfile(pool, bot, id, text);
    res.json({ ok });
  }));

  /* ---------- tasks & review ---------- */

  router.get("/tasks", wrap(async (req, res) => {
    let r;
    if (req.amb.role === "head") {
      r = await pool.query(`
        SELECT tk.*,
          (SELECT COUNT(*)::INT FROM amb_task_assignments a WHERE a.task_id = tk.id AND a.status NOT IN ('cancelled')) AS taken,
          (SELECT COUNT(*)::INT FROM amb_task_assignments a WHERE a.task_id = tk.id AND a.status = 'submitted') AS submitted,
          (SELECT COUNT(*)::INT FROM amb_task_assignments a WHERE a.task_id = tk.id AND a.status = 'approved') AS approved
        FROM amb_tasks tk WHERE tk.status <> 'archived' ORDER BY tk.id DESC LIMIT 200`);
    } else {
      r = await pool.query(`
        SELECT tk.*,
          (SELECT COUNT(*)::INT FROM amb_task_assignments a WHERE a.task_id = tk.id AND a.status NOT IN ('cancelled')) AS taken,
          (SELECT COUNT(*)::INT FROM amb_task_assignments a WHERE a.task_id = tk.id AND a.status = 'submitted') AS submitted,
          (SELECT COUNT(*)::INT FROM amb_task_assignments a WHERE a.task_id = tk.id AND a.status = 'approved') AS approved
        FROM amb_tasks tk
        WHERE tk.status <> 'archived' AND (
          tk.created_by = $1
          OR (tk.audience = 'team' AND tk.audience_id = ANY($2::int[]))
          OR (tk.audience = 'stream' AND tk.audience_id = ANY($3::int[]))
        ) ORDER BY tk.id DESC LIMIT 200`,
        [req.amb.userId, req.amb.teamIds.length ? req.amb.teamIds : [0], req.amb.streamIds.length ? req.amb.streamIds : [0]]);
    }
    res.json(r.rows);
  }));

  router.post("/tasks", wrap(async (req, res) => {
    const b = req.body;
    const audience = String(b.audience || "all");
    const audienceId = b.audience_id ? Number(b.audience_id) : null;
    if (req.amb.role === "teamlead") {
      if (audience !== "team" || !req.amb.teamIds.includes(audienceId)) {
        return res.status(403).json({ error: "teamlead creates tasks for own team only" });
      }
    } else if (req.amb.role === "coordinator") {
      const okStream = audience === "stream" && req.amb.streamIds.includes(audienceId);
      const okTeam = audience === "team" && req.amb.teamIds.includes(audienceId);
      const okTrack = audience === "track";
      if (!okStream && !okTeam && !okTrack) {
        return res.status(403).json({ error: "coordinator: own stream/team or track only" });
      }
    }
    const title = String(b.title || "").trim();
    const description = String(b.description || "").trim();
    if (!title || !description) return res.status(400).json({ error: "title/description required" });
    const pmin = Math.max(0, Number(b.points_min) || 5);
    const pmax = Math.max(pmin, Number(b.points_max) || pmin);
    const r = await pool.query(
      `INSERT INTO amb_tasks (title, description, category, track_id, audience, audience_id,
         points_min, points_max, deadline, max_participants, report_format, expected_result, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'open') RETURNING *`,
      [
        title, description,
        b.category || "other", b.track_id ? Number(b.track_id) : null,
        audience, audienceId, pmin, pmax,
        b.deadline || null, b.max_participants ? Number(b.max_participants) : null,
        b.report_format || "text", b.expected_result || null, req.amb.userId,
      ]
    );
    res.json(r.rows[0]);
  }));

  router.patch("/tasks/:id", wrap(async (req, res) => {
    const id = Number(req.params.id);
    const task = (await pool.query(`SELECT * FROM amb_tasks WHERE id=$1`, [id])).rows[0];
    if (!task) return res.status(404).json({ error: "not found" });
    if (req.amb.role !== "head" && task.created_by !== req.amb.userId) {
      return res.status(403).json({ error: "not your task" });
    }
    const status = String(req.body.status || "");
    if (!["open", "closed", "archived", "draft"].includes(status)) return res.status(400).json({ error: "bad status" });
    await pool.query(`UPDATE amb_tasks SET status=$2 WHERE id=$1`, [id, status]);
    res.json({ ok: true });
  }));

  router.get("/review-queue", wrap(async (req, res) => {
    const scope = profileScope(req.amb, 1);
    const r = await pool.query(
      `SELECT a.id, a.report_text, a.report_link, a.report_file_id, a.submitted_at, a.resubmit_count,
              tk.title, tk.category, tk.points_min, tk.points_max, tk.report_format,
              p.id AS profile_id, p.first_name, p.last_name
       FROM amb_task_assignments a
       JOIN amb_tasks tk ON tk.id = a.task_id
       JOIN amb_profiles p ON p.id = a.profile_id
       WHERE a.status = 'submitted' AND ${scope.where}
       ORDER BY a.submitted_at ASC LIMIT 100`,
      scope.params
    );
    res.json(r.rows);
  }));

  router.post("/assignments/:id/review", wrap(async (req, res) => {
    const id = Number(req.params.id);
    const { action, points, comment } = req.body;
    const row = (await pool.query(
      `SELECT a.*, tk.title, tk.category, tk.points_min, tk.points_max, p.language, p.id AS pid
       FROM amb_task_assignments a
       JOIN amb_tasks tk ON tk.id = a.task_id
       JOIN amb_profiles p ON p.id = a.profile_id
       WHERE a.id = $1 AND a.status = 'submitted'`, [id])).rows[0];
    if (!row) return res.status(404).json({ error: "not in review queue" });
    if (!(await canAccessProfile(pool, req.amb, row.pid))) return res.status(403).json({ error: "outside your branch" });

    if (action === "approve") {
      let award = Math.min(Math.max(Number(points) || row.points_min, row.points_min), row.points_max);
      let note = comment || "";
      if (row.category === "media") {
        const n = await countApprovedThisMonth(pool, row.pid, "media");
        if (n >= 3) {
          award = 0;
          note = (note ? note + " " : "") + "(лимит: в зачет идут 3 медиазадания в месяц)";
        }
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `UPDATE amb_task_assignments SET status='approved', points_awarded=$2, reviewed_by=$3,
             review_comment=$4, reviewed_at=CURRENT_TIMESTAMP WHERE id=$1`,
          [id, award, req.amb.userId, note || null]
        );
        if (award > 0) {
          await addPoints(client, {
            profileId: row.pid, delta: award,
            reason: "Задание: " + row.title, sourceType: "task", sourceId: row.task_id,
            awardedBy: req.amb.userId,
          });
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
      await notifyProfile(pool, bot, row.pid, t(row.language, "task_approved", { title: row.title, points: award, comment: note }));
      return res.json({ ok: true, awarded: award });
    }

    if (action === "reject") {
      const final = row.resubmit_count >= 1;
      await pool.query(
        `UPDATE amb_task_assignments SET status=$2, reviewed_by=$3, review_comment=$4, reviewed_at=CURRENT_TIMESTAMP WHERE id=$1`,
        [id, final ? "cancelled" : "rejected", req.amb.userId, comment || null]
      );
      await notifyProfile(pool, bot, row.pid,
        t(row.language, final ? "task_rejected_final" : "task_rejected", { title: row.title, reason: comment || "" }));
      return res.json({ ok: true, final });
    }
    return res.status(400).json({ error: "bad action" });
  }));

  /* ---------- weekly reports ---------- */

  router.get("/weekly", wrap(async (req, res) => {
    const week = req.query.week || null;
    const scope = profileScope(req.amb, 2);
    const r = await pool.query(
      `SELECT p.id, p.first_name, p.last_name, p.team_id, tm.name AS team_name,
              w.answers, w.needs_help, w.created_at AS reported_at
       FROM amb_profiles p
       LEFT JOIN amb_teams tm ON tm.id = p.team_id
       LEFT JOIN amb_weekly_reports w
         ON w.profile_id = p.id AND w.week_start = COALESCE($1::date, date_trunc('week', CURRENT_DATE)::date)
       WHERE p.program_role IN ${ACCEPTED} AND p.activity_status NOT IN ('suspended','reserve') AND ${scope.where}
       ORDER BY tm.name NULLS LAST, p.first_name`,
      [week, ...scope.params]
    );
    res.json(r.rows);
  }));

  router.post("/weekly/remind", wrap(async (req, res) => {
    const scope = profileScope(req.amb, 1);
    const r = await pool.query(
      `SELECT p.id, p.telegram_id, p.language FROM amb_profiles p
       WHERE p.program_role IN ${ACCEPTED} AND p.activity_status NOT IN ('suspended','reserve') AND ${scope.where}
         AND NOT EXISTS (SELECT 1 FROM amb_weekly_reports w
           WHERE w.profile_id = p.id AND w.week_start = date_trunc('week', CURRENT_DATE)::date)`,
      scope.params
    );
    let sent = 0;
    for (const p of r.rows) {
      const ok = bot ? await require("../bot/notify").sendToTelegram(bot, p.telegram_id, t(p.language, "weekly_remind"), {
        reply_markup: { inline_keyboard: [[{ text: t(p.language, "btn_weekly_start"), callback_data: "W:go" }]] },
      }) : false;
      if (ok) sent += 1;
    }
    res.json({ ok: true, sent });
  }));

  /* ---------- events ---------- */

  router.get("/events", wrap(async (req, res) => {
    const r = await pool.query(`
      SELECT e.*,
        (SELECT COUNT(*)::INT FROM amb_event_attendance a WHERE a.event_id = e.id) AS registered,
        (SELECT COUNT(*)::INT FROM amb_event_attendance a WHERE a.event_id = e.id AND a.attended) AS attended
      FROM amb_events e ORDER BY e.event_date DESC LIMIT 100`);
    res.json(r.rows);
  }));

  router.post("/events", wrap(async (req, res) => {
    if (!isCoordPlus(req)) return res.status(403).json({ error: "coordinator+ only" });
    const b = req.body;
    if (!b.title || !b.event_date) return res.status(400).json({ error: "title and event_date required" });
    const token = crypto.randomBytes(8).toString("hex");
    const r = await pool.query(
      `INSERT INTO amb_events (title, description, event_date, location, points, audience, audience_id, qr_token, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [String(b.title).trim(), b.description || null, b.event_date, b.location || null,
       Number(b.points) || 5, b.audience || "all", b.audience_id ? Number(b.audience_id) : null,
       token, req.amb.userId]
    );
    res.json(r.rows[0]);
  }));

  router.get("/events/:id/qr", wrap(async (req, res) => {
    const ev = (await pool.query(`SELECT qr_token, title FROM amb_events WHERE id=$1`, [Number(req.params.id)])).rows[0];
    if (!ev) return res.status(404).json({ error: "not found" });
    const username = process.env.TG_BOT_USERNAME;
    if (!username) return res.status(400).json({ error: "TG_BOT_USERNAME not set" });
    const link = `https://t.me/${username}?start=ev_${ev.qr_token}`;
    const dataUrl = await QRCode.toDataURL(link, { width: 512, margin: 2 });
    res.json({ link, dataUrl, title: ev.title });
  }));

  router.get("/events/:id/attendance", wrap(async (req, res) => {
    const r = await pool.query(
      `SELECT a.*, p.first_name, p.last_name, p.ambassador_number
       FROM amb_event_attendance a JOIN amb_profiles p ON p.id = a.profile_id
       WHERE a.event_id = $1 ORDER BY p.first_name`,
      [Number(req.params.id)]
    );
    res.json(r.rows);
  }));

  router.post("/events/:id/confirm", wrap(async (req, res) => {
    const eventId = Number(req.params.id);
    const profileId = Number(req.body.profile_id);
    if (!(await canAccessProfile(pool, req.amb, profileId)) && req.amb.role !== "head") {
      return res.status(403).json({ error: "outside your branch" });
    }
    const ev = (await pool.query(`SELECT * FROM amb_events WHERE id=$1`, [eventId])).rows[0];
    if (!ev) return res.status(404).json({ error: "not found" });
    const existing = (await pool.query(
      `SELECT attended FROM amb_event_attendance WHERE event_id=$1 AND profile_id=$2`, [eventId, profileId])).rows[0];
    if (existing && existing.attended) return res.json({ ok: true, already: true });
    await pool.query(
      `INSERT INTO amb_event_attendance (event_id, profile_id, attended, confirmed_via, confirmed_by, confirmed_at)
       VALUES ($1,$2,true,'manual',$3,CURRENT_TIMESTAMP)
       ON CONFLICT (event_id, profile_id)
       DO UPDATE SET attended=true, confirmed_via='manual', confirmed_by=$3, confirmed_at=CURRENT_TIMESTAMP`,
      [eventId, profileId, req.amb.userId]
    );
    if (ev.points > 0) {
      await addPoints(pool, {
        profileId, delta: ev.points, reason: "Участие в мероприятии: " + ev.title,
        sourceType: "event", sourceId: eventId, awardedBy: req.amb.userId,
      });
    }
    res.json({ ok: true });
  }));

  router.use((err, req, res, next) => {
    console.error("[amb-admin] error:", err);
    res.status(500).json({ error: "Internal error" });
  });

  return router;
}

module.exports = { createAmbRouter };
