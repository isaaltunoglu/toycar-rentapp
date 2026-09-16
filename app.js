const STORAGE_KEY = "joyride-rental-state-v1";
let activeStorageKey = STORAGE_KEY;

const defaultState = {
  account: { firstName: "Ahmet", lastName: "Kaya", company: "Joyride Park", phone: "", email: "" },
  cars: [
    { id: "sunset", name: "Sunset Racer", color: "Orange", price: 100, status: "available" },
    { id: "blue", name: "Blue Adventure", color: "Blue", price: 120, status: "available" },
    { id: "pearl", name: "Pearl Cruiser", color: "White", price: 100, status: "rented", rental: { duration: 10, startedAt: Date.now(), endsAt: Date.now() + 7 * 60 * 1000, cost: 200 } }
  ],
  history: [],
  notified: []
};

let state = loadState();
let activeFilter = "all";
let searchTerm = "";

const colorMap = {
  Orange: ["#f36b21", "#fff0e7"], Blue: ["#3176d6", "#eaf2fe"], White: ["#a89f93", "#f1eee9"],
  Pink: ["#dc6791", "#fdebf2"], Green: ["#299d74", "#e8f7f2"], Red: ["#dc4d4d", "#fdeaea"]
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(activeStorageKey));
    if (!saved) return structuredClone(defaultState);
    return { ...structuredClone(defaultState), ...saved, account: { ...defaultState.account, ...(saved.account || {}) } };
  }
  catch { return structuredClone(defaultState); }
}

function saveState() { localStorage.setItem(activeStorageKey, JSON.stringify(state)); }
function money(value) { return `₺${Number(value).toLocaleString("tr-TR")}`; }
function statusLabel(status) { return ({ available: "Available", rented: "On a ride", occupied: "Payment due" })[status]; }
function colorStyle(car) { const c = colorMap[car.color] || colorMap.Orange; return `--car-color:${c[0]};--car-soft:${c[1]}`; }
function carIcon() { return `<span class="toy-car-icon" aria-hidden="true">🏎️</span>`; }

function render() {
  renderAccount();
  const total = state.cars.length;
  const available = state.cars.filter(c => c.status === "available").length;
  const rented = state.cars.filter(c => c.status === "rented").length;
  const revenue = state.history.filter(h => h.payment === "paid" && new Date(h.completedAt).toDateString() === new Date().toDateString()).reduce((n, h) => n + h.cost, 0);
  document.querySelector("#statTotal").textContent = total;
  document.querySelector("#statAvailable").textContent = available;
  document.querySelector("#statRented").textContent = rented;
  document.querySelector("#statRevenue").textContent = money(revenue);
  document.querySelector("#fleetCount").textContent = total;
  document.querySelector("#liveBadge").innerHTML = `<i></i> ${rented} live`;
  document.querySelector("#notificationDot").hidden = !state.cars.some(c => c.status === "rented" && c.rental.endsAt <= Date.now());
  renderActive();
  renderFleet();
  renderHistory();
}

function renderAccount() {
  const account = state.account;
  const fullName = `${account.firstName} ${account.lastName}`.trim();
  const initials = `${account.firstName?.[0] || ""}${account.lastName?.[0] || ""}`.toUpperCase() || "JR";
  document.querySelector("#sidebarAccountName").textContent = fullName;
  document.querySelector("#sidebarCompany").textContent = account.company;
  document.querySelector(".profile-card .avatar").textContent = initials;
  document.querySelector("#accountAvatar").textContent = initials;
  document.querySelector("#accountPreviewName").textContent = fullName;
  document.querySelector("#accountPreviewCompany").textContent = account.company;
  const hour = new Date().getHours();
  document.querySelector("#greetingText").textContent = `${hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}, ${account.firstName}`;
}

