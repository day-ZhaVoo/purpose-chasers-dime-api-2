# Purpose Chasers DIME GPT Starter (Vercel + GPT Action)

This folder is designed to be deployed on Vercel as a serverless API.
Then you connect the API to a Custom GPT using Actions.

## What you get
- /api/health.js  (quick test)
- /api/dime.js    (POST endpoint that computes DIME and returns AI analysis)
- openapi.yaml    (paste into GPT Actions)
- gpt_instructions.txt (paste into GPT Instructions)

## Environment variables you must add in Vercel
- GEMINI_API_KEY   = your Google AI Studio Gemini key
- GEMINI_MODEL     = optional (example: gemini-2.0-flash)
- PC_API_KEY       = any long random secret (used to protect the endpoint)

## Deploy steps (non-technical)
1) Create a GitHub repo and upload this folder (all files).
2) In Vercel, create a new project and import that GitHub repo.
3) After it deploys, go to Project Settings → Environment Variables and add the keys above.
4) Redeploy (Vercel will prompt or you can trigger a new deployment).
5) Test: open https://YOUR-VERCEL-DOMAIN/api/health  (should return {"ok":true})

## API endpoint
POST https://YOUR-VERCEL-DOMAIN/api/dime
Header: X-Api-Key: <PC_API_KEY>
Body:
{
  "userData": {
    "annualIncome": 85000,
    "mortgageBalance": 250000,
    "otherDebts": 15000,
    "dependents": 2,
    "existingInsurance": 100000
  }
}
