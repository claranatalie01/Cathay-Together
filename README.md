# Cathay Together

Cathay Hackathon 2026 prototype by Group E147. Friends flying from different cities plan one trip inside the Cathay app: each person picks their own flight so the group lands close together, everyone swipes on activities, the app builds one shared itinerary, and each person books and pays only for themselves.

- [Live prototype](https://cathay-hackathon-2026.vercel.app)
- [Code repository](https://github.com/claranatalie01/Cathay-Hackathon_2026)

## Try the live prototype

Open https://cathay-hackathon-2026.vercel.app and sign in with one of these test accounts (created for judging, no real data):

| Traveller | Email | Password |
|---|---|---|
| Gaudi | gaudi@example.com | gauditrial123 |
| Clara | clara@example.com | claratrial123 |
| Kabe | kabe@example.com | kabetrial123 |

To see the group features, sign in as one traveller in a normal window and another in a private window.

## Where things are

The app lives in [`cathay-app/`](cathay-app). Start with its [README](cathay-app/README.md), which covers setup, environment variables, deployment and tests.

| Document | What it covers |
|---|---|
| [Architecture](cathay-app/ARCHITECTURE.md) | App flows, algorithms and security boundaries |
| [Data dictionary](cathay-app/DATA_DICTIONARY.md) | Supabase schema, functions and payloads |
| [Logic](cathay-app/LOGIC.md) | Flight ranking formulas and itinerary rules |
| [API contract](cathay-app/docs/api-contract.md) | Request and response shapes |
| [Architecture diagram](docs/architecture-diagram.html) | One-page diagram of the system |

## Run it locally

From `cathay-app/`, with Node.js 20.19+ or 22.12+:

```bash
npm ci
npm run dev
```

The app opens at http://localhost:5173. Sign-in and shared trips need a Supabase project, and the itinerary planner needs its own keys. Follow the setup steps in [`cathay-app/README.md`](cathay-app/README.md).
