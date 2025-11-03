import React from 'react';
import { COLORS } from '../utils/constants.js';

export const Badge = ({ ok, label }) => (
  <span
    role="status"
    aria-live="polite"
    aria-label={`${label}: ${ok ? 'criterio cumplido' : 'criterio no cumplido'}`}
    className={`${ok ? COLORS.badgeOK : COLORS.badgeNO} text-xs`}
  >
    <span aria-hidden="true">{label}</span>
  </span>
);
