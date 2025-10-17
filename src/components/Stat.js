import { html } from "../lib/html.js";
import { COLORS } from "../constants.js";

export const Stat = ({ label, value, sub, icon }) => html`
  <div className={`rounded-2xl ${COLORS.glass} p-5 shadow-lg flex flex-col items-center text-center gap-2`}>
    <div className="p-3 rounded-2xl bg-white/10 flex items-center justify-center text-2xl">${icon}</div>
    <div>
      <div className="text-3xl font-semibold text-white leading-tight">${value}</div>
      <div className="text-sm text-white/80">${label}</div>
      ${sub ? html`<div className="text-xs text-white/60 mt-1">${sub}</div>` : null}
    </div>
  </div>
`;
