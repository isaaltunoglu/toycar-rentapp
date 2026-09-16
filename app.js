const STORAGE_KEY = "joyride-rental-state-v1";
let activeStorageKey = STORAGE_KEY;

const defaultState = {
  account: { firstName: "Ahmet", lastName: "Kaya", company: "Joyride Park", phone: "", email: "" },
  cars: [],
  history: [],
  notified: []
};

const DEMO_STORAGE_KEY = `${STORAGE_KEY}-demo`;
function makeDemoState() {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const mondayPaidAt = Math.min(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 9).getTime(), Date.now());
  const previousMonthPaidAt = new Date(now.getFullYear(), now.getMonth() - 1, 12, 14).getTime();
  const previousYearPaidAt = new Date(now.getFullYear() - 1, 8, 12, 14).getTime();
  const paidRide = (id, carName, cost, paidAt) => ({ id, carName, duration: 5, cost, payment: "paid", completedAt: paidAt, paidAt });
  return {
    account: { firstName: "Demo", lastName: "Yönetici", company: "Örnek Joyride", phone: "", email: "" },
    cars: [
      { id: "demo-sunset", name: "Turuncu Yarışçı", color: "Orange", price: 100, status: "available" },
      { id: "demo-blue", name: "Mavi Macera", color: "Blue", price: 120, status: "occupied" },
      { id: "demo-pearl", name: "İnci Gezgin", color: "White", price: 100, status: "rented", rental: { duration: 10, startedAt: Date.now(), endsAt: Date.now() + 7 * 60000, cost: 200 } }
    ],
    history: [
      { id: "demo-blue-unpaid", carName: "Mavi Macera", duration: 5, cost: 120, payment: "unpaid", completedAt: Date.now() },
      paidRide("demo-sunset-paid-today", "Turuncu Yarışçı", 100, Date.now()),
      paidRide("demo-sunset-paid-monday-1", "Turuncu Yarışçı", 140, mondayPaidAt),
      paidRide("demo-sunset-paid-monday-2", "Turuncu Yarışçı", 120, mondayPaidAt),
      paidRide("demo-pearl-paid-monday", "İnci Gezgin", 100, mondayPaidAt),
      paidRide("demo-previous-month", "Turuncu Yarışçı", 250, previousMonthPaidAt),
      paidRide("demo-previous-year", "Mavi Macera", 480, previousYearPaidAt)
    ],
    notified: []
  };
}

let state = loadState();
let activeFilter = "all";
let searchTerm = "";
let lastRenderedDay = new Date().toDateString();
let analysisYear = new Date().getFullYear();

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

function saveState() {
  localStorage.setItem(activeStorageKey, JSON.stringify(state));
  if (state.account.authUid) window.dispatchEvent(new CustomEvent("joyride-state-changed", { detail: { uid: state.account.authUid, state: structuredClone(state) } }));
}
function money(value) { return `₺${Number(value).toLocaleString("tr-TR")}`; }
function statusLabel(status) { return ({ available: "Müsait", rented: "Sürüşte", occupied: "Ödeme bekleniyor" })[status]; }
function paymentLabel(payment) { return ({ active: "Sürüşte", paid: "Ödendi", unpaid: "Ödenmedi" })[payment] || payment; }
function colorLabel(color) { return ({ Orange: "Turuncu", Blue: "Mavi", White: "Beyaz", Pink: "Pembe", Green: "Yeşil", Red: "Kırmızı" })[color] || color; }
function colorStyle(car) { const c = colorMap[car.color] || colorMap.Orange; return `--car-color:${c[0]};--car-soft:${c[1]}`; }
function carIcon() { return `<svg class="toy-car-icon" viewBox="0 0 96 56" fill="none" aria-hidden="true"><path d="M9 35h78v11H9zM15 35l7-15c1-3 4-5 7-5h38c3 0 6 2 7 5l7 15M27 15l7-9h28l7 9M32 35l4-14h24l4 14"/><circle cx="26" cy="46" r="7"/><circle cx="70" cy="46" r="7"/><path d="M3 35h6m78 0h6"/></svg>`; }

