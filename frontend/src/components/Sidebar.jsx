import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ isOpen, onClose, onOpenAuth, onOpenSubmitWord }) {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout } = useAuth();
  const isAdmin = currentUser && currentUser.role === 'admin';

  return (
    <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
      {/* Close button (mobile/tablet) */}
      <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
        ✕
      </button>

      {/* Brand Top */}
      <div>
        <NavLink to="/" className="app-brand" onClick={onClose}>
          <div className="brand-badge">S</div>
          <div>
            <div className="brand-title">VocabMaster</div>
            <div className="brand-subtitle">SAT Preparation</div>
          </div>
        </NavLink>

        {/* Nav Links */}
        <nav className="sidebar-nav" onClick={onClose}>
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link-item ${isActive ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>Dashboard</span>
          </NavLink>

          {/* Daily Goal & Routine */}
          <NavLink
            to="/daily-goal"
            className={({ isActive }) => `nav-link-item ${isActive ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>Daily Goal</span>
          </NavLink>

          <NavLink
            to="/flashcards"
            className={({ isActive }) => `nav-link-item ${isActive ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
            <span>Flashcards</span>
          </NavLink>

          <NavLink
            to="/quiz"
            className={({ isActive }) => `nav-link-item ${isActive ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>Quiz Mode</span>
          </NavLink>

          <NavLink
            to="/browse"
            className={({ isActive }) => `nav-link-item ${isActive ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>Browse & Search</span>
          </NavLink>

          {/* Admin Panel Link */}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `nav-link-item ${isActive ? 'active' : ''}`}
              style={{ color: 'var(--color-warning)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              <span>Admin Panel</span>
            </NavLink>
          )}
        </nav>

        {/* Suggest Word CTA */}
        <div style={{ marginTop: '16px', padding: '0 8px' }}>
          <button
            onClick={() => { onClose(); onOpenSubmitWord(); }}
            className="btn-secondary"
            style={{
              width: '100%',
              fontSize: '12px',
              padding: '8px 10px',
              borderColor: 'var(--accent-blue)',
              color: 'var(--accent-blue)',
            }}
          >
            + Add Your Word
          </button>
        </div>
      </div>

      {/* Bottom Profile & Theme Toggle */}
      <div className="sidebar-bottom">
        <button
          onClick={toggleTheme}
          className="btn-secondary"
          style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px' }}
          title="Toggle Light / Dark mode"
        >
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="12" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          )}
          <span style={{ fontSize: '13px' }}>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        {/* User Account Section */}
        {currentUser ? (
          <div className="user-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                className="user-avatar"
                style={{
                  backgroundColor: isAdmin ? 'var(--color-warning)' : 'var(--accent-blue)',
                }}
              >
                {currentUser.username.charAt(0).toUpperCase()}
              </div>
              <div style={{ maxWidth: '100px', overflow: 'hidden' }}>
                <div className="user-name" style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentUser.username}
                </div>
                <div className="user-role" style={{ color: isAdmin ? 'var(--color-warning)' : 'var(--text-muted)' }}>
                  {isAdmin ? 'Admin' : 'Student'}
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              title="Log out"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '600',
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => { onClose(); onOpenAuth(); }}
            className="btn-primary"
            style={{ width: '100%', fontSize: '12px', padding: '8px 12px' }}
          >
            Log In / Sign Up
          </button>
        )}
      </div>
    </aside>
  );
}
