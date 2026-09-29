require('dotenv').config();
const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Determine database target: Turso Cloud or local SQLite file
const isTurso = Boolean(process.env.TURSO_DATABASE_URL);
const localDbPath = path.join(__dirname, 'data', 'sat_vocab.db');

if (!isTurso && !fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${localDbPath}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

const db = {
  client,
  isTurso,
  hashPassword,

  // Get multiple rows
  async all(sql, params = []) {
    const res = await client.execute({ sql, args: params });
    return res.rows;
  },

  // Get single row
  async get(sql, params = []) {
    const res = await client.execute({ sql, args: params });
    return res.rows[0] || null;
  },

  // Run an INSERT, UPDATE, DELETE
  async run(sql, params = []) {
    const res = await client.execute({ sql, args: params });
    return {
      lastInsertRowid: res.lastInsertRowid !== undefined ? Number(res.lastInsertRowid) : undefined,
      changes: res.rowsAffected,
    };
  },

  // Execute multiple DDL statements separated by semicolon
  async exec(sql) {
    return client.executeMultiple(sql);
  },

  // Batch execute statements
  async batch(statements) {
    return client.batch(statements);
  },

  // Initialize schema, migrations, admin user, and seed words
  async init() {
    console.log(`Connecting to database (${isTurso ? 'Turso Cloud SQLite' : 'Local SQLite'})...`);

    // Create tables
    await client.executeMultiple(`
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
        term TEXT NOT NULL UNIQUE,
        definition TEXT NOT NULL,
        example TEXT NOT NULL,
        category TEXT NOT NULL
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
    try {
      const userCols = (await client.execute('PRAGMA table_info(users)')).rows;
      if (!userCols.some((col) => col.name === 'password_hash')) {
        await client.execute('ALTER TABLE users ADD COLUMN password_hash TEXT');
        await client.execute('ALTER TABLE users ADD COLUMN salt TEXT');
      }
      if (!userCols.some((col) => col.name === 'role')) {
        await client.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'student'");
      }
      if (!userCols.some((col) => col.name === 'daily_goal')) {
        await client.execute('ALTER TABLE users ADD COLUMN daily_goal INTEGER DEFAULT 5');
      }
    } catch (e) {
      // Ignored if column already exists or table freshly created
    }

    // Seed admin user: adminsatvocab67 / Sulav@Vocab
    const adminUsername = 'adminsatvocab67';
    const adminPlainPassword = 'Sulav@Vocab';
    const existingAdmin = (await client.execute({
      sql: 'SELECT id FROM users WHERE username = ?',
      args: [adminUsername],
    })).rows[0];

    if (!existingAdmin) {
      const salt = crypto.randomBytes(16).toString('hex');
      const password_hash = hashPassword(adminPlainPassword, salt);
      await client.execute({
        sql: `INSERT INTO users (username, password_hash, salt, role, daily_goal) VALUES (?, ?, ?, 'admin', 10)`,
        args: [adminUsername, password_hash, salt],
      });
      console.log('Admin account created: adminsatvocab67');
    } else {
      await client.execute({
        sql: `UPDATE users SET role = 'admin' WHERE username = ?`,
        args: [adminUsername],
      });
    }

    // Seed vocabulary from JSON if empty
    const wordsCountRes = (await client.execute('SELECT COUNT(*) as count FROM words')).rows[0];
    const wordsCount = wordsCountRes ? Number(wordsCountRes.count) : 0;

    if (wordsCount === 0) {
      console.log('Seeding initial SAT vocabulary words from JSON...');
      const vocabPath = path.join(__dirname, 'data', 'vocabulary.json');
      if (fs.existsSync(vocabPath)) {
        const vocabData = JSON.parse(fs.readFileSync(vocabPath, 'utf-8'));
        const batchStatements = [];
        for (const cat of vocabData.vocabulary_categories) {
          for (const word of cat.words) {
            batchStatements.push({
              sql: `INSERT OR IGNORE INTO words (term, definition, example, category) VALUES (?, ?, ?, ?)`,
              args: [word.term, word.definition, word.example, cat.category_name],
            });
          }
        }
        if (batchStatements.length > 0) {
          // Batch in chunks of 50 to avoid any limits
          for (let i = 0; i < batchStatements.length; i += 50) {
            await client.batch(batchStatements.slice(i, i + 50));
          }
          console.log(`Seeded ${batchStatements.length} vocabulary words!`);
        }
      }
    }

    console.log('Database initialized successfully.');
  },
};

module.exports = db;