function render() {
  renderAccount();
  const total = state.cars.length;
  const available = state.cars.filter(c => c.status === "available").length;
  const rented = state.cars.filter(c => c.status === "rented").length;
  const revenue = state.history.filter(h => h.payment === "paid" && new Date(h.paidAt || h.completedAt).toDateString() === new Date().toDateString()).reduce((n, h) => n + h.cost, 0);
  document.querySelector("#statTotal").textContent = total;
  document.querySelector("#statAvailable").textContent = available;
  document.querySelector("#statRented").textContent = rented;
  document.querySelector("#statRevenue").textContent = money(revenue);
  document.querySelector("#fleetCount").textContent = total;
  document.querySelector("#liveBadge").innerHTML = `<i></i> ${rented} aktif`;
  document.querySelector("#notificationDot").hidden = !state.cars.some(c => c.status === "rented" && c.rental.endsAt <= Date.now());
  document.querySelector("#todayDate").textContent = new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
  renderActive();
  renderFleet();
  renderHistory();
  renderAnalysis();
  renderSettings();
}

function renderAnalysis() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const days = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
  const shortDays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
  const totals = Array(7).fill(0);
  const counts = Array(7).fill(0);
  const annual = new Map();
  let todayTotal = 0;
  let monthTotal = 0;

  state.history.filter(item => item.payment === "paid").forEach(item => {
    const paidAt = new Date(item.paidAt || item.completedAt);
    const amount = Number(item.cost);
    if (Number.isNaN(paidAt.getTime()) || !Number.isFinite(amount) || paidAt > now) return;
    const year = paidAt.getFullYear();
    if (!annual.has(year)) annual.set(year, { total: 0, rides: 0, months: Array.from({ length: 12 }, () => ({ total: 0, rides: 0 })) });
    const yearData = annual.get(year);
    yearData.total += amount;
    yearData.rides += 1;
    yearData.months[paidAt.getMonth()].total += amount;
    yearData.months[paidAt.getMonth()].rides += 1;
    if (paidAt >= todayStart && paidAt <= now) todayTotal += amount;
    if (paidAt >= monthStart && paidAt <= now) monthTotal += amount;
    if (paidAt >= weekStart && paidAt < weekEnd && paidAt <= now) {
      const index = (paidAt.getDay() + 6) % 7;
      totals[index] += amount;
      counts[index] += 1;
    }
  });

  const weekTotal = totals.reduce((sum, value) => sum + value, 0);
  const rideCount = counts.reduce((sum, value) => sum + value, 0);
  const peak = Math.max(...totals);
  const peakDays = days.filter((_, index) => totals[index] === peak && peak > 0);
  const maxBar = Math.max(peak, 1);
  document.querySelector("#analysisToday").textContent = money(todayTotal);
  document.querySelector("#analysisMonth").textContent = money(monthTotal);
  document.querySelector("#analysisTodayDate").textContent = now.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  document.querySelector("#analysisMonthDate").textContent = now.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
  const lastDay = new Date(weekEnd);
  lastDay.setDate(lastDay.getDate() - 1);
  document.querySelector("#analysisWeekRange").textContent = `${weekStart.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} – ${lastDay.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}`;
  document.querySelector("#analysisWeekTotal").textContent = `Bu hafta ${money(weekTotal)}`;
  document.querySelector("#analysisRideCount").textContent = `Bu hafta ${rideCount} ücretli sürüş`;
  document.querySelector("#analysisChart").setAttribute("aria-label", days.map((day, index) => `${day}: ${counts[index]} ücretli sürüşten ${money(totals[index])}`).join("; "));
  document.querySelector("#analysisChart").innerHTML = days.map((day, index) => `<div class="analysis-day${totals[index] === peak && peak > 0 ? " peak" : ""}" title="${day}: ${counts[index]} ücretli sürüşten ${money(totals[index])}">
    <strong>${money(totals[index])}</strong><div class="analysis-bar-track"><span class="analysis-bar-fill" style="height:${totals[index] ? Math.max(7, totals[index] / maxBar * 100) : 0}%"></span></div><span>${shortDays[index]}</span>
  </div>`).join("");

  if (!rideCount) {
    document.querySelector("#analysisPeakDay").textContent = "Henüz ücretli sürüş yok";
    document.querySelector("#analysisInsightText").textContent = "Bir sürüş ödendiğinde ilgili gün grafikte görünecek.";
  } else if (peakDays.length === 1) {
    const index = days.indexOf(peakDays[0]);
    document.querySelector("#analysisPeakDay").textContent = `Bu hafta en yüksek gün: ${peakDays[0]}`;
    document.querySelector("#analysisInsightText").textContent = `${peakDays[0]} günü ${counts[index]} ücretli sürüşten ${money(peak)} tahsil edildi. Bu, haftanın en yüksek günlük toplamı.`;
  } else {
    document.querySelector("#analysisPeakDay").textContent = "En yüksek günlük tutar eşit";
    document.querySelector("#analysisInsightText").textContent = `${peakDays.join(" ve ")} günlerinde ${money(peak)} tahsil edildi; bu günler haftanın en yüksek toplamını paylaşıyor.`;
  }

  const years = [...new Set([now.getFullYear(), ...annual.keys()])].sort((a, b) => b - a);
  if (!years.includes(analysisYear)) analysisYear = now.getFullYear();
  const yearSelect = document.querySelector("#analysisYearSelect");
  yearSelect.innerHTML = years.map(year => `<option value="${year}">${year}</option>`).join("");
  yearSelect.value = String(analysisYear);
  const selectedYear = annual.get(analysisYear) || { total: 0, rides: 0, months: Array.from({ length: 12 }, () => ({ total: 0, rides: 0 })) };
  document.querySelector("#analysisSelectedYearTotal").textContent = money(selectedYear.total);
  document.querySelector("#analysisSelectedYearRides").textContent = `${selectedYear.rides} ücretli sürüş`;
  const maxMonth = Math.max(1, ...selectedYear.months.map(month => month.total));
  document.querySelector("#analysisMonthRows").innerHTML = selectedYear.months.map((month, index) => {
    const name = new Date(analysisYear, index, 1).toLocaleDateString("tr-TR", { month: "long" });
    const label = name[0].toLocaleUpperCase("tr-TR") + name.slice(1);
    return `<div class="analysis-period-row${month.total === maxMonth && month.total > 0 ? " highlight" : ""}">
      <strong>${label}</strong><span class="analysis-period-track"><span class="analysis-period-fill" style="width:${month.total / maxMonth * 100}%"></span></span>
      <span class="analysis-period-meta"><strong>${money(month.total)}</strong><small>${month.rides} sürüş</small></span>
    </div>`;
  }).join("");
  const maxAnnual = Math.max(1, ...years.map(year => annual.get(year)?.total || 0));
  document.querySelector("#analysisYearRows").innerHTML = years.map(year => {
    const data = annual.get(year) || { total: 0, rides: 0 };
    return `<div class="analysis-period-row${data.total === maxAnnual && data.total > 0 ? " highlight" : ""}">
      <strong>${year}</strong><span class="analysis-period-track"><span class="analysis-period-fill" style="width:${data.total / maxAnnual * 100}%"></span></span>
      <span class="analysis-period-meta"><strong>${money(data.total)}</strong><small>${data.rides} sürüş</small></span>
    </div>`;
  }).join("");
}

