<div align="center">

<img src="docs/assets/spotter-banner.svg" alt="Spotter, a workout log for training partners" width="100%">

# Spotter

**A mobile-first workout log for training partners. Plan your sessions, record every set, and check in together.**

[Try the web app](https://spotter-free.couple-ledger-service.workers.dev) · [Features](#features) · [Quick start](#quick-start) · [Self-hosting](#self-hosting) · [简体中文](README.md)

</div>

## Why Spotter

Your plan is on the calendar, your weights are in a notes app, and your partner still needs a message after the workout. Spotter puts all three in one flow. Open today's session, log the weight and reps you actually completed, then check in so your partner can follow along. You can also start an empty workout and build it as you go.

Open the web app to explore sample data. Sign in to save and sync your records across the Cloudflare web app and iPhone. [Try the web app](https://spotter-free.couple-ledger-service.workers.dev)

## Features

### Planning and training

- **Follow a plan or start on the spot.** Import text, plan JSON, or a follow-along video. Schedule recurring sessions from personal templates, or start an empty workout and add exercises from the catalogue.
- **Log each set as you complete it.** Record weight, reps, time, left and right sides, warm-up sets, drop sets, and effort. Use a rest timer and pick up a saved draft later.
- **Use your history for the next session.** Review volume, sessions, duration, the activity calendar, and muscle distribution. Check exercise history and get suggested loads for an upcoming set or session based on completed sets.

### Training partners and sharing

- **Pair by invitation.** See your check-ins and your partner's in one calendar. Open a check-in for its details and cheer each other on.
- **Share by relationship.** Partners, friends, and coaches have separate relationships. Meal sharing has its own setting. A trainee can review and accept plans sent by their coach before those plans enter the calendar.
- **Keep your work when the gym loses signal.** The web and iPhone apps queue workout check-ins and sync them when the connection returns.

### Nutrition and AI

- **Log meals, water, and body weight.** Use saved foods to calculate nutrition by portion, or identify a meal from a photo. Save your scoop weight, cup size, and mixer to log the nutrition of a full protein shake.
- **Handle training tasks in chat.** The in-app coach can show training stats, record a weigh-in, and draft a plan. Revise a draft in chat and review it before adding it to the calendar.
- **Connect your own agent.** Authorized external tools can read training context, submit plan drafts, or add records. Model-backed features require server configuration. [Coach setup](cloudflare/docs/ai-coach.md) · [Agent access](cloudflare/docs/agent-api.md)

## Editions

| Edition | Where to find it | What it runs |
| --- | --- | --- |
| **Cloudflare web app** | [Try the web app](https://spotter-free.couple-ledger-service.workers.dev) · [Source](cloudflare/) | A Worker and D1 database for the web UI and the iPhone API. |
| **iPhone and Apple Watch** | [Native source](ios/) · [Installation and release guide](docs/iphone-app.md) | SwiftUI training, Apple Health, Watch workouts, and widgets. Connects to the same Cloudflare service by default. |

Local, test, and production deployments use separate accounts and D1 databases. To move records, export them from the source and check the destination account before importing.

## Quick start

Use **Node.js 24 or later**. The web dependencies and local database configuration live in `cloudflare/`.

```sh
git clone https://github.com/stevensun1005/spotter.git
cd spotter/cloudflare
npm ci
npm run dev
```

Open the local URL printed in the terminal. To save records, apply the local D1 migrations and sign in with a synthetic account. [Local D1 and sign-in](cloudflare/README.md#本地-d1-与登录)

## Self-hosting

Build from `cloudflare/`, configure D1 in your Cloudflare account, apply the migrations, and deploy the Worker. Point an iPhone development build at its HTTPS API origin. [Deployment steps](cloudflare/README.md#cloudflare-部署) · [Apple and Google sign-in](docs/cloudflare-login.md)

## iPhone and health devices

- **Native iPhone app.** Open `ios/SpotterHealth.xcodeproj` in Xcode on a Mac and select the **Spotter** scheme. It targets iOS 16 or later. SwiftUI views connect to the Cloudflare API, with system sign-in, camera, Swift Charts, and HealthKit. Physical-device installation requires signing. [iPhone build and release guide](docs/iphone-app.md)
- **Health sync.** iPhone reads the Apple Health types you authorize. It can sync heart rate for a matching workout and selected body measurements to the signed-in Cloudflare account. [Health-device sync](docs/health-device-sync.md)
- **Heart-rate file import.** Import Apple Health ZIP/XML, Garmin FIT/TCX, WHOOP CSV/ZIP, or a generic CSV with `time,bpm` from a workout's detail page. Review the workout window and the matching samples before saving to your account. WHOOP summary sync is an optional integration.

## Development and documentation

| Task | Start here |
| --- | --- |
| Change a page or endpoint | [`cloudflare/app/`](cloudflare/app/) pages and routes · [`cloudflare/features/`](cloudflare/features/) domain logic · [`cloudflare/server/`](cloudflare/server/) accounts and storage |
| Work on iPhone or Apple Watch | [`ios/`](ios/) native source · [Product design](docs/product-design.md) |
| Configure AI or an external tool | [Plan assistant](cloudflare/docs/plan-assistant.md) · [AI coach](cloudflare/docs/ai-coach.md) · [Agent access](cloudflare/docs/agent-api.md) |
| Understand coaching and project workflows | [Coaches and trainees](cloudflare/docs/coaching.md) · [Project guide](AGENTS.md) |
| Get help with your account, privacy, or data exports | [Privacy notice](https://spotter-free.couple-ledger-service.workers.dev/privacy) · [Support](https://spotter-free.couple-ledger-service.workers.dev/support) |

```sh
npm run typecheck
npm run build
npm test
npm run test:ios-app
```

Run these commands from the repository root. The native checks require macOS and the Swift toolchain. Include the build, reproduction steps, and verification results when reporting an issue. Use synthetic accounts in examples and keep personal workouts, health records, databases, and credentials out of Git.

## License and credits

Spotter's own code and documentation are licensed under the [MIT License](LICENSE). The openGym exercise catalogue, translations, and muscle data retain their applicable AGPL-3.0 and original-entry MIT terms. Body-map geometry, exercise media, and other third-party components retain their respective terms. See [Third-party notices](NOTICE.md). Thanks to the maintainers and contributors of [openGym](https://github.com/DuarteSantos8/openGym).
