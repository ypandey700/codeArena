# Battle Contract

## Lifecycle

A match begins pending. Both players accept within ACCEPT_WINDOW_SECONDS, then it becomes active for BATTLE_DURATION_SECONDS. Passing every test finishes and locks that player; it does not decide the winner. An explicit battle_finish evaluates the latest saved code against all sample and hidden tests and locks that player even if tests fail. Locked players cannot submit or update drafts.

The first finish shortens endsAt to min(current endsAt, now + AFTER_FIRST_FINISH_SECONDS), default 180 seconds. Both players receive the new server deadline. The second player can keep coding until that deadline. A later finish cannot extend it.

Both finished players or the deadline trigger an atomic active -> finalizing transition. Only its successful caller evaluates remaining drafts and computes the result. For each unfinished player, use the latest draft or last submitted code. No code gives zero passing tests. Runtime is the sum of per-test runtimes. The original battle duration remains the speed denominator after shortening.

Finalizing emits battle_finalizing, evaluates remaining code, and analyzes both solutions concurrently with Promise.allSettled. Analysis has an overall LLM_TIMEOUT_MS + 5000 millisecond limit. Missing credentials, invalid output, provider errors and timeouts remove analysis components symmetrically. Interview remains null. The server computes component scores, total, winner, Elo and XP, then persists finished and sends a separate battle_end to each participant.

Ratings, wins, losses, draws, streak and XP use an atomic per-user appliedBattleResults marker. Restart recovery reuses checkpointed scores and winner after rating application has been prepared, so a partially applied result is completed without applying it twice. Active deadlines are re-armed on boot; expired battles, both-finished active battles and stuck finalizing battles are completed. In-flight submission locks are cleared at boot.

Forfeit still immediately awards the opponent a win. Disconnect retains RECONNECT_GRACE_SECONDS and both-disconnected abandonment. Forced forfeit/disconnect outcomes skip draft execution and analysis to avoid delaying concession. No interview phase is implemented.

## Client socket events

All events require authentication and participants only. Acknowledgments use {success, message} and, where applicable, data.

| Event | Payload | Behavior |
| --- | --- | --- |
| queue_join | {mode?} | Join the ranked queue. |
| queue_leave | {} | Leave the queue. |
| match_accept | {battleId} | Accept a pending match. |
| match_decline | {battleId} | Decline and apply queue cooldown. |
| battle_join | {battleId} | Ack {success, data: battle_state} and emit battle_state for resync. |
| code_draft | {battleId, language, code} | Save privately in Redis draft:<battleId>:<userId>, TTL 3600 seconds, maximum 20000 characters, one update per 2 seconds per user. |
| battle_finish | {battleId} | Evaluate latest code against all tests, then lock. |
| battle_forfeit | {battleId} | Opponent wins immediately. |
| battle_chat | {battleId, text} | Maximum 200 characters, 5 messages per 5 seconds. |

Languages: javascript, python, cpp, java. Submissions for the same player are serialized with a database claim; finalization prevents in-flight work from overwriting the final result.

## Server socket events

| Event | Payload |
| --- | --- |
| queue_status | {waitingSeconds, playersInQueue} |
| match_found | {battleId, acceptDeadline, serverNow, opponent, problem, ratingPreview} |
| match_cancelled | {battleId, reason} |
| battle_start | {battleId, serverNow, startedAt, endsAt, problem, opponent} |
| battle_state | {battleId, status, serverNow, startedAt, endsAt, ownFinished, opponentFinished, opponent, players, problem, ownProgress, opponentProgress, lastChatMessages}; pending state instead includes acceptDeadline and ratingPreview. |
| submission_result | {status, passedCount, totalCount, timeMs} |
| opponent_progress | {passedCount, totalCount, at} |
| you_finished | {endsAt, serverNow, passedCount, totalCount} |
| opponent_finished | {endsAt, serverNow, passedCount, totalCount, solveTimeMs} |
| battle_finalizing | {} |
| battle_end | Participant-specific result described below. |
| opponent_disconnected | {graceSeconds} |
| opponent_reconnected | No payload. |
| battle_chat_message | {from, text, at} |

## HTTP

Success envelope: {success: true, data}; errors: {message}.

