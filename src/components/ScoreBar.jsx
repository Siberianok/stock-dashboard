import React from 'react';
export const ScoreBar = ({ value }) => {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="score-bar">
      <div className="score-bar__fill" style={{ width: `${v}%` }} />
    </div>
  );
};
