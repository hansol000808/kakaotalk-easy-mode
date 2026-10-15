/** Explicit Korean phrase rules for a bounded demo, not an AI/search service. */
export const FEATURES = Object.freeze(
  [
    {
      id: "photo",
      title: "사진 보내기",
      description: "사진을 골라 친구에게 보내요.",
      keywords: ["사진 보내기", "앨범", "이미지 전송"],
      icon: "chats",
    },
    {
      id: "video-call",
      title: "영상 통화",
      description: "얼굴을 보면서 이야기해요.",
      keywords: ["영상 통화", "얼굴 보면서", "페이스톡"],
      icon: "friends",
    },
    {
      id: "voice-call",
      title: "음성 통화",
      description: "목소리로 이야기해요.",
      keywords: ["음성 통화", "전화 걸기", "보이스톡"],
      icon: "friends",
    },
    {
      id: "gift",
      title: "선물하기",
      description: "마음을 담은 선물을 골라 보내요.",
      keywords: ["선물", "생일", "커피", "케이크"],
      icon: "chats",
    },
    {
      id: "font",
      title: "글자 크기 바꾸기",
      description: "읽기 편하도록 글자를 크게 바꿔요.",
      keywords: ["글씨", "글자 크기", "잘 안 보여요"],
      icon: "help",
    },
    {
      id: "profile",
      title: "프로필 바꾸기",
      description: "내 프로필 그림과 이름, 소개 문구를 바꿔요.",
      keywords: ["프로필", "내 사진", "내 이름", "상태 메시지"],
      icon: "friends",
    },
    {
      id: "notification",
      title: "알림 설정",
      description: "알림을 켜거나 꺼요.",
      keywords: ["알림", "시끄러워", "소리", "무음"],
      icon: "help",
    },
    {
      id: "emoticon",
      title: "이모티콘 보내기",
      description: "표정으로 마음을 전해요.",
      keywords: ["이모티콘", "스티커", "하트"],
      icon: "chats",
    },
    {
      id: "voice-input",
      title: "음성으로 입력하기",
      description: "말로 메시지를 입력하는 흐름을 살펴봐요.",
      keywords: ["음성 입력", "말로 입력", "받아쓰기"],
      icon: "chats",
    },
  ].map((feature) =>
    Object.freeze({ ...feature, keywords: Object.freeze(feature.keywords) }),
  ),
);

export const EXAMPLES = Object.freeze([
  "사진 보내고 싶어",
  "얼굴 보면서 통화하고 싶어",
  "생일 선물 보내고 싶어",
  "글씨가 너무 작아",
  "내 사진 바꾸고 싶어",
  "알림 소리가 시끄러워",
]);

const response = (kind, ids, message) => ({
  kind,
  matches: FEATURES.filter((feature) => ids.has(feature.id)),
  message,
});
const none = (
  message = "이 체험에서 찾을 수 있는 기능이 아니에요. 예시처럼 하고 싶은 일을 한 가지 적어 주세요.",
) => response("none", new Set(), message);

