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
- `PGSSLMODE=require`
- `SESSION_SECRET=<64+ random characters>`
- `APP_BASE_URL=https://<your-domain>`
- `EMAIL_VERIFICATION_ENABLED=true`
- `AUTH_MIN_PASSWORD_LENGTH=10`
- `LOGIN_RATE_LIMIT_WINDOW_MINUTES=15`
- `LOGIN_RATE_LIMIT_MAX_ATTEMPTS=7`
- `REGISTER_RATE_LIMIT_WINDOW_MINUTES=30`
- `REGISTER_RATE_LIMIT_MAX_ATTEMPTS=5`
- `RESEND_RATE_LIMIT_WINDOW_MINUTES=30`
- `RESEND_RATE_LIMIT_MAX_ATTEMPTS=5`
- `FORGOT_RATE_LIMIT_WINDOW_MINUTES=30`
- `FORGOT_RATE_LIMIT_MAX_ATTEMPTS=5`
- `RESET_RATE_LIMIT_WINDOW_MINUTES=30`
- `RESET_RATE_LIMIT_MAX_ATTEMPTS=10`
- `PASSWORD_RESET_TOKEN_TTL_MINUTES=60`
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
4. Verify login rate limits trigger after repeated bad attempts.
5. Verify email confirmation is required before login.
6. Verify forgot password sends a reset link and the reset flow updates the password.
7. Verify `/api/internships/access` returns expected `can_manage` for manager emails.
