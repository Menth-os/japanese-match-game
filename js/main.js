// -------------------------
// GLOBAL STATE
// -------------------------
let vocab = [];
let questions = [];
let currentIndex = 0;
let currentQuestion = null;
let selectedOptionId = null;
let dragAssignments = {};
let hasChecked = false;

let correctCount = 0;
let wrongCount = 0;

let hardMode = false;
let timerInterval = null;
let timeLeft = 120;

let tapSelectedAnswer = null; // NEW: tap-to-select answer

const QUESTION_COUNT = 20;

// -------------------------
// ELEMENTS
// -------------------------
const startScreen = document.getElementById("start-screen");
const gameScreen = document.getElementById("game-screen");
const endScreen = document.getElementById("end-screen");

const startNormalBtn = document.getElementById("start-normal");
const startHardBtn = document.getElementById("start-hard");
const restartBtn = document.getElementById("restart-btn");

const backBtn = document.getElementById("back-btn");
const checkBtn = document.getElementById("check-btn");
const nextBtn = document.getElementById("next-btn");

const gameArea = document.getElementById("game-area");
const feedbackEl = document.getElementById("feedback");
const questionNumberEl = document.getElementById("question-number");
const questionTotalEl = document.getElementById("question-total");

const timerEl = document.getElementById("timer");
const langSelect = document.getElementById("lang");

// -------------------------
// LANGUAGE STRINGS
// -------------------------
const STRINGS = {
  en: {
    start_title: "Ready to play?",
    start_sub: "Test your Japanese vocabulary.",
    start_normal: "Start",
    start_hard: "Start Hard Mode (2 min)",
    back_btn: "← Back to Menu",
    question: "Question",
    check: "Check",
    next: "Next",
    end_title: "Finished!",
    correct: "Correct:",
    wrong: "Wrong:",
    restart: "Restart"
  },
  de: {
    start_title: "Bereit zu spielen?",
    start_sub: "Teste deinen japanischen Wortschatz.",
    start_normal: "Starten",
    start_hard: "Schwerer Modus (2 Min)",
    back_btn: "← Zurück zum Menü",
    question: "Frage",
    check: "Prüfen",
    next: "Weiter",
    end_title: "Fertig!",
    correct: "Richtig:",
    wrong: "Falsch:",
    restart: "Neu starten"
  }
};

function updateLanguage() {
  const lang = langSelect.value;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = STRINGS[lang][el.dataset.i18n];
  });
}
langSelect.addEventListener("change", updateLanguage);

// -------------------------
// LOAD VOCAB
// -------------------------
fetch("data/vocab.json")
  .then(res => res.json())
  .then(data => {
    vocab = data;
    updateLanguage();
  });

// -------------------------
// START GAME
// -------------------------
startNormalBtn.addEventListener("click", () => startGame(false));
startHardBtn.addEventListener("click", () => startGame(true));

function startGame(isHard) {
  hardMode = isHard;
  correctCount = 0;
  wrongCount = 0;

  questions = buildQuestions(QUESTION_COUNT);
  currentIndex = 0;

  questionTotalEl.textContent = questions.length;

  switchScreen("game");
  loadQuestion();

  if (hardMode) startTimer();
}

// -------------------------
// TIMER
// -------------------------
function startTimer() {
  timeLeft = 120;
  timerEl.classList.remove("hidden");
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      finishGame();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const m = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const s = String(timeLeft % 60).padStart(2, "0");
  timerEl.textContent = `${m}:${s}`;
}

// -------------------------
// SCREEN SWITCHING
// -------------------------
function switchScreen(screen) {
  startScreen.classList.remove("active");
  gameScreen.classList.remove("active");
  endScreen.classList.remove("active");

  if (screen === "start") startScreen.classList.add("active");
  if (screen === "game") gameScreen.classList.add("active");
  if (screen === "end") endScreen.classList.add("active");
}

backBtn.addEventListener("click", () => {
  if (timerInterval) clearInterval(timerInterval);
  timerEl.classList.add("hidden");
  switchScreen("start");
});

// -------------------------
// BUILD QUESTIONS
// -------------------------
function buildQuestions(count) {
  const arr = [];
  let prevType = null;
  let streak = 0;

  for (let i = 0; i < count; i++) {
    let type;

    // FIXED: no more than 3 identical types in a row
    if (streak >= 3) {
      type = prevType === "single" ? "drag" : "single";
      streak = 1;
    } else {
      type = Math.random() < 0.5 ? "single" : "drag";
      streak = type === prevType ? streak + 1 : 1;
    }

    let q;
    let attempts = 0;
    let prev = arr[arr.length - 1] || null;

    do {
      if (type === "single") {
        const correct = vocab[Math.floor(Math.random() * vocab.length)];
        const distractors = pickRandomExcept(correct.id, 3);
        const options = shuffle([correct, ...distractors]);

        q = {
          type: "single",
          correctId: correct.id,
          image: correct.image,
          options: options.map(o => o.id)
        };
      } else {
        const group = pickRandom(4);
        q = {
          type: "drag",
          imageIds: group.map(v => v.id),
          optionIds: shuffle(group.map(v => v.id))
        };
      }

      attempts++;
      if (attempts > 10) break;
    } while (
      prev &&
      prev.type === q.type &&
      (
        (q.type === "single" && prev.correctId === q.correctId) ||
        (q.type === "drag" && sameSet(prev.imageIds, q.imageIds))
      )
    );

    arr.push(q);
    prevType = type;
  }

  return arr;
}

