import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { env } from '@/lib/env'
import { usePageTitle } from '@/hooks/usePageTitle'

function Doc({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl [&_a]:text-accent [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:my-2 [&_p]:text-text-secondary [&_li]:text-text-secondary [&_ul]:my-2">
      <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-text-secondary">최종 수정일: {updated}</p>
      {children}
    </article>
  )
}

const Contact = () => (
  <p>{env.contactEmail ? <>문의: <a href={`mailto:${env.contactEmail}`}>{env.contactEmail}</a></> : '문의는 서비스 운영자에게 직접 전달해 주세요.'}</p>
)

export function PrivacyPage() {
  usePageTitle('개인정보 처리방침')
  return (
    <Doc title="개인정보 처리방침" updated="2026-10-05">
      <p>VUEBOX는 공식 YouTube 플레이어로 영상을 재생하면서, 시청 기록·재생목록·추천 등 개인화 기능을 자체 계정으로 제공하는 서비스입니다. 아래는 이 서비스가 실제로 수집·사용하는 정보입니다.</p>

      <h2>1. 수집하는 정보</h2>
      <ul>
        <li><strong>계정 정보</strong>: 이메일, 비밀번호(Supabase Auth가 해시로 관리하며 VUEBOX 데이터베이스에는 저장하지 않습니다), 사용자 이름, 표시 이름, 프로필 사진, 소개.</li>
        <li><strong>시청 기록</strong>: 영상 ID, 영상 제목·썸네일·채널명 등 표시용 정보, 재생 위치, 시청 비율, 누적 시청 시간, 완료 여부, 시청 시각.</li>
        <li><strong>검색 기록</strong>: 검색어와 검색 시각 (설정에서 끌 수 있습니다).</li>
        <li><strong>라이브러리</strong>: 좋아요, 즐겨찾기, 나중에 볼 영상, 재생목록과 그 항목, 채널 구독. 이는 VUEBOX 내부 기능이며 회원의 YouTube 계정에는 아무 영향도 주지 않습니다.</li>
        <li><strong>개인 메모</strong>: 영상 시점별 메모. 본인만 볼 수 있습니다.</li>
        <li><strong>추천 데이터</strong>: 관심 카테고리·키워드·채널 점수, 그리고 최소한의 이벤트 로그(사용자, 영상 ID, 이벤트 종류, 시각 — 노출·클릭·재생·일시정지·완료·저장·좋아요).</li>
        <li><strong>설정</strong>: 테마, 자동재생, 기록 저장 여부, 맞춤 추천 여부, 알림, 지역, 기본 재생 속도.</li>
      </ul>

      <h2>2. 이용 목적</h2>
      <p>로그인 유지, 이어보기, 여러 기기 간 동기화, 개인화 추천, 시청 통계, 알림 제공에만 사용합니다. 광고 목적으로 사용하거나 제3자에게 판매하지 않습니다.</p>

      <h2>3. 저장 위치</h2>
      <p>모든 개인 데이터는 Supabase(PostgreSQL, Auth, Storage)에 저장되며, 행 수준 보안(RLS)으로 본인만 자신의 데이터를 읽고 수정할 수 있습니다. 프로필 사진은 Supabase Storage의 <code>avatars</code> 버킷에 저장되며 공개 URL로 제공됩니다. 브라우저에는 로그인 세션과 화면 설정(테마, 사이드바 상태 등) 정도만 저장됩니다.</p>

      <h2>4. 시청 기록과 추천 시스템</h2>
      <p>VUEBOX 안에서 이루어진 시청·검색·좋아요·저장 행동만으로 추천을 계산합니다. YouTube의 내부 추천 알고리즘이나 YouTube 계정 정보는 사용하지 않습니다. 설정의 <em>맞춤 추천</em>을 끄면 새로운 행동이 추천에 반영되지 않습니다.</p>

      <h2>5. YouTube 및 제3자 서비스</h2>
      <p>영상은 YouTube 공식 임베드 플레이어로 재생됩니다. 재생 중 YouTube(Google)가 쿠키 등을 통해 별도로 정보를 수집할 수 있으며, 이는 <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google 개인정보처리방침</a>의 적용을 받습니다. 검색·영상 정보는 YouTube Data API를 서버를 통해 조회하며, <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube 서비스 약관</a>이 적용됩니다.</p>
      <p>YouTube에서 가져온 공개 정보(제목, 썸네일 등)는 표시를 위한 스냅샷으로만 저장하며, 25일이 지나면 자동으로 삭제되거나 최신 정보로 갱신됩니다. 목록 화면은 항상 YouTube에서 최신 정보를 다시 조회해 표시합니다.</p>

      <h2>6. 삭제와 권리</h2>
      <ul>
        <li>설정 &gt; Privacy에서 시청 기록, 검색 기록, 활동·추천 데이터를 언제든 삭제할 수 있습니다. 검색어는 최근 검색 목록에서 개별 삭제도 가능합니다.</li>
        <li>설정 &gt; Account에서 계정을 삭제하면 계정과 모든 관련 데이터(프로필 사진 포함)가 즉시 영구 삭제됩니다.</li>
        <li>이 삭제는 VUEBOX에 저장된 데이터에만 적용되며, YouTube/Google이 보유한 정보에는 영향을 주지 않습니다.</li>
      </ul>

      <h2>7. 문의</h2>
      <Contact />
      <p>이 방침이 바뀌면 이 페이지에 변경된 날짜와 함께 게시합니다. <Link to="/terms">이용약관</Link>도 함께 확인해 주세요.</p>
    </Doc>
  )
}

export function TermsPage() {
  usePageTitle('이용약관')
  return (
    <Doc title="이용약관" updated="2026-10-05">
      <h2>1. 서비스</h2>
      <p>VUEBOX는 YouTube의 공개 영상을 검색하고 공식 YouTube 임베드 플레이어로 재생하며, 시청 기록·재생목록·좋아요·구독 등 개인화 기능을 제공하는 서비스입니다. VUEBOX는 YouTube 또는 Google과 제휴하거나 보증받은 서비스가 아닙니다.</p>

      <h2>2. YouTube 약관</h2>
      <p>VUEBOX를 이용하면 <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube 서비스 약관</a>에 동의하는 것으로 간주됩니다. 영상 재생과 영상 정보는 YouTube IFrame Player API와 YouTube Data API를 통해 제공되며, Google 개인정보처리방침은 <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">여기</a>에서 확인할 수 있습니다.</p>

      <h2>3. 콘텐츠</h2>
      <p>영상은 VUEBOX 서버에 저장·복제·중계되지 않습니다. 모든 영상의 저작권은 각 권리자에게 있으며, 영상 소유자가 외부 재생을 허용하지 않은 영상은 재생되지 않을 수 있습니다. VUEBOX의 다운로드, 재생 제한 우회, 광고 차단 등의 기능은 제공하지 않으며 그러한 목적으로 서비스를 이용할 수 없습니다.</p>

      <h2>4. 계정</h2>
      <ul>
        <li>정확한 이메일로 가입해야 하며, 계정과 비밀번호의 관리 책임은 회원에게 있습니다.</li>
        <li>VUEBOX의 좋아요·구독·재생목록은 서비스 내부 기능이며 YouTube 계정에 반영되지 않습니다.</li>
        <li>회원은 언제든 설정에서 계정을 삭제할 수 있습니다.</li>
      </ul>

      <h2>5. 금지 행위</h2>
      <ul>
        <li>서비스 또는 YouTube API에 과도한 요청을 보내거나 자동화된 방식으로 데이터를 수집하는 행위</li>
        <li>다른 회원의 데이터에 접근하거나 보안 기능을 우회하려는 시도</li>
        <li>불법적이거나 타인의 권리를 침해하는 목적의 이용</li>
      </ul>

      <h2>6. 서비스 제공과 책임 제한</h2>
      <p>서비스는 YouTube API의 사용량 제한, 정책 변경 등으로 예고 없이 일부 기능이 제한되거나 변경될 수 있습니다. 서비스는 &quot;있는 그대로&quot; 제공되며, 법이 허용하는 범위에서 운영자는 서비스 이용으로 발생한 손해에 대해 책임을 지지 않습니다.</p>

      <h2>7. 약관 변경</h2>
      <p>약관이 변경되면 이 페이지에 게시합니다. 변경 후에도 서비스를 계속 이용하면 변경된 약관에 동의한 것으로 봅니다.</p>
      <Contact />
      <p>데이터 처리에 관한 내용은 <Link to="/privacy">개인정보 처리방침</Link>을 참고하세요.</p>
    </Doc>
  )
}
