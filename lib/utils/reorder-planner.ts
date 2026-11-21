export type ReorderInputs = {
  onHand: number;
  incoming: number;
  dailyUsage: number;
  leadDays: number;
  coverDays: number;
  packSize: number;
};

export function calculateReorder({ onHand, incoming, dailyUsage, leadDays, coverDays, packSize }: ReorderInputs) {
  const wholeUnits = [onHand, incoming, leadDays, coverDays, packSize];
  if (wholeUnits.some((value) => !Number.isInteger(value) || value < 0 || value > 1_000_000)
    || packSize === 0 || !Number.isFinite(dailyUsage) || dailyUsage < 0 || dailyUsage > 1_000_000) return null;

  // Use thousandths so decimal demand at an exact pack boundary doesn't add a pack.
  const demand = Math.round(dailyUsage * 1000);
  if (Math.abs(dailyUsage * 1000 - demand) > 0.000001) return null;
  const target = Math.ceil(demand * (leadDays + coverDays) / 1000);
  const packs = Math.max(0, Math.ceil((target - onHand - incoming) / packSize));
  return {
    packs,
    units: packs * packSize,
    target,
    // Order timing matters. Stock due by delivery may still arrive after a shortfall.
    daysOnHand: demand > 0 ? onHand * 1000 / demand : null,
    mayRunOut: demand * leadDays > onHand * 1000,
  };
}
