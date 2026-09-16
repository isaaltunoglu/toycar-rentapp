import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const gate = document.querySelector("#authGate");
const form = document.querySelector("#emailAuthForm");
const errorBox = document.querySelector("#authError");
const submitButton = document.querySelector("#emailAuthSubmit");
let authMode = "signin";
let auth;

const isConfigured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_") && firebaseConfig.projectId && !firebaseConfig.projectId.startsWith("YOUR_");

function setGate(signedIn) {
  document.body.classList.remove("auth-pending");
  document.body.classList.toggle("signed-out", !signedIn);
  gate.hidden = signedIn;
}

function setBusy(busy, label = "Please wait…") {
  document.querySelectorAll("#googleLogin, #emailAuthForm input, #emailAuthForm button").forEach(el => el.disabled = busy);
  if (busy) { submitButton.dataset.label = submitButton.innerHTML; submitButton.textContent = label; }
  else if (submitButton.dataset.label) { submitButton.innerHTML = submitButton.dataset.label; delete submitButton.dataset.label; }
}

function showError(error) {
  const messages = {
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/email-already-in-use": "An account already exists for this email address.",
    "auth/weak-password": "Choose a stronger password with at least 6 characters.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/popup-closed-by-user": "Google sign-in was closed before it finished.",
    "auth/popup-blocked": "Your browser blocked the Google sign-in window. Please allow pop-ups and try again.",
    "auth/network-request-failed": "Check your internet connection and try again.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/unauthorized-domain": "This website domain must be added to Firebase Authentication’s authorized domains."
  };
  errorBox.classList.remove("success");
  errorBox.textContent = messages[error?.code] || error?.message || "We couldn't sign you in. Please try again.";
  errorBox.hidden = false;
}

function publishUser(user, extra = {}) {
  const names = (user.displayName || "").trim().split(/\s+/);
  window.dispatchEvent(new CustomEvent("joyride-auth-user", { detail: {
    uid: user.uid,
    email: user.email || "",
    firstName: extra.firstName || names[0] || user.email?.split("@")[0] || "Renter",
    lastName: extra.lastName || names.slice(1).join(" "),
    company: extra.company || "",
    profileSetup: Boolean(extra.profileSetup)
  }}));
}

if (!isConfigured) {
  document.querySelector("#firebaseSetupNotice").hidden = false;
  setGate(false);
  document.querySelectorAll("#googleLogin, #emailAuthForm input, #emailAuthForm button, #authModeSwitch, #forgotPassword").forEach(el => el.disabled = true);
} else {
  const firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  auth.useDeviceLanguage();
  onAuthStateChanged(auth, user => {
    setGate(Boolean(user));
    if (user) publishUser(user);
  });
}

document.querySelector("#authModeSwitch").addEventListener("click", () => {
  authMode = authMode === "signin" ? "signup" : "signin";
  const signingUp = authMode === "signup";
  document.querySelector("#signupFields").hidden = !signingUp;
  document.querySelector("#signupFirstName").required = signingUp;
  document.querySelector("#signupLastName").required = signingUp;
  document.querySelector("#signupCompany").required = signingUp;
  document.querySelector("#loginPassword").autocomplete = signingUp ? "new-password" : "current-password";
  document.querySelector("#authTitle").textContent = signingUp ? "Create your renter account" : "Sign in to your account";
  document.querySelector("#authSubtitle").textContent = signingUp ? "Set up your business profile and start managing rides." : "Manage your fleet and keep every ride on track.";
  document.querySelector("#authSwitchPrompt").textContent = signingUp ? "Already have an account?" : "New to Joyride?";
  document.querySelector("#authModeSwitch").textContent = signingUp ? "Sign in instead" : "Create an account";
  submitButton.innerHTML = `${signingUp ? "Create account" : "Sign in with email"} <span>→</span>`;
  document.querySelector("#forgotPassword").hidden = signingUp;
  errorBox.hidden = true;
});

document.querySelector("#togglePassword").addEventListener("click", event => {
  const input = document.querySelector("#loginPassword");
  input.type = input.type === "password" ? "text" : "password";
  event.currentTarget.textContent = input.type === "password" ? "Show" : "Hide";
});

document.querySelector("#googleLogin").addEventListener("click", async () => {
  if (!auth) return;
  errorBox.hidden = true;
  try {
    setBusy(true, "Opening Google…");
    await setPersistence(auth, document.querySelector("#rememberMe").checked ? browserLocalPersistence : browserSessionPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    if (window.matchMedia("(max-width: 760px)").matches) await signInWithRedirect(auth, provider);
    else await signInWithPopup(auth, provider);
  } catch (error) { showError(error); setBusy(false); }
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!auth) return;
  errorBox.hidden = true;
  const email = document.querySelector("#loginEmail").value.trim();
  const password = document.querySelector("#loginPassword").value;
  try {
    setBusy(true, authMode === "signup" ? "Creating account…" : "Signing in…");
    await setPersistence(auth, document.querySelector("#rememberMe").checked ? browserLocalPersistence : browserSessionPersistence);
    if (authMode === "signup") {
      const firstName = document.querySelector("#signupFirstName").value.trim();
      const lastName = document.querySelector("#signupLastName").value.trim();
      const company = document.querySelector("#signupCompany").value.trim();
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: `${firstName} ${lastName}`.trim() });
      publishUser(credential.user, { firstName, lastName, company, profileSetup: true });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (error) { showError(error); }
  finally { setBusy(false); }
});

document.querySelector("#forgotPassword").addEventListener("click", async () => {
  const email = document.querySelector("#loginEmail").value.trim();
  if (!email) { showError({ message: "Enter your email address first, then select Forgot password." }); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    errorBox.classList.add("success");
    errorBox.textContent = "Password reset email sent. Check your inbox.";
    errorBox.hidden = false;
  } catch (error) { showError(error); }
});

document.querySelector("#signOutButton").addEventListener("click", async () => {
  if (!auth) return;
  document.querySelector("#accountDialog").close();
  await signOut(auth);
});
