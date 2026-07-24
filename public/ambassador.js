/* "Стать амбассадором" landing: bot deep-link + RU/KZ toggle. */
(function () {
  "use strict";

  var config = window.__APP_CONFIG__ || {};
  var botUsername = config.tgBotUsername || "";
  var botUrl = botUsername
    ? "https://t.me/" + botUsername + "?start=site"
    : "#bot-not-configured";

  document.querySelectorAll(".js-bot-link").forEach(function (a) {
    a.href = botUrl;
    if (!botUsername) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        alert("Telegram-бот скоро откроется — следите за анонсами!");
      });
    }
  });

  /* KZ translations keyed by data-i18n. RU is the markup default.
     NOTE: KZ texts must be proofread by a native speaker before launch. */
  var KZ = {
    back: "← Басты бетке",
    kicker: "Амбассадорлық бағдарлама",
    hero_h1: "<em>KazYouthDiplomacy</em> амбассадоры бол",
    hero_sub: "Жас көшбасшылар қауымдастығы: дипломатия, бизнес, медиа және әлеуметтік жобалар. Дамы, форумдарға қатыс және мансаптық мүмкіндіктерді аш.",
    cta: "Амбассадор болу →",
    cta2: "Telegram-да бастау →",
    proof: "<b>370+</b> амбассадор · <b>35 000+</b> аудитория · мемлекеттік органдар мен дипмиссиялар арасында серіктестер",
    who_h: "Амбассадор деген кім?",
    who_p: "KazYouthDiplomacy амбассадоры — өз дағдыларын дамытатын, ұйым жобаларына қатысатын және білім беру, мансаптық, қоғамдық және халықаралық мүмкіндіктерге қол жеткізетін жастар қауымдастығының мүшесі.",
    get_h: "Сен не аласың",
    b1_h: "Core Skills оқуы", b1_p: "Көшбасшылық, тәлімгерлік, коммуникация, тілдер және икемді дағдылар.",
    b2_h: "Career GPS", b2_p: "Вакансиялар, тағылымдамалар және мансаптық қолдауға қолжетімділік.",
    b3_h: "Көшбасшылармен кездесулер", b3_p: "Дипломаттар, бизнесмендер, мемлекеттік органдар мен ҮЕҰ өкілдері.",
    b4_h: "Форумдар мен іс-шаралар", b4_p: "Бизнес-таңғы астар, дипломатиялық кештер, қонақ дәрістер.",
    b5_h: "Кәсіби тректер", b5_p: "Таңдаған бағыттарда даму — дипломатиядан IT-ға дейін.",
    b6_h: "Сертификаттар мен ұсыныстар", b6_p: "Расталған жетістіктер және ұсыныс хаттар.",
    b7_h: "Мансаптық өсу", b7_p: "Нақты басқару тәжірибесі: тимлид → ағым координаторы.",
    b8_h: "Қауымдастық", b8_p: "Бүкіл Қазақстан бойынша пікірлестер және alumni-желі.",
    note: "Белсенді амбассадорлар конкурстарға, тағылымдамаларға, іс-шараларға және мансаптық мүмкіндіктерге басым қолжетімділік алады.",
    tracks_h: "11 кәсіби бағыт",
    t1: "Дипломатия және ХҚ", t2: "Мемлекеттік қызмет", t3: "Бизнес", t4: "Медиа және SMM",
    t5: "Іс-шаралар", t6: "Білім беру", t7: "Әлеуметтік жобалар", t8: "Волонтерлік",
    t9: "Мансап және HR", t10: "IT", t11: "Техникалық мамандықтар",
    tracks_p: "Бір негізгі және екіге дейін қосымша бағыт таңдайсың.",
    expect_h: "Сенен не күтіледі",
    expect_p: "Тұрақты белсенділік, тапсырмаларды орындау, іс-шараларға қатысу, апталық шағын есептер (2 минут), сыйластықпен қарым-қатынас және ұйымды кәсіби түрде таныту. Аптасына 1–3 сағат жеткілікті.",
    how_h: "Амбассадор қалай болуға болады",
    s1: "Telegram-ботқа өт", s2: "Сауалнаманы толтыр (5–7 минут)", s3: "Кәсіби бағыттарды таңда",
    s4: "Кіріспе тапсырманы орында", s5: "Шешімді күт (5–7 күн)", s6: "Кіріспе оқудан өт",
    s7: "Ағым, команда және тимлид ал",
    ladder_h: "Өсу жолы",
    ladder_p: "Тимлидтер мен координаторлар резюмеге нақты басқару тәжірибесін алады.",
    l1: "Кандидат", l2: "Тағылымдамашы", l3: "Амбассадор", l4: "Белсенді", l5: "Аға",
    l6: "Тимлид", l7: "Координатор",
    f1_q: "Бұл ақылы ма?", f1_a: "Жоқ, бағдарламаға қатысу тегін.",
    f2_q: "Мен 16 жастамын — қатыса аламын ба?", f2_a: "Иә, заңды өкілдің (ата-ананың) келісімімен.",
    f3_q: "Мен жұмыс істеймін, уақытым аз.", f3_a: "Аптасына 1–3 сағат жеткілікті — тапсырмалар мен есептер аз уақыт алады.",
    f4_q: "Мен Астана немесе Алматыдан емеспін.", f4_a: "Бағдарлама онлайн жұмыс істейді, іс-шаралар аймақтарда да өтеді.",
    f5_q: "Жұмысқа немесе тағылымдамаға кепілдік бересіздер ме?", f5_a: "Жоқ. Белсенді амбассадорлар мүмкіндіктерге басым қолжетімділік алады, бірақ іріктеуді әрқашан жұмыс беруші жүргізеді.",
    f6_q: "Мен қазірдің өзінде амбассадормын — не істеуім керек?", f6_a: "Амбассадорлар тобындағы сілтеме арқылы қысқа верификациядан өт — 3 минут алады.",
    f7_q: "Бағдарлама қай тілде?", f7_a: "Қазақша және орысша — тіл ботта таңдалады.",
    final_h: "Қосылуға дайынсың ба?",
    legal: "Батырманы басу арқылы Telegram-ботқа өтесің. <a href=\"/about.html\">Жеке деректер саясаты</a> · <a href=\"/about.html\">Қауымдастық ережелері</a>",
  };

  var RU = {}; // captured from markup on first switch

  function applyLang(lang) {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (!(key in RU)) RU[key] = el.innerHTML;
      if (lang === "kz" && KZ[key]) el.innerHTML = KZ[key];
      if (lang === "ru") el.innerHTML = RU[key];
    });
    document.documentElement.lang = lang === "kz" ? "kk" : "ru";
    document.querySelectorAll(".lang-toggle button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-lang") === lang);
    });
    try { localStorage.setItem("amb_lang", lang); } catch (e) {}
  }

  document.querySelectorAll(".lang-toggle button").forEach(function (b) {
    b.addEventListener("click", function () {
      applyLang(b.getAttribute("data-lang"));
    });
  });

  var saved = null;
  try { saved = localStorage.getItem("amb_lang"); } catch (e) {}
  if (saved === "kz") applyLang("kz");

  /* Only one FAQ item open at a time. */
  var faqs = document.querySelectorAll("details");
  faqs.forEach(function (d) {
    d.addEventListener("toggle", function () {
      if (d.open) faqs.forEach(function (o) { if (o !== d) o.open = false; });
    });
  });
})();
