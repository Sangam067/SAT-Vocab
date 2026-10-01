require('dotenv').config();
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

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: db.isTurso ? 'turso_cloud' : 'local_sqlite',
    timestamp: new Date().toISOString(),
  });
});

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
    expiresInSeconds: 300,
  });
});

// ─── AUTH ENDPOINTS ───────────────────────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, captchaId, captchaAnswer } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
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
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username.trim().toLowerCase()]);
    if (existing) {
      return res.status(409).json({ error: 'Username is already taken' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const password_hash = hashPassword(password, salt);

    const info = await db.run(
      'INSERT INTO users (username, password_hash, salt, role, daily_goal) VALUES (?, ?, ?, ?, ?)',
      [username.trim().toLowerCase(), password_hash, salt, 'student', 5]
    );

    const user = await db.get('SELECT id, username, role, daily_goal, created_at FROM users WHERE id = ?', [info.lastInsertRowid]);
    res.status(201).json(user);
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
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

    const user = await db.get('SELECT * FROM users WHERE username = ?', [username.trim().toLowerCase()]);
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
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// ─── DAILY GOAL & DAILY FLASHCARDS ENDPOINTS ──────────────────────────────────

// GET /api/goal/:userId — get current daily goal and today's dedicated random batch
app.get('/api/goal/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await db.get('SELECT id, username, daily_goal FROM users WHERE id = ?', [userId]);
    // Enforce minimum 5 words daily goal
    const goal = Math.max(5, user?.daily_goal || 5);

    const todayDate = new Date().toISOString().split('T')[0];

    // Words already mastered by this user (is_mastered = 1)
    const masteredRows = await db.all(
      'SELECT word_term FROM word_progress WHERE user_id = ? AND is_mastered = 1',
      [userId]
    );
    const masteredSet = new Set(masteredRows.map((r) => r.word_term.toLowerCase()));

    // Check existing daily batch for today
    let batchRows = await db.all(`
      SELECT b.id as batch_id, w.id, w.term, w.definition, w.example, w.category
      FROM daily_batches b
      JOIN words w ON LOWER(b.word_term) = LOWER(w.term)
      WHERE b.user_id = ? AND b.date_str = ?
      ORDER BY b.id ASC
    `, [userId, todayDate]);

    // If today's batch is less than current target goal, select random unmastered words without duplicates
    if (batchRows.length < goal) {
      const needed = goal - batchRows.length;
      const existingTermsInBatch = new Set(batchRows.map((b) => b.term.toLowerCase()));

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
      let candidateWords = await db.all(candidateQuery, [userId, userId, todayDate, needed]);

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
        const backfillWords = await db.all(backfillQuery, [userId, todayDate, stillNeeded]);
        for (const bw of backfillWords) {
          if (!allExisting.has(bw.term.toLowerCase())) {
            candidateWords.push(bw);
            allExisting.add(bw.term.toLowerCase());
          }
        }
      }

      // Insert selected words into daily_batches
      const insertStmts = candidateWords.map((w) => ({
        sql: `INSERT OR IGNORE INTO daily_batches (user_id, date_str, word_term) VALUES (?, ?, ?)`,
        args: [userId, todayDate, w.term],
      }));
      if (insertStmts.length > 0) {
        await db.batch(insertStmts);
      }

      // Re-fetch full batch for today
      batchRows = await db.all(`
        SELECT b.id as batch_id, w.id, w.term, w.definition, w.example, w.category
        FROM daily_batches b
        JOIN words w ON LOWER(b.word_term) = LOWER(w.term)
        WHERE b.user_id = ? AND b.date_str = ?
        ORDER BY b.id ASC
      `, [userId, todayDate]);
    }

    // Slice to current goal if batch had more from previous setting
    const activeBatch = batchRows.slice(0, goal).map((word) => ({
      ...word,
      is_mastered: masteredSet.has(word.term.toLowerCase()),
    }));

    // Words reviewed today
    const reviewedTodayRows = await db.all(`
      SELECT word_term FROM word_progress 
      WHERE user_id = ? AND date(last_reviewed_at) = date('now')
    `, [userId]);
    const reviewedTodayCount = reviewedTodayRows.length;

    // Quizzes completed today
    const quizzesTodayRes = await db.get(`
      SELECT COUNT(*) as count FROM quiz_results 
      WHERE user_id = ? AND date(completed_at) = date('now')
    `, [userId]);
    const quizzesToday = quizzesTodayRes ? Number(quizzesTodayRes.count) : 0;

    // Count how many of today's batch are already mastered
    const batchMasteredCount = activeBatch.filter((w) => w.is_mastered).length;

    // Total words in syllabus vs total mastered
    const totalWordsRes = await db.get('SELECT COUNT(*) as count FROM words');
    const totalWords = totalWordsRes ? Number(totalWordsRes.count) : 0;
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
  } catch (err) {
    console.error('GET /api/goal error:', err);
    res.status(500).json({ error: 'Failed to fetch daily goal' });
  }
});