function renderActive() {
  const rentals = state.cars.filter(c => c.status === "rented");
  const target = document.querySelector("#activeRentals");
  if (!rentals.length) {
    target.innerHTML = `<div class="empty-state"><strong>No active rides right now.</strong><br><small>Your fleet is ready for the next driver.</small></div>`;
    return;
  }
  target.innerHTML = rentals.map(car => {
    const remaining = car.rental.endsAt - Date.now();
    return `<article class="rental-row" style="${colorStyle(car)}">
      <span class="rental-accent"></span><span class="car-swatch">🏎</span>
      <div class="rental-name"><strong>${escapeHtml(car.name)}</strong><span>${escapeHtml(car.color)} · ${car.rental.duration} min ride</span></div>
      <div class="rental-detail"><span>Time remaining</span><strong class="countdown ${remaining <= 0 ? "finished" : ""}" data-ends="${car.rental.endsAt}">${formatTime(remaining)}</strong></div>
      <div class="rental-detail cost"><span>Rental cost</span><strong>${money(car.rental.cost)}</strong></div>
      <button class="end-button" data-end="${car.id}">${remaining <= 0 ? "Resolve" : "End ride"}</button>
    </article>`;
  }).join("");
}

function carCard(car) {
  return `<article class="car-card" style="${colorStyle(car)}">
    <div class="car-visual"><span class="status-pill ${car.status}">${statusLabel(car.status)}</span>${carIcon()}</div>
    <div class="car-body"><div class="car-title"><h3>${escapeHtml(car.name)}</h3><span>${escapeHtml(car.color)}</span></div>
      <p class="car-price"><strong>${money(car.price)}</strong> / 5 minutes</p>
      <button class="rent-button" data-rent="${car.id}" ${car.status !== "available" ? "disabled" : ""}>${car.status === "available" ? "Start a rental" : car.status === "occupied" ? "Payment required" : "Currently riding"}</button>
    </div></article>`;
}

function renderFleet() {
  document.querySelector("#fleetPreview").innerHTML = state.cars.slice(0, 3).map(carCard).join("");
  const visible = state.cars.filter(c => (activeFilter === "all" || c.status === activeFilter) && `${c.name} ${c.color}`.toLowerCase().includes(searchTerm));
  document.querySelector("#fleetList").innerHTML = visible.length ? visible.map(carCard).join("") : `<div class="empty-state">No cars match this search.</div>`;
}

function renderHistory() {
  const active = state.cars.filter(c => c.status === "rented").map(c => ({ id: c.id, carName: c.name, duration: c.rental.duration, cost: c.rental.cost, payment: "active", completedAt: c.rental.startedAt }));
  const rows = [...active, ...state.history].sort((a,b) => b.completedAt - a.completedAt);
  document.querySelector("#historyList").innerHTML = rows.length ? rows.map(item => `<article class="history-item">
    <span class="car-swatch" style="--car-color:#f36b21;--car-soft:#fff0e7">🏎</span>
    <div><strong>${escapeHtml(item.carName)}</strong><small>${new Date(item.completedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></div>
    <div class="history-meta"><strong>${item.duration} minutes</strong><small>Ride duration</small></div>
    <div class="history-meta"><strong>${money(item.cost)}</strong><small>Rental total</small></div>
    <span class="history-status ${item.payment}">${item.payment}</span>
  </article>`).join("") : `<div class="empty-state">Completed rentals will appear here.</div>`;
}

function openRent(id) {
  const car = state.cars.find(c => c.id === id);
  if (!car || car.status !== "available") return;
  document.querySelector("#rentCarId").value = id;
  document.querySelector("#rentCarName").textContent = car.name;
  document.querySelector('input[name="duration"][value="5"]').checked = true;
  document.querySelector("#customTimeWrap").classList.add("hidden");
  updateRentPrice();
  document.querySelector("#rentDialog").showModal();
}

function updateRentPrice() {
  const car = state.cars.find(c => c.id === document.querySelector("#rentCarId").value);
  if (!car) return;
  const selected = document.querySelector('input[name="duration"]:checked').value;
  const minutes = selected === "custom" ? Math.max(1, Number(document.querySelector("#customMinutes").value) || 1) : Number(selected);
  document.querySelector("#rentPrice").textContent = money(Math.ceil(minutes / 5) * car.price);
}

