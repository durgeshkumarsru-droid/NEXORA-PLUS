import { useState } from 'react'

type Props = {
  name: string
  email: string
  phone: string
  language: string
  saving: boolean
  onNameChange: (value: string) => void
  onLanguageChange: (value: string) => void
  onSave: () => void
}

export default function PersonalDetails({
  name, email, phone, language, saving,
  onNameChange, onLanguageChange, onSave
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <section className="profile-panel personal-details-panel">
      <button
        type="button"
        className="personal-details-toggle"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span>
          <b>Personal Details</b>
          <small>Name, Gmail, mobile number and preferences</small>
        </span>
        <strong>{open ? '⌃' : '⌄'}</strong>
      </button>

      {open && (
        <div className="personal-details-content">
          <label htmlFor="profile-name">Your Name</label>
          <input
            id="profile-name"
            value={name}
            onChange={e => onNameChange(e.target.value)}
            placeholder="Enter your name"
          />

          <label>Registered Gmail</label>
          <input value={email || 'Not available'} readOnly />

          <label>Mobile Number</label>
          <input value={phone || 'Not added'} readOnly />

          <label htmlFor="profile-language">Preferred Language</label>
          <select
            id="profile-language"
            value={language}
            onChange={e => onLanguageChange(e.target.value)}
          >
            {['English','Hindi','Arabic','Urdu','Spanish','French','Portuguese','Japanese','Korean','Chinese'].map(x => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>

          <button
            type="button"
            className="profile-save"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </section>
  )
}
