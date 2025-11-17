import { MARKETS as LOCAL_MARKETS } from '../utils/constants.js';

const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);

const normalizeMarkets = (rawMarkets) => {
  if (!isRecord(rawMarkets)) return { ...LOCAL_MARKETS };
  return Object.entries(rawMarkets).reduce((acc, [key, value]) => {
    if (!key) return acc;
    const label = typeof value?.label === 'string' ? value.label : key;
    const currency = typeof value?.currency === 'string' ? value.currency : value?.ccy || '';
    acc[key] = { label, currency };
    return acc;
  }, {});
};

let cachedMarkets = null;
let inflightPromise = null;

export const getCachedMarkets = () => cachedMarkets ?? { ...LOCAL_MARKETS };

export async function fetchMarketsConfig({ signal } = {}) {
  if (cachedMarkets) return cachedMarkets;
  if (inflightPromise) return inflightPromise;

  const remoteUrl = import.meta.env?.VITE_MARKETS_CONFIG_URL;
  if (!remoteUrl) {
    cachedMarkets = { ...LOCAL_MARKETS };
    return cachedMarkets;
  }

  inflightPromise = fetch(remoteUrl, { signal })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      const markets = normalizeMarkets(payload?.markets || payload);
      cachedMarkets = Object.keys(markets).length ? markets : { ...LOCAL_MARKETS };
      return cachedMarkets;
    })
    .catch((error) => {
      if (signal?.aborted) throw error;
      console.warn('Fallo al cargar mercados remotos; usando configuración local', error);
      cachedMarkets = { ...LOCAL_MARKETS };
      return cachedMarkets;
    })
    .finally(() => {
      inflightPromise = null;
    });

  return inflightPromise;
}
