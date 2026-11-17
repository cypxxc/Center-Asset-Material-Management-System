'use client'

import { createContext } from 'react'

export type ImportMode = 'asset' | 'material'
export const ImportModeContext = createContext<{ mode: ImportMode; busy: boolean; setMode: (mode: ImportMode) => void } | null>(null)
