import { useRef, useState } from "react";
import {
  ArrowDown, ArrowRight, ArrowUpRight, AudioLines, Check, CheckCheck,
  ChevronDown, Code2, CornerDownRight, Fingerprint, GitBranch, Menu,
  MessageSquareText, Plus, Sparkles, Swords, X,
} from "lucide-react";
import Brand from "../components/Brand";
import { useAuth } from "../context/AuthContext";
import "./Landing.css";

const examples = {
  python: { label: "Python", file: "two_sum.py", code: `def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i` },
  javascript: { label: "JavaScript", file: "two_sum.js", code: `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) {
      return [seen.get(complement), i];
    }
    seen.set(nums[i], i);
  }
}` },
  cpp: { label: "C++", file: "two_sum.cpp", code: `#include <vector>
#include <unordered_map>
std::vector<int> twoSum(const std::vector<int>& nums, int target) {
  std::unordered_map<int, int> seen;
  for (int i = 0; i < nums.size(); ++i) {
    int complement = target - nums[i];
    if (seen.count(complement)) return {seen[complement], i};
    seen[nums[i]] = i;
  }
  return {};
}` },
  java: { label: "Java", file: "Solution.java", code: `import java.util.HashMap;
class Solution {
  public int[] twoSum(int[] nums, int target) {
    var seen = new HashMap<Integer, Integer>();
    for (int i = 0; i < nums.length; i++) {
      int complement = target - nums[i];
      if (seen.containsKey(complement))
        return new int[]{seen.get(complement), i};
      seen.put(nums[i], i);
    }
    return new int[]{};
  }
}` },
};
const questions = [
  { label: "Your approach", question: "Why use a hash map instead of checking every pair?", answer: "The map stores numbers I've already visited. Looking up the complement takes O(1) time on average, so I can solve the problem in a single pass with O(n) extra space." },
  { label: "An edge case", question: "What happens if the same number appears twice?", answer: "I check for the complement before adding the current number. That means I can match two equal values at different positions without ever reusing the same position." },
];
const stages = ["Code", "Explain", "Reflect"];