function renderSettings() {
  const target = document.querySelector("#settingsCarList");
  target.innerHTML = state.cars.length ? state.cars.map(car => `<article class="settings-car" style="${colorStyle(car)}">
    <span class="car-swatch" aria-hidden="true">${carIcon()}</span>
    <div class="settings-car-info"><strong>${escapeHtml(car.name)}</strong><small>${escapeHtml(colorLabel(car.color))} · ${money(car.price)} / 5 dk · ${statusLabel(car.status)}</small></div>
    ${car.status === "occupied" ? `<label class="payment-control compact"><span>Ödenmedi</span><span class="payment-switch"><input type="checkbox" data-clear-payment="${escapeHtml(car.id)}" aria-label="${escapeHtml(car.name)} için ödendi olarak işaretle" /><span class="payment-track"></span></span><strong>Ödendi</strong></label>` : ""}
    <button class="secondary-button" data-edit-car="${escapeHtml(car.id)}">Düzenle</button>
    <button class="danger-button settings-remove" data-remove-car="${escapeHtml(car.id)}">Kaldır</button>
  </article>`).join("") : `<div class="empty-state">Henüz araba yok. İşletme filosuna ilk arabanızı ekleyin.</div>`;
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
  document.querySelector("#greetingText").textContent = `${hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar"}, ${account.firstName}`;
}

