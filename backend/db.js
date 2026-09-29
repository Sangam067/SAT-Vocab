const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'data', 'sat_vocab.db');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    salt TEXT,
    role TEXT DEFAULT 'student',
    daily_goal INTEGER DEFAULT 5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS word_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    word_term TEXT NOT NULL,
    is_mastered INTEGER DEFAULT 0,
    last_reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, word_term)
  );

  CREATE TABLE IF NOT EXISTS quiz_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term TEXT NOT NULL,
    definition TEXT NOT NULL,
    example TEXT NOT NULL,
    category TEXT NOT NULL,
    UNIQUE(term)
  );

  CREATE TABLE IF NOT EXISTS pending_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term TEXT NOT NULL,
    definition TEXT NOT NULL,
    example TEXT NOT NULL,
    submitted_by TEXT DEFAULT 'student',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS daily_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date_str TEXT NOT NULL,
    word_term TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, date_str, word_term)
  );
`);

// Migration safeguards for users table columns
const userCols = db.prepare('PRAGMA table_info(users)').all();
if (!userCols.some((col) => col.name === 'password_hash')) {
  try {
    db.exec(`
      ALTER TABLE users ADD COLUMN password_hash TEXT;
      ALTER TABLE users ADD COLUMN salt TEXT;
    `);
  } catch (e) {}
}
if (!userCols.some((col) => col.name === 'role')) {
  try {
    db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'student'`);
  } catch (e) {}
}
if (!userCols.some((col) => col.name === 'daily_goal')) {
  try {
    db.exec(`ALTER TABLE users ADD COLUMN daily_goal INTEGER DEFAULT 5`);
  } catch (e) {}
}

// Seed admin user: adminsatvocab67 / Sulav@Vocab
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

const adminUsername = 'adminsatvocab67';
const adminPlainPassword = 'Sulav@Vocab';
const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername);

if (!existingAdmin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const password_hash = hashPassword(adminPlainPassword, salt);
  db.prepare(`
    INSERT INTO users (username, password_hash, salt, role, daily_goal)
    VALUES (?, ?, ?, 'admin', 10)
  `).run(adminUsername, password_hash, salt);
} else {
  db.prepare(`UPDATE users SET role = 'admin' WHERE username = ?`).run(adminUsername);
}

// Ensure a default guest user exists at id = 1 for unregistered visitors
const userOne = db.prepare('SELECT id FROM users WHERE id = 1').get();
if (!userOne) {
  try {
    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash, salt, role, daily_goal)
      VALUES (1, 'guest_student', 'guest_pwd', 'guest_salt', 'student', 5)
    `).run();
  } catch (e) {}
}

// Seed vocabulary from JSON
const vocabData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'vocabulary.json'), 'utf-8')
);

const insertWord = db.prepare(`
  INSERT OR IGNORE INTO words (term, definition, example, category) VALUES (?, ?, ?, ?)
`);

const seedWords = db.transaction(() => {
  for (const cat of vocabData.vocabulary_categories) {
    for (const word of cat.words) {
      insertWord.run(word.term, word.definition, word.example, cat.category_name);
    }
  }
});

seedWords();

module.exports = db;
