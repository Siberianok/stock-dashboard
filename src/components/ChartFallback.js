import { html } from "../lib/html.js";

export const ChartFallback = ({ label }) => html`
  <div className="h-full flex items-center justify-center text-xs text-white/60">
    ${label} (Recharts no disponible)
  </div>
`;
