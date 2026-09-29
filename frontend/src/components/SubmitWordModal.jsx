import React, { useState } from 'react';
import { submitWord } from '../api';
import { useAuth } from '../context/AuthContext';

export default function SubmitWordModal({ isOpen, onClose }) {
  const { currentUser } = useAuth();
  const [term, setTerm] = useState('');
  const [definition, setDefinition] = useState('');
  const [example, setExample] = useState('');
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: string }
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);

    if (!term.trim() || !definition.trim() || !example.trim()) {
      setStatus({ type: 'error', message: 'All fields (word, definition, and sentence) are required.' });
      return;
    }

    setLoading(true);
    try {
      const res = await submitWord(
        term.trim(),
        definition.trim(),
        example.trim(),
        currentUser ? currentUser.username : 'Student'
      );
      setStatus({ type: 'success', message: res.message });
      setTerm('');
      setDefinition('');
      setExample('');
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Failed to submit word.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="pro-card"
        style={{
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          padding: '28px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>
            Suggest a New SAT Word
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '18px' }}>
          Contribute a vocabulary word. Once reviewed and approved by an admin, it will be added to everyone's active study pool!
        </p>

        {status && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: status.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              color: status.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
              fontSize: '12px',
              fontWeight: '600',
              marginBottom: '16px',
              border: `1px solid ${status.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'}`,
            }}
          >
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              SAT Vocabulary Term
            </label>
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="e.g., Ubiquitous, Pernicious, Alacrity"
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-card)',
                backgroundColor: 'var(--bg-muted)',
                color: 'var(--text-main)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Clear Meaning / Definition
            </label>
            <textarea
              rows={2}
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              placeholder="Concise and precise SAT definition..."
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-card)',
                backgroundColor: 'var(--bg-muted)',
                color: 'var(--text-main)',
                fontSize: '13px',
                outline: 'none',
                resize: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Example Sentence in Context
            </label>
            <textarea
              rows={2}
              value={example}
              onChange={(e) => setExample(e.target.value)}
              placeholder="A sentence illustrating proper grammatical and contextual usage..."
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-card)',
                backgroundColor: 'var(--bg-muted)',
                color: 'var(--text-main)',
                fontSize: '13px',
                outline: 'none',
                resize: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Submitting...' : 'Submit for Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