| Method | Route | Result |
| --- | --- | --- |
| GET | /api/v1/battles/active | {battle: battle_state}, including finalizing battles; battle is null if absent. |
| POST | /api/v1/battles/:id/submit | Evaluate all tests, save latest code and result, lock if solved. Maximum 10 per minute per user, 20000 characters. Returns {status, passedCount, totalCount, timeMs}. |
| GET | /api/v1/battles/:id | Participant-specific battle_end shape, including current status. |
| GET | /api/v1/battles/me | Paginated participant-safe result summaries. |
| POST | /api/v1/submissions/run | Existing sample-only execution. |

## Result privacy

battle_end and GET /battles/:id contain battleId, status, winner, reason, problem, players and timeline. Problem includes title, slug, difficulty, category, optimalTime and optimalSpace.

Both players include userId, username, avatar, passedCount, totalTests, solveTimeMs, runtimeMs, ratingBefore, ratingAfter, ratingDelta, xpGained, finishedBy, resultSource, scores, detected timeComplexity, spaceComplexity and quality {naming, readability, maintainability, idioms}.

finishedBy is solved, locked, timeout or forfeit. resultSource is submit, auto_draft or none. auto_draft means server-initiated evaluation of saved code; none means no code/result available.

Only the requesting player's row includes myTests and feedback tips. Each test has index (zero-based), passed, status, timeMs and optional error. Sample tests additionally include input, expected and actual. Hidden tests never include these three fields. The opponent never receives code, drafts, per-test details or feedback. Hidden test definitions and stressTest are excluded from battle state.

## Scoring

WEIGHTS = {correctness: 25, speed: 8, runtime: 7, timeComplexity: 12, spaceComplexity: 3, quality: 15, interview: 30}.

- Correctness: passed / total * 100; no tests gives 0.
- Speed: solved ? max(0, round(100 * (1 - solveTimeMs / originalBattleDurationMs))) : 0, capped at 100.
- Runtime: solved ? clamp(round(100 * (1 - runtimeMs / problem.timeLimitMs)), 0, 100) : 0.
- Complexity ladder: O(1), O(log n), O(n), O(n log n), O(n^2), O(n^3), O(2^n), O(n!). Equal or better than optimal scores 100; each worse class subtracts 35, minimum 0. O(n+m) normalizes to O(n).
- Quality: round(mean(naming, readability, maintainability, idioms) * 10).
- Zero passing tests scores 0 for available complexity and quality components.
- Analysis failure or skip for either player makes analysis components null for both. Missing optimal complexity removes that complexity component for both. Interview is always null.
- Total is the weighted average of non-null components, renormalized. A difference under 1 point is a draw; otherwise the higher total wins. Totals are compared before display rounding.

The LLM provides validated complexity classes and quality subscores, never totals, winner or ratings. All score formulas run on the server.

## Analysis and configuration

callLLM uses plain fetch and supports anthropic/openai. Missing LLM_API_KEY skips analysis. LLM_MOCK=true returns deterministic JSON without network requests. Code and problem are untrusted data; instructions embedded in code cannot change the requested analysis contract. Invalid JSON is retried once, then analysis becomes null. Quality values are validated as integers and clamped 0-10; feedback has at most three short tips.

New environment variables: AFTER_FIRST_FINISH_SECONDS=180, LLM_PROVIDER=openai, LLM_API_KEY, LLM_MODEL=gpt-4o-mini, LLM_BASE_URL (optional API base including /v1), LLM_TIMEOUT_MS=20000, LLM_MOCK=false.

Problem seeds upsert eight real slugs with optimal complexity metadata. stressTest.input is optional and unused in this step.

## Development verification

LLM_MOCK=true node backend/scripts/analyzeTest.js prints hash-map, nested-loop and messy analysis. Nested-loop is O(n^2) and scores lower.

node backend/scripts/battleSim.js uses mock analysis, short timers, an isolated temporary MongoDB database and a private Redis prefix. It exercises real Socket.IO handlers, HTTP controllers, MongoDB, Redis and Docker execution. Scenarios: first-finisher, draft-autoeval, simultaneous double-finish and one-player analysis failure. Analysis failure is injected only in the simulator, never through player code. It checks one battle_end per participant, private result payloads and one rating/stat/XP application. Temporary database and Redis keys are removed afterwards.
