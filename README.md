# Joyride toy car rentals

A responsive, installable web app for managing timed toy-car rentals and payments. It runs without a build step and is ready for Firebase Hosting.

## Connect Firebase

1. Create or open a Firebase project and register a Web app.
2. Copy the Web app configuration into `firebase-config.js`.
3. In Firebase Console, open **Authentication → Sign-in method**.
4. Enable **Google** and **Email/Password**.
5. Under **Authentication → Settings → Authorized domains**, add any custom domain where the app will run. Firebase Hosting domains are normally added automatically.
6. Create a **Cloud Firestore** database and deploy `firestore.rules`. Each signed-in account owns one company document at `companies/{uid}`.

The app supports Google sign-in, email/password sign-in, email account creation, password reset, persistent or session-only login, and sign-out. Fleet, account, rental history, and payment status are saved in Firestore for each signed-in company account. Browser storage keeps a local copy and imports existing account data the first time that account connects to Firestore.

For quick testing, choose **Try demo without an account** on the sign-in screen. It starts with sample cars and saves changes only in that browser. Demo data never syncs to Firestore.

The Turkish interface includes an **Analiz** page with a Monday–Sunday chart, today's and this month's collected payments, a busiest-day insight, a selectable month-by-month view, and year-by-year totals. "Profit" currently means collected rental payments; expenses are not tracked. The demo includes paid sample rides across months and years to make the charts testable.

## Preview locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Deploy to Firebase Hosting

```bash
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --only hosting,firestore:rules
```

Company data syncs through Firestore after sign-in. If a write fails, the local copy remains available and the app shows a sync warning.