export function searchFeatures(query) {
  if (typeof query !== "string" || !query.trim())
    return response("empty", new Set(), "하고 싶은 일을 편하게 적어 주세요.");
  if (Array.from(query).length > 200)
    return none("짧은 문장으로 하고 싶은 일 한 가지만 적어 주세요.");
  const text = query
    .normalize("NFC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s\p{P}\p{S}]/gu, "");
  if (!text)
    return response("empty", new Set(), "하고 싶은 일을 편하게 적어 주세요.");
  // Unsupported actions must not become superficially related supported ones.
  if (
    /삭제|지우|복구|백업|녹음|차단|신고|송금|계좌|결제|예약|다운로드|환불|구매취소|선물취소|통화기록|전화번호|연락처|사진편집|영상편집|동영상|영상(?:을)?(?:보내|전송|공유)|친구(?:를)?(?:찾|검색|추가)|친구이름|사람찾|(?:사진|이미지).{0,4}저장/.test(
      text,
    )
  )
    return none();
  const ids = new Set();
  const profile =
    /프로필|내사진|내얼굴|내이름|이름바꾸|이름변경|상태메시지|상태메세지|상태말|소개글|소개문구|대문사진/.test(
      text,
    );
  const photo = /사진|이미지|앨범/.test(text);
  const photoSend = /(?:사진|이미지|앨범).{0,18}(?:보내|전송|공유)/.test(text);
  const separatePhotoRequest =
    /(?:프로필|내사진).{0,15}(?:바꾸|변경).{0,8}사진|프로필(?:이랑|하고|과|와)사진|사진(?:이랑|하고|과|와)프로필|프로필말고사진/.test(
      text,
    );
  const video = /영상통화|페이스톡|화상통화|얼굴(?:을)?보|얼굴.{0,8}통화/.test(
    text,
  );
  const voice =
    /음성통화|보이스톡|목소리.{0,8}(?:통화|전화)|목소리로(?:대화|이야기)|목소리(?:만|를)?(?:듣|들)/.test(
      text,
    ) ||
    (!video && /전화(?:를)?(?:걸|하|해)/.test(text));
  const voiceInput =
    /음성입력|음성인식|받아쓰기|말로입력|말로쓰|말하면|말을글자|말한내용|목소리로입력|말로.{0,10}(?:메시지|문자|글|써|쓰)|음성으로.{0,10}(?:입력|메시지|문자|작성)|타자치기힘|키보드쓰기힘/.test(
      text,
    );
  if (profile) ids.add("profile");
  if (photo && (!profile || separatePhotoRequest)) {
    if (photoSend) ids.add("photo");
    else if (!ids.size || separatePhotoRequest) {
      ids.add("photo");
      ids.add("profile");
    }
  }
  if (video) ids.add("video-call");
  if (voice) ids.add("voice-call");
  if (/통화|전화|콜/.test(text) && !video && !voice) {
    ids.add("video-call");
    ids.add("voice-call");
  }
  if (/선물|기프티콘|기프티쿠폰|커피|케이크|생일/.test(text)) ids.add("gift");
  if (
    /글씨|폰트|글꼴|글자크기|글자.{0,8}(?:작|크|키우|줄이|확대)|화면.{0,8}(?:잘안보|작아|작아서)|눈이침침|잘안보여/.test(
      text,
    ) ||
    text === "글자"
  )
    ids.add("font");
  if (
    /알림|소리가시끄|시끄러|진동|무음|조용하게|소리끄|소리줄|소리(?:가)?안나|띵동|띠링|카톡소리/.test(
      text,
    ) &&
    !/통화.{0,8}(?:소리|볼륨)/.test(text)
  )
    ids.add("notification");
  if (
    /이모티콘|이모지|스티커|웃는얼굴|하트보내|표정보내/.test(text) ||
    text === "하트"
  )
    ids.add("emoticon");
  if (voiceInput) ids.add("voice-input");
  if (!ids.size) return none();
  if (
    /말고|아니라|안하고|안보내|보내지않|하지않|쓰지않|싶지않|필요없|원치않|안쓸|싫|원하지않|않고|않는|하지마|안할|말아/.test(
      text,
    )
  )
    return response(
      "ambiguous",
      ids,
      "하지 않으려는 기능이 함께 적혀 있어요. 원하는 기능을 확인하거나 한 가지 일을 다시 적어 주세요.",
    );
  if (
    /그리고|그러고|동시에|(?:보내|바꾸|키우|켜|끄|통화하|입력하|검색하|전송하|찾)고(?!싶)/.test(
      text,
    )
  )
    return response(
      "ambiguous",
      ids,
      "여러 일을 함께 적으셨네요. 원하는 기능을 하나 고르거나 한 가지 일만 다시 적어 주세요.",
    );
  if (ids.size > 1)
    return response(
      "ambiguous",
      ids,
      "여러 기능이 떠올라요. 하고 싶은 일을 하나 골라 주세요.",
    );
  return response("match", ids, "이 기능을 찾으셨나요?");
}
