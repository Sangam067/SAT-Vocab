import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { fetchWords, fetchCategories, fetchProgress, updateProgress } from '../api';

export default function Browse({ userId }) {
  const [searchParams] = useSearchParams();
  const [allWords, setAllWords] = useState([]);
  const [categories, setCategories] = useState([]);
  const [progress, setProgress] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filterMastery, setFilterMastery] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchTerm(q);
  }, [searchParams]);

  useEffect(() => {
    if (!userId) return;
    Promise.all([fetchWords(), fetchCategories(), fetchProgress(userId)])
      .then(([wordsData, catsData, progData]) => {
        setAllWords(wordsData);
        setCategories(catsData);
        const progMap = {};
        progData.forEach((p) => {
          progMap[p.word_term] = p.is_mastered === 1;
        });
        setProgress(progMap);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  const filteredWords = useMemo(() => {
    return allWords.filter((word) => {
      const matchSearch =
        !searchTerm ||
        word.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
        word.definition.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory = !selectedCategory || word.category === selectedCategory;

      const isMastered = progress[word.term] || false;
      const matchMastery =
        filterMastery === 'all'
          ? true
          : filterMastery === 'mastered'
          ? isMastered
          : !isMastered;

      return matchSearch && matchCategory && matchMastery;
    });
  }, [allWords, searchTerm, selectedCategory, filterMastery, progress]);

  const toggleMastered = async (term) => {
    if (!userId) return;
    const newState = !progress[term];
    setProgress((prev) => ({ ...prev, [term]: newState }));
    await updateProgress(userId, term, newState);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading dictionary...</p>
      </div>
    );
  }

  return (
    <div className="content-container">
      {/* Title */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)' }}>Browse Vocabulary</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Search, filter by subject area, and track mastery state.
        </p>
      </div>

      {/* Filter Card */}
      <div className="pro-card" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Search */}
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search vocabulary words or definitions..."
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid var(--border-card)',
            backgroundColor: 'var(--bg-muted)',
            color: 'var(--text-main)',
            fontSize: '13px',
            outline: 'none',
          }}
        />

        {/* Categories */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          <button
            onClick={() => setSelectedCategory('')}
            className={!selectedCategory ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '20px', whiteSpace: 'nowrap' }}
          >
            All Categories
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

        {/* Status toggles */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', fontSize: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Status:</span>
            {['all', 'mastered', 'unmastered'].map((f) => (
              <button
                key={f}
                onClick={() => setFilterMastery(f)}
                style={{
                  border: 'none',
                  background: filterMastery === f ? 'var(--accent-blue-light)' : 'transparent',
                  color: filterMastery === f ? 'var(--accent-blue)' : 'var(--text-muted)',
                  fontWeight: filterMastery === f ? '700' : '500',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  fontSize: '12px',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          <span style={{ color: 'var(--text-muted)' }}>
            Showing <strong>{filteredWords.length}</strong> of {allWords.length}
          </span>
        </div>
      </div>

      {/* Grid */}
      {filteredWords.length === 0 ? (
        <div className="pro-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <p>No words match your filters.</p>
          <button
            onClick={() => { setSearchTerm(''); setSelectedCategory(''); setFilterMastery('all'); }}
            className="btn-secondary"
            style={{ marginTop: '12px' }}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredWords.map((word) => {
            const isMastered = progress[word.term] || false;
            return (
              <div key={word.term} className="pro-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '14px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)' }}>{word.term}</h3>
                    {isMastered && <span className="badge-mastered">✓ Mastered</span>}
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-sub)', marginTop: '8px', lineHeight: 1.4 }}>
                    {word.definition}
                  </p>
                  <p style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-muted)', marginTop: '8px' }}>
                    "{word.example}"
                  </p>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {word.category.split('(')[0].trim()}
                  </span>
                  <button
                    onClick={() => toggleMastered(word.term)}
                    className="btn-secondary"
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      color: isMastered ? 'var(--color-success)' : 'var(--accent-blue)',
                      borderColor: isMastered ? 'var(--color-success)' : 'var(--border-card)',
                    }}
                  >
                    {isMastered ? 'Unmark' : 'Mark Mastered'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
