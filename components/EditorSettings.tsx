'use client'

import { useState, useEffect } from 'react'

interface EditorPreferences {
  fontSize: number
  lineHeight: number
}

const STORAGE_KEY = 'editorPrefs'
const DEFAULT_PREFS: EditorPreferences = {
  fontSize: 16,
  lineHeight: 1.7,
}

const FONT_SIZE_MIN = 14
const FONT_SIZE_MAX = 24
const LINE_HEIGHT_MIN = 1.2
const LINE_HEIGHT_MAX = 2.0

export default function EditorSettings() {
  const [prefs, setPrefs] = useState<EditorPreferences>(DEFAULT_PREFS)
  const [isOpen, setIsOpen] = useState(false)

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as EditorPreferences
        // Validate the parsed preferences
        const validatedPrefs: EditorPreferences = {
          fontSize: Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, parsed.fontSize || DEFAULT_PREFS.fontSize)),
          lineHeight: Math.max(LINE_HEIGHT_MIN, Math.min(LINE_HEIGHT_MAX, parsed.lineHeight || DEFAULT_PREFS.lineHeight)),
        }
        setPrefs(validatedPrefs)
        applyPreferences(validatedPrefs)
      } else {
        applyPreferences(DEFAULT_PREFS)
      }
    } catch (error) {
      console.warn('Failed to load editor preferences:', error)
      applyPreferences(DEFAULT_PREFS)
    }
  }, [])

  const applyPreferences = (newPrefs: EditorPreferences) => {
    const root = document.documentElement
    root.style.setProperty('--editor-font-size', `${newPrefs.fontSize}px`)
    root.style.setProperty('--editor-line-height', newPrefs.lineHeight.toString())
  }

  const savePreferences = (newPrefs: EditorPreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs))
      applyPreferences(newPrefs)
    } catch (error) {
      console.warn('Failed to save editor preferences:', error)
    }
  }

  const handleFontSizeChange = (value: number) => {
    const newPrefs = { ...prefs, fontSize: value }
    setPrefs(newPrefs)
    savePreferences(newPrefs)
  }

  const handleLineHeightChange = (value: number) => {
    const newPrefs = { ...prefs, lineHeight: value }
    setPrefs(newPrefs)
    savePreferences(newPrefs)
  }

  const resetToDefaults = () => {
    setPrefs(DEFAULT_PREFS)
    savePreferences(DEFAULT_PREFS)
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm font-medium text-[#d4d4d4] hover:text-white transition-colors duration-200"
        title="Editor settings"
      >
        ⚙️
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#1e1e1e] border border-[#2c2c2c] rounded-lg p-6 w-96 max-w-[90vw]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Editor Settings</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white text-xl leading-none"
            aria-label="Close settings"
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          {/* Font Size */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Font Size: {prefs.fontSize}px
            </label>
            <input
              type="range"
              min={FONT_SIZE_MIN}
              max={FONT_SIZE_MAX}
              value={prefs.fontSize}
              onChange={(e) => handleFontSizeChange(Number(e.target.value))}
              className="w-full h-2 bg-[#2c2c2c] rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{FONT_SIZE_MIN}px</span>
              <span>{FONT_SIZE_MAX}px</span>
            </div>
          </div>

          {/* Line Height */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Line Height: {prefs.lineHeight.toFixed(1)}
            </label>
            <input
              type="range"
              min={LINE_HEIGHT_MIN}
              max={LINE_HEIGHT_MAX}
              step={0.1}
              value={prefs.lineHeight}
              onChange={(e) => handleLineHeightChange(Number(e.target.value))}
              className="w-full h-2 bg-[#2c2c2c] rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{LINE_HEIGHT_MIN}</span>
              <span>{LINE_HEIGHT_MAX}</span>
            </div>
          </div>

          {/* Reset Button */}
          <div className="pt-4 border-t border-[#2c2c2c]">
            <button
              onClick={resetToDefaults}
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
