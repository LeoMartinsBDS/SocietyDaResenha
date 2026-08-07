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

let activeMonth = currentMonthKey();
let financeStore = { version: 2, months: {} };

function emptyMonth() { return { monthlyFee: "", members: [], guests: [] }; }

function showMessage(message) {
  const element = $("#publicMessage");
  element.textContent = message;
  element.hidden = !message;
}

function renderPeople(type, people) {
  const container = $(type === "member" ? "#members" : "#guests");
  const emptyState = $(type === "member" ? "#membersEmpty" : "#guestsEmpty");
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

function renderFinance() {
  const month = financeStore.months[activeMonth] || emptyMonth();
  $("#selectedMonth").value = activeMonth;
  $("#selectedMonthLabel").textContent = `Caixa de ${monthName(activeMonth)}`;

  const totalMembers = month.members.reduce((sum, person) => sum + person.payment, 0);
  const totalGuests = month.guests.reduce((sum, person) => sum + person.payment, 0);
  $("#monthTotal").textContent = money(totalMembers + totalGuests);
  $("#monthlyReceived").textContent = money(totalMembers);
  $("#guestReceived").textContent = money(totalGuests);
  $("#monthlyProgress").textContent = `${month.members.length} mensalista${month.members.length === 1 ? "" : "s"} cadastrado${month.members.length === 1 ? "" : "s"}`;
  $("#guestProgress").textContent = `${month.guests.length} avulso${month.guests.length === 1 ? "" : "s"} cadastrado${month.guests.length === 1 ? "" : "s"}`;

  renderPeople("member", month.members);
  renderPeople("guest", month.guests);
}

function setActiveMonth(key) {
  if (!/^\d{4}-\d{2}$/.test(key)) return;
  activeMonth = key;
  renderFinance();
}

async function loadPublicFinance() {
  if (!supabaseClient) {
    showMessage("Configure a URL e a chave pública no arquivo supabase-config.js para carregar o caixa.");
    return;
  }
  const { data, error } = await supabaseClient.rpc("get_public_cash_flow");
  if (error) {
    console.error("Não foi possível carregar o caixa público:", error.message);
    showMessage("Não foi possível carregar o caixa agora. Tente novamente mais tarde.");
    return;
  }
  if (!data?.months) {
    showMessage("Nenhum dado de caixa disponível ainda.");
    return;
  }
  financeStore = data;
  renderFinance();
}

$("#selectedMonth").addEventListener("change", (event) => setActiveMonth(event.target.value));
$("#previousMonth").addEventListener("click", () => setActiveMonth(shiftMonth(activeMonth, -1)));
$("#nextMonth").addEventListener("click", () => setActiveMonth(shiftMonth(activeMonth, 1)));

renderFinance();
loadPublicFinance();
