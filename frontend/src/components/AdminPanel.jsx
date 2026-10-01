import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchPendingWords,
  approvePendingWord,
  rejectPendingWord,
  updatePendingWord,
  fetchAdminWords,
  updateApprovedWord,
} from '../api';
import { useAuth } from '../context/AuthContext';

/* ─── Field helper ────────────────────────────────────────────────────────── */
function Field({ label, value, onChange, multiline }) {
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      <Tag
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={multiline ? 3 : undefined}
        style={{
          background: 'var(--bg-main)',
          border: '1px solid var(--border-card)',
          borderRadius: '6px',
          color: 'var(--text-main)',
          fontSize: '13px',
          padding: '8px 10px',
          resize: multiline ? 'vertical' : undefined,
          fontFamily: 'inherit',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => (e.target.style.borderColor = 'var(--color-accent)')}
        onBlur={(e) => (e.target.style.borderColor = 'var(--border-card)')}
      />
    </div>
  );
}

/* ─── Edit Modal ──────────────────────────────────────────────────────────── */
function EditModal({ word, onSave, onClose, isPending }) {
  const [term, setTerm] = useState(word.term || '');
  const [definition, setDefinition] = useState(word.definition || '');
  const [example, setExample] = useState(word.example || '');
  const [category, setCategory] = useState(word.category || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({ term, definition, example, category });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: '16px',
          padding: '28px',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
              ✏️ Edit Word
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {isPending ? 'Editing pending submission' : 'Editing published vocabulary word'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--text-muted)', lineHeight: 1, padding: '0 4px' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <Field label="Term" value={term} onChange={setTerm} />
        <Field label="Definition" value={definition} onChange={setDefinition} multiline />
        <Field label="Example sentence" value={example} onChange={setExample} multiline />
        {!isPending && (
          <Field label="Category" value={category} onChange={setCategory} />
        )}

        {error && (
          <div style={{ padding: '8px 12px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--color-danger)' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button onClick={onClose} className="btn-secondary" style={{ fontSize: '12px', padding: '8px 16px' }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn-primary"
            disabled={saving}
            style={{ fontSize: '12px', padding: '8px 20px' }}
          >
            {saving ? 'Saving…' : '✓ Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main AdminPanel ─────────────────────────────────────────────────────── */
export default function AdminPanel({ onOpenAuth }) {
  const { currentUser } = useAuth();
  const isAdmin = currentUser && currentUser.role === 'admin';

  const [pending, setPending] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(true);

  const [publishedWords, setPublishedWords] = useState([]);
  const [publishedLoading, setPublishedLoading] = useState(false);
  const [wordSearch, setWordSearch] = useState('');
  const searchTimer = useRef(null);

  const [actionMessage, setActionMessage] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  const flash = (type, message) => {
    setActionMessage({ type, message });
    setTimeout(() => setActionMessage(null), 4000);
  };

  const loadPending = useCallback(async () => {
    try {
      setPendingLoading(true);
      const data = await fetchPendingWords();
      setPending(data);
    } catch (err) {
      console.error(err);
    } finally {
      setPendingLoading(false);
    }
  }, []);

  const loadPublished = useCallback(async (search = '') => {
    try {
      setPublishedLoading(true);
      const data = await fetchAdminWords(search);
      setPublishedWords(data);
    } catch (err) {
      console.error(err);
    } finally {
      setPublishedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadPending();
      loadPublished();
    } else {
      setPendingLoading(false);
    }
  }, [isAdmin, loadPending, loadPublished]);

  useEffect(() => {
    if (!isAdmin) return;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadPublished(wordSearch), 350);
    return () => clearTimeout(searchTimer.current);
  }, [wordSearch, isAdmin, loadPublished]);

  const handleApprove = async (id) => {
    try {
      const res = await approvePendingWord(id, 'Student Submitted & Community');
      flash('success', res.message);
      setPending((prev) => prev.filter((item) => item.id !== id));
      loadPublished(wordSearch);
    } catch (err) {
      flash('error', err.message || 'Approval failed');
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Are you sure you want to reject this word submission?')) return;
    try {
      const res = await rejectPendingWord(id);
      flash('success', res.message);
      setPending((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      flash('error', err.message || 'Rejection failed');
    }
  };

  const handleEditSave = async ({ term, definition, example, category }) => {
    const { word, isPending: isP } = editTarget;
    if (isP) {
      const res = await updatePendingWord(word.id, { term, definition, example });
      setPending((prev) => prev.map((w) => (w.id === word.id ? res.word : w)));
      flash('success', res.message);
    } else {
      const res = await updateApprovedWord(word.id, { term, definition, example, category });
      setPublishedWords((prev) => prev.map((w) => (w.id === word.id ? res.word : w)));
      flash('success', res.message);
    }
    setEditTarget(null);
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
            This portal is restricted to authorized administrators to review, edit, and approve community submitted vocabulary words.
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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main)' }}>
            Admin Word Management
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Logged in as <strong>{currentUser.username}</strong> (Administrator)
          </p>
        </div>
        <button
          onClick={() => { loadPending(); loadPublished(wordSearch); }}
          className="btn-secondary"
          style={{ fontSize: '12px' }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Banner */}
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

      {/* ── Section 1: Pending submissions ──────────────────────────────────── */}
      <div className="pro-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)' }}>
            Pending Word Submissions ({pending.length})
          </h2>
          <span className="badge-tag">Community Queue</span>
        </div>

        {pendingLoading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
            Loading pending vocabulary submissions…
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
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
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
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setEditTarget({ word: item, isPending: true })}
                      className="btn-secondary"
                      style={{ padding: '7px 14px', fontSize: '12px' }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleApprove(item.id)}
                      className="btn-primary"
                      style={{ backgroundColor: 'var(--color-success)', padding: '7px 14px', fontSize: '12px' }}
                    >
                      ✓ Approve &amp; Publish
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 2: Manage published words ──────────────────────────────── */}
      <div className="pro-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
              Manage Published Words ({publishedWords.length})
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
              Edit definitions, examples, and categories of any word in the vocabulary database.
            </p>
          </div>
          <span className="badge-tag">Live Vocabulary</span>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', pointerEvents: 'none' }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Search words or definitions…"
            value={wordSearch}
            onChange={(e) => setWordSearch(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              paddingLeft: '36px',
              paddingRight: '12px',
              paddingTop: '9px',
              paddingBottom: '9px',
              background: 'var(--bg-muted)',
              border: '1px solid var(--border-card)',
              borderRadius: '8px',
              color: 'var(--text-main)',
              fontSize: '13px',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {publishedLoading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
            Loading vocabulary…
          </p>
        ) : publishedWords.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
            {wordSearch ? `No words found matching "${wordSearch}".` : 'No words in the database yet.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '480px', overflowY: 'auto', paddingRight: '4px' }}>
            {publishedWords.map((word) => (
              <div
                key={word.id}
                style={{
                  padding: '11px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-muted)',
                  border: '1px solid var(--border-card)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)' }}>
                      {word.term}
                    </span>
                    {word.category && (
                      <span className="badge-tag" style={{ fontSize: '10px' }}>{word.category}</span>
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-sub)', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {word.definition}
                  </p>
                </div>
                <button
                  onClick={() => setEditTarget({ word, isPending: false })}
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '6px 12px', flexShrink: 0 }}
                >
                  ✏️ Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editTarget && (
        <EditModal
          word={editTarget.word}
          isPending={editTarget.isPending}
          onSave={handleEditSave}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}

