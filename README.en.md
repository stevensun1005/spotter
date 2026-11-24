<div align="center">

<img src="docs/assets/spotter-banner.svg" alt="Spotter — plan, lift, and check in together" width="100%">

# Spotter

**Plan your workouts, log each set, and check in with a training partner.**

[Quick start](#quick-start) · [Self-hosting](#self-hosting) · [中文](README.md)

</div>

Spotter is a mobile-first workout log for two training partners. Put a plan on your calendar, open a dedicated workout page at the gym, and record what you actually lifted. Then check in and look back at the session together.

| Plan the session | Log what you did | Check in together |
| --- | --- | --- |
| Preview imported plans from text, JSON, Bilibili or YouTube links. | Log weight, reps, time, warm-up and drop sets, left and right sides, and RPE with the training keypad. Resume a draft later. | Pair by invitation, send cheers, and review check-ins, shared plans and training history. |

## Editions

| Edition | Where it runs | What it includes |
| --- | --- | --- |
| **Standalone (`main`)** | Self-hosted Next.js and SQLite with its own logins. | Plan import, set logging, training drafts, partner check-ins, history, stats, and heart-rate import. |
| **Private Sites edition** | Invite-only site using Sites sign-in and Cloudflare D1. See the [Sites source branch](https://github.com/stevensun1005/spotter/tree/sites/source-2026-11-24). | Training cycles, offline check-in sync, an exercise library, friends and coaching, an in-chat AI coach, meal logging, and a protein powder library. |

The Sites coach can answer questions about recorded workouts, log body weight, and draft a workout that you can revise before adding it to your calendar. The protein powder library calculates one shake's nutrition from the saved scoop weight, liquid volume and mixer. See the [coach setup](https://github.com/stevensun1005/spotter/blob/sites/source-2026-11-24/docs/ai-coach.md) and [Agent API](https://github.com/stevensun1005/spotter/blob/sites/source-2026-11-24/docs/agent-api.md).

## Quick start

Use **Node.js 24 or later** with the standalone branch.

1. Clone the repo and install dependencies.

   ```sh
   git clone https://github.com/stevensun1005/spotter.git
   cd spotter
   npm ci
   ```

2. Copy [`.env.example`](.env.example) to `.env.local`. Generate a private first-account code and put the output in `SPOTTER_SETUP_CODE`.

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(16).toString('hex'))"
   ```

3. Run `npm run dev` and open [the local app](http://127.0.0.1:3000). Create the first account using the setup code, then issue a partner invite from the partner area.

Preview a CLI import with `npm run plans:import -- --user your-login --dry-run plans.json`. The CLI uses the configured `SPOTTER_DB_PATH` or `.data/spotter.sqlite` for local development.

## Heart-rate data

- **Apple Watch and iPhone Health** support Health ZIP or XML import. The [iPhone companion app](ios/README.md) can read HealthKit heart-rate samples on a signed physical iPhone and send them to the standalone edition.
- **Garmin Connect** uses FIT or TCX export. **WHOOP** supports CSV or ZIP import and optional OAuth workout summaries.
- **Other devices** can use FIT, TCX or CSV with `time,bpm` columns. Confirm the in-browser preview before saving samples from the workout window.

## Self-hosting

On a Node.js 24 server with persistent disk, run `npm ci` and `npm run build`. Set `SPOTTER_ORIGIN` to the real HTTPS origin with no trailing slash, `SPOTTER_DB_PATH` to an absolute persistent path, and `SPOTTER_SETUP_CODE` to your private initial setup code.

Run `npm start` under a non-root service account and forward HTTPS traffic to `127.0.0.1:3000`. Keep the process supervised and back up the SQLite database. Optional WHOOP sync uses `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, and the redirect URI `<SPOTTER_ORIGIN>/api/health/whoop/callback`.

Standalone and Sites use separate accounts and storage. Migration requires an export and an explicit account mapping. Keep personal records, databases and credentials out of Git.

## Development

Page and HTTP entry points live in [`app/`](app/). Domain modules live in [`features/`](features/). Integration tests use a temporary database and synthetic accounts.

```sh
npm run typecheck
npm run build
npm test
```
