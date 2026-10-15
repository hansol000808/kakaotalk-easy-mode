/** Local concept demo: no account, network delivery, or real messenger data. */
export const MAX_MESSAGE_LENGTH = 500;
const MAX_STORED_MESSAGES = 300;
const CONTACT_IDS = ["minji", "seoyeon", "jeongwoo"];
const ITEM_LABELS = Object.freeze({
  photo: Object.freeze({
    walk: "산책 사진",
    flower: "꽃 사진",
    sea: "바다 사진",
  }),
  gift: Object.freeze({ coffee: "커피 선물", cake: "케이크 선물" }),
  emoticon: Object.freeze({
    smile: "😊 웃어요",
    heart: "❤️ 마음을 전해요",
    thanks: "🙌 고마워요",
  }),
});

export const CONTACTS = Object.freeze([
  Object.freeze({
    id: "minji",
    name: "김민지",
    description: "가상의 시연용 친구",
    initial: "민",
    color: "yellow",
  }),
  Object.freeze({
    id: "seoyeon",
    name: "박서연",
    description: "가상의 시연용 친구",
    initial: "서",
    color: "green",
  }),
  Object.freeze({
    id: "jeongwoo",
    name: "이정우",
    description: "가상의 시연용 친구",
    initial: "정",
    color: "blue",
  }),
]);

const emptyDrafts = () => ({ minji: "", seoyeon: "", jeongwoo: "" });
const defaultPreferences = () => ({
  fontSize: "normal",
  notifications: true,
  profileName: "나",
  profileMood: "좋은 하루 보내세요.",
  profileAvatar: "smile",
});
const hasContact = (id) => CONTACT_IDS.includes(id);
const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isTime = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const limitedText = (value, limit = MAX_MESSAGE_LENGTH) =>
  typeof value === "string" ? Array.from(value).slice(0, limit).join("") : "";
const result = (state, messageId = null, error = null) => ({
  state,
  messageId,
  accepted: error === null,
  error,
});
const validItem = (kind, payload) =>
  Object.hasOwn(ITEM_LABELS, kind) &&
  typeof payload === "string" &&
  Object.hasOwn(ITEM_LABELS[kind], payload);

export function createInitialState(scenario = "default") {
  const state = {
    version: 2,
    mode: "easy",
    messages: [],
    drafts: emptyDrafts(),
    preferences: defaultPreferences(),
    nextId: 1,
  };
  if (scenario === "empty") return state;
  state.messages.push({
    id: "msg-1",
    contactId: "minji",
    text: "오늘도 좋은 하루 보내세요.",
    kind: "text",
    payload: null,
    direction: "incoming",
    status: "sent",
    createdAt: Date.now(),
  });
  state.nextId = 2;
  return state;
}

/** Allow only the preference fields exposed by the demo. */
export function updatePreferences(state, patch) {
  if (!isRecord(patch)) return state;
  const preferences = { ...state.preferences };
  if (
    Object.hasOwn(patch, "fontSize") &&
    ["normal", "large"].includes(patch.fontSize)
  )
    preferences.fontSize = patch.fontSize;
  if (
    Object.hasOwn(patch, "notifications") &&
    typeof patch.notifications === "boolean"
  )
    preferences.notifications = patch.notifications;
  if (
    Object.hasOwn(patch, "profileAvatar") &&
    ["smile", "flower", "mountain"].includes(patch.profileAvatar)
  )
    preferences.profileAvatar = patch.profileAvatar;
  if (
    Object.hasOwn(patch, "profileName") &&
    typeof patch.profileName === "string"
  ) {
    const name = limitedText(patch.profileName, 20).trim();
    if (name) preferences.profileName = name;
  }
  if (
    Object.hasOwn(patch, "profileMood") &&
    typeof patch.profileMood === "string"
  )
    preferences.profileMood = limitedText(patch.profileMood, 80).trim();
  return { ...state, preferences };
}

/**
 * Rebuild only known fields at the storage boundary. Version 1's unsent text is
 * recovered to a draft, never converted into a completed message. Current drafts
 * come first, followed by unsent text, within the same 500-character limit.
 */
