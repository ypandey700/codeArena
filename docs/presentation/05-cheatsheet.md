# CodingArena — Presenter Cheatsheet (One-Page Reference)

## 1. Ports & Infrastructure
| Service | Port | Details |
| --- | --- | --- |
| **Frontend (Vite + React 19)** | `:5173` | `CLIENT_URL=http://localhost:5173`, `VITE_API_URL=http://localhost:5000/api/v1` |
| **Backend (Express 4 + Socket.IO)** | `:5000` | `PORT=5000`, `/health` and `/api/v1/*` |
| **MongoDB 7 (Replica Set `codingarena`)** | `:27017` | `backend/docker-compose.yml` (`mongod --replSet codingarena`), needed for `finishBattle` transactions |
| **Redis 7 (`redis:7-alpine`)** | `:6379` | Sessions, matchmaking queue, drafts, chat, rate limits, socket connection counts |

---

## 2. Key Numbers, Limits & Formulas

- **Auth & Sessions**: Access JWT `15m` (in JS memory `api.js`), Refresh JWT `7d` (`HttpOnly` `sameSite: 'lax'` cookie + Redis `refresh:<userId>`), `oauth_state` cookie `10m`, `bcryptjs` salt rounds `10`.
- **Elo & Tiers**: Start `1200`, K-factor `32`, floor `100`. Tiers (`utils/tier.js`): Bronze `<1000`, Silver `1000+`, Gold `1200+`, Platinum `1400+`, Diamond `1600+`, Ascendant `1900+`, Immortal `2200+`, Radiant `2500+`. Battle XP: Win `50`, Draw `20`, Loss `10`; Solo Problem XP: Easy `10`, Medium `20`, Hard `30`.
- **Matchmaking & Duel Timers**: Matcher tick `1000ms`, queue status emit `3000ms`, Elo window `min(600, 100 + 25 * waitedSec)`, accept window `30s`, cooldown `30s`, coding duration `900s` (`15m`), shortened post-first-finish `180s` (`3m`), disconnect grace `30s` (coding only), hard cap `laterEnd + 480s + 30s`, failed transaction retry `5000ms`, client finalizing poll `3000ms`.
- **Duel Limits**: Code max `20,000` chars; drafts `1/2s` server (`5s` client, `3600s` Redis TTL); chat `5/5s`, `200` chars max, last `50` msgs (`24h` TTL); `/submissions/run` & `/battles/:id/submit` `10/60s`.
- **Docker Runner (`codeRunnerService.js`)**: Images `python:3.12-slim`, `node:20-alpine`, `gcc:13`, `eclipse-temurin:21-jdk`; hardcoded `ExecutionQueue(3)`, `--network none`, `--read-only`, `--tmpfs /tmp:rw,size=64m`, `--pids-limit 64`, `--cpus 1`, `--memory 256m`, `timeLimitMs` `2000ms` default, stdout/stderr cap `10,240` bytes.
- **Scoring (`scoring.js`)**: `WEIGHTS`: `correctness: 25`, `speed: 8`, `runtime: 7`, `timeComplexity: 12`, `spaceComplexity: 3`, `quality: 15`, `interview: 30`. Complexity step penalty `-35`. Null components excluded for **both** players and remaining weights renormalized to `100%`. Draw threshold `SCORE_TIE_EPSILON = 0.01`, tie-break chain `correctness -> interview -> speed -> runtime`, forfeit/disconnect overrides score winner.
- **Skiller (Practice)**: `24` problems (`6` topics x `4`), `12` diagnostic MCQs; `strong` needs `solved>=3`, `independent>=2`, `score>=70`, `streak>=2`. Draft debounce `1200ms`, lock lease `120,000ms`, `evaluations` cap `200`, LeetCode fetch `8000ms` / `512 KB`. Rate limits (`60s`): `draft 90`, `next/hint/abandon 20`, `run/submit 10`, `profiles 6`, `diagnostic 5`.
- **AI Interview**: `4` questions (`INTERVIEW_QUESTIONS`), `90s` answer + `15s` read (`105s` per-question server deadline + `5s` expire buffer), `480s` total (`INTERVIEW_MAX_SECONDS`), `5s` client prep, `25s` post-deadline grading window, `2000` char answer max, `1/2s` rate limit, question max `30` words, **heuristic grading cap `50/100`** (`LLM_API_KEY` unset -> fallback questions + heuristic grading).

