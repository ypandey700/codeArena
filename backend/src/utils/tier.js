const getTier = (rating = 1200) => {
  const r = Number(rating) || 1200;
  if (r >= 2500) return 'Radiant';
  if (r >= 2200) return 'Immortal';
  if (r >= 1900) return 'Ascendant';
  if (r >= 1600) return 'Diamond';
  if (r >= 1400) return 'Platinum';
  if (r >= 1200) return 'Gold';
  if (r >= 1000) return 'Silver';
  return 'Bronze';
};

module.exports = { getTier };
