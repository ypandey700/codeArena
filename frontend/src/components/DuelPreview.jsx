import { useState } from "react";
import { ArrowRight, Check, Code2, RotateCcw } from "lucide-react";

const SOLUTION = `def two_sum(nums, target):
    seen = {}

    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i`;

export default function DuelPreview() {
  const [code, setCode] = useState(SOLUTION);
  const [showResult, setShowResult] = useState(false);
  const lines = code.split("\n");

  return (
    <section id="live-preview" className="duel-preview-theme reference-duel mx-auto max-w-[1280px] scroll-mt-20 px-5 pb-14 sm:px-8 lg:px-10">
      <div className="mb-6"><p className="mb-2 text-xs font-medium text-[#8fa9d5]">Interactive example / not a live match</p><h2 className="text-2xl font-semibold tracking-tight text-[#e4eaf5] sm:text-3xl">Explore a coding challenge</h2><p className="mt-3 text-sm leading-6 text-[#a7b3ca]">Read the challenge, write your code, and see how the answer comes together.</p></div>
      <div className="grid overflow-hidden rounded-xl border border-[#354057] bg-[#1b2230] lg:grid-cols-[.85fr_1.15fr]">
        <div className="flex flex-col border-b border-[#354057] p-6 sm:p-8 lg:border-b-0 lg:border-r">
          <div className="mb-5 flex items-center gap-3"><span className="rounded-md bg-[#234036] px-2.5 py-1 text-xs font-medium text-[#9bd3b9]">Easy</span><span className="text-xs text-[#8999b4]">Arrays / Hash map</span></div>
          <h3 className="text-2xl font-semibold text-[#e4eaf5]">Two Sum</h3>
          <p className="mt-4 text-base leading-7 text-[#b3bfd3]">Find two numbers in the array that add up to the target. Return their positions.</p>
          <div className="mt-6 rounded-lg border border-[#354057] bg-[#161c28] p-5"><p className="mb-3 text-xs font-medium text-[#8999b4]">Example</p><div className="flex flex-wrap gap-2">{[2, 7, 11, 15].map((number, index) => <span key={number} className={`flex h-11 w-11 items-center justify-center rounded-md border font-mono text-base ${index < 2 ? "border-[#6088bd] bg-[#2c4262] text-[#c2dcff]" : "border-[#354057] bg-[#202a3b] text-[#a7b3ca]"}`}>{number}</span>)}</div><p className="mt-4 text-sm text-[#a7b3ca]">Target: <b className="font-mono text-[#e4eaf5]">9</b></p><p className="mt-2 text-sm text-[#a7b3ca]">2 + 7 = 9 <span className="mx-2 text-[#596983]">/</span> Answer: <code className="text-[#9bd3b9]">[0, 1]</code></p></div>
          <p className="mt-5 text-sm leading-6 text-[#8999b4]">Each input has one answer. You cannot use the same number twice.</p>
        </div>
        <div className="flex min-w-0 flex-col bg-[#151b26]">
          <div className="flex items-center justify-between gap-3 border-b border-[#354057] px-5 py-4"><span className="flex items-center gap-2 text-sm text-[#d5deed]"><Code2 size={17} className="text-[#8faee0]" />two_sum.py</span><span className="text-xs text-[#8999b4]">Python 3</span></div>
          <div className="flex min-h-[290px] flex-1 py-5"><div aria-hidden="true" className="select-none pl-4 pr-3 text-right font-mono text-[13px] leading-7 text-[#52617a]">{lines.map((_, index) => <div key={index}>{index + 1}</div>)}</div><textarea aria-label="Two Sum Python code" spellCheck="false" value={code} onChange={(event) => { setCode(event.target.value); setShowResult(false); }} className="min-h-[260px] min-w-0 flex-1 resize-y bg-transparent pr-5 font-mono text-[13px] leading-7 text-[#c5d4eb] outline-none sm:text-sm" /></div>
          {showResult && <div role="status" className="mx-5 mb-4 rounded-lg border border-[#385747] bg-[#20372d] p-4"><p className="flex items-center gap-2 text-sm font-medium text-[#a6d5b7]"><Check size={17} />Example answer: [0, 1]</p><p className="mt-2 text-xs leading-5 text-[#a2b6aa]">Positions 0 and 1 contain 2 and 7. This is an example preview; edited code is not executed.</p></div>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#354057] px-5 py-4"><button onClick={() => { setCode(SOLUTION); setShowResult(false); }} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-[#a7b3ca] hover:bg-white/5 hover:text-white"><RotateCcw size={14} />Reset</button><button onClick={() => setShowResult(true)} className="flex items-center gap-3 rounded-md bg-[#94b7ed] px-5 py-2.5 text-sm font-semibold text-[#172238] hover:bg-[#b1ccf4]">See example result<ArrowRight size={16} /></button></div>
        </div>
      </div>
    </section>
  );
}
