const assert = require('node:assert/strict');
const { runSubmission } = require('../src/services/codeRunnerService');
const { PROBLEMS } = require('../src/skiller/curriculum');
const problem = PROBLEMS.find((problem) => problem.slug === 'array-total');
const programs = {
  python: 'import sys\na=list(map(int,sys.stdin.read().split()))\nprint(sum(a[1:]))\n',
  javascript: 'const a=require("fs").readFileSync(0,"utf8").trim().split(/\\s+/).map(Number);console.log(a.slice(1).reduce((s,x)=>s+x,0));',
  cpp: '#include <iostream>\nusing namespace std; int main(){int n;cin>>n;long long x,s=0;while(n--){cin>>x;s+=x;}cout<<s<<"\\n";}',
  java: 'import java.util.*; public class Main { public static void main(String[] args){Scanner s=new Scanner(System.in);int n=s.nextInt();long total=0;while(n-->0)total+=s.nextLong();System.out.println(total);} }',
};
(async () => {
  for (const [language, code] of Object.entries(programs)) {
    const result = await runSubmission({ language, code, testCases: [...problem.sampleTestCases, ...problem.hiddenTestCases], timeLimitMs: problem.timeLimitMs, memoryLimitMb: problem.memoryLimitMb });
    assert.equal(result.status, 'accepted', `${language}: ${result.error || result.status}`);
    assert.equal(result.passedCount, problem.sampleTestCases.length + problem.hiddenTestCases.length);
    console.log(`${language}: ${result.passedCount}/${result.totalCount} passed using the existing Docker runner`);
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
