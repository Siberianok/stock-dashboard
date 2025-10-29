import React from 'react';
import { COLORS } from '../utils/constants.js';

export const ScoreBar = ({ value }) => {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="w-full bg-white/20 rounded-full h-2">
      <div className={`h-2 rounded-full ${COLORS.gradientBar}`} style={{ width: `${v}%` }} />
    </div>
  );
};
