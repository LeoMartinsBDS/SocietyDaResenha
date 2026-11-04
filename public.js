const $ = (selector) => document.querySelector(selector);
const supabaseConfig = window.SUPABASE_CONFIG || {};
const isSupabaseConfigured = supabaseConfig.url?.startsWith("https://")
  && supabaseConfig.publishableKey
  && !supabaseConfig.publishableKey.includes("COLE_AQUI");
const supabaseClient = isSupabaseConfigured && window.supabase
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey)
  : null;

const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);

function currentMonthKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function monthName(key) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function shiftMonth(key, amount) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(iso) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(iso));
}

let activeMonth = currentMonthKey();
let financeStore = { version: 2, months: {} };

function emptyMonth() { return { monthlyFee: "", members: [], guestWeeks: [], guestWithdrawals: [] }; }

// Meses antigos guardavam os avulsos direto em "guests"; agora ficam
// organizados por semana em "guestWeeks". Isso adapta os dois formatos.
function normalizeMonth(month) {
  if (!month) return emptyMonth();
  const guestWithdrawals = Array.isArray(month.guestWithdrawals) ? month.guestWithdrawals : [];
  if (Array.isArray(month.guestWeeks)) {
    return { monthlyFee: month.monthlyFee || "", members: month.members || [], guestWeeks: month.guestWeeks, guestWithdrawals };
  }
  const legacyGuests = Array.isArray(month.guests) ? month.guests : [];
  return { monthlyFee: month.monthlyFee || "", members: month.members || [], guestWeeks: legacyGuests.length ? [{ startedAt: new Date().toISOString(), guests: legacyGuests }] : [], guestWithdrawals };
}

function showMessage(message) {
  const element = $("#publicMessage");
  element.textContent = message;
  element.hidden = !message;
}

function renderPeople(people) {
  const container = $("#members");
  const emptyState = $("#membersEmpty");
  container.innerHTML = "";
  people.forEach((person) => {
    const row = $("#personViewTemplate").content.firstElementChild.cloneNode(true);
    row.querySelector(".person-view-name").textContent = person.name || "(sem nome)";
    const paymentEl = row.querySelector(".person-view-payment");
    if (person.payment > 0) {
      paymentEl.textContent = money(person.payment);
      paymentEl.classList.add("paid-pill");
    } else {
      paymentEl.textContent = "Sem pagamento";
      paymentEl.classList.add("pending-pill");
    }
    container.append(row);
  });
  emptyState.style.display = people.length ? "none" : "block";
}

function renderGuestWeeks(guestWeeks) {
  const container = $("#guests");
  const emptyState = $("#guestsEmpty");
  container.innerHTML = "";
  const weeksWithGuests = guestWeeks.filter((week) => week.guests.length);
  emptyState.style.display = weeksWithGuests.length ? "none" : "block";
  [...weeksWithGuests].reverse().forEach((week) => {
    const group = document.createElement("div");
    group.className = "guest-week-group";
    const heading = document.createElement("div");
    heading.className = "week-heading";
    const label = document.createElement("span");
    label.textContent = `Semana de ${formatDate(week.startedAt)}`;
    const total = document.createElement("strong");
    total.textContent = money(week.guests.reduce((sum, person) => sum + person.payment, 0));
    heading.append(label, total);
    const list = document.createElement("div");
    list.className = "people-list";
    week.guests.forEach((person) => {
      const row = $("#personViewTemplate").content.firstElementChild.cloneNode(true);
      row.querySelector(".person-view-name").textContent = person.name || "(sem nome)";
      const paymentEl = row.querySelector(".person-view-payment");
      if (person.payment > 0) {
        paymentEl.textContent = money(person.payment);
        paymentEl.classList.add("paid-pill");
      } else {
        paymentEl.textContent = "Sem pagamento";
        paymentEl.classList.add("pending-pill");
      }
      list.append(row);
    });
    group.append(heading, list);
    container.append(group);
  });
}

function renderWithdrawals(withdrawals) {
  const container = $("#withdrawals");
  const emptyState = $("#withdrawalsEmpty");
  container.innerHTML = "";
  withdrawals.forEach((item) => {
    const row = $("#personViewTemplate").content.firstElementChild.cloneNode(true);
    row.querySelector(".person-view-name").textContent = item.name || "(sem motivo)";
    const paymentEl = row.querySelector(".person-view-payment");
    paymentEl.textContent = money(item.payment);
    paymentEl.classList.add("withdrawal-pill");
    container.append(row);
  });
  emptyState.style.display = withdrawals.length ? "none" : "block";
}

