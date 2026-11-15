# Battle Contract

## Lifecycle

Matches are pending until both players accept within ACCEPT_WINDOW_SECONDS. A battle then stays active while its players independently move through coding -> interview -> done. endsAt is only the coding deadline, never the interview deadline.

Coding ends for a player on an accepted full-pass submission, battle_finish, or endsAt. The first coding finish shortens endsAt to min(current endsAt, now + AFTER_FIRST_FINISH_SECONDS), default 180 seconds. A later finish never extends it. A player's phase and final code snapshot are locked atomically, so an in-flight submission cannot overwrite a code snapshot after the coding deadline.

Each player gets their own pending Interview immediately at coding end. In background, the server evaluates the frozen latest draft or last submission against all tests, reusing the accepted submission evaluation when it already matches that snapshot. It checkpoints evaluation and analysis separately. Code analysis runs here, bounded by LLM_TIMEOUT_MS + 5000, and is persisted before question one is generated. Finalization never reruns execution or analysis. The opponent receives opponent_finished with final progress and opponent_phase with status only.

An interview clock starts at that player's coding end, even while evaluation/analysis or question generation is pending. A player with no code skips the interview, status skipped and score 0. Each other player can interview while the opponent is still coding. Questions are generated sequentially using that player's code and prior Q&A.

The interview ends after the full question count is answered/skipped/expired or INTERVIEW_MAX_SECONDS is reached. Unanswered questions score zero. A completed player receives interview_complete and waits for the opponent; neither full correctness nor the coding deadline declares a winner.

Only when both players are done and their coding results are stored can the atomic active -> finalizing guard succeed. Its one successful caller emits battle_finalizing, computes server scores/winner, applies Elo, stats and XP once, then persists finished and emits a separate private battle_end to each player. Existing per-user appliedBattleResults markers make rating/stat/XP application idempotent across restart recovery. A prepared rating checkpoint preserves the saved outcome on recovery.

Forfeit during coding or interview awards the opponent an immediate win and cancels outstanding interview work. Coding disconnects retain the reconnect grace rule. A disconnect in interview or done does not forfeit or pause any interview deadline; an earlier coding disconnect timer also cannot forfeit a player who has since entered interview. Both players disconnected while both are coding retain abandonment behavior.

Boot recovery clears interrupted coding claims, re-arms coding/question/interview timers, resumes the same open questions and deadlines, restarts interrupted question/scoring work, and completes stuck finalizing battles using stored results. A hard cap closes unfinished work at the later coding end + INTERVIEW_MAX_SECONDS + 30 seconds. Coding work and interview grading have bounded budgets within that cap. At the cap, unresolved technical grading is failed rather than assigned invented scores; an entirely unanswered interview remains 0.

## Interview data and scoring

Interview has unique (battle, user), status pending|active|done|skipped|failed, startedAt, deadlineAt, captured total question count, questions, understanding, score, feedback {strengths, tips}, and source llm|fallback. Internal generation/scoring claims and a revision prevent stale asynchronous responses from publishing after timeout, forfeit or recovery. Completion notification is recorded to avoid duplicate interview_complete emissions.

Questions use zero-based index, text, focus, askedAt, deadlineAt, answer, inputMode voice|typed, answeredAt, status open|answered|skipped|expired, accuracy, depth and clarity. A question's deadline is askedAt + INTERVIEW_QUESTION_SECONDS + INTERVIEW_READ_ALLOWANCE_SECONDS; the absolute interview deadline still takes precedence. At question deadline + 5 seconds without an accepted answer, the question expires and the server advances.

Answers are participant-only, during the player's own interview, at most 2000 characters and one new answer per 2 seconds per user. Empty answers are accepted and score 0. Repeated answers to an already answered question are ignored without replacing text or advancing again. New late answers are rejected with an acknowledgment message.

Question prompts identify code and answers as untrusted DATA. Context contains only the problem statement, language, final code, aggregate passed/total, detected complexity and prior Q&A; hidden tests never enter prompts. Every question, including the first, probes a concrete implementation decision: loop invariant, boundary condition, data structure, update order or early return. Output is strict JSON {question, focus, evidence}, maximum 45 words, with a verified exact source fragment as evidence. Generation retries once, then uses nonrepeating questions anchored to real source lines and marks source fallback. Generic walkthroughs are rejected.