// PUT /api/goal/:userId — set a new daily target goal (minimum 5)
app.put('/api/goal/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { daily_goal } = req.body;

    // Strictly enforce minimum 5 words daily goal
    const validGoal = Math.max(5, Math.min(50, parseInt(daily_goal, 10) || 5));
    await db.run('UPDATE users SET daily_goal = ? WHERE id = ?', [validGoal, userId]);

    res.json({
      message: `Daily goal set to ${validGoal} words/day (minimum 5 words enforced).`,
      daily_goal: validGoal,
    });
  } catch (err) {
    console.error('PUT /api/goal error:', err);
    res.status(500).json({ error: 'Failed to update daily goal' });
  }
});

// POST /api/goal/submit-quiz/:userId — Submit daily quiz results for today's words
app.post('/api/goal/submit-quiz/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { results } = req.body; // Array of { term: string, is_correct: boolean }

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ error: 'Quiz results array is required.' });
    }

    const batchStatements = [];
    let correctCount = 0;
    const masteredTerms = [];
    const reviewTerms = [];

    for (const item of results) {
      if (!item.term) continue;
      const isCorrect = Boolean(item.is_correct);

      if (isCorrect) {
        correctCount++;
        masteredTerms.push(item.term);
        batchStatements.push({
          sql: `
            INSERT INTO word_progress (user_id, word_term, is_mastered, last_reviewed_at)
            VALUES (?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, word_term) DO UPDATE SET
              is_mastered = 1,
              last_reviewed_at = CURRENT_TIMESTAMP
          `,
          args: [userId, item.term],
        });
      } else {
        reviewTerms.push(item.term);
        batchStatements.push({
          sql: `
            INSERT INTO word_progress (user_id, word_term, is_mastered, last_reviewed_at)
            VALUES (?, ?, 0, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, word_term) DO UPDATE SET
              is_mastered = 0,
              last_reviewed_at = CURRENT_TIMESTAMP
          `,
          args: [userId, item.term],
        });
      }
    }

    // Record quiz attempt
    batchStatements.push({
      sql: `
        INSERT INTO quiz_results (user_id, score, total_questions)
        VALUES (?, ?, ?)
      `,
      args: [userId, correctCount, results.length],
    });

    await db.batch(batchStatements);

    res.json({
      message: 'Daily quiz completed!',
      score: correctCount,
      total_questions: results.length,
      mastered_terms: masteredTerms,
      review_terms: reviewTerms,
    });
  } catch (err) {
    console.error('Submit quiz error:', err);
    res.status(500).json({ error: 'Failed to submit quiz results' });
  }
});

// POST /api/goal/record-review/:userId — record that student reviewed cards
app.post('/api/goal/record-review/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { terms } = req.body;

    if (Array.isArray(terms) && terms.length > 0) {
      const statements = terms.map((t) => ({
        sql: `
          INSERT INTO word_progress (user_id, word_term, is_mastered, last_reviewed_at)
          VALUES (?, ?, 0, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id, word_term) DO UPDATE SET
            last_reviewed_at = CURRENT_TIMESTAMP
        `,
        args: [userId, t],
      }));
      await db.batch(statements);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Record review error:', err);
    res.status(500).json({ error: 'Failed to record card review' });
  }
});

// ─── WORDS ────────────────────────────────────────────────────────────────────

// GET /api/words — all words with optional category and search filters
app.get('/api/words', async (req, res) => {
  try {
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

    const words = await db.all(query, params);
    res.json(words);
  } catch (err) {
    console.error('GET /api/words error:', err);
    res.status(500).json({ error: 'Failed to fetch words' });
  }
});

