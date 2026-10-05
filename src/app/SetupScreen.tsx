import { LogoMark } from '@/components/ui/Logo'

/** Shown instead of the app when the Supabase env vars are missing (so nothing half-works silently). */
export function SetupScreen() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="card w-full max-w-xl p-6 sm:p-8">
        <div className="mb-4 flex items-center gap-3">
          <LogoMark size={36} />
          <h1 className="text-2xl font-extrabold">VUEBOX 설정이 필요합니다</h1>
        </div>
        <p className="text-sm text-text-secondary">Supabase 연결 정보가 없습니다. 프로젝트 루트에 <code>.env.local</code> 파일을 만들고 아래 값을 채운 뒤 개발 서버를 다시 시작하세요.</p>
        <pre className="my-4 overflow-x-auto rounded-lg bg-surface-2 p-4 text-sm">
{`VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>`}
        </pre>
        <p className="text-sm text-text-secondary">
          Supabase 프로젝트 생성, 마이그레이션 적용, YouTube API 키 등록 방법은 README의 <strong>Setup</strong> 섹션을 따라주세요. 비밀 키(YouTube API 키, service role 키)는 이 파일이 아니라 Edge Function secrets에만 넣습니다.
        </p>
      </div>
    </div>
  )
}
