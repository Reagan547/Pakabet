# Pakabet

Aviator crash game and betting front end for **pakabet.site**, with an Express +
Socket.IO backend and MongoDB Atlas persistence.

- `src/` — Angular 21 front end (deployed to Vercel, served at `https://pakabet.site`)
- `backend/` — Express + Socket.IO API and game engine (deployed to Render, served at `https://api.pakabet.site`)

## Run locally

```bash
npm install
npm start            # Angular dev server on http://localhost:4200
```

```bash
cd backend
npm install
npm start            # API + game socket on http://localhost:3022
```

The front end picks its API origin automatically: `http://localhost:3022` on
`localhost`/`127.0.0.1`, and `https://api.pakabet.site` everywhere else
(see [api-url.ts](src/app/core/config/api-url.ts)).

## Build

```bash
npm run build        # output in dist/frontend/browser
```

## Configuration

Copy `backend/.env.example` to `backend/.env` and fill in the values. Nothing in
`backend/.env` is committed. The keys that must be set for production:

| Key | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `MONGODB_DB_NAME` | Database name (defaults to `pakabet`) |
| `JWT_SECRET` | Long random string used to sign auth tokens |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `PAYHERO_*` | PayHero M-Pesa STK push credentials and callback URL |
| `SEED_ADMIN_*` | Optional first-run administrator |

If `MONGODB_URI` is blank the backend falls back to a local JSON store under
`backend/data/`, which is useful for offline development only.

## Deployment

- **Vercel** serves the Angular build. `vercel.json` rewrites `/api/*` to
  `https://api.pakabet.site` and sends everything else to `index.html` for the
  Angular router.
- **Render** runs `backend/` (`npm start`, Node 22). Point the custom domain
  `api.pakabet.site` at the Render service and set every environment variable
  from the table above in the Render dashboard.