// GET /api/words/categories — distinct category names
app.get('/api/words/categories', async (req, res) => {
  try {
    const categories = await db.all('SELECT DISTINCT category FROM words ORDER BY category');
    res.json(categories.map((c) => c.category));
  } catch (err) {
    console.error('GET /api/words/categories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/words/submit — Registered students only submit words for admin review
app.post('/api/words/submit', async (req, res) => {
  try {
    const { term, definition, example, user_id, captchaId, captchaAnswer } = req.body;

    // REQUIRE LOGGED IN USER
    if (!user_id) {
      return res.status(401).json({ error: 'Authentication required. Please log in to suggest new words.' });
    }

    const user = await db.get('SELECT id, username FROM users WHERE id = ?', [user_id]);
    if (!user) {
      return res.status(401).json({ error: 'User account not found. Please log in.' });
    }

    if (!term || !definition || !example) {
      return res.status(400).json({ error: 'Term, definition, and example sentence are required.' });
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

    // Check if word already exists in approved words
    const existsInApproved = await db.get('SELECT id, term FROM words WHERE LOWER(term) = LOWER(?)', [term.trim()]);
    if (existsInApproved) {
      return res.status(409).json({ error: `Duplicate word: "${existsInApproved.term}" is already in the vocabulary database!` });
    }

    // Check if word already submitted in pending
    const existsInPending = await db.get('SELECT id, term FROM pending_words WHERE LOWER(term) = LOWER(?)', [term.trim()]);
    if (existsInPending) {
      return res.status(409).json({ error: `Duplicate submission: "${existsInPending.term}" is already submitted and awaiting admin approval.` });
    }

    const info = await db.run(`
      INSERT INTO pending_words (term, definition, example, submitted_by)
      VALUES (?, ?, ?, ?)
    `, [term.trim(), definition.trim(), example.trim(), user.username]);

    res.status(201).json({
      message: 'Word submitted successfully! It will appear across the app once approved by an admin.',
      id: info.lastInsertRowid,
    });
  } catch (err) {
    console.error('POST /api/words/submit error:', err);
    res.status(500).json({ error: 'Failed to submit word' });
  }
});

// ─── ADMIN WORD MANAGEMENT ────────────────────────────────────────────────────

// GET /api/admin/pending — get all pending submissions (Admin only)
app.get('/api/admin/pending', async (req, res) => {
  try {
    const pending = await db.all('SELECT * FROM pending_words ORDER BY submitted_at DESC');
    res.json(pending);
  } catch (err) {
    console.error('GET /api/admin/pending error:', err);
    res.status(500).json({ error: 'Failed to fetch pending submissions' });
  }
});

// POST /api/admin/approve/:id — approve word and insert into main words table
app.post('/api/admin/approve/:id', async (req, res) => {
  try {
    const pending = await db.get('SELECT * FROM pending_words WHERE id = ?', [req.params.id]);
    if (!pending) {
      return res.status(404).json({ error: 'Pending submission not found' });
    }

    const category = req.body.category || 'Student Submitted & Community';

    await db.batch([
      {
        sql: `INSERT OR REPLACE INTO words (term, definition, example, category) VALUES (?, ?, ?, ?)`,
        args: [pending.term, pending.definition, pending.example, category],
      },
      {
        sql: 'DELETE FROM pending_words WHERE id = ?',
        args: [req.params.id],
      },
    ]);

    res.json({ message: `"${pending.term}" approved and added to active vocabulary!` });
  } catch (err) {
    console.error('Approve word error:', err);
    res.status(500).json({ error: 'Failed to approve word' });
  }
});

// DELETE /api/admin/reject/:id — reject/delete pending submission
app.delete('/api/admin/reject/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM pending_words WHERE id = ?', [req.params.id]);
    res.json({ message: 'Submission rejected and removed.' });
  } catch (err) {
    console.error('Reject word error:', err);
    res.status(500).json({ error: 'Failed to reject word' });
  }
});

// PUT /api/admin/pending/:id — edit a pending word's fields before approval
app.put('/api/admin/pending/:id', async (req, res) => {
  try {
    const { term, definition, example } = req.body;
    if (!term || !definition || !example) {
      return res.status(400).json({ error: 'Term, definition, and example are required.' });
    }
    const existing = await db.get('SELECT id FROM pending_words WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Pending submission not found.' });
    }
    await db.run(
      'UPDATE pending_words SET term = ?, definition = ?, example = ? WHERE id = ?',
      [term.trim(), definition.trim(), example.trim(), req.params.id]
    );
    const updated = await db.get('SELECT * FROM pending_words WHERE id = ?', [req.params.id]);
    res.json({ message: 'Pending word updated successfully.', word: updated });
  } catch (err) {
    console.error('PUT /api/admin/pending/:id error:', err);
    res.status(500).json({ error: 'Failed to update pending word' });
  }
});