function startRental(event) {
  event.preventDefault();
  const id = document.querySelector("#rentCarId").value;
  const car = state.cars.find(c => c.id === id);
  const selected = document.querySelector('input[name="duration"]:checked').value;
  const duration = selected === "custom" ? Math.max(1, Number(document.querySelector("#customMinutes").value) || 1) : Number(selected);
  if (!car) return;
  car.status = "rented";
  car.rental = { duration, startedAt: Date.now(), endsAt: Date.now() + duration * 60000, cost: Math.ceil(duration / 5) * car.price };
  state.notified = state.notified.filter(item => item !== car.id);
  saveState(); render();
  document.querySelector("#rentDialog").close();
  showToast("Rental started", `${car.name} is out for ${duration} minutes.`);
  switchView("dashboard");
}

function openResolve(id) {
  const car = state.cars.find(c => c.id === id);
  if (!car) return;
  document.querySelector("#resolveCarId").value = id;
  document.querySelector("#resolveCarName").textContent = car.name;
  document.querySelector("#resolveDialog").showModal();
}

function resolveRental(payment) {
  const car = state.cars.find(c => c.id === document.querySelector("#resolveCarId").value);
  if (!car || !car.rental) return;
  state.history.unshift({ id: `${car.id}-${Date.now()}`, carName: car.name, duration: car.rental.duration, cost: car.rental.cost, payment, completedAt: Date.now() });
  car.status = payment === "paid" ? "available" : "occupied";
  delete car.rental;
  saveState(); render();
  document.querySelector("#resolveDialog").close();
  showToast(payment === "paid" ? "Payment collected" : "Car marked unpaid", payment === "paid" ? `${car.name} is ready to rent again.` : `${car.name} will remain unavailable.` , payment !== "paid");
}

