import { create } from "zustand"
import { persist } from "zustand/middleware"

type SettingsState = {
  showSyllableCounts: boolean
  setShowSyllableCounts: (value: boolean) => void
  toggleShowSyllableCounts: () => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      showSyllableCounts: true,
      setShowSyllableCounts: value => set({ showSyllableCounts: value }),
      toggleShowSyllableCounts: () =>
        set({ showSyllableCounts: !get().showSyllableCounts }),
    }),
    { name: "rl:showCounts:v1" }
  )
)
