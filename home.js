const $ = (selector) => document.querySelector(selector);
const protectedPlayers = new Set(["leonardo", "fabricio", "lemao"]);
const supabaseConfig = window.SUPABASE_CONFIG || {};
const isSupabaseConfigured = supabaseConfig.url?.startsWith("https://")
  && supabaseConfig.publishableKey
  && !supabaseConfig.publishableKey.includes("COLE_AQUI");
const supabaseClient = isSupabaseConfigured && window.supabase
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey)
  : null;

const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
const normalize = (value) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

let lastPlayers = [];
let lastTeamCount = 0;
let lastTeams = [];

function parsePlayers() {
  return $("#players").value.split("\n")
    .map((line) => line.replace(/^\s*\d+\s*[-.)]?\s*/, "").trim())
    .filter(Boolean);
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeTeams(players, teamCount) {
  const rafael = players.find((name) => normalize(name) === "rafael");
  const restricted = players.filter((name) => protectedPlayers.has(normalize(name)));
  const others = players.filter((name) => name !== rafael && !restricted.includes(name));
  const teams = Array.from({ length: teamCount }, () => []);

  if (rafael) teams[Math.floor(Math.random() * teamCount)].push(rafael);
  const rafaelTeam = teams.findIndex((team) => team.includes(rafael));
  const eligibleTeams = teams.map((_, index) => index).filter((index) => index !== rafaelTeam);

  const addBalanced = (name, allowedIndexes) => {
    const minimum = Math.min(...allowedIndexes.map((index) => teams[index].length));
    const options = allowedIndexes.filter((index) => teams[index].length === minimum);
    teams[options[Math.floor(Math.random() * options.length)]].push(name);
  };

  shuffle(restricted).forEach((name) => addBalanced(name, rafael ? eligibleTeams : teams.map((_, index) => index)));
  shuffle(others).forEach((name) => addBalanced(name, teams.map((_, index) => index)));
  return teams;
}

function escapeHtml(value) { return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }

function renderTeams(teams) {
  lastTeams = teams;
  const container = $("#teams");
  container.innerHTML = "";
  $("#drawMessage").style.display = "none";
  teams.forEach((team, index) => {
    const card = document.createElement("article");
    card.className = "team";
    card.innerHTML = `<h4>Time ${index + 1}<span class="team-size">${team.length} jogadores</span></h4><ol>${team.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}</ol>`;
    container.append(card);
  });
}

function showDrawMessage(message) {
  $("#teams").innerHTML = "";
  const el = $("#drawMessage");
  el.textContent = message;
  el.style.display = "grid";
}

function buildTeamsText(teams) {
  return teams.map((team, index) => `Time ${index + 1} (${team.length} jogador${team.length === 1 ? "" : "es"})\n${team.map((name) => `- ${name}`).join("\n")}`).join("\n\n");
}

async function copyTeams() {
  if (!lastTeams.length) return;
  const text = buildTeamsText(lastTeams);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    const button = $("#copyTeamsButton");
    const original = button.textContent;
    button.textContent = "✔";
    window.setTimeout(() => { button.textContent = original; }, 1200);
  } catch (error) {
    console.error("Não foi possível copiar os times:", error);
  }
}

function drawTeams() {
  const players = parsePlayers();
  const teamCount = Number($("#teamCount").value);
  if (players.length < teamCount) return showDrawMessage("Adicione pelo menos um jogador para cada time.");
  if (teamCount === 1 && players.some((name) => normalize(name) === "rafael") && players.some((name) => protectedPlayers.has(normalize(name)))) {
    return showDrawMessage("Com 1 time não é possível respeitar a restrição do Rafael.");
  }
  lastPlayers = players;
  lastTeamCount = teamCount;
  renderTeams(makeTeams(players, teamCount));
  $("#redrawButton").disabled = false;
  $("#copyTeamsButton").disabled = false;
}

document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => {
  document.querySelectorAll(".tab,.panel").forEach((element) => element.classList.remove("active"));
  tab.classList.add("active");
  $(`#${tab.dataset.panel}`).classList.add("active");
}));
$("#players").addEventListener("input", () => { $("#playerCount").textContent = parsePlayers().length; });
$("#drawButton").addEventListener("click", drawTeams);
$("#redrawButton").addEventListener("click", () => { if (lastPlayers.length) renderTeams(makeTeams(lastPlayers, lastTeamCount)); });
$("#copyTeamsButton").addEventListener("click", copyTeams);

// --- Caixa público (somente leitura) ---

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
