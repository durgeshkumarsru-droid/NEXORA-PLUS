import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import AdminPanel from './AdminPanel'
import './App.css'

type Movie = {
  id: string
  title: string
  description: string | null
  poster_url: string | null
  video_url: string | null
  video_ratio: string | null
  video_width: number | null
  video_height: number | null
  release_year: number | null
  original_language: string | null
  content_type: string
}

type AudioTrack = {
  id: string
  content_id: string | null
  language_code: string
  language_name: string
  audio_url: string
  is_published: boolean
}


function getYouTubeVideoId(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || null
    if (['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
      if (url.pathname === '/watch') return url.searchParams.get('v')
      const match = url.pathname.match(/^\/(embed|shorts|live)\/([\w-]+)/)
      return match ? match[2] : null
    }
  } catch {}
  return null
}


function getWistiaVideoId(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    if (!host.endsWith("wistia.com") && !host.endsWith("wistia.net")) return null
    const match = url.pathname.match(/\/(?:medias|iframe)\/([a-z0-9]+)/i)
    return match ? match[1] : null
  } catch {
    return null
  }
}


function getVimeoVideoId(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    if (!['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(url.hostname.toLowerCase())) return null
    const match = url.pathname.match(/\/(?:video\/)?(\d+)/)
    return match ? match[1] : null
  } catch { return null }
}

function getGoogleDriveFileId(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    if (!['drive.google.com', 'www.drive.google.com', 'docs.google.com'].includes(url.hostname.toLowerCase())) return null
    const match = url.pathname.match(/\/(?:file\/d\/|d\/)([\w-]+)/)
    return match ? match[1] : null
  } catch { return null }
}

type Episode = {
  id: string
  content_id: string
  season_id: string | null
  episode_number: number
  title: string
  description: string | null
  duration_minutes: number | null
  video_url: string | null
  poster_url: string | null
  is_published: boolean
}

