// Match the existing server ladder in backend/src/utils/tier.js.
export const RANKS = [
  { name: "Bronze", min: 0, color: "#c99b78", emblem: "M22 22H42L39 38L32 45L25 38Z M24 29L32 35L40 29" },
  { name: "Silver", min: 1000, color: "#b9cbd9", emblem: "M20 23L32 15L44 23L32 34Z M21 33L32 43L43 33 M26 42L32 48L38 42" },
  { name: "Gold", min: 1200, color: "#fddf49", emblem: "M18 22L25 27L32 15L39 27L46 22L42 38L32 47L22 38Z M25 33L32 39L39 33" },
  { name: "Platinum", min: 1400, color: "#80d5d0", emblem: "M32 13L47 28L32 48L17 28Z M17 28H47 M32 13L26 28L32 48L38 28Z" },
  { name: "Diamond", min: 1600, color: "#bda6f3", emblem: "M21 18H43L49 29L32 49L15 29Z M15 29H49 M21 18L27 29L32 49L37 29L43 18 M27 29L32 18L37 29" },
  { name: "Ascendant", min: 1900, color: "#83d7a0", emblem: "M32 12L42 28L32 48L22 28Z M15 23L20 34L27 42 M49 23L44 34L37 42 M26 28H38 M32 21V36" },
  { name: "Immortal", min: 2200, color: "#ec91a0", emblem: "M16 22L25 27L32 12L39 27L48 22L44 38L32 49L20 38Z M24 34L32 40L40 34 M32 22V32 M17 44L24 49 M47 44L40 49" },
  { name: "Radiant", min: 2500, color: "#fff0b1", emblem: "M32 10L37 24L49 20L43 32L49 44L37 40L32 54L27 40L15 44L21 32L15 20L27 24Z M32 24L38 32L32 40L26 32Z" },
];

export function getPlayerRank(user) {
  const rating = typeof user?.rating === "number" && Number.isFinite(user.rating) ? user.rating : null;
  const suppliedTier = RANKS.findIndex((tier) => tier.name.toLowerCase() === user?.tier?.toLowerCase());
  // The server treats a rating of zero as the starting rating of 1200.
  const index = suppliedTier >= 0 ? suppliedTier : rating == null ? -1 : Math.max(0, RANKS.findLastIndex((tier) => (rating || 1200) >= tier.min));
  const current = RANKS[index] || null;
  const next = current ? RANKS[index + 1] || null : null;
  const progress = rating != null && next ? Math.max(0, Math.min(100, (rating - current.min) / (next.min - current.min) * 100)) : null;
  const position = typeof user?.rank === "number" && Number.isInteger(user.rank) && user.rank > 0 ? user.rank : null;
  return { rating, index, current, next, progress, position };
}

export function rankRange(index) {
  const tier = RANKS[index];
  const next = RANKS[index + 1];
  if (index === 0) return "Below 1,000";
  return next ? `${tier.min.toLocaleString()}–${(next.min - 1).toLocaleString()}` : `${tier.min.toLocaleString()}+`;
}
