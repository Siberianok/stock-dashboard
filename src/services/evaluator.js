import { REQUIRED_FLAGS } from '../utils/constants.js';

const checkRequiredFlags = (flags = {}) => {
  return REQUIRED_FLAGS.every((flag) => {
    if (flag === 'shortOK' && flags.shortMissing) {
      return true;
    }
    return Boolean(flags[flag]);
  });
};

export const evaluateTicker = ({ calc, thresholds, data }) => {
  if (typeof calc !== 'function' || !data) {
    return {
      passes: false,
      score: 0,
      flags: {},
      marketEnabled: false,
      computed: {},
    };
  }

  const market = data.market || 'US';
  const computed = calc(data, market) || {};
  const flags = computed.flags || {};
  const requiredFlagsOK = checkRequiredFlags(flags);
  const marketEnabled = thresholds?.marketsEnabled?.[market] !== false;
  const score = typeof computed.score === 'number' ? computed.score : 0;

  return {
    passes: Boolean(marketEnabled && requiredFlagsOK),
    score,
    flags,
    marketEnabled,
    computed,
  };
};

export const summarizeEvaluations = (entries) => {
  return entries.reduce(
    (acc, entry) => {
      acc.total += 1;
      acc[entry.status] = (acc[entry.status] || 0) + 1;
      if (entry.draft?.passes) {
        acc.draftPass += 1;
      }
      if (entry.applied?.passes) {
        acc.appliedPass += 1;
      }
      return acc;
    },
    {
      total: 0,
      added: 0,
      removed: 0,
      improved: 0,
      regressed: 0,
      unchanged: 0,
      stillFailing: 0,
      draftPass: 0,
      appliedPass: 0,
    },
  );
};
