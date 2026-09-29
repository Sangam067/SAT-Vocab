import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Flashcards from './components/Flashcards';
import Quiz from './components/Quiz';
import Browse from './components/Browse';
import { ThemeProvider } from './context/ThemeContext';
import { fetchUser } from './api';

export default function App() {
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    fetchUser('default')
      .then((user) => setUserId(user.id))
      .catch((err) => console.error('Failed to load user:', err));
  }, []);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="app-layout">
          {/* Left Vertical Navigation Bar */}
          <Sidebar />

          {/* Right Main Body: Top Header + Scrollable Content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', overflow: 'hidden' }}>
            <Header />

            <main className="app-content">
              <Routes>
                <Route path="/" element={<Dashboard userId={userId} />} />
                <Route path="/flashcards" element={<Flashcards userId={userId} />} />
                <Route path="/quiz" element={<Quiz userId={userId} />} />
                <Route path="/browse" element={<Browse userId={userId} />} />
              </Routes>
            </main>
          </div>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}