// GET /api/admin/words — get all published words (Admin only)
app.get('/api/admin/words', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM words';
    const params = [];
    if (search) {
      query += ' WHERE (term LIKE ? OR definition LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY term ASC';
    const words = await db.all(query, params);
    res.json(words);
  } catch (err) {
    console.error('GET /api/admin/words error:', err);
    res.status(500).json({ error: 'Failed to fetch words' });
  }
});

// PUT /api/admin/words/:id — edit a published word's definition/example/category
app.put('/api/admin/words/:id', async (req, res) => {
  try {
    const { term, definition, example, category } = req.body;
    if (!term || !definition || !example) {
      return res.status(400).json({ error: 'Term, definition, and example are required.' });
    }
    const existing = await db.get('SELECT id FROM words WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Word not found.' });
    }
    await db.run(
      'UPDATE words SET term = ?, definition = ?, example = ?, category = ? WHERE id = ?',
      [term.trim(), definition.trim(), example.trim(), (category || '').trim(), req.params.id]
    );
    const updated = await db.get('SELECT * FROM words WHERE id = ?', [req.params.id]);
    res.json({ message: `"${updated.term}" updated successfully.`, word: updated });
  } catch (err) {
    console.error('PUT /api/admin/words/:id error:', err);
    res.status(500).json({ error: 'Failed to update word' });
  }
});

// ─── DASHBOARD / STATS ───────────────────────────────────────────────────────

// GET /api/stats/:userId
app.get('/api/stats/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    const totalWordsRes = await db.get('SELECT COUNT(*) as count FROM words');
    const totalWords = totalWordsRes ? Number(totalWordsRes.count) : 0;

    const masteredRes = await db.get(
      'SELECT COUNT(*) as count FROM word_progress WHERE user_id = ? AND is_mastered = 1',
      [userId]
    );
    const masteredCount = masteredRes ? Number(masteredRes.count) : 0;

    const avgScoreRes = await db.get(
      'SELECT AVG(CAST(score AS FLOAT) / total_questions * 100) as avg FROM quiz_results WHERE user_id = ?',
      [userId]
    );
    const avgScore = avgScoreRes?.avg;

    const recentQuizzes = await db.all(
      'SELECT * FROM quiz_results WHERE user_id = ? ORDER BY completed_at DESC LIMIT 10',
      [userId]
    );

    const reviewedTodayRes = await db.get(
      `SELECT COUNT(*) as count FROM word_progress 
       WHERE user_id = ? AND date(last_reviewed_at) = date('now')`,
      [userId]
    );
    const reviewedToday = reviewedTodayRes ? Number(reviewedTodayRes.count) : 0;

    res.json({
      totalWords,
      masteredCount,
      averageScore: avgScore ? Math.round(Number(avgScore) * 10) / 10 : 0,
      recentQuizzes,
      reviewedToday,
    });
  } catch (err) {
    console.error('GET /api/stats error:', err);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

// ─── PROGRESS IMPORT & EXPORT (BACKUP / RESTORE) ───────────────────────────────

// GET /api/progress/export/:userId — Export user data as a backup JSON
app.get('/api/progress/export/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await db.get('SELECT id, username, created_at FROM users WHERE id = ?', [userId]);
    const wordProgress = await db.all('SELECT word_term, is_mastered, last_reviewed_at FROM word_progress WHERE user_id = ?', [userId]);
    const quizResults = await db.all('SELECT score, total_questions, completed_at FROM quiz_results WHERE user_id = ? ORDER BY completed_at ASC', [userId]);

    const exportData = {
      app: 'SAT VocabMaster',
      version: '1.0',
      exported_at: new Date().toISOString(),
      user: user || { id: userId, username: 'guest' },
      word_progress: wordProgress,
      quiz_results: quizResults,
    };

    res.json(exportData);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export progress data' });
  }
});

