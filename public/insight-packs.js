// State
const state = {
  packs: [],
  currentPack: null,
  canManage: false,
  activeCategory: "all"
};

// DOM Elements
const statusEl = document.getElementById("insightPacksStatus");
const listView = document.getElementById("insightPacksListView");
const detailView = document.getElementById("insightPackDetailView");
const packsGrid = document.getElementById("packsGrid");
const togglePackFormBtn = document.getElementById("togglePackFormBtn");
const packFormPanel = document.getElementById("packFormPanel");
const packFormTitle = document.getElementById("packFormTitle");
const cancelPackFormBtn = document.getElementById("cancelPackFormBtn");
const packsFilters = document.getElementById("packsFilters");

// Detail DOM Elements
const backToPacksBtn = document.getElementById("backToPacksBtn");
const detailCategory = document.getElementById("detailCategory");
const detailTitle = document.getElementById("detailTitle");
const detailMarkdownContent = document.getElementById("detailMarkdownContent");
const detailAudioPlayer = document.getElementById("detailAudioPlayer");
const packAudioElement = document.getElementById("packAudioElement");
const playerPlayBtn = document.getElementById("playerPlayBtn");
const playIcon = document.getElementById("playIcon");
const pauseIcon = document.getElementById("pauseIcon");
const playerTimeline = document.getElementById("playerTimeline");
const playerCurrentTime = document.getElementById("playerCurrentTime");
const playerDuration = document.getElementById("playerDuration");
const playerVolume = document.getElementById("playerVolume");
const detailTakeawaysContainer = document.getElementById("detailTakeawaysContainer");
const detailTakeawaysList = document.getElementById("detailTakeawaysList");
const detailMindmapSection = document.getElementById("detailMindmapSection");
const detailMindmapImg = document.getElementById("detailMindmapImg");
const detailFlashcardsSection = document.getElementById("detailFlashcardsSection");
const detailFlashcardsGrid = document.getElementById("detailFlashcardsGrid");
const detailQuizSection = document.getElementById("detailQuizSection");
const detailQuizContainer = document.getElementById("detailQuizContainer");
const packAdminActionsBar = document.getElementById("packAdminActionsBar");
const editPackBtn = document.getElementById("editPackBtn");
const deletePackBtn = document.getElementById("deletePackBtn");

// Helper: Format Time
function formatTime(seconds) {
  if (isNaN(seconds) || seconds === Infinity) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// Helper: Set status message
function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ef4444" : "#10b981";
  statusEl.style.display = message ? "block" : "none";
  if (message) {
    statusEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

// Extract Takeaways Bullet Points from Markdown
function extractTakeaways(markdown) {
  const lines = markdown.split("\n");
  const takeaways = [];
  let inTakeaways = false;
  
  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") && (trimmed.toLowerCase().includes("инсайт") || trimmed.toLowerCase().includes("takeaway") || trimmed.toLowerCase().includes("вывод"))) {
      inTakeaways = true;
      continue;
    }
    if (inTakeaways) {
      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        takeaways.push(trimmed.substring(1).trim());
      } else if (trimmed.startsWith("#") || (trimmed === "" && takeaways.length > 0)) {
        break;
      }
    }
  }
  return takeaways;
}

// Parse custom accent blockquotes (💡 Инсайт / ⚠️ Ошибка)
function parseCustomAccents(html) {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;
  
  const blockquotes = tempDiv.querySelectorAll("blockquote");
  blockquotes.forEach((bq) => {
    const text = bq.innerText.trim();
    if (text.startsWith("💡")) {
      const insightDiv = document.createElement("div");
      insightDiv.className = "markdown-insight";
      insightDiv.innerHTML = bq.innerHTML.replace(/^💡\s*/, "");
      bq.replaceWith(insightDiv);
    } else if (text.startsWith("⚠️")) {
      const mistakeDiv = document.createElement("div");
      mistakeDiv.className = "markdown-mistake";
      mistakeDiv.innerHTML = bq.innerHTML.replace(/^⚠️\s*/, "");
      bq.replaceWith(mistakeDiv);
    }
  });
  return tempDiv.innerHTML;
}

// Translate category key to display text
function getCategoryLabel(cat) {
  const labels = {
    management: "Менеджмент",
    design: "Дизайн",
    it: "ИТ",
    other: "Разное"
  };
  return labels[cat] || cat || "Разное";
}