function renderActive() {
  const rentals = state.cars.filter(c => c.status === "rented");
  const target = document.querySelector("#activeRentals");
  if (!rentals.length) {
    target.innerHTML = `<div class="empty-state"><strong>Şu anda aktif sürüş yok.</strong><br><small>Filonuz yeni sürüşe hazır.</small></div>`;
    return;
  }
  target.innerHTML = rentals.map(car => {
    const remaining = car.rental.endsAt - Date.now();
    return `<article class="rental-row" style="${colorStyle(car)}">
      <span class="rental-accent"></span><span class="car-swatch">${carIcon()}</span>
      <div class="rental-name"><strong>${escapeHtml(car.name)}</strong><span>${escapeHtml(colorLabel(car.color))} · ${car.rental.duration} dk sürüş</span></div>
      <div class="rental-detail"><span>Kalan süre</span><strong class="countdown ${remaining <= 0 ? "finished" : ""}" data-ends="${car.rental.endsAt}">${formatTime(remaining)}</strong></div>
      <div class="rental-detail cost"><span>Sürüş tutarı</span><strong>${money(car.rental.cost)}</strong></div>
      <button class="end-button" data-end="${car.id}">${remaining <= 0 ? "Ödemeyi kaydet" : "Sürüşü bitir"}</button>
    </article>`;
  }).join("");
}

function carCard(car) {
  return `<article class="car-card" style="${colorStyle(car)}">
    <div class="car-visual"><span class="status-pill ${car.status}">${statusLabel(car.status)}</span>${carIcon()}</div>
    <div class="car-body"><div class="car-title"><h3>${escapeHtml(car.name)}</h3><span>${escapeHtml(colorLabel(car.color))}</span></div>
      <p class="car-price"><strong>${money(car.price)}</strong> / 5 dakika</p>
      <button class="rent-button" data-rent="${car.id}" ${car.status !== "available" ? "disabled" : ""}>${car.status === "available" ? "Sürüş başlat" : car.status === "occupied" ? "Ödeme bekleniyor" : "Sürüşte"}</button>
    </div></article>`;
}

function renderFleet() {
  document.querySelector("#fleetPreview").innerHTML = state.cars.slice(0, 3).map(carCard).join("");
  const visible = state.cars.filter(c => (activeFilter === "all" || c.status === activeFilter) && `${c.name} ${c.color} ${colorLabel(c.color)}`.toLocaleLowerCase("tr-TR").includes(searchTerm));
  document.querySelector("#fleetList").innerHTML = visible.length ? visible.map(carCard).join("") : `<div class="empty-state">Aramanıza uygun araba bulunamadı.</div>`;
}

