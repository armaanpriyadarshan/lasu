import React from 'react'
import { Platform } from 'react-native'
import { Colors } from '@/constants/theme'

const isWeb = Platform.OS === 'web'
const C = Colors.light

export const ICONS = {
  grid: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><rect x="1.5" y="1.5" width="5" height="5" rx="1"/><rect x="9.5" y="1.5" width="5" height="5" rx="1"/><rect x="1.5" y="9.5" width="5" height="5" rx="1"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/></svg>`,
  globe: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6.5"/><ellipse cx="8" cy="8" rx="3" ry="6.5"/><line x1="1.5" y1="8" x2="14.5" y2="8"/></svg>`,
  bookmark: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M3 14V3a1 1 0 011-1h8a1 1 0 011 1v11l-4-2.5L5 14z"/></svg>`,
  star: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path d="M8 1.5l1.8 3.7 4 .6-2.9 2.8.7 4L8 10.8 4.4 12.6l.7-4-2.9-2.8 4-.6z"/></svg>`,
  gear: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="2"/><path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.3 3.3l.7.7M12 12l.7.7M12.7 3.3l-.7.7M4 12l-.7.7"/><path d="M6 2.5a6 6 0 014 0M13.5 6a6 6 0 010 4M10 13.5a6 6 0 01-4 0M2.5 10a6 6 0 010-4"/></svg>`,
  logout: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6"/></svg>`,
} as const

export type IconName = keyof typeof ICONS

/**
 * Renders a 16x16 stroke SVG icon. Web only — returns null on native.
 */
export function SvgIcon({
  name,
  color,
  size = 16,
}: {
  name: IconName
  color?: string
  size?: number
}) {
  if (!isWeb) return null
  const fill = color ?? C.graphite
  return React.createElement('div', {
    style: { width: size, height: size, flexShrink: 0 },
    dangerouslySetInnerHTML: {
      __html: ICONS[name].replace(/currentColor/g, fill),
    },
  })
}
