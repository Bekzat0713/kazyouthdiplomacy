/* Ambassador program admin panel. Vanilla JS over /api/amb/*. */
(function () {
  "use strict";

  var ME = null;
  var TRACKS = [];
  var STREAMS = [];
  var TEAMS = [];

  var ROLE_LABELS = {
    candidate: "Кандидат", trainee: "Стажер", ambassador: "Амбассадор", active: "Активный",
    senior: "Старший", teamlead: "Тимлид", coordinator: "Координатор", alumni: "Выпускник",
  };
  var ACT_LABELS = {
    active: "Активен", probation: "Испытательный", needs_support: "Нужна поддержка",
    unresponsive: "Не отвечает", recommended_promotion: "К повышению",
    suspended: "Приостановлен", reserve: "Резерв",
  };
  var ACT_PILL = {
    active: "green", probation: "blue", needs_support: "gold", unresponsive: "red",
    recommended_promotion: "gold", suspended: "red", reserve: "",
  };
  var APP_LABELS = {
    submitted: "Отправлена", in_review: "На рассмотрении", needs_revision: "На доработке",
    interview: "Интервью", accepted: "Принят", reserve: "Резерв", rejected: "Отклонена", draft: "Черновик",
  };
  var CAT_LABELS = { media: "Медиа", org: "Организация", research: "Исследование", career: "Карьера", partner: "Партнерство", other: "Другое" };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("ru-RU");
  }
  function fmtDT(d) {
    if (!d) return "—";
    return new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function api(path, opts) {
    opts = opts || {};
    if (opts.body && typeof opts.body !== "string") {
      opts.body = JSON.stringify(opts.body);
      opts.headers = Object.assign({ "Content-Type": "application/json" }, opts.headers);
    }
    opts.credentials = "same-origin";
    return fetch("/api/amb" + path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
        return data;
      });
    });
  }

  /* ---------- shell ---------- */

  var drawer = document.getElementById("drawer");
  var drawerBody = document.getElementById("drawerBody");
  document.getElementById("drawerClose").addEventListener("click", closeDrawer);
  drawer.addEventListener("click", function (e) { if (e.target === drawer) closeDrawer(); });
  function openDrawer(html) { drawerBody.innerHTML = html; drawer.hidden = false; }
  function closeDrawer() { drawer.hidden = true; drawerBody.innerHTML = ""; }

  var renderers = {
    dashboard: renderDashboard, applications: renderApplications, people: renderPeople,
    tasks: renderTasks, events: renderEvents, weekly: renderWeekly, structure: renderStructure,
  };

  document.getElementById("tabs").addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    document.querySelectorAll(".ah-tabs button").forEach(function (b) { b.classList.toggle("active", b === btn); });
    document.querySelectorAll(".tab").forEach(function (s) { s.classList.remove("active"); });
    var tab = btn.getAttribute("data-tab");
    document.getElementById("tab-" + tab).classList.add("active");
    renderers[tab]();
  });

  function el(tab) { return document.getElementById("tab-" + tab); }

  function fail(tab, err) {
    el(tab).innerHTML = '<div class="denied">Ошибка: ' + esc(err.message) + "</div>";
  }

  api("/me").then(function (me) {
    ME = me;
    document.getElementById("meBox").textContent = me.email + " · " + ({ head: "Руководитель", coordinator: "Координатор", teamlead: "Тимлид" }[me.role] || me.role);
    if (me.role === "teamlead") {
      document.querySelector('[data-tab="applications"]').style.display = "none";
      document.getElementById("structureTabBtn").style.display = "none";
    }
    return Promise.all([api("/tracks"), api("/streams")]);
  }).then(function (r) {
    TRACKS = r[0];
    STREAMS = r[1].streams;
    TEAMS = r[1].teams;
    renderDashboard();
  }).catch(function () {
    document.getElementById("accessDenied").hidden = false;
    document.querySelectorAll(".tab, .ah-tabs").forEach(function (n) { n.style.display = "none"; });
  });

  /* ---------- dashboard ---------- */

  function renderDashboard() {
    el("dashboard").innerHTML = '<div class="loading">Загрузка…</div>';
    api("/dashboard").then(function (d) {
      document.getElementById("appsBadge").textContent = d.funnel.apps_pending || "";
      document.getElementById("reviewBadge").textContent = d.tasks.review_queue || "";
      var weeklyPct = d.weekly.should_report ? Math.round((d.weekly.reported / d.weekly.should_report) * 100) : 0;
      var roleCount = function (r) {
        var row = d.roles.find(function (x) { return x.program_role === r; });
        return row ? row.n : 0;
      };
      var totalMembers = d.roles.filter(function (x) { return x.program_role !== "candidate" && x.program_role !== "alumni"; })
        .reduce(function (s, x) { return s + x.n; }, 0);

      var html = '<div class="cards">' +
        card(d.funnel.apps_pending, "Заявок ждут решения", d.funnel.apps_pending > 0 ? "warn" : "") +
        card(d.funnel.apps_week, "Заявок за 7 дней") +
        card(totalMembers, "Участников в программе") +
        card(weeklyPct + "%", "Сдали отчет на этой неделе", weeklyPct >= 70 ? "good" : "warn") +
        card(d.weekly.needs_help, "Просят помощи", d.weekly.needs_help > 0 ? "bad" : "") +
        card(d.tasks.review_queue, "Отчетов на проверке", d.tasks.review_queue > 10 ? "bad" : "") +
        card(d.alerts.unresponsive, "Давно не отвечают", d.alerts.unresponsive > 0 ? "warn" : "") +
        card(d.alerts.unassigned, "Без команды", d.alerts.unassigned > 0 ? "warn" : "") +
        "</div>";

      html += '<div class="panel"><h3>Потоки</h3><table><tr><th>Поток</th><th>Команд</th><th>Людей</th><th>Отчеты (неделя)</th></tr>' +
        d.streams.map(function (s) {
          return "<tr><td>" + esc(s.name) + "</td><td>" + s.teams + "</td><td>" + s.members + "</td><td>" +
            s.weekly_done + " / " + s.members + "</td></tr>";
        }).join("") + "</table></div>";

      html += '<div class="panel"><h3>Ступени</h3>' +
        Object.keys(ROLE_LABELS).map(function (r) {
          var n = roleCount(r);
          return n ? '<span class="pill" style="margin:3px">' + ROLE_LABELS[r] + ": <b>" + n + "</b></span>" : "";
        }).join(" ") + "</div>";

      html += '<div class="panel"><h3>Активность</h3>' +
        d.activity.map(function (a) {
          return '<span class="pill ' + (ACT_PILL[a.activity_status] || "") + '" style="margin:3px">' +
            (ACT_LABELS[a.activity_status] || a.activity_status) + ": <b>" + a.n + "</b></span>";
        }).join(" ") + "</div>";

      var primaries = d.tracks.filter(function (x) { return x.is_primary; });
      if (primaries.length) {
        html += '<div class="panel"><h3>Основные направления</h3>' +
          primaries.map(function (x) { return '<span class="pill" style="margin:3px">' + esc(x.name_ru) + ": <b>" + x.n + "</b></span>"; }).join(" ") +
          "</div>";
      }
      if (ME.role === "head" && d.sources.length) {
        html += '<div class="panel"><h3>Источники регистраций</h3>' +
          d.sources.map(function (s) { return '<span class="pill" style="margin:3px">' + esc(s.source) + ": <b>" + s.n + "</b></span>"; }).join(" ") +
          "</div>";
      }
      if (d.alerts.stale_apps > 0) {
        html += '<div class="panel"><h3 style="color:var(--red)">⚠ Заявки старше 7 дней без решения: ' + d.alerts.stale_apps + "</h3></div>";
      }
      el("dashboard").innerHTML = html;
    }).catch(function (e) { fail("dashboard", e); });
  }

  function card(v, label, cls) {
    return '<div class="kcard ' + (cls || "") + '"><div class="kv">' + v + '</div><div class="kl">' + label + "</div></div>";
  }

  /* ---------- applications ---------- */

  function renderApplications() {
    var box = el("applications");
    box.innerHTML =
      '<div class="filters">' +
      '<select id="appStatus"><option value="">Все активные</option>' +
      ["submitted", "in_review", "needs_revision", "interview", "accepted", "reserve", "rejected"].map(function (s) {
        return '<option value="' + s + '">' + APP_LABELS[s] + "</option>";
      }).join("") + "</select>" +
      '<select id="appKind"><option value="">Все</option><option value="new">Новые</option><option value="migration">Верификация</option></select>' +
      '<button class="btn ghost sm" id="appReload">Обновить</button></div><div id="appList"></div>';
    box.querySelector("#appReload").addEventListener("click", loadApps);
    box.querySelector("#appStatus").addEventListener("change", loadApps);
    box.querySelector("#appKind").addEventListener("change", loadApps);
    loadApps();

    function loadApps() {
      var qs = [];
      var st = box.querySelector("#appStatus").value;
      var kd = box.querySelector("#appKind").value;
      if (st) qs.push("status=" + st);
      if (kd) qs.push("kind=" + kd);
      box.querySelector("#appList").innerHTML = '<div class="loading">Загрузка…</div>';
      api("/applications" + (qs.length ? "?" + qs.join("&") : "")).then(function (apps) {
        if (!apps.length) { box.querySelector("#appList").innerHTML = '<div class="loading">Заявок нет</div>'; return; }
        box.querySelector("#appList").innerHTML = '<div class="panel"><table><tr><th>Кандидат</th><th>Город</th><th>Вид</th><th>Задание</th><th>Статус</th><th>Подана</th></tr>' +
          apps.map(function (a) {
            return '<tr data-id="' + a.id + '" style="cursor:pointer"><td>' + esc((a.first_name || "") + " " + (a.last_name || "")) +
              (a.is_minor ? ' <span class="pill gold">&lt;18</span>' : "") + "</td><td>" + esc(a.city) + "</td><td>" +
              (a.kind === "migration" ? "Верификация" : "Новая") + "</td><td>" + esc(a.intro_task_type || "—") +
              (a.quiz_score != null ? " (" + a.quiz_score + "/5)" : "") + '</td><td><span class="pill blue">' +
              (APP_LABELS[a.status] || a.status) + "</span></td><td>" + fmtDate(a.submitted_at) + "</td></tr>";
          }).join("") + "</table></div>";
        box.querySelectorAll("tr[data-id]").forEach(function (tr) {
          tr.addEventListener("click", function () { openApplication(Number(tr.getAttribute("data-id"))); });
        });
      }).catch(function (e) { fail("applications", e); });
    }
  }

  function openApplication(id) {
    api("/applications/" + id).then(function (a) {
      var tracks = (a.tracks || []).map(function (tr) {
        return '<span class="pill ' + (tr.is_primary ? "blue" : "") + '">' + esc(tr.name_ru) + (tr.is_primary ? " ★" : "") + "</span>";
      }).join(" ");
      var rows = [
        ["Дата рождения", fmtDate(a.birth_date) + (a.is_minor ? " (несовершеннолетний)" : "")],
        ["Город", a.city], ["Телефон", a.phone], ["Email", a.email],
        ["Учеба/работа", a.study_or_work], ["Специальность", a.speciality],
        ["Образование", a.education_level], ["Языки", a.languages],
        ["Навыки", a.skills], ["Опыт", a.experience],
        ["Доступность", (a.availability || "—") + " ч/нед"], ["Соцсети", a.social_links],
        ["Источник", a.source], ["Представитель", a.guardian_contact],
      ];
      var html = "<h2>" + esc((a.first_name || "") + " " + (a.last_name || "")) + "</h2>" +
        '<p class="muted">Заявка #' + a.application_id + " · " + (a.kind === "migration" ? "верификация" : "новая") +
        ' · <span class="pill blue">' + (APP_LABELS[a.app_status] || a.app_status) + "</span></p>" +
        '<div class="mt">' + tracks + "</div>" +
        '<div class="mt">' + rows.map(function (r) {
          return '<div class="kvrow"><b>' + r[0] + "</b><span>" + esc(r[1] || "—") + "</span></div>";
        }).join("") + "</div>" +
        '<div class="panel mt"><h3>Мотивация</h3><p>' + esc(a.motivation || "—") + "</p></div>" +
        '<div class="panel"><h3>Вводное задание: ' + esc(a.intro_task_type || "—") + "</h3><p>" +
        esc(a.intro_task_content || "—") + "</p>" +
        (a.intro_task_file_id ? '<button class="btn ghost sm mt" id="sendIntroFile">📹 Переслать видео в админ-чат</button>' : "") +
        (a.quiz_score != null ? "<p>Тест: " + a.quiz_score + "/5</p>" : "") + "</div>" +
        (a.internal_notes ? '<div class="panel"><h3>Внутренние комментарии</h3><p>' + esc(a.internal_notes) + "</p></div>" : "") +
        '<div class="panel"><h3>Решение</h3>' +
        '<textarea id="decReason" placeholder="Причина / комментарий кандидату (обязательно для отказа и доработки)"></textarea>' +
        '<textarea id="decNote" class="mt" placeholder="Внутренняя заметка (кандидат не видит)"></textarea>' +
        '<div class="actions">' +
        '<button class="btn green" data-act="accept">✅ Принять</button>' +
        '<button class="btn ghost" data-act="interview">🎙 На интервью</button>' +
        '<button class="btn gold" data-act="revision">✏️ На доработку</button>' +
        '<button class="btn ghost" data-act="reserve">🕓 В резерв</button>' +
        '<button class="btn red" data-act="reject">❌ Отклонить</button>' +
        "</div></div>";
      openDrawer(html);
      var fileBtn = drawerBody.querySelector("#sendIntroFile");
      if (fileBtn) fileBtn.addEventListener("click", function () {
        api("/applications/" + a.application_id + "/send-intro-file", { method: "POST", body: {} })
          .then(function () { alert("Отправлено в админ-чат Telegram"); })
          .catch(function (e) { alert(e.message); });
      });
      drawerBody.querySelectorAll("[data-act]").forEach(function (b) {
        b.addEventListener("click", function () {
          var reason = drawerBody.querySelector("#decReason").value.trim();
          var act = b.getAttribute("data-act");
          if ((act === "reject" || act === "revision") && !reason) return alert("Укажи причину — она уйдет кандидату.");
          if (!confirm("Подтвердить: " + b.textContent.trim() + "?")) return;
          api("/applications/" + a.application_id + "/decision", {
            method: "POST",
            body: { action: act, reason: reason, note: drawerBody.querySelector("#decNote").value.trim() },
          }).then(function () { closeDrawer(); renderApplications(); }).catch(function (e) { alert(e.message); });
        });
      });
    }).catch(function (e) { alert(e.message); });
  }

  /* ---------- people ---------- */

  function renderPeople() {
    var box = el("people");
    box.innerHTML =
      '<div class="filters">' +
      '<input id="pq" placeholder="Поиск: имя или город">' +
      '<select id="pRole"><option value="">Все ступени</option>' +
      Object.keys(ROLE_LABELS).map(function (r) { return '<option value="' + r + '">' + ROLE_LABELS[r] + "</option>"; }).join("") + "</select>" +
      '<select id="pAct"><option value="">Вся активность</option>' +
      Object.keys(ACT_LABELS).map(function (r) { return '<option value="' + r + '">' + ACT_LABELS[r] + "</option>"; }).join("") + "</select>" +
      '<select id="pTeam"><option value="">Все команды</option>' +
      TEAMS.map(function (tm) { return '<option value="' + tm.id + '">' + esc(tm.name) + "</option>"; }).join("") + "</select>" +
      '<label style="align-self:center"><input type="checkbox" id="pUnassigned"> без команды</label>' +
      '<button class="btn sm" id="pReload">Показать</button></div><div id="pList"></div>';
    box.querySelector("#pReload").addEventListener("click", load);
    box.querySelector("#pq").addEventListener("keydown", function (e) { if (e.key === "Enter") load(); });
    load();

    function load() {
      var qs = [];
      var v;
      if ((v = box.querySelector("#pq").value.trim())) qs.push("q=" + encodeURIComponent(v));
      if ((v = box.querySelector("#pRole").value)) qs.push("role=" + v);
      if ((v = box.querySelector("#pAct").value)) qs.push("activity=" + v);
      if ((v = box.querySelector("#pTeam").value)) qs.push("team_id=" + v);
      if (box.querySelector("#pUnassigned").checked) qs.push("unassigned=1");
      box.querySelector("#pList").innerHTML = '<div class="loading">Загрузка…</div>';
      api("/people" + (qs.length ? "?" + qs.join("&") : "")).then(function (people) {
        if (!people.length) { box.querySelector("#pList").innerHTML = '<div class="loading">Никого не нашли</div>'; return; }
        box.querySelector("#pList").innerHTML = '<div class="panel"><table><tr><th>№</th><th>Имя</th><th>Город</th><th>Ступень</th><th>Активность</th><th>Команда</th><th class="right">Баллы</th><th>Отчет</th></tr>' +
          people.map(function (p) {
            return '<tr data-id="' + p.id + '" style="cursor:pointer"><td class="nowrap">' +
              (p.ambassador_number ? "KYD-" + String(p.ambassador_number).padStart(4, "0") : "—") + "</td><td>" +
              esc((p.first_name || "") + " " + (p.last_name || "")) + (p.is_minor ? ' <span class="pill gold">&lt;18</span>' : "") +
              "</td><td>" + esc(p.city) + "</td><td>" + (ROLE_LABELS[p.program_role] || p.program_role) +
              '</td><td><span class="pill ' + (ACT_PILL[p.activity_status] || "") + '">' + (ACT_LABELS[p.activity_status] || "") + "</span></td><td>" +
              esc(p.team_name || "—") + '<div class="sub">' + esc(p.stream_name || "") + '</div></td><td class="right">' + p.points +
              "</td><td>" + fmtDate(p.last_report) + "</td></tr>";
          }).join("") + "</table></div>";
        box.querySelectorAll("tr[data-id]").forEach(function (tr) {
          tr.addEventListener("click", function () { openPerson(Number(tr.getAttribute("data-id"))); });
        });
      }).catch(function (e) { fail("people", e); });
    }
  }

  function openPerson(id) {
    api("/people/" + id).then(function (d) {
      var p = d.profile;
      var isCoordPlus = ME.role === "head" || ME.role === "coordinator";
      var tracks = (d.tracks || []).map(function (tr) {
        return '<span class="pill ' + (tr.is_primary ? "blue" : "") + '">' + esc(tr.name_ru) + (tr.is_primary ? " ★" : "") + "</span>";
      }).join(" ");
      var html = "<h2>" + esc((p.first_name || "") + " " + (p.last_name || "")) + "</h2>" +
        '<p class="muted">' + (p.ambassador_number ? "KYD-" + String(p.ambassador_number).padStart(4, "0") : "без номера") +
        " · " + (ROLE_LABELS[p.program_role] || "") + ' · <span class="pill ' + (ACT_PILL[p.activity_status] || "") + '">' +
        (ACT_LABELS[p.activity_status] || "") + "</span> · ⭐ " + d.points + "</p>" +
        '<div class="mt">' + tracks + "</div>" +
        '<div class="mt">' + [
          ["Команда", (p.team_name || "—") + " / " + (p.stream_name || "—")],
          ["Город", p.city], ["Телефон", p.phone], ["Email", p.email],
          ["Учеба/работа", p.study_or_work], ["Специальность", p.speciality],
          ["Языки", p.languages], ["Telegram", p.telegram_username ? "@" + p.telegram_username : "—"],
          ["В программе с", fmtDate(p.joined_at)], ["Испытательный до", fmtDate(p.trainee_until)],
          ["Представитель", p.guardian_contact],
        ].map(function (r) { return '<div class="kvrow"><b>' + r[0] + "</b><span>" + esc(r[1] || "—") + "</span></div>"; }).join("") + "</div>";

      html += '<div class="panel mt"><h3>Действия</h3><div class="form-grid">';
      html += '<div><label class="f">Статус активности</label><select id="actSel">' +
        Object.keys(ACT_LABELS).map(function (s) {
          return '<option value="' + s + '"' + (s === p.activity_status ? " selected" : "") + ">" + ACT_LABELS[s] + "</option>";
        }).join("") + "</select></div>";
      if (ME.role === "head") {
        html += '<div><label class="f">Ступень (только head)</label><select id="roleSel">' +
          Object.keys(ROLE_LABELS).map(function (s) {
            return '<option value="' + s + '"' + (s === p.program_role ? " selected" : "") + ">" + ROLE_LABELS[s] + "</option>";
          }).join("") + "</select></div>";
      }
      if (isCoordPlus) {
        html += '<div><label class="f">Команда</label><select id="teamSel"><option value="">—</option>' +
          TEAMS.map(function (tm) {
            var s = STREAMS.find(function (x) { return x.id === tm.stream_id; });
            return '<option value="' + tm.id + '"' + (tm.id === p.team_id ? " selected" : "") + ">" +
              esc(tm.name) + " (" + esc(s ? s.name : "") + ", " + tm.members + "/" + tm.capacity + ")</option>";
          }).join("") + "</select></div>";
      }
      html += '<div class="full"><label class="f">Причина изменения (обязательно)</label><input id="chgReason" style="width:100%" placeholder="Например: рекомендация тимлида"></div>';
      html += '<div class="full actions"><button class="btn sm" id="applyChanges">Применить изменения</button>';
      if (isCoordPlus) html += '<button class="btn ghost sm" id="addPoints">⭐ Баллы…</button>';
      html += '<button class="btn ghost sm" id="sendMsg">💬 Написать в бот…</button>';
      if (ME.role === "head") html += '<button class="btn ghost sm" id="linkUser">🔗 Привязать аккаунт сайта…</button>';
      html += "</div></div></div>";

      html += listPanel("История баллов", d.ledger, function (x) {
        return (x.delta > 0 ? "+" : "") + x.delta + " — " + esc(x.reason) + ' <span class="muted">' + fmtDate(x.created_at) + "</span>";
      });
      html += listPanel("Задания", d.assignments, function (x) {
        return esc(x.title) + " — " + esc(x.status) + (x.points_awarded != null ? " (+" + x.points_awarded + ")" : "");
      });
      html += listPanel("Мероприятия", d.attendance, function (x) {
        return esc(x.title) + " — " + (x.attended ? "✅ " + (x.confirmed_via || "") : "регистрация") + ' <span class="muted">' + fmtDate(x.event_date) + "</span>";
      });
      html += listPanel("Еженедельные отчеты", d.weeklies, function (x) {
        return fmtDate(x.week_start) + (x.needs_help ? ' <span class="help-flag">SOS</span>' : "") + " — " + esc((x.answers && x.answers.done) || "—");
      });
      html += listPanel("История статусов", d.history, function (x) {
        return esc(x.field) + ": " + esc(x.old_value || "—") + " → " + esc(x.new_value || "—") +
          (x.reason ? " (" + esc(x.reason) + ")" : "") + ' <span class="muted">' + fmtDate(x.created_at) + "</span>";
      });

      openDrawer(html);

      drawerBody.querySelector("#applyChanges").addEventListener("click", function () {
        var reason = drawerBody.querySelector("#chgReason").value.trim();
        var jobs = [];
        var actVal = drawerBody.querySelector("#actSel").value;
        if (actVal !== p.activity_status) {
          if (!reason) return alert("Укажи причину изменения.");
          jobs.push(api("/people/" + id + "/status", { method: "POST", body: { field: "activity_status", value: actVal, reason: reason } }));
        }
        var roleSel = drawerBody.querySelector("#roleSel");
        if (roleSel && roleSel.value !== p.program_role) {
          if (!reason) return alert("Укажи причину изменения.");
          jobs.push(api("/people/" + id + "/status", { method: "POST", body: { field: "program_role", value: roleSel.value, reason: reason } }));
        }
        var teamSel = drawerBody.querySelector("#teamSel");
        if (teamSel && teamSel.value && Number(teamSel.value) !== p.team_id) {
          jobs.push(api("/people/" + id + "/assign", { method: "POST", body: { team_id: Number(teamSel.value), reason: reason || "Распределение" } }));
        }
        if (!jobs.length) return alert("Изменений нет.");
        Promise.all(jobs).then(function () { closeDrawer(); renderPeople(); }).catch(function (e) { alert(e.message); });
      });
      var pointsBtn = drawerBody.querySelector("#addPoints");
      if (pointsBtn) pointsBtn.addEventListener("click", function () {
        var delta = Number(prompt("Сколько баллов? (отрицательное — списание)", "10"));
        if (!delta) return;
        var reason = prompt("Причина (увидит участник):");
        if (!reason) return;
        api("/people/" + id + "/points", { method: "POST", body: { delta: delta, reason: reason } })
          .then(function (r) { alert("Готово. Баланс: " + r.balance); }).catch(function (e) { alert(e.message); });
      });
      drawerBody.querySelector("#sendMsg").addEventListener("click", function () {
        var text = prompt("Сообщение участнику (уйдет от имени бота):");
        if (!text) return;
        api("/people/" + id + "/message", { method: "POST", body: { text: text } })
          .then(function (r) { alert(r.ok ? "Отправлено" : "Не доставлено (возможно, бот заблокирован)"); })
          .catch(function (e) { alert(e.message); });
      });
      var linkBtn = drawerBody.querySelector("#linkUser");
      if (linkBtn) linkBtn.addEventListener("click", function () {
        var email = prompt("Email аккаунта на сайте:");
        if (!email) return;
        api("/people/" + id + "/link-user", { method: "POST", body: { email: email } })
          .then(function () { alert("Привязано"); }).catch(function (e) { alert(e.message); });
      });
    }).catch(function (e) { alert(e.message); });
  }

  function listPanel(title, rows, fmt) {
    if (!rows || !rows.length) return "";
    return '<div class="panel mt"><h3>' + title + "</h3>" +
      rows.map(function (x) { return '<div class="kvrow"><span>' + fmt(x) + "</span></div>"; }).join("") + "</div>";
  }

  /* ---------- tasks ---------- */

  function renderTasks() {
    var box = el("tasks");
    var audienceOptions = '<option value="all">Всем</option>' +
      STREAMS.map(function (s) { return '<option value="stream:' + s.id + '">Поток: ' + esc(s.name) + "</option>"; }).join("") +
      TEAMS.map(function (tm) { return '<option value="team:' + tm.id + '">Команда: ' + esc(tm.name) + "</option>"; }).join("") +
      TRACKS.map(function (tr) { return '<option value="track:' + tr.id + '">Трек: ' + esc(tr.name_ru) + "</option>"; }).join("");

    box.innerHTML =
      '<div class="panel"><h3>Новое задание</h3><div class="form-grid">' +
      '<div class="full"><label class="f">Название</label><input id="tTitle" style="width:100%"></div>' +
      '<div class="full"><label class="f">Описание</label><textarea id="tDesc"></textarea></div>' +
      '<div><label class="f">Категория</label><select id="tCat">' +
      Object.keys(CAT_LABELS).map(function (c) { return '<option value="' + c + '">' + CAT_LABELS[c] + "</option>"; }).join("") + "</select></div>" +
      '<div><label class="f">Аудитория</label><select id="tAud">' + audienceOptions + "</select></div>" +
      '<div><label class="f">Баллы от</label><input id="tPmin" type="number" value="5"></div>' +
      '<div><label class="f">Баллы до</label><input id="tPmax" type="number" value="10"></div>' +
      '<div><label class="f">Дедлайн</label><input id="tDeadline" type="datetime-local"></div>' +
      '<div><label class="f">Лимит участников</label><input id="tMax" type="number" placeholder="без лимита"></div>' +
      '<div><label class="f">Форма отчета</label><select id="tFmt"><option value="text">Текст</option><option value="photo">Фото</option><option value="file">Файл</option><option value="link">Ссылка</option><option value="none">Не требуется</option></select></div>' +
      '<div class="full"><label class="f">Ожидаемый результат</label><input id="tExpected" style="width:100%"></div>' +
      '<div class="full"><button class="btn" id="tCreate">Создать задание</button></div>' +
      "</div></div>" +
      '<div class="panel"><h3>Отчеты на проверке</h3><div id="reviewList"><div class="loading">Загрузка…</div></div></div>' +
      '<div class="panel"><h3>Задания</h3><div id="taskList"><div class="loading">Загрузка…</div></div></div>';

    box.querySelector("#tCreate").addEventListener("click", function () {
      var aud = box.querySelector("#tAud").value.split(":");
      var body = {
        title: box.querySelector("#tTitle").value.trim(),
        description: box.querySelector("#tDesc").value.trim(),
        category: box.querySelector("#tCat").value,
        audience: aud[0], audience_id: aud[1] ? Number(aud[1]) : null,
        points_min: Number(box.querySelector("#tPmin").value) || 5,
        points_max: Number(box.querySelector("#tPmax").value) || 5,
        deadline: box.querySelector("#tDeadline").value || null,
        max_participants: Number(box.querySelector("#tMax").value) || null,
        report_format: box.querySelector("#tFmt").value,
        expected_result: box.querySelector("#tExpected").value.trim() || null,
      };
      if (!body.title || !body.description) return alert("Название и описание обязательны.");
      api("/tasks", { method: "POST", body: body })
        .then(function () { alert("Создано. Участники увидят его в боте."); renderTasks(); })
        .catch(function (e) { alert(e.message); });
    });

    api("/review-queue").then(function (queue) {
      var elq = box.querySelector("#reviewList");
      if (!queue.length) { elq.innerHTML = '<div class="muted">Очередь пуста 🎉</div>'; return; }
      elq.innerHTML = queue.map(function (q) {
        var content = q.report_text ? esc(q.report_text) : "";
        if (q.report_link) content += ' <a href="' + esc(q.report_link) + '" target="_blank" rel="noopener">' + esc(q.report_link) + "</a>";
        if (q.report_file_id) content += ' <span class="pill">📎 файл в Telegram</span>';
        return '<div class="kvrow" style="display:block;padding:10px 0">' +
          "<b>" + esc(q.title) + "</b> — " + esc((q.first_name || "") + " " + (q.last_name || "")) +
          ' <span class="muted">' + fmtDT(q.submitted_at) + (q.resubmit_count ? " · повторная сдача" : "") + "</span>" +
          "<div class='mt'>" + (content || "<span class='muted'>без текста</span>") + "</div>" +
          '<div class="actions"><input type="number" id="pts' + q.id + '" value="' + q.points_max + '" min="' + q.points_min + '" max="' + q.points_max + '" style="width:80px">' +
          '<button class="btn green sm" data-approve="' + q.id + '">Принять</button>' +
          '<button class="btn red sm" data-reject="' + q.id + '">Отклонить</button></div></div>';
      }).join("");
      elq.querySelectorAll("[data-approve]").forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-approve");
          var pts = Number(document.getElementById("pts" + id).value);
          var comment = prompt("Комментарий участнику (необязательно):") || "";
          api("/assignments/" + id + "/review", { method: "POST", body: { action: "approve", points: pts, comment: comment } })
            .then(function (r) { alert("Принято, +" + r.awarded); renderTasks(); }).catch(function (e) { alert(e.message); });
        });
      });
      elq.querySelectorAll("[data-reject]").forEach(function (b) {
        b.addEventListener("click", function () {
          var comment = prompt("Причина отклонения (уйдет участнику):");
          if (!comment) return;
          api("/assignments/" + b.getAttribute("data-reject") + "/review", { method: "POST", body: { action: "reject", comment: comment } })
            .then(function () { renderTasks(); }).catch(function (e) { alert(e.message); });
        });
      });
    });

    api("/tasks").then(function (tasks) {
      var elt = box.querySelector("#taskList");
      if (!tasks.length) { elt.innerHTML = '<div class="muted">Заданий пока нет</div>'; return; }
      elt.innerHTML = "<table><tr><th>Задание</th><th>Категория</th><th>Аудитория</th><th>Баллы</th><th>Дедлайн</th><th>Взяли</th><th>Сдали</th><th>Статус</th><th></th></tr>" +
        tasks.map(function (tk) {
          return "<tr><td>" + esc(tk.title) + "</td><td>" + (CAT_LABELS[tk.category] || "") + "</td><td>" + esc(tk.audience) +
            "</td><td>" + tk.points_min + "–" + tk.points_max + "</td><td>" + (tk.deadline ? fmtDT(tk.deadline) : "—") +
            "</td><td>" + tk.taken + (tk.max_participants ? "/" + tk.max_participants : "") + "</td><td>" + tk.approved +
            '</td><td><span class="pill">' + esc(tk.status) + "</span></td><td>" +
            (tk.status === "open" ? '<button class="btn ghost sm" data-close="' + tk.id + '">Закрыть</button>' : "") + "</td></tr>";
        }).join("") + "</table>";
      elt.querySelectorAll("[data-close]").forEach(function (b) {
        b.addEventListener("click", function () {
          if (!confirm("Закрыть задание?")) return;
          api("/tasks/" + b.getAttribute("data-close"), { method: "PATCH", body: { status: "closed" } })
            .then(renderTasks).catch(function (e) { alert(e.message); });
        });
      });
    });
  }

  /* ---------- events ---------- */

  function renderEvents() {
    var box = el("events");
    box.innerHTML =
      '<div class="panel"><h3>Новое мероприятие</h3><div class="form-grid">' +
      '<div class="full"><label class="f">Название</label><input id="eTitle" style="width:100%"></div>' +
      '<div class="full"><label class="f">Описание</label><textarea id="eDesc"></textarea></div>' +
      '<div><label class="f">Дата и время</label><input id="eDate" type="datetime-local"></div>' +
      '<div><label class="f">Место</label><input id="eLoc"></div>' +
      '<div><label class="f">Баллы за участие</label><input id="ePts" type="number" value="5"></div>' +
      '<div class="full"><button class="btn" id="eCreate">Создать</button></div></div></div>' +
      '<div class="panel"><h3>Мероприятия</h3><div id="evList"><div class="loading">Загрузка…</div></div></div>';

    box.querySelector("#eCreate").addEventListener("click", function () {
      var body = {
        title: box.querySelector("#eTitle").value.trim(),
        description: box.querySelector("#eDesc").value.trim() || null,
        event_date: box.querySelector("#eDate").value,
        location: box.querySelector("#eLoc").value.trim() || null,
        points: Number(box.querySelector("#ePts").value) || 5,
      };
      if (!body.title || !body.event_date) return alert("Название и дата обязательны.");
      api("/events", { method: "POST", body: body }).then(renderEvents).catch(function (e) { alert(e.message); });
    });

    api("/events").then(function (events) {
      var elv = box.querySelector("#evList");
      if (!events.length) { elv.innerHTML = '<div class="muted">Мероприятий нет</div>'; return; }
      elv.innerHTML = "<table><tr><th>Мероприятие</th><th>Дата</th><th>Место</th><th>Баллы</th><th>Регистраций</th><th>Пришло</th><th></th></tr>" +
        events.map(function (ev) {
          return "<tr><td>" + esc(ev.title) + "</td><td>" + fmtDT(ev.event_date) + "</td><td>" + esc(ev.location || "—") +
            "</td><td>" + ev.points + "</td><td>" + ev.registered + "</td><td>" + ev.attended + "</td><td class='nowrap'>" +
            '<button class="btn ghost sm" data-qr="' + ev.id + '">QR</button> ' +
            '<button class="btn ghost sm" data-att="' + ev.id + '" data-title="' + esc(ev.title) + '">Участники</button></td></tr>';
        }).join("") + "</table>";
      elv.querySelectorAll("[data-qr]").forEach(function (b) {
        b.addEventListener("click", function () {
          api("/events/" + b.getAttribute("data-qr") + "/qr").then(function (r) {
            openDrawer("<h2>QR для входа</h2><p class='muted mb'>" + esc(r.title) + "</p>" +
              '<img class="qr-img" src="' + r.dataUrl + '" alt="QR">' +
              '<p class="hint">Покажи этот QR на площадке. Участник сканирует → бот подтверждает участие и начисляет баллы.<br>Ссылка: ' + esc(r.link) + "</p>");
          }).catch(function (e) { alert(e.message); });
        });
      });
      elv.querySelectorAll("[data-att]").forEach(function (b) {
        b.addEventListener("click", function () {
          var evId = b.getAttribute("data-att");
          api("/events/" + evId + "/attendance").then(function (rows) {
            openDrawer("<h2>" + esc(b.getAttribute("data-title")) + "</h2>" +
              '<div class="panel mt"><table><tr><th>Участник</th><th>Статус</th><th></th></tr>' +
              (rows.length ? rows.map(function (r) {
                return "<tr><td>" + esc((r.first_name || "") + " " + (r.last_name || "")) + "</td><td>" +
                  (r.attended ? '<span class="pill green">✅ ' + (r.confirmed_via || "") + "</span>" : '<span class="pill">регистрация</span>') +
                  "</td><td>" + (!r.attended ? '<button class="btn ghost sm" data-confirm="' + r.profile_id + '">Подтвердить</button>' : "") + "</td></tr>";
              }).join("") : "<tr><td colspan=3 class='muted'>Пока никто не зарегистрировался</td></tr>") + "</table></div>");
            drawerBody.querySelectorAll("[data-confirm]").forEach(function (cb) {
              cb.addEventListener("click", function () {
                api("/events/" + evId + "/confirm", { method: "POST", body: { profile_id: Number(cb.getAttribute("data-confirm")) } })
                  .then(function () { cb.replaceWith("✅"); }).catch(function (e) { alert(e.message); });
              });
            });
          });
        });
      });
    });
  }

  /* ---------- weekly ---------- */

  function renderWeekly() {
    var box = el("weekly");
    box.innerHTML =
      '<div class="filters"><input type="date" id="wWeek"> <button class="btn ghost sm" id="wLoad">Показать</button>' +
      '<button class="btn sm" id="wRemind">🔔 Напомнить несдавшим</button></div><div id="wList"></div>';
    box.querySelector("#wLoad").addEventListener("click", load);
    box.querySelector("#wRemind").addEventListener("click", function () {
      if (!confirm("Отправить напоминание всем, кто не сдал отчет на этой неделе?")) return;
      api("/weekly/remind", { method: "POST", body: {} })
        .then(function (r) { alert("Отправлено: " + r.sent); }).catch(function (e) { alert(e.message); });
    });
    load();

    function load() {
      var week = box.querySelector("#wWeek").value;
      box.querySelector("#wList").innerHTML = '<div class="loading">Загрузка…</div>';
      api("/weekly" + (week ? "?week=" + week : "")).then(function (rows) {
        var done = rows.filter(function (r) { return r.reported_at; });
        var missing = rows.filter(function (r) { return !r.reported_at; });
        var html = '<div class="cards">' +
          card(done.length + " / " + rows.length, "Сдали отчет") +
          card(done.filter(function (r) { return r.needs_help; }).length, "Просят помощи", "bad") + "</div>";
        html += '<div class="panel"><h3>Сдали</h3><table><tr><th>Участник</th><th>Команда</th><th>Что делал</th><th>Помощь</th></tr>' +
          (done.map(function (r) {
            var a = r.answers || {};
            return "<tr><td>" + esc((r.first_name || "") + " " + (r.last_name || "")) + "</td><td>" + esc(r.team_name || "—") +
              "</td><td>" + esc(a.done || "—") + "</td><td>" +
              (r.needs_help ? '<span class="help-flag">' + esc(a.help || "SOS") + "</span>" : "—") + "</td></tr>";
          }).join("") || "<tr><td colspan=4 class='muted'>Пока пусто</td></tr>") + "</table></div>";
        html += '<div class="panel"><h3>Не сдали (' + missing.length + ')</h3><p>' +
          (missing.map(function (r) { return '<span class="pill" style="margin:3px">' + esc((r.first_name || "") + " " + (r.last_name || "")) + "</span>"; }).join(" ") || "🎉 Все сдали!") +
          "</p></div>";
        box.querySelector("#wList").innerHTML = html;
      }).catch(function (e) { fail("weekly", e); });
    }
  }

  /* ---------- structure ---------- */

  function renderStructure() {
    var box = el("structure");
    var canEdit = ME.role === "head";
    var html = "";
    if (canEdit) {
      html += '<div class="panel"><h3>Создать</h3><div class="actions">' +
        '<input id="stName" placeholder="Название потока"><button class="btn sm" id="stCreate">+ Поток</button>' +
        '<select id="tmStream">' + STREAMS.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + "</option>"; }).join("") + "</select>" +
        '<input id="tmName" placeholder="Название команды"><button class="btn sm" id="tmCreate">+ Команда</button>' +
        "</div></div>";
    }
    html += STREAMS.map(function (s) {
      var streamTeams = TEAMS.filter(function (tm) { return tm.stream_id === s.id; });
      return '<div class="panel"><h3>' + esc(s.name) + " · координатор: " +
        esc(((s.co_first || "") + " " + (s.co_last || "")).trim() || "не назначен") +
        (canEdit ? ' <button class="btn ghost sm" data-setco="' + s.id + '">Назначить координатора</button>' : "") +
        " · участников: " + s.members + "</h3>" +
        "<table><tr><th>Команда</th><th>Тимлид</th><th>Людей</th>" + (canEdit ? "<th></th>" : "") + "</tr>" +
        (streamTeams.map(function (tm) {
          return "<tr><td>" + esc(tm.name) + "</td><td>" + esc(((tm.tl_first || "") + " " + (tm.tl_last || "")).trim() || "—") +
            "</td><td>" + tm.members + "/" + tm.capacity + "</td>" +
            (canEdit ? '<td><button class="btn ghost sm" data-settl="' + tm.id + '">Назначить тимлида</button></td>' : "") + "</tr>";
        }).join("") || "<tr><td colspan=4 class='muted'>Команд нет</td></tr>") + "</table></div>";
    }).join("");
    if (!STREAMS.length) html += '<div class="panel"><p class="muted">Потоков пока нет. Создайте 4 потока и по 5 команд в каждом.</p></div>';
    box.innerHTML = html;

    if (canEdit) {
      var stBtn = box.querySelector("#stCreate");
      if (stBtn) stBtn.addEventListener("click", function () {
        var name = box.querySelector("#stName").value.trim();
        if (!name) return;
        api("/streams", { method: "POST", body: { name: name } }).then(reloadDicts).catch(function (e) { alert(e.message); });
      });
      var tmBtn = box.querySelector("#tmCreate");
      if (tmBtn) tmBtn.addEventListener("click", function () {
        var name = box.querySelector("#tmName").value.trim();
        if (!name) return;
        api("/teams", { method: "POST", body: { stream_id: Number(box.querySelector("#tmStream").value), name: name } })
          .then(reloadDicts).catch(function (e) { alert(e.message); });
      });
      box.querySelectorAll("[data-setco]").forEach(function (b) {
        b.addEventListener("click", function () {
          var pid = prompt("ID профиля будущего координатора (колонка в «Участниках», открой карточку — id в адресе запроса; или спроси у разработчика):");
          if (!pid) return;
          api("/streams/" + b.getAttribute("data-setco"), { method: "PATCH", body: { coordinator_profile_id: Number(pid) } })
            .then(reloadDicts).catch(function (e) { alert(e.message); });
        });
      });
      box.querySelectorAll("[data-settl]").forEach(function (b) {
        b.addEventListener("click", function () {
          var pid = prompt("ID профиля будущего тимлида:");
          if (!pid) return;
          api("/teams/" + b.getAttribute("data-settl"), { method: "PATCH", body: { teamlead_profile_id: Number(pid) } })
            .then(reloadDicts).catch(function (e) { alert(e.message); });
        });
      });
    }

    function reloadDicts() {
      api("/streams").then(function (r) {
        STREAMS = r.streams; TEAMS = r.teams;
        renderStructure();
      });
    }
  }
})();
