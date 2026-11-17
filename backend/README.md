# CodingArena Backend

Backend for the CodingArena competitive coding platform.

## Getting Started

1. Start MongoDB and Redis:
```bash
docker compose up -d
```

2. Install dependencies:
```bash
npm install
```

3. Load the coding problems (required before matchmaking can create a duel):
```bash
npm run seed
```

This command adds or updates the starter problems without deleting users or battles.

4. Run in development:
```bash
npm run dev
```

5. Run in production:
```bash
npm start
```

## Verify matchmaking

With MongoDB and Redis running, run `npm run test:matchmaking`. The check uses a
temporary database and Redis namespace to test two authenticated socket clients,
missing problems, match creation failures, and accepting a duel.

To test manually, sign in with two different accounts in separate browser profiles
or a normal and private window, then join the ranked queue in both. Browser tabs
in the same profile share the refresh cookie.

## API Endpoints

- Health check: `http://localhost:5000/health`
- API v1 status: `http://localhost:5000/api/v1`
