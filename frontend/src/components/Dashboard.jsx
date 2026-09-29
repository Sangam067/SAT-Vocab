import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchStats, fetchWords } from '../api';

export default function Dashboard({ userId }) {
  const [stats, setStats] = useState(null);
  const [focusWords, setFocusWords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    Promise.all([fetchStats(userId), fetchWords()])
      .then(([statsData, wordsData]) => {
        setStats(statsData);
        setFocusWords(wordsData.slice(0, 5));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading dashboard data...</p>
      </div>
    );
  }

  const totalWords = stats?.totalWords || 122;
  const masteredCount = stats?.masteredCount || 0;
  const avgScore = stats?.averageScore || 0;
  const reviewedToday = stats?.reviewedToday || 0;
  const masteryPct = totalWords > 0 ? Math.round((masteredCount / totalWords) * 100) : 0;

  return (
    <div className="content-container">
      {/* 4 Standard Metrics Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">
            <span>Total Words</span>
            <span className="badge-tag">Syllabus</span>
          </div>
          <div className="kpi-value">{totalWords}</div>
          <div className="kpi-subtext">SAT question vocabulary</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">
            <span>Mastered</span>
            <span className="badge-mastered">{masteryPct}%</span>
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-success)' }}>{masteredCount}</div>
          <div className="kpi-subtext">Retained words</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">
            <span>Avg Quiz Score</span>
            <span className="badge-tag">Tests</span>
          </div>
          <div className="kpi-value" style={{ color: 'var(--accent-blue)' }}>{avgScore}%</div>
          <div className="kpi-subtext">Accuracy rating</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">
            <span>Reviewed Today</span>
            <span className="badge-tag">Daily</span>
          </div>
          <div className="kpi-value">{reviewedToday}</div>
          <div className="kpi-subtext">Words practiced today</div>
        </div>
      </div>

      {/* Main 2-Column Dashboard Layout */}
      <div className="dash-main-grid">
        {/* Left Column: Target Vocabulary Program */}
        <div className="pro-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)' }}>
                  Active Learning Program
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  High-probability words from recent SAT tests
                </p>
              </div>
              <Link to="/browse" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-blue)', textDecoration: 'none' }}>
                View all words →
              </Link>
            </div>

            <table className="pro-table">
              <thead>
                <tr>
                  <th>Word</th>
                  <th>Category</th>
                  <th>Definition</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {focusWords.map((word) => (
                  <tr key={word.term}>
                    <td style={{ fontWeight: '700', color: 'var(--text-main)' }}>{word.term}</td>
                    <td>
                      <span className="badge-tag">{word.category.split('(')[0].trim()}</span>
                    </td>
                    <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {word.definition}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link to="/flashcards" className="btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>
                        Study
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Showing top focus terms</span>
            <Link to="/quiz" style={{ color: 'var(--accent-blue)', fontWeight: '600', textDecoration: 'none' }}>
              Test your recall on these words ↗
            </Link>
          </div>
        </div>

        {/* Right Column: Mastery Status Overview */}
        <div className="pro-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)' }}>
                Mastery Overview
              </h2>
              <span className="badge-tag">Status</span>
            </div>

            {/* Circular Progress */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0' }}>
              <div style={{ position: 'relative', width: '150px', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    strokeWidth="8"
                    stroke="var(--bg-muted)"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    strokeWidth="8"
                    stroke="var(--accent-blue)"
                    fill="transparent"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * masteryPct) / 100}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                  />
                </svg>
                <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-main)' }}>
                    {masteredCount}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    of {totalWords} words
                  </span>
                </div>
              </div>

              {/* Progress Breakdown */}
              <div style={{ width: '100%', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent-blue)' }}></span>
                    <span style={{ color: 'var(--text-sub)' }}>Mastered Words</span>
                  </div>
                  <strong style={{ color: 'var(--text-main)' }}>{masteredCount}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--bg-muted)', border: '1px solid var(--border-card)' }}></span>
                    <span style={{ color: 'var(--text-sub)' }}>Remaining to Study</span>
                  </div>
                  <strong style={{ color: 'var(--text-main)' }}>{totalWords - masteredCount}</strong>
                </div>
              </div>
            </div>
          </div>

          <Link to="/flashcards" className="btn-primary" style={{ width: '100%', marginTop: '12px' }}>
            Continue Flashcards Session
          </Link>
        </div>
      </div>

      {/* Row 3: Study Modes & Recent Tests */}
      <div className="dash-main-grid">
        {/* Study Modes */}
        <div className="pro-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)' }}>
              Learning Modes
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Interactive tools</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            <Link
              to="/flashcards"
              className="pro-card"
              style={{ padding: '16px', textDecoration: 'none', backgroundColor: 'var(--bg-muted)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}
            >
              <div>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--accent-blue-light)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '12px', marginBottom: '10px' }}>
                  FC
                </div>
                <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>3D Flashcards</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Flip for definitions and contextual sentences</div>
              </div>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-blue)' }}>Start Review →</span>
            </Link>

            <Link
              to="/quiz"
              className="pro-card"
              style={{ padding: '16px', textDecoration: 'none', backgroundColor: 'var(--bg-muted)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}
            >
              <div>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--accent-blue-light)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '12px', marginBottom: '10px' }}>
                  QZ
                </div>
                <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>Quiz Mode</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Multiple choice exams with SQLite score storage</div>
              </div>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-blue)' }}>Take Quiz →</span>
            </Link>

            <Link
              to="/browse"
              className="pro-card"
              style={{ padding: '16px', textDecoration: 'none', backgroundColor: 'var(--bg-muted)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}
            >
              <div>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--accent-blue-light)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '12px', marginBottom: '10px' }}>
                  BR
                </div>
                <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>Browse & Search</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Search and filter vocabulary dictionary</div>
              </div>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-blue)' }}>Explore →</span>
            </Link>
          </div>
        </div>

        {/* Recent Quiz Scores */}
        <div className="pro-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)' }}>
                Recent Quiz Results
              </h2>
              <Link to="/quiz" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-blue)', textDecoration: 'none' }}>
                New Quiz
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats?.recentQuizzes && stats.recentQuizzes.length > 0 ? (
                stats.recentQuizzes.slice(0, 4).map((q) => {
                  const pct = Math.round((q.score / q.total_questions) * 100);
                  return (
                    <div
                      key={q.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-muted)',
                        fontSize: '12px',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                          Score: {q.score} / {q.total_questions}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(q.completed_at).toLocaleDateString()}
                        </div>
                      </div>
                      <span
                        className="badge-mastered"
                        style={{
                          backgroundColor: pct >= 80 ? 'var(--color-success-bg)' : 'var(--bg-card)',
                          color: pct >= 80 ? 'var(--color-success)' : pct >= 60 ? 'var(--color-warning)' : 'var(--color-danger)',
                        }}
                      >
                        {pct}%
                      </span>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <p>No tests recorded yet.</p>
                  <Link to="/quiz" className="btn-secondary" style={{ marginTop: '12px', display: 'inline-flex' }}>
                    Start First Test
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
