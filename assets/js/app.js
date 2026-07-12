(() => {
  const data = window.COURSE_DATA;
  const state = {
    currentUnit: 1,
    currentTab: "vocabulary",
    practiceType: "vocabulary",
    quiz: [],
    questionIndex: 0,
    score: 0,
    answered: false,
    selectedChoice: null
  };

  const defaultProgress = {
    openedUnits: [],
    tests: []
  };

  let progress = loadProgress();

  function loadProgress() {
    try {
      const saved = localStorage.getItem("studyNotesProgress")
        || localStorage.getItem("parlaItalianoProgress");
      return JSON.parse(saved) || structuredClone(defaultProgress);
    } catch {
      return structuredClone(defaultProgress);
    }
  }

  function saveProgress() {
    localStorage.setItem("studyNotesProgress", JSON.stringify(progress));
    renderProgressSummary();
  }

  function normalise(text) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function setView(name) {
    document.querySelectorAll(".view").forEach(view => view.classList.remove("active"));
    document.getElementById(`${name}-view`).classList.add("active");

    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.view === name || (name === "unit" && btn.dataset.view === "home"));
    });

    if (name === "progress") renderProgressPage();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderUnitCards() {
    const grid = document.getElementById("unit-grid");
    grid.innerHTML = data.map(unit => {
      const opened = progress.openedUnits.includes(unit.id);
      const unitTests = progress.tests.filter(test => test.unitId === unit.id);
      const best = unitTests.length ? Math.max(...unitTests.map(t => t.percentage)) : null;

      return `
        <button class="unit-card" data-unit-id="${unit.id}">
          ${best !== null ? `<span class="unit-badge">Best ${best}%</span>` : opened ? `<span class="unit-badge">Opened</span>` : ""}
          <span class="unit-number">${String(unit.id).padStart(2, "0")}</span>
          <span>
            <h3>${unit.title}</h3>
            <p>${unit.description}</p>
          </span>
          <span class="unit-arrow">→</span>
        </button>
      `;
    }).join("");

    grid.querySelectorAll(".unit-card").forEach(card => {
      card.addEventListener("click", () => openUnit(Number(card.dataset.unitId)));
    });
  }

  function renderSideUnits() {
    const container = document.getElementById("unit-side-list");
    container.innerHTML = data.map(unit => `
      <button class="side-unit-btn ${unit.id === state.currentUnit ? "active" : ""}" data-unit-id="${unit.id}">
        ${unit.id}. ${unit.title}
      </button>
    `).join("");

    container.querySelectorAll(".side-unit-btn").forEach(btn => {
      btn.addEventListener("click", () => openUnit(Number(btn.dataset.unitId)));
    });
  }

  function openUnit(id) {
    state.currentUnit = id;
    state.currentTab = "vocabulary";

    if (!progress.openedUnits.includes(id)) {
      progress.openedUnits.push(id);
      saveProgress();
    }

    const unit = data.find(item => item.id === id);
    document.getElementById("unit-number-label").textContent = `Unit ${unit.id}`;
    document.getElementById("unit-title").textContent = unit.title;
    document.getElementById("unit-description").textContent = unit.description;

    document.querySelectorAll(".content-tab").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.tab === "vocabulary");
    });

    renderSideUnits();
    renderUnitTab();
    renderUnitCards();
    setView("unit");
  }

  function renderUnitTab() {
    const unit = data.find(item => item.id === state.currentUnit);
    const panel = document.getElementById("unit-tab-content");

    if (state.currentTab === "vocabulary") {
      panel.innerHTML = `
        <table class="vocab-table">
          <thead><tr><th>Italian</th><th>English</th></tr></thead>
          <tbody>
            ${unit.vocabulary.map(([it, en]) => `<tr><td><strong>${it}</strong></td><td>${en}</td></tr>`).join("")}
          </tbody>
        </table>
      `;
    }

    if (state.currentTab === "sentences") {
      panel.innerHTML = `
        <div class="phrase-list">
          ${unit.sentences.map(([it, en]) => `
            <article class="phrase-item">
              <strong>${it}</strong>
              <span>${en}</span>
            </article>
          `).join("")}
        </div>
      `;
    }

    if (state.currentTab === "dialogue") {
      panel.innerHTML = `
        <div class="dialogue-box">
          ${unit.dialogue.map(([speaker, line]) => `
            <p class="dialogue-line"><strong>${speaker}:</strong> ${line}</p>
          `).join("")}
        </div>
      `;
    }

    if (state.currentTab === "text") {
      panel.innerHTML = `
        <div class="reading-box">
          <p>${unit.text}</p>
        </div>
      `;
    }

    if (state.currentTab === "speaking") {
      panel.innerHTML = `
        <div class="speaking-box">
          <span class="eyebrow">SPEAK FOR TWO MINUTES</span>
          <h2>Use these points to guide your answer.</h2>
          <ul>${unit.speaking.map(item => `<li>${item}</li>`).join("")}</ul>
          <p><strong>Tip:</strong> Speak in short connected sentences. Do not stop to correct every small mistake.</p>
        </div>
      `;
    }
  }

  function renderPracticeSelect() {
    const select = document.getElementById("practice-unit-select");
    select.innerHTML = data.map(unit => `<option value="${unit.id}">Unit ${unit.id}: ${unit.title}</option>`).join("");
    select.value = state.currentUnit;
  }

  function createVocabularyQuestions(unit) {
    const selected = shuffle(unit.vocabulary).slice(0, Math.min(8, unit.vocabulary.length));

    return selected.map((pair, index) => {
      const [italian, english] = pair;
      const direction = index % 2 === 0 ? "it-en" : "en-it";
      const useChoice = index % 3 !== 2;

      if (useChoice) {
        const answer = direction === "it-en" ? english : italian;
        const pool = unit.vocabulary
          .filter(item => item !== pair)
          .map(item => direction === "it-en" ? item[1] : item[0]);
        const choices = shuffle([answer, ...shuffle(pool).slice(0, 3)]);

        return {
          kind: "vocabulary-choice",
          prompt: direction === "it-en" ? italian : english,
          instruction: direction === "it-en" ? "Choose the English meaning." : "Choose the Italian translation.",
          answer,
          choices
        };
      }

      return {
        kind: "vocabulary-text",
        prompt: direction === "it-en" ? italian : english,
        instruction: direction === "it-en" ? "Type the English meaning." : "Type the Italian translation.",
        answer: direction === "it-en" ? english : italian,
        accepted: [direction === "it-en" ? english : italian]
      };
    });
  }

  function createSentenceQuestions(unit) {
    return shuffle(unit.replies).map(item => ({
      kind: "sentence-reply",
      prompt: item.prompt,
      instruction: item.instruction,
      examples: item.examples,
      keywords: item.keywords
    }));
  }

  function buildQuiz(unit, type) {
    const vocab = createVocabularyQuestions(unit);
    const replies = createSentenceQuestions(unit);

    if (type === "vocabulary") return vocab;
    if (type === "sentences") return replies;
    return shuffle([...vocab.slice(0, 5), ...replies.slice(0, 4)]);
  }

  function startTest() {
    const unitId = Number(document.getElementById("practice-unit-select").value);
    state.currentUnit = unitId;
    const unit = data.find(item => item.id === unitId);

    state.quiz = buildQuiz(unit, state.practiceType);
    state.questionIndex = 0;
    state.score = 0;
    state.answered = false;
    state.selectedChoice = null;

    document.getElementById("practice-setup").classList.add("hidden");
    document.getElementById("result-card").classList.add("hidden");
    document.getElementById("quiz-card").classList.remove("hidden");
    document.getElementById("quiz-unit-name").textContent = `Unit ${unit.id}: ${unit.title}`;

    renderQuestion();
  }

  function renderQuestion() {
    const question = state.quiz[state.questionIndex];
    const total = state.quiz.length;
    const answerArea = document.getElementById("question-answer-area");

    state.answered = false;
    state.selectedChoice = null;

    document.getElementById("quiz-counter").textContent = `${state.questionIndex + 1} / ${total}`;
    document.getElementById("quiz-progress-bar").style.width = `${((state.questionIndex) / total) * 100}%`;
    document.getElementById("question-type").textContent =
      question.kind.startsWith("vocabulary") ? "Vocabulary" : "Conversation reply";
    document.getElementById("question-prompt").textContent = question.prompt;
    document.getElementById("question-instruction").textContent = question.instruction;

    const feedback = document.getElementById("question-feedback");
    feedback.className = "feedback hidden";
    feedback.innerHTML = "";

    document.getElementById("check-answer-btn").classList.remove("hidden");
    document.getElementById("next-question-btn").classList.add("hidden");

    if (question.kind === "vocabulary-choice") {
      answerArea.innerHTML = `
        <div class="choice-grid">
          ${question.choices.map(choice => `<button class="choice-btn" data-choice="${choice.replace(/"/g, "&quot;")}">${choice}</button>`).join("")}
        </div>
      `;

      answerArea.querySelectorAll(".choice-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          if (state.answered) return;
          answerArea.querySelectorAll(".choice-btn").forEach(item => item.classList.remove("selected"));
          btn.classList.add("selected");
          state.selectedChoice = btn.dataset.choice;
        });
      });
    }

    if (question.kind === "vocabulary-text") {
      answerArea.innerHTML = `<input class="text-answer" id="text-answer-input" type="text" autocomplete="off" placeholder="Type your answer…" />`;
      document.getElementById("text-answer-input").addEventListener("keydown", event => {
        if (event.key === "Enter") checkAnswer();
      });
      setTimeout(() => document.getElementById("text-answer-input").focus(), 50);
    }

    if (question.kind === "sentence-reply") {
      answerArea.innerHTML = `<textarea class="reply-answer" id="reply-answer-input" placeholder="Write your reply in Italian…"></textarea>`;
      setTimeout(() => document.getElementById("reply-answer-input").focus(), 50);
    }
  }

  function checkAnswer() {
    if (state.answered) return;

    const question = state.quiz[state.questionIndex];
    const feedback = document.getElementById("question-feedback");
    let correct = false;
    let message = "";

    if (question.kind === "vocabulary-choice") {
      if (!state.selectedChoice) {
        feedback.className = "feedback neutral";
        feedback.textContent = "Choose an answer first.";
        return;
      }

      correct = normalise(state.selectedChoice) === normalise(question.answer);
      document.querySelectorAll(".choice-btn").forEach(btn => {
        if (normalise(btn.dataset.choice) === normalise(question.answer)) btn.classList.add("correct");
        else if (btn.classList.contains("selected")) btn.classList.add("incorrect");
      });

      message = correct
        ? `Correct — ${question.answer}.`
        : `Not quite. The correct answer is: ${question.answer}.`;
    }

    if (question.kind === "vocabulary-text") {
      const input = document.getElementById("text-answer-input").value;
      if (!input.trim()) {
        feedback.className = "feedback neutral";
        feedback.textContent = "Type an answer first.";
        return;
      }

      const user = normalise(input);
      const answer = normalise(question.answer);
      const alternatives = answer.split("/").map(item => item.trim());
      correct = alternatives.some(item => user === item || user.includes(item) || item.includes(user));
      message = correct
        ? `Correct — ${question.answer}.`
        : `A correct answer is: ${question.answer}.`;
    }

    if (question.kind === "sentence-reply") {
      const input = document.getElementById("reply-answer-input").value;
      if (!input.trim()) {
        feedback.className = "feedback neutral";
        feedback.textContent = "Write a reply first.";
        return;
      }

      const user = normalise(input);
      const matched = question.keywords.filter(keyword => user.includes(normalise(keyword)));
      correct = matched.length > 0;

      message = correct
        ? `<strong>Good reply.</strong><br>Example: ${question.examples[0]}`
        : `<strong>Your reply may still be understandable.</strong><br>A natural example is: ${question.examples[0]}<br><small>Other possible answer: ${question.examples[1]}</small>`;
    }

    state.answered = true;
    if (correct) state.score += 1;

    feedback.className = `feedback ${correct ? "success" : "error"}`;
    feedback.innerHTML = message;
    document.getElementById("check-answer-btn").classList.add("hidden");
    document.getElementById("next-question-btn").classList.remove("hidden");
    document.getElementById("next-question-btn").textContent =
      state.questionIndex === state.quiz.length - 1 ? "Show result" : "Next question";
  }

  function nextQuestion() {
    if (!state.answered) return;

    if (state.questionIndex < state.quiz.length - 1) {
      state.questionIndex += 1;
      renderQuestion();
    } else {
      finishTest();
    }
  }

  function finishTest() {
    const percentage = Math.round((state.score / state.quiz.length) * 100);
    const unit = data.find(item => item.id === state.currentUnit);

    progress.tests.push({
      unitId: unit.id,
      type: state.practiceType,
      score: state.score,
      total: state.quiz.length,
      percentage,
      date: new Date().toISOString()
    });
    saveProgress();
    renderUnitCards();

    document.getElementById("quiz-card").classList.add("hidden");
    document.getElementById("result-card").classList.remove("hidden");
    document.getElementById("result-score").textContent = `${percentage}%`;

    let title = "Keep practising";
    let message = `You answered ${state.score} of ${state.quiz.length} questions correctly.`;

    if (percentage >= 85) {
      title = "Ottimo lavoro!";
      message = `Excellent. You answered ${state.score} of ${state.quiz.length} questions correctly.`;
    } else if (percentage >= 65) {
      title = "Ben fatto!";
      message = `Good progress. You answered ${state.score} of ${state.quiz.length} questions correctly.`;
    }

    document.getElementById("result-title").textContent = title;
    document.getElementById("result-message").textContent = message;
  }

  function resetPractice() {
    document.getElementById("quiz-card").classList.add("hidden");
    document.getElementById("result-card").classList.add("hidden");
    document.getElementById("practice-setup").classList.remove("hidden");
  }

  function renderProgressSummary() {
    const opened = progress.openedUnits.length;
    const testUnits = new Set(progress.tests.map(test => test.unitId)).size;
    const percentage = Math.round(((opened + testUnits) / (data.length * 2)) * 100);

    document.getElementById("hero-progress-value").textContent = `${percentage}%`;
    document.getElementById("hero-progress-bar").style.width = `${percentage}%`;

    let text = "Begin your first unit.";
    if (percentage > 0 && percentage < 100) text = `${opened} unit${opened === 1 ? "" : "s"} opened and ${progress.tests.length} test${progress.tests.length === 1 ? "" : "s"} completed.`;
    if (percentage === 100) text = "You have opened and tested every unit.";

    document.getElementById("hero-progress-text").textContent = text;
    document.getElementById("continue-btn").textContent = opened ? "Continue learning" : "Start unit 1";
  }

  function renderProgressPage() {
    const opened = progress.openedUnits.length;
    const average = progress.tests.length
      ? Math.round(progress.tests.reduce((sum, test) => sum + test.percentage, 0) / progress.tests.length)
      : null;

    document.getElementById("units-opened-stat").textContent = `${opened} / ${data.length}`;
    document.getElementById("tests-completed-stat").textContent = progress.tests.length;
    document.getElementById("average-score-stat").textContent = average === null ? "—" : `${average}%`;

    document.getElementById("progress-unit-list").innerHTML = data.map(unit => {
      const tests = progress.tests.filter(test => test.unitId === unit.id);
      const best = tests.length ? Math.max(...tests.map(test => test.percentage)) : null;
      const openedText = progress.openedUnits.includes(unit.id) ? "Opened" : "Not started";

      return `
        <article class="progress-row">
          <div>
            <strong>Unit ${unit.id}: ${unit.title}</strong>
            <p>${openedText} · ${tests.length} test${tests.length === 1 ? "" : "s"} completed</p>
          </div>
          <span class="progress-score">${best === null ? "No score" : `Best: ${best}%`}</span>
        </article>
      `;
    }).join("");
  }

  function resetProgress() {
    const confirmed = window.confirm("Reset all saved course progress and test scores?");
    if (!confirmed) return;

    progress = structuredClone(defaultProgress);
    saveProgress();
    renderUnitCards();
    renderProgressPage();
  }

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });

  document.querySelectorAll(".content-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      state.currentTab = tab.dataset.tab;
      document.querySelectorAll(".content-tab").forEach(item => item.classList.toggle("active", item === tab));
      renderUnitTab();
    });
  });

  document.querySelectorAll(".practice-type-card").forEach(card => {
    card.addEventListener("click", () => {
      state.practiceType = card.dataset.practiceType;
      document.querySelectorAll(".practice-type-card").forEach(item => item.classList.toggle("selected", item === card));
    });
  });

  document.getElementById("continue-btn").addEventListener("click", () => {
    const lastOpened = progress.openedUnits.at(-1) || 1;
    openUnit(lastOpened);
  });

  document.getElementById("quick-practice-btn").addEventListener("click", () => {
    renderPracticeSelect();
    setView("practice");
  });

  document.getElementById("back-to-course").addEventListener("click", () => setView("home"));

  document.getElementById("unit-test-btn").addEventListener("click", () => {
    renderPracticeSelect();
    document.getElementById("practice-unit-select").value = state.currentUnit;
    resetPractice();
    setView("practice");
  });

  document.getElementById("start-test-btn").addEventListener("click", startTest);
  document.getElementById("check-answer-btn").addEventListener("click", checkAnswer);
  document.getElementById("next-question-btn").addEventListener("click", nextQuestion);
  document.getElementById("quit-test-btn").addEventListener("click", resetPractice);
  document.getElementById("retry-test-btn").addEventListener("click", startTest);
  document.getElementById("return-practice-btn").addEventListener("click", resetPractice);
  document.getElementById("reset-progress-btn").addEventListener("click", resetProgress);

  renderUnitCards();
  renderPracticeSelect();
  renderProgressSummary();
})();
