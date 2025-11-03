import React, { useEffect, useId, useRef } from 'react';
import { MARKETS } from '../utils/constants.js';
import { safeNumber, safePct } from '../utils/format.js';
import { ScoreBar } from './ScoreBar.jsx';
import { Badge } from './Badge.jsx';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export const PreviewDialog = ({ open, onClose, row, calcResult, dialogId }) => {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const focusFirst = () => {
      if (closeButtonRef.current) {
        closeButtonRef.current.focus();
      } else if (dialogRef.current) {
        dialogRef.current.focus();
      }
    };

    const handleKeyDown = (event) => {
      if (!open) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        const container = dialogRef.current;
        if (!container) return;
        const focusable = Array.from(
          container.querySelectorAll(FOCUSABLE_SELECTOR),
        ).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('tabindex') !== '-1');
        if (!focusable.length) {
          event.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    const rafAvailable = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function';
    const cafAvailable = typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function';
    const timer = rafAvailable ? window.requestAnimationFrame(focusFirst) : setTimeout(focusFirst, 0);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      if (rafAvailable && cafAvailable) {
        window.cancelAnimationFrame(timer);
      } else {
        clearTimeout(timer);
      }
      document.removeEventListener('keydown', handleKeyDown);
      if (previous && typeof previous.focus === 'function') {
        previous.focus();
      }
    };
  }, [open, onClose]);

  if (!open || !row) {
    return null;
  }

  const market = row.market || 'US';
  const info = MARKETS[market] || MARKETS.US;
  const computed = calcResult || {};
  const descriptionText = `${row.ticker || 'Ticker sin nombre'} en ${info.label}`;

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        id={dialogId}
        tabIndex={-1}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-xl font-semibold text-white">
              Previsualización de ticker
            </h2>
            <p id={descriptionId} className="text-sm text-white/70">
              {descriptionText}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"
              onClick={() => onClose()}
              ref={closeButtonRef}
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 text-sm text-white/80">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white/70">Ticker</span>
              <span className="font-semibold text-lg">{row.ticker || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/70">Mercado</span>
              <span>{info.label}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/70">Close</span>
              <span className="tabular-nums">{safeNumber(row.close)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/70">%día</span>
              <span className="tabular-nums">{safePct(computed.chgPct)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/70">ATR%</span>
              <span className="tabular-nums">{safePct(computed.atrPct)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/70">Rotación</span>
              <span className="tabular-nums">{safeNumber(computed.rotation)}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-white/70">Score</span>
              <span className="text-2xl font-semibold tabular-nums">{safeNumber(computed.score, 0)}</span>
            </div>
            <ScoreBar value={computed.score || 0} label={`Score del ticker ${row.ticker || ''}`} />
            <div className="text-[13px] text-white/60">
              RVOL actual: {safeNumber(computed.rvol)} · Liquidez:{' '}
              {safeNumber(row.liqM, 1)} {info.currency}
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge ok={computed.flags?.priceOK} label="Precio" />
              <Badge ok={computed.flags?.emaOK} label=">EMA" />
              <Badge ok={computed.flags?.rvol2} label="RVOL≥2" />
              <Badge ok={computed.flags?.rvol5} label="RVOL≥5" />
              <Badge ok={computed.flags?.chgOK} label="%día" />
              <Badge ok={computed.flags?.atrOK} label="ATR" />
              <Badge ok={computed.flags?.float50} label="Float<50" />
              <Badge ok={computed.flags?.float10} label="Float<10" />
              <Badge ok={computed.flags?.rot1} label="Rot≥1x" />
              <Badge ok={computed.flags?.rot3} label="Rot≥3x" />
              <Badge ok={computed.flags?.shortOK} label="Short%" />
              <Badge ok={computed.flags?.spreadOK} label="Spread" />
              <Badge ok={computed.flags?.liqOK} label={`Liq ${info.currency}`} />
            </div>
          </div>
        </div>

        {row.comments ? (
          <div className="mt-6 rounded-xl bg-white/5 p-4 text-sm text-white/70" aria-live="polite">
            <h3 className="text-white/80 font-semibold text-base mb-2">Notas</h3>
            <p>{row.comments}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};