function SyntaxLine({ line }) {
  const tokens = line.split(/(\/\/.*|#.*|"[^"]*"|'[^']*'|\b(?:def|for|if|return|in|let|const|class|public|int|auto|var|new|function|import)\b|\b\d+\b)/g);
  return tokens.map((token, index) => {
    const type = /^(\/\/|#)/.test(token) ? "comment" : /^["']/.test(token) ? "string" : /^\d+$/.test(token) ? "number" : /^(def|for|if|return|in|let|const|class|public|int|auto|var|new|function|import)$/.test(token) ? "keyword" : "plain";
    return <span className={`lp-syntax--${type}`} key={index}>{token}</span>;
  });
}

function ArenaWalkthrough({ onJoin }) {
  const [stage, setStage] = useState(0);
  const [language, setLanguage] = useState("python");
  const [question, setQuestion] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const tabs = useRef([]);
  const sample = examples[language];

  function changeTab(event, index) {
    const keys = { ArrowRight: (index + 1) % 3, ArrowLeft: (index + 2) % 3, Home: 0, End: 2 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const next = keys[event.key];
    setStage(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="lp-demo-wrap" id="arena">
      <div className="lp-demo">
        <div className="lp-demo__chrome"><span><span /><span /><span /></span><span><Swords size={13} aria-hidden="true" /> A look inside the arena</span><Code2 size={15} aria-hidden="true" /></div>
        <div className="lp-demo__tabs" role="tablist" aria-label="Explore a Code Arena match">{stages.map((label, index) => <button key={label} ref={(element) => { tabs.current[index] = element; }} id={`lp-tab-${index}`} role="tab" aria-selected={stage === index} aria-controls="lp-demo-panel" tabIndex={stage === index ? 0 : -1} onClick={() => setStage(index)} onKeyDown={(event) => changeTab(event, index)}><span>0{index + 1}</span>{label}{stage === index && <span className="lp-demo__tab-dot" />}</button>)}</div>
        <div id="lp-demo-panel" role="tabpanel" aria-labelledby={`lp-tab-${stage}`} className="lp-demo__panel" tabIndex={0}>
          {stage === 0 && <>
            <div className="lp-demo__challenge"><div><span className="lp-small-label">EXAMPLE CHALLENGE</span><strong>Two Sum<span>Easy</span></strong></div><div className="lp-demo__array" aria-label="Find two values that add up to nine">{[2, 7, 11, 15].map((value, index) => <span className={index < 2 ? "is-match" : ""} key={value}>{value}</span>)}<span className="lp-demo__target">→ 9</span></div></div>
            <div className="lp-demo__file"><span><Code2 size={13} aria-hidden="true" />{sample.file}</span><label><span className="lp-sr-only">Preview language</span><select value={language} onChange={(event) => setLanguage(event.target.value)}>{Object.entries(examples).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select><ChevronDown size={12} aria-hidden="true" /></label></div>
            <pre className="lp-demo__code"><code>{sample.code.split("\n").map((line, index) => <span className="lp-code-line" key={index}><span className="lp-code-line__number" aria-hidden="true">{index + 1}</span><span><SyntaxLine line={line} /></span></span>)}</code></pre>
            <div className="lp-demo__next"><span><CornerDownRight size={13} aria-hidden="true" />The next move is yours.</span><button type="button" onClick={() => setStage(1)}>Now, explain it <ArrowRight size={13} aria-hidden="true" /></button></div>
          </>}
          {stage === 1 && <div className="lp-interview-demo">
            <div className="lp-interview-demo__intro"><span className="lp-ai-icon"><AudioLines size={20} aria-hidden="true" /></span><div><span className="lp-small-label">YOUR CODE. YOUR REASONING.</span><h3>Let's talk about the why.</h3></div></div>
            <div className="lp-interview-demo__topics" aria-label="Example interview questions">{questions.map((item, index) => <button key={item.label} type="button" aria-pressed={question === index} onClick={() => { setQuestion(index); setShowAnswer(false); }}>{item.label}</button>)}</div>
            <blockquote><span className="lp-small-label"><Sparkles size={12} aria-hidden="true" />AI INTERVIEWER · EXAMPLE</span><p>{questions[question].question}</p></blockquote>
            {showAnswer ? <div className="lp-interview-demo__answer" role="status"><span className="lp-small-label">ONE WAY TO EXPLAIN IT</span><p>{questions[question].answer}</p></div> : <button type="button" className="lp-demo__reveal" onClick={() => setShowAnswer(true)}>Reveal example reasoning <Plus size={14} aria-hidden="true" /></button>}
            <button type="button" className="lp-demo__continue" onClick={() => setStage(2)}>And after the match? <ArrowRight size={14} aria-hidden="true" /></button>
          </div>}
          {stage === 2 && <div className="lp-reflect-demo">
            <span className="lp-reflect-demo__mark"><GitBranch size={26} strokeWidth={1.4} aria-hidden="true" /></span><span className="lp-small-label">THE NEXT BREAKTHROUGH</span><h3>A result.<br />And a way forward.</h3><p>See how your code performed and what your explanation revealed.</p>
            <div className="lp-reflect-demo__rubric">{[{ icon: CheckCheck, label: "Test results", detail: "What your solution gets right" }, { icon: Code2, label: "Code analysis", detail: "How your approach scales" }, { icon: MessageSquareText, label: "Interview feedback", detail: "What to take into your next duel" }].map(({ icon: Icon, label, detail }) => <div key={label}><Icon size={16} aria-hidden="true" /><span><strong>{label}</strong><small>{detail}</small></span><Check size={13} aria-hidden="true" /></div>)}</div>
            <button type="button" className="lp-demo__continue" onClick={onJoin}>Make it your match <ArrowUpRight size={15} aria-hidden="true" /></button>
          </div>}
        </div>
        <p className="lp-demo__disclaimer">Example walkthrough. Code is shown for illustration, not executed.</p>
      </div>
      <div className="lp-demo-sticker" aria-hidden="true"><Sparkles size={15} /><span>Less memorising.<br /><strong>More understanding.</strong></span></div>
    </div>
  );
}

const steps = [
  { icon: Swords, number: "01", title: "Meet your match.", copy: "Enter the ranked queue. Get paired with a rival and take on the same coding challenge.", label: "A REAL OPPONENT" },
  { icon: Code2, number: "02", title: "Make your move.", copy: "Pick your language, test your ideas, and build a solution that's yours from the first line.", label: "YOUR OWN APPROACH" },
  { icon: AudioLines, number: "03", title: "Explain the why.", copy: "Walk through your solution with an AI interviewer. Then get a match report to learn from.", label: "THINKING THAT COUNTS" },
];
const faqs = [
  { question: "Is the first person to finish always the winner?", answer: "Finishing your code moves you into your own AI interview. The final result considers your coding performance and explanation after both players finish their phases." },
  { question: "What does the AI interview ask about?", answer: "Your own submitted code: why you chose an approach, how it handles edge cases, and the trade-offs you made. It follows your implementation rather than asking unrelated interview questions." },
  { question: "Which languages can I use?", answer: "Python, JavaScript, C++, and Java. You choose your language in the battle editor." },
  { question: "Do I need to bring an opponent?", answer: "No. Join the ranked 1v1 queue and matchmaking pairs you with another player. Private rooms and friend challenges are coming soon." },
];

export default function Landing() {
  const { openLogin, openSignup } = useAuth();
  const [mobileNav, setMobileNav] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const closeMenu = () => setMobileNav(false);
  const signup = () => { closeMenu(); openSignup(); };
  const login = () => { closeMenu(); openLogin(); };

  return (
    <div className="arena-landing arena-page-background" id="home">
      <header className="lp-header" onKeyDown={(event) => { if (event.key === "Escape") closeMenu(); }}>
        <div className="lp-header__inner"><a href="#home" onClick={closeMenu} aria-label="Code Arena home"><Brand /></a><nav className="lp-header__links" aria-label="Main navigation"><a href="#arena">The arena</a><a href="#how-it-works">How it works</a><a href="#ai-interview">The AI interview <span>↗</span></a></nav><div className="lp-header__actions"><button type="button" className="lp-sign-in" onClick={login}>Sign in</button><button type="button" className="lp-button lp-button--small" onClick={signup}>Enter the arena <ArrowUpRight size={14} aria-hidden="true" /></button></div><button type="button" className="lp-menu-toggle" aria-label={mobileNav ? "Close navigation" : "Open navigation"} aria-expanded={mobileNav} aria-controls="lp-mobile-nav" onClick={() => setMobileNav((value) => !value)}>{mobileNav ? <X size={22} /> : <Menu size={22} />}</button></div>
        {mobileNav && <nav id="lp-mobile-nav" className="lp-mobile-nav" aria-label="Mobile navigation"><a href="#arena" onClick={closeMenu}>The arena <ArrowUpRight size={15} /></a><a href="#how-it-works" onClick={closeMenu}>How it works <ArrowUpRight size={15} /></a><a href="#ai-interview" onClick={closeMenu}>The AI interview <ArrowUpRight size={15} /></a><div><button type="button" onClick={login}>Sign in</button><button type="button" onClick={signup}>Enter the arena <ArrowRight size={15} /></button></div></nav>}
      </header>

      <section className="lp-hero lp-wrap" aria-labelledby="lp-hero-title">
        <div className="lp-hero__copy"><p className="lp-eyebrow"><span className="lp-diamond" />COMPETITIVE CODING. HUMAN THINKING.</p><h1 id="lp-hero-title">Code it.<br />Explain it.<br /><em>Outplay it<span className="lp-hero__period">.</span></em></h1><p className="lp-hero__description">A coding duel with a second move: <strong>explain your thinking.</strong> Take on a real opponent, solve the challenge, then walk through your code with AI.</p><div className="lp-hero__actions"><button type="button" className="lp-button" onClick={signup}><Swords size={17} aria-hidden="true" />Find my first rival <ArrowRight size={16} aria-hidden="true" /></button><a href="#how-it-works" className="lp-text-link">See how it works <ArrowDown size={14} aria-hidden="true" /></a></div><div className="lp-hero__languages"><span>YOUR LANGUAGE. YOUR APPROACH.</span><div><span>Python</span><span>JavaScript</span><span>C++</span><span>Java</span></div></div></div>
        <ArenaWalkthrough onJoin={signup} />
      </section>

      <div className="lp-principles"><div className="lp-wrap"><span><Swords size={16} aria-hidden="true" />Real 1v1 duels</span><span><Fingerprint size={16} aria-hidden="true" />Your code. Your reasoning.</span><span><AudioLines size={16} aria-hidden="true" />Code-specific AI interviews</span><span><GitBranch size={16} aria-hidden="true" />A reason to come back sharper</span></div></div>

      <section id="how-it-works" className="lp-how lp-wrap" aria-labelledby="lp-how-title">
        <div className="lp-section-heading"><div><p className="lp-eyebrow">THE MATCH IS JUST THE BEGINNING</p><h2 id="lp-how-title">A good match<br />stays with you<span>.</span></h2></div><p>From your first line to your final explanation,<br className="lp-desktop-break" /> every round has something to take away.</p></div>
        <div className="lp-step-grid">{steps.map(({ icon: Icon, number, title, copy, label }) => <article className="lp-step" key={number}><div className="lp-step__top"><span className="lp-step__icon"><Icon size={23} strokeWidth={1.5} aria-hidden="true" /></span><span className="lp-step__number">{number}<span>/</span></span></div><h3>{title}</h3><p>{copy}</p><span className="lp-step__label"><span />{label}</span></article>)}</div>
      </section>

      <section id="ai-interview" className="lp-ai-section lp-wrap" aria-labelledby="lp-ai-title">
        <div className="lp-ai-visual" aria-label="An example of an interview question about your code"><div className="lp-ai-visual__code"><div><Code2 size={14} aria-hidden="true" /><span>YOUR IMPLEMENTATION</span></div><code><span>if</span> complement <span>in</span> seen:<br /><i>  return [seen[complement], i]</i></code><span className="lp-ai-visual__annotation"><CornerDownRight size={16} aria-hidden="true" />A decision worth talking about.</span></div><div className="lp-ai-visual__connector" aria-hidden="true" /><div className="lp-ai-visual__question"><span className="lp-ai-icon"><AudioLines size={22} aria-hidden="true" /></span><div><span className="lp-small-label">EXAMPLE AI QUESTION</span><p>“Why did you check the map <em>before</em> adding the current number?”</p></div></div><div className="lp-ai-visual__caption"><Fingerprint size={15} aria-hidden="true" />An interview shaped by your solution.</div></div>
        <div className="lp-ai-copy"><p className="lp-eyebrow"><AudioLines size={15} aria-hidden="true" />THE AI INTERVIEW</p><h2 id="lp-ai-title">The code is yours.<br />So is the <em>why.</em></h2><p>A working solution tells part of the story. The choices behind it tell the rest. After coding, an AI interviewer asks about the implementation you actually wrote.</p><ul><li><Check size={15} aria-hidden="true" /><span>Questions grounded in your code</span></li><li><Check size={15} aria-hidden="true" /><span>Room to explain your trade-offs</span></li><li><Check size={15} aria-hidden="true" /><span>Feedback to carry into your next match</span></li></ul><button type="button" className="lp-text-link" onClick={signup}>Put your thinking to the test <ArrowUpRight size={16} aria-hidden="true" /></button></div>
      </section>

      <section className="lp-faq lp-wrap" aria-labelledby="lp-faq-title"><div><p className="lp-eyebrow">BEFORE YOUR FIRST MOVE</p><h2 id="lp-faq-title">Good questions<span>.</span><br />Straight answers.</h2><p>Still curious? Start with these.</p></div><div className="lp-faq__list">{faqs.map(({ question, answer }, index) => <div className={`lp-faq__item${openFaq === index ? " is-open" : ""}`} key={question}><h3><button type="button" aria-expanded={openFaq === index} aria-controls={`lp-faq-answer-${index}`} onClick={() => setOpenFaq(openFaq === index ? null : index)}>{question}<Plus size={17} aria-hidden="true" /></button></h3><div id={`lp-faq-answer-${index}`} hidden={openFaq !== index}><p>{answer}</p></div></div>)}</div></section>

      <section className="lp-last-call lp-wrap" aria-labelledby="lp-last-title"><div className="lp-last-call__inner"><div><p className="lp-eyebrow">YOUR NEXT CHAPTER</p><h2 id="lp-last-title">One match.<br />A different kind of <em>progress.</em></h2><p>Bring your curiosity. The arena will bring the challenge.</p><button type="button" className="lp-button lp-button--dark" onClick={signup}>Make my first move <ArrowUpRight size={17} aria-hidden="true" /></button></div><div className="lp-last-call__art" aria-hidden="true"><ArrowUpRight strokeWidth={.8} /></div></div></section>

      <footer className="lp-footer lp-wrap"><div><a href="#home" aria-label="Code Arena home"><Brand /></a><p>A little better. Every battle.</p></div><nav aria-label="Footer navigation"><a href="#how-it-works">How it works</a><a href="#ai-interview">AI interview</a><button type="button" onClick={login}>Sign in <ArrowUpRight size={12} aria-hidden="true" /></button></nav><span>Built for the way you think.</span></footer>
    </div>
  );
}
