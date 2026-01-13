'use client'

import { useEffect } from 'react'
import { layers } from '@/lib/layers'

const MAX_PARENTS = 10

const isDev = () => process.env.NODE_ENV === 'development'

const formatRect = (rect: DOMRect) =>
  `rect=${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`

const getZIndex = (value: string) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

const buildNodeInfo = (el: Element) => {
  const style = window.getComputedStyle(el)
  const rect = el.getBoundingClientRect()
  return {
    tag: el.tagName.toLowerCase(),
    id: (el as HTMLElement).id || '—',
    className: (el as HTMLElement).className || '—',
    position: style.position,
    zIndex: style.zIndex,
    pointerEvents: style.pointerEvents,
    rect: formatRect(rect),
  }
}

const logTree = (target: Element | null) => {
  if (!target) {
    // eslint-disable-next-line no-console
    console.log('[settings-debug] elementFromPoint: null')
    return
  }
  const entries: ReturnType<typeof buildNodeInfo>[] = []
  let current: Element | null = target
  for (let i = 0; i < MAX_PARENTS && current; i += 1) {
    entries.push(buildNodeInfo(current))
    current = current.parentElement
  }

  // eslint-disable-next-line no-console
  console.groupCollapsed('[settings-debug] elementFromPoint stack')
  entries.forEach((entry, index) => {
    // eslint-disable-next-line no-console
    console.log(
      `${index === 0 ? '→' : '  '} ${entry.tag}#${entry.id}.${entry.className}`,
      `${entry.position} z=${entry.zIndex} pe=${entry.pointerEvents} ${entry.rect}`
    )
  })
  // eslint-disable-next-line no-console
  console.groupEnd()
}

const auditOverlayBlockers = () => {
  const viewportArea = window.innerWidth * window.innerHeight
  const thresholdArea = viewportArea * 0.8
  const elements = Array.from(document.body.querySelectorAll('*'))
  const suspects = elements
    .map((el) => {
      const style = window.getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      if (!(style.position === 'fixed' || style.position === 'absolute')) return null
      if (style.pointerEvents === 'none') return null
      const area = rect.width * rect.height
      if (area < thresholdArea) return null
      const zIndex = getZIndex(style.zIndex)
      if (zIndex < layers.modalBackdrop) return null
      return {
        el,
        zIndex,
        area,
        position: style.position,
        pointerEvents: style.pointerEvents,
        rect: formatRect(rect),
      }
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((a, b) => b.zIndex - a.zIndex || b.area - a.area)
    .slice(0, 20)

  // eslint-disable-next-line no-console
  console.groupCollapsed('[settings-debug] overlay audit (top suspects)')
  suspects.forEach((item, index) => {
    const el = item.el as HTMLElement
    // eslint-disable-next-line no-console
    console.log(
      `${index + 1}. ${el.tagName.toLowerCase()}#${el.id || '—'}.${
        el.className || '—'
      } z=${item.zIndex} pe=${item.pointerEvents} pos=${item.position} ${item.rect}`
    )
  })
  if (!suspects.length) {
    // eslint-disable-next-line no-console
    console.log('No full-screen blockers detected above threshold.', {
      settingsZ: layers.modalContent,
    })
  }
  // eslint-disable-next-line no-console
  console.groupEnd()
}

export function useSettingsClickDebug(isOpen: boolean) {
  useEffect(() => {
    if (!isDev()) return
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = document.elementFromPoint(event.clientX, event.clientY)
      logTree(target)
    }

    const timer = window.setTimeout(() => {
      auditOverlayBlockers()
    }, 0)

    window.addEventListener('pointerdown', handlePointerDown, true)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [isOpen])
}
