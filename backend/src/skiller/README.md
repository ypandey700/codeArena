# Skiller

This module adds authenticated adaptive practice at `/api/v1/skiller`. Its three collections (`skiller_profiles`, `skiller_problems`, `skiller_attempts`) are separate from ranked battles, existing problems, submissions, rating and XP. It reuses the existing code executor without changing that service. The existing route index only registers this router.

The first dashboard/next request installs 24 original questions across six topics with insert-only upserts. Existing Skiller problems are never overwritten. This does not seed or alter the ranked-battle problem catalog.

## Student flow

1. Open `/skiller` to start or resume a question. A `topic` query parameter selects a supported topic when no saved attempt is active. An active attempt is always resumed first.
2. Choose an unsolved question from a known weak topic first, then unassessed/improving topics at a suitable difficulty. Prefer unseen questions over recently skipped attempts. One active attempt per account prevents concurrent requests creating multiple assignments.
3. Edit a saved draft, use hints, run samples and submit to all tests. Draft revisions prevent stale overwrites. Evaluation leases prevent concurrent runs; request IDs prevent completed execution retries inflating counts.
4. Passing all tests completes the attempt immediately. The student can request the next question. Failed submissions keep the question editable. Skip and Exit are available in the workspace header. Skipping saves the draft and marks the attempt skipped before choosing another question. Exit saves the draft, keeps the question resumable, and returns to the homepage. If syncing fails, the local browser draft remains available and the student can retry or explicitly exit without syncing. Neither action changes ranked ratings.
5. Recompute topic scores from distinct problems, independent solves, hints and retries. Strong requires three distinct solved problems, two independent solves, a score of at least 70 and consistent recent results. Reviews/submission retries never inflate unique solves; interview scores do not affect topic strength.
6. Persist `weakTopics`, `topicStrengths`, `practiceStats` and `progressUpdatedAt` on the student's `SkillerProfile`. The student's own profile displays the Skiller journey: aggregate practice counts, all topic strengths and weak areas, paginated attempt history, and coding-profile forms. Unknown topics remain unassessed. Reading an older interview-stage attempt completes it automatically once any active request lease has ended, preserving its code, result and saved interview history.

Authenticated `GET /api/v1/skiller/history?page=1&limit=8` returns `{attempts, total, page, pages, limit}`, scoped to the requesting account. Page size is 1–50. Summaries include only question identity, topic, difficulty, state, result status, submission count, and dates; code, transcripts, execution output and hidden tests are excluded. The profile's history view can browse every saved attempt rather than only the dashboard's twelve recent attempts.

Practice statistics belong to Skiller; ranked RR, XP and battle records are untouched. GET history/attempt access always filters by the authenticated user. Hidden test inputs and expected outputs are never included in public problem data. Full submissions return pass/fail for each case without stdout or compiler diagnostics; run samples for visible debugging output. This also prevents user code from exposing hidden files through a sample case's stdout during a full submission.

## Existing profile context

The coding-profile forms on the student's own profile use the existing connector endpoints. Linking accounts is optional. The diagnostic endpoints remain available for existing records and integrations.

- LeetCode: best-effort public topic-count request to a fixed GraphQL URL. Private/unavailable/changed upstream responses leave practice available and display the import limitation. Imported counts are estimates, not verified account ownership or proof of weakness.
- GeeksforGeeks and CodeChef: validated public profile links can be saved. Topic import is not implemented for these connectors. Practice evidence maintains the topic strengths.
- User-supplied URLs are never fetched directly. Providers, HTTPS hosts and username path shapes are allowlisted.

## Configuration and checks

Use the existing MongoDB and Docker code-runner setup. Skiller does not call AI or require an LLM key. Restart the backend if the development server does not reload changes automatically.

Run `node --test scripts/skiller.test.cjs` from `backend`. It validates all bank examples with independent reference implementations, recommendation/mastery rules and connector restrictions. Its integration test creates a uniquely named `skiller_test_<pid>_<timestamp>` database, verifies persisted weak-topic profiles, automatic completion, account isolation, counters, idempotency, concurrency and legacy recovery, then drops only that exact test database. It never uses the application's database. Override only the server address with `SKILLER_TEST_MONGO_URI` if needed; the test database name remains isolated.

Run `node scripts/skiller.runner-smoke.cjs` from `backend` to check the existing Docker executor against six original cases in Python, JavaScript, C++ and Java. It does not access a database. The configured runtime images and a running Docker daemon are required.
