const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// In-memory CAPTCHA store: { [id]: { answer: string, expiresAt: number } }
const captchaStore = new Map();

// Periodic cleanup of expired captchas
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of captchaStore.entries()) {
    if (data.expiresAt < now) {
      captchaStore.delete(id);
    }
  }
}, 60000);

// Helper for password hashing using native crypto
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

// ─── CAPTCHA ENDPOINTS ────────────────────────────────────────────────────────

// GET /api/auth/captcha — Generate a new self-contained Captcha puzzle
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
  // Expires in 5 minutes
  captchaStore.set(captchaId, { answer, expiresAt: Date.now() + 5 * 60 * 1000 });

  res.json({
    captchaId,
    question,
  });
});

// ─── AUTH ENDPOINTS ───────────────────────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', (req, res) => {
  const { username, password, captchaId, captchaAnswer } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  // Validate Captcha
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

  // Check if username exists
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim().toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Username is already taken' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const password_hash = hashPassword(password, salt);

  const info = db.prepare(
    'INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)'
  ).run(username.trim().toLowerCase(), password_hash, salt);

  const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(user);
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { username, password, captchaId, captchaAnswer } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Validate Captcha
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

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim().toLowerCase());
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

// GET /api/words — all words with optional category and search filters
app.get('/api/words', (req, res) => {
  const { category, search } = req.query;
  let query = 'SELECT * FROM words';
  const params = [];
  const conditions = [];

  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }
  if (search) {
    conditions.push('(term LIKE ? OR definition LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY term ASC';

  const words = db.prepare(query).all(...params);
  res.json(words);
});

// GET /api/words/categories — distinct category names
app.get('/api/words/categories', (req, res) => {
  const categories = db.prepare('SELECT DISTINCT category FROM words ORDER BY category').all();
  res.json(categories.map(c => c.category));
});

// ─── DASHBOARD / STATS ───────────────────────────────────────────────────────

// GET /api/stats/:userId
app.get('/api/stats/:userId', (req, res) => {
  const userId = req.params.userId;

  const totalWords = db.prepare('SELECT COUNT(*) as count FROM words').get().count;

  const masteredCount = db.prepare(
    'SELECT COUNT(*) as count FROM word_progress WHERE user_id = ? AND is_mastered = 1'
  ).get(userId).count;

  const avgScore = db.prepare(
    'SELECT AVG(CAST(score AS FLOAT) / total_questions * 100) as avg FROM quiz_results WHERE user_id = ?'
  ).get(userId).avg;

  const recentQuizzes = db.prepare(
    'SELECT * FROM quiz_results WHERE user_id = ? ORDER BY completed_at DESC LIMIT 10'
  ).all(userId);

  const reviewedToday = db.prepare(
    `SELECT COUNT(*) as count FROM word_progress 
     WHERE user_id = ? AND date(last_reviewed_at) = date('now')`
  ).get(userId).count;

  res.json({
    totalWords,
    masteredCount,
    averageScore: avgScore ? Math.round(avgScore * 10) / 10 : 0,
    recentQuizzes,
    reviewedToday,
  });
});

// ─── WORD PROGRESS ────────────────────────────────────────────────────────────

// GET /api/progress/:userId — all progress for a specific user
app.get('/api/progress/:userId', (req, res) => {
  const progress = db.prepare(
    'SELECT * FROM word_progress WHERE user_id = ?'
  ).all(req.params.userId);
  res.json(progress);
});

// PUT /api/progress/:userId/:wordTerm — toggle or set mastered state for user
app.put('/api/progress/:userId/:wordTerm', (req, res) => {
  const { userId, wordTerm } = req.params;
  const { is_mastered } = req.body;

  const existing = db.prepare(
    'SELECT * FROM word_progress WHERE user_id = ? AND word_term = ?'
  ).get(userId, wordTerm);

  if (existing) {
    db.prepare(
      'UPDATE word_progress SET is_mastered = ?, last_reviewed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND word_term = ?'
    ).run(is_mastered ? 1 : 0, userId, wordTerm);
  } else {
    db.prepare(
      'INSERT INTO word_progress (user_id, word_term, is_mastered) VALUES (?, ?, ?)'
    ).run(userId, wordTerm, is_mastered ? 1 : 0);
  }

  const updated = db.prepare(
    'SELECT * FROM word_progress WHERE user_id = ? AND word_term = ?'
  ).get(userId, wordTerm);
  res.json(updated);
});

// ─── QUIZ RESULTS ─────────────────────────────────────────────────────────────

// POST /api/quiz/:userId — save quiz result for specific user
app.post('/api/quiz/:userId', (req, res) => {
  const { score, total_questions } = req.body;
  const info = db.prepare(
    'INSERT INTO quiz_results (user_id, score, total_questions) VALUES (?, ?, ?)'
  ).run(req.params.userId, score, total_questions);

  const result = db.prepare('SELECT * FROM quiz_results WHERE id = ?').get(info.lastInsertRowid);
  res.json(result);
});

// GET /api/quiz/:userId — get quiz history for user
app.get('/api/quiz/:userId', (req, res) => {
  const quizzes = db.prepare(
    'SELECT * FROM quiz_results WHERE user_id = ? ORDER BY completed_at DESC'
  ).all(req.params.userId);
  res.json(quizzes);
});

// ─── START SERVER ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✨ SAT Vocab API running on http://localhost:${PORT}`);
});
