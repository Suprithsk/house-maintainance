# SKS Home

Android-only Expo app (TypeScript) for running a household, talking to the
[SKS Home backend](../house-maintainance-be). Home screen lists the features;
today that's **Milk & Curd** (daily quantities, rates, monthly bill), a **Shopping list**, and
**Laundry** (drying reminder, wash count, descaling).

## Run it

```bash
npm install
cp .env.example .env   # then fill in the API URL and key — see below
npm start              # Metro + QR code for Expo Go
npm run tunnel         # same, via tunnel if Wi-Fi blocks device-to-device
npm run typecheck      # tsc --noEmit
```

The [backend](../house-maintainance-be) must be running: the app holds no data of
its own any more.

## Configuration (.env)

Expo loads `.env` itself — no dotenv package — and **inlines every
`EXPO_PUBLIC_`-prefixed variable into the bundle at build time**. They are not
read at runtime, so a change only takes effect after restarting Metro, and they
must be referenced as static properties (`process.env.EXPO_PUBLIC_API_URL`);
a computed lookup like `process.env[name]` is never replaced.

| Variable | What it does |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Where the backend lives. A phone can't reach `localhost`, so on a dev machine this is its LAN address, e.g. `http://192.168.1.5:4000`. |
| `EXPO_PUBLIC_API_KEY` | Must equal `APP_SECRET` in the backend's `.env`. Sent as the `x-api-key` header on every request. |

`.env` is gitignored because it carries the key; `.env.example` is the template.

**These values are not secret from the user of the app.** Expo's own docs are
blunt about it: never put real secrets in `EXPO_PUBLIC_` variables, because
anyone with the APK can read every embedded string. That is an accepted trade
here — the key guards one household's milk log and there are no accounts, which
is the same call the backend makes. Rotating it means editing both `.env` files
and rebuilding the app.

Milk & Curd and the shopping list run in Expo Go. **Laundry alerts do not**: importing
`expo-notifications` executes `DevicePushTokenAutoRegistration.fx` at module scope, which throws
on Android inside Expo Go (push was removed in SDK 53). `src/notifications.ts` therefore loads
the module lazily and skips it entirely under Expo Go — timers still count down on screen, but
nothing fires. For working alerts, build a dev client:

```bash
npx eas-cli build --platform android --profile development
```

## Talking to the backend

`src/api/client.ts` is the only place that knows about HTTP: it attaches the
`x-api-key` header, aborts a request after 10 seconds, and turns every failure
into one sentence a screen can show — a wrong key, an unreachable host and a
validation error read differently, because "failed" is not a useful thing to put
in front of someone. `src/api/types.ts` mirrors the backend's response shapes and
`src/api/index.ts` is the typed endpoint list.

Nothing is cached on the device. Each screen loads on mount, pull-to-refresh
re-fetches, and a failure shows a retry banner rather than stale numbers. The one
thing still stored locally is **notification ids** (`src/laundry/deviceNotifications.ts`):
`expo-notifications` issues them per install, so they are meaningless to the
server — it owns *when* a reminder is due, each phone schedules its own alarms
from the `reminderTimes` it sends.

The maths moved with the data. `totalsForMonth`, `missedDays` and the wash
counters now live on the server; what stays here is formatting (`formatMoney`,
`describeRemaining`) and the live countdown.

## Milk & Curd

One `GET /api/milk/summary?month=` renders the whole screen: rates, totals, missed days and
priced entries. Saving a day is a `PUT` on the date, because the date *is* the identity — writing
the same day twice edits it rather than adding a second row.

Quantities are entered in litres and billed per 0.5 L packet. The screen checks the packet step
before sending so a typo doesn't cost a round trip, but the server validates it too.

Rates are `₹ per packet` for both products, editable in a modal. Amounts are never stored —
always quantity × *current* rate — so fixing a rate re-prices every month already recorded.

**Reminders** (`src/milk/reminders.ts`) — a nudge to log the day at 9:30 am and 8:30 pm, which
stops for a day once that day is recorded. Two slots rather than three because the limit is
attention, not scheduling: a third ping for a ten-second task is how people learn to swipe them
away unread.

A repeating daily trigger can't do that: cancelling one cancels every future occurrence, not
just today's, and nothing runs in the background to re-arm it tomorrow. So each slot is its own
one-shot, 60 days are scheduled up front (120 alarms, well inside Android's per-app ceiling),
and the set is rebuilt when the screen loads — dropping days the server already has. Since
logging the milk means opening the screen, the horizon refills in normal use.

The rebuild is guarded by a signature of what it was built from (slot times, today's date, and
which days from today on are recorded), so a visit that changes nothing reschedules nothing —
otherwise every load would re-issue hundreds of native calls to arrive at the same alarms.

## Shopping list

`GET /api/shopping/items` returns `{ pending, bought }` — two filters over one list, so a bought
item keeps its identity and can be revived. The server does the ordering (pending oldest-first,
bought newest-first) and the merging: adding a name already on the to-buy list adds the
quantities together instead of creating a second row.

**UI** (`src/screens/ShoppingScreen.tsx`) — an add row (name + quantity stepper), then the
to-buy list where tapping the circle marks an item bought. Bought items live behind a
`Bought (n)` link that opens a full-screen modal, keeping them out of the way until wanted;
each row there has **Add again** and a remove ✕.

## Laundry

One screen for the whole washing routine, because the parts feed each other.

`GET /api/laundry` returns the whole screen: the dry timer, the wash counters, the descale
status, and the limits themselves — so the app never hard-codes 25 or the delay presets.

**Drying** — one timer at a time; it's a place, not a list. The server computes `dueAt` and the
`reminderTimes` the phone should schedule (the due alert plus a nag every 6 hours, with slots
already past dropped), so a phone reopening after a gap arms only what's still ahead.

**Washes and descaling** — "Log a wash" appends to a log that is never decremented; the count is
*derived* from rows newer than `lastDescaleAt`. It keeps climbing past 25. "Descaling completed"
just stamps a new watermark, so the reset can't drift out of sync with the log. Crossing the
limit schedules a nudge a minute out plus a daily 9am repeat, both cancelled on reset.

## Sharing an APK

No Play Store involved — EAS builds it in the cloud and hands back a link to
install directly.

```bash
npx eas-cli login
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_API_URL --value "http://..." --visibility plaintext
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_API_KEY --value "..." --visibility sensitive
npx eas-cli build --platform android --profile preview
```

The two `env:create` lines are not optional. `.env` is gitignored, and **EAS Build
never uploads gitignored files** — without them the build comes out with no API
URL or key and every screen shows the "check .env" banner. The `preview` profile
names that environment (`eas.json`), so the build picks the values up.

Two things decide whether the APK is any use to whoever you send it to:

- **`EXPO_PUBLIC_API_URL` is baked in at build time.** A LAN address only works
  for phones on that Wi-Fi, while the laptop is running the server. Sharing it
  further means hosting the backend somewhere public and rebuilding.
- **Cleartext HTTP.** Android 9+ blocks plain `http://` in release builds, so
  `expo-build-properties` sets `usesCleartextTraffic: true` in `app.json`. Drop
  that once the API is on HTTPS — it lowers the bar for every request the app
  makes, not just yours.

## Android-only

`app.json` sets `"platforms": ["android"]`, an Android package name, and the
`POST_NOTIFICATIONS` (Android 13+) and `SCHEDULE_EXACT_ALARM` permissions. The iOS and web npm
scripts are removed.
