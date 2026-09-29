import React, { useState, useEffect, useCallback } from 'react';
import { fetchWords, fetchCategories, fetchProgress, updateProgress } from '../api';

export default function Flashcards({ userId }) {
  const [words, setWords] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [progress, setProgress] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      fetchWords(selectedCategory ? { category: selectedCategory } : {}),
      fetchCategories(),
      fetchProgress(userId),
    ]).then(([wordsData, catsData, progData]) => {
      setWords(wordsData);
      setCategories(catsData);
      const progMap = {};
      progData.forEach((p) => {
        progMap[p.word_term] = p.is_mastered === 1;
      });
      setProgress(progMap);
      setLoading(false);
      setCurrentIndex(0);
      setFlipped(false);
    });
  }, [userId, selectedCategory]);

  const currentWord = words[currentIndex];
  const isMastered = currentWord ? progress[currentWord.term] || false : false;

  const goNext = useCallback(() => {
    setFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % words.length);
    }, 120);
  }, [words.length]);

  const goPrev = useCallback(() => {
    setFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + words.length) % words.length);
    }, 120);
  }, [words.length]);

  const toggleMastered = async () => {
    if (!currentWord || !userId) return;
    const newState = !isMastered;
    setProgress((prev) => ({ ...prev, [currentWord.term]: newState }));
    await updateProgress(userId, currentWord.term, newState);
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'd') goNext();
      else if (e.key === 'ArrowLeft' || e.key === 'a') goPrev();
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMastered();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev, currentWord, isMastered]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading flashcards...</p>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="pro-card" style={{ maxWidth: '400px', margin: '60px auto', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>No words match this category.</p>
        <button onClick={() => setSelectedCategory('')} className="btn-secondary">
          Reset Filter
        </button>
      </div>
    );
  }

  return (
    <div className="content-container" style={{ maxWidth: '800px' }}>
      {/* Title */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)' }}>3D Flashcards</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Click or press <kbd style={{ padding: '2px 5px', borderRadius: '4px', backgroundColor: 'var(--bg-muted)', border: '1px solid var(--border-card)', fontSize: '11px', fontFamily: 'monospace' }}>Space</kbd> to flip. Navigate using <kbd style={{ padding: '2px 5px', borderRadius: '4px', backgroundColor: 'var(--bg-muted)', border: '1px solid var(--border-card)', fontSize: '11px', fontFamily: 'monospace' }}>←</kbd> <kbd style={{ padding: '2px 5px', borderRadius: '4px', backgroundColor: 'var(--bg-muted)', border: '1px solid var(--border-card)', fontSize: '11px', fontFamily: 'monospace' }}>→</kbd>.
        </p>
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '16px' }}>
        <button
          onClick={() => setSelectedCategory('')}
          className={!selectedCategory ? 'btn-primary' : 'btn-secondary'}
          style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '20px', whiteSpace: 'nowrap' }}
        >
          All Words ({words.length})
        </button>
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={isSelected ? 'btn-primary' : 'btn-secondary'}
              style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '20px', whiteSpace: 'nowrap' }}
            >
              {cat.split('(')[0].trim()}
            </button>
          );
        })}
      </div>

      {/* Counter bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <strong style={{ color: 'var(--text-main)', fontFamily: 'monospace' }}>
            {currentIndex + 1} / {words.length}
          </strong>
          {isMastered && <span className="badge-mastered">✓ Mastered</span>}
        </div>
        <span>{currentWord.category.split('(')[0].trim()}</span>
      </div>

      {/* Progress Line */}
      <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden', marginBottom: '24px' }}>
        <div
          style={{
            height: '100%',
            backgroundColor: 'var(--accent-blue)',
            width: `${((currentIndex + 1) / words.length) * 100}%`,
            transition: 'width 0.2s ease',
          }}
        />
      </div>

      {/* 3D Card */}
      <div className="fc-card-stage">
        <div
          className={`fc-card-flipper ${flipped ? 'flipped' : ''}`}
          onClick={() => setFlipped(!flipped)}
        >
          {/* Front */}
          <div className="fc-face">
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Vocabulary Term
            </span>
            <h2 style={{ fontSize: '36px', fontWeight: '800', color: 'var(--text-main)', textAlign: 'center' }}>
              {currentWord.term}
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '20px' }}>
              Click or press Space to reveal definition
            </p>
          </div>

          {/* Back */}
          <div className="fc-face fc-back">
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '700', color: 'var(--accent-blue)', marginBottom: '12px' }}>
              Definition
            </span>
            <p style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-main)', textAlign: 'center', maxWidth: '520px', lineHeight: 1.5, marginBottom: '20px' }}>
              {currentWord.definition}
            </p>
            <div style={{ width: '40px', height: '1px', backgroundColor: 'var(--border-card)', marginBottom: '16px' }}></div>
            <p style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--text-sub)', textAlign: 'center', maxWidth: '500px' }}>
              "{currentWord.example}"
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={goPrev} className="btn-secondary">
            ← Previous
          </button>
          <button onClick={goNext} className="btn-secondary">
            Next →
          </button>
        </div>

        <button
          onClick={toggleMastered}
          className={isMastered ? 'btn-secondary' : 'btn-primary'}
          style={{
            borderColor: isMastered ? 'var(--color-success)' : 'transparent',
            color: isMastered ? 'var(--color-success)' : '#ffffff',
          }}
        >
          {isMastered ? '✓ Mastered (Click to Unmark)' : 'Mark as Mastered'}
        </button>
      </div>
    </div>
  );
}
