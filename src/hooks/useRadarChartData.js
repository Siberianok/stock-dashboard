import { useMemo } from 'react';
import { toNum } from '../utils/format.js';

/**
 * Genera los datos normalizados para el gráfico radar del ticker seleccionado.
 *
 * @param {Object} params
 * @param {{ score?: number, rvol?: number, chgPct?: number, atrPct?: number, rotation?: number }} params.selectedCalc Resultado del cálculo del ticker seleccionado.
 * @param {{ shortPct?: number } | null} params.selectedRow Fila seleccionada.
 * @param {Object} params.thresholds Umbrales aplicados actualmente.
 * @returns {Array<{ k: string, v: number, raw: number | undefined }>}
 */
export const useRadarChartData = ({ selectedCalc, selectedRow, thresholds }) =>
  useMemo(() => {
    if (!selectedCalc) return [];
    const { rvol, chgPct, atrPct, rotation, score } = selectedCalc;

    const scale = (val, thr) => {
      if (val === undefined || thr === 0 || thr === undefined) return 0;
      return Math.max(0, Math.min(100, (val / thr) * 100));
    };

    const rvolScore = scale(rvol, thresholds.rvolIdeal);
    const chgScore = scale(chgPct, thresholds.parabolic50 ? 50 : thresholds.chgMin);
    const atrScore = scale(atrPct, thresholds.atrPctMin * 2);
    const rotScore = scale(rotation, thresholds.rotationIdeal);
    const shortScore = scale(toNum(selectedRow?.shortPct), thresholds.shortMin);
    const scoreScore = Math.max(0, Math.min(100, score || 0));

    return [
      { k: 'RVOL', v: rvolScore, raw: rvol },
      { k: '%día', v: chgScore, raw: chgPct },
      { k: 'ATR%', v: atrScore, raw: atrPct },
      { k: 'Rot', v: rotScore, raw: rotation },
      { k: 'Short%', v: shortScore, raw: toNum(selectedRow?.shortPct) },
      { k: 'SCORE', v: scoreScore, raw: score },
    ];
  }, [selectedCalc, selectedRow, thresholds]);
