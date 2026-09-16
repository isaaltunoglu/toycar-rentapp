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
import { doc, getDoc, getFirestore, setDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const gate = document.querySelector("#authGate");
const form = document.querySelector("#emailAuthForm");
const errorBox = document.querySelector("#authError");
const submitButton = document.querySelector("#emailAuthSubmit");
let authMode = "signin";
let auth;
let database;
let activeUid = null;
let writeQueue = Promise.resolve();
let creatingAccount = false;

const isConfigured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_") && firebaseConfig.projectId && !firebaseConfig.projectId.startsWith("YOUR_");

function setGate(signedIn) {
  document.body.classList.remove("auth-pending");
  document.body.classList.toggle("signed-out", !signedIn);
  gate.hidden = signedIn;
}

function setBusy(busy, label = "Lütfen bekleyin…") {
  document.querySelectorAll("#googleLogin, #emailAuthForm input, #emailAuthForm button").forEach(el => el.disabled = busy);
  if (busy) { submitButton.dataset.label = submitButton.innerHTML; submitButton.textContent = label; }
  else if (submitButton.dataset.label) { submitButton.innerHTML = submitButton.dataset.label; delete submitButton.dataset.label; }
}

function showError(error) {
  const messages = {
    "auth/invalid-credential": "E-posta veya şifre hatalı.",
    "auth/email-already-in-use": "Bu e-posta adresiyle kayıtlı bir hesap var.",
    "auth/weak-password": "En az 6 karakterli daha güçlü bir şifre seçin.",
    "auth/invalid-email": "Geçerli bir e-posta adresi girin.",
    "auth/popup-closed-by-user": "Google giriş penceresi tamamlanmadan kapatıldı.",
    "auth/popup-blocked": "Tarayıcınız Google giriş penceresini engelledi. Açılır pencerelere izin verip tekrar deneyin.",
    "auth/network-request-failed": "İnternet bağlantınızı kontrol edip tekrar deneyin.",
    "auth/too-many-requests": "Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.",
    "auth/unauthorized-domain": "Bu alan adı Firebase Authentication izin verilen alan adlarına eklenmeli."
  };
  errorBox.classList.remove("success");
  errorBox.textContent = messages[error?.code] || "Giriş yapılamadı. Lütfen tekrar deneyin.";
  errorBox.hidden = false;
}

function publishUser(user, extra = {}) {
  const names = (user.displayName || "").trim().split(/\s+/);
  window.dispatchEvent(new CustomEvent("joyride-auth-user", { detail: {
    uid: user.uid,
    email: user.email || "",
    firstName: extra.firstName || names[0] || user.email?.split("@")[0] || "Kullanıcı",
    lastName: extra.lastName || names.slice(1).join(" "),
    company: extra.company || "",
    profileSetup: Boolean(extra.profileSetup)
  }}));
}

async function loadCompany(user, profile = {}) {
  activeUid = user.uid;
  publishUser(user, profile);
  const companyRef = doc(database, "companies", user.uid);
  try {
    const snapshot = await getDoc(companyRef);
    if (activeUid !== user.uid) return;
    if (snapshot.exists()) {
      window.dispatchEvent(new CustomEvent("joyride-cloud-state", { detail: { uid: user.uid, state: snapshot.data().state } }));
    } else {
      const state = window.joyrideGetState();
      await setDoc(companyRef, { name: state.account.company, state });
    }
    setGate(true);
  } catch (error) {
    setGate(true);
    window.dispatchEvent(new CustomEvent("joyride-sync-error", { detail: error }));
  }
}

if (!isConfigured) {
  document.querySelector("#firebaseSetupNotice").hidden = false;
  if (document.body.dataset.demo !== "true") setGate(false);
  document.querySelectorAll("#googleLogin, #emailAuthForm input, #emailAuthForm button, #authModeSwitch, #forgotPassword").forEach(el => el.disabled = true);
} else {
  const firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  database = getFirestore(firebaseApp);
  auth.languageCode = "tr";
  onAuthStateChanged(auth, async user => {
    if (document.body.dataset.demo === "true") return;
    activeUid = user?.uid || null;
    if (!user) { setGate(false); return; }
    if (!creatingAccount) await loadCompany(user);
  });
}

window.addEventListener("joyride-state-changed", event => {
  const { uid, state } = event.detail;
  if (!database || uid !== activeUid) return;
  writeQueue = writeQueue.catch(() => {}).then(() => setDoc(doc(database, "companies", uid), { name: state.account.company, state }));
  writeQueue.catch(error => window.dispatchEvent(new CustomEvent("joyride-sync-error", { detail: error })));
});

document.querySelector("#authModeSwitch").addEventListener("click", () => {
  authMode = authMode === "signin" ? "signup" : "signin";
  const signingUp = authMode === "signup";
  document.querySelector("#signupFields").hidden = !signingUp;
  document.querySelector("#signupFirstName").required = signingUp;
  document.querySelector("#signupLastName").required = signingUp;
  document.querySelector("#signupCompany").required = signingUp;
  document.querySelector("#loginPassword").autocomplete = signingUp ? "new-password" : "current-password";
  document.querySelector("#authTitle").textContent = signingUp ? "İşletme hesabı oluşturun" : "Hesabınıza giriş yapın";
  document.querySelector("#authSubtitle").textContent = signingUp ? "İşletme profilinizi oluşturup sürüşleri yönetmeye başlayın." : "Filonuzu ve tüm sürüşleri kolayca yönetin.";
  document.querySelector("#authSwitchPrompt").textContent = signingUp ? "Zaten hesabınız var mı?" : "Joyride'a yeni misiniz?";
  document.querySelector("#authModeSwitch").textContent = signingUp ? "Giriş yap" : "Hesap oluştur";
  submitButton.innerHTML = `${signingUp ? "Hesap oluştur" : "E-posta ile giriş yap"} <span>→</span>`;
  document.querySelector("#forgotPassword").hidden = signingUp;
  errorBox.hidden = true;
});

document.querySelector("#togglePassword").addEventListener("click", event => {
  const input = document.querySelector("#loginPassword");
  input.type = input.type === "password" ? "text" : "password";
  event.currentTarget.textContent = input.type === "password" ? "Göster" : "Gizle";
  event.currentTarget.setAttribute("aria-label", input.type === "password" ? "Şifreyi göster" : "Şifreyi gizle");
});

document.querySelector("#googleLogin").addEventListener("click", async () => {
  if (!auth) return;
  errorBox.hidden = true;
  try {
    setBusy(true, "Google açılıyor…");
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
    setBusy(true, authMode === "signup" ? "Hesap oluşturuluyor…" : "Giriş yapılıyor…");
    await setPersistence(auth, document.querySelector("#rememberMe").checked ? browserLocalPersistence : browserSessionPersistence);
    if (authMode === "signup") {
      creatingAccount = true;
      const firstName = document.querySelector("#signupFirstName").value.trim();
      const lastName = document.querySelector("#signupLastName").value.trim();
      const company = document.querySelector("#signupCompany").value.trim();
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: `${firstName} ${lastName}`.trim() });
      await loadCompany(credential.user, { firstName, lastName, company, profileSetup: true });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (error) { showError(error); }
  finally { creatingAccount = false; setBusy(false); }
});

document.querySelector("#forgotPassword").addEventListener("click", async () => {
  const email = document.querySelector("#loginEmail").value.trim();
  if (!email) { errorBox.classList.remove("success"); errorBox.textContent = "Önce e-posta adresinizi girin."; errorBox.hidden = false; return; }
  try {
    await sendPasswordResetEmail(auth, email);
    errorBox.classList.add("success");
    errorBox.textContent = "Şifre sıfırlama e-postası gönderildi. Gelen kutunuzu kontrol edin.";
    errorBox.hidden = false;
  } catch (error) { showError(error); }
});

document.querySelector("#signOutButton").addEventListener("click", async () => {
  if (!auth) return;
  document.querySelector("#accountDialog").close();
  await signOut(auth);
});
