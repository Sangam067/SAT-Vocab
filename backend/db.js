const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

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
`);

// Seed vocabulary into a read-only reference table
db.exec(`
  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term TEXT NOT NULL,
    definition TEXT NOT NULL,
    example TEXT NOT NULL,
    category TEXT NOT NULL,
    UNIQUE(term)
  );
`);

// Seed words from JSON
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

// Create a default user if none exists
const defaultUser = db.prepare('SELECT id FROM users WHERE username = ?').get('default');
if (!defaultUser) {
  db.prepare('INSERT INTO users (username) VALUES (?)').run('default');
}

module.exports = db;