// Render Packs List Grid
function renderPacksList() {
  if (!packsGrid) return;
  packsGrid.innerHTML = "";

  const filtered = state.packs.filter(p => state.activeCategory === "all" || p.category === state.activeCategory);

  if (filtered.length === 0) {
    packsGrid.innerHTML = `<p class="admin-analytics-empty" style="grid-column: 1/-1;">Нет доступных инсайт-паков в этой категории.</p>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  filtered.forEach(pack => {
    const card = document.createElement("div");
    card.className = "pack-card";
    card.addEventListener("click", () => loadSinglePack(pack.id));

    // Cover image container
    const cover = document.createElement("div");
    cover.className = "pack-card-cover";
    if (pack.cover_image_url) {
      cover.style.backgroundImage = `url('${pack.cover_image_url}')`;
    }
    card.appendChild(cover);

    // Card Body
    const body = document.createElement("div");
    body.className = "pack-card-body";

    const top = document.createElement("div");
    top.className = "pack-card-top";
    
    const catSpan = document.createElement("span");
    catSpan.className = "pack-category";
    catSpan.textContent = getCategoryLabel(pack.category);
    
    const titleH3 = document.createElement("h3");
    titleH3.textContent = pack.title;

    top.appendChild(catSpan);
    top.appendChild(titleH3);

    const bottom = document.createElement("div");
    bottom.className = "pack-card-bottom";

    const dateSpan = document.createElement("span");
    const d = new Date(pack.created_at);
    dateSpan.textContent = d.toLocaleDateString("ru-RU");

    const goSpan = document.createElement("span");
    goSpan.className = "pack-go-btn";
    goSpan.innerHTML = `Открыть <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`;

    bottom.appendChild(dateSpan);
    bottom.appendChild(goSpan);

    body.appendChild(top);
    body.appendChild(bottom);
    card.appendChild(body);

    fragment.appendChild(card);
  });

  packsGrid.appendChild(fragment);
}

// Show List / Detail views
function showListView() {
  listView.hidden = false;
  detailView.hidden = true;
  // Stop audio if playing
  if (packAudioElement) {
    packAudioElement.pause();
  }
}

function showDetailView() {
  listView.hidden = true;
  detailView.hidden = false;
}

// Render Single Pack
function renderSinglePack(pack) {
  detailCategory.textContent = getCategoryLabel(pack.category);
  detailTitle.textContent = pack.title;

  // Render Cover Image
  const detailCoverImg = document.getElementById("detailCoverImg");
  if (detailCoverImg) {
    if (pack.cover_image_url) {
      detailCoverImg.style.backgroundImage = `url('${pack.cover_image_url}')`;
      detailCoverImg.style.display = "block";
    } else {
      detailCoverImg.style.display = "none";
    }
  }

  // Render Markdown
  if (typeof marked !== "undefined") {
    let rawHtml = marked.parse(pack.content_markdown);
    detailMarkdownContent.innerHTML = parseCustomAccents(rawHtml);
  } else {
    detailMarkdownContent.innerHTML = `<p>${pack.content_markdown.replace(/\n/g, "<br>")}</p>`;
  }

  // Takeaways
  const takeaways = extractTakeaways(pack.content_markdown);
  if (takeaways.length > 0) {
    detailTakeawaysList.innerHTML = "";
    takeaways.forEach(item => {
      const li = document.createElement("li");
      li.textContent = item;
      detailTakeawaysList.appendChild(li);
    });
    detailTakeawaysContainer.style.display = "block";
  } else {
    detailTakeawaysContainer.style.display = "none";
  }

  // Audio player setup
  if (pack.audio_url) {
    packAudioElement.src = pack.audio_url;
    packAudioElement.load();
    detailAudioPlayer.style.display = "flex";
    playIcon.style.display = "block";
    pauseIcon.style.display = "none";
    playerCurrentTime.textContent = "00:00";
    playerDuration.textContent = "00:00";
    playerTimeline.value = 0;
  } else {
    detailAudioPlayer.style.display = "none";
    packAudioElement.src = "";
  }

  // Visual Schema (Mindmap)
  if (pack.image_url) {
    detailMindmapImg.src = pack.image_url;
    detailMindmapSection.style.display = "block";
  } else {
    detailMindmapSection.style.display = "none";
  }

  // Parse Quiz / Flashcards JSON
  let quizData = null;
  if (pack.quiz_json) {
    try {
      quizData = typeof pack.quiz_json === "string" ? JSON.parse(pack.quiz_json) : pack.quiz_json;
    } catch (e) {
      console.error("Quiz JSON parse error:", e);
    }
  }

  // Flashcards rendering
  if (quizData && Array.isArray(quizData.flashcards) && quizData.flashcards.length > 0) {
    detailFlashcardsGrid.innerHTML = "";
    quizData.flashcards.forEach(cardData => {
      const card = document.createElement("div");
      card.className = "flashcard";
      
      const inner = document.createElement("div");
      inner.className = "flashcard-inner";
      
      const front = document.createElement("div");
      front.className = "flashcard-front";
      front.textContent = cardData.term;
      
      const back = document.createElement("div");
      back.className = "flashcard-back";
      back.textContent = cardData.definition;
      
      inner.appendChild(front);
      inner.appendChild(back);
      card.appendChild(inner);

      card.addEventListener("click", () => {
        card.classList.toggle("flipped");
      });

      detailFlashcardsGrid.appendChild(card);
    });
    detailFlashcardsSection.style.display = "block";
  } else {
    detailFlashcardsSection.style.display = "none";
  }

  // Quiz rendering
  if (quizData && Array.isArray(quizData.quiz) && quizData.quiz.length > 0) {
    detailQuizContainer.innerHTML = "";
    quizData.quiz.forEach((q, qIndex) => {
      const qBlock = document.createElement("div");
      qBlock.className = "quiz-question-block";
      qBlock.style.marginBottom = "30px";

      const questionText = document.createElement("p");
      questionText.className = "quiz-question";
      questionText.textContent = `${qIndex + 1}. ${q.question}`;
      qBlock.appendChild(questionText);

      const optionsWrapper = document.createElement("div");
      optionsWrapper.className = "quiz-options";

      const explanationPanel = document.createElement("div");
      explanationPanel.className = "quiz-explanation";
      explanationPanel.textContent = q.explanation || "Верно!";
      explanationPanel.style.display = "none";

      q.options.forEach((opt, optIndex) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "quiz-option";
        btn.textContent = opt;

        btn.addEventListener("click", () => {
          // Check answer
          const isCorrect = optIndex === q.correct;
          btn.classList.add(isCorrect ? "correct" : "incorrect");
          
          // Disable all buttons for this question
          optionsWrapper.querySelectorAll(".quiz-option").forEach((b, bIdx) => {
            b.disabled = true;
            if (bIdx === q.correct && !isCorrect) {
              b.classList.add("correct"); // Highlight the correct one
            }
          });

          // Show explanation
          explanationPanel.style.display = "block";
        });

        optionsWrapper.appendChild(btn);
      });

      qBlock.appendChild(optionsWrapper);
      qBlock.appendChild(explanationPanel);
      detailQuizContainer.appendChild(qBlock);
    });
    detailQuizSection.style.display = "block";
  } else {
    detailQuizSection.style.display = "none";
  }

  // Manager Actions Panel
  if (state.canManage) {
    packAdminActionsBar.hidden = false;
  } else {
    packAdminActionsBar.hidden = true;
  }

  showDetailView();
}

// Audio Player Events Setup
function setupAudioPlayer() {
  if (!packAudioElement) return;

  playerPlayBtn.addEventListener("click", () => {
    if (packAudioElement.paused) {
      void packAudioElement.play();
      playIcon.style.display = "none";
      pauseIcon.style.display = "block";
    } else {
      packAudioElement.pause();
      playIcon.style.display = "block";
      pauseIcon.style.display = "none";
    }
  });

  packAudioElement.addEventListener("timeupdate", () => {
    const cur = packAudioElement.currentTime;
    const dur = packAudioElement.duration || 0;
    playerCurrentTime.textContent = formatTime(cur);
    if (dur > 0) {
      playerTimeline.value = Math.floor((cur / dur) * 100);
    }
  });

  packAudioElement.addEventListener("loadedmetadata", () => {
    playerDuration.textContent = formatTime(packAudioElement.duration);
  });

  // If already loaded
  if (packAudioElement.readyState >= 1) {
    playerDuration.textContent = formatTime(packAudioElement.duration);
  }

  playerTimeline.addEventListener("input", () => {
    const val = playerTimeline.value;
    const dur = packAudioElement.duration || 0;
    if (dur > 0) {
      packAudioElement.currentTime = (val / 100) * dur;
    }
  });

  playerVolume.addEventListener("input", () => {
    packAudioElement.volume = playerVolume.value / 100;
  });
}

// Client FileReader base64 loader
function bindFileInputToBase64(fileInput, hiddenInput, previewInfo) {
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) {
      previewInfo.textContent = "";
      return;
    }

    const sizeLimit = file.type.startsWith("audio") ? 100 * 1024 * 1024 : 4 * 1024 * 1024;
    if (file.size > sizeLimit) {
      alert(`Файл слишком большой. Максимальный размер: ${file.type.startsWith("audio") ? "100MB" : "4MB"}`);
      fileInput.value = "";
      previewInfo.textContent = "";
      return;
    }

    const reader = new FileReader();
    previewInfo.textContent = "Подготовка файла...";
    reader.onload = (event) => {
      hiddenInput.value = event.target.result;
      previewInfo.textContent = `Выбран файл: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    };
    reader.onerror = () => {
      alert("Ошибка при чтении файла.");
      previewInfo.textContent = "";
      fileInput.value = "";
    };
    reader.readAsDataURL(file);
  });
}

