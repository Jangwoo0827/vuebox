import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { useSubscriptionToggle } from '@/hooks/useLibrary'
import type { Channel, PlaylistSummary } from '@/types/youtube'
import { formatCount } from '@/utils/format'

export function SubscribeButton({ channel }: { channel: Pick<Channel, 'id' | 'title' | 'avatar'> | null }) {
  const { subscribed, toggle } = useSubscriptionToggle(channel)
  return (
    <button type="button" onClick={toggle} aria-pressed={subscribed} className={`btn ${subscribed ? 'btn-secondary' : 'btn-primary'}`} disabled={!channel}>
      {subscribed ? 'Subscribed' : 'Subscribe'}
    </button>
  )
}

export function ChannelCard({ channel }: { channel: Channel }) {
  return (
    <article className="relative flex items-center gap-4 rounded-lg p-3 hover:bg-surface">
      <Avatar src={channel.avatar} name={channel.title} size={72} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-semibold">
          <Link to={`/channel/${channel.id}`} className="after:absolute after:inset-0 after:content-['']">
            {channel.title}
          </Link>
        </h3>
        <p className="truncate text-sm text-text-secondary">
          {[channel.customUrl, channel.subscriberCount !== null ? `구독자 ${formatCount(channel.subscriberCount)}명` : null].filter(Boolean).join(' · ')}
        </p>
        <p className="line-clamp-2 text-sm text-text-secondary">{channel.description}</p>
      </div>
      <div className="relative z-10 hidden sm:block">
        <SubscribeButton channel={channel} />
      </div>
    </article>
  )
}

/** A public YouTube playlist (search / channel results). */
export function YtPlaylistCard({ playlist }: { playlist: PlaylistSummary }) {
  return (
    <article className="group relative flex flex-col gap-2">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-2">
        <img src={playlist.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
        {playlist.itemCount !== null && <span className="absolute inset-y-0 right-0 flex w-1/3 items-center justify-center bg-black/70 text-sm font-semibold text-white">{playlist.itemCount}개</span>}
      </div>
      <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug">
        <Link to={`/youtube-playlist/${playlist.id}`} className="after:absolute after:inset-0 after:content-['']">
          {playlist.title}
        </Link>
      </h3>
      <p className="truncate text-sm text-text-secondary">{playlist.channelTitle}</p>
    </article>
  )
}
