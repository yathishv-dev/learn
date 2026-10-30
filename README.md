# Vyapaar Voice

A small-shop business intelligence MVP for **MakerSprint PS 06**. Track inventory, sales and expenses; ask questions against your shop’s saved records; and turn English or Kannada speech into an editable form before saving.

## Stack

- React + TypeScript, using Next.js App Router for the UI and TypeScript API routes
- Tailwind CSS 4 and a responsive custom interface
- Supabase Auth and PostgreSQL with row-level security
- Vercel AI SDK 7 and AI Gateway for the assistant, draft extraction and speech fallback
- Vercel hosting

The palette follows the supplied reference: **mocha brown `#6F4E37`**, **platinum silver `#E5E4E2`**, **pale lavender `#E6E0F0`**.

## Run locally

Use Node.js 24 LTS and npm.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Registration shows a setup notice until the Supabase settings below are present. The application does not substitute browser-local records or fake AI responses for the database.

The scripts use Next.js’s supported Webpack option because the Turbopack CSS subprocess failed in the current Windows workspace. Both the development and production scripts use the same bundler.

## Connect Supabase

1. Create or select the project for this app (Mumbai / `ap-south-1` is the intended region).
2. Apply the SQL in [the initial migration](supabase/migrations/20261030153110_initial_shop_schema.sql) through the Supabase SQL Editor, or link the project and apply migrations using the Supabase CLI.
3. Set these in `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   ```

4. In Supabase Auth URL configuration, add `http://localhost:3000` as a redirect URL for development, and add your exact HTTPS Vercel URL when deployed. Set the production Site URL to that HTTPS URL.
5. Keep email confirmation enabled. Register, confirm the email, then sign in. A shop profile is initialized from the registration preferences on the first authenticated visit.
6. Restart the development server after changing environment variables.

Only the public project URL and **publishable** key belong in `NEXT_PUBLIC_` variables. A service-role key is not needed by the app. Server requests validate the user with `auth.getUser()` and run with that user’s RLS permissions.

## Connect AI and spoken answers

Set the following server-only variables:

```dotenv
AI_GATEWAY_API_KEY=YOUR_GATEWAY_KEY
AI_MODEL=google/gemini-3.8-flash
AI_SPEECH_MODEL=google/gemini-3.8-flash-lite-tts
```

These model IDs were checked against the live AI Gateway catalog and speech documentation during implementation. They can be changed to compatible models as the catalog changes. The text model must support tool calling and structured output. The speech endpoint currently supplies a Google `Kore` voice and WAV output, so use a compatible Google speech model or update the speech options with the chosen provider.

Vercel deployments can use AI Gateway OIDC authentication instead of a gateway key. Local development requires a gateway key or a valid Vercel OIDC session. Configure provider credits or spending limits in the AI Gateway account before live use.

The assistant is read-only. It uses a fresh daily report and parameter-validated tools to query the requested date range or current products. Business totals are calculated in PostgreSQL. Record names and descriptions are treated as untrusted data in the model instructions. Responses include the records/date ranges consulted.

## Languages and voice

- Registration has independent **application language** and **AI answer / speaking language** choices: English or Kannada.
- Both choices persist in the shop profile and can be changed in Settings. The top bar also changes the application language.
- AI responses use the saved AI language, regardless of the interface language.
- Voice entry offers English (`en-IN`) and Kannada (`kn-IN`) recognition. Use a browser that supports the Web Speech API, such as compatible Chrome or Edge versions. Availability depends on the device and browser’s speech service.
- Microphone input requires HTTPS or localhost and permission from the user. Recognition may send audio to the browser vendor’s speech service. Unsupported browsers retain typed entry.
- A transcript produces a draft, never a saved transaction. The user checks all required fields and explicitly presses Save.
- Existing-product restocking drafts can add to current stock; absolute counts replace the reviewed count. Ambiguous matches require manual product selection. Multiple spoken records are not batch-saved; the draft warns that additional entries need separate forms.
- Spoken answers first use an installed voice matching the selected AI language. If no matching voice is present, the authenticated server speech endpoint supplies the fallback. If generation or playback is unavailable, the written answer stays visible with a localized explanation.

## Business rules

- One owner account represents one shop. Each table uses owner-based RLS.
- Amounts are integer **paise**, and quantities support three decimal places.
- A sale records one product and updates its stock in the same transaction. The database rejects overselling, future sale dates and invalid quantities.
- Sale prices, product names, units and cost of goods are snapshots. Later product edits do not rewrite old sales.
- Repeated sale saves use a request UUID and do not decrement stock twice. A price change between review and save requires a new review.
- Inventory edits use a version check to avoid overwriting stock changed by a concurrent sale. Reopen an outdated form to review current values.
- Estimated profit = recorded sales − recorded cost of goods − recorded expenses. It is not a bank balance or a tax calculation.
- Product archiving keeps historical sales. Sales are immutable through the app. Expenses can be edited or deleted after confirmation.
- Date boundaries use **Asia/Kolkata**. Reports support inclusive ranges of up to 367 days. “This week” in chat means the last seven calendar days, including today.
- Reports aggregate in SQL, including records beyond the Data API’s default row limit. Transaction lists show the latest 200 records within the selected period; narrow the date range for older entries.
- AI endpoints have a shared database-backed limit of 20 requests per minute and 200 per rolling day per owner. This includes draft parsing and server speech requests. Provider token and timeout limits also apply.

## Checks

```powershell
npm run typecheck
npm test
npm run build
```

The tests execute the real migration in an in-memory PostgreSQL engine (PGlite), with a minimal Supabase auth schema and non-privileged roles for RLS checks. They cover calculation accuracy, stock rollback, idempotency, stale edits, cross-shop access, rate limits and large reports. They do not replace testing live Supabase Auth, true multi-connection contention, microphone recognition, Kannada speech quality or live provider responses.

## Deploy to Vercel

1. Push this project to `yathishv-dev/learn` and import that repository into Vercel as a Next.js project.
2. Set the two public Supabase variables and the server-only AI variables (or OIDC) in the Vercel project environments.
3. Deploy with the provided `npm run build` command.
4. Add the exact deployment URLs to Supabase Auth’s allowed redirects and set the production Site URL.
5. Test registration, an inventory item, a sale, an expense, language switching, a grounded AI question and voice review on the demonstration device.

Before live use, connect a Supabase project, configure Auth redirects, and enable AI Gateway access in the Vercel account.
