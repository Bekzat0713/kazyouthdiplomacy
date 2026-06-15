/* KazYouthDiplomacy — Mock Interview */
(function () {
  if (!document.body.classList.contains('interview-page')) return;

  /* ── Questions per program ──────────────────────────────────── */
  var QUESTIONS = {
    'college-of-europe': [
      'Почему вы хотите учиться именно в College of Europe, а не в другом европейском университете?',
      'Как ваш академический или профессиональный опыт связан с европейской интеграцией?',
      'Опишите ситуацию, когда вам пришлось работать в мультикультурной команде. Что вы из этого вынесли?',
      'Какую карьеру вы планируете после окончания College of Europe?',
      'Какую актуальную проблему ЕС вы считаете наиболее критичной и как бы вы её решали?',
    ],
    'un-volunteers': [
      'Что мотивирует вас заниматься волонтёрской деятельностью в системе ООН?',
      'Расскажите о конкретном опыте, где вы внесли вклад в развитие сообщества или решение социальных проблем.',
      'Как вы адаптируетесь к работе в условиях ограниченных ресурсов и высокой неопределённости?',
      'Один из целей ООН — устойчивое развитие. Какую из 17 целей SDG вы считаете приоритетной для Казахстана и почему?',
      'Опишите ситуацию, когда вам нужно было убедить других принять важное решение. Как вы это сделали?',
    ],
    'osce-academy': [
      'Почему вы хотите специализироваться на политике и безопасности в Центральной Азии?',
      'Какие, на ваш взгляд, ключевые угрозы безопасности в регионе ЦА в ближайшие 5 лет?',
      'Как ваш опыт или академический бэкграунд готовит вас к изучению вопросов управления и безопасности?',
      'OSCE работает над диалогом между правительствами и гражданским обществом. Какой опыт взаимодействия с госструктурами или НКО у вас есть?',
      'Опишите исследовательский проект или работу, которую вы хотели бы провести в рамках программы OSCE Academy.',
    ],
    'erasmus-mundus': [
      'Почему вы выбрали именно эту Erasmus Mundus программу среди множества других?',
      'Как совместная европейская степень поможет вашим карьерным целям?',
      'Опишите ваш исследовательский интерес и как он соотносится с тематикой программы.',
      'Расскажите об опыте, когда вам нужно было быстро адаптироваться к новой академической или культурной среде.',
      'Чем вы планируете заниматься после окончания программы — академической карьерой или практической деятельностью?',
    ],
    'daad': [
      'Почему вы хотите продолжить обучение или исследование именно в Германии?',
      'Опишите ваш исследовательский проект или академическую цель, для которой вам нужна стипендия DAAD.',
      'Какой у вас уровень немецкого языка и как вы планируете его развивать?',
      'Расскажите о вашей научной или профессиональной деятельности, которая делает вас конкурентоспособным кандидатом.',
      'Как полученные знания в Германии вы планируете применить в Казахстане или на международном уровне?',
    ],
    'chevening': [
      'Chevening ищет будущих лидеров. Приведите конкретный пример, где вы проявили лидерство.',
      'Как обучение в Великобритании поможет вам достичь ваших долгосрочных карьерных целей?',
      'Опишите проблему в вашей стране или области, которую вы хотите решить с помощью полученных знаний.',
      'Расскажите о сети контактов, которую вы уже выстраиваете, и как Chevening её расширит.',
      'Почему именно сейчас — самое подходящее время для получения стипендии Chevening в вашей карьере?',
    ],
  };

  var TOTAL_Q = 5;

  /* ── State ─────────────────────────────────────────────────── */
  var state = {
    program: null,
    programName: '',
    programFlag: '',
    qIndex: 0,
    answers: [],        /* [{question, answer}] */
    waitingForAnswer: false,
  };

  /* ── DOM refs ──────────────────────────────────────────────── */
  var stageSelect   = document.getElementById('ivStageSelect');
  var stageChat     = document.getElementById('ivStageChat');
  var stageResult   = document.getElementById('ivStageResult');

  var programCards  = document.querySelectorAll('.iv-program-card');
  var backBtn       = document.getElementById('ivBackBtn');
  var chatProgramFlag = document.getElementById('ivChatProgramFlag');
  var chatProgramName = document.getElementById('ivChatProgramName');
  var progressFill  = document.getElementById('ivProgressFill');
  var progressLabel = document.getElementById('ivProgressLabel');

  var messagesEl    = document.getElementById('ivMessages');
  var formEl        = document.getElementById('ivForm');
  var inputEl       = document.getElementById('ivInput');
  var submitBtn     = document.getElementById('ivSubmit');
  var formWrap      = document.getElementById('ivFormWrap');

  var analysisLoading = document.getElementById('ivAnalysisLoading');
  var analysisContent = document.getElementById('ivAnalysisContent');
  var certBlock     = document.getElementById('ivCertBlock');
  var certCanvas    = document.getElementById('ivCertCanvas');
  var downloadBtn   = document.getElementById('ivDownloadCert');
  var shareBtn      = document.getElementById('ivShareCert');
  var tryAgainBtn   = document.getElementById('ivTryAgainBtn');

  var scoreNumber   = document.getElementById('ivScoreNumber');
  var scoreStrong   = document.getElementById('ivScoreStrong');
  var scoreImprove  = document.getElementById('ivScoreImprove');

  /* ── Helpers ───────────────────────────────────────────────── */
  function showStage(name) {
    [stageSelect, stageChat, stageResult].forEach(function (el) {
      el.hidden = (el.dataset.stage !== name);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function appendMessage(role, text, qLabel) {
    var article = document.createElement('article');
    article.className = 'iv-msg iv-msg--' + role;

    var badge = document.createElement('span');
    badge.className = 'iv-msg-badge';
    badge.textContent = role === 'ai' ? 'AI' : 'Я';
    badge.setAttribute('aria-hidden', 'true');

    var body = document.createElement('div');
    body.className = 'iv-msg-body';

    if (qLabel) {
      var label = document.createElement('span');
      label.className = 'iv-msg-question-label';
      label.textContent = qLabel;
      body.appendChild(label);
    }

    var textEl = document.createElement('p');
    textEl.className = 'iv-msg-text';
    textEl.textContent = text;
    body.appendChild(textEl);

    article.appendChild(badge);
    article.appendChild(body);
    messagesEl.appendChild(article);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return textEl;
  }

  function showTyping() {
    var wrap = document.createElement('div');
    wrap.className = 'iv-msg iv-msg--ai';
    wrap.id = 'ivTypingMsg';

    var badge = document.createElement('span');
    badge.className = 'iv-msg-badge';
    badge.textContent = 'AI';
    badge.setAttribute('aria-hidden', 'true');

    var typing = document.createElement('div');
    typing.className = 'iv-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';

    wrap.appendChild(badge);
    wrap.appendChild(typing);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return wrap;
  }

  function removeTyping() {
    var el = document.getElementById('ivTypingMsg');
    if (el) el.remove();
  }

  function updateProgress(index) {
    var pct = (index / TOTAL_Q) * 100;
    progressFill.style.width = pct + '%';
    progressLabel.textContent = index + ' / ' + TOTAL_Q;
    progressFill.parentElement.setAttribute('aria-valuenow', index);
  }

  function setFormDisabled(disabled) {
    inputEl.disabled = disabled;
    submitBtn.disabled = disabled;
    submitBtn.textContent = disabled
      ? (getLangText('iv.thinking') || 'Обрабатываю...')
      : (getLangText('iv.submit') || 'Ответить');
  }

  function getLangText(key) {
    if (window.KYDi18n) {
      var lang = window.KYDi18n.getLang ? window.KYDi18n.getLang() : 'ru';
      return window.KYDi18n.t ? window.KYDi18n.t(key, lang) : null;
    }
    return null;
  }

  /* ── Start interview ────────────────────────────────────────── */
  function startInterview(card) {
    state.program = card.dataset.program;
    state.programName = card.dataset.programName;
    state.programFlag = card.dataset.programFlag;
    state.qIndex = 0;
    state.answers = [];
    state.waitingForAnswer = false;

    chatProgramFlag.textContent = state.programFlag;
    chatProgramName.textContent = state.programName;
    messagesEl.innerHTML = '';
    inputEl.value = '';
    updateProgress(0);

    showStage('chat');
    formWrap.hidden = false;
    setFormDisabled(false);

    /* Greeting */
    var greeting = getLangText('iv.greeting') ||
      'Привет! Я — AI-интервьюер KazYouthDiplomacy. Сегодня мы проведём симуляцию HR-собеседования для программы ' +
      state.programName + '. Я задам 5 вопросов, а после — разберу каждый ответ. Готов? Тогда начнём.';
    appendMessage('ai', greeting);

    setTimeout(function () { askQuestion(0); }, 800);
  }

  function askQuestion(index) {
    var questions = QUESTIONS[state.program] || [];
    if (index >= questions.length) {
      finishInterview();
      return;
    }
    state.qIndex = index;
    state.waitingForAnswer = true;
    var label = (getLangText('iv.q_label') || 'Вопрос') + ' ' + (index + 1) + ' / ' + TOTAL_Q;
    appendMessage('ai', questions[index], label);
    updateProgress(index);
    inputEl.focus();
  }

  /* ── Handle answer ─────────────────────────────────────────── */
  formEl.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = inputEl.value.trim();
    if (!text || !state.waitingForAnswer) return;

    state.waitingForAnswer = false;
    appendMessage('user', text);
    inputEl.value = '';

    var questions = QUESTIONS[state.program] || [];
    state.answers.push({ question: questions[state.qIndex], answer: text });

    var nextIndex = state.qIndex + 1;
    updateProgress(nextIndex);

    if (nextIndex >= TOTAL_Q) {
      finishInterview();
    } else {
      setFormDisabled(true);
      var typing = showTyping();
      setTimeout(function () {
        removeTyping();
        setFormDisabled(false);
        askQuestion(nextIndex);
      }, 900);
    }
  });

  /* allow Ctrl+Enter / Cmd+Enter to submit */
  inputEl.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      formEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  });

  /* ── Finish & analyse ──────────────────────────────────────── */
  function finishInterview() {
    formWrap.hidden = true;
    var doneMsg = getLangText('iv.done_msg') ||
      'Отлично! Ты ответил на все 5 вопросов. Сейчас AI анализирует твои ответы — это займёт несколько секунд.';
    appendMessage('ai', doneMsg);

    setTimeout(function () {
      showStage('result');
      runAnalysis();
    }, 1200);
  }

  async function runAnalysis() {
    analysisLoading.hidden = false;
    analysisContent.hidden = true;
    certBlock.hidden = true;

    var systemPrompt =
      'Ты — опытный HR-эксперт программы ' + state.programName + '. ' +
      'Тебе дают транскрипт Mock Interview. ' +
      'Для каждого из 5 вопросов дай: ' +
      '1) Краткую оценку ("Сильный ответ" или "Нужно улучшить") ' +
      '2) 1-2 предложения конструктивной обратной связи на русском языке. ' +
      'Ответ строго в формате JSON-массива из 5 объектов: ' +
      '[{"rating":"strong"|"improve","feedback":"..."},...]. ' +
      'Только JSON, без дополнительного текста.';

    var userContent = state.answers.map(function (item, i) {
      return 'Q' + (i + 1) + ': ' + item.question + '\nA' + (i + 1) + ': ' + item.answer;
    }).join('\n\n');

    var parsed = null;
    try {
      var resp = await fetch('/api/assistant', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: 'dashboard',
          messages: [
            { role: 'user', content: systemPrompt + '\n\n---\n\n' + userContent },
          ],
        }),
      });

      if (resp.ok) {
        var data = await resp.json();
        var raw = (data.reply || '').trim();
        /* strip possible markdown code fences */
        raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
        try { parsed = JSON.parse(raw); } catch (_) { parsed = null; }
      }
    } catch (_) { parsed = null; }

    analysisLoading.hidden = true;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      /* fallback: show simple message */
      parsed = state.answers.map(function () {
        return { rating: 'improve', feedback: 'Анализ временно недоступен. Попробуйте снова позже.' };
      });
    }

    renderAnalysis(parsed);
  }

  function renderAnalysis(items) {
    var strongCount = 0;
    var improveCount = 0;
    analysisContent.innerHTML = '';

    items.forEach(function (item, i) {
      var isStrong = item.rating === 'strong';
      if (isStrong) strongCount++; else improveCount++;

      var block = document.createElement('div');
      block.className = 'iv-q-analysis ' + (isStrong ? 'strong' : 'improve');

      var qLabel = document.createElement('span');
      qLabel.className = 'iv-q-label';
      qLabel.textContent = (getLangText('iv.q_label') || 'Вопрос') + ' ' + (i + 1);
      block.appendChild(qLabel);

      var qQuestion = document.createElement('p');
      qQuestion.className = 'iv-q-question';
      qQuestion.textContent = state.answers[i] ? state.answers[i].question : '';
      block.appendChild(qQuestion);

      var qFeedback = document.createElement('p');
      qFeedback.className = 'iv-q-feedback';
      qFeedback.textContent = item.feedback || '';
      block.appendChild(qFeedback);

      var qRating = document.createElement('span');
      qRating.className = 'iv-q-rating ' + (isStrong ? 'strong' : 'improve');
      qRating.textContent = isStrong
        ? (getLangText('iv.rating.strong') || '✓ Сильный ответ')
        : (getLangText('iv.rating.improve') || '△ Можно улучшить');
      block.appendChild(qRating);

      analysisContent.appendChild(block);
    });

    /* scores */
    var pct = Math.round((strongCount / TOTAL_Q) * 100);
    scoreNumber.textContent = pct + '%';
    scoreStrong.textContent = strongCount;
    scoreImprove.textContent = improveCount;

    analysisContent.hidden = false;

    /* draw certificate */
    drawCertificate(pct, strongCount);
    certBlock.hidden = false;
  }

  /* ── Certificate (Canvas) ─────────────────────────────────── */
  /* polyfill roundRect for older browsers */
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      var radius = typeof r === 'number' ? r : (Array.isArray(r) ? r[0] : 0);
      this.beginPath();
      this.moveTo(x + radius, y);
      this.lineTo(x + w - radius, y);
      this.quadraticCurveTo(x + w, y, x + w, y + radius);
      this.lineTo(x + w, y + h - radius);
      this.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      this.lineTo(x + radius, y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - radius);
      this.lineTo(x, y + radius);
      this.quadraticCurveTo(x, y, x + radius, y);
      this.closePath();
    };
  }

  function drawCertificate(pct, strongCount) {
    var ctx = certCanvas.getContext('2d');
    var W = certCanvas.width;
    var H = certCanvas.height;

    /* Background */
    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0f1729');
    bg.addColorStop(1, '#1a2d5e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* Border glow */
    ctx.strokeStyle = 'rgba(59,130,246,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, W - 24, H - 24);

    /* Top accent bar */
    var accentGrad = ctx.createLinearGradient(0, 0, W, 0);
    accentGrad.addColorStop(0, '#3b82f6');
    accentGrad.addColorStop(1, '#6366f1');
    ctx.fillStyle = accentGrad;
    ctx.fillRect(0, 0, W, 5);

    /* Logo text */
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '600 13px "DM Sans", sans-serif';
    ctx.fillText('KazYouthDiplomacy', 40, 50);

    /* Kicker */
    ctx.fillStyle = '#3b82f6';
    ctx.font = '700 11px "DM Sans", sans-serif';
    ctx.fillText('MOCK INTERVIEW · CERTIFICATE OF COMPLETION', 40, 90);

    /* Title */
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '800 32px "Syne", sans-serif';
    ctx.fillText('Mock Interview', 40, 150);
    ctx.fillStyle = 'rgba(241,245,249,0.65)';
    ctx.font = '400 15px "DM Sans", sans-serif';
    ctx.fillText('AI-симуляция HR-собеседования для программы', 40, 178);

    /* Program name */
    ctx.fillStyle = '#93c5fd';
    ctx.font = '700 20px "Syne", sans-serif';
    ctx.fillText(state.programName, 40, 214);

    /* Score block */
    var scoreX = W - 220;
    var scoreY = 110;

    ctx.fillStyle = 'rgba(59,130,246,0.12)';
    ctx.beginPath();
    ctx.roundRect(scoreX, scoreY, 170, 120, 12);
    ctx.fill();

    ctx.strokeStyle = 'rgba(59,130,246,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(scoreX, scoreY, 170, 120, 12);
    ctx.stroke();

    ctx.fillStyle = '#3b82f6';
    ctx.font = '800 48px "Syne", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pct + '%', scoreX + 85, scoreY + 65);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '500 12px "DM Sans", sans-serif';
    ctx.fillText('Общий результат', scoreX + 85, scoreY + 90);
    ctx.fillText(strongCount + ' / 5 сильных ответов', scoreX + 85, scoreY + 110);
    ctx.textAlign = 'left';

    /* Divider */
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 260);
    ctx.lineTo(W - 40, 260);
    ctx.stroke();

    /* Bottom info */
    var now = new Date();
    var dateStr = now.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '400 12px "DM Sans", sans-serif';
    ctx.fillText('Дата: ' + dateStr, 40, 295);
    ctx.fillText('Платформа: kazyouthdiplomacy.com', 40, 316);

    /* Watermark */
    ctx.fillStyle = 'rgba(59,130,246,0.06)';
    ctx.font = '800 90px "Syne", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KYD', W / 2, H - 30);
    ctx.textAlign = 'left';
  }

  /* ── Download certificate ─────────────────────────────────── */
  downloadBtn.addEventListener('click', function () {
    var link = document.createElement('a');
    link.download = 'KYD-MockInterview-' + state.programName.replace(/\s+/g, '-') + '.png';
    link.href = certCanvas.toDataURL('image/png');
    link.click();
  });

  shareBtn.addEventListener('click', function () {
    if (navigator.share) {
      certCanvas.toBlob(async function (blob) {
        try {
          await navigator.share({
            title: 'Mock Interview — ' + state.programName,
            text: 'Прошёл AI Mock Interview для ' + state.programName + ' на KazYouthDiplomacy!',
            files: [new File([blob], 'mock-interview-cert.png', { type: 'image/png' })],
          });
        } catch (_) { /* user cancelled */ }
      });
    } else {
      downloadBtn.click();
    }
  });

  /* ── Back / Try again ─────────────────────────────────────── */
  backBtn.addEventListener('click', function () {
    showStage('select');
  });

  tryAgainBtn.addEventListener('click', function () {
    showStage('select');
  });

  /* ── Wire program cards ─────────────────────────────────────── */
  programCards.forEach(function (card) {
    card.addEventListener('click', function () { startInterview(card); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startInterview(card); }
    });
  });

  /* ── Auth-aware nav (reuse pattern from web.js) ────────────── */
  (async function syncNav() {
    try {
      var r = await fetch('/api/home-state', { credentials: 'include' });
      if (!r.ok) return;
      var data = await r.json();
      var loggedIn = data.isAuthenticated;
      var loginBtn = document.getElementById('homeNavLogin');
      var dashBtn  = document.getElementById('homeNavDashboard');
      var logoutForm = document.getElementById('homeNavLogoutForm');
      if (loginBtn)   loginBtn.hidden   = loggedIn;
      if (dashBtn)    dashBtn.hidden    = !loggedIn;
      if (logoutForm) logoutForm.hidden = !loggedIn;
    } catch (_) {}
  })();

})();
