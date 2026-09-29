const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
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
    'INSERT INTO users (username, password_hash, salt, role, daily_goal) VALUES (?, ?, ?, ?, ?)'
  ).run(username.trim().toLowerCase(), password_hash, salt, 'student', 5);

  const user = db.prepare('SELECT id, username, role, daily_goal, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);
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
    role: user.role || 'student',
    daily_goal: user.daily_goal || 5,
    created_at: user.created_at,
  });
});

// ─── DAILY GOAL & DAILY FLASHCARDS ENDPOINTS ──────────────────────────────────

// GET /api/goal/:userId — get current daily goal and today's dedicated random batch (min 5, unmastered, no duplicates)
app.get('/api/goal/:userId', (req, res) => {
  const userId = req.params.userId;
  const user = db.prepare('SELECT id, username, daily_goal FROM users WHERE id = ?').get(userId);
  // Enforce minimum 5 words daily goal
  const goal = Math.max(5, user?.daily_goal || 5);

  const todayDate = new Date().toISOString().split('T')[0];

  // Words already mastered by this user (is_mastered = 1)
  const masteredRows = db.prepare(
    'SELECT word_term FROM word_progress WHERE user_id = ? AND is_mastered = 1'
  ).all(userId);
  const masteredSet = new Set(masteredRows.map((r) => r.word_term.toLowerCase()));

  // Check existing daily batch for today
  let batchRows = db.prepare(`
    SELECT b.id as batch_id, w.id, w.term, w.definition, w.example, w.category
    FROM daily_batches b
    JOIN words w ON LOWER(b.word_term) = LOWER(w.term)
    WHERE b.user_id = ? AND b.date_str = ?
    ORDER BY b.id ASC
  `).all(userId, todayDate);

  // If today's batch is less than current target goal, select random unmastered words without duplicates
  if (batchRows.length < goal) {
    const needed = goal - batchRows.length;
    const existingTermsInBatch = new Set(batchRows.map((b) => b.term.toLowerCase()));

    // Get candidate words that are:
    // 1. NOT mastered by this user
    // 2. NOT already in today's batch
    const candidateQuery = `
      SELECT * FROM words 
      WHERE LOWER(term) NOT IN (
        SELECT LOWER(word_term) FROM word_progress WHERE user_id = ? AND is_mastered = 1
      )
      AND LOWER(term) NOT IN (
        SELECT LOWER(word_term) FROM daily_batches WHERE user_id = ? AND date_str = ?
      )
      ORDER BY RANDOM()
      LIMIT ?
    `;
    let candidateWords = db.prepare(candidateQuery).all(userId, userId, todayDate, needed);

    // If candidate unmastered words are exhausted, backfill from remaining words not in today's batch
    if (candidateWords.length < needed) {
      const stillNeeded = needed - candidateWords.length;
      const allExisting = new Set([
        ...Array.from(existingTermsInBatch),
        ...candidateWords.map((c) => c.term.toLowerCase()),
      ]);

      const backfillQuery = `
        SELECT * FROM words
        WHERE LOWER(term) NOT IN (
          SELECT LOWER(word_term) FROM daily_batches WHERE user_id = ? AND date_str = ?
        )
        ORDER BY RANDOM()
        LIMIT ?
      `;
      const backfillWords = db.prepare(backfillQuery).all(userId, todayDate, stillNeeded);
      for (const bw of backfillWords) {
        if (!allExisting.has(bw.term.toLowerCase())) {
          candidateWords.push(bw);
          allExisting.add(bw.term.toLowerCase());
        }
      }
    }

    // Insert selected words into daily_batches
    const insertBatchStmt = db.prepare(`
      INSERT OR IGNORE INTO daily_batches (user_id, date_str, word_term)
      VALUES (?, ?, ?)
    `);

    const insertMany = db.transaction((wordsToInsert) => {
      for (const w of wordsToInsert) {
        insertBatchStmt.run(userId, todayDate, w.term);
      }
    });
    insertMany(candidateWords);

    // Re-fetch full batch for today
    batchRows = db.prepare(`
      SELECT b.id as batch_id, w.id, w.term, w.definition, w.example, w.category
      FROM daily_batches b
      JOIN words w ON LOWER(b.word_term) = LOWER(w.term)
      WHERE b.user_id = ? AND b.date_str = ?
      ORDER BY b.id ASC
    `).all(userId, todayDate);
  }

  // Slice to current goal if batch had more from previous setting
  const activeBatch = batchRows.slice(0, goal).map((word) => ({
    ...word,
    is_mastered: masteredSet.has(word.term.toLowerCase()),
  }));

  // Words reviewed today
  const reviewedTodayRows = db.prepare(`
    SELECT word_term FROM word_progress 
    WHERE user_id = ? AND date(last_reviewed_at) = date('now')
  `).all(userId);
  const reviewedTodayCount = reviewedTodayRows.length;

  // Quizzes completed today
  const quizzesToday = db.prepare(`
    SELECT COUNT(*) as count FROM quiz_results 
    WHERE user_id = ? AND date(completed_at) = date('now')
  `).get(userId).count;

  // Count how many of today's batch are already mastered
  const batchMasteredCount = activeBatch.filter((w) => w.is_mastered).length;

  // Total words in syllabus vs total mastered
  const totalWords = db.prepare('SELECT COUNT(*) as count FROM words').get().count;
  const totalMastered = masteredSet.size;

  res.json({
    daily_goal: goal,
    today_date: todayDate,
    daily_batch: activeBatch,
    reviewed_today: reviewedTodayCount,
    quizzes_today: quizzesToday,
    batch_mastered: batchMasteredCount,
    total_words: totalWords,
    total_mastered: totalMastered,
    is_goal_met: batchMasteredCount >= goal || (reviewedTodayCount >= goal && quizzesToday >= 1),
  });
});

