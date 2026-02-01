/* eslint-disable @typescript-eslint/no-require-imports */
require('@testing-library/jest-dom')

if (typeof window !== 'undefined' && !window.requestAnimationFrame) {
  window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(Date.now()), 0)
  window.cancelAnimationFrame = (id) => window.clearTimeout(id)
}

if (typeof window !== 'undefined') {
  const hasInnerText = !!Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, 'innerText')
  if (!hasInnerText) {
    Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
      get() {
        return this.textContent || ''
      },
      set(value) {
        this.textContent = value
      },
    })
  }
  if (!('ResizeObserver' in window)) {
    class ResizeObserver {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    // @ts-expect-error - jsdom lacks ResizeObserver typings in this test harness.
    window.ResizeObserver = ResizeObserver
    // @ts-expect-error - jsdom lacks ResizeObserver typings in this test harness.
    global.ResizeObserver = ResizeObserver
  }
  if (!('IntersectionObserver' in window)) {
    class IntersectionObserver {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    // @ts-expect-error - jsdom lacks IntersectionObserver typings in this test harness.
    window.IntersectionObserver = IntersectionObserver
    // @ts-expect-error - jsdom lacks IntersectionObserver typings in this test harness.
    global.IntersectionObserver = IntersectionObserver
  }
}
