/** Browser-local demo state. No account, network, or real messenger data is used. */
export const MAX_MESSAGE_LENGTH = 500;
const MAX_STORED_MESSAGES = 300;
const CONTACT_IDS = ["minji", "seoyeon", "jeongwoo"];

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
const hasContact = (id) => CONTACT_IDS.includes(id);
const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isTime = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const limitedText = (value) =>
  typeof value === "string"
    ? Array.from(value).slice(0, MAX_MESSAGE_LENGTH).join("")
    : "";
const normalizeSearch = (value) =>
  String(value ?? "")
    .normalize("NFC")
    .toLocaleLowerCase("ko-KR")
    .replace(/\s+/gu, "");
const result = (state, messageId = null, error = null) => ({
  state,
  messageId,
  accepted: error === null,
  error,
});

/** Explicit scenarios only replace state when the caller chooses to reset the demo. */
export function createInitialState(scenario = "default") {
  const state = {
    version: 1,
    mode: "easy",
    messages: [],
    drafts: emptyDrafts(),
    nextId: 1,
  };
  if (scenario === "empty") return state;
  const now = Date.now();
  state.messages.push({
    id: "msg-1",
    contactId: "minji",
    text: "오늘도 좋은 하루 보내세요.",
    direction: "incoming",
    status: "sent",
    createdAt: now,
    willFail: false,
  });
  state.nextId = 2;
  if (scenario === "failure") {
    state.messages.push({
      id: "msg-2",
      contactId: "minji",
      text: "고마워요. 곧 만나요!",
      direction: "outgoing",
      status: "failed",
      createdAt: now + 1,
      willFail: false,
    });
    state.nextId = 3;
  }
  return state;
}

/**
 * Storage boundary: rebuild only known fields and bound stored data.
 * A pending message has no surviving timer after reload; retain it as failed so
 * the user can explicitly retry the same bubble, rather than silently resending.
 */
export function validateState(value) {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.messages) ||
    !isRecord(value.drafts)
  ) {
    return createInitialState();
  }
  const drafts = emptyDrafts();
  for (const id of CONTACT_IDS) {
    if (Object.hasOwn(value.drafts, id))
      drafts[id] = limitedText(value.drafts[id]);
  }
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
      typeof message.text !== "string" ||
      !message.text.trim()
    )
      continue;
    if (
      !["incoming", "outgoing"].includes(message.direction) ||
      !["pending", "sent", "failed"].includes(message.status) ||
      !isTime(message.createdAt)
    )
      continue;
    const text = limitedText(message.text);
    if (!text.trim()) continue;
    const numericId = Number(message.id.slice(4));
    maxId = Math.max(maxId, numericId);
    seenIds.add(message.id);
    messages.push({
      id: message.id,
      contactId: message.contactId,
      text,
      direction: message.direction,
      status:
        message.direction === "incoming"
          ? "sent"
          : message.status === "pending"
            ? "failed"
            : message.status,
      createdAt: message.createdAt,
      willFail: false,
    });
  }
  return {
    version: 1,
    mode: value.mode === "standard" ? "standard" : "easy",
    messages,
    drafts,
    nextId: maxId + 1,
  };
}

/** Keep draft text verbatim, including whitespace, while editing or navigating. */
export function setDraft(state, contactId, text) {
  if (!hasContact(contactId)) return state;
  return {
    ...state,
    drafts: { ...state.drafts, [contactId]: limitedText(text) },
  };
}

export function sendMessage(
  state,
  contactId,
  { fail = false, now = Date.now() } = {},
) {
  if (!hasContact(contactId)) return result(state, null, "unknown-contact");
  if (
    state.messages.some(
      (message) =>
        message.contactId === contactId && message.status === "pending",
    )
  )
    return result(state, null, "pending");
  const text = limitedText(state.drafts[contactId]).trim();
  if (!text) return result(state, null, "empty");
  // nextId is rebuilt on load; checking live IDs also protects caller-supplied state.
  let nextId =
    Number.isSafeInteger(state.nextId) && state.nextId > 0 ? state.nextId : 1;
  while (state.messages.some((message) => message.id === `msg-${nextId}`))
    nextId += 1;
  const messageId = `msg-${nextId}`;
  const message = {
    id: messageId,
    contactId,
    text,
    direction: "outgoing",
    status: "pending",
    createdAt: isTime(now) ? now : Date.now(),
    willFail: fail === true,
  };
  return result(
    {
      ...state,
      messages: [...state.messages, message].slice(-MAX_STORED_MESSAGES),
      drafts: { ...state.drafts, [contactId]: "" },
      nextId: nextId + 1,
    },
    messageId,
  );
}

/** Settlement only changes a pending message; stale timers cannot replace a result. */
export function settleMessage(state, messageId, status) {
  if (!["sent", "failed"].includes(status)) return state;
  const message = state.messages.find((item) => item.id === messageId);
  if (
    !message ||
    message.direction !== "outgoing" ||
    message.status !== "pending"
  )
    return state;
  return {
    ...state,
    messages: state.messages.map((item) =>
      item.id === messageId ? { ...item, status, willFail: false } : item,
    ),
  };
}

/** A retry keeps the original message ID, text, position, and current draft. */
export function retryMessage(state, messageId, { fail = false } = {}) {
  const message = state.messages.find((item) => item.id === messageId);
  if (
    !message ||
    message.direction !== "outgoing" ||
    message.status !== "failed"
  )
    return result(state, null, "not-failed");
  if (
    state.messages.some(
      (item) =>
        item.contactId === message.contactId && item.status === "pending",
    )
  )
    return result(state, null, "pending");
  return result(
    {
      ...state,
      messages: state.messages.map((item) =>
        item.id === messageId
          ? { ...item, status: "pending", willFail: fail === true }
          : item,
      ),
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

/** Search uses the fictitious contact list, never persisted contact objects. */
export function findContacts(_state, query) {
  const search = normalizeSearch(query);
  return CONTACTS.filter((contact) =>
    normalizeSearch(contact.name).includes(search),
  );
}