// PUT /api/goal/:userId — set a new daily target goal (minimum 5)
app.put('/api/goal/:userId', (req, res) => {
  const userId = req.params.userId;
  const { daily_goal } = req.body;

  // Strictly enforce minimum 5 words daily goal
  const validGoal = Math.max(5, Math.min(50, parseInt(daily_goal, 10) || 5));
  db.prepare('UPDATE users SET daily_goal = ? WHERE id = ?').run(validGoal, userId);

  res.json({
    message: `Daily goal set to ${validGoal} words/day (minimum 5 words enforced).`,
    daily_goal: validGoal,
  });
});

// POST /api/goal/submit-quiz/:userId — Submit daily quiz results for today's words
// Correct answers become MASTERED (is_mastered = 1) and will not come on another day.
// Wrong answers remain UNMASTERED (is_mastered = 0) and can appear on subsequent days.
app.post('/api/goal/submit-quiz/:userId', (req, res) => {
  const userId = req.params.userId;
  const { results } = req.body; // Array of { term: string, is_correct: boolean }

  if (!Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ error: 'Quiz results array is required.' });
  }

  const updateProgressStmt = db.prepare(`
    INSERT INTO word_progress (user_id, word_term, is_mastered, last_reviewed_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, word_term) DO UPDATE SET
      is_mastered = excluded.is_mastered,
      last_reviewed_at = CURRENT_TIMESTAMP
  `);

  const saveResultsTx = db.transaction(() => {
    let correctCount = 0;
    const masteredTerms = [];
    const reviewTerms = [];

    for (const item of results) {
      if (!item.term) continue;
      const isCorrect = Boolean(item.is_correct);

      if (isCorrect) {
        correctCount++;
        masteredTerms.push(item.term);
        // Correct answer: mark mastered (1) -> will NOT come another day
        updateProgressStmt.run(userId, item.term, 1);
      } else {
        reviewTerms.push(item.term);
        // Incorrect answer: mark unmastered (0) -> will be eligible to come next day
        updateProgressStmt.run(userId, item.term, 0);
      }
    }

    // Record quiz attempt
    db.prepare(`
      INSERT INTO quiz_results (user_id, score, total_questions)
      VALUES (?, ?, ?)
    `).run(userId, correctCount, results.length);

    return { correctCount, masteredTerms, reviewTerms };
  });

  const { correctCount, masteredTerms, reviewTerms } = saveResultsTx();

  res.json({
    message: 'Daily quiz completed!',
    score: correctCount,
    total_questions: results.length,
    mastered_terms: masteredTerms,
    review_terms: reviewTerms,
  });
});

// POST /api/goal/record-review/:userId — record that student reviewed cards
app.post('/api/goal/record-review/:userId', (req, res) => {
  const userId = req.params.userId;
  const { terms } = req.body;

  if (Array.isArray(terms)) {
    const touchStmt = db.prepare(`
      INSERT INTO word_progress (user_id, word_term, is_mastered, last_reviewed_at)
      VALUES (?, ?, 0, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, word_term) DO UPDATE SET
        last_reviewed_at = CURRENT_TIMESTAMP
    `);
    const tx = db.transaction(() => {
      for (const t of terms) {
        touchStmt.run(userId, t);
      }
    });
    tx();
  }

  res.json({ success: true });
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
  res.json(categories.map((c) => c.category));
});

// POST /api/words/submit — Registered students only submit words for admin review
app.post('/api/words/submit', (req, res) => {
  const { term, definition, example, user_id } = req.body;

  // REQUIRE LOGGED IN USER
  if (!user_id) {
    return res.status(401).json({ error: 'Authentication required. Please log in to suggest new words.' });
  }

  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(user_id);
  if (!user) {
    return res.status(401).json({ error: 'User account not found. Please log in.' });
  }

  if (!term || !definition || !example) {
    return res.status(400).json({ error: 'Term, definition, and example sentence are required.' });
  }

  // Check if word already exists in approved words
  const existsInApproved = db.prepare('SELECT id, term FROM words WHERE LOWER(term) = LOWER(?)').get(term.trim());
  if (existsInApproved) {
    return res.status(409).json({ error: `Duplicate word: "${existsInApproved.term}" is already in the vocabulary database!` });
  }

  // Check if word already submitted in pending
  const existsInPending = db.prepare('SELECT id, term FROM pending_words WHERE LOWER(term) = LOWER(?)').get(term.trim());
  if (existsInPending) {
    return res.status(409).json({ error: `Duplicate submission: "${existsInPending.term}" is already submitted and awaiting admin approval.` });
  }

  const info = db.prepare(`
    INSERT INTO pending_words (term, definition, example, submitted_by)
    VALUES (?, ?, ?, ?)
  `).run(term.trim(), definition.trim(), example.trim(), user.username);

  res.status(201).json({
    message: 'Word submitted successfully! It will appear across the app once approved by an admin.',
    id: info.lastInsertRowid,
  });
});

