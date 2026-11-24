import { useState } from 'react'

type Props = {
  email: string
  phone: string
}

export default function PersonalDetails({ email, phone }: Props) {
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
          <small>Gmail and mobile number</small>
        </span>
        <strong>{open ? '⌃' : '⌄'}</strong>
      </button>
      {open && (
        <div className="personal-details-content">
          <label>Registered Gmail</label>
          <input value={email || 'Not available'} readOnly />
          <label>Mobile Number</label>
          <input value={phone || 'Not added'} readOnly />
        </div>
      )}
    </section>
  )
}
