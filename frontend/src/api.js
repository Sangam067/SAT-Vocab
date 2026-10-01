const API_BASE = '/api';

// ─── GUEST BROWSER CACHE HELPERS ──────────────────────────────────────────────
const GUEST_KEYS = {
  PROGRESS: 'sat_vocab_guest_progress',
  QUIZZES: 'sat_vocab_guest_quizzes',
  GOAL: 'sat_vocab_guest_goal',
  DAILY_BATCH: 'sat_vocab_guest_daily_batch',
  REVIEWS: 'sat_vocab_guest_reviews',
};

export function isGuestUser(userId) {
  return !userId || userId === 'guest' || userId === null || userId === undefined;
}

function getGuestProgressMap() {
  try {
    const raw = localStorage.getItem(GUEST_KEYS.PROGRESS);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveGuestProgressMap(map) {
  try {
    localStorage.setItem(GUEST_KEYS.PROGRESS, JSON.stringify(map));
  } catch (e) {}
}

function getGuestQuizzes() {
  try {
    const raw = localStorage.getItem(GUEST_KEYS.QUIZZES);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveGuestQuizzes(quizzes) {
  try {
    localStorage.setItem(GUEST_KEYS.QUIZZES, JSON.stringify(quizzes));
  } catch (e) {}
}

// ─── AUTHENTICATION & CAPTCHA ─────────────────────────────────────────────────

export async function fetchCaptcha() {
  const res = await fetch(`${API_BASE}/auth/captcha`);
  if (!res.ok) throw new Error('Failed to generate captcha');
  return res.json();
}

export async function loginUser(username, password, captchaId, captchaAnswer) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, captchaId, captchaAnswer }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to login');
  return data;
}

export async function registerUser(username, password, captchaId, captchaAnswer) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, captchaId, captchaAnswer }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to register');
  return data;
}

// ─── STATS & DASHBOARD ────────────────────────────────────────────────────────

