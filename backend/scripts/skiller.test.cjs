const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TOPICS, DIAGNOSTIC, PROBLEMS } = require('../src/skiller/curriculum');
const { topicMap, recommend } = require('../src/skiller/mastery');
const { parseProfile, importPublicTopics } = require('../src/skiller/profiles');


const nums = (input) => input.trim().split(/\s+/).map(Number);
const reference = {
  'array-total': (input) => nums(input).slice(1).reduce((a,b) => a+b,0),
  'above-the-line': (input) => { const [n,k,...a]=nums(input); return a.filter(x=>x>k).length; },
  'best-contiguous-sum': (input) => { const [n,...a]=nums(input); let best=-Infinity; for(let l=0;l<n;l++){let sum=0;for(let r=l;r<n;r++){sum+=a[r];best=Math.max(best,sum);}}return best; },
  'range-sum-desk': (input) => { const [n,q,...a]=nums(input),out=[];for(let i=0;i<q;i++){const l=a[n+i*2],r=a[n+i*2+1];out.push(a.slice(l,r+1).reduce((s,x)=>s+x,0));}return out.join('\n'); },
  'vowel-tally': input => (input.match(/[aeiou]/gi)||[]).length,
  'mirror-check': input => { const text=input.toLowerCase().replace(/[^a-z0-9]/g,'');return text===[...text].reverse().join('')?'YES':'NO'; },
  'compact-runs': input => [...input.matchAll(/(.)\1*/g)].map(match=>match[1]+match[0].length).join(''),
  'unique-window': input => { let best=0;for(let l=0;l<input.length;l++){const seen=new Set();for(let r=l;r<input.length;r++){if(seen.has(input[r]))break;seen.add(input[r]);best=Math.max(best,seen.size);}}return best; },
  'distinct-values': input => new Set(nums(input).slice(1)).size,
  'first-lone-letter': input => [...input].findIndex(char=>input.indexOf(char)===input.lastIndexOf(char)),
  'target-pair': input => { const [n,k,...a]=nums(input);for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(a[i]+a[j]===k)return `${i} ${j}`; },
  'consecutive-chain': input => { const a=[...new Set(nums(input).slice(1))].sort((a,b)=>a-b);let best=0,run=0,last;for(const x of a){run=last!=null&&x===last+1?run+1:1;best=Math.max(best,run);last=x;}return best; },
  'sorted-search': input => { const [n,k,...a]=nums(input);return a.indexOf(k); },
  'first-not-smaller': input => { const [n,k,...a]=nums(input),index=a.findIndex(x=>x>=k);return index<0?n:index; },
  'integer-root': input => Math.floor(Math.sqrt(Number(input))),
  'shipping-capacity': input => { const [n,d,...a]=nums(input);for(let c=Math.max(...a);c<=a.reduce((s,x)=>s+x,0);c++){let days=1,used=0;for(const x of a){if(used+x>c){days++;used=0;}used+=x;}if(days<=d)return c;} },
  'bracket-balance': input => { let text=input;while(/\(\)|\[\]|\{\}/.test(text))text=text.replace(/\(\)|\[\]|\{\}/g,'');return text?'NO':'YES'; },
  'cancel-neighbours': input => { let text=input;while(/(.)\1/.test(text))text=text.replace(/(.)\1/g,'');return text||'EMPTY'; },
  'warmer-days': input => { const [n,...a]=nums(input);return a.map((x,i)=>{for(let j=i+1;j<n;j++)if(a[j]>x)return j-i;return 0;}).join(' '); },
  'largest-skyline-rectangle': input => { const [n,...a]=nums(input);let best=0;for(let l=0;l<n;l++){let height=Infinity;for(let r=l;r<n;r++){height=Math.min(height,a[r]);best=Math.max(best,height*(r-l+1));}}return best; },
  'staircase-routes': input => { const n=Number(input),dp=[1,1];for(let i=2;i<=n;i++)dp[i]=dp[i-1]+dp[i-2];return dp[n]; },
  'non-adjacent-picks': input => { const [n,...a]=nums(input);let prev=0,current=0;for(const x of a){const next=Math.max(current,prev+x);prev=current;current=next;}return current; },
  'minimum-coins': input => { const [n,target,...a]=nums(input),dp=Array(target+1).fill(Infinity);dp[0]=0;for(let i=1;i<=target;i++)for(const coin of a)if(i>=coin)dp[i]=Math.min(dp[i],dp[i-coin]+1);return Number.isFinite(dp[target])?dp[target]:-1; },
  'common-subsequence': input => { const [a='',b='']=input.split('\n'),dp=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]+1:Math.max(dp[i-1][j],dp[i][j-1]);return dp[a.length][b.length]; },
};

