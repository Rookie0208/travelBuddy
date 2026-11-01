# TripSplit mobile (v1)

React Native (Expo) + TypeScript. Talks to the Spring Boot backend in `../backend`.

## Run it

```bash
npm install
cp .env.example .env          # set EXPO_PUBLIC_API_URL if you use a real phone

# Run on Web (Browser):
npm run web

# Or run with Expo menu:
npx expo start
```

Backend address:

| Where you run the app | `EXPO_PUBLIC_API_URL` |
|---|---|
| Android emulator | leave empty (uses `http://10.0.2.2:8080`) |
| iOS simulator | leave empty (uses `http://localhost:8080`) |
| Real phone on same Wi-Fi | `http://<your-computer-LAN-IP>:8080` |
| Deployed server | `https://your-api-domain` (use HTTPS in release builds) |

In development the backend prints the email verification code in its log (`MAIL_ENABLED=false`).

## What is in v1

- Register with email + 6-digit code, login, silent token refresh, logout. Tokens are kept in secure storage.
- Trips: create (name, destination, dates, friends by name, currency defaults to INR), people tab, delete or leave.
- Guests: friends without the app are just names added by the owner.
- Invite link: owner shares it anywhere. Opening it lets someone request to join, optionally claiming
  an existing guest name. The owner approves.
- Expenses: amount + who paid + who shares. The server does the split. Edit, delete, comments and queries.
- History: every action is logged as a message visible to everyone in the trip.
- Balances: who owes whom, suggested repayments, owner records repayments and marks the trip settled.
- Stats: spending by category and by day.
- Excel: download icon on the trip screen (Summary, Settlement, Ledger, History).
- Notifications: in-app list for registered users, push on Android (see below).

## Data refresh (no real-time sync in v1)

The server is the source of truth. The app reloads data when a screen opens, when you pull to refresh,
when the app returns to the foreground, and when a push notification arrives or is tapped.
Retried "add expense" requests carry a request id so they never create duplicates, and editing an
expense that someone else changed meanwhile shows a conflict message instead of overwriting.

## Invite links

`tripsplit://join/<code>` opens the app when it is installed. Many chat apps do not make custom links
tappable, so the share message also contains the code, and the app has **Join with invite link or code**.
Before launch, add a web domain with universal links / app links so the link becomes `https://yourdomain/join/<code>`.

## Push notifications (needs extra setup)

Push does not work in Expo Go. You need a development build with Firebase:

1. Create a Firebase project, add an Android app with package `com.example.tripsplit` (change it in `app.json` first).
2. Put `google-services.json` in this folder and add `"googleServicesFile": "./google-services.json"` under `expo.android` in `app.json`.
3. `npx expo prebuild` then `npx expo run:android` (or use EAS Build).
4. On the backend set `FCM_ENABLED=true` and `FCM_CREDENTIALS_PATH` to a Firebase service-account JSON.

iOS: `getDevicePushTokenAsync` returns an APNs token, which the FCM backend cannot use directly. Before the iOS
release, either upload your APNs key to Firebase and switch to `@react-native-firebase/messaging`, or use Expo push
tokens. The app currently skips push registration on iOS; in-app notifications still work.

## Known limits (deliberate for v1)

- Equal split only. The API and database already store each person's share, so custom amounts can come later.
- One payer per expense. No filters on the expense list yet. No offline mode.
- Dates are typed as YYYY-MM-DD (a date picker can be added later).
- Only Expo-managed code; no custom native modules until push is wired up.