// Reset Pack form fields
function resetPackForm() {
  packFormPanel.reset();
  packFormPanel.querySelector('input[name="id"]').value = "";
  packFormPanel.querySelector('input[name="cover_image_url"]').value = "";
  packFormPanel.querySelector('input[name="image_url"]').value = "";
  packFormPanel.querySelector('input[name="audio_url"]').value = "";

  document.getElementById("coverImagePreviewInfo").textContent = "";
  document.getElementById("mindmapPreviewInfo").textContent = "";
  document.getElementById("audioPreviewInfo").textContent = "";

  document.getElementById("packCoverImageFileInput").value = "";
  document.getElementById("packMindmapFileInput").value = "";
  document.getElementById("packAudioFileInput").value = "";
}

// API: Fetch All Packs
async function loadPacks() {
  setStatus("Загрузка паков...");
  try {
    const response = await fetch("/api/insight-packs", {
      credentials: "include",
      headers: { Accept: "application/json" }
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Не удалось загрузить Insight Packs");
    }

    state.packs = payload.packs || [];
    state.canManage = payload.canManage === true;

    if (state.canManage) {
      togglePackFormBtn.hidden = false;
    } else {
      togglePackFormBtn.hidden = true;
    }

    renderPacksList();
    setStatus("");
  } catch (err) {
    setStatus(err.message, true);
  }
}

// API: Load Single Pack
async function loadSinglePack(id) {
  setStatus("Загрузка конспекта...");
  try {
    const response = await fetch(`/api/insight-packs/${id}`, {
      credentials: "include",
      headers: { Accept: "application/json" }
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Не удалось загрузить пак");
    }

    state.currentPack = payload.pack;
    state.canManage = payload.canManage === true;

    // Set URL
    const url = new URL(window.location);
    url.searchParams.set("id", id);
    history.pushState(null, "", url);

    renderSinglePack(state.currentPack);
    setStatus("");
  } catch (err) {
    setStatus(err.message, true);
    showListView();
  }
}

// API: Save Pack (Create or Update)
async function savePack(formData) {
  setStatus("Сохранение...");
  try {
    const response = await fetch("/api/admin/insight-packs", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(formData)
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Не удалось сохранить Insight Pack.");
    }
    
    setStatus("");
    alert("Insight Pack успешно сохранен.");
    packFormPanel.hidden = true;
    resetPackForm();
    
    // Refresh
    await loadPacks();
    if (state.currentPack && state.currentPack.id === formData.id) {
      void loadSinglePack(formData.id);
    }
  } catch (err) {
    setStatus(err.message, true);
  }
}

// API: Delete Pack
async function deletePack(id) {
  const confirmed = confirm("Вы уверены, что хотите полностью удалить этот Insight Pack?");
  if (!confirmed) return;

  setStatus("Удаление...");
  try {
    const response = await fetch(`/api/admin/insight-packs/${id}`, {
      method: "DELETE",
      credentials: "include",
      headers: { Accept: "application/json" }
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Не удалось удалить пак.");
    }

    setStatus("");
    alert("Пак успешно удален.");
    state.currentPack = null;
    
    const url = new URL(window.location);
    url.searchParams.delete("id");
    history.pushState(null, "", url);

    showListView();
    void loadPacks();
  } catch (err) {
    setStatus(err.message, true);
  }
}

// Setup Form Elements and Listeners
function setupForms() {
  // Bind file input listeners to base64 handlers
  bindFileInputToBase64(
    document.getElementById("packCoverImageFileInput"),
    packFormPanel.querySelector('input[name="cover_image_url"]'),
    document.getElementById("coverImagePreviewInfo")
  );

  bindFileInputToBase64(
    document.getElementById("packMindmapFileInput"),
    packFormPanel.querySelector('input[name="image_url"]'),
    document.getElementById("mindmapPreviewInfo")
  );

  bindFileInputToBase64(
    document.getElementById("packAudioFileInput"),
    packFormPanel.querySelector('input[name="audio_url"]'),
    document.getElementById("audioPreviewInfo")
  );

  if (togglePackFormBtn) {
    togglePackFormBtn.addEventListener("click", () => {
      packFormTitle.textContent = "Новый Insight Pack";
      resetPackForm();
      
      const defaultQuizJson = {
        flashcards: [
          { term: "Термин", definition: "Его определение" }
        ],
        quiz: [
          {
            question: "Формулировка вопроса",
            options: ["Ответ A", "Ответ B", "Ответ C", "Ответ D"],
            correct: 0,
            explanation: "Разбор правильного ответа"
          }
        ]
      };
      packFormPanel.querySelector('textarea[name="quiz_json"]').value = JSON.stringify(defaultQuizJson, null, 2);
      packFormPanel.hidden = !packFormPanel.hidden;
    });
  }

  if (cancelPackFormBtn) {
    cancelPackFormBtn.addEventListener("click", () => {
      packFormPanel.hidden = true;
      resetPackForm();
    });
  }

  if (packFormPanel) {
    packFormPanel.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.target;
      const idVal = form.querySelector('input[name="id"]').value;
      const data = {
        id: idVal ? parseInt(idVal, 10) : null,
        title: form.querySelector('input[name="title"]').value,
        category: form.querySelector('select[name="category"]').value,
        audio_url: form.querySelector('input[name="audio_url"]').value,
        image_url: form.querySelector('input[name="image_url"]').value,
        cover_image_url: form.querySelector('input[name="cover_image_url"]').value,
        content_markdown: form.querySelector('textarea[name="content_markdown"]').value,
        quiz_json: form.querySelector('textarea[name="quiz_json"]').value
      };
      void savePack(data);
    });
  }

  if (editPackBtn) {
    editPackBtn.addEventListener("click", () => {
      if (!state.currentPack) return;
      const pack = state.currentPack;
      
      showListView();
      packFormTitle.textContent = "Редактирование Insight Pack";
      packFormPanel.hidden = false;
      resetPackForm();

      // Populate form
      packFormPanel.querySelector('input[name="id"]').value = pack.id;
      packFormPanel.querySelector('input[name="title"]').value = pack.title;
      packFormPanel.querySelector('select[name="category"]').value = pack.category || "other";
      
      packFormPanel.querySelector('input[name="audio_url"]').value = pack.audio_url || "";
      document.getElementById("audioPreviewInfo").textContent = pack.audio_url ? "Файл подкаста загружен и сохранен на сервере" : "";
      
      packFormPanel.querySelector('input[name="image_url"]').value = pack.image_url || "";
      document.getElementById("mindmapPreviewInfo").textContent = pack.image_url ? "Схема загружена и сохранена на сервере" : "";
      
      packFormPanel.querySelector('input[name="cover_image_url"]').value = pack.cover_image_url || "";
      document.getElementById("coverImagePreviewInfo").textContent = pack.cover_image_url ? "Обложка загружена и сохранена на сервере" : "";

      packFormPanel.querySelector('textarea[name="content_markdown"]').value = pack.content_markdown;
      
      const quizStr = typeof pack.quiz_json === "string" 
        ? pack.quiz_json 
        : JSON.stringify(pack.quiz_json, null, 2);
      packFormPanel.querySelector('textarea[name="quiz_json"]').value = quizStr || "";
    });
  }

  if (deletePackBtn) {
    deletePackBtn.addEventListener("click", () => {
      if (state.currentPack) {
        void deletePack(state.currentPack.id);
      }
    });
  }
}

// Setup Filters
function setupFilters() {
  if (!packsFilters) return;
  packsFilters.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter");
    if (!btn) return;

    packsFilters.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    state.activeCategory = btn.dataset.category;
    renderPacksList();
  });
}

// Back Button Navigation
if (backToPacksBtn) {
  backToPacksBtn.addEventListener("click", () => {
    const url = new URL(window.location);
    url.searchParams.delete("id");
    history.pushState(null, "", url);
    showListView();
  });
}

// Popstate URL navigation handler
window.addEventListener("popstate", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");
  if (id) {
    void loadSinglePack(id);
  } else {
    showListView();
    void loadPacks();
  }
});

// Init
document.addEventListener("DOMContentLoaded", () => {
  setupAudioPlayer();
  setupForms();
  setupFilters();

  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");
  
  if (id) {
    void loadSinglePack(id);
  } else {
    void loadPacks();
  }
});
