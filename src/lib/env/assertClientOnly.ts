import { isClient } from './isClient'

export function assertClientOnly(featureName: string): void {
  if (process.env.NODE_ENV === 'development' && !isClient()) {
    throw new Error(`[client-only] ${featureName} must run in a browser environment`)
  }
}
