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
  const [showPassword, setShowPassword] = useState(false)
  const [isSignup, setIsSignup] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [movies, setMovies] = useState<Movie[]>([])
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)
  const [isTrailer, setIsTrailer] = useState(true)
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
    setIsTrailer(true); setSelectedMovie(movie)
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

        <section className="player-section" id="movie-player">
          <h2>Watch {selectedMovie.title}</h2>
          {selectedMovie.video_url ? (
            <>
            <video
              controls={!isTrailer}
              playsInline
              controlsList="nodownload"
              preload="metadata"
              poster={selectedMovie.poster_url || undefined}
              onLoadedMetadata={async (e) => {
                const video = e.currentTarget;
                if (isTrailer) {
                  const trailerStart = Math.max(0, (video.duration - 30) / 2);
                  video.currentTime = trailerStart;
                  video.dataset.trailerEnd = String(Math.min(video.duration, trailerStart + 30));
                  video.muted = true;
                  video.play().catch(error => console.log('Trailer autoplay blocked:', error));
                  return;
                }
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
                if (isTrailer) {
                  if (video.currentTime >= Number(video.dataset.trailerEnd) - 0.25) {
                    video.pause();
                    setIsTrailer(false);
                  }
                  return;
                }
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
                if (isTrailer) return;
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
            {!isTrailer && (
              <button className="watch-button" onClick={() => {
                const video = document.querySelector<HTMLVideoElement>('#movie-player video');
                if (video) {
                  video.currentTime = 0;
                  video.muted = false;
                  video.play().catch(error => console.log('Playback error:', error));
                }
              }}>
                ▶ Play Full Movie
              </button>
            )}
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
                    const video = document.querySelector<HTMLVideoElement>('#movie-player video');
                    if (video) {
                      setIsTrailer(false);
                      video.currentTime = 0;
                      video.muted = false;
                      video.play().catch(error => console.log('Playback error:', error));
                      document.getElementById('movie-player')?.scrollIntoView({ behavior: 'smooth' });
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
                    setIsTrailer(true); setSelectedMovie(movie);
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

  return (
    <main className="app netflix-home">
      <header className="nx-header">
        <div className="nx-brand"><span>N</span> NEXORA<small>+</small></div>
        <div className="nx-header-actions">
          {isAdmin && <button onClick={() => setAdminMode(true)}>Admin</button>}
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      <nav className="nx-categories">
        {['Shows', 'Movies', 'Games', 'New & Hot', 'Categories'].map(item => (
          <a key={item} href="#nx-movies">{item}</a>
        ))}
      </nav>

      <section
        className="nx-hero"
        style={featuredMovie?.poster_url ? {
          backgroundImage: `linear-gradient(0deg,#090909 2%,transparent 75%), linear-gradient(90deg,#09090999,transparent), url("${featuredMovie.poster_url}")`
        } : undefined}
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

      <section className="nx-row-section" id="nx-movies">
        <div className="nx-section-title">
          <h2>Popular on NEXORA+</h2>
          <span>Explore all ›</span>
        </div>
        <div className="nx-movie-row">
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

      <section className="nx-row-section" id="mylist">
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

      <section className="nx-search-section" id="nx-search">
        <input
          placeholder="Search movies..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </section>

      <nav className="nx-bottom-nav">
        <a href="#home" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>⌂<span>Home</span></a>
        <a href="#nx-movies">▣<span>Clips</span></a>
        <a href="#nx-search">⌕<span>Search</span></a>
        <button onClick={logout}>◉<span>My Profile</span></button>
      </nav>
    </main>
  )
}
