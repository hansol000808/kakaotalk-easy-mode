import {
  CONTACTS,
  MAX_MESSAGE_LENGTH,
  createInitialState,
  validateState,
  setDraft,
  sendMessage,
  retryMessage,
  settleMessage,
  setMode,
  getConversations,
  findContacts,
} from "./state.js";

const STORAGE_KEY = "kakaotalk-easy-mode:v1";
const app = document.querySelector("#app");
const dialog = document.querySelector("#confirm-dialog");
const timers = new Map();
let state = loadState();
let route = {
  name: state.mode === "standard" ? "standard" : "home",
  contactId: "minji",
  from: "friends",
  query: "",
  topic: "send",
};
let pendingConfirmation = null;
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const contactById = (id) =>
  CONTACTS.find((contact) => contact.id === id) || CONTACTS[0];
const statusText = {
  pending: "보내는 중…",
  sent: "전송 완료",
  failed: "전송 실패",
};
const icon = (name) =>
  `<img src="./assets/icons/${name}.svg" width="32" height="32" alt="">`;
const button = (label, action, kind = "primary", extra = "") =>
  `<button class="button ${kind}" data-action="${action}" ${extra}>${label}</button>`;
const toolbar = (back = "home") =>
  `<div class="toolbar"><button class="back-button" data-action="${back}"><span aria-hidden="true">‹</span>이전</button>${back === "home" ? "" : '<button class="toolbar-home" data-action="home">홈</button>'}</div>`;
const heading = (title, description = "") =>
  `<h2 class="screen-heading" tabindex="-1">${esc(title)}</h2>${description ? `<p class="screen-description">${esc(description)}</p>` : ""}`;
const footer = (html) => `<div class="app-footer">${html}</div>`;
const avatar = (contact) =>
  `<span class="avatar ${contact.color}" aria-hidden="true">${esc(contact.initial)}</span>`;
const contactRow = (contact) =>
  `<button class="contact-row" data-action="chat" data-contact="${contact.id}">${avatar(contact)}<span class="contact-copy"><strong>${esc(contact.name)}</strong><small>눌러서 대화하기</small></span><span class="chevron" aria-hidden="true">›</span></button>`;
const topics = {
  send: {
    title: "메시지는 어떻게 보내나요?",
    steps: [
      "홈에서 ‘친구’를 누르세요.",
      "대화할 친구의 이름을 누르세요.",
      "메시지를 쓰고 ‘보내기’를 누르세요.",
    ],
    note: "‘전송 완료’가 표시되면 보내기가 끝난 거예요.",
    cta: "친구 찾아보기",
    action: "friends",
  },
  retry: {
    title: "메시지가 안 보내졌어요",
    steps: [
      "메시지 아래 ‘전송 실패’ 표시를 확인하세요.",
      "‘다시 보내기’를 누르세요.",
      "‘전송 완료’로 바뀌었는지 확인하세요.",
    ],
    note: "같은 내용을 다시 입력하지 않아도 돼요. 이 체험에서는 실제 네트워크 대신 전송 상태를 시연합니다.",
    cta: "대화 목록 보기",
    action: "chats",
  },
  draft: {
    title: "쓰던 메시지는 어디 있나요?",
    steps: [
      "홈에서 ‘대화’를 누르세요.",
      "‘작성 중’이라고 표시된 대화를 누르세요.",
      "입력창의 내용을 이어서 쓰세요.",
    ],
    note: "보내기 전 화면을 나가도 쓰던 내용은 이 브라우저에 남아요.",
    cta: "대화 목록 보기",
    action: "chats",
  },
  mode: {
    title: "화면 모드는 어떻게 바꾸나요?",
    steps: [
      "홈 아래 ‘화면 모드 설정’을 누르세요.",
      "원하는 모드를 선택하세요.",
      "확인창에서 ‘일반 모드로 변경’을 누르세요.",
    ],
    note: "모드를 바꿔도 대화와 작성 중인 내용은 유지돼요.",
    cta: "화면 모드 설정",
    action: "settings",
  },
};

