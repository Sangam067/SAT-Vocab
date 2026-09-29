# SAT Vocabulary Learning App

This is a full-stack web application for learning SAT vocabulary. It consists of a Node.js/Express backend and a React (Vite) frontend.

## Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

## How to Run the Application

You need to run both the backend and frontend servers simultaneously in separate terminal windows.

### 1. Start the Backend

Open a terminal and navigate to the backend directory:

```bash
cd backend
```

Install the required dependencies:

```bash
npm install
```

Start the backend server (with watch mode for development):

```bash
npm run dev
```

Alternatively, you can run `npm start` to run it without watch mode. 
The backend server typically runs on `http://localhost:3000` (or whatever port is configured in the backend).

### 2. Start the Frontend

Open a new, separate terminal and navigate to the frontend directory:

```bash
cd frontend
```

Install the required dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

The frontend will typically be accessible at `http://localhost:5173`. Open this URL in your browser to view the application.

## Technologies Used

*   **Backend:** Node.js, Express, better-sqlite3
*   **Frontend:** React, Vite, Tailwind CSS, React Router DOM
