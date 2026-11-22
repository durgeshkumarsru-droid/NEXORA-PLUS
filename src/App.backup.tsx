import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import AdminPanel from './AdminPanel'
import './App.css'

type Movie = {
  id: string
  title: string
  description: string | null
  poster_url: string | null
  video_url: string | null
  release_year: number | null
  original_language: string | null
}

export default function App() {
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminMode, setAdminMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [movies, setMovies] = useState<Movie[]>([])
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)
  const [saved, setSaved] = useState<string[]>([])
  const [pageLoading, setPageLoading] = useState(false)

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

      setIsAdmin(!error && !!data?.length)
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
        .select('id, title, description, poster_url, video_url, release_year, original_language')
        .eq('content_type', 'movie')
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
    setSelectedMovie(movie)
    window.scrollTo(0, 0)
  }

  const filtered = movies.filter(movie =>
    movie.title.toLowerCase().includes(search.toLowerCase())
  )

  if (!user) {
    return (
      <main className="app auth-page">
        <div className="auth-card">
          <div className="logo">NEXORA<span>+</span></div>
          <h1>{isSignup ? 'Create Account' : 'Welcome Back'}</h1>
          <p className="auth-subtitle">Your world of entertainment</p>
          <form onSubmit={handleAuth}>
            <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password (minimum 6 characters)" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required />
            <button type="submit" disabled={loading}>
              {loading ? 'Please wait...' : isSignup ? 'Sign Up' : 'Login'}
            </button>
          </form>
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
        <header className="navbar">
          <div className="logo">NEXORA<span>+</span></div>
          <button onClick={() => setAdminMode(false)}>Back to App</button>
        </header>
        <AdminPanel />
      </main>
    )
  }

  if (selectedMovie) {
    return (
      <main className="app details-page">
        <header className="navbar">
          <div className="logo">NEXORA<span>+</span></div>
          <button onClick={() => setSelectedMovie(null)}>← Back to Movies</button>
        </header>

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
                  onClick={() => document.getElementById('movie-player')?.scrollIntoView({ behavior: 'smooth' })}
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

        <section className="player-section" id="movie-player">
          <h2>Watch {selectedMovie.title}</h2>
          {selectedMovie.video_url ? (
            <video
              controls
              playsInline
              controlsList="nodownload"
              preload="metadata"
              poster={selectedMovie.poster_url || undefined}
              onLoadedMetadata={async (e) => {
                const video = e.currentTarget;
                const { data, error } = await supabase
                  .from('watch_progress')
                  .select('position_seconds')
                  .eq('user_id', user.id)
                  .eq('content_id', selectedMovie.id)
                  .maybeSingle();

                if (!error && data?.position_seconds > 0) {
                  video.currentTime = data.position_seconds;
                }
              }}
              onTimeUpdate={async (e) => {
                const video = e.currentTarget;
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
              onPause={async (e) => {
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
              <source src={selectedMovie.video_url} type="video/mp4" />
              आपका ब्राउज़र वीडियो सपोर्ट नहीं करता।
            </video>
          ) : (
            <p>अभी इस Movie का वीडियो उपलब्ध नहीं है।</p>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="app">
      <header className="navbar">
        <div className="logo">NEXORA<span>+</span></div>
        <nav>
          <a href="#home">Home</a>
          <a href="#movies">Movies</a>
          <a href="#mylist">My List</a>
          {isAdmin && (
            <button onClick={() => setAdminMode(true)}>Admin Panel</button>
          )}
          <button onClick={logout}>Logout</button>
        </nav>
      </header>

      <section className="hero" id="home">
        <div className="hero-content">
          <p className="tagline">YOUR WORLD OF ENTERTAINMENT</p>
          <h1>Stories Without<br />Limits.</h1>
          <p>Discover movies, series and unforgettable stories from around the world.</p>
          <a className="explore" href="#movies">Explore Now</a>
        </div>
      </section>

      <section className="catalog" id="movies">
        <div className="section-heading">
          <h2>Popular Movies</h2>
          <input placeholder="Search movies..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {pageLoading && <p>Loading movies...</p>}
        {message && <p className="auth-message">{message}</p>}

        {!pageLoading && filtered.length === 0 && (
          <p>No published movies yet. Your movie catalog is waiting for approved content.</p>
        )}

        <div className="movie-grid">
          {filtered.map(movie => (
            <article className="movie-card" key={movie.id}>
              {movie.poster_url ? (
                <img src={movie.poster_url} alt={movie.title} onClick={() => openMovie(movie)} style={{ cursor: "pointer" }} />
              ) : (
                <div className="movie-placeholder">{movie.title}</div>
              )}
              <div className="movie-info">
                <h3>{movie.title}</h3>
                <p>{movie.release_year || 'Year unknown'} · {movie.original_language || 'Language unknown'}</p>
                <div className="movie-actions">
                  <button className="play-button" onClick={() => openMovie(movie)}>
                    ▶ Play Now
                  </button>
                  <button onClick={() => toggleSaved(movie.id)}>
                    {saved.includes(movie.id) ? '✓ Added' : '+ My List'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="catalog" id="mylist">
        <h2>My List</h2>
        <div className="movie-grid">
          {movies.filter(movie => saved.includes(movie.id)).map(movie => (
            <article className="movie-card" key={movie.id}>
              {movie.poster_url ? <img src={movie.poster_url} alt={movie.title} onClick={() => openMovie(movie)} style={{ cursor: "pointer" }} /> : <div className="movie-placeholder">{movie.title}</div>}
              <div className="movie-info">
                <h3>{movie.title}</h3>
                <button onClick={() => toggleSaved(movie.id)}>Remove</button>
              </div>
            </article>
          ))}
        </div>
        {saved.length === 0 && <p>Your list is empty.</p>}
      </section>

      <footer>© 2026 NEXORA+ · Entertainment for everyone</footer>
    </main>
  )
}
