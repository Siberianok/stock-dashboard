export const HISTORICAL_BENCHMARK_FIXTURES = [
  {
    id: 'global-balanced',
    label: 'Benchmark global equilibrado',
    description:
      'Promedios móviles con filtros moderados aplicados a un universo mixto de EEUU, Europa y emergentes.',
    features: {
      markets: ['US', 'AR', 'BR', 'EU', 'CN'],
      priceMin: 3,
      priceMax: 65,
      liquidityMin: 20,
      rvolMin: 2,
      chgMin: 12,
      needEMA200: true,
    },
    metricsByRange: {
      '1D': {
        kpis: { top: 88, inPlay: 28, ready70: 11, total: 52, totalAll: 130 },
        buckets: { hi: 13, mid: 21, lo: 18 },
        pipeline: { price: 180, ema: 122, rvol2: 76, ready: 25 },
        averageScore: 63,
      },
      '5D': {
        kpis: { top: 90, inPlay: 32, ready70: 13, total: 55, totalAll: 130 },
        buckets: { hi: 14, mid: 23, lo: 18 },
        pipeline: { price: 188, ema: 128, rvol2: 84, ready: 27 },
        averageScore: 64,
      },
      '1M': {
        kpis: { top: 92, inPlay: 36, ready70: 15, total: 59, totalAll: 130 },
        buckets: { hi: 16, mid: 26, lo: 17 },
        pipeline: { price: 194, ema: 132, rvol2: 88, ready: 29 },
        averageScore: 65,
      },
      '3M': {
        kpis: { top: 95, inPlay: 38, ready70: 17, total: 61, totalAll: 130 },
        buckets: { hi: 18, mid: 26, lo: 17 },
        pipeline: { price: 198, ema: 136, rvol2: 92, ready: 30 },
        averageScore: 66,
      },
      ALL: {
        kpis: { top: 97, inPlay: 40, ready70: 19, total: 64, totalAll: 130 },
        buckets: { hi: 19, mid: 27, lo: 18 },
        pipeline: { price: 204, ema: 140, rvol2: 96, ready: 32 },
        averageScore: 66,
      },
    },
  },
  {
    id: 'us-growth',
    label: 'EEUU crecimiento',
    description: 'Histórico de carteras growth en EEUU con sesgo a volatilidad y liquidez elevadas.',
    features: {
      markets: ['US'],
      priceMin: 5,
      priceMax: 45,
      liquidityMin: 25,
      rvolMin: 2.5,
      chgMin: 15,
      needEMA200: true,
    },
    metricsByRange: {
      '1D': {
        kpis: { top: 96, inPlay: 18, ready70: 9, total: 30, totalAll: 60 },
        buckets: { hi: 10, mid: 12, lo: 8 },
        pipeline: { price: 90, ema: 66, rvol2: 50, ready: 18 },
        averageScore: 70,
      },
      '5D': {
        kpis: { top: 99, inPlay: 20, ready70: 10, total: 32, totalAll: 60 },
        buckets: { hi: 11, mid: 13, lo: 8 },
        pipeline: { price: 96, ema: 70, rvol2: 54, ready: 20 },
        averageScore: 72,
      },
      '1M': {
        kpis: { top: 104, inPlay: 23, ready70: 12, total: 34, totalAll: 60 },
        buckets: { hi: 12, mid: 14, lo: 8 },
        pipeline: { price: 102, ema: 76, rvol2: 58, ready: 22 },
        averageScore: 73,
      },
      '3M': {
        kpis: { top: 108, inPlay: 24, ready70: 13, total: 36, totalAll: 60 },
        buckets: { hi: 13, mid: 15, lo: 8 },
        pipeline: { price: 108, ema: 82, rvol2: 60, ready: 23 },
        averageScore: 74,
      },
      ALL: {
        kpis: { top: 110, inPlay: 25, ready70: 14, total: 37, totalAll: 60 },
        buckets: { hi: 14, mid: 15, lo: 8 },
        pipeline: { price: 110, ema: 84, rvol2: 62, ready: 24 },
        averageScore: 74,
      },
    },
  },
  {
    id: 'latam-agresivo',
    label: 'LatAm agresivo',
    description: 'Referencias históricas para filtros agresivos centrados en Brasil y Argentina.',
    features: {
      markets: ['AR', 'BR'],
      priceMin: 3,
      priceMax: 70,
      liquidityMin: 18,
      rvolMin: 3.2,
      chgMin: 22,
      needEMA200: false,
    },
    metricsByRange: {
      '1D': {
        kpis: { top: 82, inPlay: 14, ready70: 6, total: 24, totalAll: 48 },
        buckets: { hi: 7, mid: 9, lo: 8 },
        pipeline: { price: 70, ema: 48, rvol2: 34, ready: 12 },
        averageScore: 61,
      },
      '5D': {
        kpis: { top: 85, inPlay: 16, ready70: 7, total: 25, totalAll: 48 },
        buckets: { hi: 8, mid: 10, lo: 7 },
        pipeline: { price: 74, ema: 52, rvol2: 36, ready: 13 },
        averageScore: 62,
      },
      '1M': {
        kpis: { top: 88, inPlay: 18, ready70: 8, total: 27, totalAll: 48 },
        buckets: { hi: 9, mid: 11, lo: 7 },
        pipeline: { price: 78, ema: 56, rvol2: 38, ready: 14 },
        averageScore: 63,
      },
      '3M': {
        kpis: { top: 90, inPlay: 19, ready70: 9, total: 29, totalAll: 48 },
        buckets: { hi: 10, mid: 11, lo: 8 },
        pipeline: { price: 80, ema: 58, rvol2: 40, ready: 15 },
        averageScore: 64,
      },
      ALL: {
        kpis: { top: 92, inPlay: 20, ready70: 10, total: 30, totalAll: 48 },
        buckets: { hi: 10, mid: 12, lo: 8 },
        pipeline: { price: 82, ema: 60, rvol2: 42, ready: 16 },
        averageScore: 64,
      },
    },
  },
  {
    id: 'asia-defensivo',
    label: 'Asia defensivo',
    description: 'Benchmarks conservadores en China con preferencia por liquidez y filtros estrictos.',
    features: {
      markets: ['CN'],
      priceMin: 4,
      priceMax: 55,
      liquidityMin: 22,
      rvolMin: 1.8,
      chgMin: 8,
      needEMA200: true,
    },
    metricsByRange: {
      '1D': {
        kpis: { top: 76, inPlay: 12, ready70: 4, total: 22, totalAll: 44 },
        buckets: { hi: 5, mid: 9, lo: 8 },
        pipeline: { price: 66, ema: 46, rvol2: 28, ready: 10 },
        averageScore: 58,
      },
      '5D': {
        kpis: { top: 78, inPlay: 13, ready70: 5, total: 23, totalAll: 44 },
        buckets: { hi: 6, mid: 9, lo: 8 },
        pipeline: { price: 68, ema: 48, rvol2: 30, ready: 11 },
        averageScore: 59,
      },
      '1M': {
        kpis: { top: 80, inPlay: 14, ready70: 6, total: 24, totalAll: 44 },
        buckets: { hi: 6, mid: 10, lo: 8 },
        pipeline: { price: 70, ema: 50, rvol2: 32, ready: 12 },
        averageScore: 60,
      },
      '3M': {
        kpis: { top: 82, inPlay: 15, ready70: 7, total: 25, totalAll: 44 },
        buckets: { hi: 7, mid: 10, lo: 8 },
        pipeline: { price: 72, ema: 52, rvol2: 34, ready: 13 },
        averageScore: 61,
      },
      ALL: {
        kpis: { top: 83, inPlay: 15, ready70: 7, total: 25, totalAll: 44 },
        buckets: { hi: 7, mid: 10, lo: 8 },
        pipeline: { price: 74, ema: 54, rvol2: 34, ready: 13 },
        averageScore: 61,
      },
    },
  },
];

export default HISTORICAL_BENCHMARK_FIXTURES;
