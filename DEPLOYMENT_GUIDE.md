# 🚀 100% Free Production Deployment Guide

Deploy SAT VocabMaster with a **free, permanent cloud database** and **free web hosting** (no credit card required, data never gets wiped when the server restarts or sleeps).

---

## Architecture Overview

- **Frontend + Backend**: Render.com (Free Web Service)
  - Express serves the REST API on `/api` and serves the production React single-page app on all other routes.
- **Database**: Turso Cloud SQLite (`@libsql/client`)
  - 100% persistent cloud storage (9 GB free tier, 500 databases, never expires).
  - All users, login credentials, daily batches, flashcard reviews, and community words are permanently stored.
  - Automatically initializes tables, migrations, admin account, and all 120+ SAT words upon first connection!

---

## Step 1: Create Free Turso Cloud Database (2 minutes)

1. Go to [https://turso.tech](https://turso.tech) and click **Sign Up** (or log in with GitHub).
2. Click **Create Database**:
   - **Name**: `sat-vocab`
   - **Group/Location**: Select the region nearest to you (e.g. `sin` for Singapore, `fra` for Europe, or `iad` for US East).
3. Once created, click on your database:
   - Copy the **Database URL** (it looks like: `libsql://sat-vocab-yourusername.turso.io`).
   - Click **Generate Token** (or **Create Token**) and copy the secret token.

*(Keep these two values handy for Step 2!)*

---

## Step 2: Deploy to Render.com (2 minutes)

1. Go to [https://render.com](https://render.com) and sign in with your GitHub account.
2. Click the blue **New +** button in the top right and select **Web Service**.
3. Select your repository: `Sangam067/SAT-Vocab`.
4. Configure the service settings:
   - **Name**: `sat-vocab` (or any custom name)
   - **Region**: Choose the same region or nearest region (e.g. Oregon, Frankfurt, Singapore)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Select **Free**
5. Scroll down to **Environment Variables** and click **Add Environment Variable**:
   - `TURSO_DATABASE_URL` = `<Paste your libsql:// URL from Step 1>`
   - `TURSO_AUTH_TOKEN` = `<Paste your token from Step 1>`
   - `NODE_ENV` = `production`
6. Click **Deploy Web Service**!

Render will build the frontend, install backend dependencies, connect to your Turso database, and automatically seed everything.

Once deployed, Render gives you a free HTTPS link:
```
https://sat-vocab-xxxx.onrender.com
```

---

## Step 3: Verify Your Deployment

1. Open your Render URL in your browser.
2. Visit `https://sat-vocab-xxxx.onrender.com/api/health` — you should see:
   ```json
   {
     "status": "ok",
     "database": "turso_cloud",
     "timestamp": "..."
   }
   ```
3. Test signing in as Admin:
   - **Username**: `adminsatvocab67`
   - **Password**: `Sulav@Vocab`
4. Register a student account, set a daily goal (5–50 words), practice cards, take the quiz, and see your progress persist across sessions and device restarts!
