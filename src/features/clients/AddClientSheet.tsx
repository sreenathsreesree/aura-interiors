import { useState } from 'react'
import { Sheet, Input, Textarea, Button } from '@/components/ui'
import { useAppStore } from '@/store/useAppStore'
import type { Client } from '@/types'

const AVATAR_COLORS = ['brass', 'terracotta', 'sage', 'clay', 'ink']

interface AddClientSheetProps {
  open: boolean
  onClose: () => void
  onCreated?: (client: Client) => void
}

export function AddClientSheet({ open, onClose, onCreated }: AddClientSheetProps) {
  const addClient = useAppStore((s) => s.addClient)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [notes, setNotes] = useState('')

  const isValid = name.trim().length > 1 && phone.trim().length > 3

  function reset() {
    setName('')
    setPhone('')
    setEmail('')
    setAddress('')
    setCity('')
    setNotes('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleSubmit() {
    if (!isValid) return
    const client = addClient({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      city: city.trim(),
      status: 'lead',
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      notes: notes.trim() || undefined,
    })
    onCreated?.(client)
    reset()
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title="Add Client"
      subtitle="Capture the essentials — you can add more later."
      footer={
        <Button fullWidth size="xl" disabled={!isValid} onClick={handleSubmit}>
          Save Client
        </Button>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        <Input
          label="Full Name"
          placeholder="e.g. Ananya Mehta"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Input
          label="Phone Number"
          placeholder="+91 98765 43210"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          label="Email"
          placeholder="client@email.com"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="City"
            placeholder="Bengaluru"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <Input
            label="Address"
            placeholder="Project site / home"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <Textarea
          label="Notes (optional)"
          placeholder="Preferences, referral source, anything worth remembering..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Sheet>
  )
}
