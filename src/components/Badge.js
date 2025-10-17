import { html } from "../lib/html.js";
import { COLORS } from "../constants.js";

export const Badge = ({ ok, label }) => html`
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ok ? COLORS.badgeOK : COLORS.badgeNO}`}>
    ${label}
  </span>
`;
