import { useEffect, useState } from 'react'
import { supabase } from './supabase'

type Movie = {
  id: string
  title: string
  slug: string
  description: string | null
  poster_url: string | null
  video_url: string | null
  release_year: number | null
  content_type: string
  is_published: boolean
  rights_verified: boolean
}

const emptyForm = {
  title: '',
  slug: '',
  description: '',
  poster_url: '',
  video_url: '',
  release_year: '',
  content_type: 'movie',
}

export default function AdminPanel() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [posterFile, setPosterFile] = useState<File | null>(null)

  async function loadMovies() {
    setLoading(true)
    const { data, error } = await supabase
      .from('content')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) setMessage(error.message)
    else setMovies(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadMovies()
  }, [])

  function updateField(field: string, value: string) {
    setForm(old => ({ ...old, [field]: value }))
  }

  async function saveMovie(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    let posterUrl = form.poster_url.trim() || null

    if (posterFile) {
      if (!posterFile.type.startsWith('image/')) {
        setMessage('कृपया केवल Image चुनें।')
        setLoading(false)
        return
      }

      if (posterFile.size > 5 * 1024 * 1024) {
        setMessage('Poster का आकार 5 MB से कम होना चाहिए।')
        setLoading(false)
        return
      }

      const safeName = posterFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const filePath = `${Date.now()}-${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('Movie-Posters')
        .upload(filePath, posterFile)

      if (uploadError) {
        setMessage('Poster upload error: ' + uploadError.message)
        setLoading(false)
        return
      }

      const { data: publicData } = supabase.storage
        .from('Movie-Posters')
        .getPublicUrl(filePath)

      posterUrl = publicData.publicUrl
    }

    const record = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || null,
      poster_url: posterUrl,
      video_url: form.video_url.trim() || null,
      release_year: form.release_year ? Number(form.release_year) : null,
      content_type: form.content_type,
    }

    const result = editingId
      ? await supabase.from('content').update(record).eq('id', editingId)
      : await supabase.from('content').insert(record)

    if (result.error) {
      setMessage(result.error.message)
    } else {
      setMessage(editingId ? 'Movie updated!' : 'Movie added!')
      setForm(emptyForm)
      setPosterFile(null)
      setEditingId(null)
      await loadMovies()
    }

    setLoading(false)
  }

  function editMovie(movie: Movie) {
    setEditingId(movie.id)
    setForm({
      title: movie.title,
      slug: movie.slug,
      description: movie.description || '',
      poster_url: movie.poster_url || '',
      video_url: movie.video_url || '',
      release_year: movie.release_year?.toString() || '',
      content_type: movie.content_type,
    })
    setPosterFile(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function togglePublish(movie: Movie) {
    const nextPublished = !movie.is_published

    if (nextPublished && !movie.rights_verified) {
      setMessage('पहले फिल्म के वास्तविक वितरण अधिकार सत्यापित करें।')
      return
    }

    const { error } = await supabase
      .from('content')
      .update({ is_published: nextPublished })
      .eq('id', movie.id)

    if (error) setMessage(error.message)
    else {
      setMessage(nextPublished ? 'Movie published!' : 'Movie unpublished!')
      await loadMovies()
    }
  }

  async function deleteMovie(id: string) {
    if (!window.confirm('क्या आप इस फिल्म को डिलीट करना चाहते हैं?')) return

    const { error } = await supabase
      .from('content')
      .delete()
      .eq('id', id)

    if (error) setMessage(error.message)
    else {
      setMessage('Movie deleted!')
      await loadMovies()
    }
  }

  async function toggleRights(movie: Movie) {
    const nextValue = !movie.rights_verified

    if (nextValue && !window.confirm('क्या आपके पास इस फिल्म के स्ट्रीमिंग और वितरण अधिकार वास्तव में हैं?')) return

    const { error } = await supabase
      .from('content')
      .update({
        rights_verified: nextValue,
        is_published: nextValue ? movie.is_published : false,
      })
      .eq('id', movie.id)

    if (error) setMessage(error.message)
    else {
      setMessage('Rights status updated.')
      await loadMovies()
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-heading">
        <h1>NEXORA+ Admin</h1>
        <p>Manage your movie catalog</p>
      </div>

      {message && <p className="admin-message">{message}</p>}

      <form className="admin-form" onSubmit={saveMovie}>
        <h2>{editingId ? 'Edit Movie' : 'Add New Movie'}</h2>

        <input placeholder="Movie title" value={form.title}
          onChange={e => updateField('title', e.target.value)} required />

        <input placeholder="Unique slug e.g. my-movie" value={form.slug}
          onChange={e => updateField('slug', e.target.value)} required />

        <textarea placeholder="Movie description" value={form.description}
          onChange={e => updateField('description', e.target.value)} />

        <label>Video URL</label>
        <input placeholder="Video URL (https://...)" type="url" value={form.video_url}
          onChange={e => updateField("video_url", e.target.value)} />

        <label>Poster image URL (optional)</label>
        <input placeholder="Poster image URL" type="url" value={form.poster_url}
          onChange={e => updateField('poster_url', e.target.value)} />

        <label>या मोबाइल Gallery से Poster चुनें</label>
        <input
          type="file"
          accept="image/*"
          onChange={e => setPosterFile(e.target.files?.[0] || null)}
        />
        {posterFile && <p>Selected: {posterFile.name}</p>}

        <input placeholder="Release year" type="number" value={form.release_year}
          onChange={e => updateField('release_year', e.target.value)} />

        <select value={form.content_type}
          onChange={e => updateField('content_type', e.target.value)}>
          <option value="movie">Movie</option>
          <option value="series">Series</option>
        </select>

        <button type="submit" disabled={loading}>
          {loading ? 'Please wait...' : editingId ? 'Update Movie' : 'Add Movie'}
        </button>

        {editingId && (
          <button type="button" onClick={() => {
            setEditingId(null)
            setForm(emptyForm)
            setPosterFile(null)
          }}>
            Cancel Edit
          </button>
        )}
      </form>

      <div className="admin-list">
        <h2>Content Library ({movies.length})</h2>

        {movies.map(movie => (
          <article className="admin-movie" key={movie.id}>
            <div>
              {movie.poster_url && (
                <img
                  src={movie.poster_url}
                  alt={movie.title}
                  style={{ width: 90, borderRadius: 8, marginBottom: 10 }}
                />
              )}
              <h3>{movie.title}</h3>
              <p>{movie.content_type} · {movie.release_year || 'Year unknown'}</p>
              <p>Published: {movie.is_published ? 'Yes' : 'No'}</p>
              <p>Rights verified: {movie.rights_verified ? 'Yes' : 'No'}</p>
            </div>

            <div className="admin-actions">
              <button onClick={() => editMovie(movie)}>Edit</button>
              <button onClick={() => toggleRights(movie)}>
                {movie.rights_verified ? 'Remove Rights' : 'Verify Rights'}
              </button>
              <button onClick={() => togglePublish(movie)}>
                {movie.is_published ? 'Unpublish' : 'Publish'}
              </button>
              <button onClick={() => deleteMovie(movie.id)}>Delete</button>
            </div>
          </article>
        ))}

        {movies.length === 0 && <p>No content found.</p>}
      </div>
    </section>
  )
}