export default function App() {
  const [showDownloadPopup, setShowDownloadPopup] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!sessionStorage.getItem('nexora-download-dismissed')) {
        setShowDownloadPopup(true)
      }
    }, 3200)

    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!showDownloadPopup) return

    const overlay = document.createElement('div')
    overlay.className = 'nexora-download-overlay'

    const popup = document.createElement('div')
    popup.className = 'nexora-download-popup'

    const logo = document.createElement('div')
    logo.className = 'nexora-download-logo'
    logo.textContent = 'NEXORA+'

    const heading = document.createElement('h2')
    heading.textContent = 'Download NEXORA+ App'

    const message = document.createElement('p')
    message.textContent = 'Install our app for a smoother experience.'

    const download = document.createElement('a')
    download.className = 'nexora-download-button'
    download.textContent = 'Download App'
    download.href = 'https://github.com/durgeshkumarsru-droid/NEXORA-PLUS/releases/latest/download/NEXORA-PLUS.apk'
    download.setAttribute('download', 'NEXORA-PLUS.apk')

    const later = document.createElement('button')
    later.className = 'nexora-download-later'
    later.textContent = 'Maybe Later'
    later.type = 'button'
    later.addEventListener('click', () => {
      sessionStorage.setItem('nexora-download-dismissed', '1')
      setShowDownloadPopup(false)
    })

    popup.append(logo, heading, message, download, later)
    overlay.appendChild(popup)
    document.body.appendChild(overlay)

    return () => overlay.remove()
  }, [showDownloadPopup])

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        const orientation = screen.orientation as unknown as {
          unlock?: () => void
        }
        orientation.unlock?.()
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // NEXORA+ cinematic opening intro
  useEffect(() => {
    const splash = document.createElement('div')
    splash.className = 'nexora-intro'

    const mark = document.createElement('div')
    mark.className = 'nexora-intro-mark'
    mark.textContent = 'N'

    const word = document.createElement('div')
    word.className = 'nexora-intro-word'
    word.textContent = 'NEXORA+'

    splash.append(mark, word)
    document.body.appendChild(splash)

    const exitTimer = window.setTimeout(() => {
      splash.classList.add('nexora-intro-exit')
    }, 2300)

    const removeTimer = window.setTimeout(() => {
      splash.remove()
    }, 3000)

    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(removeTimer)
      splash.remove()
    }
  }, [])

  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminMode, setAdminMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSignup, setIsSignup] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState('Home')
  const [showAllMovies, setShowAllMovies] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [movies, setMovies] = useState<Movie[]>([])
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null)

  const [selectedAudioTrack] = useState<AudioTrack | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [saved, setSaved] = useState<string[]>([])
  const [pageLoading, setPageLoading] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileLanguage, setProfileLanguage] = useState('English')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSection, setProfileSection] = useState('')
  const [supportCategory, setSupportCategory] = useState('Technical Issue')
  const [supportSubject, setSupportSubject] = useState('')
  const [supportMessage, setSupportMessage] = useState('')
  const [supportTickets, setSupportTickets] = useState<any[]>([])
  const [supportLoading, setSupportLoading] = useState(false)


  const viewStack = useRef<any[]>([])
  const currentView = useRef({ page, selectedMovie, adminMode, profileSection })

  currentView.current = { page, selectedMovie, adminMode, profileSection }

  function navigateView(next: any) {
    viewStack.current.push({ ...currentView.current })
    if ('page' in next) setPage(next.page)
    if ('selectedMovie' in next) setSelectedMovie(next.selectedMovie)
    if ('adminMode' in next) setAdminMode(next.adminMode)
    if ('profileSection' in next) setProfileSection(next.profileSection)
  }

  function handleAppBack() {
    const previous = viewStack.current.pop()

    if (previous) {
      setPage(previous.page)
      setSelectedMovie(previous.selectedMovie)
      setAdminMode(previous.adminMode)
      setProfileSection(previous.profileSection)
    } else if (currentView.current.selectedMovie) {
      setSelectedMovie(null)
    } else if (currentView.current.profileSection) {
      setProfileSection('')
    } else if (currentView.current.adminMode) {
      setAdminMode(false)
    } else if (currentView.current.page !== 'Home') {
      setPage('Home')
    }

    window.history.pushState({ nexora: true }, '', window.location.href)
  }

  useEffect(() => {
    window.history.pushState({ nexora: true }, '', window.location.href)
    window.addEventListener('popstate', handleAppBack)
    return () => window.removeEventListener('popstate', handleAppBack)
  }, [])
  useEffect(() => {
    const video = document.querySelector<HTMLVideoElement>('#movie-player video')
    const audio = audioRef.current
    if (!video || !audio) return

    if (selectedAudioTrack) {
      video.muted = true
      audio.currentTime = video.currentTime
      audio.playbackRate = video.playbackRate
      if (!video.paused) audio.play().catch(error => console.log('Dubbed audio playback:', error))
    } else {
      audio.pause()
      video.muted = false
    }
  }, [selectedAudioTrack])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setAdminMode(false)
      }
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      setIsAdmin(false)
      return
    }

    async function checkAdmin() {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')

      const admin = !error && !!data?.length
      setIsAdmin(admin)
      setAdminMode(admin)
    }

    checkAdmin()
  }, [user])

  useEffect(() => {
    if (!user) return

    async function loadData() {
      setPageLoading(true)
      setMessage('')

      const { data: movieData, error: movieError } = await supabase
        .from('content')
        .select('id, title, description, poster_url, video_url, video_ratio, video_width, video_height, release_year, original_language, content_type')
        .eq('is_published', true)
        .eq('rights_verified', true)
        .order('created_at', { ascending: false })

      if (movieError) {
        setMessage('Movies load error: ' + movieError.message)
      } else {
        setMovies(movieData || [])
      }

      const { data: listData, error: listError } = await supabase
        .from('watchlist')
        .select('content_id')
        .eq('user_id', user.id)

      if (listError) {
        setMessage('My List error: ' + listError.message)
      } else {
        setSaved((listData || []).map(item => item.content_id))
      }

      setPageLoading(false)
    }

    loadData()
  }, [user])

  useEffect(() => {
    let cancelled = false

    async function loadEpisodes() {
      setEpisodes([])
      setSelectedEpisode(null)

      if (!selectedMovie || !['series', 'drama'].includes(selectedMovie.content_type)) {
        return
      }

      const { data, error } = await supabase
        .from('episodes')
        .select('id, content_id, season_id, episode_number, title, description, duration_minutes, video_url, poster_url, is_published')
        .eq('content_id', selectedMovie.id)
        .eq('is_published', true)
        .order('episode_number', { ascending: true })

      if (cancelled) return

      if (error) {
        console.error('Episodes load error:', error.message)
      } else {
        setEpisodes((data || []) as Episode[])
      }
    }

    void loadEpisodes()

    return () => {
      cancelled = true
    }
  }, [selectedMovie])

  useEffect(() => {
    if (!user) return
    async function loadProfile() {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, preferred_language')
        .eq('id', user.id)
        .maybeSingle()
      if (!error && data) {
        setProfileName(data.full_name || '')
        setProfileLanguage(data.preferred_language || 'English')
      }
    }
    loadProfile()
  }, [user])

  async function saveProfile() {
    setProfileSaving(true)
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: profileName.trim(),
      preferred_language: profileLanguage
    }, { onConflict: 'id' })
    setMessage(error ? error.message : 'Profile updated successfully.')
    setProfileSaving(false)
  }

  async function loadSupportTickets() {
    if (!user) return
    setSupportLoading(true)
    const { data, error } = await supabase
      .from('support_tickets')
      .select('id, category, subject, message, status, admin_reply, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) setMessage(error.message)
    else setSupportTickets(data || [])
    setSupportLoading(false)
  }

  async function submitSupportTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!user) {
      setMessage('Please sign in to contact support.')
      return
    }
    if (!supportSubject.trim() || !supportMessage.trim()) {
      setMessage('Please enter a subject and describe your issue.')
      return
    }
    setSupportLoading(true)
    const { error } = await supabase.from('support_tickets').insert({
      user_id: user.id,
      category: supportCategory,
      subject: supportSubject.trim(),
      message: supportMessage.trim()
    })
    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Your support request has been submitted.')
      setSupportSubject('')
      setSupportMessage('')
      await loadSupportTickets()
    }
    setSupportLoading(false)
  }

  async function shareApp() {
    try {
      const data = { title: 'NEXORA+', text: 'Discover movies on NEXORA+', url: window.location.origin }
      if (navigator.share) await navigator.share(data)
      else {
        await navigator.clipboard.writeText(data.url)
        setMessage('NEXORA+ link copied.')
      }
    } catch (error) {
      console.log(error)
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const result = isSignup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    if (result.error) {
      setMessage(result.error.message)
    } else if (isSignup && !result.data.session) {
      setMessage('Account created! Please check your email to confirm your account.')
    } else {
      setMessage('Success!')
    }

    setLoading(false)
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setMessage('Please enter your email address first.')
      return
    }
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    })
    setMessage(error ? error.message : 'Password reset link sent. Please check your email.')
    setLoading(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    setUser(null)
    setIsAdmin(false)
    setAdminMode(false)
    setMovies([])
    setSaved([])
  }

  async function toggleSaved(movieId: string) {
    if (saved.includes(movieId)) {
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('user_id', user.id)
        .eq('content_id', movieId)

      if (error) {
        setMessage('My List error: ' + error.message)
      } else {
        setSaved(old => old.filter(id => id !== movieId))
      }
    } else {
      const { error } = await supabase
        .from('watchlist')
        .insert({ user_id: user.id, content_id: movieId })

      if (error) {
        setMessage('My List error: ' + error.message)
      } else {
        setSaved(old => [...old, movieId])
      }
    }
  }

  function openMovie(movie: Movie) {
    navigateView({ selectedMovie: movie })
    window.scrollTo(0, 0)
  }

  const filtered = movies.filter(movie => {
    const matchesSearch = movie.title.toLowerCase().includes(search.toLowerCase())
    if (page === 'Movies') return movie.content_type === 'movie' && matchesSearch
    if (page === 'Shows' || page === 'Web Series') return movie.content_type === 'series' && matchesSearch
    if (page === 'Drama') return movie.content_type === 'drama' && matchesSearch
    if (page === 'New & Hot') return matchesSearch
    if (page === 'Home') return matchesSearch
    return false
  })

  if (!user) {
    return (
      <main className="app auth-page">
        <div className="auth-card">
          <div className="logo">NEXORA<span>+</span></div>
          <h1>{isSignup ? 'Create Account' : 'Welcome Back'}</h1>
          <p className="auth-subtitle">Your world of entertainment</p>
          <form onSubmit={handleAuth}>
            <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required />
            <div className="password-field">
              <input type={showPassword ? 'text' : 'password'} placeholder="Password (minimum 6 characters)" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required />
              <button type="button" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <button type="submit" disabled={loading}>
              {loading ? 'Please wait...' : isSignup ? 'Sign Up' : 'Login'}
            </button>
          </form>
          {!isSignup && (
            <button type="button" onClick={handleForgotPassword} disabled={loading}>
              Forgot Password?
            </button>
          )}
          {message && <p className="auth-message">{message}</p>}
          <p className="auth-switch">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}
            <button onClick={() => { setIsSignup(!isSignup); setMessage('') }}>
              {isSignup ? 'Login' : 'Sign Up'}
            </button>
          </p>
        </div>
      </main>
    )
  }

  if (adminMode && isAdmin) {
    return (
      <main className="app">
        <AdminPanel onBack={() => setAdminMode(false)} />
      </main>
    )
  }

  const activeVideoUrl = selectedEpisode?.video_url || selectedMovie?.video_url
  const activeVideoTitle = selectedEpisode
    ? `Episode ${selectedEpisode.episode_number}: ${selectedEpisode.title}`
    : selectedMovie?.title || ''

  function playEpisode(index: number) {
    const episode = episodes[index]
    if (!episode) return
    setSelectedEpisode(episode)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function playNextEpisode() {
    if (!selectedEpisode) return
    const currentIndex = episodes.findIndex(ep => ep.id === selectedEpisode.id)
    if (currentIndex >= 0 && currentIndex < episodes.length - 1) {
      playEpisode(currentIndex + 1)
    }
  }

  async function openPlayerFullscreen(event: any) {
    const player = event.currentTarget.parentElement
    if (!player) return

    const isPortrait =
      selectedMovie?.video_ratio === '9:16' ||
      (!!selectedMovie?.video_width &&
       !!selectedMovie?.video_height &&
       selectedMovie.video_height > selectedMovie.video_width)

    try {
      const fullscreenRequest = player.requestFullscreen?.()

      if (!isPortrait) {
        const orientation = screen.orientation as unknown as {
          lock?: (value: 'landscape') => Promise<void>
        }
        orientation.lock?.('landscape').catch(error =>
          console.log('Landscape lock unavailable:', error)
        )
      }

      if (fullscreenRequest) await fullscreenRequest
    } catch (error) {
      console.log('Fullscreen unavailable:', error)
    }
  }

  if (selectedMovie) {
    return (
      <main className="app details-page">

        <section className="player-section" id="movie-player">
          <h2>Watch {selectedMovie.title}</h2>
          {activeVideoUrl?.trim() ? (
            <>
            {getYouTubeVideoId(activeVideoUrl) ? (
              <div id="nexora-player-wrap" style={{
                position: 'relative',
                width: (selectedMovie.video_height && selectedMovie.video_width && selectedMovie.video_height > selectedMovie.video_width) || selectedMovie.video_ratio === '9:16' ? 'min(100%, 420px)' : '100%',
                margin: '0 auto',
                aspectRatio: selectedMovie.video_width && selectedMovie.video_height
                  ? `${selectedMovie.video_width} / ${selectedMovie.video_height}`
                  : selectedMovie.video_ratio === '9:16' ? '9 / 16' : '16 / 9',
                background: '#000',
                borderRadius: 12,
                overflow: 'hidden'
              }}>
                <iframe
                  key={selectedEpisode?.id || selectedMovie.id}
                  src={`https://www.youtube.com/embed/${getYouTubeVideoId(activeVideoUrl)}?autoplay=1&playsinline=1`}
                  title={activeVideoTitle}
                  style={{width:'100%',height:'100%',border:0,position:'absolute',inset:0}}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              

              </div>
            ) : getVimeoVideoId(activeVideoUrl) ? (
              <div id="nexora-player-wrap" style={{position:'relative',width:'100%',aspectRatio:'16 / 9',background:'#000',borderRadius:12,overflow:'hidden'}}>
                <iframe
                  key={selectedEpisode?.id || selectedMovie.id}
                  src={`https://player.vimeo.com/video/${getVimeoVideoId(activeVideoUrl)}?autoplay=1`}
                  title={activeVideoTitle}
                  style={{width:'100%',height:'100%',border:0,position:'absolute',inset:0}}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
                <button
                  type="button"
                  className="nx-player-fullscreen"
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    bottom: 'auto',
                    left: 'auto',
                    zIndex: 9999,
                    width: 42,
                    height: 42,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.75)',
                    color: '#fff',
                    border: '1px solid #ffffff66',
                    fontSize: 25
                  }}
                  aria-label="Full Screen"
                  title="Full Screen"
                  onClick={openPlayerFullscreen}
                >⛶</button>
              

              </div>
            ) : getWistiaVideoId(activeVideoUrl) ? (
              <div id="nexora-player-wrap" style={{
                position: 'relative',
                width: selectedMovie.video_width && selectedMovie.video_height && selectedMovie.video_height > selectedMovie.video_width
                  ? 'min(100%, 420px)' : '100%',
                margin: '0 auto',
                aspectRatio: selectedMovie.video_width && selectedMovie.video_height
                  ? `${selectedMovie.video_width} / ${selectedMovie.video_height}`
                  : selectedMovie.video_ratio === '9:16' ? '9 / 16' : '16 / 9',
                background: '#000',
                borderRadius: 12,
                overflow: 'hidden'
              }}>
                <iframe
                  key={selectedEpisode?.id || selectedMovie.id}
                  src={`https://fast.wistia.net/embed/iframe/${getWistiaVideoId(activeVideoUrl)}?seo=true&videoFoam=true&autoPlay=true&controlsVisibleOnLoad=true&playbar=true&volumeControl=true&fullscreenButton=true&settingsControl=true&playbackRateControl=true&qualityControl=true&playerColor=e50914`}
                  title={activeVideoTitle}
                  style={{width:'100%',height:'100%',border:0,position:'absolute',inset:0}}
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
              

              </div>
            ) : getGoogleDriveFileId(activeVideoUrl) ? (
              <div id="nexora-player-wrap" style={{position:'relative',width:'100%',aspectRatio:'16 / 9',background:'#000',borderRadius:12,overflow:'hidden'}}>
                <iframe
                  key={selectedEpisode?.id || selectedMovie.id}
                  src={`https://drive.google.com/file/d/${getGoogleDriveFileId(activeVideoUrl)}/preview?autoplay=1`}
                  title={activeVideoTitle}
                  style={{width:'100%',height:'100%',border:0,position:'absolute',inset:0}}
                  allow="autoplay"
                  allowFullScreen
                />
                <button
                  type="button"
                  className="nx-player-fullscreen"
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    bottom: 'auto',
                    left: 'auto',
                    zIndex: 9999,
                    width: 42,
                    height: 42,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.75)',
                    color: '#fff',
                    border: '1px solid #ffffff66',
                    fontSize: 25
                  }}
                  aria-label="Full Screen"
                  title="Full Screen"
                  onClick={openPlayerFullscreen}
                >⛶</button>
              

              </div>
            ) : (
            <div id="nexora-player-wrap" style={{position:'relative',width:'100%',aspectRatio:'16 / 9',overflow:'hidden',borderRadius:12,background:'#000'}}>
              <div className="nx-player-logo" style={{position:'absolute',top:16,left:16,zIndex:2,color:'#E50914',fontSize:20,fontWeight:900,letterSpacing:1.5,textShadow:'0 2px 8px #000',pointerEvents:'none'}}>
                NEXORA+
              </div>
            <video
              style={{width:'100%',height:'100%',aspectRatio:'16 / 9',objectFit:'contain',display:'block'}}
              key={selectedEpisode?.id || selectedMovie.id}
              controls
              autoPlay
              playsInline
              controlsList="nodownload"
              preload="auto"
              poster={selectedEpisode?.poster_url || selectedMovie.poster_url || undefined}
              onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0; }}
              onPlay={() => {
                if (selectedAudioTrack) audioRef.current?.play().catch(error => console.log('Dubbed audio playback:', error));
              }}
              onSeeking={(e) => {
                if (audioRef.current && selectedAudioTrack) audioRef.current.currentTime = e.currentTarget.currentTime;
              }}
              onRateChange={(e) => {
                if (audioRef.current && selectedAudioTrack) audioRef.current.playbackRate = e.currentTarget.playbackRate;
              }}
              onTimeUpdate={async (e) => {
                const video = e.currentTarget;
                if (audioRef.current && selectedAudioTrack && Math.abs(audioRef.current.currentTime - video.currentTime) > 0.35) {
                  audioRef.current.currentTime = video.currentTime;
                }
                const position = Math.floor(video.currentTime);
                const lastSaved = Number(video.dataset.lastSaved || 0);

                if (position >= 10 && position - lastSaved >= 10) {
                  video.dataset.lastSaved = String(position);

                  const { error } = await supabase
                    .from('watch_progress')
                    .upsert({
                      user_id: user.id,
                      content_id: selectedMovie.id,
                      position_seconds: position,
                      updated_at: new Date().toISOString()
                    });

                  if (error) console.error('Progress save error:', error.message);
                }
              }}
              onEnded={playNextEpisode}
              onPause={async (e) => {
                audioRef.current?.pause();
                const position = Math.floor(e.currentTarget.currentTime);
                if (position > 0) {
                  await supabase.from('watch_progress').upsert({
                    user_id: user.id,
                    content_id: selectedMovie.id,
                    position_seconds: position,
                    updated_at: new Date().toISOString()
                  });
                }
              }}
            >
              <source src={activeVideoUrl} type="video/mp4" />
              आपका ब्राउज़र वीडियो सपोर्ट नहीं करता।
            </video>
                <button
                  type="button"
                  className="nx-player-fullscreen"
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    bottom: 'auto',
                    left: 'auto',
                    zIndex: 9999,
                    width: 42,
                    height: 42,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.75)',
                    color: '#fff',
                    border: '1px solid #ffffff66',
                    fontSize: 25
                  }}
                  aria-label="Full Screen"
                  title="Full Screen"
                  onClick={openPlayerFullscreen}
                >⛶</button>
            
            </div>
            )}
            <audio
                ref={audioRef}
                src={selectedAudioTrack?.audio_url || undefined}
                preload="auto"
                onCanPlay={() => {
                  const video = document.querySelector<HTMLVideoElement>('#movie-player video');
                  if (video && !video.paused && selectedAudioTrack) audioRef.current?.play().catch(error => console.log('Dubbed audio playback:', error));
                }}
              />
            </>
          ) : (
            <p>अभी इस Movie का वीडियो उपलब्ध नहीं है।</p>
          )}
        </section>

        <section className="movie-details">
          {selectedMovie.poster_url && (
            <img
              className="details-poster"
              src={selectedMovie.poster_url}
              alt={selectedMovie.title}
            />
          )}

          <div className="details-content">
            <p className="tagline">NEXORA+ ORIGINAL EXPERIENCE</p>
            <h1>{selectedMovie.title}</h1>

            <p className="details-meta">
              {selectedMovie.release_year || 'Year unknown'} · {selectedMovie.original_language || 'Language unknown'}
            </p>

            <p className="details-description">
              {selectedMovie.description || 'No description available.'}
            </p>

            <div className="details-actions">
              {selectedMovie.video_url && (
                <button
                  className="watch-button"
                  onClick={() => {
                    const player = document.getElementById('movie-player');
                    player?.scrollIntoView({ behavior: 'smooth' });

                    const video = player?.querySelector<HTMLVideoElement>('video');
                    if (video) {
                      video.currentTime = 0;
                      video.muted = !!selectedAudioTrack;
                      video.play().catch(error => console.log('Playback error:', error));
                      return;
                    }

                    const frame = player?.querySelector<HTMLIFrameElement>('iframe');
                    if (frame) {
                      try {
                        const url = new URL(frame.src);
                        url.searchParams.set('autoplay', '1');
                        frame.src = url.toString();
                      } catch (error) {
                        console.log('Iframe playback error:', error);
                      }
                    }
                  }}
                >
                  ▶ Watch Now
                </button>
              )}

              <button onClick={() => toggleSaved(selectedMovie.id)}>
                {saved.includes(selectedMovie.id) ? '✓ Added to My List' : '+ Add to My List'}
              </button>
            </div>
          </div>
        </section>


        {['series', 'drama'].includes(selectedMovie.content_type) && (
          <section className="episode-list-section">
            <h2>{selectedMovie.content_type === 'drama' ? 'Drama Episodes' : 'All Episodes'}</h2>

            {episodes.length > 0 ? (
              <>
                <div className="episode-navigation">
                  <button
                    disabled={!selectedEpisode || episodes.findIndex(ep => ep.id === selectedEpisode.id) <= 0}
                    onClick={() => {
                      const index = episodes.findIndex(ep => ep.id === selectedEpisode?.id)
                      if (index > 0) playEpisode(index - 1)
                    }}
                  >
                    ◀ Previous
                  </button>
                  <span>
                    {selectedEpisode
                      ? `Episode ${selectedEpisode.episode_number} of ${episodes.length}`
                      : `${episodes.length} Episodes`}
                  </span>
                  <button
                    disabled={!selectedEpisode || episodes.findIndex(ep => ep.id === selectedEpisode.id) >= episodes.length - 1}
                    onClick={playNextEpisode}
                  >
                    Next ▶
                  </button>
                </div>

                <div className="episode-grid">
                  {episodes.map((episode, index) => (
                    <button
                      key={episode.id}
                      className={`episode-card ${selectedEpisode?.id === episode.id ? 'active' : ''}`}
                      onClick={() => playEpisode(index)}
                    >
                      {episode.poster_url ? (
                        <img src={episode.poster_url} alt={episode.title} />
                      ) : (
                        <div className="episode-placeholder">EP {episode.episode_number}</div>
                      )}
                      <span>Episode {episode.episode_number}</span>
                      <strong>{episode.title}</strong>
                      {episode.duration_minutes && <small>{episode.duration_minutes} min</small>}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p>अभी कोई Published Episode उपलब्ध नहीं है।</p>
            )}
          </section>
        )}

        <section className="more-like-this">
          <h2>More Like This</h2>
          <div className="recommendation-grid">
            {movies
              .filter((movie) => movie.id !== selectedMovie.id)
              .slice(0, 12)
              .map((movie) => (
                <button
                  className="recommendation-card"
                  key={movie.id}
                  onClick={() => {
                    navigateView({ selectedMovie: movie });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  {movie.poster_url ? (
                    <img src={movie.poster_url} alt={movie.title} />
                  ) : (
                    <div className="recommendation-placeholder">NEXORA+</div>
                  )}
                  <span>{movie.title}</span>
                  <small>{movie.release_year || 'NEXORA+ ORIGINAL'}</small>
                </button>
              ))}
          </div>
        </section>
      </main>
    )
  }

  const featuredMovie = movies[0]
  const profileDetails: Record<string, string> = {
    'My Subscription': 'Your NEXORA+ subscription details will appear here when subscription plans are activated.',
    'Payment History': 'Your payment transactions will appear here after the payment system is connected.',
    'Watch History': 'Your recently watched movies and shows will appear here when watch history is enabled.',
    'Downloads': 'Offline downloads are not available yet. This feature will be added in a future update.',
    'Notifications': 'Notification preferences will be available here in a future update.',
    'Help & Support': 'For account or app assistance, please contact the NEXORA+ support team when support is enabled.',
    'About NEXORA+': 'NEXORA+ — Stories Without Limits. Discover entertainment from around the world.',
    'Privacy Policy': 'The NEXORA+ Privacy Policy page is being prepared.',
    'Terms & Conditions': 'The NEXORA+ Terms & Conditions page is being prepared.'
  }

  return (
    <main className="app netflix-home">
      <header className="nx-header">
        <div className="nx-brand"><span>N</span> NEXORA<small>+</small></div>
        <div className="nx-header-actions">
          {isAdmin && <button onClick={() => navigateView({ adminMode: true })}>Admin</button>}
        </div>
      </header>

      <nav className="nx-categories" style={{ display: page === "My Profile" ? "none" : undefined }}>
        {['Web Series', 'Movies', 'Drama', 'New & Hot'].map(item => (
          <button key={item} className={page === item ? 'active' : ''} onClick={() => navigateView({ page: item })}>{item}</button>
        ))}
      </nav>

      <section
        className="nx-hero"
        style={{
          display: ['My Profile', 'Search', 'Clips'].includes(page) ? 'none' : undefined,
          ...(featuredMovie?.poster_url ? {
            backgroundImage: `linear-gradient(0deg,#090909 2%,transparent 75%), linear-gradient(90deg,#09090999,transparent), url("${featuredMovie.poster_url}")`
          } : {})
        }}
      >
        <div className="nx-hero-content">
          <span className="nx-original">NEXORA+ ORIGINAL</span>
          <h1>{featuredMovie?.title || 'Stories Without Limits'}</h1>
          <p>
            {featuredMovie?.description || 'Discover movies and unforgettable stories from around the world.'}
          </p>
          <div className="nx-hero-buttons">
            {featuredMovie && (
              <button className="nx-play" onClick={() => openMovie(featuredMovie)}>▶ Play</button>
            )}
            {featuredMovie && (
              <button className="nx-list" onClick={() => toggleSaved(featuredMovie.id)}>
                {saved.includes(featuredMovie.id) ? '✓ My List' : '+ My List'}
              </button>
            )}
          </div>
        </div>
      </section>

      {message && <p className="auth-message">{message}</p>}
      {pageLoading && <p className="nx-empty">Loading movies...</p>}

      {page === 'Home' ? (
        <>
          {[
            { key: 'popular', title: 'Popular on NEXORA+', type: 'all' },
            { key: 'movies', title: 'Movies', type: 'movie' },
            { key: 'series', title: 'Web Series', type: 'series' },
            { key: 'drama', title: 'Drama', type: 'drama' },
          ].map((section) => {
            const sectionMovies = movies.filter((movie) => {
              const matchesSearch = movie.title.toLowerCase().includes(search.toLowerCase())
              return matchesSearch &&
                (section.type === 'all' || movie.content_type === section.type)
            })

            const expanded = !!expandedSections[section.key]

            return (
              <section className="nx-row-section" id={`nx-${section.key}`} key={section.key}>
                <div className="nx-section-title">
                  <h2>{section.title}</h2>
                  <button
                    type="button"
                    className="nx-explore-all"
                    onClick={() => setExpandedSections(current => ({
                      ...current,
                      [section.key]: !current[section.key]
                    }))}
                  >
                    {expanded ? 'Show less ↑' : 'Explore all ›'}
                  </button>
                </div>

                <div className={`nx-movie-row ${expanded ? "nx-movie-grid" : ""}`}>
                  {sectionMovies.map((movie, index) => (
                    <button
                      className="nx-movie-card"
                      key={movie.id}
                      onClick={() => openMovie(movie)}
                    >
                      {movie.poster_url
                        ? <img src={movie.poster_url} alt={movie.title} />
                        : <div className="nx-poster-placeholder">NEXORA+</div>}
                      {index < 10 && <b className="nx-top-badge">TOP {index + 1}</b>}
                      <span>{movie.title}</span>
                      <small>{movie.release_year || 'NEXORA+ ORIGINAL'}</small>
                    </button>
                  ))}
                </div>

                {!pageLoading && sectionMovies.length === 0 && (
                  <p className="nx-empty">
                    {section.type === 'all'
                      ? 'No published videos yet.'
                      : `No ${section.title} available yet.`}
                  </p>
                )}
              </section>
            )
          })}
        </>
      ) : (
        <section
          className="nx-row-section"
          id="nx-movies"
          style={{ display: ["My Profile", "Clips"].includes(page) ? "none" : undefined }}
        >
          <div className="nx-section-title">
            <h2>{page}</h2>
            <button
              type="button"
              className="nx-explore-all"
              onClick={() => setShowAllMovies(value => !value)}
            >
              {showAllMovies ? 'Show less ↑' : 'Explore all ›'}
            </button>
          </div>

          <div className={`nx-movie-row ${showAllMovies ? "nx-movie-grid" : ""}`}>
            {filtered.map((movie, index) => (
              <button className="nx-movie-card" key={movie.id} onClick={() => openMovie(movie)}>
                {movie.poster_url
                  ? <img src={movie.poster_url} alt={movie.title} />
                  : <div className="nx-poster-placeholder">NEXORA+</div>}
                {index < 10 && <b className="nx-top-badge">TOP {index + 1}</b>}
                <span>{movie.title}</span>
                <small>{movie.release_year || 'NEXORA+ ORIGINAL'}</small>
              </button>
            ))}
          </div>

          {!pageLoading && filtered.length === 0 && (
            <p className="nx-empty">No published movies yet. Add movies from Admin Panel.</p>
          )}
        </section>
      )}

      <section className="nx-row-section" id="mylist" style={{ display: ["My Profile", "Clips", "Search"].includes(page) ? "none" : undefined }}>
        <div className="nx-section-title"><h2>My List</h2></div>
        <div className="nx-movie-row">
          {movies.filter(movie => saved.includes(movie.id)).map(movie => (
            <button className="nx-movie-card" key={movie.id} onClick={() => openMovie(movie)}>
              {movie.poster_url
                ? <img src={movie.poster_url} alt={movie.title} />
                : <div className="nx-poster-placeholder">NEXORA+</div>}
              <span>{movie.title}</span>
            </button>
          ))}
        </div>
        {saved.length === 0 && <p className="nx-empty">Your list is empty.</p>}
      </section>

      <section className="nx-search-section" id="nx-search" style={{ display: page === "Search" ? undefined : "none" }}>
        <input
          placeholder="Search movies..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </section>

      {page === 'Games' && <section className="nx-row-section"><h2>Games</h2><p className="nx-empty">Games are coming soon to NEXORA+.</p></section>}
      {page === 'Categories' && <section className="nx-row-section"><h2>Categories</h2><p className="nx-empty">Explore Movies and Shows from the top menu.</p></section>}
      {page === 'Clips' && <section className="nx-row-section"><h2>Clips</h2><p className="nx-empty">Clips are coming soon to NEXORA+.</p></section>}
      {page === 'My Profile' && (
        <>
        <section className="nx-profile" style={{ display: profileSection ? "none" : undefined }}>
          <div className="profile-heading">
            <div className="profile-avatar">{profileName.trim() ? profileName.trim()[0].toUpperCase() : 'N'}</div>
            <div><span className="profile-kicker">NEXORA+ ACCOUNT</span><h1>My Profile</h1><p>Manage your account and preferences</p></div>
          </div>

          <div className="profile-panel">
            <h2>Personal Details</h2>
            <label htmlFor="profile-name">Your Name</label>
            <input id="profile-name" value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Enter your name" />
            <label htmlFor="profile-language">Preferred Language</label>
            <select id="profile-language" value={profileLanguage} onChange={e => setProfileLanguage(e.target.value)}>
              {['English','Hindi','Arabic','Urdu','Spanish','French','Portuguese','Japanese','Korean','Chinese'].map(x => <option key={x}>{x}</option>)}
            </select>
            <button className="profile-save" onClick={saveProfile} disabled={profileSaving}>{profileSaving ? 'Saving...' : 'Save Changes'}</button>
          </div>

          <div className="profile-panel">
            <h2>Your NEXORA+</h2>
            <div className="profile-options">
              <button className="profile-option" onClick={() => navigateView({ profileSection: 'My Subscription' })}><span>✦</span><div><b>My Subscription</b><small>View your current plan</small></div><strong>›</strong></button>
              <button className="profile-option" onClick={() => navigateView({ profileSection: 'Payment History' })}><span>▤</span><div><b>Payment History</b><small>View your transactions</small></div><strong>›</strong></button>
              <button className="profile-option" onClick={() => navigateView({ profileSection: 'Watch History' })}><span>◷</span><div><b>Watch History</b><small>Your recently watched content</small></div><strong>›</strong></button>
              <button className="profile-option" onClick={() => { setPage('Home'); document.getElementById('mylist')?.scrollIntoView({behavior:'smooth'}) }}><span>♡</span><div><b>My List</b><small>Your saved movies and shows</small></div><strong>›</strong></button>
              <button className="profile-option" onClick={() => navigateView({ profileSection: 'Downloads' })}><span>↓</span><div><b>Downloads</b><small>Your offline content</small></div><strong>›</strong></button>
              <button className="profile-option" onClick={() => navigateView({ profileSection: 'Notifications' })}><span>♧</span><div><b>Notifications</b><small>Manage your alerts</small></div><strong>›</strong></button>
            </div>
          </div>

          <div className="profile-panel">
            <h2>More</h2>
            <div className="profile-options">
              <button className="profile-option" onClick={shareApp}><span>↗</span><div><b>Share NEXORA+</b><small>Invite your friends</small></div><strong>›</strong></button>
              <button className="profile-option" onClick={() => { navigateView({ profileSection: 'Help & Support' }); loadSupportTickets() }}><span>?</span><div><b>Help & Support</b><small>Get help with your account</small></div><strong>›</strong></button>
              <button className="profile-option" onClick={() => navigateView({ profileSection: 'About NEXORA+' })}><span>ⓘ</span><div><b>About NEXORA+</b><small>About our platform</small></div><strong>›</strong></button>
              <button className="profile-option" onClick={() => navigateView({ profileSection: 'Privacy Policy' })}><span>◇</span><div><b>Privacy Policy</b><small>Your privacy information</small></div><strong>›</strong></button>
              <button className="profile-option" onClick={() => navigateView({ profileSection: 'Terms & Conditions' })}><span>≡</span><div><b>Terms & Conditions</b><small>Platform terms</small></div><strong>›</strong></button>
            </div>
          </div>
          <button className="profile-logout" onClick={logout}>↪ &nbsp; Log Out</button>
        </section>
        {profileSection && (
          <section className="nx-profile profile-detail">
            <button className="profile-back" onClick={handleAppBack}>← Back to Profile</button>
            <div className="profile-panel">
              <span className="profile-kicker">NEXORA+ ACCOUNT</span>
              <h1>{profileSection}</h1>
              {profileSection === 'Help & Support' ? (
                <div className="support-area">
                  <h2>Contact Support</h2>
                  <p>Tell us how we can help. Our support team will review your request.</p>
                  <form onSubmit={submitSupportTicket} className="support-form">
                    <label>Issue Category</label>
                    <select value={supportCategory} onChange={e => setSupportCategory(e.target.value)}>
                      <option>Technical Issue</option>
                      <option>Account & Login</option>
                      <option>Video Playback</option>
                      <option>Subscription & Payment</option>
                      <option>Content Request</option>
                      <option>Other</option>
                    </select>
                    <label>Subject</label>
                    <input value={supportSubject} onChange={e => setSupportSubject(e.target.value)} placeholder="Write a short subject" required />
                    <label>Describe Your Issue</label>
                    <textarea value={supportMessage} onChange={e => setSupportMessage(e.target.value)} placeholder="Explain your problem here..." rows={5} required />
                    <button className="profile-save" type="submit" disabled={supportLoading}>
                      {supportLoading ? 'Please wait...' : 'Submit Support Request'}
                    </button>
                  </form>
                  <div className="support-history">
                    <h2>My Support Requests</h2>
                    <button type="button" className="profile-save" onClick={loadSupportTickets} disabled={supportLoading}>Refresh Requests</button>
                    {supportTickets.length === 0 ? (
                      <p>No support requests yet.</p>
                    ) : supportTickets.map(ticket => (
                      <div className="support-ticket" key={ticket.id}>
                        <h3>{ticket.subject}</h3>
                        <p>{ticket.category} · {new Date(ticket.created_at).toLocaleString()}</p>
                        <p>{ticket.message}</p>
                        <strong>Status: {ticket.status}</strong>
                        {ticket.admin_reply && <p><b>Admin Reply:</b> {ticket.admin_reply}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p>{profileDetails[profileSection] || 'Information will be available here.'}</p>
              )}
            </div>
          </section>
        )}

        </>
      )}
      <nav className="nx-bottom-nav" aria-label="Main navigation">
        <button className={page === 'Home' ? 'active' : ''} aria-current={page === 'Home' ? 'page' : undefined} onClick={() => { setPage('Home'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
          <span className="nav-icon">⌂</span><span className="nav-label">Home</span>
        </button>
        <button className={page === 'Clips' ? 'active' : ''} aria-current={page === 'Clips' ? 'page' : undefined} onClick={() => { setPage('Clips'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
          <span className="nav-icon">▣</span><span className="nav-label">Clips</span>
        </button>
        <button className={page === 'Search' ? 'active' : ''} aria-current={page === 'Search' ? 'page' : undefined} onClick={() => { setPage('Search'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
          <span className="nav-icon">⌕</span><span className="nav-label">Search</span>
        </button>
        <button className={page === 'My Profile' ? 'active' : ''} aria-current={page === 'My Profile' ? 'page' : undefined} onClick={() => { setPage('My Profile'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
          <span className="nav-icon">◉</span><span className="nav-label">My Profile</span>
        </button>
      </nav>
    </main>
  )
}
