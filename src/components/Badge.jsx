import React from 'react';
import { COLORS } from '../utils/constants.js';

export const Badge = ({ ok, label }) => (
  <span className={`${ok ? COLORS.badgeOK : COLORS.badgeNO} text-xs`}>{label}</span>
);
