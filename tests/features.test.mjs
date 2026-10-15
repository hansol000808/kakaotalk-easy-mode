import test from "node:test";
import assert from "node:assert/strict";
import { FEATURES, EXAMPLES, searchFeatures } from "../features.js";
const ids = (query) => searchFeatures(query).matches.map(({ id }) => id);

test("all displayed examples find the corresponding feature", () => {
  const expected = [
    "photo",
    "video-call",
    "gift",
    "font",
    "profile",
    "notification",
  ];
  EXAMPLES.forEach((query, index) => {
    assert.equal(searchFeatures(query).kind, "match", query);
    assert.deepEqual(ids(query), [expected[index]], query);
  });
});

test("common Korean paraphrases find supported feature actions", () => {
  for (const [id, queries] of Object.entries({
    photo: [
      "사진을 친구에게 보내고 싶어요",
      "이미지 전송",
      "앨범에서 사진 보내기",
    ],
    "video-call": [
      "얼굴을 보며 이야기하고 싶어요",
      "페이스톡 어디 있어요?",
      "화상 통화",
      "얼굴 보면서 전화하고 싶어요",
    ],
    "voice-call": [
      "보이스톡 하고 싶어",
      "전화 걸고 싶어요",
      "목소리만 듣고 싶어",
    ],
    gift: ["생일 축하 선물", "커피 선물을 보내고 싶어요", "기프티콘 보내기"],
    font: ["글자를 좀 키우고 싶어요", "화면이 잘 안 보여요", "글꼴 크기"],
    profile: [
      "프로필 사진 바꾸기",
      "내 이름 바꾸기",
      "상태 메시지 수정",
      "내사진",
    ],
    notification: [
      "무음으로 해줘",
      "알림을 끄고 싶어요",
      "소리가 안 나게 해줘",
    ],
    emoticon: ["이모티콘 보내고 싶어", "하트 보내기", "스티커 찾고 싶어요"],
    "voice-input": [
      "말로 입력하고 싶어요",
      "말로 메시지 쓰기",
      "받아쓰기",
      "음성으로 메시지 작성",
    ],
  }))
    for (const query of queries) {
      assert.equal(searchFeatures(query).kind, "match", query);
      assert.deepEqual(ids(query), [id], query);
    }
});

test("ambiguous calls and photos offer alternatives with profile precedence", () => {
  assert.equal(searchFeatures("통화하고 싶어").kind, "ambiguous");
  assert.deepEqual(ids("통화하고 싶어"), ["video-call", "voice-call"]);
  assert.equal(searchFeatures("사진").kind, "ambiguous");
  assert.deepEqual(ids("사진"), ["photo", "profile"]);
  assert.deepEqual(ids("내 사진을 바꾸고 싶어"), ["profile"]);
  assert.deepEqual(ids("프로필 사진 바꾸기"), ["profile"]);
});

test("negation and multiple actions are not silently reduced to one action", () => {
  for (const query of [
    "사진 보내기 싫어",
    "사진 안 보내고 싶어",
    "음성 통화하고 싶지 않아",
    "선물 필요 없어",
    "통화 말고 사진 보내기",
    "사진 보내고 선물도 보내고 싶어",
    "프로필 바꾸고 사진 보내기",
    "글씨 키우고 알림 끄기",
    "사진 보내고 날씨 알려줘",
    "프로필과 사진",
  ])
    assert.equal(searchFeatures(query).kind, "ambiguous", query);
  assert.deepEqual(ids("프로필 바꾸고 사진 보내기"), ["photo", "profile"]);
});

test("unknown operations never route to superficially related supported ones", () => {
  for (const query of [
    "보내고 싶어",
    "바꿔줘",
    "도와줘",
    "김민지",
    "날씨 알려줘",
    "돈 보내고 싶어",
    "사진 삭제",
    "사진 복구",
    "통화 녹음",
    "전화번호 바꾸기",
    "선물 취소",
    "사진 보내고 통화 녹음하기",
    "동영상 보내기",
    "영상 전송",
    "친구 찾기",
    "친구 이름 검색",
    "사진 저장",
    "선물 환불",
    "동영상 보내고 선물도 보내기",
  ]) {
    assert.equal(searchFeatures(query).kind, "none", query);
    assert.deepEqual(ids(query), [], query);
  }
});

test("canonical-equivalent Korean and punctuation retain intended matches", () => {
  assert.deepEqual(ids("글씨가 너무 작아".normalize("NFD")), ["font"]);
  assert.deepEqual(ids("사진! 보내고, 싶어요?"), ["photo"]);
  assert.deepEqual(ids("  영 상   통 화  "), ["video-call"]);
  for (const query of ["", "   ", null])
    assert.equal(searchFeatures(query).kind, "empty");
  assert.equal(searchFeatures("사진".repeat(150)).kind, "none");
});

test("results are restricted to immutable catalog entries without echoing markup", () => {
  const result = searchFeatures("<img src=x onerror=alert(1)> 알 수 없는 요청");
  assert.equal(result.kind, "none");
  assert.equal(result.message.includes("<img"), false);
  assert.equal(FEATURES.length, 9);
  assert.equal(new Set(FEATURES.map(({ id }) => id)).size, 9);
  assert.equal(Object.isFrozen(FEATURES), true);
  for (const feature of FEATURES) assert.equal(Object.isFrozen(feature), true);
});
