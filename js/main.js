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

const QUESTION_COUNT = 10;

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
    const key = el.dataset.i18n;
    el.textContent = STRINGS[lang][key];
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
  const sa = [...a].sort().join(",");
  const sb = [...b].sort().join(",");
  return sa === sb;
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
  hasChecked = false;

  checkBtn.disabled = true;
  nextBtn.disabled = true;

  feedbackEl.textContent = "";
  feedbackEl.className = "feedback";

  questionNumberEl.textContent = currentIndex + 1;

  if (