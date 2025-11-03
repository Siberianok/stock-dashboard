# Accessibility Audit — Critical Components

The audit focused on the reusable building blocks under `src/components/` to surface gaps that blocked assistive technology users.

## Badge
- **Issue**: Status indicators rendered as plain `<span>` elements without context for screen readers.
- **Resolution**: Exposed status semantics with `role="status"`, polite announcements, and explicit labels describing pass/fail state.

## DiagnosticsPanel
- **Issue**: Landmark missing, making it difficult to jump to diagnostics via screen reader regions; metric and log updates were silent.
- **Resolution**: Added `role="region"` with deterministic labelling plus live regions for metrics (`polite`) and logs (`assertive`).

## ScoreBar
- **Issue**: Visual only progress indicator; no assistive text or bounds.
- **Resolution**: Converted container into a `progressbar` with accessible min/max/current values and configurable labels.

## TickerTable
- **Issues**:
  - Click-only row selection created a keyboard trap (rows were not focusable).
  - Table headers missed structural semantics and the widget lacked instructions.
  - Status messages were not announced to assistive tech.
- **Resolution**: Added keyboard focus/selection (`tabIndex`, `aria-selected`, Enter/Space handlers), column scopes, visually hidden caption with keyboard guidance, and live status messaging.

These findings guided the remediations implemented in the accompanying code changes.
