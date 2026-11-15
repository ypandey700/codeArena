require('dotenv').config({ path: `${__dirname}/../.env` });
const { analyzeSolution } = require('../src/services/analysisService');
const { computeResult } = require('../src/config/scoring');

const examples = [
  ['hash-map', 'function twoSum(nums, target) { const seen = new Map(); for (let i = 0; i < nums.length; i++) { if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i]; seen.set(nums[i], i); } }'],
  ['nested-loop', 'function twoSum(nums, target) { for (let i = 0; i < nums.length; i++) { for (let j = i + 1; j < nums.length; j++) { if (nums[i] + nums[j] === target) return [i, j]; } } }'],
  ['messy', 'function f(a,b){var x;for(var i=0;i<a.length;i++){for(var j=i+1;j<a.length;j++){if(a[i]+a[j]==b){x=[i,j];return x}}}}'],
];

const run = async () => {
  const problem = { description: 'Return two indices whose values sum to target.', optimalTime: 'O(n)', optimalSpace: 'O(n)', timeLimitMs: 2000 };
  const analyses = await Promise.all(examples.map(([, code]) => analyzeSolution({ problem, language: 'javascript', code })));
  const player = (analysis, user) => ({ user, analysis, bestPassed: 7, totalTests: 7, solvedAt: new Date(1000), runtimeMs: 100 });
  const battle = { problem, startedAt: new Date(0), battleDurationMs: 10000, players: [player(analyses[0], 'hash-map'), player(analyses[1], 'nested-loop')] };
  const { scores } = computeResult(battle);
  examples.forEach(([name], index) => console.log(`${name}: ${JSON.stringify(analyses[index])}`));
  console.log(`scores: hash-map=${scores[0].total.toFixed(2)}, nested-loop=${scores[1].total.toFixed(2)}`);
  const passed = analyses[1]?.timeComplexity === 'O(n^2)' && scores[1].total < scores[0].total;
  console.log(`${passed ? 'PASS' : 'FAIL'} nested-loop complexity and lower score`);
  if (!passed) process.exitCode = 1;
};

run().catch((err) => { console.error(err.message); process.exitCode = 1; });
