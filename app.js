const $ = (selector) => document.querySelector(selector);
const STORAGE_KEY = "society-organizer-v1";
const protectedPlayers = new Set(["leonardo", "fabricio", "lemao"]);
const supabaseConfig = window.SUPABASE_CONFIG || {};
const isSupabaseConfigured = supabaseConfig.url?.startsWith("https://")
  && supabaseConfig.publishableKey
  && !supabaseConfig.publishableKey.includes("COLE_AQUI");
const supabaseClient = isSupabaseConfigured && window.supabase
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey)
  : null;

let lastPlayers = [];
let lastTeamCount = 0;
let lastTeams = [];
let currentUser = null;
let saveTimer = null;
let authMode = "login";
let publicCode = null;

const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
const readNumber = (value) => Math.max(0, Number.parseFloat(value) || 0);

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

function escapeHtml(value) { return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }

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

async function copyPublicCode() {
  if (!publicCode) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(publicCode);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = publicCode;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    const button = $("#copyPublicCodeButton");
    const original = button.textContent;
    button.textContent = "✔";
    window.setTimeout(() => { button.textContent = original; }, 1200);
  } catch (error) {
    console.error("Não foi possível copiar o código:", error);
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

function showDrawMessage(message) {
  $("#teams").innerHTML = "";
  const el = $("#drawMessage");
  el.textContent = message;
  el.style.display = "grid";
}

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

// Avulsos pagam semana a semana. Cada mês guarda uma lista de "semanas" de
// avulsos; a última é a semana em edição, as anteriores ficam como histórico
// somente leitura — nada é apagado ao começar uma semana nova.
function emptyGuestWeek() { return { startedAt: new Date().toISOString(), guests: [] }; }
function emptyMonth() { return { monthlyFee: "", members: [], guestWeeks: [emptyGuestWeek()], guestWithdrawals: [] }; }
function currentGuestWeek(month) { return month.guestWeeks[month.guestWeeks.length - 1]; }

// Converte meses salvos no formato antigo (guests: []) para o novo formato
// (guestWeeks: [...]), sem perder os dados já registrados.
function normalizeMonth(month) {
  if (!month) return emptyMonth();
  const guestWithdrawals = Array.isArray(month.guestWithdrawals) ? month.guestWithdrawals : [];
  if (Array.isArray(month.guestWeeks) && month.guestWeeks.length) {
    return { monthlyFee: month.monthlyFee || "", members: month.members || [], guestWeeks: month.guestWeeks, guestWithdrawals };
  }
  const legacyGuests = Array.isArray(month.guests) ? month.guests : [];
  return { monthlyFee: month.monthlyFee || "", members: month.members || [], guestWeeks: [{ startedAt: new Date().toISOString(), guests: legacyGuests }], guestWithdrawals };
}

function normalizeStore(store) {
  const months = {};
  Object.entries(store?.months || {}).forEach(([key, month]) => { months[key] = normalizeMonth(month); });
  return { version: 2, months };
}

function ensureMonth(key) {
  if (financeStore.months[key]) {
    financeStore.months[key] = normalizeMonth(financeStore.months[key]);
    return financeStore.months[key];
  }
  const earlierMonths = Object.keys(financeStore.months).filter((month) => month < key).sort();
  const previous = financeStore.months[earlierMonths.at(-1)];
  financeStore.months[key] = {
    ...emptyMonth(),
    // Ao abrir um novo mês, a lista de mensalistas é reaproveitada sem pagamentos.
    members: previous ? previous.members.map((person) => ({ name: person.name, payment: 0 })) : [],
  };
  return financeStore.months[key];
}

const rowContainers = { member: "members", guest: "guests", withdrawal: "withdrawals" };
function getRows(type) {
  return [...document.querySelectorAll(`#${rowContainers[type]} .person-row`)].map((row) => ({
    name: row.querySelector(".person-name").value.trim(),
    payment: readNumber(row.querySelector(".person-payment").value),
  }));
}

function formatDate(iso) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(iso));
}

function saveFinance() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(financeStore));
  if (!currentUser || !supabaseClient) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveFinanceToCloud, 600);
}

