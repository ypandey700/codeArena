# Project Notes - CodingArena

## Stack
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React, Socket.IO Client.
- **Backend**: Node.js, Express 4, MongoDB (Mongoose), Redis (ioredis), Socket.IO.
- **Code Execution**: Docker-based sandboxed runner for Python, JavaScript, C++, Java.
- **Authentication**: JWT (access/refresh tokens), Passport.js (Google & GitHub OAuth).

## Done
- **Matchmaking Engine**:
  - Redis sorted set queue (`matchmaking:queue:ranked_1v1`) with expanding Elo search window per matcher tick.
  - Queue broadcasts (`queue_status`) every 3s to queued players.
  - Cooldowns on match decline or accept timeout (`ACCEPT_WINDOW_SECONDS`).
- **1v1 Battle Lifecycle**:
  - `match_found` with opponent card, rating preview, problem preview, and accept deadline.
  - `match_accept` and `match_decline` with ack callbacks `{ success, message }`.
  - `battle_start` starting timer (`BATTLE_DURATION_SECONDS`).
  - Live duel chat with Redis rate limiting (5 messages per 5s) and ack callbacks.
  - Disconnect handling with configurable grace window (`RECONNECT_GRACE_SECONDS`), `opponent_disconnected`, and `opponent_reconnected`.
  - Battle forfeit (`battle_forfeit`) with immediate concede resolution.
  - Full submission execution (`POST /api/v1/battles/:id/submit`) updating progress and triggering `battle_end` on solve or timeout.
- **API & Serialization**:
  - `GET /api/v1/battles/active`: Returns active or pending battle state `{ battle }` or `{ battle: null }`.
  - `GET /api/v1/battles/:id`: Returns finished/active battle details matching `battle_end` shape plus `status`.
  - `POST /api/v1/battles/:id/submit`: Protected with Redis rate limiter (10 submissions per minute per user).
  - Socket events `match_accept`, `match_decline`, `battle_join`, `battle_forfeit`, `battle_chat` support ack callbacks.
- **Simulation**:
  - `backend/scripts/battleSim.js` passes end-to-end happy path: registration, matchmaking, accept, chat, submission, and match conclusion.

## Rules
- Keep code simple. No inline code comments. No unit tests unless explicitly asked.
- Envelope responses: `{ success, data }` on success, `{ message }` on error.
- Use environment variables everywhere instead of hardcoded values: `ACCEPT_WINDOW_SECONDS`, `BATTLE_DURATION_SECONDS`, `RECONNECT_GRACE_SECONDS`.
- Socket client-to-server handlers must check for and call `ack({ success, message })` or `ack({ success, data })`.
- Invalid battle states (battle ended, not a participant, rate limited) must return `success: false` with a clear message.

## Next
- Wire frontend components (`Matchmaking.jsx`, `BattleArena.jsx`, `PostMatchResults.jsx`) to backend Socket.IO events and REST endpoints.
- Implement socket reconnect / battle re-sync on frontend page refresh via `battle_join`.
- Multi-language test runner UI integration with sample test execution (`POST /api/v1/submissions/run`).
- Additional battle modes: private friend duels and AI interview challenge.

## Progress (F2: Battle Room Wiring)
### Finished in F2:
- Reconnect and state resync on socket reconnect & refresh via `battle_join` ack and `GET /battles/active`.
- Socket ack callback handlers for `match_accept`, `match_decline`, `battle_forfeit`, and `battle_chat` with error reporting inside chat stream.
- Unified ISO string/timestamp converter and server time offset synchronization for duel countdown.
- Problem data binding (title, difficulty badge, description, constraints, sample test cases).
- Per-language code buffer in memory ref (`codeByLangRef`), preserving user code edits across language tab switching and editor inputs.
- Evaluation runner (`POST /api/v1/submissions/run`) and duel submission (`POST /api/v1/battles/:id/submit`) with busy/running state, disabled action buttons, and friendly 429 rate limit error messaging.
- Real-time opponent progress tracking (`opponent_progress`) and own progress (`submission_result`) with 100% capped progress bars and count metrics in HUD and comms stream.
- Live duel tactical comms widget with real socket delivery (`battle_chat`, `battle_chat_message`), left/right alignments, quick phrases, unread count badge, and error notifications.
- Compact Top HUD and stakes display binding real usernames, ratings, tiers, avatars, and win/loss ratingPreview deltas.
- Duel forfeit with confirmation dialog emitting `battle_forfeit`.
- Disconnect banner with live countdown from `graceSeconds` for `opponent_disconnected`, cleared on `opponent_reconnected`.
- Removed interview step completely from 1v1 battle flow, simplifying action to "Submit Solution".

### Left in F2:
- None for core 1v1 battle room wiring. (Next features from backlog: private friend duels and custom match lobbies).
