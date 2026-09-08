import { useState } from 'react'
import { Sheet, Input, Textarea, Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/useAppStore'
import { CLIENT_STATUS_META } from '@/data/statusMeta'
import type { Client, ClientStatus } from '@/types'

const AVATAR_COLORS = ['brass', 'terracotta', 'sage', 'clay', 'ink']
const STATUS_OPTIONS: ClientStatus[] = ['lead', 'active', 'archived']

interface ClientFormSheetProps {
  open: boolean
  onClose: () => void
  /** Provide an existing client to edit it in place; omit to create a new one. */
  client?: Client
  onSaved?: (client: Client) => void
}

// Shared create/edit form for a Client. Editing an existing client also
// exposes its status (Lead/Active/Archived) — a new client always starts as
// a Lead, same as before.
export function ClientFormSheet({ open, onClose, client, onSaved }: ClientFormSheetProps) {
  const addClient = useAppStore((s) => s.addClient)
  const updateClient = useAppStore((s) => s.updateClient)
  const isEditing = Boolean(client)

  const [name, setName] = useState(client?.name ?? '')
  const [phone, setPhone] = useState(client?.phone ?? '')
  const [email, setEmail] = useState(client?.email ?? '')
  const [address, setAddress] = useState(client?.address ?? '')
  const [city, setCity] = useState(client?.city ?? '')
  const [notes, setNotes] = useState(client?.notes ?? '')
  const [status, setStatus] = useState<ClientStatus>(client?.status ?? 'lead')

  const isValid = name.trim().length > 1 && phone.trim().length > 3

  function reset() {
    setName(client?.name ?? '')
    setPhone(client?.phone ?? '')
    setEmail(client?.email ?? '')
    setAddress(client?.address ?? '')
    setCity(client?.city ?? '')
    setNotes(client?.notes ?? '')
    setStatus(client?.status ?? 'lead')
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleSubmit() {
    if (!isValid) return
    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      city: city.trim(),
      notes: notes.trim() || undefined,
    }

    if (client) {
      updateClient(client.id, { ...payload, status })
      onSaved?.({ ...client, ...payload, status })
    } else {
      const created = addClient({
        ...payload,
        status: 'lead',
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      })
      onSaved?.(created)
    }
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={isEditing ? 'Edit Client' : 'Add Client'}
      subtitle={isEditing ? 'Update their details or status.' : 'Capture the essentials — you can add more later.'}
      footer={
        <Button fullWidth size="xl" disabled={!isValid} onClick={handleSubmit}>
          {isEditing ? 'Save Changes' : 'Save Client'}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        {isEditing && (
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-ink-700">Status</span>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => setStatus(option)}
                  className={cn(
                    'h-10 rounded-full border-2 px-4 text-sm font-semibold transition-colors',
                    status === option
                      ? 'border-ink-900 bg-ink-900 text-sand-50'
                      : 'border-ink-100 bg-white text-ink-600 hover:border-ink-300',
                  )}
                >
                  {CLIENT_STATUS_META[option].label}
                </button>
              ))}
            </div>
          </div>
        )}
        <Input
          label="Full Name"
          placeholder="e.g. Ananya Mehta"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus={!isEditing}
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
