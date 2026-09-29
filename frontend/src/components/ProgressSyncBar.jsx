import React, { useRef, useState } from 'react';
import { exportUserProgress, importUserProgress } from '../api';
import { useAuth } from '../context/AuthContext';

export default function ProgressSyncBar({ userId, onDataUpdated }) {
  const { currentUser } = useAuth();
  const fileInputRef = useRef(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    try {
      setLoading(true);
      const data = await exportUserProgress(userId);
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      const safeName = currentUser ? currentUser.username : 'student_guest';
      downloadAnchor.setAttribute('download', `sat_vocab_progress_${safeName}_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setSyncStatus({ type: 'success', message: 'Progress file saved! Keep this file to restore anytime.' });
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (err) {
      setSyncStatus({ type: 'error', message: err.message || 'Export failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setLoading(true);
        const parsed = JSON.parse(event.target.result);
        const res = await importUserProgress(userId, parsed);
        setSyncStatus({ type: 'success', message: res.message });
        if (onDataUpdated) onDataUpdated();
        setTimeout(() => setSyncStatus(null), 5000);
      } catch (err) {
        setSyncStatus({ type: 'error', message: 'Invalid progress file format.' });
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="pro-card"
      style={{
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        backgroundColor: 'var(--bg-muted)',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>
            💾 Progress Backup & Cloud Sync
          </strong>
          <span className="badge-tag" style={{ fontSize: '10px' }}>
            Never Lose Data
          </span>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
          Download your progress backup file anytime or upload a saved file to restore your stats.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={handleExport}
          disabled={loading}
          className="btn-secondary"
          style={{ fontSize: '12px', padding: '6px 14px' }}
        >
          ⬇ Save Progress File
        </button>

        <button
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          disabled={loading}
          className="btn-primary"
          style={{ fontSize: '12px', padding: '6px 14px' }}
        >
          ⬆ Upload Progress File
        </button>

        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {syncStatus && (
        <div
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '600',
            backgroundColor: syncStatus.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
            color: syncStatus.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
          }}
        >
          {syncStatus.message}
        </div>
      )}
    </div>
  );
}
