const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

let data = {
  users: [],
  words: [],
  word_progress: [],
  quiz_results: []
};

// Load data
if (fs.existsSync(DB_PATH)) {
  data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
} else {
  // Seed words from JSON
  const vocabData = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'data', 'vocabulary.json'), 'utf-8')
  );
  
  let wordId = 1;
  for (const cat of vocabData.vocabulary_categories) {
    for (const word of cat.words) {
      if (!data.words.find(w => w.term === word.term)) {
        data.words.push({
          id: wordId++,
          term: word.term,
          definition: word.definition,
          example: word.example,
          category: cat.category_name
        });
      }
    }
  }
  saveDb();
}

function saveDb() {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { data, saveDb };
