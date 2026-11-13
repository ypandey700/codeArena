export const arenaLanguages = ["python", "javascript", "cpp", "java"];

// Adapt the editor's LeetCode method interface to the seeded problem's stdin/stdout format.
export function prepareTwoSumCode(language, code) {
  if (!code.trim()) throw new Error("Write a solution before running or submitting.");
  if (language === "python") return `${code}\n\nimport sys\n_data = list(map(int, sys.stdin.read().split()))\n_n, _target = _data[:2]\n_answer = Solution().twoSum(_data[2:2 + _n], _target)\nprint(*sorted(_answer))\n`;
  if (language === "javascript") return `${code}\nconst _data = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconst [_n, _target] = _data;\nconsole.log(twoSum(_data.slice(2, 2 + _n), _target).sort((a,b) => a-b).join(' '));\n`;
  if (language === "cpp") return `#include <bits/stdc++.h>\nusing namespace std;\n${code}\nint main() { int n, target; cin >> n >> target; vector<int> nums(n); for(auto &x: nums) cin >> x; auto answer = Solution().twoSum(nums, target); sort(answer.begin(), answer.end()); for(int i=0; i<answer.size(); ++i) cout << (i ? " " : "") << answer[i]; }`;
  return `import java.util.*;\n${code}\npublic class Main { public static void main(String[] args) { Scanner sc = new Scanner(System.in); int n = sc.nextInt(), target = sc.nextInt(); int[] nums = new int[n]; for(int i=0;i<n;i++) nums[i]=sc.nextInt(); int[] ans = new Solution().twoSum(nums,target); Arrays.sort(ans); for(int i=0;i<ans.length;i++) System.out.print((i>0?" ":"")+ans[i]); } }`;
}
