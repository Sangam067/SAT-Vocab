import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import DailyGoalSection from './components/DailyGoalSection';
import Flashcards from './components/Flashcards';
import Quiz from './components/Quiz';
import Browse from './components/Browse';
import AdminPanel from './components/AdminPanel';
import AuthModal from './components/AuthModal';
import SubmitWordModal from './components/SubmitWordModal';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppContent() {
  const { currentUser } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [submitWordOpen, setSubmitWordOpen] = useState(false);

  // If logged in use their id; otherwise use id 1 for guest preview
  const effectiveUserId = currentUser ? currentUser.id : 1;

  return (
    <div className="app-layout">
      {/* Left Navigation */}
      <Sidebar
        onOpenAuth={() => setAuthOpen(true)}
        onOpenSubmitWord={() => setSubmitWordOpen(true)}
      />

      {/* Main App */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', overflow: 'hidden' }}>
        <Header onOpenAuth={() => setAuthOpen(true)} />

        <main className="app-content">
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  userId={effectiveUserId}
                  onOpenSubmitWord={() => setSubmitWordOpen(true)}
                  onOpenAuth={() => setAuthOpen(true)}
                />
              }
            />
            <Route
              path="/daily-goal"
              element={
                <DailyGoalSection
                  userId={effectiveUserId}
                  onOpenAuth={() => setAuthOpen(true)}
                />
              }
            />
            <Route path="/flashcards" element={<Flashcards userId={effectiveUserId} />} />
            <Route path="/quiz" element={<Quiz userId={effectiveUserId} />} />
            <Route path="/browse" element={<Browse userId={effectiveUserId} />} />
            <Route path="/admin" element={<AdminPanel onOpenAuth={() => setAuthOpen(true)} />} />
          </Routes>
        </main>
      </div>

      {/* Modals */}
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      <SubmitWordModal
        isOpen={submitWordOpen}
        onClose={() => setSubmitWordOpen(false)}
        onOpenAuth={() => setAuthOpen(true)}
      />
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