function sameSet(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return [...a].sort().join(",") === [...b].sort().join(",");
}

function pickRandom(n) {
  return shuffle([...vocab]).slice(0, n);
}

function pickRandomExcept(excludeId, n) {
  return shuffle(vocab.filter(v => v.id !== excludeId)).slice(0, n);
}

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

// -------------------------
// LOAD QUESTION
// -------------------------
function loadQuestion() {
  currentQuestion = questions[currentIndex];
  selectedOptionId = null;
  dragAssignments = {};
  tapSelectedAnswer = null;
  hasChecked = false;

  checkBtn.disabled = true;
  nextBtn.disabled = true;

  feedbackEl.textContent = "";
  feedbackEl.className = "feedback";

  questionNumberEl.textContent = currentIndex + 1;

  if (currentQuestion.type === "single") {
    renderSingleChoice();
  } else {
    renderDragDrop();
  }
}

// -------------------------
// SINGLE CHOICE
// -------------------------
function renderSingleChoice() {
  const q = currentQuestion;
  const correct = vocab.find(v => v.id === q.correctId);
  const options = q.options.map(id => vocab.find(v => v.id === id));

  gameArea.innerHTML = "";

  const layout = document.createElement("div");
  layout.className = "single-choice-layout";

  const imgBox = document.createElement("div");
  imgBox.className = "single-choice-image";

  const img = document.createElement("img");
  img.src = correct.image;
  img.alt = "";
  imgBox.appendChild(img);

  const overlay = document.createElement("div");
  overlay.className = "single-choice-overlay empty";
  overlay.id = "single-overlay";
  overlay.textContent = "…";
  imgBox.appendChild(overlay);

  const optBox = document.createElement("div");
  optBox.className = "single-choice-options";

  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.dataset.id = opt.id;

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = `${opt.kana}${opt.kanji ? " (" + opt.kanji + ")" : ""}`;

    btn.appendChild(label);

    btn.addEventListener("click", () => {
      if (hasChecked) return;

      document.querySelectorAll(".option-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");

      selectedOptionId = opt.id;

      overlay.textContent = label.textContent;
      overlay.classList.remove("empty");

      checkBtn.disabled = false;
    });

    optBox.appendChild(btn);
  });

  layout.appendChild(imgBox);
  layout.appendChild(optBox);
  gameArea.appendChild(layout);
}

function evaluateSingleChoice() {
  const correctId = currentQuestion.correctId;
  const buttons = document.querySelectorAll(".option-btn");

  let isCorrect = selectedOptionId === correctId;

  buttons.forEach(btn => {
    const id = btn.dataset.id;
    if (id === correctId) btn.classList.add("correct");
    if (id === selectedOptionId && id !== correctId) btn.classList.add("incorrect");
  });

  if (isCorrect) correctCount++;
  else wrongCount++;

  showFeedback(isCorrect);
}

