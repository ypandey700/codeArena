# Battle Contract & Frontend Flow Audit

## 1. Frontend Audit Summary

An audit of the frontend battle flow (`BattleModes.jsx`, `Matchmaking.jsx`, `BattleArena.jsx`, `PostMatchResults.jsx`, `PostMortemReport.jsx`, and public templates `battle-modes.html`, `matchmaking-queue.html`, `battle-arena.html`, `match-report.html`) identified the following integration surface:

- **Battle Modes**: The primary active mode is 1v1 Ranked Duel (`ranked_1v1`).
- **Matchmaking & Match Found**: Displays a 30-second accept timer, opponent card (username, rating RR, tier, win rate, streak), target problem preview (title, difficulty, category), and projected rating delta (e.g. +35 win / -22 loss). Supports accepting or declining.
- **Battle Room**: Uses a 15-minute duel countdown timer, problem description pane with sample test cases and starter code, multi-language editor (Python, JavaScript, C++, Java), local test execution (`POST /api/v1/submissions/run`), duel submission, forfeit/concede action, and live in-match tactical chat with quick phrases and opponent test suite progress notifications.
- **Post-Match Report**: Shows test pass count (e.g. 15/15), match verdict (Victory/Defeat/Draw), rating change (RR delta), tier progression, XP gained, and performance breakdown.

---

## 2. Rating Tiers & Thresholds

| Tier | Rating Range (RR) |
| :--- | :--- |
| **Bronze** | 0 – 999 |
| **Silver** | 1000 – 1199 |
| **Gold** | 1200 – 1399 |
| **Platinum** | 1400 – 1599 |
| **Diamond** | 1600 – 1899 |
| **Ascendant** | 1900 – 2199 |
| **Immortal** | 2200 – 2499 |
| **Radiant** | 2500+ |

---

## 3. Socket Events Specification

### Client to Server

| Event | Payload | Description |
| :--- | :--- | :--- |
| `queue_join` | `{ mode?: string }` | Enqueue user for matchmaking. Ack: `{ success, message }`. |
| `queue_leave` | None | Dequeue user from matchmaking. Ack: `{ success, message }`. |
| `match_accept` | `{ battleId: string }` | Accept a pending match. |
| `match_decline` | `{ battleId: string }` | Decline a pending match (triggers 30s queue cooldown). |
| `battle_join` | `{ battleId: string }` | Join / re-sync battle state after refresh. |
| `battle_forfeit` | `{ battleId: string }` | Forfeit the active battle. Opponent wins immediately. |
| `battle_chat` | `{ battleId: string, text: string }` | Send in-battle chat message (max 200 chars, rate-limited to 5 per 5s). |

### Server to Client

| Event | Payload | Description |
| :--- | :--- | :--- |
| `queue_status` | `{ waitingSeconds: number, playersInQueue: number }` | Emitted every 3 seconds while in queue. |
| `match_found` | `{ battleId, acceptDeadline, serverNow, opponent: { username, avatar, rating, tier, winRate, streak }, problem: { title, difficulty, category }, ratingPreview: { win, loss } }` | Emitted to both players when a match is created. |
| `match_cancelled` | `{ battleId, reason: string }` | Emitted if a player declines or the 30s accept deadline expires. |
| `battle_start` | `{ battleId, serverNow, startedAt, endsAt, problem: { _id, title, slug, description, difficulty, category, sampleTestCases, starterCode, timeLimitMs, memoryLimitMb }, opponent: { _id, username, avatar, rating, tier } }` | Emitted to both players when both accept. Starts 15m server timer. |
| `submission_result` | `{ status, passedCount, totalCount, timeMs }` | Emitted to submitter after code execution against all tests. |
| `opponent_progress` | `{ passedCount, totalCount, at }` | Emitted to opponent when submitter tests are evaluated (no code or test I/O). |
| `opponent_disconnected` | `{ graceSeconds: 30 }` | Emitted when opponent drops all socket connections mid-battle. |
| `opponent_reconnected` | None | Emitted when opponent returns within the 30-second grace window. |
| `battle_state` | `{ problem, endsAt, startedAt, serverNow, ownProgress, opponentProgress, lastChatMessages, status }` | Sent in reply to `battle_join`. |
| `battle_chat_message` | `{ from: string, text: string, at: number }` | Broadcast to match participants for chat messages. |
| `battle_end` | `{ battleId, winner: string\|null, reason: string, players: [{ username, avatar, passedCount, totalTests, solveTimeMs, runtimeMs, ratingBefore, ratingAfter, ratingDelta, xpGained }], timeline }` | Emitted when battle concludes by solve, time, forfeit, disconnect, or draw. |

---

## 4. HTTP API Endpoints

All endpoints use standard envelope `{ success: true, data: { ... } }` or error `{ message: "..." }`.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/arena/stats` | Public | Returns `{ online, inQueue, inBattles }`. |
| `GET` | `/api/v1/battles/active` | Bearer | Returns the user's current pending or active battle, or `null`. |
| `POST` | `/api/v1/battles/:id/submit` | Bearer | Evaluates code against full test suite, updates progress, checks win. |
| `GET` | `/api/v1/battles/:id` | Bearer | Returns battle details (participants only). |
| `GET` | `/api/v1/battles/me` | Bearer | Returns user's battle history (paginated: `page`, `limit`). |
| `POST` | `/api/v1/submissions/run` | Bearer | Runs code against sample test cases (not counted in battle). |
| `GET` | `/api/v1/users/:username` | Public | Returns user profile including `rank` (1 + higher rated users) and `tier`. |
