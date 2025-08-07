# UMHC Auth Server

Secure serverless authentication for UMHC Finance System.

## Environment Variables Required:
- GITHUB_CLIENT_ID
- GITHUB_CLIENT_SECRET  
- JWT_SECRET
- ALLOWED_EMAIL=hiking@manchesterstudentsunion.com
- CLIENT_URL=https://UMHC.github.io/umhc-finance

## API Endpoints:
- `/api/auth-begin` - Initiates GitHub OAuth flow
- `/api/auth-callback` - Handles GitHub OAuth callback
- `/api/auth-verify` - Verifies JWT tokens
- `/api/health` - Health check endpoint

## Deploy:
```bash
vercel