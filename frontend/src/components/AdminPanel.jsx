import React, { useState, useEffect } from 'react';
import { fetchPendingWords, approvePendingWord, rejectPendingWord } from '../api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export default function AdminPanel({ onOpenAuth }) {
  const { currentUser } = useAuth();
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState(null);

  const isAdmin = currentUser && currentUser.role === 'admin';

  const loadPending = async () => {
    try {
      setLoading(true);
      const data = await fetchPendingWords();
      setPending(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadPending();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const handleApprove = async (id, term) => {
    try {
      const res = await approvePendingWord(id, 'Student Submitted & Community');
      setActionMessage({ type: 'success', message: res.message });
      setPending((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setActionMessage({ type: 'error', message: err.message || 'Approval failed' });
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Are you sure you want to reject this word submission?')) return;
    try {
      const res = await rejectPendingWord(id);
      setActionMessage({ type: 'success', message: res.message });
      setPending((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setActionMessage({ type: 'error', message: err.message || 'Rejection failed' });
    }
  };

  if (!isAdmin) {
    return (
      <div className="content-container" style={{ maxWidth: '520px', margin: '60px auto' }}>
        <div className="pro-card" style={{ textAlign: 'center', padding: '36px' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔒</div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>
            Admin Access Required
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
            This portal is restricted to authorized administrators to review and approve community submitted vocabulary words.
          </p>

          <button onClick={onOpenAuth} className="btn-primary" style={{ padding: '10px 24px' }}>
            Log in as Admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="content-container">
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main)' }}>
            Admin Word Moderation Panel
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Logged in as <strong>{currentUser.username}</strong> (Administrator)
          </p>
        </div>

        <button onClick={loadPending} className="btn-secondary" style={{ fontSize: '12px' }}>
          ↻ Refresh Submissions
        </button>
      </div>

      {actionMessage && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: actionMessage.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
            color: actionMessage.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
            fontSize: '12px',
            fontWeight: '600',
            marginBottom: '18px',
            border: `1px solid ${actionMessage.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'}`,
          }}
        >
          {actionMessage.message}
        </div>
      )}

      {/* Pending Submissions */}
      <div className="pro-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)' }}>
            Pending Word Submissions ({pending.length})
          </h2>
          <span className="badge-tag">Community Queue</span>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
            Loading pending vocabulary submissions...
          </p>
        ) : pending.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>
              All clear! No pending submissions.
            </p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>
              Words submitted by students via "Add Your Word" will appear here for verification.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {pending.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-muted)',
                  border: '1px solid var(--border-card)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '16px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>
                      {item.term}
                    </h3>
                    <span className="badge-tag" style={{ fontSize: '10px' }}>
                      Submitted by: {item.submitted_by}
                    </span>
                  </div>

                  <p style={{ fontSize: '13px', color: 'var(--text-sub)', marginTop: '6px' }}>
                    <strong>Definition:</strong> {item.definition}
                  </p>

                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '4px' }}>
                    <strong>Usage:</strong> "{item.example}"
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    onClick={() => handleApprove(item.id, item.term)}
                    className="btn-primary"
                    style={{ backgroundColor: 'var(--color-success)', padding: '7px 14px', fontSize: '12px' }}
                  >
                    ✓ Approve & Publish
                  </button>
                  <button
                    onClick={() => handleReject(item.id)}
                    className="btn-secondary"
                    style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)', padding: '7px 14px', fontSize: '12px' }}
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
