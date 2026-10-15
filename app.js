import {
  CONTACTS,
  MAX_MESSAGE_LENGTH,
  createInitialState,
  validateState,
  setDraft,
  sendMessage,
  setMode,
  getConversations,
  updatePreferences,
} from "./state.js";
import { FEATURES, EXAMPLES, searchFeatures } from "./features.js";

const STORAGE_KEY = "kakaotalk-easy-mode:v1";
const app = document.querySelector("#app");
const dialog = document.querySelector("#confirm-dialog");
let state = loadState();
let route = {
  name: state.mode === "standard" ? "standard" : "home",
  contactId: "minji",
  query: "",
  topic: "search",
  featureId: null,
  recipientId: null,
  selectedItem: null,
  featureOrigin: "results",
  callActive: false,
  callEnded: false,
};
let searchResult = searchFeatures("");
let pendingConfirmation = null;
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const glyphs = {
  photo: "사진",
  "video-call": "영상",
  "voice-call": "전화",
  gift: "선물",
  font: "Aa",
  profile: "나",
  notification: "알림",
  emoticon: "☺",
  "voice-input": "말",
};
const samples = {
  photo: [
    { id: "walk", label: "산책길" },
    { id: "flower", label: "꽃 한 송이" },
    { id: "sea", label: "푸른 바다" },
  ],
  gift: [
    { id: "coffee", label: "커피", symbol: "☕" },
    { id: "cake", label: "케이크", symbol: "🎂" },
  ],
  emoticon: [
    { id: "smile", label: "웃어요", symbol: "😊" },
    { id: "heart", label: "마음을 전해요", symbol: "💛" },
    { id: "thanks", label: "고마워요", symbol: "🙌" },
  ],
};
const profilePictures = { smile: "😊", flower: "🌼", mountain: "⛰️" };
const feature = () => FEATURES.find((item) => item.id === route.featureId);
const contact = (id) => CONTACTS.find((item) => item.id === id);
const icon = (name) =>
  `<img src="./assets/icons/${name}.svg" alt="" width="32" height="32">`;
const button = (label, action, variant = "primary", attrs = "") =>
  `<button type="button" class="button ${variant || "primary"}" data-action="${action}" ${attrs}>${label}</button>`;
const toolbar = (back = "home") =>
  `<div class="app-toolbar"><button type="button" class="back-button" data-action="${back}" aria-label="이전 화면으로">← <span>뒤로</span></button><span class="toolbar-label">간편 모드</span></div>`;
const heading = (title, description = "") =>
  `<h2 class="screen-heading" tabindex="-1">${title}</h2>${description ? `<p class="screen-description">${description}</p>` : ""}`;
const footer = (content) => `<div class="app-footer">${content}</div>`;
const avatar = (person) =>
  `<span class="avatar ${person.color}" aria-hidden="true">${person.initial}</span>`;
const recipientSummary = (person) =>
  `<div class="recipient-summary">${avatar(person)}<strong>${person.name}</strong>${button("변경", "change-recipient", "quiet")}</div>`;

