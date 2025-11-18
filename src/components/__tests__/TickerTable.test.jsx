/** @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi, describe, expect, it } from 'vitest';
import { TableRow } from '../TickerTable.jsx';
import { MARKET_VIEW_MODES } from '../../utils/markets.js';

const baseCalcResult = {
  rvol: 1,
  atrPct: 1,
  chgPct: 1,
  rotation: 1,
  score: 1,
  flags: {
    priceOK: true,
    emaOK: true,
    rvol2: true,
    rvol5: true,
    chgOK: true,
    atrOK: true,
    float50: true,
    float10: true,
    rot1: true,
    rot3: true,
    shortOK: true,
    spreadOK: true,
    liqOK: true,
  },
};

const buildRow = (overrides = {}) => ({
  id: 'row-1',
  ticker: 'ABC',
  market: 'US',
  open: 1,
  close: 1,
  bid: 1,
  ask: 1,
  avgPrice: 1,
  volToday: 1,
  volAvg10: 1,
  floatM: 1,
  shortPct: 1,
  dtc: 1,
  atr14: 1,
  ema9: 1,
  ema200: 1,
  atrPct: 1,
  spreadPct: 1,
  liqM: 1,
  comments: '',
  intradiaOK: false,
  catalyst: false,
  isStale: false,
  ...overrides,
});

describe('TableRow market selector', () => {
  it('normalizes unknown market values and calls onUpdate with a supported key', () => {
    const onUpdate = vi.fn();
    const row = buildRow({ id: 'row-unknown', market: 'XX' });

    render(
      <table>
        <tbody>
          <TableRow
            row={row}
            calcResult={baseCalcResult}
            isSelected={false}
            onSelect={() => {}}
            onUpdate={onUpdate}
            selectorViewMode={MARKET_VIEW_MODES.DROPDOWN}
            favoriteMarkets={new Set(['US', 'UNKNOWN'])}
            favoriteOnly={false}
            onToggleFavoriteFilter={() => {}}
          />
        </tbody>
      </table>,
    );

    const select = screen.getByLabelText('Mercado');
    expect(select).toHaveValue('UNKNOWN');
    expect(screen.getByRole('option', { name: /Desconocido/ })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'INVALID' } });
    expect(onUpdate).toHaveBeenCalledWith('row-unknown', 'market', 'US');

    fireEvent.change(select, { target: { value: 'US' } });
    expect(onUpdate).toHaveBeenLastCalledWith('row-unknown', 'market', 'US');
  });

  it('disables the market selector when the row is stale to prevent edits', () => {
    const row = buildRow({ isStale: true });

    render(
      <table>
        <tbody>
          <TableRow
            row={row}
            calcResult={baseCalcResult}
            isSelected={false}
            onSelect={() => {}}
            onUpdate={() => {}}
            selectorViewMode={MARKET_VIEW_MODES.DROPDOWN}
            favoriteMarkets={new Set(['US', 'UNKNOWN'])}
            favoriteOnly={false}
            onToggleFavoriteFilter={() => {}}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByLabelText('Mercado')).toBeDisabled();
  });
});