async function saveFinanceToCloud() {
  if (!currentUser || !supabaseClient) return;
  const snapshot = JSON.parse(JSON.stringify(financeStore));
  const { error } = await supabaseClient.from("society_data").upsert({
    user_id: currentUser.id,
    data: snapshot,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) console.error("Não foi possível salvar os dados no Supabase:", error.message);
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

function updateSummary(month) {
  const totalMembers = month.members.reduce((sum, person) => sum + person.payment, 0);
  const allGuests = month.guestWeeks.flatMap((week) => week.guests);
  const totalGuests = allGuests.reduce((sum, person) => sum + person.payment, 0);
  const totalWithdrawn = month.guestWithdrawals.reduce((sum, item) => sum + item.payment, 0);
  $("#monthlyReceived").textContent = money(totalMembers);
  $("#guestReceived").textContent = money(totalGuests);
  $("#guestWithdrawn").textContent = money(totalWithdrawn);
  $("#guestBalance").textContent = `Saldo: ${money(totalGuests - totalWithdrawn)}`;
  $("#totalCaixa").textContent = money(totalCaixaAteMes(activeMonth));
  $("#monthlyProgress").textContent = `${month.members.length} mensalista${month.members.length === 1 ? "" : "s"} cadastrado${month.members.length === 1 ? "" : "s"}`;
  $("#guestProgress").textContent = `${allGuests.length} avulso${allGuests.length === 1 ? "" : "s"} em ${month.guestWeeks.length} semana${month.guestWeeks.length === 1 ? "" : "s"}`;
  $("#membersEmpty").style.display = month.members.length ? "none" : "block";
  $("#guestsEmpty").style.display = currentGuestWeek(month).guests.length ? "none" : "block";
  $("#withdrawalsEmpty").style.display = month.guestWithdrawals.length ? "none" : "block";
}

function updateFinance() {
  const month = ensureMonth(activeMonth);
  month.monthlyFee = $("#monthlyFee").value;
  month.members = getRows("member");
  currentGuestWeek(month).guests = getRows("guest");
  month.guestWithdrawals = getRows("withdrawal");
  updateSummary(month);
  saveFinance();
}

function addPerson(type, values = {}, shouldUpdate = true) {
  const templateId = type === "withdrawal" ? "#withdrawalTemplate" : "#personTemplate";
  const row = $(templateId).content.firstElementChild.cloneNode(true);
  row.querySelector(".person-name").value = values.name || "";
  row.querySelector(".person-payment").value = values.payment || "";
  row.addEventListener("input", updateFinance);
  row.querySelector(".delete-button").addEventListener("click", () => { row.remove(); updateFinance(); });
  $(`#${rowContainers[type]}`).append(row);
  if (shouldUpdate) updateFinance();
}

function renderGuestHistory(month) {
  const container = $("#guestHistory");
  container.innerHTML = "";
  const pastWeeks = month.guestWeeks.slice(0, -1);
  container.hidden = !pastWeeks.length;
  [...pastWeeks].reverse().forEach((week) => {
    const total = week.guests.reduce((sum, person) => sum + person.payment, 0);
    const group = document.createElement("div");
    group.className = "guest-week-group";
    const heading = document.createElement("div");
    heading.className = "week-heading";
    const label = document.createElement("span");
    label.textContent = `Semana de ${formatDate(week.startedAt)}`;
    const total_ = document.createElement("strong");
    total_.textContent = money(total);
    heading.append(label, total_);
    const list = document.createElement("div");
    list.className = "people-list";
    if (!week.guests.length) {
      const empty = document.createElement("p");
      empty.className = "list-empty";
      empty.textContent = "Nenhum avulso registrado nesta semana.";
      list.append(empty);
    }
    week.guests.forEach((person) => {
      const row = document.createElement("div");
      row.className = "person-view-row";
      const name = document.createElement("span");
      name.className = "person-view-name";
      name.textContent = person.name || "(sem nome)";
      const payment = document.createElement("span");
      if (person.payment > 0) { payment.textContent = money(person.payment); payment.className = "paid-pill"; }
      else { payment.textContent = "Sem pagamento"; payment.className = "pending-pill"; }
      row.append(name, payment);
      list.append(row);
    });
    group.append(heading, list);
    container.append(group);
  });
}

function startNewGuestWeek() {
  const month = ensureMonth(activeMonth);
  month.guestWeeks.push(emptyGuestWeek());
  renderFinance();
  saveFinance();
}

function renderFinance() {
  const month = ensureMonth(activeMonth);
  $("#selectedMonth").value = activeMonth;
  $("#selectedMonthLabel").textContent = `Caixa de ${monthName(activeMonth)}`;
  $("#monthlyFee").value = month.monthlyFee || "";
  $("#members").innerHTML = "";
  $("#guests").innerHTML = "";
  $("#withdrawals").innerHTML = "";
  month.members.forEach((person) => addPerson("member", person, false));
  currentGuestWeek(month).guests.forEach((person) => addPerson("guest", person, false));
  month.guestWithdrawals.forEach((item) => addPerson("withdrawal", item, false));
  $("#currentWeekLabel").textContent = `Semana atual · desde ${formatDate(currentGuestWeek(month).startedAt)}`;
  renderGuestHistory(month);
  updateSummary(month);
}

function setActiveMonth(key) {
  if (!/^\d{4}-\d{2}$/.test(key)) return;
  activeMonth = key;
  renderFinance();
  saveFinance();
}

function loadFinanceLegacy() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data?.months) financeStore = data;
    // Migra automaticamente os dados salvos na primeira versão para o mês atual.
    else if (data) financeStore.months[activeMonth] = { monthlyFee: data.monthlyFee || "", members: data.members || [], guests: data.guests || [] };
  } catch { financeStore = { version: 2, months: {} }; }
  renderFinance();
}