function renderHistory() {
  const active = state.cars.filter(c => c.status === "rented").map(c => ({ id: c.id, carName: c.name, duration: c.rental.duration, cost: c.rental.cost, payment: "active", completedAt: c.rental.startedAt }));
  const rows = [...active, ...state.history].sort((a,b) => b.completedAt - a.completedAt);
  document.querySelector("#historyList").innerHTML = rows.length ? rows.map(item => `<article class="history-item">
    <span class="car-swatch" style="--car-color:#f36b21;--car-soft:#fff0e7">${carIcon()}</span>
    <div><strong>${escapeHtml(item.carName)}</strong><small>${new Date(item.completedAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></div>
    <div class="history-meta"><strong>${item.duration} dakika</strong><small>Sürüş süresi</small></div>
    <div class="history-meta"><strong>${money(item.cost)}</strong><small>Sürüş tutarı</small></div>
    <span class="history-status ${item.payment}">${paymentLabel(item.payment)}</span>
  </article>`).join("") : `<div class="empty-state">Tamamlanan sürüşler burada görünecek.</div>`;
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
  showToast("Sürüş başladı", `${car.name} için ${duration} dakikalık sürüş başladı.`);
  switchView("dashboard");
}

function openResolve(id) {
  const car = state.cars.find(c => c.id === id);
  if (!car) return;
  document.querySelector("#resolveCarId").value = id;
  document.querySelector("#resolveCarName").textContent = car.name;
  document.querySelector("#resolvePayment").checked = false;
  document.querySelector("#resolvePaymentLabel").textContent = "Ödenmedi";
  document.querySelector("#resolveDialog").showModal();
}

function resolveRental(payment) {
  const car = state.cars.find(c => c.id === document.querySelector("#resolveCarId").value);
  if (!car || !car.rental) return;
  state.history.unshift({ id: `${car.id}-${Date.now()}`, carName: car.name, duration: car.rental.duration, cost: car.rental.cost, payment, completedAt: Date.now(), ...(payment === "paid" ? { paidAt: Date.now() } : {}) });
  car.status = payment === "paid" ? "available" : "occupied";
  delete car.rental;
  saveState(); render();
  document.querySelector("#resolveDialog").close();
  showToast(payment === "paid" ? "Ödeme alındı" : "Ödeme bekleniyor", payment === "paid" ? `${car.name} yeniden kiralanabilir.` : `${car.name} ödeme alınana kadar müsait değil.`, payment !== "paid");
}

