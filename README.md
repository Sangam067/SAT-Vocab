# 📚 SAT VocabMaster

> A modern, full-stack vocabulary learning platform built for digital SAT prep with interactive flashcards, customizable daily goals, adaptive quizzes, community submissions, and cloud database persistence.

[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite / Turso](https://img.shields.io/badge/Database-SQLite%20%7C%20Turso-003B57?logo=sqlite&logoColor=white)](https://turso.tech/)

---

## 🌟 Highlights & Features

- **🎯 Daily Goal Practice Portal**: Set personalized daily targets (5 to 50 words). Structured step-by-step learning flows from card reviews directly into an unlocking mastery quiz. Session states persist across page refreshes.
- **🃏 3D Interactive Flashcards**: Smooth flip card animations with comprehensive pronunciation, part of speech, definitions, synonyms, and contextual examples. Includes full keyboard shortcut support (`Space`/`Enter` to flip, `←`/`→` to navigate, `M` to toggle mastery).
- **📝 Adaptive Multiple-Choice Quizzes**: Dynamically generated distractor choices, immediate answer scoring, detailed feedback, and score tracking over time.
- **🔍 Word Explorer & Real-Time Search**: Search vocabulary across terms, definitions, and categories (Tone/Attitude, Science/Nature, Rhetoric, Literary, etc.) with instant filter by mastery status.
- **🤝 Community Word Suggestions**: Students can suggest new vocabulary with definitions and sample sentences, protected by an interactive math anti-spam CAPTCHA.
- **🛡️ Secure Admin Panel**: Dedicated dashboard for approving, editing, or rejecting user-submitted words, and editing already published vocabulary.
- **💾 Dual Database Engine**:
  - **Local Development**: Fast local SQLite using `better-sqlite3` with auto-seeding.
  - **Production Deployment**: Cloud SQLite via **Turso** (`@libsql/client`) for 100% persistent storage across container restarts.
- **📱 Fully Responsive & Themed**: Sleek Dark and Light modes, responsive drawer navigation on mobile and tablet devices, and glassmorphic UI.
- **👤 Guest & Account Modes**: Practice immediately as a guest or sign in to permanently sync study streaks, quiz records, and mastered words across all devices.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, React Router v6, Vite, Tailwind CSS v4, Lucide / SVG icons |
| **Backend** | Node.js, Express 4, CORS, PBKDF2 Password Hashing, REST API |
| **Database** | Turso Cloud SQLite (`@libsql/client`) / Local SQLite (`better-sqlite3`) |
| **Tooling & Linter** | Oxlint, npm workspaces |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` (v9 or higher)

### 1. Clone the Repository

```bash
git clone https://github.com/Sangam067/SAT-Vocab.git
cd SAT-Vocab
```

### 2. Install Dependencies

Install both frontend and backend dependencies using the root convenience script:

```bash
npm run install:all
```

### 3. Environment Variables (Optional for Local SQLite)

Copy `.env.example` to `.env` or set environment variables:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `PORT` | Backend server port | `3001` |
| `TURSO_DATABASE_URL` | Turso DB connection URL (`libsql://...`) | *(Optional; falls back to local SQLite)* |
| `TURSO_AUTH_TOKEN` | Turso DB authentication token | *(Optional)* |

> 💡 **Note**: If `TURSO_DATABASE_URL` is omitted, the app will automatically use the local SQLite database stored in `backend/data/sat_vocab.db` with all 500+ pre-seeded SAT words.

### 4. Run Development Servers

Run backend and frontend concurrently:

```bash
# Terminal 1: Start Backend API (runs on http://localhost:3001)
npm run dev:backend

# Terminal 2: Start Frontend Dev Server (runs on http://localhost:5173)
npm run dev:frontend
```

Now open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📦 Production Build & Run

To build the frontend and serve it through the Express backend:

```bash
npm run build
npm start
```

The production application will be accessible at [http://localhost:3001](http://localhost:3001).

---

## 🌐 Free Deployment (Render + Turso)

For a complete step-by-step guide on setting up a free, permanent Turso cloud database and deploying on Render, refer to the [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

1. Create a free database at [Turso.tech](https://turso.tech).
2. Connect your repository to [Render.com](https://render.com) as a Web Service.
3. Set environment variables `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
4. Deploy! Render will build and host both frontend and backend under a single HTTPS domain.

---

## 📁 Project Structure

```
SAT-Vocab/
├── backend/
│   ├── data/                 # Word seeds (vocabulary.json) & local SQLite db
│   ├── db.js                 # Unified database adapter (Turso Cloud & local SQLite)
│   ├── server.js             # Express API server & static frontend serving
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/       # Dashboard, Flashcards, Quiz, DailyGoalSection, Admin, etc.
│   │   ├── context/          # AuthContext & ThemeContext
│   │   ├── api.js            # Unified API client & guest cache synchronization
│   │   ├── App.jsx           # Routing & layout setup
│   │   └── index.css         # Design tokens, variables & responsive styling
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── DEPLOYMENT_GUIDE.md       # Detailed cloud deployment walkthrough
├── package.json              # Root monorepo scripts
└── render.yaml               # Render Blueprint specification
```

---

## 📄 License

This project is licensed under the MIT License. Contributions and feedback are welcome!
