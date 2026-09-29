import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Flashcards from './components/Flashcards';
import Quiz from './components/Quiz';
import Browse from './components/Browse';
import AuthModal from './components/AuthModal';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppContent() {
  const { currentUser } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  // Default to user id 1 if not logged in so guests can still preview data, but logged in users get their personal ID
  const effectiveUserId = currentUser ? currentUser.id : 1;

  return (
    <div className="app-layout">
      {/* Left Navigation */}
      <Sidebar onOpenAuth={() => setAuthOpen(true)} />

      {/* Main App */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', overflow: 'hidden' }}>
        <Header onOpenAuth={() => setAuthOpen(true)} />

        <main className="app-content">
          <Routes>
            <Route path="/" element={<Dashboard userId={effectiveUserId} onOpenAuth={() => setAuthOpen(true)} />} />
            <Route path="/flashcards" element={<Flashcards userId={effectiveUserId} onOpenAuth={() => setAuthOpen(true)} />} />
            <Route path="/quiz" element={<Quiz userId={effectiveUserId} onOpenAuth={() => setAuthOpen(true)} />} />
            <Route path="/browse" element={<Browse userId={effectiveUserId} onOpenAuth={() => setAuthOpen(true)} />} />
          </Routes>
        </main>
      </div>

      {/* Authentication Modal with Interactive Captcha */}
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
