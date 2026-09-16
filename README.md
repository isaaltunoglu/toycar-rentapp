# Joyride toy car rentals

A responsive, installable web app for managing timed toy-car rentals and payments. It runs without a build step and is ready for Firebase Hosting.

## Connect Firebase Authentication

1. Create or open a Firebase project and register a Web app.
2. Copy the Web app configuration into `firebase-config.js`.
3. In Firebase Console, open **Authentication → Sign-in method**.
4. Enable **Google** and **Email/Password**.
5. Under **Authentication → Settings → Authorized domains**, add any custom domain where the app will run. Firebase Hosting domains are normally added automatically.

The app supports Google sign-in, email/password sign-in, email account creation, password reset, persistent or session-only login, and sign-out. Each Firebase user gets isolated browser storage for their fleet and renter profile.

## Preview locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Deploy to Firebase Hosting

```bash
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --only hosting
```

Rental data is currently stored in the browser with `localStorage`, which makes the complete interface testable immediately. For shared multi-device data, replace the storage helpers in `app.js` with Firebase Firestore and add Firebase Authentication for renter accounts.
