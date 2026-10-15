import test from "node:test";
import assert from "node:assert/strict";
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
} from "../state.js";

test("empty state retains independent draft-only conversations without mutation", () => {
  const original = createInitialState("empty");
  const next = setDraft(
    setDraft(original, "seoyeon", "다음에 만나요\n"),
    "jeongwoo",
    "안녕",
  );
  assert.equal(original.drafts.seoyeon, "");
  assert.equal(original.messages.length, 0);
  assert.deepEqual(
    getConversations(next).map(({ contactId }) => contactId),
    ["seoyeon", "jeongwoo"],
  );
  assert.equal(next.drafts.seoyeon, "다음에 만나요\n");
});

test("blank messages preserve state and normal sends complete locally once", () => {
  for (const text of ["", "  \n\t", "\u3000"]) {
    const state = setDraft(createInitialState("empty"), "minji", text);
    assert.equal(sendMessage(state, "minji").error, "empty");
    assert.equal(sendMessage(state, "minji").state, state);
  }
  const initial = setDraft(
    createInitialState("empty"),
    "minji",
    " 안녕하세요 🙂 ",
  );
  const sent = sendMessage(initial, "minji", { now: 12345 });
  assert.equal(sent.accepted, true);
  assert.equal(sent.state.messages[0].text, "안녕하세요 🙂");
  assert.equal(sent.state.messages[0].createdAt, 12345);
  assert.equal(sent.state.messages[0].status, "sent");
  assert.equal(sent.state.messages[0].kind, "text");
  assert.equal(sent.state.drafts.minji, "");
  assert.equal(sendMessage(sent.state, "minji").error, "empty");
  assert.equal(initial.messages.length, 0);
});

test("sample media uses known IDs and preserves the existing draft", () => {
  let state = setDraft(createInitialState("empty"), "minji", "작성하던 문장");
  for (const [kind, payload] of [
    ["photo", "walk"],
    ["gift", "coffee"],
    ["emoticon", "heart"],
  ]) {
    const sent = sendMessage(state, "minji", { kind, payload });
    assert.equal(sent.accepted, true);
    state = sent.state;
    assert.equal(state.messages.at(-1).kind, kind);
    assert.equal(state.messages.at(-1).payload, payload);
    assert.equal(state.drafts.minji, "작성하던 문장");
  }
  assert.equal(
    sendMessage(state, "minji", {
      kind: "photo",
      payload: "https://foreign.example/image",
    }).error,
    "invalid-payload",
  );
  assert.equal(
    sendMessage(state, "minji", { kind: "gift", payload: "__proto__" }).error,
    "invalid-payload",
  );
  assert.equal(
    sendMessage(state, "minji", { kind: "photo", payload: { id: "walk" } })
      .error,
    "invalid-payload",
  );
  assert.equal(
    sendMessage(state, "minji", { kind: "payment" }).error,
    "unknown-kind",
  );
  assert.equal(
    sendMessage(state, "outsider", { kind: "photo", payload: "walk" }).error,
    "unknown-contact",
  );
});

test("explicit text sends preserve separately typed draft content", () => {
  const state = setDraft(createInitialState("empty"), "minji", "기존 초안");
  const sent = sendMessage(state, "minji", { text: "별도 입력한 문장" });
  assert.equal(sent.state.drafts.minji, "기존 초안");
  assert.equal(sent.state.messages[0].text, "별도 입력한 문장");
});

test("v2 roundtrip preserves content, preferences, mode, and valid media", () => {
  let state = setDraft(
    createInitialState(),
    "seoyeon",
    "작성 중인 내용\n그대로",
  );
  state = sendMessage(state, "minji", { kind: "gift", payload: "cake" }).state;
  state = updatePreferences(state, {
    fontSize: "large",
    notifications: false,
    profileName: "사용자",
    profileMood: "산책하기 좋은 날",
    profileAvatar: "flower",
  });
  state = setMode(state, "standard");
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))), state);
  assert.equal(setMode(state, "unsupported"), state);
});

test("v1 migration recovers unsent text into drafts without inventing delivery", () => {
  const legacy = {
    version: 1,
    mode: "standard",
    drafts: { minji: "기존 초안", seoyeon: "", jeongwoo: "" },
    messages: [
      {
        id: "msg-1",
        contactId: "minji",
        text: "이미 보낸 내용",
        direction: "outgoing",
        status: "sent",
        createdAt: 1,
      },
      {
        id: "msg-2",
        contactId: "minji",
        text: "아직 보내지 않은 내용",
        direction: "outgoing",
        status: "pending",
        createdAt: 2,
      },
      {
        id: "msg-3",
        contactId: "seoyeon",
        text: "보관할 내용",
        direction: "outgoing",
        status: "failed",
        createdAt: 3,
      },
    ],
  };
  const migrated = validateState(legacy);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.mode, "standard");
  assert.deepEqual(
    migrated.messages.map(({ text }) => text),
    ["이미 보낸 내용"],
  );
  assert.equal(migrated.drafts.minji, "기존 초안\n아직 보내지 않은 내용");
  assert.equal(migrated.drafts.seoyeon, "보관할 내용");
  assert.equal(migrated.nextId, 4);
  assert.equal(legacy.drafts.minji, "기존 초안");
  assert.equal(
    migrated.messages.every(({ status }) => status === "sent"),
    true,
  );
  const roundtrip = validateState(JSON.parse(JSON.stringify(migrated)));
  assert.deepEqual(roundtrip.messages, migrated.messages);
  assert.deepEqual(roundtrip.drafts, migrated.drafts);
});

