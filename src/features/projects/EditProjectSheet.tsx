import { useState } from 'react'
import { Sheet, Input, Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/useAppStore'
import { PROJECT_STATUS_META, PROJECT_TYPE_LABEL } from '@/data/statusMeta'
import type { Project, ProjectStatus, ProjectType } from '@/types'

const PROJECT_TYPES = Object.entries(PROJECT_TYPE_LABEL) as [ProjectType, string][]
const PROJECT_STATUSES = Object.entries(PROJECT_STATUS_META) as [ProjectStatus, { label: string }][]

interface EditProjectSheetProps {
  open: boolean
  onClose: () => void
  project: Project
}

// Project name/type/status/address/budget/target date — the fields
// NewProjectPage's own copy promises are editable "anytime" but, until now,
// never actually were. Pricing has its own dedicated PricingConfigSheet and
// stays untouched here; rooms are managed from the project detail grid.
export function EditProjectSheet({ open, onClose, project }: EditProjectSheetProps) {
  const updateProject = useAppStore((s) => s.updateProject)

  const [name, setName] = useState(project.name)
  const [type, setType] = useState<ProjectType>(project.type)
  const [status, setStatus] = useState<ProjectStatus>(project.status)
  const [address, setAddress] = useState(project.address)
  const [budget, setBudget] = useState(String(project.budgetEstimate || ''))
  const [targetDate, setTargetDate] = useState(project.targetDate ?? '')

  const isValid = name.trim().length > 1 && address.trim().length > 1

  function reset() {
    setName(project.name)
    setType(project.type)
    setStatus(project.status)
    setAddress(project.address)
    setBudget(String(project.budgetEstimate || ''))
    setTargetDate(project.targetDate ?? '')
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleSave() {
    if (!isValid) return
    updateProject(project.id, {
      name: name.trim(),
      type,
      status,
      address: address.trim(),
      budgetEstimate: Number(budget) || 0,
      targetDate: targetDate || undefined,
    })
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title="Edit Project"
      subtitle="Update the project's details or status."
      footer={
        <Button fullWidth size="xl" disabled={!isValid} onClick={handleSave}>
          Save Changes
        </Button>
      }
    >
      <div className="flex flex-col gap-5 py-2">
        <Input label="Project Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink-700">Status</span>
          <div className="flex flex-wrap gap-2">
            {PROJECT_STATUSES.map(([key, meta]) => (
              <button
                key={key}
                onClick={() => setStatus(key)}
                className={cn(
                  'h-10 rounded-full border-2 px-4 text-sm font-semibold transition-colors',
                  status === key
                    ? 'border-ink-900 bg-ink-900 text-sand-50'
                    : 'border-ink-100 bg-white text-ink-600 hover:border-ink-300',
                )}
              >
                {meta.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink-700">Project Type</span>
          <div className="flex flex-wrap gap-2">
            {PROJECT_TYPES.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setType(key)}
                className={cn(
                  'h-10 rounded-full border-2 px-4 text-sm font-semibold transition-colors',
                  type === key
                    ? 'border-ink-900 bg-ink-900 text-sand-50'
                    : 'border-ink-100 bg-white text-ink-600 hover:border-ink-300',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Input label="Site Address" value={address} onChange={(e) => setAddress(e.target.value)} />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Budget Estimate"
            inputMode="numeric"
            prefix="₹"
            value={budget}
            onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ''))}
          />
          <Input label="Target Date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </div>
      </div>
    </Sheet>
  )
}