// -------------------------
// DRAG & DROP + TAP-TO-ASSIGN
// -------------------------
function renderDragDrop() {
  const q = currentQuestion;

  gameArea.innerHTML = "";

  const layout = document.createElement("div");
  layout.className = "drag-drop-layout";

  const imgBox = document.createElement("div");
  imgBox.className = "drag-drop-images";

  q.imageIds.forEach(id => {
    const v = vocab.find(x => x.id === id);

    const zone = document.createElement("div");
    zone.className = "drop-zone";
    zone.dataset.imageId = id;

    const img = document.createElement("img");
    img.src = v.image;
    img.alt = "";
    zone.appendChild(img);

    const label = document.createElement("div");
    label.className = "drop-label empty";
    label.dataset.imageId = id;
    label.textContent = "…";
    zone.appendChild(label);

    const clearBtn = document.createElement("button");
    clearBtn.className = "drop-clear";
    clearBtn.dataset.imageId = id;
    clearBtn.textContent = "✕";
    clearBtn.addEventListener("click", () => {
      if (hasChecked) return;
      clearAssignmentForImage(id);
    });
    zone.appendChild(clearBtn);

    // Drag support
    zone.addEventListener("dragover", e => e.preventDefault());
    zone.addEventListener("drop", handleDropOnZone);

    // Tap-to-assign support
    zone.addEventListener("click", () => {
      if (hasChecked) return;
      if (!tapSelectedAnswer) return;

      assignAnswerToImage(tapSelectedAnswer, id);
      tapSelectedAnswer = null;
      updateDropUI();
    });

    imgBox.appendChild(zone);
  });

  const answers = document.createElement("div");
  answers.className = "drag-drop-answers";
  answers.id = "answers-container";

  q.optionIds.forEach(id => {
    const v = vocab.find(x => x.id === id);

    const card = document.createElement("div");
    card.className = "draggable-card";
    card.draggable = true;
    card.dataset.id = id;

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = `${v.kana}${v.kanji ? " (" + v.kanji + ")" : ""}`;

    card.appendChild(label);

    // Drag
    card.addEventListener("dragstart", e => {
      if (hasChecked) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData("text/plain", id);
    });

    // Tap-to-select
    card.addEventListener("click", () => {
      if (hasChecked) return;

      if (card.classList.contains("disabled")) return;

      tapSelectedAnswer = id;

      document.querySelectorAll(".draggable-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
    });

    answers.appendChild(card);
  });

  answers.addEventListener("dragover", e => e.preventDefault());
  answers.addEventListener("drop", handleDropOnAnswers);

  layout.appendChild(imgBox);
  layout.appendChild(answers);
  gameArea.appendChild(layout);
}

function assignAnswerToImage(vocabId, imageId) {
  for (const key in dragAssignments) {
    if (dragAssignments[key] === vocabId) {
      dragAssignments[key] = null;
    }
  }
  dragAssignments[imageId] = vocabId;
}

function handleDropOnZone(e) {
  if (hasChecked) return;

  const vocabId = e.dataTransfer.getData("text/plain");
  const imageId = e.currentTarget.dataset.imageId;

  if (!vocabId) return;

  assignAnswerToImage(vocabId, imageId);
  updateDropUI();
}

function handleDropOnAnswers(e) {
  if (hasChecked) return;

  const vocabId = e.dataTransfer.getData("text/plain");
  if (!vocabId) return;

  for (const key in dragAssignments) {
    if (dragAssignments[key] === vocabId) {
      dragAssignments[key] = null;
    }
  }

  updateDropUI();
}

function clearAssignmentForImage(imageId) {
  dragAssignments[imageId] = null;
  updateDropUI();
}

function updateDropUI() {
  const labels = gameArea.querySelectorAll(".drop-label");
  const clears = gameArea.querySelectorAll(".drop-clear");
  const cards = gameArea.querySelectorAll(".draggable-card");

  labels.forEach(l => {
    const imageId = l.dataset.imageId;
    const assigned = dragAssignments[imageId];

    if (assigned) {
      const v = vocab.find(x => x.id === assigned);
      l.textContent = `${v.kana}${v.kanji ? " (" + v.kanji + ")" : ""}`;
      l.classList.remove("empty");
    } else {
      l.textContent = "…";
      l.classList.add("empty");
      l.classList.remove("correct", "incorrect");
    }
  });

  clears.forEach(btn => {
    const imageId = btn.dataset.imageId;
    btn.classList.toggle("visible", !!dragAssignments[imageId]);
  });

  cards.forEach(card => {
    const id = card.dataset.id;
    const isUsed = Object.values(dragAssignments).includes(id);
    card.classList.toggle("disabled", isUsed);
    card.classList.remove("selected");
  });

  const allAssigned = currentQuestion.imageIds.every(id => dragAssignments[id]);
  checkBtn.disabled = !allAssigned;
}

function evaluateDragDrop() {
  let allCorrect = true;

  const labels = gameArea.querySelectorAll(".drop-label");

  labels.forEach(l => {
    const imageId = l.dataset.imageId;
    const assigned = dragAssignments[imageId];

    if (assigned === imageId) {
      l.classList.add("correct");
      l.classList.remove("incorrect");
    } else {
      l.classList.add("incorrect");
      l.classList.remove("correct");
      allCorrect = false;
    }
  });

  if (allCorrect) correctCount++;
  else wrongCount++;

  showFeedback(allCorrect);
}

// -------------------------
// CHECK & NEXT
// -------------------------
checkBtn.addEventListener("click", () => {
  if (hasChecked) return;
  hasChecked = true;

  if (currentQuestion.type === "single") evaluateSingleChoice();
  else evaluateDragDrop();

  checkBtn.disabled = true;
  nextBtn.disabled = false;
});

nextBtn.addEventListener("click", () => {
  if (currentIndex < questions.length - 1) {
    currentIndex++;
    loadQuestion();
  } else {
    finishGame();
  }
});

// -------------------------
// FEEDBACK
// -------------------------
function showFeedback(isCorrect) {
  feedbackEl.className = "feedback " + (isCorrect ? "correct" : "incorrect");
  feedbackEl.textContent = isCorrect ? "✓" : "✗";
}

// -------------------------
// END GAME
// -------------------------
function finishGame() {
  if (timerInterval) clearInterval(timerInterval);
  timerEl.classList.add("hidden");

  document.getElementById("correct-count").textContent = correctCount;
  document.getElementById("wrong-count").textContent = wrongCount;

  switchScreen("end");
}

restartBtn.addEventListener("click", () => {
  switchScreen("start");
});

