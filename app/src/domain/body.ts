export type BodyBenefitId =
  | 'b_5m' | 'b_20m' | 'b_8h' | 'b_12h' | 'b_24h' | 'b_48h' | 'b_72h' | 'b_2w' | 'b_1mo' | 'b_1y';

export const BODY_BENEFITS: readonly { id: BodyBenefitId; minutes: number }[] = [
  { id: 'b_5m', minutes: 5 },
  { id: 'b_20m', minutes: 20 },
  { id: 'b_8h', minutes: 8 * 60 },
  { id: 'b_12h', minutes: 12 * 60 },
  { id: 'b_24h', minutes: 24 * 60 },
  { id: 'b_48h', minutes: 48 * 60 },
  { id: 'b_72h', minutes: 72 * 60 },
  { id: 'b_2w', minutes: 14 * 24 * 60 },
  { id: 'b_1mo', minutes: 30 * 24 * 60 },
  { id: 'b_1y', minutes: 365 * 24 * 60 },
];

export function unlockedBenefits(bestMinutes: number): BodyBenefitId[] {
  return BODY_BENEFITS.filter((b) => b.minutes <= bestMinutes).map((b) => b.id);
}

export function nextBenefit(
  bestMinutes: number,
): { id: BodyBenefitId; minutes: number; progress: number } | null {
  const next = BODY_BENEFITS.find((b) => b.minutes > bestMinutes);
  return next ? { ...next, progress: bestMinutes / next.minutes } : null;
}
