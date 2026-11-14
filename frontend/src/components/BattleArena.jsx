import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useBattle } from "../context/BattleContext";
import api from "../services/api";
import { arenaLanguages } from "../services/arenaExecution";
import PostMatchResults from "./PostMatchResults";

const defaultTemplates = [
`class Solution:
    def solve(self, *args):
        pass`,
`function solve(...args) {
  // your solution here
}`,
`#include <iostream>
using namespace std;

int main() {
    return 0;
}`,
`public class Solution {
    public static void main(String[] args) {
    }
}`,
];

export default function BattleArena({ onExit, onQueueNext, onReport }) {
  const { user } = useAuth();
  const {
    activeBattle,
    chatMessages,
    sendChatMessage,
    opponentProgress,
    submissionResult,
    submitBattleCode,
    forfeitBattle,
    timeOffset,
  } = useBattle();

  const navigate = useNavigate();
  const frameRef = useRef(null);
  const [concede, setConcede] = useState(false);
  const [popup, setPopup] = useState(null);
  const [selectedCase, setSelectedCase] = useState(0);
  const popupRef = useRef(null);
  const sourceRef = useRef({ language: 0, editor: null });
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [execution, setExecution] = useState(null);
  const [executionError, setExecutionError] = useState("");
  const [chatInput, setChatInput] = useState("");

  const problem = activeBattle?.problem;
  const opponent = activeBattle?.opponent;
  const totalTests =
    opponentProgress?.totalCount ||
    submissionResult?.totalCount ||
    activeBattle?.ownProgress?.totalTests ||
    (problem?.sampleTestCases?.length || 0) + 5;

  const calculateRemainingSeconds = () => {
    if (!activeBattle?.endsAt) return 900;
    const now = Date.now() + (timeOffset || 0);
    const end = new Date(activeBattle.endsAt).getTime();
    return Math.max(0, Math.floor((end - now) / 1000));
  };

  const [remainingTime, setRemainingTime] = useState(calculateRemainingSeconds);

  useEffect(() => {
    const timer = setInterval(() => {
      const rem = calculateRemainingSeconds();
      setRemainingTime(rem);
      const doc = frameRef.current?.contentDocument;
      if (doc) {
        const timerEl = doc.getElementById("duel-timer");
        if (timerEl) {
          const m = String(Math.floor(rem / 60)).padStart(2, "0");
          const s = String(rem % 60).padStart(2, "0");
          timerEl.textContent = `${m}:${s}`;
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [activeBattle, timeOffset]);

  useEffect(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;

    const myPassed = submissionResult?.passedCount ?? (activeBattle?.ownProgress?.bestPassed || 0);
    const oppPassed = opponentProgress?.passedCount ?? (activeBattle?.opponentProgress?.bestPassed || 0);

    const hudPills = doc.querySelectorAll(".font-mono.text-\\[11px\\].font-bold");
    if (hudPills.length >= 2) {
      hudPills[0].innerHTML = `${myPassed}<span class="text-muted font-normal">/${totalTests}</span>`;
      hudPills[1].innerHTML = `${oppPassed}<span class="text-muted font-normal">/${totalTests}</span>`;
    }
  }, [submissionResult, opponentProgress, activeBattle, totalTests]);

  async function execute(submit = false) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setExecution(null);
    setExecutionError("");
    setPopup("run");

    try {
      const source = sourceRef.current;
      const language = arenaLanguages[source.language] || "python";
      const code = source.editor?.value || "";

      if (submit) {
        const res = await submitBattleCode({ language, code });
        setExecution(res?.data || res);
      } else {
        const sampleTests = problem?.sampleTestCases || [];
        const response = await api.post(
          "/submissions/run",
          {
            slug: problem?.slug || "two-sum",
            language,
            code,
            testCases: sampleTests,
          },
          { timeout: 120000 }
        );
        setExecution(response.data?.data || response.data);
      }
    } catch (error) {
      setExecutionError(
        error.response?.data?.message ||
          (error.code === "ECONNABORTED" ? "Execution timed out. Please try again." : error.message)
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (popup && !popupRef.current?.open) popupRef.current?.showModal();
    if (!popup && popupRef.current?.open) popupRef.current?.close();
  }, [popup]);

  function connectArena() {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;

    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.parentElement.closest("script, style")) continue;
      walker.currentNode.textContent = walker.currentNode.textContent
        .replaceAll("v0id_runner", user?.username || "You")
        .replaceAll("KageNinja_99", opponent?.username || "Challenger");
    }

    if (problem) {
      const titleEl = doc.querySelector("#question-panel h2");
      if (titleEl) titleEl.textContent = problem.title;
      const descEl = doc.querySelector("#desc-tab-content p, #question-panel .leading-relaxed");
      if (descEl && problem.description) descEl.textContent = problem.description;
    }

    const editor = doc.getElementById("battle-code-editor");
    const gutter = doc.querySelector("#editor-wrapper > div:first-child");
    let language = 0;
    sourceRef.current = { language: 0, editor };

    const starter = problem?.starterCode?.python || problem?.starterCode?.javascript || defaultTemplates[language];
    if (editor) editor.value = starter;

    function updateLines() {
      if (!gutter || !editor) return;
      gutter.replaceChildren(
        ...Array.from({ length: Math.max(16, editor.value.split("\n").length) }, (_, index) => {
          const line = doc.createElement("div");
          line.textContent = index + 1;
          return line;
        })
      );
      gutter.scrollTop = editor.scrollTop;
    }

    if (editor) {
      editor.addEventListener("input", updateLines);
      editor.addEventListener("scroll", () => {
        gutter.scrollTop = editor.scrollTop;
      });
      editor.addEventListener("keydown", (event) => {
        if (event.key === "Tab") {
          event.preventDefault();
          editor.setRangeText("    ", editor.selectionStart, editor.selectionEnd, "end");
          updateLines();
        }
      });
    }

    doc.querySelectorAll(".lang-tab").forEach((tab, index) =>
      tab.addEventListener("click", () => {
        language = index;
        sourceRef.current.language = index;
        const langKey = arenaLanguages[index];
        const starterCode = problem?.starterCode?.[langKey] || defaultTemplates[index];
        if (editor) editor.value = starterCode;
        updateLines();
      })
    );

    const resetBtn = doc.getElementById("reset-code-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        const langKey = arenaLanguages[language];
        if (editor) editor.value = problem?.starterCode?.[langKey] || defaultTemplates[language];
        updateLines();
      });
    }

    doc.querySelectorAll("#question-test-footer button").forEach((button, index) => {
      button.textContent = `Case ${index + 1}`;
      button.setAttribute("aria-label", `Open test case ${index + 1}`);
      button.addEventListener("click", () => {
        setSelectedCase(index);
        setPopup("cases");
      });
    });

    const runBtn = doc.getElementById("run-local-tests-btn");
    if (runBtn) {
      runBtn.setAttribute("type", "button");
      runBtn.addEventListener("click", () => execute(false));
    }

    const submitBtn = doc.getElementById("submit-duel-btn");
    if (submitBtn) {
      submitBtn.setAttribute("type", "button");
      const submitLabel = doc.querySelector("#submit-duel-btn > span:last-child");
      if (submitLabel) submitLabel.textContent = "Submit Solution";
      submitBtn.addEventListener("click", () => execute(true));
    }

    const concedeBtn = doc.getElementById("concede-btn");
    if (concedeBtn) {
      concedeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        setConcede(true);
      });
    }

    doc.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        execute(false);
      }
      if (event.altKey && event.key === "Enter") {
        event.preventDefault();
        execute(true);
      }
    });

    updateLines();
  }

  const handleConcede = () => {
    setConcede(false);
    forfeitBattle();
  };

  const sampleCases = problem?.sampleTestCases || [
    { input: "[2, 7, 11, 15], 9", expected: "[0, 1]" },
    { input: "[3, 2, 4], 6", expected: "[1, 2]" },
    { input: "[3, 3], 6", expected: "[0, 1]" },
  ];

  return (
    <>
      <iframe
        ref={frameRef}
        src="/battle-arena.html"
        title="Code Arena 1v1 Battle"
        onLoad={connectArena}
        className="block h-dvh w-full border-0 bg-[#121414]"
      />

      {concede && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="concede-heading" className="w-full max-w-sm rounded-xl border border-white/10 bg-[#16191c] p-6 shadow-2xl">
            <h2 id="concede-heading" className="text-lg font-semibold text-white">Forfeit this duel?</h2>
            <p className="mt-2 text-sm text-[#a7b3ca]">Forfeiting will immediately concede the match. Your opponent will receive the victory.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConcede(false)} className="rounded-md bg-white/5 px-4 py-2 text-xs text-white hover:bg-white/10">Keep playing</button>
              <button onClick={handleConcede} className="rounded-md bg-[#963c47] px-4 py-2 text-xs text-white hover:bg-[#a84450]">Concede</button>
            </div>
          </div>
        </div>
      )}

      <dialog
        ref={popupRef}
        onCancel={() => setPopup(null)}
        onClose={() => setPopup(null)}
        onClick={(event) => {
          if (event.target === popupRef.current) {
            const box = popupRef.current.getBoundingClientRect();
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) {
              setPopup(null);
            }
          }
        }}
        aria-labelledby="arena-popup-title"
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-xl rounded-xl border border-[#343e50] bg-[#151a23] p-0 text-[#e4eaf5] shadow-2xl backdrop:bg-black/75"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 id="arena-popup-title" className="text-base font-semibold">
            {popup === "cases" ? "Sample test cases" : "Evaluation results"}
          </h2>
          <button autoFocus onClick={() => setPopup(null)} aria-label="Close popup" className="rounded px-2 py-1 text-lg text-[#a7b3ca] hover:bg-white/5">&times;</button>
        </div>

        {popup === "cases" ? (
          <div className="p-6">
            <div role="tablist" aria-label="Test cases" className="mb-5 flex gap-2">
              {sampleCases.map((_, index) => (
                <button
                  key={index}
                  role="tab"
                  aria-selected={selectedCase === index}
                  onClick={() => setSelectedCase(index)}
                  className={`rounded-md border px-4 py-2 text-xs ${selectedCase === index ? "border-[#fddf49]/40 bg-[#fddf49]/10 text-[#fddf49]" : "border-white/10 text-[#a7b3ca] hover:bg-white/5"}`}
                >
                  Case {index + 1}
                </button>
              ))}
            </div>
            <div className="space-y-4 rounded-lg border border-white/10 bg-[#0e131c] p-5">
              <div>
                <p className="mb-1.5 text-xs text-[#929bab]">Input</p>
                <code className="block break-words rounded-md bg-white/[.04] px-3 py-2 text-sm text-[#e4eaf5]">
                  {typeof sampleCases[selectedCase]?.input === "object" ? JSON.stringify(sampleCases[selectedCase]?.input) : sampleCases[selectedCase]?.input || "(empty)"}
                </code>
              </div>
              <div>
                <p className="mb-1.5 text-xs text-[#929bab]">Expected output</p>
                <code className="block break-words rounded-md bg-white/[.04] px-3 py-2 text-sm text-[#94bc9d]">
                  {typeof sampleCases[selectedCase]?.expected === "object" ? JSON.stringify(sampleCases[selectedCase]?.expected) : sampleCases[selectedCase]?.expected || "(empty)"}
                </code>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto p-6" aria-live="polite">
            {busy ? (
              <p className="text-sm text-[#a7b3ca]">Evaluating code in Docker sandbox...</p>
            ) : executionError ? (
              <p role="alert" className="whitespace-pre-wrap text-sm text-[#e79aa5]">{executionError}</p>
            ) : execution ? (
              <>
                <p className={`mb-4 text-sm font-semibold ${execution.status === "accepted" ? "text-[#94bc9d]" : "text-[#e79aa5]"}`}>
                  {execution.status?.toUpperCase()} — {execution.passedCount || 0} of {execution.totalCount || totalTests} tests passed
                  {execution.timeMs !== undefined && ` (${execution.timeMs}ms)`}
                </p>
                {execution.error && <pre className="mb-4 whitespace-pre-wrap break-words text-xs text-[#e79aa5]">{execution.error}</pre>}
                <div className="space-y-3">
                  {execution.testResults?.map((test, index) => (
                    <div key={index} className="rounded-lg border border-white/10 bg-[#0e131c] p-4">
                      <p className="mb-2 text-xs">Case {index + 1}: <span className={test.passed ? "text-[#94bc9d]" : "text-[#e79aa5]"}>{test.passed ? "Passed" : "Failed"}</span></p>
                      {test.output !== undefined && <p className="break-words font-mono text-xs text-[#a7b3ca]">Output: {test.output || "(empty)"}</p>}
                      {test.expected !== undefined && <p className="mt-1 font-mono text-xs text-[#a7b3ca]">Expected: {test.expected}</p>}
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
          <button onClick={() => setPopup(null)} className="rounded-md border border-white/10 px-4 py-2 text-xs hover:bg-white/5">Close</button>
        </div>
      </dialog>
    </>
  );
}
