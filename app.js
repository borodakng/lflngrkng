const telegram = window.Telegram?.WebApp;
const view = document.getElementById("view");
const status = document.getElementById("status");
const filterOptions = [
  ["all", "Все"],
  ["story", "Ролевые сюжеты"],
  ["messages", "Переписка"],
];
const personaSlugs = {
  "агата": "agata",
  "алекс": "alex",
  "артём": "artem",
  "дамиан": "damian",
  "девушка-смс": "girl-sms",
  "джулия": "julia",
  "дима": "dima",
  "ева": "eva",
  "кирилл": "kirill",
  "лео": "leo",
  "лиса": "lisa",
  "луна": "luna",
  "лёва": "leva",
  "максим": "maxim",
  "марк": "mark",
  "мия": "miya",
  "ника": "nika",
  "никита": "nikita",
  "парень-смс": "guy-sms",
  "роксана": "roksana",
  "рокси": "roksi",
  "стелла": "stella",
};

let personas = [];
let activeFilter = "all";
let catalogQuery = "";
let chatRenderId = 0;

telegram?.ready();
telegram?.expand();

function currentRoute() {
  const params = new URLSearchParams(window.location.search);
  const chatPath = window.location.pathname.match(/^\/chat\/([^/]+)\/?$/);
  return {
    chat: params.get("chat") || (chatPath ? chatPath[1] : null),
    persona: params.get("c"),
    gender: params.get("gender"),
  };
}

