import React from 'react';
import { COLORS } from '../utils/constants.js';

export const Badge = ({ ok, label }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ok ? COLORS.badgeOK : COLORS.badgeNO}`}>
    {label}
  </span>
);
