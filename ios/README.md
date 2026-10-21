# Selrano Health (iPhone companion)

A small SwiftUI app with one job: read Apple Health (steps, active energy, exercise minutes, workouts, sleep, resting heart rate, including everything an Apple Watch records) and send it to Selrano. All logging, coaching and charts stay on the website.

## Build

The Xcode project is generated from `project.yml`, so it never needs merging.

```bash
cd ios
xcodegen generate
open SelranoHealth.xcodeproj
```

Run the tests on a simulator:

```bash
xcodebuild -project ios/SelranoHealth.xcodeproj -scheme SelranoHealth -destination 'platform=iOS Simulator,name=iPhone 17' test
```

## Signing and a real iPhone

Apple Watch data and background delivery only exist on a real iPhone, which needs an Apple Developer Program team (HealthKit background delivery is a paid-team capability).

1. Create `ios/Config/Signing.local.xcconfig` (ignored by git):
   ```
   DEVELOPMENT_TEAM = YOURTEAMID
   ```
2. Run `xcodegen generate`, plug in the iPhone, select it in Xcode and press Run. Automatic signing creates the App ID `com.selrano.health` with the HealthKit capability.
3. For installs that do not expire, archive and upload to TestFlight.

## Pairing

1. On the website, open Settings and choose **Connect iPhone**. It shows an 8-character code that lasts 10 minutes and works once.
2. Enter it in the app. The app receives a device token and keeps it in the Keychain. The token only works for `/api/health/sync`.
3. Allow Health access. The first sync sends the last 14 days and up to 60 days of workouts.

To disconnect, use **Disconnect this iPhone** in the app and revoke the device in Settings on the web. A revoked token gets 401 and the app returns to the pairing screen.

## How syncing works

- **Daily totals:** `HKStatisticsCollectionQuery` per local day, so overlapping iPhone and Watch samples are not double counted. The last 14 days are re-sent on every sync so late Watch data is picked up; the server upserts by date.
- **Sleep:** samples are grouped into sessions and assigned to the local date you woke up. Where the Watch staged a night, only the Watch's stages count, and overlaps are merged (`Sync/SleepNights.swift`).
- **Workouts:** an anchored query. The anchor is saved only after the server accepts the batch, so nothing is skipped if a sync fails.
- **When it runs:** on opening the app, when HealthKit reports new data (hourly for activity, immediately for workouts and sleep), and from a background refresh every few hours. iOS decides the exact timing. Health data is unreadable while the phone is locked, so a sync attempted then waits for the next one.

## Local server

To pair a Debug build on the simulator with `npm run dev`, add to `Signing.local.xcconfig`:

```
SELRANO_BASE_URL = http:/$()/localhost:3000
```

(`$()` keeps the xcconfig parser from treating `//` as a comment.) The simulator reaches the Mac's `localhost` directly. Debug builds also have **Add sample data**, which writes two weeks of example data into the simulator's Health store.