function addCar(event) {
  event.preventDefault();
  const name = document.querySelector("#newCarName").value.trim();
  const color = document.querySelector("#newCarColor").value;
  const price = Math.max(1, Number(document.querySelector("#newCarPrice").value));
  if (!name) return;
  state.cars.push({ id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`, name, color, price, status: "available" });
  saveState(); render(); event.target.reset(); document.querySelector("#addCarDialog").close();
  showToast("Car added", `${name} is now available in your fleet.`);
  switchView("fleet");
}

function openAccount() {
  const account = state.account;
  document.querySelector("#accountFirstName").value = account.firstName;
  document.querySelector("#accountLastName").value = account.lastName;
  document.querySelector("#accountCompany").value = account.company;
  document.querySelector("#accountPhone").value = account.phone;
  document.querySelector("#accountEmail").value = account.email;
  document.querySelector("#accountDialog").showModal();
}

function saveAccount(event) {
  event.preventDefault();
  state.account = {
    firstName: document.querySelector("#accountFirstName").value.trim(),
    lastName: document.querySelector("#accountLastName").value.trim(),
    company: document.querySelector("#accountCompany").value.trim(),
    phone: document.querySelector("#accountPhone").value.trim(),
    email: document.querySelector("#accountEmail").value.trim()
  };
  saveState(); render(); document.querySelector("#accountDialog").close();
  showToast("Account saved", `${state.account.firstName}'s renter profile has been updated.`);
}

function switchView(view) {
  document.querySelectorAll(".view").forEach(el => el.classList.toggle("active-view", el.id === `${view}View`));
  document.querySelectorAll("[data-view]").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatTime(ms) {
  if (ms <= 0) return "Finished";
  const seconds = Math.ceil(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`;
}

function updateTimers() {
  document.querySelectorAll("[data-ends]").forEach(el => {
    const remaining = Number(el.dataset.ends) - Date.now();
    el.textContent = formatTime(remaining);
    el.classList.toggle("finished", remaining <= 0);
  });
  state.cars.filter(c => c.status === "rented" && c.rental.endsAt <= Date.now() && !state.notified.includes(c.id)).forEach(car => {
    state.notified.push(car.id); saveState(); showToast("Ride time is over", `${car.name} is waiting for payment confirmation.`);
    if ("Notification" in window && Notification.permission === "granted") new Notification("Ride time is over", { body: `${car.name} is waiting for payment confirmation.` });
  });
  document.querySelector("#notificationDot").hidden = !state.cars.some(c => c.status === "rented" && c.rental.endsAt <= Date.now());
}

function showToast(title, message, error = false) {
  const el = document.createElement("div"); el.className = `toast${error ? " error" : ""}`; el.innerHTML = `<strong>${escapeHtml(title)}</strong>${escapeHtml(message)}`;
  document.querySelector("#toastRegion").append(el); setTimeout(() => el.remove(), 4300);
}

function escapeHtml(value) { const d = document.createElement("div"); d.textContent = value; return d.innerHTML; }

document.addEventListener("click", event => {
  const rent = event.target.closest("[data-rent]"); if (rent) openRent(rent.dataset.rent);
  const end = event.target.closest("[data-end]"); if (end) openResolve(end.dataset.end);
  const view = event.target.closest("[data-view]"); if (view) switchView(view.dataset.view);
  if (event.target.closest("[data-go-fleet]") || event.target.closest("#heroViewFleet")) switchView("fleet");
});
document.querySelectorAll("#openAddCar, #openAddCarFleet, #mobileAdd").forEach(btn => btn.addEventListener("click", () => document.querySelector("#addCarDialog").showModal()));
document.querySelector("#rentForm").addEventListener("submit", startRental);
document.querySelector("#addCarForm").addEventListener("submit", addCar);
document.querySelector("#accountForm").addEventListener("submit", saveAccount);
document.querySelector("#markPaid").addEventListener("click", () => resolveRental("paid"));
document.querySelector("#markUnpaid").addEventListener("click", () => resolveRental("unpaid"));
document.querySelectorAll('input[name="duration"]').forEach(input => input.addEventListener("change", () => { document.querySelector("#customTimeWrap").classList.toggle("hidden", input.value !== "custom" || !input.checked); updateRentPrice(); }));
document.querySelector("#customMinutes").addEventListener("input", updateRentPrice);
document.querySelector("#carSearch").addEventListener("input", event => { searchTerm = event.target.value.toLowerCase(); renderFleet(); });
document.querySelector("#filterPills").addEventListener("click", event => { const button = event.target.closest("[data-filter]"); if (!button) return; activeFilter = button.dataset.filter; document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b === button)); renderFleet(); });
document.querySelector("#notificationButton").addEventListener("click", async () => {
  const finished = state.cars.find(c => c.status === "rented" && c.rental.endsAt <= Date.now());
  if (finished) return openResolve(finished.id);
  if ("Notification" in window && Notification.permission === "default") { const result = await Notification.requestPermission(); showToast("Notifications", result === "granted" ? "Ride alerts are enabled." : "Browser alerts were not enabled."); }
  else showToast("All caught up", "There are no rental alerts right now.");
});
document.querySelectorAll("#profileButton, #mobileProfile, [data-open-account]").forEach(button => button.addEventListener("click", openAccount));
document.querySelectorAll("dialog").forEach(dialog => dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); }));

window.addEventListener("joyride-auth-user", event => {
  const user = event.detail;
  activeStorageKey = `${STORAGE_KEY}-${user.uid}`;
  const hasSavedAccount = Boolean(localStorage.getItem(activeStorageKey));
  state = loadState();
  if (!hasSavedAccount || user.profileSetup) {
    state.account = {
      ...state.account,
      firstName: user.firstName || state.account.firstName,
      lastName: user.lastName || state.account.lastName,
      company: user.company || state.account.company,
      email: user.email || state.account.email,
      authUid: user.uid
    };
  } else {
    state.account.email = user.email || state.account.email;
    state.account.authUid = user.uid;
  }
  saveState();
  render();
});

render();
setInterval(updateTimers, 1000);
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
