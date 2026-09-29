import React, { useState, useEffect, useCallback } from 'react';
import { fetchWords, saveQuizResult } from '../api';

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildQuestions(wordPool, count) {
  const chosenWords = shuffle(wordPool).slice(0, count);
  return chosenWords.map((word) => {
    const otherDefs = shuffle(
      wordPool.filter((w) => w.term !== word.term)
    ).slice(0, 3).map((w) => w.definition);

    const options = shuffle([word.definition, ...otherDefs]);
    return {
      word,
      correctAnswer: word.definition,
      options,
      selectedAnswer: null,
      isChecked: false,
    };
  });
}

export default function Quiz({ userId }) {
  const [allWords, setAllWords] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [phase, setPhase] = useState('setup'); // 'setup' | 'active' | 'results'
  const [questionCount, setQuestionCount] = useState(10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWords()
      .then((data) => {
        setAllWords(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const startQuiz = useCallback(() => {
    if (allWords.length === 0) return;
    const qs = buildQuestions(allWords, questionCount);
    setQuestions(qs);
    setCurrentIdx(0);
    setPhase('active');
  }, [allWords, questionCount]);

  const handleSelectOption = (opt) => {
    const currentQ = questions[currentIdx];
    if (currentQ.isChecked) return; // once checked, locked for this question
    setQuestions((prev) => {
      const copy = [...prev];
      copy[currentIdx] = { ...copy[currentIdx], selectedAnswer: opt };
      return copy;
    });
  };

  const handleCheckAnswer = () => {
    const currentQ = questions[currentIdx];
    if (!currentQ.selectedAnswer || currentQ.isChecked) return;
    setQuestions((prev) => {
      const copy = [...prev];
      copy[currentIdx] = { ...copy[currentIdx], isChecked: true };
      return copy;
    });
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((prev) => prev + 1);
    }
  };

  const handleFinishQuiz = () => {
    const totalCorrect = questions.filter(
      (q) => q.isChecked && q.selectedAnswer === q.correctAnswer
    ).length;

    if (userId) {
      saveQuizResult(userId, totalCorrect, questions.length);
    }
    setPhase('results');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading quiz engine...</p>
      </div>
    );
  }

  // --- 1. SETUP SCREEN ---
  if (phase === 'setup') {
    return (
      <div className="content-container" style={{ maxWidth: '520px', margin: '40px auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)' }}>
            SAT Vocabulary Test
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Choose question count. Navigate freely, select options, and inspect detailed feedback.
          </p>
        </div>

        <div className="pro-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '10px' }}>
              Select Number of Questions
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {[5, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => setQuestionCount(n)}
                  className={questionCount === n ? 'btn-primary' : 'btn-secondary'}
                  style={{ width: '100%', padding: '10px' }}
                >
                  {n}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px' }}>
              Questions chosen randomly from the {allWords.length} vocabulary catalog.
            </p>
          </div>

          <button onClick={startQuiz} className="btn-primary" style={{ width: '100%', padding: '12px' }}>
            Begin Test →
          </button>
        </div>
      </div>
    );
  }

  // --- 2. ACTIVE QUIZ ---
  if (phase === 'active') {
    const q = questions[currentIdx];
    const pct = ((currentIdx + 1) / questions.length) * 100;
    const answeredCount = questions.filter((item) => item.isChecked).length;
    const correctCount = questions.filter(
      (item) => item.isChecked && item.selectedAnswer === item.correctAnswer
    ).length;

    const isCurrentCorrect = q.selectedAnswer === q.correctAnswer;

    return (
      <div className="content-container" style={{ maxWidth: '720px', margin: '20px auto' }}>
        {/* Progress Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '13px' }}>
              Question {currentIdx + 1} of {questions.length}
            </span>
            <span className="badge-tag">
              {answeredCount}/{questions.length} Checked
            </span>
          </div>
          <span style={{ fontWeight: '700', color: 'var(--color-success)', fontSize: '13px' }}>
            Score: {correctCount}
          </span>
        </div>

        {/* Progress Bar */}
        <div style={{ width: '100%', height: '5px', backgroundColor: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--accent-blue)', transition: 'width 0.2s ease' }} />
        </div>

        {/* Word Display Box */}
        <div className="pro-card" style={{ textAlign: 'center', padding: '28px 20px', marginBottom: '20px' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '700', color: 'var(--text-muted)' }}>
            Select the matching definition
          </span>
          <h2 style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-main)', marginTop: '8px' }}>
            {q.word.term}
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'inline-block', marginTop: '4px' }}>
            {q.word.category.split('(')[0].trim()}
          </span>
        </div>

        {/* Multiple Choice Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {q.options.map((opt, i) => {
            const isSelected = q.selectedAnswer === opt;
            const isThisCorrect = opt === q.correctAnswer;

            let bgColor = 'var(--bg-surface)';
            let borderColor = 'var(--border-card)';
            let textColor = 'var(--text-main)';

            if (q.isChecked) {
              if (isThisCorrect) {
                bgColor = 'var(--color-success-bg)';
                borderColor = 'var(--color-success)';
                textColor = 'var(--color-success)';
              } else if (isSelected) {
                bgColor = 'var(--color-danger-bg)';
                borderColor = 'var(--color-danger)';
                textColor = 'var(--color-danger)';
              }
            } else if (isSelected) {
              bgColor = 'var(--accent-blue-light)';
              borderColor = 'var(--accent-blue)';
              textColor = 'var(--accent-blue)';
            }

            return (
              <button
                key={i}
                disabled={q.isChecked}
                onClick={() => handleSelectOption(opt)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  border: `1px solid ${borderColor}`,
                  backgroundColor: bgColor,
                  color: textColor,
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: isSelected ? '600' : '500',
                  cursor: q.isChecked ? 'default' : 'pointer',
                  transition: 'all 0.15s ease',
                  width: '100%',
                }}
              >
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    backgroundColor: isSelected ? 'var(--accent-blue)' : 'var(--bg-muted)',
                    color: isSelected ? '#ffffff' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: '700',
                    flexShrink: 0,
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span style={{ lineHeight: 1.4 }}>{opt}</span>
              </button>
            );
          })}
        </div>

        {/* Explanatory Banner: Appears after clicking 'Check Answer' */}
        {q.isChecked && (
          <div
            className="pro-card"
            style={{
              padding: '16px 20px',
              marginBottom: '20px',
              backgroundColor: isCurrentCorrect ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              borderColor: isCurrentCorrect ? 'var(--color-success)' : 'var(--color-danger)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontWeight: '800', fontSize: '14px', color: isCurrentCorrect ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {isCurrentCorrect ? '✓ Correct Answer!' : '✗ Incorrect'}
              </span>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '8px' }}>
              <strong>Definition: </strong>
              <span>{q.word.definition}</span>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-sub)', fontStyle: 'italic' }}>
              <strong>Usage in sentence: </strong>
              "{q.word.example}"
            </div>
          </div>
        )}

        {/* 3 Action Buttons: Prev, Check Answer, Next */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handlePrev}
            disabled={currentIdx === 0}
            className="btn-secondary"
            style={{ opacity: currentIdx === 0 ? 0.4 : 1, cursor: currentIdx === 0 ? 'not-allowed' : 'pointer' }}
          >
            ← Previous
          </button>

          <button
            onClick={handleCheckAnswer}
            disabled={!q.selectedAnswer || q.isChecked}
            className="btn-primary"
            style={{
              padding: '10px 24px',
              opacity: !q.selectedAnswer || q.isChecked ? 0.45 : 1,
              cursor: !q.selectedAnswer || q.isChecked ? 'not-allowed' : 'pointer',
              backgroundColor: q.isChecked ? 'var(--bg-muted)' : 'var(--accent-blue)',
              color: q.isChecked ? 'var(--text-muted)' : '#ffffff',
              border: q.isChecked ? '1px solid var(--border-card)' : 'none',
            }}
          >
            {q.isChecked ? 'Answer Checked ✓' : 'Check Answer'}
          </button>

          {currentIdx === questions.length - 1 ? (
            <button
              onClick={handleFinishQuiz}
              className="btn-primary"
              style={{ backgroundColor: 'var(--color-success)' }}
            >
              Finish Quiz →
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="btn-secondary"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- 3. RESULTS SCREEN ---
  if (phase === 'results') {
    const totalCorrect = questions.filter(
      (q) => q.isChecked && q.selectedAnswer === q.correctAnswer
    ).length;
    const finalPct = Math.round((totalCorrect / questions.length) * 100);
    const missed = questions.filter(
      (q) => !q.isChecked || q.selectedAnswer !== q.correctAnswer
    );

    return (
      <div className="content-container" style={{ maxWidth: '640px', margin: '30px auto' }}>
        <div className="pro-card" style={{ textAlign: 'center', padding: '36px 24px', marginBottom: '24px' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '700', color: 'var(--text-muted)' }}>
            Quiz Results
          </span>
          <div
            style={{
              fontSize: '48px',
              fontWeight: '800',
              color: finalPct >= 80 ? 'var(--color-success)' : finalPct >= 60 ? 'var(--color-warning)' : 'var(--color-danger)',
              margin: '10px 0',
            }}
          >
            {totalCorrect} / {questions.length}
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-sub)', marginBottom: '20px' }}>
            You scored {finalPct}%. Your results have been saved to the database.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button onClick={startQuiz} className="btn-primary">
              Retake Quiz
            </button>
            <button onClick={() => setPhase('setup')} className="btn-secondary">
              New Quiz Settings
            </button>
          </div>
        </div>

        {missed.length > 0 && (
          <div className="pro-card">
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-danger)', marginBottom: '14px' }}>
              Review Terms Needing Practice ({missed.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {missed.map((q, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-muted)',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: 'var(--text-main)', fontSize: '14px' }}>{q.word.term}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{q.word.category.split('(')[0].trim()}</span>
                  </div>
                  <p style={{ color: 'var(--text-sub)', marginTop: '4px' }}>
                    <strong>Definition:</strong> {q.word.definition}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '4px' }}>
                    <strong>Example:</strong> "{q.word.example}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
