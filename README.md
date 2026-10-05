# VUEBOX

공식 **YouTube IFrame Player**로 영상을 재생하고, 시청 기록·이어보기·재생목록·좋아요·구독·추천을 **자체 계정(Supabase)** 으로 제공하는 개인화 영상 플랫폼입니다. 모든 개인 데이터는 Supabase DB에 저장되어 PC·태블릿·모바일에서 동일하게 보입니다.

```
React + Vite + TypeScript
 ├─ YouTube Data API v3  ← Supabase Edge Function `youtube` 를 통해서만 호출 (API 키는 서버에만)
 ├─ YouTube IFrame API   ← 영상 재생 (iframe 은 수정/우회하지 않음)
 └─ Supabase
     ├─ Auth (이메일+비밀번호)      ├─ PostgreSQL + RLS (14개 테이블)
     └─ Storage (avatars)          └─ Edge Functions (youtube, delete-account)
```

## 빠른 시작 (개발)

```bash
npm install
cp .env.example .env.local   # 값 채우기 (아래 Setup 참고)
npm run dev                  # http://localhost:5173
```

`.env.local` 이 없으면 앱은 설정 안내 화면을 보여줍니다.

## Setup

### 1. Supabase 프로젝트

1. <https://supabase.com/dashboard> 에서 새 프로젝트를 만듭니다. (**VUEBOX 전용 프로젝트를 권장**합니다. 마이그레이션이 `auth.users` 에 트리거를 추가하고 `public` 스키마에 테이블을 만들기 때문에 다른 앱과 DB를 공유하면 안 됩니다.)
2. **Project Settings → API Keys** 에서 `Project URL` 과 **publishable key** 를 복사해 `.env.local` 에 넣습니다.

   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   > service role / secret key 는 **절대** 프론트엔드나 `.env.local` 에 넣지 않습니다.
3. 마이그레이션 적용 (둘 중 하나):
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
   또는 SQL Editor 에서 `supabase/migrations/*.sql` 을 파일명 순서대로 실행합니다.
   - `…_schema.sql` 테이블, 트리거(가입 시 profile/settings/추천 프로필 자동 생성), 함수
   - `…_rls_storage.sql` RLS 정책, 권한, `avatars` 버킷 + Storage 정책
   - `…_snapshot_purge_schedule.sql` YouTube 데이터 스냅샷 자동 정리(아래 *정책* 참고)
4. **Authentication → URL Configuration**
   - Site URL: `http://localhost:5173` (배포 후에는 실제 도메인)
   - Redirect URLs: `http://localhost:5173/**` (+ 배포 도메인 `/**`)  ← 비밀번호 재설정/이메일 인증 링크가 돌아오는 주소
5. **Authentication → Providers → Email**: 활성화. 운영에서는 **Confirm email** 을 켜는 것을 권장합니다 (켜면 가입 후 메일 인증 안내가 표시됩니다). Google 등 소셜 로그인은 사용하지 않습니다.
   - **Password requirements**: 최소 8자 + 소문자/대문자/숫자 (프론트 검증과 동일). `supabase/config.toml` 에 같은 값이 들어 있습니다.
6. **Database → Extensions** 에서 `pg_cron` 을 켠 뒤 마이그레이션 3번을 다시 실행하거나, 아래를 한 번 실행합니다.
   ```sql
   select cron.schedule('vuebox-purge-youtube-snapshots', '17 3 * * *', 'select public.purge_stale_youtube_snapshots()');
   ```

### 2. YouTube Data API 키

1. <https://console.cloud.google.com> → 새 프로젝트 → **APIs & Services → Library → “YouTube Data API v3”** 사용 설정.
2. **Credentials → Create credentials → API key**. 키 제한에서 **API restrictions = YouTube Data API v3** 만 선택합니다. (호출은 Supabase 서버에서 나가므로 HTTP referrer 제한은 쓰지 않습니다.)
3. Supabase 에 시크릿으로 등록 (브라우저/저장소에 절대 넣지 않습니다):
   ```bash
   npx supabase secrets set YOUTUBE_API_KEY=<your key>
   # 선택: CORS 허용 도메인 (기본값은 모두 허용)
   npx supabase secrets set ALLOWED_ORIGINS=https://your-domain.example,http://localhost:5173
   ```
4. Edge Functions 배포:
   ```bash
   npx supabase functions deploy youtube
   npx supabase functions deploy delete-account
   ```
   (`supabase/config.toml` 에서 두 함수는 `verify_jwt = false` 입니다. 공개 페이지가 로그인 없이 동작해야 하고, 각 함수가 입력 검증·속도 제한·세션 확인을 직접 하기 때문입니다.)

기본 쿼터는 하루 10,000 units 입니다. 호출 비용은 아래 *쿼터 설계* 를 보세요.

### 3. 실행 / 배포

```bash
npm run dev       # 개발 서버
npm run build     # 프로덕션 빌드 (dist/)
npm run preview   # 빌드 결과 미리보기
```

`dist/` 는 정적 파일입니다. **GitHub Pages** 배포는 `.github/workflows/deploy.yml` 이 처리합니다 (`main` 에 푸시하면 타입체크 → 테스트 → 빌드 → 배포, 사이트 주소 `https://<user>.github.io/vuebox/`).