// O caixa guarda o que sobra dos avulsos depois de cobrir a mensalidade,
// acumulado mês a mês até o mês selecionado.
function totalCaixaAteMes(key) {
  return Object.keys(financeStore.months)
    .filter((monthKey) => monthKey <= key)
    .reduce((total, monthKey) => {
      const month = normalizeMonth(financeStore.months[monthKey]);
      const totalGuests = month.guestWeeks.flatMap((week) => week.guests).reduce((sum, person) => sum + person.payment, 0);
      const totalWithdrawn = month.guestWithdrawals.reduce((sum, item) => sum + item.payment, 0);
      return total + totalGuests - totalWithdrawn;
    }, 0);
}

function renderFinance() {
  const month = normalizeMonth(financeStore.months[activeMonth]);
  $("#selectedMonth").value = activeMonth;
  $("#selectedMonthLabel").textContent = `Caixa de ${monthName(activeMonth)}`;

  const totalMembers = month.members.reduce((sum, person) => sum + person.payment, 0);
  const allGuests = month.guestWeeks.flatMap((week) => week.guests);
  const totalGuests = allGuests.reduce((sum, person) => sum + person.payment, 0);
  const totalWithdrawn = month.guestWithdrawals.reduce((sum, item) => sum + item.payment, 0);
  $("#monthlyFeeValue").textContent = money(month.monthlyFee);
  $("#monthTotal").textContent = money(totalMembers + totalGuests);
  $("#monthlyReceived").textContent = money(totalMembers);
  $("#guestReceived").textContent = money(totalGuests);
  $("#monthlyProgress").textContent = `${month.members.length} mensalista${month.members.length === 1 ? "" : "s"} cadastrado${month.members.length === 1 ? "" : "s"}`;
  $("#guestProgress").textContent = `${allGuests.length} avulso${allGuests.length === 1 ? "" : "s"} em ${month.guestWeeks.length} semana${month.guestWeeks.length === 1 ? "" : "s"}`;
  $("#guestWithdrawn").textContent = money(totalWithdrawn);
  $("#guestBalance").textContent = `Saldo: ${money(totalGuests - totalWithdrawn)}`;
  $("#totalCaixa").textContent = money(totalCaixaAteMes(activeMonth));

  renderPeople(month.members);
  renderGuestWeeks(month.guestWeeks);
  renderWithdrawals(month.guestWithdrawals);
}

function setActiveMonth(key) {
  if (!/^\d{4}-\d{2}$/.test(key)) return;
  activeMonth = key;
  renderFinance();
}

const CODE_STORAGE_KEY = "societyPublicCode";

function showGate(message = "") {
  $("#codeGate").hidden = false;
  $("#financeContent").hidden = true;
  $("#codeMessage").textContent = message;
}

function showFinanceContent() {
  $("#codeGate").hidden = true;
  $("#financeContent").hidden = false;
}

// Tenta carregar o caixa do código informado. Devolve true/false conforme o
// código seja válido, para quem chamou decidir se deve guardá-lo ou não.
async function loadPublicFinance(code) {
  if (!supabaseClient) {
    showMessage("Configure a URL e a chave pública no arquivo supabase-config.js para carregar o caixa.");
    return false;
  }
  const { data, error } = await supabaseClient.rpc("get_public_cash_flow", { code });
  if (error) {
    console.error("Não foi possível carregar o caixa público:", error.message);
    showGate("Não foi possível carregar o caixa agora. Tente novamente mais tarde.");
    return false;
  }
  if (!data?.months) {
    showGate("Código inválido. Confira com quem administra o grupo.");
    return false;
  }
  financeStore = data;
  renderFinance();
  showFinanceContent();
  return true;
}

async function tryAccessCode(code) {
  const trimmed = (code || "").trim();
  if (!trimmed) { showGate(); return; }
  const ok = await loadPublicFinance(trimmed);
  if (ok) localStorage.setItem(CODE_STORAGE_KEY, trimmed.toUpperCase());
  else localStorage.removeItem(CODE_STORAGE_KEY);
}

$("#codeForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = $("#publicCode");
  const submitButton = event.target.querySelector("button");
  submitButton.disabled = true;
  await tryAccessCode(input.value);
  submitButton.disabled = false;
});

$("#selectedMonth").addEventListener("change", (event) => setActiveMonth(event.target.value));
$("#previousMonth").addEventListener("click", () => setActiveMonth(shiftMonth(activeMonth, -1)));
$("#nextMonth").addEventListener("click", () => setActiveMonth(shiftMonth(activeMonth, 1)));

renderFinance();
const urlCode = new URLSearchParams(window.location.search).get("codigo");
tryAccessCode(urlCode || localStorage.getItem(CODE_STORAGE_KEY));
