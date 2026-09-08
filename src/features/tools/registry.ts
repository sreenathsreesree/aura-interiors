// Interior Tools — calculator registry.
//
// The single place every calculator (active or coming-soon) is declared.
// Adding a future calculator means adding one entry here plus, once it's
// actually built, one case in CalculatorPage.tsx's renderer — nothing else
// in the feature needs to change.

import type { CalculatorDefinition } from './types'

export const CALCULATOR_REGISTRY: CalculatorDefinition[] = [
  // Measurement
  {
    id: 'area',
    label: 'Area Calculator',
    category: 'measurement',
    description: 'Length × width, in any unit — with the m² and sqft conversion alongside.',
    icon: 'Square',
    status: 'active',
  },
  {
    id: 'running-feet',
    label: 'Running Feet Calculator',
    category: 'measurement',
    description: 'A single length, in running feet and running metres.',
    icon: 'Ruler',
    status: 'active',
  },

  // Material
  {
    id: 'paint',
    label: 'Paint Calculator',
    category: 'material',
    description: 'Wall area, coats, coverage and wastage down to an estimated litre quantity.',
    icon: 'PaintBucket',
    status: 'active',
  },
  {
    id: 'flooring',
    label: 'Flooring / Tile Calculator',
    category: 'material',
    description: 'Room and tile size to a wastage-adjusted tile (and box) count.',
    icon: 'Grid3x3',
    status: 'active',
  },
  {
    id: 'plywood',
    label: 'Plywood / Sheet Calculator',
    category: 'material',
    description: 'Sheet material take-off for a given area.',
    icon: 'Layers',
    status: 'coming-soon',
  },

  // Interior
  {
    id: 'false-ceiling',
    label: 'False Ceiling Calculator',
    category: 'interior',
    description: 'Ceiling area, optional board size, wastage and an optional amount.',
    icon: 'PanelTop',
    status: 'active',
  },
  {
    id: 'wardrobe',
    label: 'Wardrobe Calculator',
    category: 'interior',
    description: 'Shutter area and running feet for a wardrobe elevation.',
    icon: 'DoorClosed',
    status: 'coming-soon',
  },
  {
    id: 'kitchen',
    label: 'Kitchen Calculator',
    category: 'interior',
    description: 'Base + wall unit running feet and countertop area.',
    icon: 'CookingPot',
    status: 'coming-soon',
  },
  {
    id: 'wall-panel',
    label: 'Wall Panel Calculator',
    category: 'interior',
    description: 'Panel area and count for a wall treatment.',
    icon: 'PanelsTopLeft',
    status: 'coming-soon',
  },
  {
    id: 'curtain',
    label: 'Curtain Calculator',
    category: 'interior',
    description: 'Fabric width and drop for a window/track.',
    icon: 'Blinds',
    status: 'coming-soon',
  },
  {
    id: 'lighting',
    label: 'Lighting Calculator',
    category: 'interior',
    description: 'Fixture count and points for a room.',
    icon: 'Lightbulb',
    status: 'coming-soon',
  },
  {
    id: 'electrical',
    label: 'Electrical Calculator',
    category: 'interior',
    description: 'Point count and wiring run estimate for a room.',
    icon: 'Zap',
    status: 'coming-soon',
  },

  // Estimation
  {
    id: 'project-estimate',
    label: 'Project Estimate',
    category: 'estimation',
    description: 'A rough whole-project estimate from room areas and rates.',
    icon: 'Calculator',
    status: 'coming-soon',
  },
]

export const CALCULATOR_CATEGORY_LABEL: Record<CalculatorDefinition['category'], string> = {
  measurement: 'Measurement',
  material: 'Material',
  interior: 'Interior',
  estimation: 'Estimation',
}

export function getCalculatorDefinition(id: string): CalculatorDefinition | undefined {
  return CALCULATOR_REGISTRY.find((c) => c.id === id)
}
