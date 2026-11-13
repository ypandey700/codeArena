import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { arenaLanguages, prepareTwoSumCode } from "../services/arenaExecution";
import PostMatchResults from "./PostMatchResults";

const templates = [
`class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, num in enumerate(nums):
            if target - num in seen:
                return [seen[target - num], i]
            seen[num] = i
        return []`,
`function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];
    seen.set(nums[i], i);
  }
  return [];
}`,
`class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < nums.size(); i++) {
            if (seen.count(target - nums[i])) return {seen[target - nums[i]], i};
            seen[nums[i]] = i;
        }
        return {};
    }
};`,
`class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            if (seen.containsKey(target - nums[i])) return new int[]{seen.get(target - nums[i]), i};
            seen.put(nums[i], i);
        }
        return new int[]{};
    }
}`,
];

export default function BattleArena({ onExit, onQueueNext, onReport, onInterview }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const frameRef = useRef(null);
  const [concede, setConcede] = useState(false);
  const [results, setResults] = useState(false);
  const [popup, setPopup] = useState(null);
  const [selectedCase, setSelectedCase] = useState(0);
  const popupRef = useRef(null);
  const sourceRef = useRef({ language: 0, editor: null });
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [execution, setExecution] = useState(null);
  const [executionError, setExecutionError] = useState("");
  function submitToInterview() {
    if (busyRef.current) return;
    const source = sourceRef.current;
    const code = source.editor?.value || "";
    if (!code.trim()) {
      setExecution(null);
      setExecutionError("Write your solution before starting the interview.");
      setPopup("run");
      return;
    }
    // Interview handoff does not depend on Docker or claim a judge verdict.
    setPopup(null);
    onInterview?.();
    navigate("/ai-interview", { state: { interviewDraft: { code, language: arenaLanguages[source.language], problem: "two-sum" } } });
  }
  async function execute(submit = false) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setExecution(null); setExecutionError(""); setPopup("run");
    try {
      const source = sourceRef.current;
      const language = arenaLanguages[source.language];
      const code = prepareTwoSumCode(language, source.editor?.value || "");
      const response = await api.post(submit ? "/submissions" : "/submissions/run", { slug: "two-sum", language, code }, { timeout: 120000 });
      const result = submit ? response.data.data.submission : response.data.data;
      setExecution(result);
      if (submit && result.status === "accepted") {
        setPopup(null);
        onInterview?.();
        navigate("/ai-interview", { state: { submission: result } });
      }
    } catch (error) {
      setExecutionError(error.response?.data?.message || (error.code === "ECONNABORTED" ? "Execution timed out. Please try again." : error.message));
    } finally { busyRef.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (popup && !popupRef.current.open) popupRef.current.showModal();
    if (!popup && popupRef.current?.open) popupRef.current.close();
  }, [popup]);

  function connectArena() {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (!walker.currentNode.parentElement.closest("script, style")) walker.currentNode.textContent = walker.currentNode.textContent.replaceAll("v0id_runner", user?.username || "You");
    }
    const editor = doc.getElementById("battle-code-editor");
    const gutter = doc.querySelector("#editor-wrapper > div:first-child");
    let language = 0;
    sourceRef.current = { language: 0, editor };
    editor.value = templates[language];
    function updateLines() {
      gutter.replaceChildren(...Array.from({ length: Math.max(16, editor.value.split("\n").length) }, (_, index) => {
        const line = doc.createElement("div"); line.textContent = index + 1; return line;
      }));
      gutter.scrollTop = editor.scrollTop;
    }
    editor.addEventListener("input", updateLines);
    editor.addEventListener("scroll", () => { gutter.scrollTop = editor.scrollTop; });
    editor.addEventListener("keydown", (event) => {
      if (event.key === "Tab") { event.preventDefault(); editor.setRangeText("    ", editor.selectionStart, editor.selectionEnd, "end"); updateLines(); }
    });
    doc.querySelectorAll(".lang-tab").forEach((tab, index) => tab.addEventListener("click", () => { language = index; sourceRef.current.language = index; editor.value = templates[index]; updateLines(); }));
    doc.getElementById("reset-code-btn").addEventListener("click", () => { editor.value = templates[language]; updateLines(); });
    doc.querySelectorAll("#question-test-footer button").forEach((button, index) => {
      button.textContent = `Case ${index + 1}`;
      button.setAttribute("aria-label", `Open test case ${index + 1}`);
      button.addEventListener("click", () => { setSelectedCase(index); setPopup("cases"); });
    });
    const run = () => execute(false);
    doc.getElementById("run-local-tests-btn").addEventListener("click", run);
    doc.getElementById("submit-duel-btn").addEventListener("click", submitToInterview);
    doc.getElementById("concede-btn").addEventListener("click", () => setConcede(true));
    doc.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); run(); }
      if (event.altKey && event.key === "Enter") { event.preventDefault(); submitToInterview(); }
    });
    doc.getElementById("submit-duel-btn").setAttribute("type", "button");
    doc.getElementById("run-local-tests-btn").setAttribute("type", "button");
    const submitLabel = doc.querySelector("#submit-duel-btn > span:last-child");
    if (submitLabel) submitLabel.textContent = "Submit & Interview";
    updateLines();
  }

  return <>
    <iframe ref={frameRef} src="/battle-arena.html" title="Code Arena Two Sum duel" onLoad={connectArena} className="block h-dvh w-full border-0 bg-[#121414]" />
    {concede && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4"><div role="dialog" aria-modal="true" aria-labelledby="concede-heading" className="w-full max-w-sm rounded-xl border border-white/10 bg-[#16191c] p-6"><h2 id="concede-heading" className="text-lg font-semibold text-white">Leave this duel?</h2><p className="mt-2 text-sm text-[#a7b3ca]">This preview does not change your rating.</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setConcede(false)} className="rounded-md bg-white/5 px-4 py-2 text-xs text-white">Keep playing</button><button onClick={onExit} className="rounded-md bg-[#963c47] px-4 py-2 text-xs text-white">Concede</button></div></div></div>}
    <dialog ref={popupRef} onCancel={() => setPopup(null)} onClose={() => setPopup(null)} onClick={(event) => { if (event.target === popupRef.current) { const box = popupRef.current.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) setPopup(null); } }} aria-labelledby="arena-popup-title" className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-xl rounded-xl border border-[#343e50] bg-[#151a23] p-0 text-[#e4eaf5] shadow-2xl backdrop:bg-black/75">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4"><h2 id="arena-popup-title" className="text-base font-semibold">{popup === "submit" ? "Submit your solution?" : popup === "cases" ? "Local test cases" : "Test results"}</h2><button autoFocus onClick={() => setPopup(null)} aria-label="Close popup" className="rounded px-2 py-1 text-lg text-[#a7b3ca] hover:bg-white/5">&times;</button></div>
      {popup === "cases" ? <div className="p-6"><div role="tablist" aria-label="Test cases" className="mb-5 flex gap-2">{[0, 1, 2].map((index) => <button key={index} role="tab" aria-selected={selectedCase === index} aria-controls="selected-test-case" onClick={() => setSelectedCase(index)} className={`rounded-md border px-4 py-2 text-xs ${selectedCase === index ? "border-[#fddf49]/40 bg-[#fddf49]/10 text-[#fddf49]" : "border-white/10 text-[#a7b3ca] hover:bg-white/5"}`}>Case {index + 1}</button>)}</div><div id="selected-test-case" role="tabpanel" aria-label={`Case ${selectedCase + 1}`} className="space-y-4 rounded-lg border border-white/10 bg-[#0e131c] p-5">{[["Input array", ["[2, 7, 11, 15]", "[3, 2, 4]", "[3, 3]"][selectedCase]], ["Target", selectedCase === 0 ? "9" : "6"], ["Expected output", ["[0, 1]", "[1, 2]", "[0, 1]"][selectedCase]]].map(([label, value]) => <div key={label}><p className="mb-1.5 text-xs text-[#929bab]">{label}</p><code className={`block break-words rounded-md bg-white/[.04] px-3 py-2 text-sm ${label === "Expected output" ? "text-[#94bc9d]" : "text-[#e4eaf5]"}`}>{value}</code></div>)}</div><p className="mt-4 text-xs leading-5 text-[#929bab]">Return the positions of the two numbers, not the numbers themselves.</p></div> : popup === "run" ? <div className="max-h-[60vh] overflow-y-auto p-6" aria-live="polite">{busy ? <p className="text-sm text-[#a7b3ca]">Running your code in the sandbox...</p> : executionError ? <p role="alert" className="whitespace-pre-wrap text-sm text-[#e79aa5]">{executionError}</p> : execution && <><p className={`mb-4 text-sm font-semibold ${execution.status === "accepted" ? "text-[#94bc9d]" : "text-[#e79aa5]"}`}>{execution.status.replaceAll("_", " ")} / {execution.passedCount} of {execution.totalCount} tests passed</p>{execution.error && <pre className="mb-4 whitespace-pre-wrap break-words text-xs text-[#e79aa5]">{execution.error}</pre>}<div className="space-y-3">{execution.testResults?.map((test, index) => <div key={index} className="rounded-lg border border-white/10 bg-[#0e131c] p-4"><p className="mb-2 text-xs">Case {index + 1}: <span className={test.passed ? "text-[#94bc9d]" : "text-[#e79aa5]"}>{test.passed ? "Passed" : "Failed"}</span></p>{index < 2 ? <><p className="break-words font-mono text-xs text-[#a7b3ca]">Output: {test.output || "(empty)"}</p><p className="mt-2 font-mono text-xs text-[#a7b3ca]">Expected: {test.expected}</p></> : <p className="text-xs text-[#929bab]">Hidden test case</p>}</div>)}</div></>}</div> : <div className="p-6"><p className="text-sm leading-6 text-[#a7b3ca]">Submit your current solution against the sample and hidden test cases?</p><p className="mt-3 text-xs text-[#929bab]">Your submission will be saved. Incorrect solutions can be edited and submitted again.</p></div>}
      <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-4"><button onClick={() => setPopup(null)} className="rounded-md border border-white/10 px-4 py-2 text-xs hover:bg-white/5">{popup === "submit" ? "Keep editing" : "Close"}</button>{popup === "submit" && <button disabled={busy} onClick={submitToInterview} className="rounded-md bg-[#fddf49] px-4 py-2 text-xs font-semibold text-[#24200b] hover:bg-[#ffe76e]">Submit solution</button>}</div>
    </dialog>
    {results && <PostMatchResults onClose={onExit} onContinue={onReport} onQueueNext={onQueueNext} />}
  </>;
}
