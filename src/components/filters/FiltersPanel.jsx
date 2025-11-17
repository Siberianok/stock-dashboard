import React, { useMemo } from 'react';
import { COLORS } from '../../utils/constants.js';
import { parseNumberInput } from '../../utils/forms.js';
import MarketSelect from '../MarketSelect.jsx';
import { useMarkets } from '../../hooks/useMarkets.js';

const numberOrEmpty = (value) => (Number.isFinite(value) ? value : '');

export const FiltersPanel = ({ filters }) => {
  const {
    thresholds,
    getError,
    updateMarket,
    updatePriceRange,
    updateLiquidity,
    updateScalar,
    updateBoolean,
  } = filters;

  const { markets, marketEntries } = useMarkets();
  const marketLookup = useMemo(() => markets || {}, [markets]);

  const volumeInputs = useMemo(
    () => [
      {
        key: 'rvolMin',
        label: 'RVOL ≥',
        value: thresholds.rvolMin,
        step: '0.1',
        min: 0,
      },
      {
        key: 'rvolIdeal',
        label: 'RVOL ideal ≥',
        value: thresholds.rvolIdeal,
        step: '0.1',
        min: 0,
      },
      {
        key: 'float50',
        label: 'Float < (M)',
        value: thresholds.float50,
        step: '1',
        min: 0.1,
      },
      {
        key: 'float10',
        label: 'Pref. Float < (M)',
        value: thresholds.float10,
        step: '1',
        min: 0.1,
      },
      {
        key: 'rotationMin',
        label: 'Rotación ≥',
        value: thresholds.rotationMin,
        step: '0.1',
        min: 0,
      },
      {
        key: 'rotationIdeal',
        label: 'Rotación ideal ≥',
        value: thresholds.rotationIdeal,
        step: '0.1',
        min: 0,
      },
      {
        key: 'atrMin',
        label: 'ATR ≥',
        value: thresholds.atrMin,
        step: '0.1',
        min: 0,
      },
      {
        key: 'atrPctMin',
        label: 'ATR% ≥',
        value: thresholds.atrPctMin,
        step: '0.1',
        min: 0,
      },
      {
        key: 'chgMin',
        label: 'Cambio día ≥',
        value: thresholds.chgMin,
        step: '0.5',
        min: 0,
      },
      {
        key: 'shortMin',
        label: 'Short float ≥',
        value: thresholds.shortMin,
        step: '0.5',
        min: 0,
        max: 100,
      },
    ],
    [
      thresholds.atrMin,
      thresholds.atrPctMin,
      thresholds.chgMin,
      thresholds.float10,
      thresholds.float50,
      thresholds.rotationIdeal,
      thresholds.rotationMin,
      thresholds.rvolIdeal,
      thresholds.rvolMin,
      thresholds.shortMin,
    ],
  );

  return (
    <section className={`rounded-2xl ${COLORS.glass} p-6 shadow-xl`}>
      <h2 className="text-xl font-semibold mb-4">Umbrales por mercado</h2>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <MarketSelect
            markets={marketLookup}
            selected={thresholds.marketsEnabled || {}}
            onToggle={updateMarket}
            columns={2}
          />

          <div className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl`}>
            <h3 className="font-semibold mb-4 text-center text-lg tracking-wide">Precio</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {marketEntries.map(([key, info = {}]) => {
                const priceRange = thresholds.priceRange?.[key] || {};
                const minPath = `priceRange.${key}.min`;
                const maxPath = `priceRange.${key}.max`;
                return (
                  <div key={key} className="space-y-2 bg-white/5 rounded-xl p-3">
                    <div className="text-center text-white/70 text-xs uppercase tracking-wide">{info.label}</div>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-white/80">Mínimo</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min="0"
                        aria-label={`Precio mínimo ${info.label}`}
                        value={numberOrEmpty(priceRange.min)}
                        onChange={(e) => {
                          const next = parseNumberInput(e);
                          updatePriceRange(key, 'min', next);
                        }}
                        className="border border-white/20 bg-white/10 text-white rounded px-2 py-1"
                      />
                      {getError(minPath) ? <span className="text-[10px] text-rose-300">{getError(minPath)}</span> : null}
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-white/80">Máximo</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min="0"
                        aria-label={`Precio máximo ${info.label}`}
                        value={numberOrEmpty(priceRange.max)}
                        onChange={(e) => {
                          const next = parseNumberInput(e);
                          updatePriceRange(key, 'max', next);
                        }}
                        className="border border-white/20 bg-white/10 text-white rounded px-2 py-1"
                      />
                      {getError(maxPath) ? <span className="text-[10px] text-rose-300">{getError(maxPath)}</span> : null}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl`}>
            <h3 className="font-semibold mb-4 text-center text-lg tracking-wide">Volumen &amp; Float</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-center items-start justify-items-center">
              {volumeInputs.map((field) => {
                const error = getError(field.key);
                return (
                  <label key={field.key} className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                    <span className="text-white/80 font-medium">{field.label}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step={field.step}
                      min={field.min ?? 0}
                      max={field.max ?? undefined}
                      aria-label={field.label}
                      value={numberOrEmpty(field.value)}
                      onChange={(e) => {
                        const next = parseNumberInput(e);
                        updateScalar(field.key, next);
                      }}
                      className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center"
                    />
                    {error ? <span className="text-[10px] text-rose-300">{error}</span> : null}
                  </label>
                );
              })}
              <label className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                <span className="text-white/80 font-medium">Spread máx. (%)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  inputMode="decimal"
                  aria-label="Spread máximo permitido"
                  value={numberOrEmpty(thresholds.spreadMaxPct)}
                  onChange={(e) => {
                    const next = parseNumberInput(e);
                    updateScalar('spreadMaxPct', next);
                  }}
                  className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center"
                />
                {getError('spreadMaxPct') ? (
                  <span className="text-[10px] text-rose-300">{getError('spreadMaxPct')}</span>
                ) : null}
              </label>
              <label className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                <span className="text-white/80 font-medium">Liquidez mínima (M)</span>
                <div className="grid grid-cols-2 gap-2 w-full">
                  {marketEntries.map(([key, info = {}]) => {
                    const liqPath = `liquidityMin.${key}`;
                    return (
                      <div key={key} className="flex flex-col gap-1 text-xs">
                        <span className="text-white/70 text-[11px] uppercase tracking-wide text-center">{info.label}</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          inputMode="decimal"
                          aria-label={`Liquidez mínima ${info.label}`}
                          value={numberOrEmpty(thresholds.liquidityMin?.[key])}
                          onChange={(e) => {
                            const next = parseNumberInput(e);
                            updateLiquidity(key, next);
                          }}
                          className="border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center"
                        />
                        {getError(liqPath) ? (
                          <span className="text-[10px] text-rose-300 text-center">{getError(liqPath)}</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </label>
              <label className="sm:col-span-2 w-full flex items-center justify-center gap-2 mt-1">
                <input
                  type="checkbox"
                  aria-label="Requerir precio mayor a EMA200"
                  checked={thresholds.needEMA200}
                  onChange={(e) => updateBoolean('needEMA200', e.target.checked)}
                />
                <span>Requerir precio &gt; EMA200</span>
              </label>
              <label className="sm:col-span-2 w-full flex items-center justify-center gap-2 mt-1">
                <input
                  type="checkbox"
                  aria-label="Activar modo parabólico"
                  checked={thresholds.parabolic50}
                  onChange={(e) => updateBoolean('parabolic50', e.target.checked)}
                />
                <span>Modo parabólico (≥ 50%)</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