export async function fetchStats(userId) {
  if (isGuestUser(userId)) {
    const words = await fetchWords();
    const progMap = getGuestProgressMap();
    const masteredCount = Object.values(progMap).filter(Boolean).length;
    const quizzes = getGuestQuizzes();

    let avgScore = 0;
    if (quizzes.length > 0) {
      const sum = quizzes.reduce((acc, q) => acc + (q.score / q.total_questions) * 100, 0);
      avgScore = Math.round((sum / quizzes.length) * 10) / 10;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    let reviews = {};
    try {
      reviews = JSON.parse(localStorage.getItem(GUEST_KEYS.REVIEWS) || '{}');
    } catch (e) {}
    const reviewedToday = (reviews[todayDate] || []).length;

    return {
      totalWords: words.length || 122,
      masteredCount,
      averageScore: avgScore,
      recentQuizzes: quizzes.slice(0, 10),
      reviewedToday,
    };
  }

  const res = await fetch(`${API_BASE}/stats/${userId}`);
  return res.json();
}

// ─── WORDS & VOCABULARY ───────────────────────────────────────────────────────

export async function fetchWords(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/words?${query}`);
  return res.json();
}

export async function fetchCategories() {
  const res = await fetch(`${API_BASE}/words/categories`);
  return res.json();
}

export async function submitWord(term, definition, example, userId) {
  const res = await fetch(`${API_BASE}/words/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ term, definition, example, user_id: userId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to submit word');
  return data;
}

// ─── DAILY GOAL & DAILY FLASHCARDS ────────────────────────────────────────────

export async function fetchDailyGoal(userId) {
  if (isGuestUser(userId)) {
    const todayDate = new Date().toISOString().split('T')[0];
    const goal = Math.max(5, Math.min(50, parseInt(localStorage.getItem(GUEST_KEYS.GOAL) || '5', 10)));
    const progMap = getGuestProgressMap();
    const allWords = await fetchWords();

    // Check existing guest batch for today
    let batch = [];
    try {
      const savedBatchObj = JSON.parse(localStorage.getItem(GUEST_KEYS.DAILY_BATCH) || 'null');
      if (savedBatchObj && savedBatchObj.date === todayDate && Array.isArray(savedBatchObj.batch)) {
        batch = savedBatchObj.batch;
      }
    } catch (e) {}

    // If batch needs generation or expansion
    if (batch.length < goal) {
      const existingTerms = new Set(batch.map((w) => w.term.toLowerCase()));
      const unmastered = allWords.filter((w) => !progMap[w.term] && !existingTerms.has(w.term.toLowerCase()));
      const pool = unmastered.length >= (goal - batch.length)
        ? unmastered
        : allWords.filter((w) => !existingTerms.has(w.term.toLowerCase()));

      const shuffled = [...pool].sort(() => 0.5 - Math.random());
      const needed = goal - batch.length;
      batch = [...batch, ...shuffled.slice(0, needed)];

      try {
        localStorage.setItem(GUEST_KEYS.DAILY_BATCH, JSON.stringify({ date: todayDate, batch }));
      } catch (e) {}
    }

    const activeBatch = batch.slice(0, goal).map((w) => ({
      ...w,
      is_mastered: Boolean(progMap[w.term]),
    }));

    let reviews = {};
    try {
      reviews = JSON.parse(localStorage.getItem(GUEST_KEYS.REVIEWS) || '{}');
    } catch (e) {}
    const reviewedToday = (reviews[todayDate] || []).length;

    const quizzes = getGuestQuizzes();
    const quizzesToday = quizzes.filter((q) => q.completed_at && q.completed_at.startsWith(todayDate)).length;
    const batchMasteredCount = activeBatch.filter((w) => w.is_mastered).length;
    const masteredCount = Object.values(progMap).filter(Boolean).length;

    return {
      daily_goal: goal,
      today_date: todayDate,
      daily_batch: activeBatch,
      reviewed_today: reviewedToday,
      quizzes_today: quizzesToday,
      batch_mastered: batchMasteredCount,
      total_words: allWords.length || 122,
      total_mastered: masteredCount,
      is_goal_met: batchMasteredCount >= goal || (reviewedToday >= goal && quizzesToday >= 1),
    };
  }

  const res = await fetch(`${API_BASE}/goal/${userId}`);
  if (!res.ok) throw new Error('Failed to fetch daily goal');
  return res.json();
}

export async function updateDailyGoal(userId, dailyGoal) {
  if (isGuestUser(userId)) {
    const validGoal = Math.max(5, Math.min(50, parseInt(dailyGoal, 10) || 5));
    localStorage.setItem(GUEST_KEYS.GOAL, String(validGoal));
    // Clear old guest batch so new goal count generates a fresh batch of that size
    localStorage.removeItem(GUEST_KEYS.DAILY_BATCH);
    return {
      message: `Daily goal set to ${validGoal} words/day (minimum 5 words enforced).`,
      daily_goal: validGoal,
    };
  }

  const res = await fetch(`${API_BASE}/goal/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ daily_goal: dailyGoal }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update daily goal');
  return data;
}

export async function submitDailyQuiz(userId, results) {
  if (isGuestUser(userId)) {
    const progMap = getGuestProgressMap();
    let correctCount = 0;
    const masteredTerms = [];
    const reviewTerms = [];

    for (const item of results) {
      if (!item.term) continue;
      if (item.is_correct) {
        correctCount++;
        masteredTerms.push(item.term);
        progMap[item.term] = true;
      } else {
        reviewTerms.push(item.term);
        progMap[item.term] = false;
      }
    }
    saveGuestProgressMap(progMap);

    const quizzes = getGuestQuizzes();
    quizzes.unshift({
      id: Date.now(),
      score: correctCount,
      total_questions: results.length,
      completed_at: new Date().toISOString(),
    });
    saveGuestQuizzes(quizzes);

    return {
      message: 'Daily quiz completed!',
      score: correctCount,
      total_questions: results.length,
      mastered_terms: masteredTerms,
      review_terms: reviewTerms,
    };
  }

  const res = await fetch(`${API_BASE}/goal/submit-quiz/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ results }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to submit daily quiz');
  return data;
}

export async function recordCardReview(userId, terms) {
  if (isGuestUser(userId)) {
    const todayDate = new Date().toISOString().split('T')[0];
    let reviews = {};
    try {
      reviews = JSON.parse(localStorage.getItem(GUEST_KEYS.REVIEWS) || '{}');
    } catch (e) {}

    const currentTerms = new Set(reviews[todayDate] || []);
    (terms || []).forEach((t) => currentTerms.add(t));
    reviews[todayDate] = Array.from(currentTerms);

    try {
      localStorage.setItem(GUEST_KEYS.REVIEWS, JSON.stringify(reviews));
    } catch (e) {}
    return { success: true };
  }

  const res = await fetch(`${API_BASE}/goal/record-review/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ terms }),
  });
  return res.json();
}

// ─── ADMIN WORD MANAGEMENT ────────────────────────────────────────────────────

export async function fetchPendingWords() {
  const res = await fetch(`${API_BASE}/admin/pending`);
  if (!res.ok) throw new Error('Failed to load pending words');
  return res.json();
}

export async function approvePendingWord(id, category) {
  const res = await fetch(`${API_BASE}/admin/approve/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to approve word');
  return data;
}

export async function rejectPendingWord(id) {
  const res = await fetch(`${API_BASE}/admin/reject/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to reject word');
  return data;
}

export async function updatePendingWord(id, { term, definition, example }) {
  const res = await fetch(`${API_BASE}/admin/pending/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ term, definition, example }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update pending word');
  return data;
}

export async function fetchAdminWords(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  const res = await fetch(`${API_BASE}/admin/words${query}`);
  if (!res.ok) throw new Error('Failed to fetch words');
  return res.json();
}

export async function updateApprovedWord(id, { term, definition, example, category }) {
  const res = await fetch(`${API_BASE}/admin/words/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ term, definition, example, category }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update word');
  return data;
}

// ─── PROGRESS IMPORT & EXPORT ─────────────────────────────────────────────────

export async function exportUserProgress(userId) {
  if (isGuestUser(userId)) {
    const progMap = getGuestProgressMap();
    const wordProgress = Object.entries(progMap).map(([word_term, is_mastered]) => ({
      word_term,
      is_mastered: is_mastered ? 1 : 0,
      last_reviewed_at: new Date().toISOString(),
    }));
    const quizResults = getGuestQuizzes();

    return {
      app: 'SAT VocabMaster',
      version: '1.0',
      exported_at: new Date().toISOString(),
      user: { id: 'guest', username: 'guest' },
      word_progress: wordProgress,
      quiz_results: quizResults,
    };
  }

  const res = await fetch(`${API_BASE}/progress/export/${userId}`);
  if (!res.ok) throw new Error('Failed to export progress');
  return res.json();
}

export async function importUserProgress(userId, progressData) {
  if (isGuestUser(userId)) {
    if (Array.isArray(progressData.word_progress)) {
      const currentProg = getGuestProgressMap();
      progressData.word_progress.forEach((p) => {
        if (p.word_term) currentProg[p.word_term] = p.is_mastered === 1;
      });
      saveGuestProgressMap(currentProg);
    }
    if (Array.isArray(progressData.quiz_results)) {
      const currentQuizzes = getGuestQuizzes();
      const merged = [...progressData.quiz_results, ...currentQuizzes];
      saveGuestQuizzes(merged);
    }
    return { message: 'Progress restored successfully to local browser cache!' };
  }

  const res = await fetch(`${API_BASE}/progress/import/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(progressData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to import progress');
  return data;
}

// Automatically sync guest localStorage progress to a user account when they log in
export async function syncGuestProgressToUser(userId) {
  if (!userId || isGuestUser(userId)) return;

  const progMap = getGuestProgressMap();
  const quizzes = getGuestQuizzes();

  const hasGuestProgress = Object.keys(progMap).length > 0 || quizzes.length > 0;
  if (!hasGuestProgress) return;

  const wordProgress = Object.entries(progMap).map(([word_term, is_mastered]) => ({
    word_term,
    is_mastered: is_mastered ? 1 : 0,
    last_reviewed_at: new Date().toISOString(),
  }));

  try {
    await importUserProgress(userId, {
      word_progress: wordProgress,
      quiz_results: quizzes,
    });
    // Clear guest storage after successful sync to user database account
    localStorage.removeItem(GUEST_KEYS.PROGRESS);
    localStorage.removeItem(GUEST_KEYS.QUIZZES);
    localStorage.removeItem(GUEST_KEYS.DAILY_BATCH);
    localStorage.removeItem(GUEST_KEYS.REVIEWS);
  } catch (err) {
    console.error('Failed to sync guest progress:', err);
  }
}

// ─── WORD PROGRESS & MASTERY ──────────────────────────────────────────────────

export async function fetchProgress(userId) {
  if (isGuestUser(userId)) {
    const progMap = getGuestProgressMap();
    return Object.entries(progMap).map(([word_term, is_mastered]) => ({
      word_term,
      is_mastered: is_mastered ? 1 : 0,
      last_reviewed_at: new Date().toISOString(),
    }));
  }

  const res = await fetch(`${API_BASE}/progress/${userId}`);
  return res.json();
}

export async function updateProgress(userId, wordTerm, isMastered) {
  if (isGuestUser(userId)) {
    const progMap = getGuestProgressMap();
    progMap[wordTerm] = Boolean(isMastered);
    saveGuestProgressMap(progMap);
    return {
      word_term: wordTerm,
      is_mastered: isMastered ? 1 : 0,
      last_reviewed_at: new Date().toISOString(),
    };
  }

  const res = await fetch(`${API_BASE}/progress/${userId}/${encodeURIComponent(wordTerm)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_mastered: isMastered }),
  });
  return res.json();
}

// ─── QUIZ RESULTS ─────────────────────────────────────────────────────────────

export async function saveQuizResult(userId, score, totalQuestions) {
  if (isGuestUser(userId)) {
    const quizzes = getGuestQuizzes();
    const entry = {
      id: Date.now(),
      score,
      total_questions: totalQuestions,
      completed_at: new Date().toISOString(),
    };
    quizzes.unshift(entry);
    saveGuestQuizzes(quizzes);
    return entry;
  }

  const res = await fetch(`${API_BASE}/quiz/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score, total_questions: totalQuestions }),
  });
  return res.json();
}

export async function fetchQuizHistory(userId) {
  if (isGuestUser(userId)) {
    return getGuestQuizzes();
  }

  const res = await fetch(`${API_BASE}/quiz/${userId}`);
  return res.json();
}
