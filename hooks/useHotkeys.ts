import { useEffect } from "react"
import { useSettings } from "@/state/settings"

export function useEditorHotkeys() {
  const toggleCounts = useSettings(state => state.toggleShowSyllableCounts)

  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      if (
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault()
        toggleCounts()
      }
    }

    window.addEventListener("keydown", onKeydown)
    return () => window.removeEventListener("keydown", onKeydown)
  }, [toggleCounts])
}
