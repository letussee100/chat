import { expect, afterEach } from "vitest"
import { cleanup } from "@testing-library/react"
import * as matchers from "@testing-library/jest-dom/matchers"

// Extend Vitest's expect with Testing Library matchers
expect.extend(matchers)

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock crypto.subtle for Node.js environment
if (typeof globalThis.crypto === "undefined") {
  import("crypto").then(({ webcrypto }) => {
    globalThis.crypto = webcrypto as unknown as Crypto
  })
}
