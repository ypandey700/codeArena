import { ArrowRight, AudioLines, Check, CheckCircle2, CircleAlert, Clock3, Headphones, Keyboard, LoaderCircle, Mic, MonitorCheck, ShieldCheck, Sparkles, Volume2 } from "lucide-react";
import Brand from "./Brand";
import "./InterviewSetup.css";

export default function InterviewSetup({ session, title, hasQuestion, surrenderAction }) {
  const voiceSupported = session.voiceAvailable && session.microphoneAvailable;
  const voiceMode = session.mode === "voice" && voiceSupported;
  const micReady = session.permission === "granted" && Boolean(session.microphoneName);
  const canStart = !voiceMode || micReady && !session.permissionBusy;
  const playing = session.audioTest === "playing";

  return (
    <section className="interview-studio iv-setup" data-phase="setup" aria-labelledby="iv-setup-title">
      <header className="iv-topbar">
        <div className="iv-brand"><Brand compact /><span><Headphones size={13} aria-hidden="true" />Interview setup</span></div>
        <span className="iv-setup__private"><ShieldCheck size={13} aria-hidden="true" />Your interview, your voice</span>
        {surrenderAction}
      </header>

      <div className="iv-setup__scroll">
        <main className="iv-setup__main">
          <div className="iv-setup__intro">
            <span className="iv-setup__symbol" aria-hidden="true"><AudioLines size={37} strokeWidth={1.2} /><i /><i /></span>
            <p className="iv-eyebrow">A QUICK CHECK BEFORE YOU BEGIN</p>
            <h1 id="iv-setup-title">Good ideas deserve<br />{" "}<em>to be heard.</em></h1>
            <p>Set up your microphone and audio, then explain the thinking behind your code.</p>
            <div className="iv-setup__challenge"><Sparkles size={15} aria-hidden="true" /><span>{title || "Your ranked interview"}</span></div>

            <ol className="iv-setup__steps" aria-label="How your interview works">
              <li><span>01</span><div><strong>Listen to the question.</strong><p>Your submitted code stays beside you.</p></div></li>
              <li><span>02</span><div><strong>Take five seconds to think.</strong><p>A countdown gives you a moment to prepare.</p></div></li>
              <li><span>03</span><div><strong>Speak. We’ll keep up.</strong><p>With auto-record on, your microphone starts after the countdown. Pause to edit your transcript.</p></div></li>
            </ol>
            <p className="iv-setup__tip"><Headphones size={14} aria-hidden="true" />Headphones and a quiet space help you sound clear.</p>
          </div>

          <div className="iv-setup__checks">
            <div className={`iv-setup__browser${voiceSupported ? " is-ready" : ""}`} role="status">
              <MonitorCheck size={17} aria-hidden="true" />
              <div><strong>{voiceSupported ? "Your browser supports voice answers" : "Typing is ready in this browser"}</strong><p>{voiceSupported ? "Let’s check your microphone next." : "Voice input is unavailable. You can complete the interview by typing."}</p></div>
              {voiceSupported && <CheckCircle2 size={16} aria-hidden="true" />}
            </div>

            <section className="iv-setup__card" aria-labelledby="iv-setup-input">
              <div className="iv-setup__card-heading"><span><Mic size={17} aria-hidden="true" /></span><div><h2 id="iv-setup-input">Choose how you answer</h2><p>You can change this during the interview.</p></div></div>
              <div className="iv-setup__modes" aria-label="Interview answer mode">
                <button type="button" aria-pressed={voiceMode} disabled={!voiceSupported} onClick={() => session.chooseMode("voice")}><Mic size={14} aria-hidden="true" />Speak your answer{voiceMode && <Check size={13} aria-hidden="true" />}</button>
                <button type="button" aria-pressed={!voiceMode} onClick={() => session.chooseMode("typed")}><Keyboard size={15} aria-hidden="true" />Type your answer{!voiceMode && <Check size={13} aria-hidden="true" />}</button>
              </div>

              {voiceMode ? <div className="iv-setup__microphone">
                <div className={`iv-setup__device${micReady ? " is-ready" : ""}`} role="status">
                  {session.permissionBusy ? <LoaderCircle size={15} className="iv-spin" aria-hidden="true" /> : micReady ? <CheckCircle2 size={15} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}
                  <div><strong>{session.permissionBusy ? "Waiting for your browser…" : micReady ? "Microphone ready" : session.permission === "denied" ? "Microphone access is blocked" : "Allow your microphone"}</strong><p>{session.permissionBusy ? "Choose Allow in the microphone prompt." : micReady ? session.microphoneName : "We’ll ask your browser for audio access and check your microphone."}</p></div>
                </div>
                <button type="button" className="iv-button iv-setup__mic-check" disabled={session.permissionBusy} onClick={session.enableMicrophone}>
                  {session.permissionBusy ? <LoaderCircle size={14} className="iv-spin" aria-hidden="true" /> : <Mic size={14} aria-hidden="true" />}
                  {session.permissionBusy ? "Waiting for permission…" : micReady ? "Check microphone again" : session.permission === "denied" ? "Retry microphone check" : "Enable & check microphone"}
                </button>
                {session.notice && <p className="iv-setup__notice" role="status"><CircleAlert size={13} aria-hidden="true" />{session.notice}</p>}
              </div> : <p className="iv-setup__typed"><Keyboard size={16} aria-hidden="true" />You’ll type your explanations. Microphone access is optional.</p>}

              <label className="iv-setup__preference"><span><strong>Automatic recording</strong><small>Start after the five-second countdown.</small></span><input type="checkbox" checked={session.autoRecord && voiceMode} disabled={!voiceMode} onChange={session.toggleAutoRecord} /><span className="iv-setup__toggle" aria-hidden="true" /></label>
            </section>

            <section className="iv-setup__card" aria-labelledby="iv-setup-output">
              <div className="iv-setup__card-heading"><span><Volume2 size={17} aria-hidden="true" /></span><div><h2 id="iv-setup-output">Check your question audio</h2><p>{session.playbackAvailable ? "Play a sample and check your volume." : "Audio playback is unavailable. Questions appear on screen."}</p></div></div>
              <div className="iv-setup__speaker">
                <button type="button" className="iv-button" onClick={session.testSpeaker} disabled={playing || !session.playbackAvailable}>{playing ? <AudioLines size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}{playing ? "Playing sample…" : "Play audio sample"}</button>
                <span role="status">{playing ? "Can you hear the interviewer?" : session.audioTest === "played" ? <><Check size={12} aria-hidden="true" />Sample played</> : session.audioTest === "error" ? "Audio didn’t play. Read questions on screen or retry." : "Use your usual speakers or headphones."}</span>
              </div>
              <label className="iv-setup__preference"><span><strong>Read questions aloud</strong><small>Questions are always visible on screen.</small></span><input type="checkbox" checked={session.voiceEnabled && session.playbackAvailable} disabled={!session.playbackAvailable} onChange={session.toggleVoice} /><span className="iv-setup__toggle" aria-hidden="true" /></label>
            </section>
            <p className="iv-setup__privacy"><ShieldCheck size={13} aria-hidden="true" />Spoken answers become text for your interview. The microphone check stops when it finishes.</p>
          </div>
        </main>
      </div>

      <footer className="iv-setup__footer">
        <div><strong>{voiceMode ? micReady ? "You’re ready to speak." : "One quick microphone check to go." : "You’re ready to type."}</strong><p>{hasQuestion ? <><Clock3 size={11} aria-hidden="true" />Match time continues during setup.</> : "Your question plays after you start."}</p></div>
        <div>{voiceMode && <button type="button" className="iv-text-button" onClick={() => session.completeSetup({ typed: true })}>Continue by typing</button>}<button type="button" className="iv-button iv-button--primary" disabled={!canStart} onClick={() => session.completeSetup({ typed: !voiceMode })}>Start interview<ArrowRight size={15} aria-hidden="true" /></button></div>
      </footer>
    </section>
  );
}
