export const parseNumberInput = (input) => {
  const value = input && typeof input === 'object' && 'target' in input ? input.target?.value : input;
  if (value === '' || value === null || value === undefined) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};