After the last question, one scoring request (with one retry on invalid/failing output) receives the whole transcript, code, aggregate tests and optimal complexity. The system treats transcript/code as untrusted data and judges only technical accuracy against real code, depth and clarity; accent, grammar, fillers, typos and obvious speech-recognition mistakes are not penalized. Each accuracy/depth/clarity and understanding value must be an integer and is clamped to 0-10. Strengths and tips have at most three short strings each. A failed scoring request after retry marks the interview failed. An interview with no substantive answers is deterministically 0 and needs no LLM grading call.

perQuestion = 0.5 * accuracy + 0.25 * depth + 0.25 * clarity.

mean = sum(perQuestion for nonempty answered questions) / full captured question count, including skipped, unanswered, expired and unasked questions in the denominator.

coverage = nonempty answered questions / full captured question count. Stored understanding = graded understanding * coverage.

interviewScore = round(10 * (0.7 * mean + 0.3 * stored understanding)). Skipped interviews score 0. If either interview failed, interview is null for BOTH players, independently of analysis availability.

## Socket events

Socket handlers authenticate the caller and enforce participant ownership. Standard action acknowledgments are {success, message}; battle_join additionally returns data. interview_join returns its resumable fields directly with success.

| Client event | Payload | Behavior |
| --- | --- | --- |
| queue_join | {mode?} | Join ranked queue. |
| queue_leave | {} | Leave queue. |
| match_accept / match_decline | {battleId} | Accept/decline pending match. |
| battle_join | {battleId} | Ack {success, data: battle_state} and emit battle_state. |
| code_draft | {battleId, language, code} | Private Redis draft:<battleId>:<userId>, TTL 3600s, maximum 20000 characters, one per 2 seconds; coding only. |
| battle_finish | {battleId} | Freeze coding, acknowledge lock, begin background evaluation and own interview. |
| battle_forfeit | {battleId} | Opponent wins immediately, including during interview. |
| battle_chat | {battleId, text} | Existing maximum 200 characters, 5 per 5 seconds. |
| interview_join | {battleId} | Own interview only. Ack {success, status, question, answeredCount, total, deadlineAt, interviewDeadlineAt, serverNow, finalCode, history}. history contains only own answered {index, text, answer}. No questions/deadlines regenerate on refresh. |
| interview_answer | {battleId, questionIndex, text, inputMode, skip?} | Ack {success, message}; idempotent, validated and rate-limited. skip: true discards draft text, records skipped, scores zero and advances. |

| Server event | Payload |
| --- | --- |
| queue_status | {waitingSeconds, playersInQueue} |
| match_found | {battleId, acceptDeadline, serverNow, opponent, problem, ratingPreview} |
| match_cancelled | {battleId, reason} |
| battle_start | {battleId, serverNow, startedAt, endsAt, problem, opponent} |
| battle_state | Existing state plus myPhase, opponentPhase, ownFinished, opponentFinished and current endsAt. Public players also include phase. |
| submission_result | {status, passedCount, totalCount, timeMs} |
| opponent_progress | {passedCount, totalCount, at}; coding submissions only. |
| you_finished | {endsAt, serverNow, passedCount, totalCount} |
| opponent_finished | {endsAt, serverNow, passedCount, totalCount, solveTimeMs}; no code or test contents. |
| interview_thinking | {} |
| interview_started | {battleId, total, question: {index, text, askedAt, deadlineAt}, interviewDeadlineAt, serverNow} |
| interview_question | {index, text, askedAt, deadlineAt, serverNow} |
| interview_complete | {}; own interview done, wait for opponent. |
| opponent_phase | {phase: coding|interview|done, questionIndex?, total?}; status only, never question/answer content. |
| battle_finalizing | {} |
| battle_end | Participant-specific result below. |
| opponent_disconnected / opponent_reconnected | Existing coding grace notifications. |
| battle_chat_message | {from, text, at} |

During pending evaluation, interview_join can return status pending and question null. During grading, there may be no current question; the absolute interview deadline remains unchanged.

## HTTP and result privacy

Success envelope: {success: true, data}. Errors: {message}.