// ─── ADMIN WORD MANAGEMENT ────────────────────────────────────────────────────

// GET /api/admin/pending — get all pending submissions (Admin only)
app.get('/api/admin/pending', (req, res) => {
  const pending = db.prepare('SELECT * FROM pending_words ORDER BY submitted_at DESC').all();
  res.json(pending);
});

// POST /api/admin/approve/:id — approve word and insert into main words table
app.post('/api/admin/approve/:id', (req, res) => {
  const pending = db.prepare('SELECT * FROM pending_words WHERE id = ?').get(req.params.id);
  if (!pending) {
    return res.status(404).json({ error: 'Pending submission not found' });
  }

  const category = req.body.category || 'Student Submitted & Community';

  db.prepare(`
    INSERT OR REPLACE INTO words (term, definition, example, category)
    VALUES (?, ?, ?, ?)
  `).run(pending.term, pending.definition, pending.example, category);

  db.prepare('DELETE FROM pending_words WHERE id = ?').run(req.params.id);

  res.json({ message: `"${pending.term}" approved and added to active vocabulary!` });
});

// DELETE /api/admin/reject/:id — reject/delete pending submission
app.delete('/api/admin/reject/:id', (req, res) => {
  db.prepare('DELETE FROM pending_words WHERE id = ?').run(req.params.id);
  res.json({ message: 'Submission rejected and removed.' });
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

// ─── PROGRESS IMPORT & EXPORT (BACKUP / RESTORE) ───────────────────────────────

// GET /api/progress/export/:userId — Export user data as a backup JSON
app.get('/api/progress/export/:userId', (req, res) => {
  const userId = req.params.userId;
  const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(userId);
  const wordProgress = db.prepare('SELECT word_term, is_mastered, last_reviewed_at FROM word_progress WHERE user_id = ?').all(userId);
  const quizResults = db.prepare('SELECT score, total_questions, completed_at FROM quiz_results WHERE user_id = ? ORDER BY completed_at ASC').all(userId);

  const exportData = {
    app: 'SAT VocabMaster',
    version: '1.0',
    exported_at: new Date().toISOString(),
    user: user || { id: userId, username: 'guest' },
    word_progress: wordProgress,
    quiz_results: quizResults,
  };

  res.json(exportData);
});

// POST /api/progress/import/:userId — Restore/merge progress from backup JSON
app.post('/api/progress/import/:userId', (req, res) => {
  const userId = req.params.userId;
  const { word_progress, quiz_results } = req.body;

  if (!Array.isArray(word_progress) && !Array.isArray(quiz_results)) {
    return res.status(400).json({ error: 'Invalid backup file format.' });
  }

  const insertProgress = db.prepare(`
    INSERT INTO word_progress (user_id, word_term, is_mastered, last_reviewed_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, word_term) DO UPDATE SET
      is_mastered = excluded.is_mastered,
      last_reviewed_at = excluded.last_reviewed_at
  `);

  const insertQuiz = db.prepare(`
    INSERT INTO quiz_results (user_id, score, total_questions, completed_at)
    VALUES (?, ?, ?, ?)
  `);

  const restoreTransaction = db.transaction(() => {
    let wordsRestored = 0;
    let quizzesRestored = 0;

    if (Array.isArray(word_progress)) {
      for (const item of word_progress) {
        if (item.word_term) {
          insertProgress.run(
            userId,
            item.word_term,
            item.is_mastered ? 1 : 0,
            item.last_reviewed_at || new Date().toISOString()
          );
          wordsRestored++;
        }
      }
    }

    if (Array.isArray(quiz_results)) {
      for (const item of quiz_results) {
        if (item.total_questions) {
          insertQuiz.run(
            userId,
            item.score,
            item.total_questions,
            item.completed_at || new Date().toISOString()
          );
          quizzesRestored++;
        }
      }
    }

    return { wordsRestored, quizzesRestored };
  });

  const result = restoreTransaction();
  res.json({
    message: `Progress restored successfully! Merged ${result.wordsRestored} words and ${result.quizzesRestored} quiz entries.`,
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

// ─── SERVE FRONTEND (in production) ──────────────────────────────────────────
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ─── START SERVER ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✨ SAT Vocab API running on http://localhost:${PORT}`);
});