export function validateState(value) {
  if (
    !isRecord(value) ||
    ![1, 2].includes(value.version) ||
    !Array.isArray(value.messages) ||
    !isRecord(value.drafts)
  )
    return createInitialState();
  const drafts = emptyDrafts();
  for (const id of CONTACT_IDS)
    if (Object.hasOwn(value.drafts, id))
      drafts[id] = limitedText(value.drafts[id]);
  const messages = [];
  const seenIds = new Set();
  let maxId = 0;
  for (const message of value.messages.slice(-MAX_STORED_MESSAGES)) {
    if (
      !isRecord(message) ||
      !hasContact(message.contactId) ||
      typeof message.id !== "string" ||
      !/^msg-[1-9]\d{0,12}$/.test(message.id)
    )
      continue;
    if (
      seenIds.has(message.id) ||
      !["incoming", "outgoing"].includes(message.direction) ||
      !isTime(message.createdAt)
    )
      continue;
    const kind = value.version === 1 ? "text" : message.kind;
    if (!["text", "photo", "gift", "emoticon"].includes(kind)) continue;
    if (kind !== "text" && !validItem(kind, message.payload)) continue;
    const text =
      kind === "text"
        ? limitedText(message.text)
        : ITEM_LABELS[kind][message.payload];
    if (!text.trim()) continue;
    const legacyUnsent =
      value.version === 1 &&
      message.direction === "outgoing" &&
      ["pending", "failed"].includes(message.status);
    if (message.status !== "sent" && !legacyUnsent) continue;
    seenIds.add(message.id);
    maxId = Math.max(maxId, Number(message.id.slice(4)));
    if (legacyUnsent) {
      const current = drafts[message.contactId];
      drafts[message.contactId] = limitedText(
        current ? `${current}\n${text}` : text,
      );
      continue;
    }
    messages.push({
      id: message.id,
      contactId: message.contactId,
      text,
      kind,
      payload: kind === "text" ? null : message.payload,
      direction: message.direction,
      status: "sent",
      createdAt: message.createdAt,
    });
  }
  const storedNextId =
    Number.isSafeInteger(value.nextId) &&
    value.nextId > 0 &&
    value.nextId < 1e13
      ? value.nextId
      : 1;
  const state = {
    version: 2,
    mode: value.mode === "standard" ? "standard" : "easy",
    messages,
    drafts,
    preferences: defaultPreferences(),
    nextId: Math.max(maxId + 1, storedNextId),
  };
  return updatePreferences(state, value.preferences);
}

export function setDraft(state, contactId, text) {
  if (!hasContact(contactId)) return state;
  return {
    ...state,
    drafts: { ...state.drafts, [contactId]: limitedText(text) },
  };
}

/** Local sends complete immediately. Only known sample media can be selected. */
export function sendMessage(
  state,
  contactId,
  { text: explicitText, kind = "text", payload = null, now = Date.now() } = {},
) {
  if (!hasContact(contactId)) return result(state, null, "unknown-contact");
  if (!["text", "photo", "gift", "emoticon"].includes(kind))
    return result(state, null, "unknown-kind");
  if (kind !== "text" && !validItem(kind, payload))
    return result(state, null, "invalid-payload");
  const usesDraft = kind === "text" && explicitText === undefined;
  const text =
    kind === "text"
      ? limitedText(usesDraft ? state.drafts[contactId] : explicitText).trim()
      : ITEM_LABELS[kind][payload];
  if (!text) return result(state, null, "empty");
  let nextId =
    Number.isSafeInteger(state.nextId) && state.nextId > 0 ? state.nextId : 1;
  while (state.messages.some((message) => message.id === `msg-${nextId}`))
    nextId += 1;
  const messageId = `msg-${nextId}`;
  const message = {
    id: messageId,
    contactId,
    text,
    kind,
    payload: kind === "text" ? null : payload,
    direction: "outgoing",
    status: "sent",
    createdAt: isTime(now) ? now : Date.now(),
  };
  return result(
    {
      ...state,
      messages: [...state.messages, message].slice(-MAX_STORED_MESSAGES),
      drafts: usesDraft ? { ...state.drafts, [contactId]: "" } : state.drafts,
      nextId: nextId + 1,
    },
    messageId,
  );
}

export function setMode(state, mode) {
  if (!["easy", "standard"].includes(mode) || mode === state.mode) return state;
  return { ...state, mode };
}

export function getConversations(state) {
  return CONTACTS.map((contact) => {
    const history = state.messages.filter(
      (message) => message.contactId === contact.id,
    );
    const lastMessage = history.at(-1) ?? null;
    const draft = state.drafts[contact.id] ?? "";
    return {
      contactId: contact.id,
      contact,
      lastMessage,
      draft,
      hasDraft: draft.length > 0,
      preview: draft.length ? draft : (lastMessage?.text ?? ""),
      updatedAt: lastMessage?.createdAt ?? 0,
      status: lastMessage?.status ?? null,
    };
  })
    .filter((conversation) => conversation.lastMessage || conversation.hasDraft)
    .sort(
      (first, second) =>
        Number(second.hasDraft) - Number(first.hasDraft) ||
        second.updatedAt - first.updatedAt,
    );
}
