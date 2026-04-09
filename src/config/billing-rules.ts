const toPositiveInt = (raw: string | undefined, fallback: number): number => {
  const n = parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const BILLING_RULES = {
  points: {
    zi: toPositiveInt(process.env.ZI_POINTS_COST, 10),
    reading: toPositiveInt(process.env.READING_POINTS_COST, 15),
  },
  // 目前八字高级解读为会员权益，不支持单次积分购买
  baziAdvancedMode: 'membership_only' as const,
};

