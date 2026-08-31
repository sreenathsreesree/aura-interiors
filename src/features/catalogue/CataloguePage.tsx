import { useMemo, useState } from 'react'
import { Search, Plus, LibraryBig, EyeOff } from 'lucide-react'
import { PageHeader, Button, Card, Badge, EmptyState } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/useAppStore'
import { CATALOGUE_CATEGORIES } from '@/data/catalogue'
import { formatCurrency } from '@/lib/format'
import { CatalogueItemSheet } from './CatalogueItemSheet'
import type { CatalogueItem } from '@/types'

const UNIT_LABEL: Record<string, string> = {
  sqft: 'sqft',
  rft: 'rft',
  nos: 'nos',
  'lump-sum': 'lump sum',
}

type CategoryTab = 'all' | (typeof CATALOGUE_CATEGORIES)[number]

export function CataloguePage() {
  const catalogueItems = useAppStore((s) => s.catalogueItems)

  const [query, setQuery] = useState('')
  const [categoryTab, setCategoryTab] = useState<CategoryTab>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [sheetState, setSheetState] = useState<{ open: boolean; editing?: CatalogueItem }>({ open: false })

  const filtered = useMemo(() => {
    return catalogueItems.filter((item) => {
      const matchesCategory = categoryTab === 'all' || item.category === categoryTab
      const matchesActive = showInactive || item.isActive
      const matchesQuery =
        query.trim().length === 0 ||
        item.name.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase()) ||
        (item.subCategory ?? '').toLowerCase().includes(query.toLowerCase())
      return matchesCategory && matchesActive && matchesQuery
    })
  }, [catalogueItems, categoryTab, showInactive, query])

  const activeCount = catalogueItems.filter((i) => i.isActive).length

  return (
    <div>
      <PageHeader
        title="Catalogue"
        subtitle={`${activeCount} active items in your studio rate card`}
        actions={
          <Button icon={<Plus className="h-5 w-5" />} onClick={() => setSheetState({ open: true })}>
            Add Item
          </Button>
        }
      />

      <div className="px-5 py-6 sm:px-8">
        <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search catalogue..."
              className="h-13 w-full rounded-[--radius-md] border-2 border-ink-100 bg-white pl-12 pr-4 text-base text-ink-900 placeholder:text-ink-400 outline-none transition-colors focus:border-brass-500"
            />
          </div>

          <button
            onClick={() => setShowInactive((v) => !v)}
            className={cn(
              'flex h-11 shrink-0 items-center gap-2 rounded-[--radius-md] border-2 px-4 text-sm font-semibold transition-colors',
              showInactive
                ? 'border-ink-900 bg-ink-900 text-sand-50'
                : 'border-ink-100 bg-white text-ink-600 hover:border-ink-300',
            )}
          >
            <EyeOff className="h-4 w-4" />
            {showInactive ? 'Showing Inactive' : 'Show Inactive'}
          </button>
        </div>

        <div className="mt-3.5 flex gap-1.5 overflow-x-auto rounded-[--radius-md] bg-ink-50 p-1.5 no-scrollbar">
          <button
            onClick={() => setCategoryTab('all')}
            className={cn(
              'h-10 shrink-0 rounded-[calc(var(--radius-md)-0.35rem)] px-4 text-sm font-semibold transition-colors',
              categoryTab === 'all' ? 'bg-white text-ink-900 shadow-[--shadow-soft]' : 'text-ink-500',
            )}
          >
            All
          </button>
          {CATALOGUE_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryTab(c)}
              className={cn(
                'h-10 shrink-0 rounded-[calc(var(--radius-md)-0.35rem)] px-4 text-sm font-semibold transition-colors',
                categoryTab === c ? 'bg-white text-ink-900 shadow-[--shadow-soft]' : 'text-ink-500',
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            className="mt-8"
            icon={<LibraryBig className="h-8 w-8" />}
            title="No catalogue items found"
            description="Try a different search term or filter, or add a new item to the rate card."
            action={
              <Button icon={<Plus className="h-5 w-5" />} onClick={() => setSheetState({ open: true })}>
                Add Item
              </Button>
            }
          />
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <Card
                key={item.id}
                interactive
                onClick={() => setSheetState({ open: true, editing: item })}
                className={cn('flex flex-col gap-3', !item.isActive && 'opacity-60')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {item.category}
                      {item.subCategory ? ` · ${item.subCategory}` : ''}
                    </p>
                    <h3 className="mt-0.5 truncate font-display text-lg font-semibold text-ink-900">
                      {item.name}
                    </h3>
                  </div>
                  {!item.isActive && (
                    <Badge tone="neutral" className="shrink-0">
                      Inactive
                    </Badge>
                  )}
                </div>

                {item.description && (
                  <p className="line-clamp-2 text-sm text-ink-500">{item.description}</p>
                )}

                {(item.material || item.finish || item.brand) && (
                  <div className="flex flex-wrap gap-1.5">
                    {item.material && <Badge tone="sage">{item.material}</Badge>}
                    {item.finish && <Badge tone="brass">{item.finish}</Badge>}
                    {item.brand && <Badge tone="ink">{item.brand}</Badge>}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-ink-100 pt-3">
                  <span className="text-xs font-medium text-ink-400">Master Rate</span>
                  <span className="font-display text-base font-semibold text-ink-900">
                    {formatCurrency(item.defaultRate)}
                    <span className="ml-1 text-xs font-medium text-ink-400">
                      /{UNIT_LABEL[item.unit]}
                    </span>
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CatalogueItemSheet
        key={sheetState.editing?.id ?? 'new'}
        open={sheetState.open}
        onClose={() => setSheetState({ open: false })}
        editingItem={sheetState.editing}
      />
    </div>
  )
}
