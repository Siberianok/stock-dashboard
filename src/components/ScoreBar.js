import { html } from "../lib/html.js";
import { COLORS } from "../constants.js";

export const ScoreBar = ({ value }) => {
  const v = Math.max(0, Math.min(100, value || 0));
  return html`
    <div className="w-full bg-white/20 rounded-full h-2">
      <div className={`h-2 rounded-full ${COLORS.gradientBar}`} style=${{ width: `${v}%` }} />
    </div>
  `;
};
