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

3. Run in development:
```bash
npm run dev
```

4. Run in production:
```bash
npm start
```

## API Endpoints

- Health check: `http://localhost:5000/health`
- API v1 status: `http://localhost:5000/api/v1`