function routeUrl({ persona = null, chat = null } = {}) {
  const url = new URL(window.location.href);
  url.searchParams.delete("c");
  url.searchParams.delete("chat");
  if (chat) {
    url.pathname = `/chat/${personaSlugs[chat] || chat}`;
  } else {
    if (/^\/chat\/[^/]+\/?$/.test(url.pathname)) url.pathname = "/characters";
    if (persona) url.searchParams.set("c", personaSlugs[persona] || persona);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function findPersona(routeId) {
  return personas.find((persona) => (
    persona.id === routeId || personaSlugs[persona.id] === routeId
  ));
}

function navigate(route = {}) {
  history.pushState({}, "", routeUrl(route));
  renderRoute();
  window.scrollTo(0, 0);
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function setStatus(message = "") {
  status.textContent = message;
}

function setPageLabel(label) {
  document.querySelector(".catalog-label").textContent = label;
}

function personaImage(persona, className, altText = `Портрет персонажа ${persona.name}`) {
  const wrap = makeElement("div", className);
  if (!persona.image) {
    const placeholder = makeElement("span", "persona-image-placeholder", "✦");
    placeholder.setAttribute("aria-hidden", "true");
    wrap.append(placeholder);
    return wrap;
  }

  const image = makeElement("img", "persona-image");
  image.alt = altText;
  image.loading = "lazy";
  image.draggable = false;
  image.src = new URL(persona.image.replace(/^\.\//, ""), window.location.origin + "/").href;
  image.addEventListener("error", () => {
    const placeholder = makeElement("span", "persona-image-placeholder", "✦");
    placeholder.setAttribute("aria-hidden", "true");
    image.replaceWith(placeholder);
  }, { once: true });
  wrap.append(image);
  return wrap;
}

function personaRole(persona) {
  return (persona.style || "Новая история").replace(/\s*⭐️?$/, "");
}

function getVisiblePersonas() {
  const query = catalogQuery.trim().toLocaleLowerCase("ru");
  return personas.filter((persona) => {
    const isMessagePersona = persona.style === "общение в мессенджере";
    const matchesFilter = activeFilter === "all"
      || (activeFilter === "messages" && isMessagePersona)
      || (activeFilter === "story" && !isMessagePersona);
    const searchableText = [
      persona.name,
      persona.id,
      persona.style,
      persona.description,
    ].join(" ").toLocaleLowerCase("ru");
    return matchesFilter && searchableText.includes(query);
  });
}

function openPersona(personaId) {
  navigate({ persona: personaId });
}

function createCard(persona) {
  const card = makeElement("a", "persona-card");
  card.href = routeUrl({ persona: persona.id });
  card.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openPersona(persona.id);
  });

  card.append(personaImage(persona, "persona-image-wrap"));
  const info = makeElement("div", "persona-info");
  const name = makeElement("h2", "", persona.name);
  const role = makeElement("p", "persona-role", personaRole(persona));
  const description = makeElement(
    "p",
    "persona-description",
    persona.description || "Новая история может начаться с одного сообщения.",
  );
  const link = makeElement("span", "card-link");
  link.append(document.createTextNode("Открыть персонажа"));
  link.append(makeElement("span", "", "↗"));
  info.append(name, role, description, link);
  card.append(info);
  return card;
}

function renderCatalog() {
  chatRenderId += 1;
  document.body.classList.remove("is-chat-page");
  setPageLabel("КАТАЛОГ");
  setStatus("");
  document.title = "Персонажи — Твой собеседник";
  view.replaceChildren();

  const intro = makeElement("section", "intro");
  intro.setAttribute("aria-labelledby", "page-title");
  intro.append(
    makeElement("p", "eyebrow", "ЗНАКОМСТВО НАЧИНАЕТСЯ СООБЩЕНИЕМ"),
    makeElement("h1", "", "Выбери собеседника"),
    makeElement("p", "intro-copy", "У каждого — своя история. С чего начнётся ваша?"),
  );
  intro.querySelector("h1").id = "page-title";

  const catalog = makeElement("section", "catalog");
  catalog.setAttribute("aria-label", "Каталог персонажей");
  const tools = makeElement("div", "catalog-tools");
  const search = makeElement("label", "search");
  search.innerHTML = `
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="10.8" cy="10.8" r="6.8"></circle>
      <path d="m16 16 4.5 4.5"></path>
    </svg>
  `;
  const input = makeElement("input");
  input.type = "search";
  input.placeholder = "Имя или роль";
  input.autocomplete = "off";
  input.value = catalogQuery;
  input.setAttribute("aria-label", "Поиск персонажей по имени или роли");
  search.append(input, makeElement("span", "search-shortcut", "⌕"));
  const visiblePersonas = getVisiblePersonas();
  const count = makeElement("span", "result-count", `Показано ${visiblePersonas.length} из ${personas.length}`);
  tools.append(search, count);

  const filters = makeElement("div", "filters");
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "Тип персонажа");
  filterOptions.forEach(([value, label]) => {
    const button = makeElement("button", `filter${activeFilter === value ? " is-active" : ""}`, label);
    button.type = "button";
    button.setAttribute("aria-pressed", String(activeFilter === value));
    button.addEventListener("click", () => {
      activeFilter = value;
      renderCatalog();
    });
    filters.append(button);
  });

  const grid = makeElement("div", "card-grid");
  grid.setAttribute("aria-live", "polite");
  if (visiblePersonas.length === 0) {
    grid.append(makeElement("div", "empty-card", "Никого не нашлось. Попробуй изменить запрос или фильтр."));
  } else {
    visiblePersonas.forEach((persona) => grid.append(createCard(persona)));
  }

  input.addEventListener("input", () => {
    catalogQuery = input.value;
    const selectionStart = input.selectionStart;
    const selectionEnd = input.selectionEnd;
    renderCatalog();
    const nextInput = view.querySelector(".search input");
    nextInput.focus();
    nextInput.setSelectionRange(selectionStart, selectionEnd);
  });

  catalog.append(tools, filters, grid);
  view.append(intro, catalog, makeElement("footer", "footnote", "Выбери персонажа, чтобы открыть его историю"));
}

function renderProfile(persona) {
  chatRenderId += 1;
  document.body.classList.remove("is-chat-page");
  setPageLabel("ПЕРСОНАЖ");
  setStatus("");
  document.title = `${persona.name} — Твой собеседник`;
  view.replaceChildren();

  const back = makeElement("button", "back-button", "← Все персонажи");
  back.type = "button";
  back.addEventListener("click", () => navigate());

  const profile = makeElement("section", "profile");
  profile.setAttribute("aria-labelledby", "profile-name");
  profile.append(personaImage(persona, "profile-image-wrap"));
  const details = makeElement("div", "profile-details");
  details.append(
    makeElement("p", "eyebrow", "ТВОЯ НОВАЯ ИСТОРИЯ"),
    makeElement("h1", "", persona.name),
    makeElement("p", "profile-role", personaRole(persona)),
    makeElement("p", "profile-description", persona.description || "Новая история может начаться с одного сообщения."),
  );
  details.querySelector("h1").id = "profile-name";
  const chips = makeElement("div", "profile-tags");
  chips.append(
    makeElement("span", "profile-tag", "ИИ-персонаж"),
    makeElement("span", "profile-tag", "Ответы в реальном времени"),
  );
  const start = makeElement("button", "profile-start", "Начать общение");
  start.type = "button";
  start.append(makeElement("span", "", "↗"));
  start.addEventListener("click", () => navigate({ chat: persona.id }));
  details.append(chips, start);
  profile.append(details);
  view.append(back, profile);
}

function createBubble(message) {
  const bubble = makeElement("article", `message-bubble ${message.role === "user" ? "from-user" : "from-persona"}`);
  bubble.append(makeElement("p", "", message.content));
  return bubble;
}

function scrollMessagesToBottom(messages) {
  messages.scrollTop = messages.scrollHeight;
}

function apiHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (telegram?.initData) headers.Authorization = `tma ${telegram.initData}`;
  return headers;
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...apiHeaders(), ...options.headers },
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Сервер вернул некорректный ответ.");
  }
  if (!response.ok) throw new Error(result.error || "Не удалось выполнить запрос.");
  return result;
}