| Method | Route | Result |
| --- | --- | --- |
| GET | /api/v1/battles/active | {battle: battle_state}, including myPhase/opponentPhase and finalizing battles; null if absent. |
| POST | /api/v1/battles/:id/submit | Full-suite evaluation, 10 per minute, 20000 characters. Locked outside own coding phase. Full pass ends own coding only. |
| GET | /api/v1/battles/:id | Participant-specific battle_end shape. |
| GET | /api/v1/battles/me | Paginated participant-safe summaries. |
| POST | /api/v1/submissions/run | Existing sample-only execution. |

battle_end and GET /battles/:id retain battleId, status, winner, reason, problem, players, timeline. Problem includes title, slug, difficulty, category, optimalTime and optimalSpace. Top-level myCode {language, code} is the requesting player's frozen final code only. It is never included for the opponent.

Both players retain userId, username, avatar, passedCount, totalTests, solveTimeMs, runtimeMs, ratingBefore/After/Delta, xpGained, scores, detected time/space complexity, quality, finishedBy and resultSource, plus phase and interview {score, understanding, answered, total, source}. If the interview component is unavailable symmetrically, both public interview.score values are null.

Only the requesting player's interview includes perQuestion [{question, answer, accuracy, depth, clarity}] and feedback {strengths, tips}. The player's existing top-level feedback tips continue to mean code-analysis feedback. Only that player's row has myTests. Sample tests include index, passed, status, timeMs, optional error, input, expected and actual; hidden tests omit input/expected/actual. Opponent code, questions, answers, per-test details and feedback are never serialized. battle_state excludes all private code/transcript/test content.

finishedBy remains solved|locked|timeout|forfeit. resultSource remains submit|auto_draft|none. auto_draft denotes server evaluation of frozen saved code when coding ended. Coding ends are recorded in players[].finishedAt; phase distinguishes interview completion from coding completion.

## Combined scoring

WEIGHTS stays {correctness:25, speed:8, runtime:7, timeComplexity:12, spaceComplexity:3, quality:15, interview:30}.

Correctness is passed/total*100. Solved speed is max(0, round(100*(1-solveTimeMs/originalBattleDurationMs))), capped at 100; otherwise 0. Solved runtime is clamp(round(100*(1-runtimeMs/problem.timeLimitMs)),0,100); otherwise 0. runtimeMs sums per-test execution times. Shortened endsAt never changes the original duration denominator.

Complexity ladder stays O(1), O(log n), O(n), O(n log n), O(n^2), O(n^3), O(2^n), O(n!). Equal/better than optimal is 100; each worse class subtracts 35, minimum 0. Quality is round(mean of four quality subscores * 10). Zero passing tests gives 0 for available analysis components. Failed/skipped analysis for either player makes analysis components null for both; a missing optimal complexity removes that component for both.

Interview now uses the formula above. The server renormalizes all non-null weights, compares unrounded totals, and declares a draw for a difference under 1 point. LLMs never decide totals, winner or ratings.

## Environment and verification

New backend/.env.example values:

- INTERVIEW_QUESTIONS=4
- INTERVIEW_QUESTION_SECONDS=90
- INTERVIEW_READ_ALLOWANCE_SECONDS=15
- INTERVIEW_MAX_SECONDS=480

Existing AFTER_FIRST_FINISH_SECONDS, BATTLE_DURATION_SECONDS, RECONNECT_GRACE_SECONDS and LLM_PROVIDER/API_KEY/MODEL/BASE_URL/TIMEOUT_MS/MOCK remain supported. LLM_MOCK=true generates deterministic distinct questions by index, deterministic transcript scoring and existing deterministic analysis without LLM network access.

node backend/scripts/battleSim.js uses LLM_MOCK=true, two questions and short clocks against real local MongoDB, Redis, Socket.IO, HTTP controllers and Docker. Its temporary database and Redis namespace are isolated and removed afterwards. Requested scenarios: interview-flow, first-finisher-waits, interview-timeout, resume, duplicate-answer, late-answer, llm-failure, double-finish, disconnect-during-interview. Additional checks cover coding-deadline auto-evaluation, no-code skip, boot interview resume, stuck finalizing recovery and the overdue hard cap. The hard-cap fixture moves saved coding-end times into the past to verify immediate recovery without waiting the production cap. LLM scoring failure is injected only in the simulator. Every completed scenario verifies one battle_end per player, transcript/code privacy and reuse of stored analysis.
