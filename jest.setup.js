import '@testing-library/jest-dom'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
})

const { window } = dom

function copyProps(src, target) {
  Object.defineProperties(
    target,
    Object.getOwnPropertyNames(src)
      .filter(prop => !(prop in target))
      .reduce((result, prop) => {
        result[prop] = Object.getOwnPropertyDescriptor(src, prop)
        return result
      }, {})
  )
}

global.window = window
global.document = window.document
global.navigator = window.navigator
copyProps(window, global)

if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = callback => window.setTimeout(() => callback(Date.now()), 0)
  window.cancelAnimationFrame = id => window.clearTimeout(id)
}

if (!Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, 'innerText')) {
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
    get() {
      return this.textContent || ''
    },
    set(value) {
      this.textContent = value
    },
  })
}