test("migration bounds combined drafts and v2 rejects unknown delivery statuses", () => {
  const legacy = {
    version: 1,
    drafts: { minji: "🙂".repeat(495) },
    messages: [
      {
        id: "msg-1",
        contactId: "minji",
        text: "추가 내용이 길어요",
        direction: "outgoing",
        status: "pending",
        createdAt: 1,
      },
    ],
  };
  const migrated = validateState(legacy);
  assert.equal(Array.from(migrated.drafts.minji).length, 500);
  assert.equal(migrated.drafts.minji.startsWith("🙂".repeat(495)), true);
  const corrupt = createInitialState();
  corrupt.messages[0].status = "pending";
  assert.equal(validateState(corrupt).messages.length, 0);
});

test("preferences whitelist fields and constrain values and visible string lengths", () => {
  const original = createInitialState("empty");
  const state = updatePreferences(
    original,
    JSON.parse(
      '{"fontSize":"large","notifications":false,"profileName":"  새 이름  ","profileMood":"","__proto__":{"admin":true},"token":"secret"}',
    ),
  );
  assert.deepEqual(state.preferences, {
    fontSize: "large",
    notifications: false,
    profileName: "새 이름",
    profileMood: "",
    profileAvatar: "smile",
  });
  assert.equal(original.preferences.profileName, "나");
  assert.equal({}.admin, undefined);
  assert.deepEqual(
    updatePreferences(state, {
      fontSize: "huge",
      notifications: "yes",
      profileName: " ",
      profileMood: null,
      profileAvatar: "https://foreign.example/avatar",
    }).preferences,
    state.preferences,
  );
  const bounded = updatePreferences(state, {
    profileName: "🙂".repeat(30),
    profileMood: "🙂".repeat(100),
  });
  assert.equal(Array.from(bounded.preferences.profileName).length, 20);
  assert.equal(Array.from(bounded.preferences.profileMood).length, 80);
});

test("profile avatars accept only the three local sample IDs and migrate a default", () => {
  const state = createInitialState("empty");
  for (const profileAvatar of ["smile", "flower", "mountain"]) {
    const changed = updatePreferences(state, { profileAvatar });
    assert.equal(changed.preferences.profileAvatar, profileAvatar);
    assert.equal(
      validateState(JSON.parse(JSON.stringify(changed))).preferences
        .profileAvatar,
      profileAvatar,
    );
  }
  for (const profileAvatar of ["../secret", "__proto__", null, { id: "smile" }])
    assert.equal(
      updatePreferences(state, { profileAvatar }).preferences.profileAvatar,
      "smile",
    );
  const legacy = { version: 1, messages: [], drafts: {} };
  assert.equal(validateState(legacy).preferences.profileAvatar, "smile");
});

test("limits count Unicode code points and HTML-looking text remains string data", () => {
  const long = setDraft(
    createInitialState("empty"),
    "minji",
    "🙂".repeat(MAX_MESSAGE_LENGTH + 10),
  );
  assert.equal(long.drafts.minji, "🙂".repeat(MAX_MESSAGE_LENGTH));
  const html =
    '<img src=x onerror="alert(1)"><script>globalThis.injected=true</script>';
  const sent = sendMessage(createInitialState("empty"), "minji", {
    text: html,
  });
  assert.equal(
    validateState(JSON.parse(JSON.stringify(sent.state))).messages[0].text,
    html,
  );
  assert.equal(globalThis.injected, undefined);
});

test("corrupt storage cannot inject foreign contacts, media, or duplicate IDs", () => {
  for (const value of [
    null,
    [],
    {},
    { version: 3, drafts: {}, messages: [] },
    { version: 2, drafts: {}, messages: "bad" },
  ])
    assert.equal(validateState(value).version, 2);
  const source = createInitialState();
  source.messages.push(
    source.messages[0],
    null,
    { ...source.messages[0], id: "msg-99", contactId: "outsider" },
    { ...source.messages[0], id: "msg-100", createdAt: Infinity },
    { ...source.messages[0], id: "msg-101", kind: "photo", payload: "foreign" },
  );
  source.drafts = { minji: {}, seoyeon: "x".repeat(800), outsider: "private" };
  source.nextId = -10;
  const restored = validateState(source);
  assert.equal(restored.messages.length, 1);
  assert.deepEqual(Object.keys(restored.drafts), [
    "minji",
    "seoyeon",
    "jeongwoo",
  ]);
  assert.equal(restored.drafts.minji, "");
  assert.equal(restored.drafts.seoyeon.length, 500);
  assert.equal(
    sendMessage(restored, "minji", { text: "다음" }).messageId,
    "msg-2",
  );
  assert.equal(setDraft(restored, "__proto__", "bad"), restored);
  assert.equal(Object.isFrozen(CONTACTS), true);
});

test("history retention is limited to the newest 300 entries", () => {
  let state = createInitialState("empty");
  for (let index = 0; index < 305; index += 1)
    state = sendMessage(state, "minji", {
      text: `메시지 ${index}`,
      now: index,
    }).state;
  assert.equal(state.messages.length, 300);
  assert.equal(state.messages[0].text, "메시지 5");
  assert.equal(validateState(state).messages.length, 300);
});