test('curated bank has real, consistent test cases for all 24 questions', () => {
  assert.equal(PROBLEMS.length,24);assert.equal(new Set(PROBLEMS.map(p=>p.slug)).size,24);
  for(const topic of TOPICS)assert.equal(PROBLEMS.filter(p=>p.topic===topic.id).length,4);
  for(const problem of PROBLEMS){assert.ok(problem.sampleTestCases.length&&problem.hiddenTestCases.length&&problem.hints.length);for(const sample of [...problem.sampleTestCases,...problem.hiddenTestCases])assert.equal(String(reference[problem.slug](sample.input)).trim(),sample.expectedOutput.trim(),`${problem.slug}: ${JSON.stringify(sample.input)}`);}
});

const resultAttempt=(id,problem,status='accepted',options={})=>({ _id:id,problem,topic:'arrays',submissions:1,runs:0,hintsUsed:[],startedAt:new Date(2026,0,id),updatedAt:new Date(2026,0,id),result:{status,passedCount:status==='accepted'?6:0,totalCount:6},...options });
test('mastery requires diverse independent solves, deduplicates reviews, and keeps unknown topics unassessed',()=>{
  assert.ok(topicMap({},[]).every(topic=>topic.score===null&&topic.status==='unassessed'));
  const same=topicMap({},[resultAttempt(1,'p1'),resultAttempt(2,'p1'),resultAttempt(3,'p1')])[0];assert.equal(same.uniqueSolved,1);assert.notEqual(same.status,'strong');
  const diverse=topicMap({},[resultAttempt(1,'p1'),resultAttempt(2,'p2'),resultAttempt(3,'p3')])[0];assert.equal(diverse.status,'strong');assert.equal(diverse.uniqueSolved,3);
  const helped=topicMap({},[resultAttempt(1,'p1','accepted',{hintsUsed:[0,1]}),resultAttempt(2,'p2','accepted',{hintsUsed:[0,1]}),resultAttempt(3,'p3','accepted',{hintsUsed:[0,1]})])[0];assert.notEqual(helped.status,'strong');
  const afterFailure=topicMap({},[resultAttempt(1,'p1'),resultAttempt(2,'p2'),resultAttempt(3,'p3'),resultAttempt(4,'p4','wrong_answer')])[0];assert.notEqual(afterFailure.status,'strong');
  const declining=topicMap({},[resultAttempt(1,'p1'),resultAttempt(2,'p2','wrong_answer'),resultAttempt(3,'p3','wrong_answer'),resultAttempt(4,'p4','wrong_answer')])[0];assert.equal(declining.status,'needs-practice');
  assert.equal(topicMap({},[resultAttempt(1,'p1')])[0].score,topicMap({},[resultAttempt(1,'p1','accepted',{interview:{feedback:{source:'skipped',score:0}}})])[0].score);
  const prior={diagnostic:{answers:DIAGNOSTIC.map(q=>({questionId:q.id,option:q.answer,correct:true}))}};assert.ok(topicMap(prior,[]).every(topic=>topic.status!=='strong'&&topic.confidence==='estimated'));
});
test('recommendations prefer unsolved weak-topic questions and label exhausted-bank reviews',()=>{
  const problems=PROBLEMS.map((p,i)=>({...p,_id:String(i)})),topics=topicMap({},[]);
  const pick=recommend(problems,topics,[],'stacks',()=>0);assert.equal(pick.problem.topic,'stacks');assert.equal(pick.problem.difficulty,'easy');
  const attempted=problems.map((p,i)=>resultAttempt(i+1,p._id,'accepted',{topic:p.topic}));const review=recommend(problems,topicMap({},attempted),attempted,null,()=>0);assert.equal(review.kind,'review');
  const solved=[resultAttempt(1,pick.problem._id,'accepted',{topic:'stacks'})];assert.notEqual(recommend(problems,topicMap({},solved),solved,'stacks',()=>0).problem._id,pick.problem._id);
  const failed=[resultAttempt(1,pick.problem._id,'wrong_answer',{topic:'stacks'})];assert.equal(recommend(problems,topicMap({},failed),failed,null,()=>0).problem.topic,'stacks');
  const skipped=[{problem:pick.problem._id,topic:'stacks',state:'abandoned',startedAt:new Date()}];assert.notEqual(recommend(problems,topics,skipped,'stacks',()=>0).problem._id,pick.problem._id);
});
test('profile inputs reject arbitrary URLs; unavailable sources never fabricate topic evidence',async()=>{
  for(const url of ['http://leetcode.com/u/name/','https://leetcode.com.evil.test/u/name/','https://name:password@leetcode.com/u/name/','https://localhost/u/name/','file:///etc/passwd'])assert.throws(()=>parseProfile('leetcode',url));
  assert.equal(parseProfile('leetcode','https://leetcode.com/u/student/').username,'student');
  let requests=0;const linked=await importPublicTopics(parseProfile('codechef','https://www.codechef.com/users/student'),async()=>{requests++;throw Error('must not fetch');});assert.equal(requests,0);assert.equal(linked.status,'linked');
  const unavailable=await importPublicTopics(parseProfile('leetcode','https://leetcode.com/student/'),async()=>{throw Error('offline');});assert.equal(unavailable.status,'unavailable');assert.deepEqual(unavailable.topicCounts,{});
  const imported=await importPublicTopics(parseProfile('leetcode','https://leetcode.com/student/'),async()=>new Response(JSON.stringify({data:{matchedUser:{tagProblemCounts:{fundamental:[{tagSlug:'array',problemsSolved:7}],intermediate:[],advanced:[]}}}}),{status:200}));assert.equal(imported.topicCounts.arrays,7);
});
test('MongoDB integration: persistence, ownership, concurrency, retries, profile strength, automatic completion, and legacy recovery',async(t)=>{
  const mongoose=require('mongoose'),database=`skiller_test_${process.pid}_${Date.now()}`;
  assert.match(database,/^skiller_test_\d+_\d+$/);
  await mongoose.connect(process.env.SKILLER_TEST_MONGO_URI||'mongodb://127.0.0.1:27017',{dbName:database,serverSelectionTimeoutMS:5000});
  t.after(async()=>{assert.equal(mongoose.connection.name,database);await mongoose.connection.dropDatabase();await mongoose.disconnect();});
  let mode='accepted',runnerCalls=0,releaseRun;
  const runnerPath=require.resolve('../src/services/codeRunnerService');require(runnerPath);require.cache[runnerPath].exports={runSubmission:async({testCases})=>{runnerCalls++;if(mode==='throw')throw Error('Runner unavailable');if(mode==='delay')await new Promise(resolve=>{releaseRun=resolve;});return{status:mode==='wrong'?'wrong_answer':'accepted',passedCount:mode==='wrong'?0:testCases.length,totalCount:testCases.length,executionTimeMs:8,testResults:testCases.map(test=>({passed:mode!=='wrong',output:test.expectedOutput,expected:test.expectedOutput,timeMs:1}))};}};
  const llmPath=require.resolve('../src/services/llmService');require(llmPath);require.cache[llmPath].exports={callLLM:async()=>{throw Error('Skiller must not call AI');}};
  for(const module of ['../src/skiller/service'])delete require.cache[require.resolve(module)];
  const service=require('../src/skiller/service'),{SkillerAttempt,SkillerProfile}=require('../src/skiller/models');
  const userA=new mongoose.Types.ObjectId(),userB=new mongoose.Types.ObjectId();
  const dashboard=await service.dashboard(userA);assert.equal(dashboard.bankCount,24);assert.equal(dashboard.stats.uniqueSolved,0);assert.ok(dashboard.topics.every(topic=>topic.status==='unassessed'));
  assert.ok(service.diagnostic().every(question=>!('answer'in question)&&!('explanation'in question)));
  await service.saveDiagnostic(userA,DIAGNOSTIC.map(question=>({questionId:question.id,option:null})));assert.ok((await service.dashboard(userA)).topics.every(topic=>topic.status==='unassessed'));
  await assert.rejects(service.saveDiagnostic(userA,Array(12).fill({questionId:DIAGNOSTIC[0].id,option:0})),error=>error.status===400);
  const concurrent=await Promise.all([service.nextAttempt(userA,'arrays'),service.nextAttempt(userA,'arrays'),service.nextAttempt(userA,'arrays')]);assert.equal(new Set(concurrent.map(attempt=>attempt.id)).size,1);
  assert.equal((await service.nextAttempt(userA,'strings')).id,concurrent[0].id);
  let attempt=concurrent[0];assert.equal(attempt.topic,'arrays');assert.equal(attempt.problem.hiddenTestCases,undefined);assert.equal(attempt.problem.hints,undefined);assert.equal(attempt.hints.length,0);
  await assert.rejects(service.getAttempt(userB,attempt.id),error=>error.status===404);
  const saved=await service.saveDraft(userA,attempt.id,'python','print(1)',0);assert.equal(saved.draftRevision,1);await assert.rejects(service.saveDraft(userA,attempt.id,'python','stale',0),error=>error.status===409);assert.equal((await service.getAttempt(userA,attempt.id)).code,'print(1)');
  attempt=await service.revealHint(userA,attempt.id);assert.equal(attempt.hints.length,1);assert.equal(attempt.hintsAvailable,1);
  const input={language:'python',code:'print(1)',revision:attempt.draftRevision,requestId:'run-unique-001'};attempt=await service.evaluate(userA,attempt.id,input,false);assert.equal(attempt.runs,1);const callsBeforeReplay=runnerCalls;attempt=await service.evaluate(userA,attempt.id,input,false);assert.equal(runnerCalls,callsBeforeReplay);assert.equal(attempt.runs,1);
  mode='wrong';attempt=await service.evaluate(userA,attempt.id,{...input,revision:attempt.draftRevision,requestId:'submit-wrong-001'},true);assert.equal(attempt.state,'coding');assert.equal(attempt.submissions,1);assert.equal((await service.dashboard(userA)).stats.uniqueSolved,0);
  let storedProfile=await SkillerProfile.findOne({user:userA}).lean();assert.ok(storedProfile.weakTopics.includes('arrays'));assert.equal(storedProfile.practiceStats.submissions,1);assert.equal(storedProfile.practiceStats.uniqueSolved,0);
  mode='accepted';const acceptedInput={...input,revision:attempt.draftRevision,requestId:'submit-correct-001'};attempt=await service.evaluate(userA,attempt.id,acceptedInput,true);assert.equal(attempt.state,'complete');assert.equal(attempt.active,false);assert.ok(attempt.completedAt);assert.equal(attempt.submissions,2);assert.equal(attempt.interview,undefined);assert.ok(attempt.result.testResults.every(test=>!('output'in test)&&!('expected'in test)));
  storedProfile=await SkillerProfile.findOne({user:userA}).lean();assert.equal(storedProfile.practiceStats.uniqueSolved,1);assert.equal(storedProfile.practiceStats.submissions,2);assert.ok(!storedProfile.weakTopics.includes('arrays'));assert.equal(storedProfile.topicStrengths.find(topic=>topic.topic==='arrays').uniqueSolved,1);assert.ok(storedProfile.progressUpdatedAt);
  const callsBeforeAcceptReplay=runnerCalls;await service.evaluate(userA,attempt.id,acceptedInput,true);assert.equal(runnerCalls,callsBeforeAcceptReplay);assert.equal((await service.dashboard(userA)).stats.submissions,2);assert.equal((await service.dashboard(userB)).stats.uniqueSolved,0);
  await assert.rejects(service.saveDraft(userA,attempt.id,'python','new',attempt.draftRevision),error=>error.status===409);
  const review=await SkillerAttempt.create({user:userA,problem:attempt.problem._id,topic:attempt.topic,difficulty:attempt.difficulty,kind:'review',code:'print(1)'});let repeated=await service.evaluate(userA,String(review._id),{...input,revision:0,requestId:'review-accepted-001'},true);assert.equal(repeated.state,'complete');assert.equal((await service.dashboard(userA)).stats.uniqueSolved,1);
  let next=await service.nextAttempt(userA,'strings');mode='delay';const running=service.evaluate(userA,next.id,{...input,revision:next.draftRevision,requestId:'run-delayed-001'},false);for(let i=0;i<100&&!releaseRun;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(releaseRun);await assert.rejects(service.evaluate(userA,next.id,{...input,revision:next.draftRevision,requestId:'run-concurrent-001'},false),error=>error.status===409);releaseRun();next=await running;assert.equal(next.processing,false);
  mode='throw';await assert.rejects(service.evaluate(userA,next.id,{...input,revision:next.draftRevision,requestId:'run-failed-001'},false));assert.equal((await service.getAttempt(userA,next.id)).processing,false);
  await service.abandon(userA,next.id);assert.equal((await service.dashboard(userA)).activeAttempt,null);
  const historyPage1=await service.history(userA,1,2),historyPage2=await service.history(userA,2,2);
  assert.equal(historyPage1.total,3);assert.equal(historyPage1.pages,2);assert.equal(historyPage1.attempts.length,2);assert.equal(historyPage2.attempts.length,1);
  const historyRows=[...historyPage1.attempts,...historyPage2.attempts];assert.equal(new Set(historyRows.map(row=>row.id)).size,3);
  assert.equal(historyRows[0].id,next.id);assert.equal(historyRows[0].state,'abandoned');assert.equal(historyRows[1].state,'complete');assert.ok(historyRows.every(row=>row.title&&row.startedAt));
  for(const row of historyRows)for(const key of ['code','evaluations','interview','user','lastRun'])assert.equal(row[key],undefined);
  assert.equal((await service.history(userB)).total,0);assert.equal((await service.history(userA,999,2)).page,2);
  for(const [page,limit]of [[0,8],['invalid',8],[1,51],[1,1.5]])await assert.rejects(service.history(userA,page,limit),error=>error.status===400);
  const legacy=await SkillerAttempt.create({user:userB,problem:attempt.problem._id,topic:'arrays',difficulty:'easy',state:'interview',submissions:1,result:{status:'accepted',passedCount:6,totalCount:6},code:'print(1)',processingAt:new Date(Date.now()-125000),processingToken:'old-interview'});
  const restored=await service.getAttempt(userB,String(legacy._id));assert.equal(restored.state,'complete');assert.equal(restored.active,false);assert.equal(restored.interview,undefined);assert.equal((await SkillerProfile.findOne({user:userB})).practiceStats.uniqueSolved,1);
  const following=await service.nextAttempt(userB);assert.notEqual(following.id,restored.id);assert.equal(following.state,'coding');
  assert.equal((await service.history(userB)).total,2);assert.ok((await service.history(userB)).attempts.every(row=>!historyRows.some(own=>own.id===row.id)));
  const userC=new mongoose.Types.ObjectId(),originalFetch=global.fetch;
  try {
    global.fetch=async()=>new Response(JSON.stringify({data:{matchedUser:{tagProblemCounts:{fundamental:[{tagSlug:'array',problemsSolved:12}],intermediate:[{tagSlug:'binary-search',problemsSolved:0}],advanced:[]}}}}),{status:200});
    const linked=await service.saveLink(userC,'leetcode','https://leetcode.com/u/student/');assert.equal(linked.link.status,'imported');assert.equal(linked.dashboard.topics.find(topic=>topic.id==='binary-search').status,'needs-practice');
    assert.equal((await service.nextAttempt(userC)).topic,'binary-search');assert.equal((await service.dashboard(userA)).links.length,0);
    const removed=await service.removeLink(userC,'leetcode');assert.equal(removed.links.length,0);assert.equal(removed.topics.find(topic=>topic.id==='arrays').status,'unassessed');
  } finally {global.fetch=originalFetch;}
  const hidden=service.sanitizeResult({status:'runtime_error',error:'private hidden input',testResults:[{passed:false,output:'private',expected:'secret'}]},0,true);assert.equal(hidden.testResults[0].output,undefined);assert.ok(!hidden.error.includes('private'));
  const compile=service.sanitizeResult({status:'compile_error',error:'secret input in compiler diagnostics',testResults:[{passed:false,output:'secret printed during sample case',expected:'known sample'}]},1,true);assert.equal(compile.testResults[0].hidden,false);assert.equal(compile.testResults[0].output,undefined);assert.ok(!compile.error.includes('secret'));
  const visible=service.sanitizeResult({status:'wrong_answer',testResults:[{passed:false,output:'debug',expected:'answer'}]},1,false);assert.equal(visible.testResults[0].output,'debug');
});