function storageNotice() {
  const notice = document.querySelector("#storage-notice");
  notice.textContent =
    "브라우저에 최근 변경을 저장하지 못했어요. 이 탭에서는 계속 체험할 수 있지만, 새로고침하면 최근 내용이 사라질 수 있어요.";
  notice.hidden = false;
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
  render(true);
}
function startSearch(query) {
  state = setMode(state, "easy");
  persist();
  route.query = Array.from(String(query)).slice(0, 200).join("");
  searchResult = searchFeatures(route.query);
  navigate(searchResult.kind === "empty" ? "search" : "results");
  if (searchResult.kind !== "empty")
    announce(
      searchResult.matches.length
        ? `${searchResult.matches.length}개의 기능을 찾았어요.`
        : "맞는 기능을 찾지 못했어요.",
    );
}
function openFeature(id, origin) {
  if (!FEATURES.some((item) => item.id === id)) return;
  navigate("feature", {
    featureId: id,
    featureOrigin: origin,
    recipientId: null,
    selectedItem: null,
    callActive: false,
    callEnded: false,
  });
}
function contactRow(person, action = "chat", detail = "눌러서 대화하기") {
  return `<button type="button" class="contact-row" data-action="${action}" data-contact="${person.id}">${avatar(person)}<span class="contact-copy"><strong>${person.name}</strong><small>${esc(detail)}</small></span><span class="chevron" aria-hidden="true">›</span></button>`;
}
function home() {
  const actions = [
    ["search", "search", "기능 찾기", "하고 싶은 일을 적어주세요"],
    ["friends", "friends", "친구", "대화할 사람을 선택해요"],
    ["chats", "chats", "대화", "나누던 대화를 이어가요"],
    ["help", "help", "사용 도움말", "사용 방법을 알아봐요"],
  ];
  return `<div class="view-scroll home-view"><span class="app-eyebrow">카카오톡 간편 모드</span>${heading("무엇을 하고 싶으세요?", "기능 이름을 몰라도 괜찮아요.")}<div class="home-actions">${actions.map(([action, image, title, detail]) => `<button type="button" class="home-action ${action === "search" ? "home-search" : ""}" data-action="${action}"><span class="action-icon">${icon(image)}</span><span class="action-copy"><strong>${title}</strong><small>${detail}</small></span><span class="chevron" aria-hidden="true">›</span></button>`).join("")}</div><p class="local-note">가상의 친구와 함께하는 체험이에요.</p></div>${footer(button("모드 설정", "settings", "quiet"))}`;
}
function friends() {
  return `${toolbar()}<div class="view-scroll">${heading("누구와 이야기할까요?", "친구를 누르면 대화방으로 이동해요.")}<div class="contact-list">${CONTACTS.map((person) => contactRow(person)).join("")}</div></div>${footer(button("다른 기능 찾기", "search", "secondary"))}`;
}
function search() {
  return `${toolbar()}<div class="view-scroll">${heading("어떤 일을<br>하고 싶으세요?", "메뉴 이름 대신 하고 싶은 일을 적어주세요.")}<form id="feature-search-form"><label class="field-label" for="feature-query">하고 싶은 일</label><textarea id="feature-query" class="task-input" rows="3" maxlength="400" aria-describedby="query-hint" placeholder="사진 보내고 싶어">${esc(route.query)}</textarea><p class="field-hint" id="query-hint">사진, 통화, 선물, 설정 등을 찾아보세요. (200자 이내)</p><button class="button primary" id="feature-search-button" type="submit" ${route.query.trim() ? "" : "disabled"}>기능 찾기</button></form><div class="search-examples"><p class="mini-label">이렇게 말해도 돼요</p>${EXAMPLES.slice(
    0,
    3,
  )
    .map(
      (query) =>
        `<button type="button" class="example-query" data-example="${esc(query)}">${esc(query)} <span aria-hidden="true">↗</span></button>`,
    )
    .join(
      "",
    )}</div></div>${footer(button("찾을 수 있는 기능 보기", "catalog", "quiet"))}`;
}
function featureCard(item) {
  return `<article class="feature-result"><span class="feature-glyph" aria-hidden="true">${glyphs[item.id]}</span><h3>${item.title}</h3><p>${item.description}</p>${button("이 기능 열기", "open-feature", "", `data-feature="${item.id}" aria-label="${item.title} 열기"`)}</article>`;
}
function results() {
  const title =
    searchResult.kind === "none"
      ? "조금 다르게 말해볼까요?"
      : searchResult.kind === "ambiguous"
        ? "어떤 기능이 필요하세요?"
        : "이 기능을 찾으셨나요?";
  return `${toolbar("search")}<div class="view-scroll">${heading(title)}<p class="query-echo"><span>하고 싶은 일</span>“${esc(route.query)}”</p>${searchResult.matches.length ? `${searchResult.kind === "ambiguous" ? '<p class="screen-description">' + esc(searchResult.message) + "</p>" : ""}<div class="feature-results">${searchResult.matches.map(featureCard).join("")}</div>` : `<div class="empty-state feature-empty">${icon("search")}<h3>맞는 기능을 찾지 못했어요</h3><p>${esc(searchResult.message)}</p>${button("다시 적기", "search", "secondary")}</div>`}</div>${footer(button("찾을 수 있는 기능 보기", "catalog", "quiet"))}`;
}
function catalog() {
  return `${toolbar("search")}<div class="view-scroll">${heading("찾을 수 있는 기능", "하고 싶은 일을 적으면 이 기능들로 연결해 드려요.")}<div class="feature-catalog">${FEATURES.map((item) => `<button type="button" class="catalog-row" data-action="open-feature" data-feature="${item.id}"><span class="feature-glyph" aria-hidden="true">${glyphs[item.id]}</span><span><strong>${item.title}</strong><small>${item.description}</small></span><span class="chevron" aria-hidden="true">›</span></button>`).join("")}</div></div>`;
}
function chats() {
  const conversations = getConversations(state);
  return `${toolbar()}<div class="view-scroll">${heading("나누던 대화", "친구를 눌러 이야기를 이어가세요.")}<div class="contact-list">${conversations.length ? conversations.map((item) => contactRow(item.contact, "chat", item.draft ? `작성 중 · ${item.draft}` : item.lastMessage.text)).join("") : `<div class="empty-state">${icon("chats")}<h3>아직 대화가 없어요</h3><p>친구에게 첫 인사를 건네보세요.</p>${button("친구 보기", "friends")}</div>`}</div></div>${footer(button("다른 기능 찾기", "search", "secondary"))}`;
}
function picture(id) {
  const item = samples.photo.find((item) => item.id === id) || samples.photo[0];
  return `<span class="sample-picture ${item.id}" role="img" aria-label="${item.label} 예시 그림"><span aria-hidden="true"></span><small>시연용 이미지</small></span>`;
}
function messageContent(message) {
  if (message.kind === "photo")
    return `${picture(message.payload)}<span class="attachment-caption">${esc(message.text)}</span>`;
  if (message.kind === "gift") {
    const item = samples.gift.find((item) => item.id === message.payload);
    return `<div class="gift-message"><span aria-hidden="true">${item.symbol}</span><strong>${item.label} 선물</strong><small>시연용 선물 · 실제 구매 없음</small></div>`;
  }
  if (message.kind === "emoticon") {
    const item = samples.emoticon.find((item) => item.id === message.payload);
    return `<span class="emoticon-message" role="img" aria-label="${item.label}">${item.symbol}</span>`;
  }
  return esc(message.text);
}
function messageList() {
  return (
    state.messages
      .filter((message) => message.contactId === route.contactId)
      .map(
        (message) =>
          `<div class="message ${message.direction === "outgoing" ? "outgoing" : "incoming"}"><div class="bubble">${messageContent(message)}</div><span class="message-status">${message.direction === "outgoing" ? "보냈어요" : contact(route.contactId).name}</span></div>`,
      )
      .join("") || '<p class="chat-empty">아래에 첫 인사를 적어보세요.</p>'
  );
}
function chat() {
  const person = contact(route.contactId);
  const draft = state.drafts[person.id];
  return `${toolbar("chats")}<div class="chat-heading">${avatar(person)}<div><h2 class="screen-heading" tabindex="-1">${person.name}</h2><p>가상의 친구와 나누는 대화</p></div></div><div class="messages" id="messages" role="log" aria-label="대화 내용">${messageList()}</div><form class="composer" id="message-form"><label for="message-input">메시지</label><textarea id="message-input" rows="2" placeholder="하고 싶은 말을 적어주세요" aria-describedby="message-count">${esc(draft)}</textarea><div class="composer-bottom"><span id="message-count">${Array.from(draft).length} / ${MAX_MESSAGE_LENGTH}자</span><button type="submit" id="send-button" class="button primary" ${draft.trim() ? "" : "disabled"}>보내기</button></div><button type="button" class="chat-search-link" data-action="search">사진·통화 등 다른 기능 찾기 →</button></form>`;
}
const topics = {
  search: {
    title: "기능 이름을 몰라도 괜찮아요",
    text: "기능 찾기를 누르고 “하고 싶은 일”을 적어보세요. 원하는 기능인지 확인한 뒤 해당 화면으로 이동할 수 있어요.",
    query: null,
  },
  photo: {
    title: "사진을 보내고 싶어요",
    text: "“사진 보내고 싶어”라고 적고 사진 보내기를 열어보세요. 친구와 사진을 고르면 대화방에 사진이 나타나요.",
    query: "사진 보내고 싶어",
  },
  call: {
    title: "얼굴을 보면서 통화하고 싶어요",
    text: "“얼굴 보면서 통화하고 싶어”라고 적어보세요. 영상 통화를 열고 친구를 선택하면 통화 화면을 체험할 수 있어요.",
    query: "얼굴 보면서 통화하고 싶어",
  },
  font: {
    title: "글씨가 작아서 읽기 어려워요",
    text: "“글씨가 너무 작아”라고 적어보세요. 글자 크기 바꾸기를 열면 더 큰 글씨를 선택할 수 있어요.",
    query: "글씨가 너무 작아",
  },
};
function help() {
  return `${toolbar()}<div class="view-scroll">${heading("무엇이 궁금하세요?", "궁금한 내용을 눌러보세요.")}<div class="help-list">${Object.entries(
    topics,
  )
    .map(
      ([id, item]) =>
        `<button type="button" class="help-row" data-action="topic" data-topic="${id}">${item.title}<span aria-hidden="true">›</span></button>`,
    )
    .join("")}</div></div>`;
}
function topic() {
  const item = topics[route.topic];
  return `${toolbar("help")}<div class="view-scroll">${heading(item.title)}<div class="help-answer"><span class="feature-glyph">?</span><p>${item.text}</p></div></div>${footer(item.query ? `<button type="button" class="button primary" data-example="${item.query}">직접 해보기</button>` : button("기능 찾기", "search"))}`;
}
function chooseRecipient(item) {
  return `${toolbar("feature-back")}<div class="view-scroll"><p class="step-label">1 / 2 · 친구 선택</p>${heading(item.title, "함께할 친구를 선택해 주세요.")}<div class="contact-list">${CONTACTS.map((person) => contactRow(person, "recipient", "이 친구 선택하기")).join("")}</div></div>`;
}
function selectionPage(item) {
  if (!route.recipientId) return chooseRecipient(item);
  const description =
    item.id === "photo"
      ? "시연용 이미지를 골라보세요. 내 사진에는 접근하지 않아요."
      : item.id === "gift"
        ? "시연용 선물이에요. 실제 주문이나 결제는 없어요."
        : "보내고 싶은 표정을 골라주세요.";
  return `${toolbar("feature-back")}<div class="view-scroll"><p class="step-label">2 / 2 · ${item.id === "photo" ? "사진" : item.id === "gift" ? "선물" : "표정"} 선택</p>${heading(item.title)}${recipientSummary(contact(route.recipientId))}<p class="screen-description">${description}</p><div class="sample-options ${item.id}">${samples[item.id].map((sample) => `<button type="button" class="sample-option ${route.selectedItem === sample.id ? "selected" : ""}" aria-pressed="${route.selectedItem === sample.id}" data-action="select-item" data-item="${sample.id}">${item.id === "photo" ? picture(sample.id) : `<span class="sample-symbol" aria-hidden="true">${sample.symbol}</span>`}<strong>${sample.label}</strong>${route.selectedItem === sample.id ? '<span class="selection-check" aria-hidden="true">✓</span>' : ""}</button>`).join("")}</div></div>${footer(button("선택한 항목 보내기", "send-item", "", route.selectedItem ? "" : "disabled"))}`;
}
function callPage(item) {
  if (!route.recipientId) return chooseRecipient(item);
  const person = contact(route.recipientId);
  return `${toolbar("feature-back")}<div class="view-scroll">${heading(item.title)}<p class="notice">통화 화면을 체험해요. 실제로 전화를 걸거나 카메라·마이크를 켜지 않아요.</p><div class="call-demo ${item.id === "video-call" ? "video" : ""}">${avatar(person)}<h3>${person.name}</h3><p>${route.callActive ? "통화 중 화면 · 시뮬레이션" : route.callEnded ? "통화 체험을 마쳤어요" : "친구와 통화하는 화면을 체험해요"}</p>${route.callActive ? '<span class="call-indicator">● 연결된 화면 예시</span>' : ""}</div>${!route.callActive && !route.callEnded ? button("다른 친구 선택", "change-recipient", "quiet") : ""}</div>${footer(route.callActive ? button("통화 종료", "end-call", "secondary") : route.callEnded ? button("다른 기능 찾기", "search") : button("통화 화면 체험", "start-call"))}`;
}
function preferencePage(item) {
  let content;
  if (item.id === "font")
    content = `<fieldset class="preference-options"><legend>글자 크기</legend>${[
      ["normal", "기본"],
      ["large", "더 크게"],
    ]
      .map(
        ([value, label]) =>
          `<label><input type="radio" name="font-size" value="${value}" ${state.preferences.fontSize === value ? "checked" : ""}><span>${label}</span></label>`,
      )
      .join(
        "",
      )}</fieldset><div id="font-preview" class="font-preview ${state.preferences.fontSize === "large" ? "large" : ""}"><small>미리 보기</small><p>오늘도 좋은 하루 보내세요.</p></div><p class="field-hint">이 체험의 안내 글과 대화 내용에 적용돼요.</p>`;
  else if (item.id === "profile")
    content = `<fieldset class="profile-options"><legend>프로필 그림</legend>${Object.entries(
      profilePictures,
    )
      .map(
        ([id, symbol]) =>
          `<label><input type="radio" name="profile-avatar" value="${id}" ${(state.preferences.profileAvatar || "smile") === id ? "checked" : ""}><span role="img" aria-label="${{ smile: "웃는 얼굴", flower: "꽃", mountain: "산" }[id]}">${symbol}</span></label>`,
      )
      .join(
        "",
      )}</fieldset><label class="field-label" for="profile-name">내 이름</label><input class="text-input" id="profile-name" maxlength="40" value="${esc(state.preferences.profileName)}"><label class="field-label" for="profile-mood">소개 문구</label><textarea class="task-input" id="profile-mood" rows="2" maxlength="160">${esc(state.preferences.profileMood)}</textarea><p class="field-hint">시연용 그림, 이름(20자), 소개 문구(80자)를 이 브라우저에 저장해요. 실제 카카오톡 프로필은 바뀌지 않아요.</p><p id="preference-error" class="input-error" role="status"></p>`;
  else
    content = `<label class="notification-option"><span><strong>알림 소리</strong><small>체험 안에서 사용할 설정이에요.</small></span><input id="notification-toggle" type="checkbox" ${state.preferences.notifications ? "checked" : ""}></label><p class="notice">설정값만 저장해요. 기기의 소리나 실제 카카오톡 알림은 바뀌지 않아요.</p>`;
  return `${toolbar("feature-back")}<div class="view-scroll">${heading(item.title, item.description)}${content}</div>${footer(button("적용하기", "save-preference"))}`;
}
function voiceInputPage(item) {
  if (!route.recipientId) return chooseRecipient(item);
  return `${toolbar("feature-back")}<div class="view-scroll">${heading(item.title)}${recipientSummary(contact(route.recipientId))}<p class="screen-description">말한 내용이 글자로 입력되는 흐름을 체험해요.</p><div class="voice-sample"><span class="feature-glyph">말</span><p>“오늘 저녁에 같이 밥 먹어요.”</p></div><p class="notice">마이크를 사용하지 않고 예시 문장을 입력해요. 입력 후 직접 확인하고 보내세요.</p></div>${footer(button("예시 문장 입력하기", "voice-example"))}`;
}
function featurePage() {
  const item = feature();
  if (["photo", "gift", "emoticon"].includes(item.id))
    return selectionPage(item);
  if (["video-call", "voice-call"].includes(item.id)) return callPage(item);
  if (item.id === "voice-input") return voiceInputPage(item);
  return preferencePage(item);
}
function complete() {
  const item = feature();
  const detail =
    item.id === "font"
      ? `글자 크기 · ${state.preferences.fontSize === "large" ? "더 크게" : "기본"}`
      : item.id === "notification"
        ? `알림 소리 · ${state.preferences.notifications ? "켜짐" : "꺼짐"}`
        : `${profilePictures[state.preferences.profileAvatar || "smile"]} ${state.preferences.profileName} · ${state.preferences.profileMood}`;
  return `${toolbar("search")}<div class="view-scroll complete-view"><span class="complete-check" aria-hidden="true">✓</span>${heading("적용했어요", "선택한 설정을 저장했어요.")}<p class="saved-preference">${esc(detail)}</p><p class="notice">다른 기능이 필요할 때도 하고 싶은 일을 적어보세요.</p></div>${footer(button("다른 기능 찾기", "search"))}`;
}
function settings() {
  return `${toolbar()}<div class="view-scroll">${heading("모드 설정", "나에게 편한 화면을 선택해요.")}<div class="mode-card active"><span class="mode-tag">사용 중</span><h3>간편 모드</h3><p>핵심 메뉴만 보고, 다른 기능은 하고 싶은 말로 찾아요.</p></div><div class="mode-card"><h3>기본 모드</h3><p>다양한 메뉴가 있는 화면을 살펴봐요.</p>${button("기본 모드로 바꾸기", "switch-standard", "secondary")}</div></div>`;
}
function standard() {
  return `<div class="view-scroll standard-view"><span class="app-eyebrow">기본 모드 · 비교용 화면</span>${heading("다양한 기능이 한 화면에", "어떤 메뉴를 눌러야 할지 고민되나요?")}<div class="standard-grid">${["친구", "채팅", "쇼핑", "선물", "이모티콘", "게임", "지갑", "설정", "예약"].map((label, i) => `<div><span aria-hidden="true">${["◉", "▢", "▧", "◇", "☺", "＋", "▣", "⚙", "◷"][i]}</span><small>${label}</small></div>`).join("")}</div><p class="notice">메뉴가 많은 화면을 비교하기 위한 예시예요. 실제 기본 모드의 화면과는 달라요.</p></div>${footer(button("간편 모드로 돌아가기", "switch-easy"))}`;
}
function render(focus = false) {
  const views = {
    home,
    friends,
    search,
    results,
    catalog,
    chats,
    chat,
    help,
    topic,
    feature: featurePage,
    complete,
    settings,
    standard,
  };
  app.innerHTML = views[route.name]();
  app.classList.toggle("large-type", state.preferences.fontSize === "large");
  document.querySelector("#mode-indicator").textContent =
    state.mode === "easy" ? "간편 모드" : "기본 모드";
  const messages = document.querySelector("#messages");
  if (messages) messages.scrollTop = messages.scrollHeight;
  if (focus)
    app.querySelector(".screen-heading")?.focus({ preventScroll: true });
}
function confirmAction(title, description, callback, label = "변경하기") {
  document.querySelector("#dialog-title").textContent = title;
  document.querySelector("#dialog-description").textContent = description;
  document.querySelector("#dialog-confirm").textContent = label;
  pendingConfirmation = callback;
  dialog.returnValue = "";
  dialog.showModal();
}
dialog.addEventListener("close", () => {
  const callback = pendingConfirmation;
  pendingConfirmation = null;
  if (dialog.returnValue === "confirm") callback?.();
});
document.addEventListener("click", (event) => {
  const example = event.target.closest("[data-example]");
  if (example) {
    startSearch(example.dataset.example);
    document
      .querySelector("#demo")
      .scrollIntoView({ behavior: "auto", block: "start" });
    return;
  }
  const target = event.target.closest("[data-action]");
  if (!target || target.disabled) return;
  const action = target.dataset.action;
  if (
    [
      "home",
      "friends",
      "search",
      "chats",
      "help",
      "settings",
      "catalog",
    ].includes(action)
  ) {
    navigate(action);
    return;
  }
  if (action === "chat")
    navigate("chat", { contactId: target.dataset.contact });
  if (action === "topic") navigate("topic", { topic: target.dataset.topic });
  if (action === "open-feature")
    openFeature(target.dataset.feature, route.name);
  if (action === "feature-back")
    navigate(route.featureOrigin === "catalog" ? "catalog" : "results");
  if (action === "recipient") {
    route.recipientId = target.dataset.contact;
    render(true);
  }
  if (action === "change-recipient") {
    route.recipientId = null;
    route.selectedItem = null;
    route.callActive = false;
    route.callEnded = false;
    render(true);
  }
  if (action === "select-item") {
    route.selectedItem = target.dataset.item;
    app.querySelectorAll(".sample-option").forEach((option) => {
      const selected = option === target;
      option.classList.toggle("selected", selected);
      option.setAttribute("aria-pressed", String(selected));
      option.querySelector(".selection-check")?.remove();
    });
    const check = document.createElement("span");
    check.className = "selection-check";
    check.setAttribute("aria-hidden", "true");
    check.textContent = "✓";
    target.append(check);
    app.querySelector('[data-action="send-item"]').disabled = false;
  }
  if (action === "send-item") {
    const result = sendMessage(state, route.recipientId, {
      kind: route.featureId,
      payload: route.selectedItem,
    });
    if (result.accepted) {
      state = result.state;
      persist();
      navigate("chat", { contactId: route.recipientId });
      announce("선택한 항목을 보냈어요.");
    }
  }
  if (action === "start-call") {
    route.callActive = true;
    render(true);
  }
  if (action === "end-call") {
    route.callActive = false;
    route.callEnded = true;
    render(true);
  }
  if (action === "save-preference") {
    let patch;
    if (route.featureId === "font")
      patch = {
        fontSize: app.querySelector('[name="font-size"]:checked').value,
      };
    else if (route.featureId === "notification")
      patch = {
        notifications: app.querySelector("#notification-toggle").checked,
      };
    else {
      const name = app.querySelector("#profile-name").value.trim();
      if (!name) {
        app.querySelector("#preference-error").textContent =
          "이름을 적어주세요.";
        app.querySelector("#profile-name").focus();
        return;
      }
      patch = {
        profileName: name,
        profileMood: app.querySelector("#profile-mood").value,
        profileAvatar: app.querySelector('[name="profile-avatar"]:checked')
          .value,
      };
    }
    state = updatePreferences(state, patch);
    persist();
    navigate("complete");
    announce("설정을 적용했어요.");
  }
  if (action === "voice-example") {
    const existing = state.drafts[route.recipientId];
    const combined = `${existing}${existing ? " " : ""}오늘 저녁에 같이 밥 먹어요.`;
    if (Array.from(combined).length > MAX_MESSAGE_LENGTH) {
      navigate("chat", { contactId: route.recipientId });
      const notice = document.createElement("p");
      notice.className = "input-error";
      notice.setAttribute("role", "status");
      notice.textContent =
        "작성 중인 내용이 길어 예시 문장을 넣지 못했어요. 내용을 줄인 뒤 다시 이용해 주세요.";
      app.querySelector(".composer").prepend(notice);
      app.querySelector("#message-input").focus();
      return;
    }
    state = setDraft(state, route.recipientId, combined);
    persist();
    navigate("chat", { contactId: route.recipientId });
    app.querySelector("#message-input").focus();
    announce("대화방의 입력 내용을 확인하고 보내주세요.");
  }
  if (action === "switch-standard")
    confirmAction(
      "기본 모드로 바꿀까요?",
      "대화와 작성 중인 내용은 그대로 보관해요.",
      () => {
        state = setMode(state, "standard");
        persist();
        navigate("standard");
      },
    );
  if (action === "switch-easy") {
    state = setMode(state, "easy");
    persist();
    navigate("home");
  }
  if (action === "reset-demo")
    confirmAction(
      "체험을 처음부터 시작할까요?",
      "이 브라우저에 저장된 체험 대화와 설정이 초기화돼요.",
      () => {
        state = createInitialState();
        searchResult = searchFeatures("");
        persist();
        navigate("home", {
          query: "",
          recipientId: null,
          selectedItem: null,
          featureId: null,
        });
        announce("체험을 초기화했어요.");
      },
      "초기화하기",
    );
});
document.addEventListener("input", (event) => {
  if (["profile-name", "profile-mood"].includes(event.target.id)) {
    const limit = event.target.id === "profile-name" ? 20 : 80;
    event.target.value = Array.from(event.target.value)
      .slice(0, limit)
      .join("");
  }
  if (event.target.id === "message-input") {
    state = setDraft(state, route.contactId, event.target.value);
    const value = state.drafts[route.contactId];
    if (event.target.value !== value) event.target.value = value;
    persist();
    document.querySelector("#message-count").textContent =
      `${Array.from(value).length} / ${MAX_MESSAGE_LENGTH}자`;
    document.querySelector("#send-button").disabled = !value.trim();
  }
  if (event.target.id === "feature-query") {
    route.query = Array.from(event.target.value).slice(0, 200).join("");
    if (event.target.value !== route.query) event.target.value = route.query;
    document.querySelector("#feature-search-button").disabled =
      !route.query.trim();
  }
});
document.addEventListener("change", (event) => {
  if (event.target.name === "font-size")
    document
      .querySelector("#font-preview")
      .classList.toggle("large", event.target.value === "large");
});
document.addEventListener("submit", (event) => {
  if (event.target.id === "feature-search-form") {
    event.preventDefault();
    startSearch(document.querySelector("#feature-query").value);
  }
  if (event.target.id === "message-form") {
    event.preventDefault();
    const result = sendMessage(state, route.contactId);
    if (result.accepted) {
      state = result.state;
      persist();
      render();
      app.querySelector("#message-input").focus();
      announce("메시지를 보냈어요.");
    }
  }
});
persist();
render();
