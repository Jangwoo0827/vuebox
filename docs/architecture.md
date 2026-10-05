# VUEBOX 아키텍처

## 요청 흐름

```
Browser (React SPA, publishable key only)
 │
 ├─ supabase-js ──► Auth (세션)            ──► auth.users ─(trigger)─► profiles / user_settings / recommendation_profiles
 │               └► PostgREST (RLS) ───────► 개인 데이터 테이블 (user_id = auth.uid())
 │               └► Storage (avatars/<uid>/…)
 │
 ├─ fetch /functions/v1/youtube ──► Edge Function ──► YouTube Data API v3   (YOUTUBE_API_KEY: 서버 전용)
 │                                   · allowlist 검증 · 캐시 · 속도 제한 · 쿼터 차단기 · 응답 정규화
 │
 └─ YouTube IFrame Player API ──► 공식 iframe (수정/오버레이 없음)
```

## 시청 → 이어보기 → 추천

1. `WatchPage` 가 `watch_history` 의 해당 행을 먼저 조회 → 완료/95% 이상이면 처음부터, 아니면 `playerVars.start` 로 이어서 재생(“처음부터” 토스트 액션 제공).
2. `useWatchTracking`: 첫 재생 즉시 upsert → 재생 중 15초마다(최소 2초 간격) → pause/ended/탭 숨김/페이지 이탈/영상 전환 시 즉시 저장. `(user_id, video_id)` unique + `on_conflict` 로 영상당 1행.
3. 저장 시 진행 단계(`watchInterestDelta`)가 올라간 경우에만 관심 신호를 `signalQueue` 에 추가 → 60초마다 한 번 `recommendation_profiles` 갱신 + `recommendation_events` 배치 insert.
4. Home 은 profile/history/impressions/subscriptions 로 `RankingContext` 를 만들고 `RuleBasedRecommender` 로 후보 풀(인기 차트, 관심 카테고리 차트, 구독 업로드, 검색 1회, 같은 채널 업로드)을 정렬합니다.
5. 같은 계정으로 다른 기기에서 로그인하면 위 데이터가 모두 DB 에 있으므로 동일하게 표시됩니다 (로컬 스토리지에는 테마/사이드바 같은 기기별 UI 설정만 저장).

## 접근 제어 매트릭스

| 테이블 | anon | authenticated (본인) | authenticated (타인) |
| --- | --- | --- | --- |
| profiles | ✗ | select/update | ✗ |
| user_settings, recommendation_profiles | ✗ | select/insert/update | ✗ |
| watch_history, search_history, watch_later, favorites, video_likes, subscriptions, notifications, video_notes | ✗ | CRUD | ✗ |
| recommendation_events | ✗ | select/insert/delete (수정 불가) | ✗ |
| playlists | 공개(visibility=public)만 select | CRUD | 공개만 select |
| playlist_items | 공개 재생목록의 항목만 select | 본인 재생목록 항목 CRUD | 공개 재생목록 항목 select |
| storage.objects (avatars) | public URL 읽기 | `<uid>/` 폴더에 한해 CRUD | ✗ |

모든 정책은 `(select auth.uid())` 형태로 작성되어 행마다 재평가되지 않습니다. 계정 삭제 시 모든 FK(`auth.users` → 각 테이블, `playlists` → `playlist_items`)가 `ON DELETE CASCADE`.

## 설계 결정

- **백엔드 서버 없음**: 보안이 필요한 로직은 Edge Function 두 개(`youtube`, `delete-account`)로 한정.
- **TanStack Query** 가 서버 상태, **zustand** 는 인증 세션/UI/토스트만. 사용자 데이터를 localStorage 에 두지 않습니다.
- **플레이어는 영상마다 새로 마운트** (`key={videoId}`): 이어보기 위치와 추적 세션이 영상 단위로 깔끔하게 시작됩니다.
- **YouTube 메타데이터는 저장하지 않는 것이 기본**: 좋아요/즐겨찾기/나중에 보기는 `video_id` 만 저장하고 표시 때 `videos.list` 로 조회. 기록/재생목록의 스냅샷은 대체값이며 25일 후 비워집니다.
- 에러는 섹션 단위로 격리 (`ErrorBoundary`, 섹션별 로딩/에러 상태). 쿼터/인증/404 오류는 자동 재시도하지 않습니다.
