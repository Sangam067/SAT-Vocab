import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchDailyGoal, updateDailyGoal, submitDailyQuiz, recordCardReview, fetchWords } from '../api';
import { useAuth } from '../context/AuthContext';

// ── Session persistence helpers (survives refresh, cleared when tab closes) ──
function getSessionKey(userId) {
  const today = new Date().toISOString().split('T')[0];
  return `sat_daily_session_${userId}_${today}`;
}
function loadSession(userId) {
  try {
    const raw = sessionStorage.getItem(getSessionKey(userId));
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (Array.isArray(s.reviewedSet)) s.reviewedSet = new Set(s.reviewedSet);
    return s;
  } catch (e) { return null; }
}
function saveSession(userId, state) {
  try {
    sessionStorage.setItem(getSessionKey(userId), JSON.stringify({
      ...state,
      reviewedSet: Array.from(state.reviewedSet || []),
    }));
  } catch (e) {}
}
function clearSession(userId) {
  try { sessionStorage.removeItem(getSessionKey(userId)); } catch (e) {}
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function DailyGoalSection({ userId, onOpenAuth }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // ── Phase: 'setup' → 'flashcards' → 'quiz' → 'results'
  const [phase, setPhase] = useState('setup');

  // Setup
  const [goalInput, setGoalInput] = useState('');
  const [goalError, setGoalError] = useState('');
  const [startingSession, setStartingSession] = useState(false);

  // Data
  const [goalData, setGoalData] = useState(null);
  const [allWordsPool, setAllWordsPool] = useState([]);
  const [loading, setLoading] = useState(true);

  // Flashcards
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewedSet, setReviewedSet] = useState(new Set()); // terms the user has flipped/seen

  // Quiz
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizIdx, setQuizIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState(null);

  // ── Persist session whenever phase/card/quiz state changes ──────────────
  useEffect(() => {
    if (!userId || loading || phase === 'setup') return;
    saveSession(userId, { phase, cardIdx, reviewedSet, quizQuestions, quizIdx, userAnswers, quizResult });
  }, [phase, cardIdx, reviewedSet, quizQuestions, quizIdx, userAnswers, quizResult, userId, loading]);

  // ── Initial load: fetch goal data then restore session if one exists ─────
  const loadInitialData = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const [goalRes, wordsRes] = await Promise.all([
        fetchDailyGoal(userId),
        fetchWords(),
      ]);
      setGoalData(goalRes);
      setAllWordsPool(wordsRes);
      setGoalInput(String(goalRes.daily_goal || 5));

      // Try to restore an in-progress session from this browser tab
      const saved = loadSession(userId);
      if (saved && saved.phase && saved.phase !== 'setup' && goalRes.daily_batch?.length > 0) {
        setPhase(saved.phase);
        setCardIdx(saved.cardIdx || 0);
        setReviewedSet(saved.reviewedSet instanceof Set ? saved.reviewedSet : new Set(saved.reviewedSet || []));
        setQuizQuestions(saved.quizQuestions || []);
        setQuizIdx(saved.quizIdx || 0);
        setUserAnswers(saved.userAnswers || {});
        setQuizResult(saved.quizResult || null);
      } else {
        // No saved session – always show goal selection first
        setPhase('setup');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // ── Handle "Start Session" from setup phase
  const handleStartSession = async () => {
    const num = parseInt(goalInput, 10);
    if (isNaN(num) || num < 5 || num > 50) {
      setGoalError('Please enter a number between 5 and 50.');
      return;
    }
    setGoalError('');
    setStartingSession(true);
    try {
      await updateDailyGoal(userId, num);
      const freshGoal = await fetchDailyGoal(userId);
      setGoalData(freshGoal);
      setCardIdx(0);
      setFlipped(false);
      setReviewedSet(new Set());
      setQuizQuestions([]);
      setQuizIdx(0);
      setUserAnswers({});
      setQuizResult(null);
      // Clear stale session so we start fresh with new goal
      clearSession(userId);
      setPhase('flashcards');
    } catch (err) {
      console.error(err);
      setGoalError('Failed to start session. Try again.');
    } finally {
      setStartingSession(false);
    }
  };

  // ── Flashcard helpers
  const dailyBatch = goalData?.daily_batch || [];
  const currentCard = dailyBatch[cardIdx];
  const allReviewed = dailyBatch.length > 0 && reviewedSet.size >= dailyBatch.length;

  const markCurrentReviewed = (term) => {
    setReviewedSet((prev) => {
      const next = new Set(prev);
      next.add(term.toLowerCase());
      return next;
    });
  };

  const speakWord = (text) => {
    if ('speechSynthesis' in window && text) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9;
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    }
  };

  // Keyboard shortcuts during flashcards
  useEffect(() => {
    if (phase !== 'flashcards') return;
    const handler = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setFlipped((f) => !f);
        if (currentCard) markCurrentReviewed(currentCard.term);
      } else if (e.code === 'ArrowRight' && cardIdx < dailyBatch.length - 1) {
        if (currentCard) markCurrentReviewed(currentCard.term);
        setFlipped(false);
        setCardIdx((i) => i + 1);
      } else if (e.code === 'ArrowLeft' && cardIdx > 0) {
        setFlipped(false);
        setCardIdx((i) => i - 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, cardIdx, dailyBatch.length, currentCard]);

  // ── Build quiz from today's batch
  const startQuiz = async () => {
    // record all terms as reviewed before entering quiz
    try {
      await recordCardReview(userId, dailyBatch.map((w) => w.term));
    } catch (_) { }

    const questions = dailyBatch.map((word) => {
      const others = allWordsPool.filter(
        (w) => w.term.toLowerCase() !== word.term.toLowerCase()
      );
      const distractors = shuffle(others).slice(0, 3).map((w) => w.definition);
      const options = shuffle([word.definition, ...distractors]);
      return {
        term: word.term,
        category: word.category,
        example: word.example,
        correctDefinition: word.definition,
        options,
      };
    });

    setQuizQuestions(shuffle(questions));
    setQuizIdx(0);
    setUserAnswers({});
    setQuizResult(null);
    setPhase('quiz');
  };

  // ── Quiz answer
  const handlePickAnswer = (idx, opt) => {
    if (userAnswers[idx] !== undefined) return;
    setUserAnswers((prev) => ({ ...prev, [idx]: opt }));
  };

  // ── Finish quiz
  const handleFinishQuiz = async () => {
    setSubmittingQuiz(true);
    try {
      const payload = quizQuestions.map((q, i) => ({
        term: q.term,
        is_correct: userAnswers[i] === q.correctDefinition,
      }));
      const res = await submitDailyQuiz(userId, payload);
      const result = {
        score: res.score,
        total: res.total_questions,
        mastered: res.mastered_terms || [],
        review: res.review_terms || [],
        details: quizQuestions.map((q, i) => ({
          term: q.term,
          definition: q.correctDefinition,
          example: q.example,
          correct: userAnswers[i] === q.correctDefinition,
          picked: userAnswers[i],
        })),
      };
      setQuizResult(result);
      setPhase('results');
      // Clear persisted session — today's session is fully done!
      clearSession(userId);
      // refresh data
      const fresh = await fetchDailyGoal(userId);
      setGoalData(fresh);
    } catch (err) {
      console.error(err);
      alert('Failed to submit quiz. Please try again.');
    } finally {
      setSubmittingQuiz(false);
    }
  };

  // ── Loading
  if (loading) {
    return (
      <div className="content-container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '10px' }}>🎯</div>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading daily learning session…</p>
      </div>
    );
  }

  const totalMastered = goalData?.total_mastered || 0;
  const totalWords = goalData?.total_words || 0;

  /* ═══════════════════════════════════════════════════════════════════════════
     PHASE 1 — SETUP: choose how many words (5–50)
     ═══════════════════════════════════════════════════════════════════════════ */
  if (phase === 'setup') {
    return (
      <div className="content-container" style={{ maxWidth: '540px', margin: '60px auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎯</div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Set Your Goal Today
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5 }}>
            Choose how many words you want to practice today (5–50).<br />
            After selecting your number, your flashcards learning portal will open.
          </p>
        </div>

        <div className="pro-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Stats strip */}
          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-success)' }}>{totalMastered}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Mastered</div>
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--accent-blue)' }}>{totalWords - totalMastered}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Remaining</div>
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)' }}>{totalWords}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Total Words</div>
            </div>
          </div>

          {/* Input field */}
          <div>
            <label
              htmlFor="goal-input"
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '700',
                color: 'var(--text-main)',
                marginBottom: '8px',
              }}
            >
              How many words do you want to practice today?
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                id="goal-input"
                type="number"
                min="5"
                max="50"
                value={goalInput}
                onChange={(e) => {
                  setGoalInput(e.target.value);
                  setGoalError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleStartSession()}
                placeholder="e.g. 10"
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  fontSize: '18px',
                  fontWeight: '700',
                  borderRadius: '10px',
                  border: goalError ? '2px solid var(--color-danger)' : '1px solid var(--border-card)',
                  backgroundColor: 'var(--bg-muted)',
                  color: 'var(--text-main)',
                  outline: 'none',
                  textAlign: 'center',
                  transition: 'border-color 0.2s',
                }}
              />
              <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '600', whiteSpace: 'nowrap' }}>
                words
              </span>
            </div>
            <p style={{ fontSize: '12px', color: goalError ? 'var(--color-danger)' : 'var(--text-muted)', marginTop: '6px' }}>
              {goalError || 'Minimum 5, maximum 50. Random unmastered words will be selected — no duplicates.'}
            </p>
          </div>

          {/* Quick-pick buttons */}
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Quick Pick:
            </span>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              {[5, 10, 15, 20, 30, 50].map((n) => (
                <button
                  key={n}
                  onClick={() => { setGoalInput(String(n)); setGoalError(''); }}
                  className={goalInput === String(n) ? 'btn-primary' : 'btn-secondary'}
                  style={{ fontSize: '13px', padding: '7px 16px', minWidth: '48px', fontWeight: '600' }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Start button */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={handleStartSession}
              disabled={startingSession}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '15px',
                fontWeight: '700',
                borderRadius: '10px',
                boxShadow: '0 4px 16px rgba(37, 99, 235, 0.3)',
              }}
            >
              {startingSession
                ? 'Opening your flashcards portal…'
                : `Open Flashcards Portal (${goalInput || 5} Words) →`}
            </button>

            {dailyBatch.length > 0 && (
              <button
                type="button"
                onClick={() => setPhase('flashcards')}
                className="btn-secondary"
                style={{
                  width: '100%',
                  padding: '11px',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: '10px',
                }}
              >
                Resume Current Batch ({dailyBatch.length} Words) →
              </button>
            )}
          </div>

          <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4 }}>
            💡 After reviewing all flashcards, a quiz will unlock. Correct quiz answers mark words as <strong>Mastered</strong>
            {' '}(won't reappear). Wrong answers can return the next day.
          </p>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     PHASE 2 — FLASHCARDS: review every card, quiz unlocks when all are seen
     ═══════════════════════════════════════════════════════════════════════════ */
  if (phase === 'flashcards') {
    const progressPct = dailyBatch.length > 0 ? Math.round((reviewedSet.size / dailyBatch.length) * 100) : 0;

    return (
      <div className="content-container" style={{ maxWidth: '960px', margin: '0 auto', paddingBottom: '60px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main)' }}>
              🎴 Step 1: Study Flashcards
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Flip every card to learn the word. The quiz unlocks after you've reviewed <strong>all {dailyBatch.length} cards</strong>.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => { setPhase('setup'); setReviewedSet(new Set()); }}
              className="btn-secondary"
              style={{ fontSize: '12px', padding: '6px 14px' }}
            >
              ← Change Goal
            </button>
            <span
              className="badge-tag"
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: '700',
                backgroundColor: allReviewed ? 'var(--color-success-bg)' : undefined,
                color: allReviewed ? 'var(--color-success)' : undefined,
                borderColor: allReviewed ? 'var(--color-success)' : undefined,
              }}
            >
              {allReviewed ? '✓ All Reviewed!' : `${reviewedSet.size} / ${dailyBatch.length} Reviewed`}
            </span>
          </div>
        </div>

        {/* Review progress bar */}
        <div style={{ width: '100%', height: '6px', borderRadius: '4px', backgroundColor: 'var(--border-subtle)', overflow: 'hidden', marginBottom: '24px' }}>
          <div
            style={{
              width: `${progressPct}%`,
              height: '100%',
              backgroundColor: allReviewed ? 'var(--color-success)' : 'var(--accent-blue)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* Main flashcard area */}
        {currentCard && (
          <div className="pro-card" style={{ padding: '28px', marginBottom: '20px' }}>
            {/* Card header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="badge-tag" style={{ fontSize: '12px', fontWeight: '700' }}>
                  Card {cardIdx + 1} / {dailyBatch.length}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {currentCard.category}
                </span>
                {reviewedSet.has(currentCard.term.toLowerCase()) && (
                  <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: '700' }}>✓ Seen</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {currentCard.is_mastered && (
                  <span className="badge-mastered" style={{ padding: '4px 10px', fontSize: '11px' }}>Already Mastered</span>
                )}
                <button
                  onClick={() => speakWord(currentCard.term)}
                  className="btn-secondary"
                  style={{ padding: '5px 10px', fontSize: '12px' }}
                >
                  🔊 Hear It
                </button>
              </div>
            </div>

            {/* Flip card */}
            <div
              style={{ height: '300px', perspective: '1200px', cursor: 'pointer', marginBottom: '20px' }}
              onClick={() => {
                setFlipped((f) => !f);
                markCurrentReviewed(currentCard.term);
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: flipped ? 'rotateY(180deg)' : 'none',
                }}
              >
                {/* Front */}
                <div
                  style={{
                    position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                    borderRadius: '14px', backgroundColor: 'var(--bg-muted)', border: '2px solid var(--border-card)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                    padding: '32px', textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent-blue)', fontWeight: '800', letterSpacing: '0.08em', marginBottom: '14px' }}>
                    SAT Vocabulary
                  </span>
                  <h2 style={{ fontSize: '38px', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                    {currentCard.term}
                  </h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '18px' }}>
                    👆 Click or press <strong>Space</strong> to reveal definition
                  </p>
                </div>

                {/* Back */}
                <div
                  style={{
                    position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
                    borderRadius: '14px', backgroundColor: 'var(--bg-surface)', border: '2px solid var(--accent-blue)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                    padding: '32px', textAlign: 'center',
                    boxShadow: '0 8px 30px rgba(37, 99, 235, 0.1)',
                  }}
                >
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent-blue)', fontWeight: '800', letterSpacing: '0.08em', marginBottom: '10px' }}>
                    Definition
                  </span>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', lineHeight: 1.5, marginBottom: '18px', maxWidth: '600px' }}>
                    {currentCard.definition}
                  </h3>
                  <div style={{ backgroundColor: 'var(--bg-muted)', padding: '12px 20px', borderRadius: '10px', borderLeft: '4px solid var(--accent-blue)', maxWidth: '600px' }}>
                    <p style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--text-sub)' }}>
                      "{currentCard.example}"
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Card navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  disabled={cardIdx === 0}
                  onClick={() => { setFlipped(false); setCardIdx((i) => i - 1); }}
                  className="btn-secondary"
                  style={{ fontSize: '13px', padding: '8px 16px' }}
                >
                  ← Prev
                </button>
                <button
                  disabled={cardIdx >= dailyBatch.length - 1}
                  onClick={() => {
                    markCurrentReviewed(currentCard.term);
                    setFlipped(false);
                    setCardIdx((i) => i + 1);
                  }}
                  className="btn-secondary"
                  style={{ fontSize: '13px', padding: '8px 16px' }}
                >
                  Next →
                </button>
                <button
                  onClick={() => { setFlipped((f) => !f); markCurrentReviewed(currentCard.term); }}
                  className="btn-secondary"
                  style={{ fontSize: '13px', padding: '8px 16px' }}
                >
                  🔄 Flip
                </button>
              </div>

              {/* Quiz unlock button */}
              {allReviewed ? (
                <button
                  onClick={startQuiz}
                  className="btn-primary"
                  style={{
                    fontSize: '14px', padding: '10px 22px',
                    boxShadow: '0 4px 16px rgba(37, 99, 235, 0.3)',
                    animation: 'pulse-glow 2s infinite',
                  }}
                >
                  ✅ All Cards Reviewed — Take Quiz Now →
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    🔒 Review all {dailyBatch.length} cards to unlock quiz
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Word list grid — quick jump */}
        <div className="pro-card" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '12px' }}>
            Today's Words ({reviewedSet.size}/{dailyBatch.length} reviewed):
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '8px' }}>
            {dailyBatch.map((w, i) => {
              const seen = reviewedSet.has(w.term.toLowerCase());
              const active = i === cardIdx;
              return (
                <div
                  key={w.id || w.term}
                  onClick={() => { setCardIdx(i); setFlipped(false); }}
                  style={{
                    padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                    border: active ? '2px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                    backgroundColor: active ? 'var(--accent-blue-light)' : seen ? 'var(--color-success-bg)' : 'var(--bg-surface)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>{w.term}</span>
                    {seen && <span style={{ color: 'var(--color-success)', fontSize: '12px' }}>✓</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     PHASE 3 — QUIZ: test from today's words only
     ═══════════════════════════════════════════════════════════════════════════ */
  if (phase === 'quiz' && quizQuestions.length > 0) {
    const q = quizQuestions[quizIdx];
    const chosen = userAnswers[quizIdx];
    const answered = chosen !== undefined;
    const isCorrect = chosen === q.correctDefinition;
    const totalAnswered = Object.keys(userAnswers).length;
    const allDone = totalAnswered === quizQuestions.length;

    return (
      <div className="content-container" style={{ maxWidth: '740px', margin: '0 auto', paddingBottom: '60px' }}>
        {/* Quiz header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent-blue)', fontWeight: '800', letterSpacing: '0.06em' }}>
              📝 Today's Retention Quiz
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
              Question {quizIdx + 1} of {quizQuestions.length}
            </h2>
          </div>
          <span className="badge-tag" style={{ fontSize: '12px' }}>
            {totalAnswered}/{quizQuestions.length} Answered
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ width: '100%', height: '6px', borderRadius: '4px', backgroundColor: 'var(--border-subtle)', overflow: 'hidden', marginBottom: '28px' }}>
          <div style={{ width: `${((quizIdx + 1) / quizQuestions.length) * 100}%`, height: '100%', backgroundColor: 'var(--accent-blue)', transition: 'width 0.2s ease' }} />
        </div>

        {/* Question prompt */}
        <div className="pro-card" style={{ padding: '28px', marginBottom: '20px' }}>
          <div style={{ backgroundColor: 'var(--bg-muted)', padding: '22px', borderRadius: '12px', marginBottom: '22px', border: '1px solid var(--border-card)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>What is the meaning of:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
              <h3 style={{ fontSize: '30px', fontWeight: '800', color: 'var(--text-main)' }}>{q.term}</h3>
              <button onClick={() => speakWord(q.term)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>🔊</button>
            </div>
          </div>

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
            {q.options.map((opt, oi) => {
              const letter = String.fromCharCode(65 + oi);
              const isThis = chosen === opt;
              const isRight = opt === q.correctDefinition;

              let bg = 'var(--bg-surface)';
              let border = '1px solid var(--border-card)';
              let color = 'var(--text-main)';

              if (answered) {
                if (isRight) {
                  bg = 'var(--color-success-bg)';
                  border = '2px solid var(--color-success)';
                  color = 'var(--color-success)';
                } else if (isThis) {
                  bg = 'var(--color-danger-bg)';
                  border = '2px solid var(--color-danger)';
                  color = 'var(--color-danger)';
                }
              } else if (isThis) {
                bg = 'var(--accent-blue-light)';
                border = '2px solid var(--accent-blue)';
              }

              return (
                <div
                  key={oi}
                  onClick={() => handlePickAnswer(quizIdx, opt)}
                  style={{
                    padding: '14px 18px', borderRadius: '10px', backgroundColor: bg, border,
                    cursor: answered ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{
                    fontWeight: '800', fontSize: '12px', minWidth: '24px', height: '24px',
                    borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: (answered && isRight) ? 'var(--color-success)' : (answered && isThis) ? 'var(--color-danger)' : 'var(--bg-muted)',
                    color: (answered && (isRight || isThis)) ? '#fff' : 'var(--text-sub)',
                  }}>
                    {letter}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: '500', color, lineHeight: 1.4 }}>{opt}</span>
                </div>
              );
            })}
          </div>

          {/* Feedback */}
          {answered && (
            <div style={{
              padding: '14px 18px', borderRadius: '10px', marginBottom: '16px',
              backgroundColor: isCorrect ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              border: `1px solid ${isCorrect ? 'var(--color-success)' : 'var(--color-danger)'}`,
            }}>
              <strong style={{ fontSize: '14px', color: isCorrect ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {isCorrect ? '✓ Correct! This word will be Mastered.' : '✗ Wrong! This word will come back tomorrow.'}
              </strong>
              {!isCorrect && (
                <p style={{ fontSize: '12px', color: 'var(--text-sub)', marginTop: '4px' }}>
                  Correct: {q.correctDefinition}
                </p>
              )}
            </div>
          )}

          {/* Nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              disabled={quizIdx === 0}
              onClick={() => setQuizIdx((i) => i - 1)}
              className="btn-secondary"
              style={{ fontSize: '12px', padding: '8px 16px' }}
            >
              ← Prev
            </button>
            {quizIdx < quizQuestions.length - 1 ? (
              <button
                onClick={() => setQuizIdx((i) => i + 1)}
                className="btn-primary"
                style={{ fontSize: '12px', padding: '8px 20px' }}
              >
                Next →
              </button>
            ) : (
              <button
                disabled={!allDone || submittingQuiz}
                onClick={handleFinishQuiz}
                className="btn-primary"
                style={{
                  fontSize: '13px', padding: '10px 24px',
                  backgroundColor: allDone ? 'var(--color-success)' : undefined,
                  opacity: allDone ? 1 : 0.5,
                }}
              >
                {submittingQuiz ? 'Saving Results…' : 'Finish Quiz & Save →'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     PHASE 4 — RESULTS: mastered vs needs-practice breakdown
     ═══════════════════════════════════════════════════════════════════════════ */
  if (phase === 'results' && quizResult) {
    const pct = Math.round((quizResult.score / quizResult.total) * 100);

    return (
      <div className="content-container" style={{ maxWidth: '820px', margin: '0 auto', paddingBottom: '60px' }}>
        <div className="pro-card" style={{ padding: '36px' }}>
          {/* Score banner */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '44px', marginBottom: '8px' }}>
              {pct === 100 ? '🎉🏆🌟' : pct >= 70 ? '🎯✨' : '💪📖'}
            </div>
            <h2 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-main)' }}>
              Daily Quiz Complete!
            </h2>
            <p style={{ fontSize: '17px', color: 'var(--accent-blue)', fontWeight: '700', marginTop: '6px' }}>
              {quizResult.score} / {quizResult.total} Correct ({pct}%)
            </p>
          </div>

          {/* Two column breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '32px' }}>
            {/* Mastered */}
            <div style={{ borderRadius: '12px', border: '1px solid var(--color-success)', backgroundColor: 'var(--color-success-bg)', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '18px' }}>✅</span>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--color-success)' }}>
                  Mastered ({quizResult.mastered.length})
                </h3>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-sub)', marginBottom: '12px' }}>
                These words are locked in as <strong>mastered</strong> and <strong>won't appear</strong> on future days.
              </p>
              {quizResult.mastered.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {quizResult.mastered.map((t) => (
                    <div key={t} style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>{t}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: '700' }}>✓ Mastered</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>None mastered this round. Keep practicing!</p>
              )}
            </div>

            {/* Needs review */}
            <div style={{ borderRadius: '12px', border: '1px solid var(--color-danger)', backgroundColor: 'var(--color-danger-bg)', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '18px' }}>🔄</span>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--color-danger)' }}>
                  Needs Practice ({quizResult.review.length})
                </h3>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-sub)', marginBottom: '12px' }}>
                Answered incorrectly. These stay <strong>unmastered</strong> and <strong>can come back</strong> on the next day.
              </p>
              {quizResult.review.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {quizResult.review.map((t) => {
                    const d = quizResult.details.find((x) => x.term === t);
                    return (
                      <div key={t} style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(239,68,68,0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>{t}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--color-danger)', fontWeight: '700' }}>Returns tomorrow</span>
                        </div>
                        {d && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>→ {d.definition}</p>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: '12px', color: 'var(--color-success)', fontWeight: '600' }}>🌟 Perfect! No missed words.</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={() => { setPhase('flashcards'); setCardIdx(0); setFlipped(false); }} className="btn-secondary" style={{ padding: '10px 20px', fontSize: '13px' }}>
              ← Review Flashcards
            </button>
            <button onClick={() => { setPhase('setup'); setReviewedSet(new Set()); }} className="btn-secondary" style={{ padding: '10px 20px', fontSize: '13px' }}>
              🔄 New Session
            </button>
            <button onClick={() => navigate('/')} className="btn-primary" style={{ padding: '10px 24px', fontSize: '13px' }}>
              Go to Dashboard →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}
