const API_BASE = '/api';

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

export async function fetchStats(userId) {
  const res = await fetch(`${API_BASE}/stats/${userId}`);
  return res.json();
}

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

export async function fetchDailyGoal(userId) {
  const res = await fetch(`${API_BASE}/goal/${userId}`);
  if (!res.ok) throw new Error('Failed to fetch daily goal');
  return res.json();
}

export async function updateDailyGoal(userId, dailyGoal) {
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
  const res = await fetch(`${API_BASE}/goal/record-review/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ terms }),
  });
  return res.json();
}

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

export async function exportUserProgress(userId) {
  const res = await fetch(`${API_BASE}/progress/export/${userId}`);
  if (!res.ok) throw new Error('Failed to export progress');
  return res.json();
}

export async function importUserProgress(userId, progressData) {
  const res = await fetch(`${API_BASE}/progress/import/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(progressData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to import progress');
  return data;
}

export async function fetchProgress(userId) {
  const res = await fetch(`${API_BASE}/progress/${userId}`);
  return res.json();
}

export async function updateProgress(userId, wordTerm, isMastered) {
  const res = await fetch(`${API_BASE}/progress/${userId}/${encodeURIComponent(wordTerm)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_mastered: isMastered }),
  });
  return res.json();
}

export async function saveQuizResult(userId, score, totalQuestions) {
  const res = await fetch(`${API_BASE}/quiz/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score, total_questions: totalQuestions }),
  });
  return res.json();
}

export async function fetchQuizHistory(userId) {
  const res = await fetch(`${API_BASE}/quiz/${userId}`);
  return res.json();
}