function storageNotice() {
  const node = document.querySelector("#storage-notice");
  node.hidden = false;
  node.textContent =
    "브라우저에 최근 변경을 저장하지 못했어요. 이 탭에서는 계속 체험할 수 있지만, 새로고침하면 최근 내용이 사라질 수 있어요.";
}
function loadState() {
  let saved;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    queueMicrotask(storageNotice);
    return createInitialState();
  }
  try {
    return saved ? validateState(JSON.parse(saved)) : createInitialState();
  } catch {
    return createInitialState();
  }
}
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    storageNotice();
  }
}
function announce(text) {
  document.querySelector("#announcer").textContent = text;
}
function navigate(name, changes = {}) {
  route = { ...route, ...changes, name };
  if (state.mode === "standard" && name !== "standard") route.name = "standard";
  render(true);
}
function home() {
  return `<div class="app-view"><div class="view-scroll"><div class="home-heading">${heading("가까운 사람과, 쉽게", "무엇을 하고 싶으세요?")}</div><div class="home-actions">${[
    ["friends", "친구", "대화할 사람을 찾아요"],
    ["chats", "대화", "나누던 대화를 이어가요"],
    ["search", "친구 찾기", "이름으로 친구를 찾아요"],
    ["help", "사용 도움말", "사용 방법을 알아봐요"],
  ]
    .map(
      ([name, title, caption]) =>
        `<button class="home-action" data-action="${name}"><span class="action-icon">${icon(name)}</span><span class="action-copy"><strong>${title}</strong><small>${caption}</small></span><span class="chevron" aria-hidden="true">›</span></button>`,
    )
    .join(
      "",
    )}</div></div>${footer(button("화면 모드 설정", "settings", "quiet"))}</div>`;
}
function friends() {
  return `<div class="app-view">${toolbar()}<div class="view-scroll">${heading("친구", "대화할 사람을 눌러주세요.")}<div class="contact-list">${CONTACTS.map(contactRow).join("")}</div></div>${footer(button("이름으로 친구 찾기", "search", "secondary"))}</div>`;
}
function searchResults() {
  const contacts = findContacts(state, route.query);
  return `<p class="result-meta" role="status">${route.query.trim() ? `찾은 친구 ${contacts.length}명` : "이름을 입력하거나 친구를 선택하세요."}</p>${contacts.length ? `<div class="contact-list">${contacts.map(contactRow).join("")}</div>` : `<div class="empty-state"><div class="empty-symbol" aria-hidden="true">?</div><h3>친구를 찾지 못했어요</h3><p>이름을 다시 확인해 주세요.<br>‘민지’, ‘서연’, ‘정우’를 찾아볼 수 있어요.</p>${button("이름 다시 입력하기", "clear-search", "secondary")}${button("전체 친구 보기", "friends", "quiet")}</div>`}`;
}
function search() {
  return `<div class="app-view">${toolbar()}<div class="view-scroll">${heading("친구 찾기", "친구의 이름을 입력해 주세요.")}<label class="search-label" for="friend-search">친구 이름</label><input type="search" id="friend-search" class="search-input" placeholder="예: 김민지" value="${esc(route.query)}" autocomplete="off" maxlength="50"><div id="search-results">${searchResults()}</div></div></div>`;
}
function chats() {
  const conversations = getConversations(state);
  return `<div class="app-view">${toolbar()}<div class="view-scroll">${heading("대화", "나누던 대화를 이어가세요.")}${conversations.length ? `<div class="conversation-list">${conversations.map((item) => `<button class="conversation-row" data-action="chat" data-contact="${item.contactId}">${avatar(item.contact)}<span class="contact-copy"><strong>${esc(item.contact.name)}</strong><span class="conversation-preview">${esc(item.preview)}</span><span class="preview-status ${item.hasDraft ? "draft" : item.status}">${item.hasDraft ? "작성 중" : item.lastMessage.direction === "incoming" ? "받은 메시지" : statusText[item.status]}</span></span><span class="chevron" aria-hidden="true">›</span></button>`).join("")}</div>` : `<div class="empty-state"><div class="empty-symbol">${icon("chats")}</div><h3>아직 나눈 대화가 없어요</h3><p>친구를 선택하고<br>첫 인사를 건네볼까요?</p>${button("친구 찾아보기", "friends")}</div>`}</div>${conversations.length ? footer(button("새 대화 시작하기", "friends", "secondary")) : ""}</div>`;
}
function messageList() {
  const messages = state.messages.filter(
    (message) => message.contactId === route.contactId,
  );
  const busy = messages.some((message) => message.status === "pending");
  return `<p class="chat-date">가상의 대화 · 시연용</p>${messages.length ? messages.map((message) => `<div class="message ${message.direction}" data-message-id="${message.id}"><p class="bubble">${esc(message.text)}</p>${message.direction === "outgoing" ? `<span class="message-status ${message.status}">${statusText[message.status]}</span>${message.status === "failed" ? `<button class="retry-button" data-action="retry" data-message="${message.id}" ${busy ? "disabled" : ""}>다시 보내기</button>` : ""}` : ""}</div>`).join("") : '<div class="empty-state"><p>첫 인사를 보내보세요.</p></div>'}`;
}
function chat() {
  const contact = contactById(route.contactId);
  const draft = state.drafts[contact.id];
  const busy = state.messages.some(
    (message) =>
      message.contactId === contact.id && message.status === "pending",
  );
  return `<div class="app-view">${toolbar("chats")}<div class="chat-heading">${heading(contact.name)}<p>가상의 친구와 대화를 체험하고 있어요.</p></div><div class="messages" id="messages" tabindex="0" role="region" aria-label="메시지 목록">${messageList()}</div><form class="composer" id="composer"><label for="message-input">메시지 쓰기 <span id="message-count">${Array.from(draft).length} / ${MAX_MESSAGE_LENGTH}</span></label><textarea id="message-input" placeholder="메시지를 입력하세요" aria-describedby="composer-hint">${esc(draft)}</textarea><button class="button primary" type="submit" id="send-button" ${!draft.trim() || busy ? "disabled" : ""}>${busy ? "보내는 중…" : "보내기"}</button><p class="composer-hint" id="composer-hint">이전 화면으로 가도 쓰던 내용은 남아 있어요.</p></form></div>`;
}
function help() {
  return `<div class="app-view">${toolbar()}<div class="view-scroll">${heading("사용 도움말", "궁금한 내용을 눌러주세요.")}<div class="help-list">${Object.entries(
    topics,
  )
    .map(
      ([key, topic], i) =>
        `<button class="help-question" data-action="topic" data-topic="${key}"><strong aria-hidden="true">0${i + 1}</strong>${topic.title}<span class="chevron" aria-hidden="true">›</span></button>`,
    )
    .join(
      "",
    )}</div><p class="notice">서두르지 않아도 괜찮아요.<br>한 단계씩 따라 해보세요.</p></div></div>`;
}
function topic() {
  const data = topics[route.topic] || topics.send;
  return `<div class="app-view">${toolbar("help")}<div class="view-scroll">${heading(data.title)}<ol class="help-steps">${data.steps.map((step) => `<li>${step}</li>`).join("")}</ol><p class="notice">${data.note}</p></div>${footer(button(data.cta, data.action))}</div>`;
}
function settings() {
  return `<div class="app-view">${toolbar()}<div class="view-scroll">${heading("화면 모드 설정", "나에게 편한 화면을 선택하세요.")}<div class="mode-option selected"><strong>간편 모드 <span class="selected-pill">사용 중</span></strong><p>큰 글씨와 핵심 기능으로<br>대화를 쉽게 시작해요.</p></div><button class="mode-option" data-action="mode-confirm"><strong>일반 모드 <span class="chevron" aria-hidden="true">›</span></strong><p>일반 모드로 전환해요.<br>이 데모에서는 전환 완료까지만 보여드려요.</p></button><p class="notice">모드를 바꿔도 대화와<br>작성 중인 내용은 유지돼요.</p></div>${footer(button("일반 모드로 변경하기", "mode-confirm", "secondary"))}</div>`;
}
function standard() {
  return `<div class="app-view"><div class="view-scroll"><div class="standard-summary"><span class="success-symbol" aria-hidden="true">✓</span>${heading("일반 모드로 바뀌었어요", "대화와 작성 중인 내용은 그대로예요.")}</div><p class="notice">이 데모에서는 간편 모드의 사용 흐름과 모드 전환을 체험할 수 있어요. 일반 모드의 전체 기능은 구현하지 않았어요.</p></div>${footer(button("간편 모드로 돌아가기", "easy-mode"))}</div>`;
}
const views = {
  home,
  friends,
  chats,
  chat,
  search,
  help,
  topic,
  settings,
  standard,
};
function render(focus = false) {
  const active = document.activeElement;
  const previous =
    app.contains(active) && active.dataset
      ? { action: active.dataset.action, contact: active.dataset.contact }
      : null;
  app.innerHTML = (views[route.name] || home)();
  document.querySelector("#mode-indicator").textContent =
    state.mode === "easy" ? "간편 모드" : "일반 모드";
  if (route.name === "chat") scrollMessages();
  if (focus)
    app.querySelector(".screen-heading")?.focus({ preventScroll: true });
  else if (previous?.action) {
    Array.from(app.querySelectorAll("[data-action]"))
      .find(
        (node) =>
          node.dataset.action === previous.action &&
          node.dataset.contact === previous.contact,
      )
      ?.focus({ preventScroll: true });
  }
}
function scrollMessages() {
  const messages = document.querySelector("#messages");
  if (messages) messages.scrollTop = messages.scrollHeight;
}
function refreshChat() {
  if (route.name !== "chat") {
    render();
    return;
  }
  document.querySelector("#messages").innerHTML = messageList();
  updateComposer();
  scrollMessages();
}
function updateComposer() {
  const input = document.querySelector("#message-input");
  if (!input) return;
  const busy = state.messages.some(
    (message) =>
      message.contactId === route.contactId && message.status === "pending",
  );
  const submit = document.querySelector("#send-button");
  submit.disabled = !state.drafts[route.contactId].trim() || busy;
  submit.textContent = busy ? "보내는 중…" : "보내기";
  document.querySelector("#message-count").textContent =
    `${Array.from(state.drafts[route.contactId]).length} / ${MAX_MESSAGE_LENGTH}`;
}
function schedule(messageId) {
  if (timers.has(messageId)) return;
  timers.set(
    messageId,
    setTimeout(() => {
      timers.delete(messageId);
      const message = state.messages.find((item) => item.id === messageId);
      if (!message || message.status !== "pending") return;
      const result = message.willFail ? "failed" : "sent";
      state = settleMessage(state, messageId, result);
      persist();
      if (route.name === "chat") refreshChat();
      else if (route.name === "chats") render();
      announce(
        result === "sent"
          ? "메시지 전송이 완료되었습니다."
          : "전송에 실패했습니다. 다시 보내기를 눌러 주세요.",
      );
    }, 900),
  );
}
function confirmAction({ title, description, label, action }) {
  document.querySelector("#dialog-title").textContent = title;
  document.querySelector("#dialog-description").textContent = description;
  document.querySelector("#dialog-confirm").textContent = label;
  pendingConfirmation = action;
  dialog.returnValue = "";
  dialog.showModal();
}
dialog.addEventListener("close", () => {
  const action = pendingConfirmation;
  pendingConfirmation = null;
  if (dialog.returnValue === "confirm") action?.();
});
document.addEventListener("click", (event) => {
  const scenario = event.target.closest("[data-scenario]");
  if (scenario) {
    const name = scenario.dataset.scenario;
    confirmAction({
      title: "시연 상황을 바꿀까요?",
      description:
        "이 브라우저에 작성한 메시지와 초안을 지우고 선택한 예시로 다시 시작해요.",
      label: "다시 시작",
      action: () => {
        for (const timer of timers.values()) clearTimeout(timer);
        timers.clear();
        state = createInitialState(name);
        persist();
        navigate(
          name === "failure" ? "chat" : name === "empty" ? "chats" : "home",
          { contactId: "minji", query: "" },
        );
        document
          .querySelector("#demo")
          .scrollIntoView({ behavior: "auto", block: "start" });
        announce("선택한 시연 상황으로 다시 시작합니다.");
      },
    });
    return;
  }
  const trigger = event.target.closest("[data-action]");
  if (!trigger || trigger.disabled) return;
  const action = trigger.dataset.action;
  if (
    ["home", "friends", "chats", "search", "help", "settings"].includes(action)
  ) {
    navigate(action);
    return;
  }
  if (action === "chat") {
    navigate("chat", { contactId: trigger.dataset.contact, from: route.name });
    return;
  }
  if (action === "topic") {
    navigate("topic", { topic: trigger.dataset.topic });
    return;
  }
  if (action === "clear-search") {
    route.query = "";
    document.querySelector("#friend-search").value = "";
    document.querySelector("#search-results").innerHTML = searchResults();
    document.querySelector("#friend-search").focus();
    return;
  }
  if (action === "retry") {
    const result = retryMessage(state, trigger.dataset.message);
    if (result.accepted) {
      state = result.state;
      persist();
      refreshChat();
      document.querySelector("#message-input")?.focus({ preventScroll: true });
      schedule(result.messageId);
      announce("메시지를 다시 보내고 있습니다.");
    }
    return;
  }
  if (action === "mode-confirm") {
    confirmAction({
      title: "일반 모드로 바꿀까요?",
      description:
        "화면 구성이 달라져요. 대화와 쓰던 메시지는 그대로 유지되며, 언제든 간편 모드로 돌아올 수 있어요.",
      label: "일반 모드로 변경",
      action: () => {
        state = setMode(state, "standard");
        persist();
        navigate("standard");
      },
    });
    return;
  }
  if (action === "easy-mode") {
    state = setMode(state, "easy");
    persist();
    navigate("home");
  }
});
app.addEventListener("input", (event) => {
  if (event.target.id === "message-input") {
    state = setDraft(state, route.contactId, event.target.value);
    if (event.target.value !== state.drafts[route.contactId])
      event.target.value = state.drafts[route.contactId];
    persist();
    updateComposer();
  } else if (event.target.id === "friend-search") {
    route.query = event.target.value;
    document.querySelector("#search-results").innerHTML = searchResults();
  }
});
app.addEventListener("submit", (event) => {
  if (event.target.id !== "composer") return;
  event.preventDefault();
  const result = sendMessage(state, route.contactId, {});
  if (!result.accepted) return;
  state = result.state;
  persist();
  document.querySelector("#message-input").value = "";
  refreshChat();
  schedule(result.messageId);
  announce("메시지를 보내고 있습니다.");
  document.querySelector("#message-input").focus({ preventScroll: true });
});
persist();
render();