---

## 3. Environment Variables (`backend/.env.example` & Frontend)

| Variable | Default / `.env` State | Notes from Source |
| --- | --- | --- |
| `PORT`, `NODE_ENV`, `CLIENT_URL`, `SERVER_URL` | `5000`, `development`, `:5173`, `:5000` | Used in `server.js`, `app.js`, `authController.js`, `passport.js` |
| `MONGO_URI`, `REDIS_URL` | `127.0.0.1:27017/codingarena`, `:6379` | Used in `config/db.js`, `config/redis.js` |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Set in `.env` | Used in `authController.js`, `middleware/auth.js`, `sockets/index.js` |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `COOKIE_SECRET` | Set in `.env` | **Ignored in code** (`authController.js` hardcodes `'15m'`/`'7d'`; `app.js` calls `cookieParser()` without secret) |
| `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` | **Unset (empty) in `.env`** | OAuth redirects to `/auth/callback?error=*_not_configured` |
| `DOCKER_CONCURRENCY_LIMIT`, `EXECUTION_TIMEOUT_MS`, `EXECUTION_MEMORY_LIMIT`, `EXECUTION_CPU_LIMIT` | `5`, `5000`, `256m`, `1.0` | **Ignored in `codeRunnerService.js`** (uses `ExecutionQueue(3)`, `--cpus 1`, and problem `timeLimitMs`/`memoryLimitMb`) |
| `BATTLE_DURATION_SECONDS`, `RECONNECT_GRACE_SECONDS`, `ACCEPT_WINDOW_SECONDS`, `AFTER_FIRST_FINISH_SECONDS` | `900`, `30`, `30`, `180` | Active in `battleService.js` |
| `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`, `LLM_TIMEOUT_MS`, `LLM_MOCK` | `LLM_API_KEY` & `LLM_MOCK` **unset in `.env`** | Causes `analysisService` to return `null` and interview to use fallback + heuristic grading (`50/100` cap) |
| `INTERVIEW_QUESTIONS`, `INTERVIEW_QUESTION_SECONDS`, `INTERVIEW_READ_ALLOWANCE_SECONDS`, `INTERVIEW_MAX_SECONDS` | `4`, `90`, `15`, `480` | Active in `interviewService.js`; `SCORE_TIE_EPSILON` defaults to `0.01` in `scoring.js` |
| Frontend `VITE_*` | `VITE_API_URL` (`:5000/api/v1`) | Optional: `VITE_SERVER_URL`, `VITE_INTERVIEW_QUESTION_SECONDS`, `VITE_INTERVIEW_READ_ALLOWANCE_SECONDS` |

---

## 4. Complete Route & Socket Event Map

