import test from "node:test";
import assert from "node:assert/strict";
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
} from "../state.js";

test("empty scenario can start a draft-only conversation without mutating original state", () => {
  const original = createInitialState("empty");
  assert.equal(getConversations(original).length, 0);
  const next = setDraft(original, "seoyeon", "다음에 만나요\n");
  assert.equal(original.drafts.seoyeon, "");
  assert.deepEqual(
    getConversations(next).map(({ contactId, draft, hasDraft }) => ({
      contactId,
      draft,
      hasDraft,
    })),
    [{ contactId: "seoyeon", draft: "다음에 만나요\n", hasDraft: true }],
  );
});

test("blank and whitespace sends are rejected without consuming drafts or message IDs", () => {
  for (const text of ["", "  \n\t", "\u3000"]) {
    const state = setDraft(createInitialState("empty"), "minji", text);
    const sent = sendMessage(state, "minji");
    assert.equal(sent.accepted, false);
    assert.equal(sent.error, "empty");
    assert.equal(sent.state, state);
    assert.equal(sent.state.drafts.minji, text);
    assert.equal(sent.messageId, null);
  }
});

test("sending moves text to one pending bubble and repeated send cannot duplicate it", () => {
  const initial = setDraft(
    createInitialState("empty"),
    "minji",
    " 안녕하세요 🙂 ",
  );
  const sending = sendMessage(initial, "minji", { now: 12345 });
  assert.equal(sending.accepted, true);
  assert.equal(sending.state.drafts.minji, "");
  assert.equal(sending.state.messages[0].text, "안녕하세요 🙂");
  assert.equal(sending.state.messages[0].createdAt, 12345);
  assert.equal(sending.state.messages[0].status, "pending");
  const typingNext = setDraft(sending.state, "minji", "다음 메시지");
  const repeated = sendMessage(typingNext, "minji");
  assert.equal(repeated.error, "pending");
  assert.equal(repeated.state.messages.length, 1);
  assert.equal(repeated.state.drafts.minji, "다음 메시지");
  assert.equal(initial.messages.length, 0);
});

test("failed retry preserves bubble identity and independent draft, and ignores double retry", () => {
  let state = setDraft(createInitialState("empty"), "minji", "고마워요.");
  const sent = sendMessage(state, "minji", { fail: true, now: 100 });
  assert.equal(sent.state.messages[0].willFail, true);
  state = settleMessage(sent.state, sent.messageId, "failed");
  state = setDraft(state, "minji", "별도로 작성한 초안");
  const retried = retryMessage(state, sent.messageId);
  assert.equal(retried.accepted, true);
  assert.equal(retried.messageId, sent.messageId);
  assert.equal(retried.state.messages.length, 1);
  assert.equal(retried.state.messages[0].text, "고마워요.");
  assert.equal(retried.state.messages[0].createdAt, 100);
  assert.equal(retried.state.drafts.minji, "별도로 작성한 초안");
  assert.equal(retryMessage(retried.state, sent.messageId).accepted, false);
  const complete = settleMessage(retried.state, sent.messageId, "sent");
  assert.equal(complete.messages[0].status, "sent");
  assert.equal(settleMessage(complete, sent.messageId, "failed"), complete);
});

test("pending guard is contact-specific, with failed retry waiting for another send", () => {
  let state = createInitialState("failure");
  state = setDraft(state, "minji", "새 메시지");
  const minji = sendMessage(state, "minji");
  assert.equal(retryMessage(minji.state, "msg-2").error, "pending");
  const seoyeon = sendMessage(
    setDraft(minji.state, "seoyeon", "안녕하세요"),
    "seoyeon",
  );
  assert.equal(seoyeon.accepted, true);
  assert.notEqual(seoyeon.messageId, minji.messageId);
});

test("mode switch and reload preserve all settled history and per-contact drafts", () => {
  let state = setDraft(
    createInitialState("failure"),
    "seoyeon",
    "작성 중인 내용\n그대로",
  );
  state = setMode(state, "standard");
  const restored = validateState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.mode, "standard");
  assert.deepEqual(restored.messages, state.messages);
  assert.deepEqual(restored.drafts, state.drafts);
  assert.equal(setMode(state, "unsupported"), state);
  assert.equal(setMode(state, "easy").messages, state.messages);
});