1. 저장소 **Settings → Pages → Source = GitHub Actions**
2. **Settings → Secrets and variables → Actions → Variables** 에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (선택: `VITE_CONTACT_EMAIL`) 추가 — 공개 값이라 Variables 에 넣어도 됩니다.
3. Supabase **Authentication → URL Configuration** 에 Pages 주소 추가 (Site URL 과 Redirect URLs `https://<user>.github.io/vuebox/**`).

빌드는 `GITHUB_ACTIONS` 일 때만 `base=/vuebox/` 를 쓰고, `404.html` 로 SPA 새로고침/직접 링크를 처리합니다. 다른 호스팅(Vercel/Netlify 등)은 모든 경로를 `index.html` 로 rewrite 하세요.

## 환경변수는 어디에 넣나

| 이름 | 위치 | 노출 | 설명 |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env.local` / 호스팅 환경변수 | 공개 | Supabase 프로젝트 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env.local` / 호스팅 환경변수 | 공개 | publishable key (RLS 로 보호됨) |
| `VITE_CONTACT_EMAIL` | 위와 동일 (선택) | 공개 | 개인정보/약관 페이지에 표시할 연락처 |
| `YOUTUBE_API_KEY` | `supabase secrets set` | **비밀** | Edge Function 에서만 사용 |
| `ALLOWED_ORIGINS` | `supabase secrets set` (선택) | 서버 | CORS 허용 도메인 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 가 Edge Function 에 자동 주입 | **비밀** | `delete-account` 에서만 사용 |

## 기능 → 구현 위치

| 기능 | 위치 |
| --- | --- |
| 공식 플레이어, 재생/일시정지/탐색/볼륨/속도/전체화면, 극장 모드, 단축키 | `src/features/player/*`, `src/pages/WatchPage.tsx` |
| 시청 기록 저장(15초 throttle, pause/ended/탭 숨김 즉시 저장), 이어보기 | `useWatchTracking.ts`, `historyService.ts`, Home `Continue Watching` |
| 검색 + 필터, 검색 기록 | `SearchPage.tsx`, `SearchBar.tsx`, `useSearchHistory.ts` |
| Home / Discover / Trending / Channel / Shorts | `src/pages/*`, `src/features/home/useHomeFeeds.ts` |
| 좋아요 · 즐겨찾기 · 나중에 보기 · 재생목록(정렬/Play All) · 구독 피드 | `useLibrary.ts`, `usePlaylists.ts`, `*Service.ts` |
| 추천 시스템 (규칙 기반, 다양성 보정) | `src/features/recommendations/*` — 가중치는 `config.ts` |
| 개인 메모 · 알림 · 통계 · 설정 · 프로필(아바타 업로드) | `features/notes`, `NotificationPanel.tsx`, `StatsPage.tsx`, `SettingsPage.tsx`, `ProfilePage.tsx` |

### 단축키 (페이지에 포커스가 있을 때)

`Space` 재생/일시정지 · `←/→` 5초 · `↑/↓` 볼륨 · `M` 음소거 · `F` 전체화면 · `T` 극장 모드. 입력창/모달/버튼에 포커스가 있을 때는 동작하지 않습니다. (플레이어 iframe 에 포커스가 있을 땐 YouTube 자체 단축키가 동작합니다.)

## 추천 시스템

사이트 안에서 발생한 행동만 사용합니다 (YouTube 내부 알고리즘 복제 아님).

- 입력: 시청 비율, 완료 여부, 검색어, 좋아요, 즐겨찾기, 나중에 보기, 재생목록 추가, 구독, 최근 활동
- 관심도: 시청 `<10% 0.05 · ≥10% 0.2 · ≥25% 0.5 · ≥50% 1 · ≥80% 2 · ≥95% 3`. 클릭만으로는 거의 점수가 오르지 않고, 같은 단계는 중복 반영되지 않습니다. 30일 반감기로 감쇠합니다.
- 점수: `categoryMatch .25 · channelMatch .20 · keywordMatch .20 · watchSimilarity .20 · freshness .10 · popularity .05` + 보너스(새 주제/새 채널/강한 일치) − 패널티(이미 시청/최근 노출). 이후 채널당 최대 2개, 카테고리 40% 상한으로 다양성 재정렬.
- 쓰기는 60초 단위로 모아서 한 번에 저장합니다 (`signalQueue.ts`). `Recommender` 인터페이스(`ranker.ts`)만 구현하면 ML 모델로 교체할 수 있습니다.

## 쿼터 설계 (YouTube Data API)

| 용도 | 호출 | 비용 |
| --- | --- | --- |
| 사용자의 명시적 검색 | `search.list` | **100** (+`videos.list` 1) |
| Trending / Discover / 카테고리 | `videos.list?chart=mostPopular` | 1 |
| 채널 영상 / 구독 피드 / 관련 영상 | `playlistItems.list`(uploads) + `videos.list` | 1–2 |
| 라이브러리/기록 목록 메타데이터 | `videos.list` (50개/요청) | 1 |

