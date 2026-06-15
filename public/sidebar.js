document.addEventListener("DOMContentLoaded", function () {
  var sidebarContainer = document.querySelector(".dashboard-left-sidebar");
  if (!sidebarContainer) {
    return;
  }

  // Sidebar HTML structure
  var html = 
    '<div class="sidebar-brand-section">' +
      '<a href="/" class="sidebar-logo" aria-label="KazYouthDiplomacy">' +
        '<img src="/logo.png" alt="KazYouth logo" />' +
        '<span>KazYouth</span>' +
      '</a>' +
      '<button class="sidebar-search-trigger" type="button" aria-label="Поиск">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>' +
        '</svg>' +
      '</button>' +
    '</div>' +
    '<nav class="sidebar-nav">' +
      '<a href="/dashboard" class="sidebar-nav-item" data-sidebar-link="dashboard">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>' +
        '<span>Кабинет</span>' +
      '</a>' +
      '<a href="/internships" class="sidebar-nav-item" data-sidebar-link="internships">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>' +
        '<span>Стажировки</span>' +
      '</a>' +
      '<a href="/opportunities" class="sidebar-nav-item" data-sidebar-link="opportunities">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>' +
        '<span>Возможности</span>' +
      '</a>' +
      '<a href="/resources" class="sidebar-nav-item" data-sidebar-link="resources">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>' +
        '<span>Материалы</span>' +
      '</a>' +
      '<a href="/career-profile" class="sidebar-nav-item" data-sidebar-link="career-profile">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>' +
        '<span>Career Profile</span>' +
      '</a>' +
      '<a href="/interview" class="sidebar-nav-item" data-sidebar-link="interview">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' +
        '<span>AI Интервью</span>' +
      '</a>' +
      '<a href="/subscribe" class="sidebar-nav-item" data-sidebar-link="subscribe">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>' +
        '<span>Подписка</span>' +
      '</a>' +
    '</nav>' +
    '<div class="sidebar-section-header">ACCOUNT</div>' +
    '<nav class="sidebar-nav account-nav">' +
      '<a href="/profile" class="sidebar-nav-item" data-sidebar-link="profile">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>' +
        '<span>Профиль</span>' +
      '</a>' +
    '</nav>' +
    '<div class="sidebar-user-footer" id="sidebarUserFooter">' +
      '<div class="loading-dots">Загрузка...</div>' +
    '</div>';

  sidebarContainer.innerHTML = html;

  // Highlight active link based on current path
  var pathname = window.location.pathname;
  var items = sidebarContainer.querySelectorAll("[data-sidebar-link]");
  items.forEach(function (item) {
    var key = item.getAttribute("data-sidebar-link");
    if (pathname.includes(key) || (key === "dashboard" && pathname === "/dashboard")) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Load user profile information
  fetch("/api/career-profile", { credentials: "include" })
    .then(function (res) {
      if (res.status === 401) {
        throw new Error("Guest session");
      }
      if (!res.ok) {
        throw new Error("HTTP error " + res.status);
      }
      return res.json();
    })
    .then(function (data) {
      var footer = document.getElementById("sidebarUserFooter");
      if (!footer) return;

      var firstName = data.first_name || "";
      var lastName = data.last_name || "";
      var fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || "Пользователь";
      var email = data.email || "kazyouth@mail.kz";
      var initials = [firstName, lastName]
        .filter(Boolean)
        .map(function (s) { return s.charAt(0).toUpperCase(); })
        .join("");
      if (!initials) initials = fullName.charAt(0).toUpperCase() || "U";

      footer.innerHTML = 
        '<div class="user-avatar-initials-circle">' + initials + '</div>' +
        '<div class="user-info-text">' +
          '<span class="user-name">' + fullName + '</span>' +
          '<span class="user-email">' + email + '</span>' +
        '</div>' +
        '<form method="POST" action="/logout" class="logout-form">' +
          '<button class="btn-logout-trigger" type="submit" aria-label="Выйти">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>' +
              '<polyline points="16 17 21 12 16 7"></polyline>' +
              '<line x1="21" y1="12" x2="9" y2="12"></line>' +
            '</svg>' +
          '</button>' +
        '</form>';
    })
    .catch(function () {
      var footer = document.getElementById("sidebarUserFooter");
      if (!footer) return;

      // Guest buttons: Войти & Регистрация
      footer.classList.add("guest-mode");
      footer.innerHTML = 
        '<a href="/login" class="btn-guest-auth login">Войти</a>' +
        '<a href="/register" class="btn-guest-auth register">Регистрация</a>';
    });
});
