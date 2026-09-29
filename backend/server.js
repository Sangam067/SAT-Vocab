const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { data, saveDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// In-memory CAPTCHA store: { [id]: { answer: string, expiresAt: number } }
const captchaStore = new Map();

// Periodic cleanup of expired captchas
setInterval(() => {
  const now = Date.now();
  for (const [id, captcha] of captchaStore.entries()) {
    if (captcha.expiresAt < now) {
      captchaStore.delete(id);
    }
  }
}, 60000);

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

// ─── CAPTCHA ENDPOINTS ────────────────────────────────────────────────────────

app.get('/api/auth/captcha', (req, res) => {
  const captchaId = crypto.randomUUID();
  const operations = ['+', '-', '×'];
  const op = operations[Math.floor(Math.random() * operations.length)];
  
  let num1, num2, answer;
  if (op === '+') {
    num1 = Math.floor(Math.random() * 20) + 1;
    num2 = Math.floor(Math.random() * 20) + 1;
    answer = String(num1 + num2);
  } else if (op === '-') {
    num1 = Math.floor(Math.random() * 25) + 10;
    num2 = Math.floor(Math.random() * num1);
    answer = String(num1 - num2);
  } else {
    num1 = Math.floor(Math.random() * 9) + 2;
    num2 = Math.floor(Math.random() * 9) + 2;
    answer = String(num1 * num2);
  }

  const question = `What is ${num1} ${op} ${num2}?`;
  captchaStore.set(captchaId, { answer, expiresAt: Date.now() + 5 * 60 * 1000 });

  res.json({ captchaId, question });
});

// ─── AUTH ENDPOINTS ───────────────────────────────────────────────────────────

app.post('/api/auth/register', (req, res) => {
  const { username, password, captchaId, captchaAnswer } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const captcha = captchaStore.get(captchaId);
  if (!captcha || captcha.expiresAt < Date.now()) {
    captchaStore.delete(captchaId);
    return res.status(400).json({ error: 'Captcha expired or invalid. Please refresh captcha.' });
  }
  if (captcha.answer.trim().toLowerCase() !== String(captchaAnswer || '').trim().toLowerCase()) {
    captchaStore.delete(captchaId);
    return res.status(400).json({ error: 'Incorrect captcha answer. Please try again.' });
  }
  captchaStore.delete(captchaId);

  const uname = username.trim().toLowerCase();
  if (data.users.find(u => u.username === uname)) {
    return res.status(409).json({ error: 'Username is already taken' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const password_hash = hashPassword(password, salt);
  const id = data.users.length > 0 ? Math.max(...data.users.map(u => u.id)) + 1 : 1;

  const newUser = {
    id,
    username: uname,
    password_hash,
    salt,
    created_at: new Date().toISOString()
  };
  data.users.push(newUser);
  saveDb();

  res.status(201).json({ id: newUser.id, username: newUser.username, created_at: newUser.created_at });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password, captchaId, captchaAnswer } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

  const captcha = captchaStore.get(captchaId);
  if (!captcha || captcha.expiresAt < Date.now()) {
    captchaStore.delete(captchaId);
    return res.status(400).json({ error: 'Captcha expired or invalid. Please refresh captcha.' });
  }
  if (captcha.answer.trim().toLowerCase() !== String(captchaAnswer || '').trim().toLowerCase()) {
    captchaStore.delete(captchaId);
    return res.status(400).json({ error: 'Incorrect captcha answer. Please try again.' });
  }
  captchaStore.delete(captchaId);

  const user = data.users.find(u => u.username === username.trim().toLowerCase());
  if (!user || !user.password_hash) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const computedHash = hashPassword(password, user.salt);
  if (computedHash !== user.password_hash) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  res.json({
    id: user.id,
    username: user.username,
    created_at: user.created_at,
  });
});

// ─── WORDS ────────────────────────────────────────────────────────────────────

app.get('/api/words', (req, res) => {
  const { category, search } = req.query;
  let words = data.words;

  if (category) {
    words = words.filter(w => w.category === category);
  }
  if (search) {
    const s = search.toLowerCase();
    words = words.filter(w => w.term.toLowerCase().includes(s) || w.definition.toLowerCase().includes(s));
  }
  
  words.sort((a, b) => a.term.localeCompare(b.term));
  res.json(words);
});

app.get('/api/words/categories', (req, res) => {
  const cats = [...new Set(data.words.map(w => w.category))];
  cats.sort();
  res.json(cats);
});

// ─── DASHBOARD / STATS ───────────────────────────────────────────────────────

app.get('/api/stats/:userId', (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  
  const totalWords = data.words.length;
  const masteredCount = data.word_progress.filter(wp => wp.user_id === userId && wp.is_mastered === 1).length;
  
  const userQuizzes = data.quiz_results.filter(qr => qr.user_id === userId);
  let avgScore = 0;
  if (userQuizzes.length > 0) {
    const totalPerc = userQuizzes.reduce((acc, curr) => acc + (curr.score / curr.total_questions * 100), 0);
    avgScore = totalPerc / userQuizzes.length;
  }
  
  const recentQuizzes = [...userQuizzes].sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)).slice(0, 10);

  const today = new Date().toISOString().split('T')[0];
  const reviewedToday = data.word_progress.filter(wp => 
    wp.user_id === userId && wp.last_reviewed_at && wp.last_reviewed_at.startsWith(today)
  ).length;

  res.json({
    totalWords,
    masteredCount,
    averageScore: Math.round(avgScore * 10) / 10,
    recentQuizzes,
    reviewedToday,
  });
});

// ─── WORD PROGRESS ────────────────────────────────────────────────────────────

app.get('/api/progress/:userId', (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const progress = data.word_progress.filter(wp => wp.user_id === userId);
  res.json(progress);
});

app.put('/api/progress/:userId/:wordTerm', (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const wordTerm = req.params.wordTerm;
  const { is_mastered } = req.body;

  let wp = data.word_progress.find(w => w.user_id === userId && w.word_term === wordTerm);
  if (wp) {
    wp.is_mastered = is_mastered ? 1 : 0;
    wp.last_reviewed_at = new Date().toISOString();
  } else {
    wp = {
      id: data.word_progress.length > 0 ? Math.max(...data.word_progress.map(w => w.id)) + 1 : 1,
      user_id: userId,
      word_term: wordTerm,
      is_mastered: is_mastered ? 1 : 0,
      last_reviewed_at: new Date().toISOString()
    };
    data.word_progress.push(wp);
  }
  saveDb();
  res.json(wp);
});

// ─── QUIZ RESULTS ─────────────────────────────────────────────────────────────

app.post('/api/quiz/:userId', (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const { score, total_questions } = req.body;
  const id = data.quiz_results.length > 0 ? Math.max(...data.quiz_results.map(q => q.id)) + 1 : 1;
  
  const qr = {
    id,
    user_id: userId,
    score,
    total_questions,
    completed_at: new Date().toISOString()
  };
  data.quiz_results.push(qr);
  saveDb();
  res.json(qr);
});

app.get('/api/quiz/:userId', (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const quizzes = data.quiz_results.filter(qr => qr.user_id === userId).sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
  res.json(quizzes);
});

// ─── START SERVER ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✨ SAT Vocab API running on http://localhost:${PORT}`);
});
