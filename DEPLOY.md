# Deployment Guide (Render)

## 1) Prepare repository

1. Make sure `.env` is not in git (`.gitignore` already includes it).
2. Push code to GitHub.
3. Ensure `package.json` has:
   - `start` script (`npm start`)
   - Node engine (`>=20`)

## 2) Create service on Render

1. Render -> New -> Web Service.
2. Connect your GitHub repo.
3. Build command: `npm ci`
4. Start command: `npm start`
5. Health check path: `/health`

`render.yaml` is also included for Blueprint deploy.

## 3) Set environment variables in Render

- `NODE_ENV=production`
- `DATABASE_URL=<your render postgres url>`
- `SESSION_SECRET=<long random secret>`
- `INTERNSHIP_MANAGER_EMAILS=bmuftahiden@gmail.com,alibiayap@gmail.com`
- `KASPI_MERCHANT_ID=<your kaspi merchant id>`
- `KASPI_API_KEY=<your kaspi private API key>`
- `KASPI_CALLBACK_URL=https://<your-domain>/kaspi/return`

Do not store real secrets in repo.

## 4) Domain and HTTPS

1. Add custom domain in Render.
2. Point DNS records to Render as shown in Render dashboard.
3. Wait for automatic TLS certificate issuance.

## 5) Security checklist

1. Rotate `DATABASE_URL` password and `SESSION_SECRET` if they were ever committed.
2. Keep `NODE_ENV=production`.
3. Verify session cookie is `Secure` and `HttpOnly` in browser devtools.
4. Verify `/api/internships/access` returns expected `can_manage` for manager emails.