function addCar(event) {
  event.preventDefault();
  const name = document.querySelector("#newCarName").value.trim();
  const color = document.querySelector("#newCarColor").value;
  const price = Math.max(1, Number(document.querySelector("#newCarPrice").value));
  if (!name) return;
  state.cars.push({ id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`, name, color, price, status: "available" });
  saveState(); render(); event.target.reset(); document.querySelector("#addCarDialog").close();
  showToast("Araba eklendi", `${name} artık filonuzda kiralanabilir.`);
  switchView("fleet");
}

function openEditCar(id) {
  const car = state.cars.find(c => c.id === id);
  if (!car) return;
  document.querySelector("#editCarId").value = id;
  document.querySelector("#editCarName").value = car.name;
  document.querySelector("#editCarColor").value = car.color;
  document.querySelector("#editCarPrice").value = car.price;
  document.querySelector("#editCarDialog").showModal();
}

function saveCarEdit(event) {
  event.preventDefault();
  const car = state.cars.find(c => c.id === document.querySelector("#editCarId").value);
  if (!car) return;
  car.name = document.querySelector("#editCarName").value.trim();
  car.color = document.querySelector("#editCarColor").value;
  car.price = Number(document.querySelector("#editCarPrice").value);
  if (!car.name || !Number.isFinite(car.price) || car.price < 1) return;
  saveState(); render(); document.querySelector("#editCarDialog").close();
  showToast("Araba kaydedildi", `${car.name} güncellendi.`);
}

function removeCar(id) {
  const car = state.cars.find(c => c.id === id);
  if (!car) return;
  if (car.status === "rented") { showToast("Önce sürüşü bitirin", "Arabayı kaldırmadan önce aktif sürüşünü tamamlayın.", true); return; }
  if (!window.confirm(`${car.name} işletme filosundan kaldırılsın mı?`)) return;
  state.cars = state.cars.filter(c => c.id !== id);
  state.notified = state.notified.filter(item => item !== id);
  saveState(); render(); showToast("Araba kaldırıldı", `${car.name} filodan kaldırıldı.`);
}

function markCarPaid(id) {
  const car = state.cars.find(c => c.id === id);
  if (!car || car.status !== "occupied") return;
  car.status = "available";
  const unpaid = state.history.find(item => item.id.startsWith(`${id}-`) && item.payment === "unpaid");
  if (unpaid) { unpaid.payment = "paid"; unpaid.paidAt = Date.now(); }
  saveState(); render(); showToast("Ödeme alındı", `${car.name} yeniden kiralanabilir.`);
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
    ...state.account,
    firstName: document.querySelector("#accountFirstName").value.trim(),
    lastName: document.querySelector("#accountLastName").value.trim(),
    company: document.querySelector("#accountCompany").value.trim(),
    phone: document.querySelector("#accountPhone").value.trim(),
    email: document.querySelector("#accountEmail").value.trim()
  };
  saveState(); render(); document.querySelector("#accountDialog").close();
  showToast("Hesap kaydedildi", `${state.account.firstName} için işletme profili güncellendi.`);
}

function switchView(view) {
  document.querySelectorAll(".view").forEach(el => el.classList.toggle("active-view", el.id === `${view}View`));
  document.querySelectorAll("[data-view]").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatTime(ms) {
  if (ms <= 0) return "Süre bitti";
  const seconds = Math.ceil(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`;
}

function updateTimers() {
  if (new Date().toDateString() !== lastRenderedDay) { lastRenderedDay = new Date().toDateString(); render(); }
  document.querySelectorAll("[data-ends]").forEach(el => {
    const remaining = Number(el.dataset.ends) - Date.now();
    el.textContent = formatTime(remaining);
    el.classList.toggle("finished", remaining <= 0);
  });
  state.cars.filter(c => c.status === "rented" && c.rental.endsAt <= Date.now() && !state.notified.includes(c.id)).forEach(car => {
    state.notified.push(car.id); saveState(); showToast("Sürüş süresi bitti", `${car.name} için ödeme onayı bekleniyor.`);
    if ("Notification" in window && Notification.permission === "granted") new Notification("Sürüş süresi bitti", { body: `${car.name} için ödeme onayı bekleniyor.` });
  });
  document.querySelector("#notificationDot").hidden = !state.cars.some(c => c.status === "rented" && c.rental.endsAt <= Date.now());
}

function showToast(title, message, error = false) {
  const el = document.createElement("div"); el.className = `toast${error ? " error" : ""}`; el.innerHTML = `<strong>${escapeHtml(title)}</strong>${escapeHtml(message)}`;
  document.querySelector("#toastRegion").append(el); setTimeout(() => el.remove(), 4300);
}

function escapeHtml(value) { const d = document.createElement("div"); d.textContent = value; return d.innerHTML; }

function enterDemo() {
  document.body.dataset.demo = "true";
  activeStorageKey = DEMO_STORAGE_KEY;
  const demoSeed = makeDemoState();
  state = localStorage.getItem(DEMO_STORAGE_KEY) ? loadState() : demoSeed;
  const examples = demoSeed.history.filter(item => item.payment === "paid" && (!state.history.some(ride => ride.payment === "paid") || ["demo-previous-month", "demo-previous-year"].includes(item.id)) && !state.history.some(ride => ride.id === item.id));
  if (examples.length) {
    state.history.push(...examples);
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  }
  document.body.classList.remove("auth-pending", "signed-out");
  document.querySelector("#authGate").hidden = true;
  document.querySelector("#demoBanner").hidden = false;
  render(); switchView("dashboard");
}

document.querySelector("#demoLogin").addEventListener("click", enterDemo);
document.querySelector("#signOutButton").addEventListener("click", event => {
  if (document.body.dataset.demo !== "true") return;
  event.stopImmediatePropagation();
  document.querySelector("#accountDialog").close();
  delete document.body.dataset.demo;
  document.body.classList.add("signed-out");
  document.querySelector("#authGate").hidden = false;
  document.querySelector("#demoBanner").hidden = true;
  activeStorageKey = STORAGE_KEY;
  state = loadState();
  render();
});

document.addEventListener("click", event => {
  const rent = event.target.closest("[data-rent]"); if (rent) openRent(rent.dataset.rent);
  const end = event.target.closest("[data-end]"); if (end) openResolve(end.dataset.end);
  const view = event.target.closest("[data-view]"); if (view) switchView(view.dataset.view);
  const edit = event.target.closest("[data-edit-car]"); if (edit) openEditCar(edit.dataset.editCar);
  const remove = event.target.closest("[data-remove-car]"); if (remove) removeCar(remove.dataset.removeCar);
  const close = event.target.closest("[data-close-dialog]"); if (close) close.closest("dialog").close();
  if (event.target.closest("[data-go-fleet]") || event.target.closest("#heroViewFleet")) switchView("fleet");
});
document.querySelectorAll("#openAddCar, #openAddCarFleet, #mobileAdd, #settingsAddCar").forEach(btn => btn.addEventListener("click", () => document.querySelector("#addCarDialog").showModal()));
document.querySelector("#rentForm").addEventListener("submit", startRental);
document.querySelector("#addCarForm").addEventListener("submit", addCar);
document.querySelector("#editCarForm").addEventListener("submit", saveCarEdit);
document.querySelector("#accountForm").addEventListener("submit", saveAccount);
document.querySelector("#confirmPayment").addEventListener("click", () => resolveRental(document.querySelector("#resolvePayment").checked ? "paid" : "unpaid"));
document.querySelector("#resolvePayment").addEventListener("change", event => { document.querySelector("#resolvePaymentLabel").textContent = event.target.checked ? "Ödendi" : "Ödenmedi"; });
document.querySelector("#settingsCarList").addEventListener("change", event => { if (event.target.matches("[data-clear-payment]")) markCarPaid(event.target.dataset.clearPayment); });
document.querySelectorAll('input[name="duration"]').forEach(input => input.addEventListener("change", () => { document.querySelector("#customTimeWrap").classList.toggle("hidden", input.value !== "custom" || !input.checked); updateRentPrice(); }));
document.querySelector("#customMinutes").addEventListener("input", updateRentPrice);
document.querySelector("#carSearch").addEventListener("input", event => { searchTerm = event.target.value.toLocaleLowerCase("tr-TR"); renderFleet(); });
document.querySelector("#analysisYearSelect").addEventListener("change", event => { analysisYear = Number(event.target.value); renderAnalysis(); });
document.querySelector("#filterPills").addEventListener("click", event => { const button = event.target.closest("[data-filter]"); if (!button) return; activeFilter = button.dataset.filter; document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b === button)); renderFleet(); });
document.querySelector("#notificationButton").addEventListener("click", async () => {
  const finished = state.cars.find(c => c.status === "rented" && c.rental.endsAt <= Date.now());
  if (finished) return openResolve(finished.id);
  if ("Notification" in window && Notification.permission === "default") { const result = await Notification.requestPermission(); showToast("Bildirimler", result === "granted" ? "Sürüş bildirimleri açıldı." : "Tarayıcı bildirimleri açılamadı."); }
  else showToast("Güncel", "Şu anda sürüş bildirimi yok.");
});
document.querySelectorAll("#profileButton, #settingsAccount, [data-open-account]").forEach(button => button.addEventListener("click", openAccount));
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
  render();
});

window.addEventListener("joyride-cloud-state", event => {
  if (event.detail.uid !== state.account.authUid) return;
  const saved = event.detail.state;
  if (!saved || !Array.isArray(saved.cars) || !Array.isArray(saved.history)) return;
  state = { ...structuredClone(defaultState), ...saved, account: { ...defaultState.account, ...saved.account, authUid: event.detail.uid } };
  localStorage.setItem(activeStorageKey, JSON.stringify(state));
  render();
});
window.addEventListener("joyride-sync-error", () => showToast("Bulut eşitlemesi başarısız", "Değişiklikler bu cihazda saklandı. Firestore ayarlarını kontrol edip tekrar deneyin.", true));
window.joyrideGetState = () => structuredClone(state);

render();
setInterval(updateTimers, 1000);
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
