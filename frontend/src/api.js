const API_BASE = '/api';

export async function fetchUser(username = 'default') {
  const res = await fetch(`${API_BASE}/user?username=${username}`);
  return res.json();
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