function getLocalFinance() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data?.months) return normalizeStore(data);
    if (data) return normalizeStore({ months: { [activeMonth]: { monthlyFee: data.monthlyFee || "", members: data.members || [], guests: data.guests || [] } } });
  } catch { /* começa vazio se o armazenamento local estiver inválido */ }
  return { version: 2, months: {} };
}

function renderPublicCode(code) {
  publicCode = code || null;
  $("#publicCodeValue").textContent = publicCode || "——————";
  $("#publicCaixaLink").href = publicCode ? `caixa-publico.html?codigo=${encodeURIComponent(publicCode)}` : "caixa-publico.html";
  $("#copyPublicCodeButton").disabled = !publicCode;
}

async function loadFinance() {
  const localFinance = getLocalFinance();
  if (!currentUser || !supabaseClient) {
    financeStore = localFinance;
    renderFinance();
    return;
  }
  const { data, error } = await supabaseClient
    .from("society_data")
    .select("data, public_code")
    .eq("user_id", currentUser.id)
    .maybeSingle();
  if (error) {
    console.error("Não foi possível carregar os dados do Supabase:", error.message);
    financeStore = localFinance;
  } else if (data?.data?.months) {
    financeStore = normalizeStore(data.data);
  } else {
    financeStore = localFinance;
  }
  renderPublicCode(data?.public_code);
  renderFinance();
  if (!data?.data?.months && !error) saveFinance();
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
$("#copyPublicCodeButton").addEventListener("click", copyPublicCode);
document.querySelectorAll("[data-add]").forEach((button) => button.addEventListener("click", () => addPerson(button.dataset.add)));
$("#newGuestWeek").addEventListener("click", startNewGuestWeek);
$("#monthlyFee").addEventListener("input", updateFinance);
$("#selectedMonth").addEventListener("change", (event) => setActiveMonth(event.target.value));
$("#previousMonth").addEventListener("click", () => setActiveMonth(shiftMonth(activeMonth, -1)));
$("#nextMonth").addEventListener("click", () => setActiveMonth(shiftMonth(activeMonth, 1)));

function setAuthMessage(message = "", success = false) {
  const element = $("#authMessage");
  element.textContent = message;
  element.classList.toggle("success", success);
}

function updateAuthForm() {
  const isLogin = authMode === "login";
  $("#authTitle").textContent = isLogin ? "Entre na sua conta" : "Crie sua conta";
  $("#authDescription").textContent = isLogin
    ? "Acesse seu controle de times e caixa em qualquer aparelho."
    : "Crie uma conta para salvar o controle na nuvem.";
  $("#authSubmit").textContent = isLogin ? "Entrar" : "Criar conta";
  $("#authToggle").textContent = isLogin ? "Ainda não tenho conta" : "Já tenho uma conta";
  $("#authPassword").autocomplete = isLogin ? "current-password" : "new-password";
  setAuthMessage();
}

function showAuth() {
  currentUser = null;
  $("#appShell").hidden = true;
  $("#authScreen").hidden = false;
}

async function startApplication(user) {
  currentUser = user;
  $("#userEmail").textContent = user.email || "Conta conectada";
  $("#authScreen").hidden = true;
  $("#appShell").hidden = false;
  await loadFinance();
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  if (!supabaseClient) return;
  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  const submit = $("#authSubmit");
  submit.disabled = true;
  setAuthMessage();
  const result = authMode === "login"
    ? await supabaseClient.auth.signInWithPassword({ email, password })
    : await supabaseClient.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.href },
    });
  submit.disabled = false;
  if (result.error) return setAuthMessage(result.error.message);
  if (authMode === "signup" && !result.data.session) {
    setAuthMessage("Conta criada. Confirme o e-mail enviado para entrar.", true);
    return;
  }
  if (result.data.user) await startApplication(result.data.user);
}

async function initializeAuthentication() {
  updateAuthForm();
  if (!supabaseClient) {
    $("#authSubmit").disabled = true;
    $("#authToggle").disabled = true;
    setAuthMessage("Configure a URL e a chave pública no arquivo supabase-config.js para ativar o login.");
    return;
  }
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user) await startApplication(session.user);
  else showAuth();
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session?.user && session.user.id !== currentUser?.id) startApplication(session.user);
    if (!session) showAuth();
  });
}

$("#authForm").addEventListener("submit", handleAuthSubmit);
$("#authToggle").addEventListener("click", () => { authMode = authMode === "login" ? "signup" : "login"; updateAuthForm(); });
$("#logoutButton").addEventListener("click", async () => { if (supabaseClient) await supabaseClient.auth.signOut(); });
initializeAuthentication();
