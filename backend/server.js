const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── WORDS ────────────────────────────────────────────────────────────────────

// GET /api/words — all words with optional category filter
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

// ─── USER / AUTH (simplified) ─────────────────────────────────────────────────

// GET /api/user — get or create user
app.get('/api/user', (req, res) => {
  const username = req.query.username || 'default';
  let user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    const info = db.prepare('INSERT INTO users (username) VALUES (?)').run(username);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  }
  res.json(user);
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

// GET /api/progress/:userId — all progress for a user
app.get('/api/progress/:userId', (req, res) => {
  const progress = db.prepare(
    'SELECT * FROM word_progress WHERE user_id = ?'
  ).all(req.params.userId);
  res.json(progress);
});

// PUT /api/progress/:userId/:wordTerm — toggle or set mastered
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

// POST /api/quiz/:userId — save quiz result
app.post('/api/quiz/:userId', (req, res) => {
  const { score, total_questions } = req.body;
  const info = db.prepare(
    'INSERT INTO quiz_results (user_id, score, total_questions) VALUES (?, ?, ?)'
  ).run(req.params.userId, score, total_questions);

  const result = db.prepare('SELECT * FROM quiz_results WHERE id = ?').get(info.lastInsertRowid);
  res.json(result);
});

// GET /api/quiz/:userId — get quiz history
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