async function sendMessage(persona, input, sendButton, messages) {
  const text = input.value.trim();
  if (!text || sendButton.disabled) return;
  if (text.length > 2000) {
    setStatus("Сообщение слишком длинное — максимум 2000 символов.");
    return;
  }

  setStatus("");
  const userBubble = createBubble({ role: "user", content: text });
  userBubble.classList.add("is-pending");
  messages.append(userBubble);
  input.value = "";
  sendButton.disabled = true;
  scrollMessagesToBottom(messages);
  try {
    const result = await apiRequest("/api/chat/message", {
      method: "POST",
      body: JSON.stringify({ persona_id: persona.id, text }),
    });
    userBubble.classList.remove("is-pending");
    messages.append(createBubble(result.assistant_message));
    scrollMessagesToBottom(messages);
  } catch (error) {
    userBubble.remove();
    input.value = text;
    input.focus();
    setStatus(error instanceof Error ? error.message : "Не удалось отправить сообщение.");
  } finally {
    sendButton.disabled = false;
  }
}

async function renderChat(persona) {
  const renderId = ++chatRenderId;
  document.body.classList.add("is-chat-page");
  setPageLabel("ЧАТ");
  setStatus("");
  document.title = `Чат с ${persona.name} — Твой собеседник`;
  view.replaceChildren();

  const header = makeElement("header", "chat-header");
  const back = makeElement("button", "icon-button", "←");
  back.type = "button";
  back.setAttribute("aria-label", "Назад к персонажу");
  back.addEventListener("click", () => navigate({ persona: persona.id }));
  const identity = makeElement("div", "chat-identity");
  const avatar = personaImage(persona, "chat-avatar", "");
  const title = makeElement("div", "");
  title.append(
    makeElement("strong", "", persona.name),
    makeElement("span", "", personaRole(persona)),
  );
  identity.append(avatar, title);
  const profileLink = makeElement("button", "icon-button", "⋯");
  profileLink.type = "button";
  profileLink.setAttribute("aria-label", `Профиль ${persona.name}`);
  profileLink.addEventListener("click", () => navigate({ persona: persona.id }));
  header.append(back, identity, profileLink);

  const conversation = makeElement("section", "conversation");
  conversation.setAttribute("aria-label", `Переписка с ${persona.name}`);
  const messages = makeElement("div", "messages");
  messages.setAttribute("aria-live", "polite");
  messages.append(makeElement("div", "loading-card", "Открываю переписку…"));

  const form = makeElement("form", "chat-composer");
  const input = makeElement("textarea", "message-input");
  input.rows = 1;
  input.maxLength = 2000;
  input.placeholder = "Напиши сообщение…";
  input.setAttribute("aria-label", "Сообщение персонажу");
  const sendButton = makeElement("button", "send-button", "↑");
  sendButton.type = "submit";
  sendButton.setAttribute("aria-label", "Отправить сообщение");
  form.append(input, sendButton);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(persona, input, sendButton, messages);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  conversation.append(messages, form);
  view.append(header, conversation);
  input.focus({ preventScroll: true });

  try {
    const result = await apiRequest(
      `/api/chat/history?persona_id=${encodeURIComponent(persona.id)}`,
      { method: "GET", headers: {} },
    );
    if (renderId !== chatRenderId) return;
    messages.replaceChildren();
    if (result.messages.length === 0) {
      messages.append(makeElement("div", "empty-card", "Пока нет сообщений. Напиши первым!"));
    } else {
      result.messages.forEach((message) => messages.append(createBubble(message)));
    }
    scrollMessagesToBottom(messages);
    input.focus({ preventScroll: true });
  } catch (error) {
    if (renderId !== chatRenderId) return;
    messages.replaceChildren();
    messages.append(makeElement(
      "div",
      "empty-card",
      error instanceof Error ? error.message : "Не удалось загрузить переписку.",
    ));
  }
}

function renderRoute() {
  const route = currentRoute();
  if (route.chat) {
    const persona = findPersona(route.chat);
    if (persona) {
      renderChat(persona);
      return;
    }
  }
  if (route.persona) {
    const persona = findPersona(route.persona);
    if (persona) {
      renderProfile(persona);
      return;
    }
  }
  renderCatalog();
}

async function loadPersonas() {
  try {
    const response = await fetch("/personas.json");
    if (!response.ok) throw new Error("Не удалось загрузить каталог персонажей.");
    const catalog = await response.json();
    if (!Array.isArray(catalog)) throw new Error("Некорректный каталог персонажей.");
    const userGender = currentRoute().gender;
    if (userGender !== "male" && userGender !== "female") {
      personas = catalog;
    } else {
      const personaGender = userGender === "male" ? "female" : "male";
      personas = catalog.filter((persona) => persona.gender === personaGender);
    }
    if (personas.length === 0) {
      view.replaceChildren(makeElement("div", "empty-card", "Для этой подборки пока нет персонажей."));
      return;
    }
    renderRoute();
  } catch (error) {
    view.replaceChildren(makeElement(
      "div",
      "empty-card",
      error instanceof Error ? error.message : "Не удалось загрузить персонажей.",
    ));
  }
}

document.querySelector(".brand").addEventListener("click", (event) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate();
});
window.addEventListener("popstate", renderRoute);
loadPersonas();
