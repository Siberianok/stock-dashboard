import React from 'react';

export const ScoreBar = ({ value, label = 'Nivel de score' }) => {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div
      className="score-bar"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      aria-label={label}
    >
      <div className="score-bar__fill" style={{ width: `${v}%` }} aria-hidden="true" />
    </div>
  );
};