- **Health & Base**: `GET /health`, `GET /api/v1`
- **Auth (`/api/v1/auth`)**: `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `GET /me` (`auth`), `GET /google`, `GET /google/callback`, `GET /github`, `GET /github/callback`
- **Users (`/api/v1/users`)**: `GET /search` (`auth`), `PATCH /me` (`auth`), `GET /:username`
- **Problems & Arena**: `GET /api/v1/problems`, `GET /api/v1/problems/:slug`, `GET /api/v1/arena/stats`
- **Submissions (`/api/v1/submissions`, all `auth`)**: `POST /run` (`rateLimit`), `POST /` (`rateLimit`), `GET /me`, `GET /:id`
- **Battles (`/api/v1/battles`, all `auth`)**: `GET /active`, `GET /me`, `GET /:id`, `POST /:id/submit`
- **Skiller (`/api/v1/skiller`, all `auth`)**: `GET /`, `GET /history`, `GET /diagnostic`, `POST /diagnostic`, `PUT /profiles/:provider`, `DELETE /profiles/:provider`, `POST /next`, `GET /attempts/:id`, `PATCH /attempts/:id/draft`, `POST /attempts/:id/hint`, `POST /attempts/:id/run`, `POST /attempts/:id/submit`, `POST /attempts/:id/abandon`
- **Socket.IO (`backend/src/sockets/index.js`)**:
  - *Client -> Server*: `queue_join`, `queue_leave`, `match_accept`, `match_decline`, `battle_join`, `code_draft`, `battle_finish`, `interview_join`, `interview_answer`, `battle_forfeit`, `battle_chat`
  - *Server -> Client*: `queue_status`, `queue_error`, `match_found`, `match_cancelled`, `battle_start`, `battle_state`, `submission_result`, `opponent_progress`, `you_finished`, `opponent_finished`, `opponent_disconnected`, `opponent_reconnected`, `battle_chat_message`, `interview_thinking`, `interview_started`, `interview_question`, `interview_complete`, `opponent_phase`, `battle_finalizing`, `battle_end`

---

## 5. "If Asked X, Answer Y" Quick Lines

- **If asked "Why does OAuth show `google_not_configured`?"** -> Answer: *"The Passport strategies, CSRF `oauth_state` cookie, and verified-email account linking are implemented in `passport.js` and `authController.js`, and OAuth credentials are intentionally unset in `.env`, so `googleAuth`/`githubAuth` fail safely before redirecting externally."*
- **If asked "Why is Complexity/Quality 'Analysis unavailable' and Interview capped at 50/100?"** -> Answer: *"`LLM_API_KEY` is unset in `.env`, so `analysisService` returns `null` (and `scoringInfo` renormalizes the remaining weights to 100%), while `interviewService` uses deterministic code-grounded fallback questions (`codeQuestion`) and `heuristicGrade` (max 50/100). Setting `LLM_MOCK=true` or adding an API key enables full 100-point LLM analysis and grading."*
- **If asked "What happens if a user pastes malicious code or tries to read hidden tests?"** -> Answer: *"Code runs inside ephemeral Docker containers with `--network none`, `--read-only`, `--pids-limit 64`, `--memory 256m`, non-root `--user`, and `timeout -s KILL`. In Skiller full submissions, `sanitizeResult` strips all stdout/stderr/compiler errors so code cannot print `/app/in_*.txt` hidden cases; in Battles, `hiddenTestCases` and opponent `myTests`/`finalCode` are never serialized to the client."*
- **If asked "What happens if Redis crashes?"** -> Answer: *"Be honest per module: `/submissions/run` (`middleware/rateLimit.js`) fails open, and Skiller (`skiller/routes.js`) falls back to an in-memory `Map`. However, `/auth/*`, `POST /battles/:id/submit`, and `interview_answer` call Redis directly and will return errors until Redis recovers."*
- **If asked "What happens if the backend restarts mid-duel?"** -> Answer: *"`initBattleEngine` (`battleService.js`) and `interviewService.restore()` recover stuck `'finalizing'` battles using idempotent `appliedBattleResults` markers, re-arm coding/accept/interview/hard-cap timers, evaluate expired coding deadlines via saved Redis drafts, and resume open interview questions without losing state."*
- **If asked "What happens if a player disconnects during the AI Interview?"** -> Answer: *"Disconnect grace (`30s`) only applies during `phase === 'coding'`. Disconnecting during `'interview'` or `'done'` never forfeits the player or pauses interview deadlines; refreshing reconnects via `battle_join` + `interview_join`."*
- **If asked "Are Friends, Private Rooms, Debug Blitz, and SQL Clash working?"** -> Answer: *"No—`User.friends` has no endpoints, `GET /users/search` has no frontend caller, and Private Rooms / Squads / Debug Blitz / SQL Clash are explicitly marked 'Coming soon' placeholders in `CommandDeck.jsx` and `BattleModes.jsx`."*
- **If asked "What tests have you actually run?"** -> Answer: *"The repo includes `node --test scripts/scoring.test.cjs`, `node --test scripts/skiller.test.cjs`, `node scripts/skiller.runner-smoke.cjs`, and `npm run test:matchmaking` / `battleSim.js` (with `LLM_MOCK=true`); high-concurrency Docker load testing and live external OAuth callbacks remain untested."*