// POST /api/progress/import/:userId — Restore/merge progress from backup JSON
app.post('/api/progress/import/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { word_progress, quiz_results } = req.body;

    if (!Array.isArray(word_progress) && !Array.isArray(quiz_results)) {
      return res.status(400).json({ error: 'Invalid backup file format.' });
    }

    const statements = [];
    let wordsRestored = 0;
    let quizzesRestored = 0;

    if (Array.isArray(word_progress)) {
      for (const item of word_progress) {
        if (item.word_term) {
          statements.push({
            sql: `
              INSERT INTO word_progress (user_id, word_term, is_mastered, last_reviewed_at)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(user_id, word_term) DO UPDATE SET
                is_mastered = excluded.is_mastered,
                last_reviewed_at = excluded.last_reviewed_at
            `,
            args: [
              userId,
              item.word_term,
              item.is_mastered ? 1 : 0,
              item.last_reviewed_at || new Date().toISOString(),
            ],
          });
          wordsRestored++;
        }
      }
    }

    if (Array.isArray(quiz_results)) {
      for (const item of quiz_results) {
        if (item.total_questions) {
          statements.push({
            sql: `
              INSERT INTO quiz_results (user_id, score, total_questions, completed_at)
              VALUES (?, ?, ?, ?)
            `,
            args: [
              userId,
              item.score,
              item.total_questions,
              item.completed_at || new Date().toISOString(),
            ],
          });
          quizzesRestored++;
        }
      }
    }

    if (statements.length > 0) {
      for (let i = 0; i < statements.length; i += 50) {
        await db.batch(statements.slice(i, i + 50));
      }
    }

    res.json({
      message: `Progress restored successfully! Merged ${wordsRestored} words and ${quizzesRestored} quiz entries.`,
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'Failed to import progress data' });
  }
});

// ─── WORD PROGRESS ────────────────────────────────────────────────────────────

// GET /api/progress/:userId — all progress for a specific user
app.get('/api/progress/:userId', async (req, res) => {
  try {
    const progress = await db.all('SELECT * FROM word_progress WHERE user_id = ?', [req.params.userId]);
    res.json(progress);
  } catch (err) {
    console.error('GET /api/progress error:', err);
    res.status(500).json({ error: 'Failed to fetch user progress' });
  }
});

// PUT /api/progress/:userId/:wordTerm — toggle or set mastered state for user
app.put('/api/progress/:userId/:wordTerm', async (req, res) => {
  try {
    const { userId, wordTerm } = req.params;
    const { is_mastered } = req.body;

    await db.run(`
      INSERT INTO word_progress (user_id, word_term, is_mastered, last_reviewed_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, word_term) DO UPDATE SET
        is_mastered = excluded.is_mastered,
        last_reviewed_at = CURRENT_TIMESTAMP
    `, [userId, wordTerm, is_mastered ? 1 : 0]);

    const updated = await db.get('SELECT * FROM word_progress WHERE user_id = ? AND word_term = ?', [userId, wordTerm]);
    res.json(updated);
  } catch (err) {
    console.error('PUT /api/progress error:', err);
    res.status(500).json({ error: 'Failed to update word progress' });
  }
});

// ─── QUIZ RESULTS ─────────────────────────────────────────────────────────────

// POST /api/quiz/:userId — save quiz result for specific user
app.post('/api/quiz/:userId', async (req, res) => {
  try {
    const { score, total_questions } = req.body;
    const info = await db.run(
      'INSERT INTO quiz_results (user_id, score, total_questions) VALUES (?, ?, ?)',
      [req.params.userId, score, total_questions]
    );

    const result = await db.get('SELECT * FROM quiz_results WHERE id = ?', [info.lastInsertRowid]);
    res.json(result);
  } catch (err) {
    console.error('POST /api/quiz error:', err);
    res.status(500).json({ error: 'Failed to save quiz result' });
  }
});

// GET /api/quiz/:userId — get quiz history for user
app.get('/api/quiz/:userId', async (req, res) => {
  try {
    const quizzes = await db.all(
      'SELECT * FROM quiz_results WHERE user_id = ? ORDER BY completed_at DESC',
      [req.params.userId]
    );
    res.json(quizzes);
  } catch (err) {
    console.error('GET /api/quiz error:', err);
    res.status(500).json({ error: 'Failed to fetch quiz history' });
  }
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

async function startServer() {
  try {
    await db.init();
    app.listen(PORT, () => {
      console.log(`✨ SAT Vocab API running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