test("reload recovers interrupted pending delivery as one retriable failed message", () => {
  const sending = sendMessage(
    setDraft(createInitialState("empty"), "minji", "창을 닫아도 보존"),
    "minji",
  );
  const restored = validateState(JSON.parse(JSON.stringify(sending.state)));
  assert.equal(restored.messages.length, 1);
  assert.equal(restored.messages[0].id, sending.messageId);
  assert.equal(restored.messages[0].status, "failed");
  assert.equal(restored.drafts.minji, "");
  const retried = retryMessage(restored, sending.messageId);
  assert.equal(retried.accepted, true);
  assert.equal(retried.state.messages.length, 1);
});

test("Unicode name search supports canonical-equivalent Korean and incidental whitespace", () => {
  const state = createInitialState();
  assert.deepEqual(
    findContacts(state, "김민지".normalize("NFD")).map(({ id }) => id),
    ["minji"],
  );
  assert.deepEqual(
    findContacts(state, " 박 서 연 ").map(({ id }) => id),
    ["seoyeon"],
  );
  assert.deepEqual(
    findContacts(state, "정우").map(({ id }) => id),
    ["jeongwoo"],
  );
  assert.equal(findContacts(state, "없는 친구").length, 0);
  assert.equal(findContacts(state, "").length, 3);
});

test("message length limit counts Unicode code points without breaking emoji", () => {
  const state = setDraft(
    createInitialState("empty"),
    "minji",
    "🙂".repeat(MAX_MESSAGE_LENGTH + 20),
  );
  assert.equal(Array.from(state.drafts.minji).length, MAX_MESSAGE_LENGTH);
  assert.equal(state.drafts.minji, "🙂".repeat(MAX_MESSAGE_LENGTH));
  const sent = sendMessage(state, "minji");
  assert.equal(sent.state.messages[0].text, state.drafts.minji);
});

test("HTML-looking message content stays verbatim inert string data", () => {
  const html =
    '<img src=x onerror="alert(1)"><script>globalThis.injected=true</script>';
  const sending = sendMessage(
    setDraft(createInitialState("empty"), "minji", html),
    "minji",
  );
  const restored = validateState(JSON.parse(JSON.stringify(sending.state)));
  assert.equal(restored.messages[0].text, html);
  assert.equal(typeof restored.messages[0].text, "string");
  assert.equal(globalThis.injected, undefined);
  // Rendering must use textContent; this engine intentionally does not build HTML.
});

test("invalid storage envelopes recover fresh state without trusting injected metadata", () => {
  for (const corrupt of [
    null,
    [],
    "broken",
    {},
    { version: 2, messages: [], drafts: {} },
    { version: 1, messages: "bad", drafts: {} },
  ]) {
    const restored = validateState(corrupt);
    assert.equal(restored.version, 1);
    assert.equal(restored.mode, "easy");
    assert.equal(restored.messages[0].contactId, "minji");
  }
  assert.equal(Object.isFrozen(CONTACTS), true);
});

test("partial corrupted records, duplicate IDs and foreign contacts are discarded safely", () => {
  const source = createInitialState("failure");
  const corrupt = JSON.parse(JSON.stringify(source));
  corrupt.mode = "<script>";
  corrupt.nextId = -100;
  corrupt.contacts = [{ id: "outsider", name: "real person" }];
  corrupt.drafts = {
    minji: { unsafe: "not a string" },
    seoyeon: "x".repeat(800),
    outsider: "private",
  };
  corrupt.messages.push(
    source.messages[0],
    null,
    { ...source.messages[0], id: "msg-99", contactId: "outsider" },
    { ...source.messages[0], id: "msg-100", createdAt: Infinity },
    { ...source.messages[0], id: "msg-101", text: {} },
  );
  const restored = validateState(corrupt);
  assert.equal(restored.messages.length, 2);
  assert.deepEqual(Object.keys(restored.drafts), [
    "minji",
    "seoyeon",
    "jeongwoo",
  ]);
  assert.equal(restored.drafts.minji, "");
  assert.equal(restored.drafts.seoyeon.length, MAX_MESSAGE_LENGTH);
  assert.equal(restored.mode, "easy");
  assert.equal(restored.contacts, undefined);
  const sending = sendMessage(
    setDraft(restored, "minji", "새 메시지"),
    "minji",
  );
  assert.equal(sending.messageId, "msg-3");
});

test("unknown contacts and invalid settlement cannot alter existing data", () => {
  const state = createInitialState();
  assert.equal(setDraft(state, "__proto__", "bad"), state);
  assert.equal(sendMessage(state, "outsider").error, "unknown-contact");
  assert.equal(settleMessage(state, "msg-1", "failed"), state);
  assert.equal(settleMessage(state, "missing", "sent"), state);
  assert.equal(settleMessage(state, "msg-1", "invented"), state);
  assert.equal(retryMessage(state, "msg-1").error, "not-failed");
});