Home 은 섹션마다 검색하지 않고 **최대 1회** 검색만 사용하며, 서버 캐시(10분~24시간) + TanStack Query `staleTime` 으로 중복 요청을 막습니다. 쿼터 소진 시 서버가 10분간 YouTube 호출을 중단하고 사용자에게 안내 메시지를 보여줍니다.

## 보안

- `service_role` / YouTube API 키는 프론트 번들에 없습니다 (`dist` 를 grep 해서 확인할 수 있습니다).
- 모든 사용자 데이터 테이블에 RLS: `user_id = auth.uid()`. `playlist_items` 는 부모 재생목록 소유자 기준. 공개 재생목록만 익명 읽기 가능.
- Storage `avatars`: 읽기 공개, 쓰기/덮어쓰기/삭제는 `<내 uid>/` 폴더만, 2MB·png/jpeg/webp 제한.
- Edge Function: 입력 allowlist·정규식 검증, 요청 크기 제한, IP/사용자별 속도 제한, 응답 정규화(원본 payload 미노출).
- XSS: HTML 을 주입하지 않습니다 (설명의 링크는 React 엘리먼트로 `rel="noopener noreferrer nofollow"`). 아바타/썸네일 URL 은 DB 제약으로 `https://` 만 허용.
- 계정 삭제는 Edge Function 에서 JWT 검증 + 이메일 확인 후 service role 로 처리하며, 모든 FK 는 `ON DELETE CASCADE` 입니다.

## 테스트

```bash
npm test               # 단위 테스트 (추천 엔진, 통계, 포맷) + RLS 테스트
npm run test:rls       # RLS/제약 테스트만 — 실제 마이그레이션을 PGlite(WASM Postgres)에서 실행, Docker 불필요
npm run test:functions # youtube Edge Function 통합 테스트 (Deno + 가짜 YouTube API)
npm run typecheck && npm run lint
```

RLS 테스트(`supabase/tests/rls.test.ts`)는 anon / 본인 / 타인 접근, 다른 사용자 행 수정·삭제·소유자 변경 시도, 재생목록 공개 범위, Storage 정책, 계정 삭제 cascade 를 검증합니다. Supabase 고유 객체(roles, `auth.users`, `auth.uid()`, `storage.*`)는 테스트에서 스텁으로 대체하므로, 실제 프로젝트에서도 한 번 확인하세요.

## YouTube 정책 메모

- 영상은 공식 임베드 플레이어로만 재생하고, iframe 위에 UI 를 덮거나 수정하지 않습니다. 다운로드·프록시·재생 제한 우회 기능은 없습니다.
- YouTube API 데이터는 30일 이내에 갱신/삭제해야 합니다. 목록 화면은 항상 최신 메타데이터를 다시 조회하고, DB 의 제목/썸네일 스냅샷은 표시 실패 시의 대체값일 뿐이며 25일이 지나면 `purge_stale_youtube_snapshots()` 가 비웁니다.
- 좋아요/구독은 VUEBOX 내부 기능이며 YouTube 계정에는 영향이 없습니다 (UI 에도 명시).
- 개인정보 처리방침(`/privacy`)·이용약관(`/terms`)이 실제 구현과 일치하도록 작성되어 있습니다. 배포 전에 `VITE_CONTACT_EMAIL` 을 설정하고 내용을 검토하세요.

## 알려진 한계

- **Picture-in-Picture** 는 제공하지 않습니다. YouTube iframe 은 cross-origin 이라 페이지에서 PiP 를 시작할 수 없고, 가짜 버튼은 만들지 않았습니다 (플레이어 자체 메뉴/브라우저 기능 이용).
- **Shorts** 는 API 에 구분 플래그가 없어 “60초 이하 영상” 으로 표시합니다 (UI 에 명시).
- **관련 영상** 은 YouTube 의 `relatedToVideoId` 가 폐지되어 채널 업로드 + 카테고리 인기 영상을 로컬 추천기로 정렬해 보여줍니다.
- **Coding / Science** 카테고리는 YouTube 카테고리가 없어 검색(100 units, 캐시됨)을 사용합니다.
- 구독 피드는 쿼터 절약을 위해 최근 구독한 20개 채널까지 표시합니다.
- 아바타 외 `channel-images` 버킷은 만들지 않았습니다 (채널 이미지는 YouTube URL 을 그대로 사용).

## 폴더 구조

```
src/
  app/            AuthProvider, RequireAuth, SetupScreen
  components/     ui/ layout/ video/
  constants/      카테고리, 지역
  features/       player/ recommendations/ home/ notes/ stats/
  hooks/          useAuth, useSettings, useLibrary, usePlaylists, ...
  lib/            supabase, env, errors, queryClient, queryKeys
  pages/          라우트별 페이지 (lazy loaded)
  services/       youtubeService + Supabase 데이터 서비스
  stores/         zustand (auth, ui, toast)
  types/
supabase/
  migrations/     스키마, RLS, 스토리지, 스케줄
  functions/      youtube/, delete-account/, _shared/
  tests/          rls.test.ts, youtube-function.test.mjs
docs/             architecture.md
```
