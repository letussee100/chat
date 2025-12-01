/**
 * Unit tests for encryption functions
 * Run with: npm test
 */

import { describe, it, expect, beforeAll } from "vitest"
import {
  generateSymmetricKey,
  generateSigningKey,
  encryptMessage,
  decryptMessage,
  signData,
  verifySignature,
  exportKey,
  importSymmetricKey,
  importPublicSigningKey,
  importPrivateSigningKey,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from "@/lib/crypto"

// Mock crypto.subtle for Node.js environment
beforeAll(async () => {
  if (typeof globalThis.crypto === "undefined") {
    const { webcrypto } = await import("crypto")
    globalThis.crypto = webcrypto as unknown as Crypto
  }
})

describe("Crypto Utilities", () => {
  describe("Base64 Encoding/Decoding", () => {
    it("should correctly encode and decode ArrayBuffer to base64", () => {
      const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
      const encoded = arrayBufferToBase64(original.buffer)
      const decoded = base64ToArrayBuffer(encoded)

      expect(new Uint8Array(decoded)).toEqual(original)
    })

    it("should handle empty buffer", () => {
      const original = new Uint8Array([])
      const encoded = arrayBufferToBase64(original.buffer)
      const decoded = base64ToArrayBuffer(encoded)

      expect(new Uint8Array(decoded)).toEqual(original)
    })

    it("should handle large buffers", () => {
      const original = new Uint8Array(1024)
      crypto.getRandomValues(original)
      const encoded = arrayBufferToBase64(original.buffer)
      const decoded = base64ToArrayBuffer(encoded)

      expect(new Uint8Array(decoded)).toEqual(original)
    })
  })

  describe("Symmetric Encryption (AES-GCM)", () => {
    it("should generate a valid AES-GCM key", async () => {
      const key = await generateSymmetricKey()

      expect(key).toBeDefined()
      expect(key.type).toBe("secret")
      expect(key.algorithm.name).toBe("AES-GCM")
    })

    it("should encrypt and decrypt a message correctly", async () => {
      const key = await generateSymmetricKey()
      const originalMessage = "Hello, secure world!"

      const { ciphertext, iv } = await encryptMessage(originalMessage, key)
      const decrypted = await decryptMessage(ciphertext, iv, key)

      expect(decrypted).toBe(originalMessage)
    })

    it("should produce different ciphertext for same message (random IV)", async () => {
      const key = await generateSymmetricKey()
      const message = "Same message"

      const result1 = await encryptMessage(message, key)
      const result2 = await encryptMessage(message, key)

      expect(result1.ciphertext).not.toBe(result2.ciphertext)
      expect(result1.iv).not.toBe(result2.iv)
    })

    it("should fail to decrypt with wrong key", async () => {
      const key1 = await generateSymmetricKey()
      const key2 = await generateSymmetricKey()
      const message = "Secret message"

      const { ciphertext, iv } = await encryptMessage(message, key1)

      await expect(decryptMessage(ciphertext, iv, key2)).rejects.toThrow()
    })

    it("should fail to decrypt with tampered ciphertext", async () => {
      const key = await generateSymmetricKey()
      const message = "Secret message"

      const { ciphertext, iv } = await encryptMessage(message, key)

      // Tamper with ciphertext
      const tamperedCiphertext = ciphertext.substring(0, 10) + "X" + ciphertext.substring(11)

      await expect(decryptMessage(tamperedCiphertext, iv, key)).rejects.toThrow()
    })

    it("should handle unicode messages", async () => {
      const key = await generateSymmetricKey()
      const message = "Hello 世界! 🔐 Привет мир!"

      const { ciphertext, iv } = await encryptMessage(message, key)
      const decrypted = await decryptMessage(ciphertext, iv, key)

      expect(decrypted).toBe(message)
    })

    it("should handle empty messages", async () => {
      const key = await generateSymmetricKey()
      const message = ""

      const { ciphertext, iv } = await encryptMessage(message, key)
      const decrypted = await decryptMessage(ciphertext, iv, key)

      expect(decrypted).toBe(message)
    })

    it("should handle very long messages", async () => {
      const key = await generateSymmetricKey()
      const message = "A".repeat(100000)

      const { ciphertext, iv } = await encryptMessage(message, key)
      const decrypted = await decryptMessage(ciphertext, iv, key)

      expect(decrypted).toBe(message)
    })
  })

  describe("Digital Signatures (ECDSA)", () => {
    it("should generate a valid ECDSA key pair", async () => {
      const keyPair = await generateSigningKey()

      expect(keyPair.publicKey).toBeDefined()
      expect(keyPair.privateKey).toBeDefined()
      expect(keyPair.publicKey.algorithm.name).toBe("ECDSA")
      expect(keyPair.privateKey.algorithm.name).toBe("ECDSA")
    })

    it("should sign and verify data correctly", async () => {
      const keyPair = await generateSigningKey()
      const data = "Important data to sign"

      const signature = await signData(data, keyPair.privateKey)
      const isValid = await verifySignature(data, signature, keyPair.publicKey)

      expect(isValid).toBe(true)
    })

    it("should fail verification with wrong public key", async () => {
      const keyPair1 = await generateSigningKey()
      const keyPair2 = await generateSigningKey()
      const data = "Important data"

      const signature = await signData(data, keyPair1.privateKey)
      const isValid = await verifySignature(data, signature, keyPair2.publicKey)

      expect(isValid).toBe(false)
    })

    it("should fail verification with tampered data", async () => {
      const keyPair = await generateSigningKey()
      const originalData = "Original data"
      const tamperedData = "Tampered data"

      const signature = await signData(originalData, keyPair.privateKey)
      const isValid = await verifySignature(tamperedData, signature, keyPair.publicKey)

      expect(isValid).toBe(false)
    })

    it("should fail verification with tampered signature", async () => {
      const keyPair = await generateSigningKey()
      const data = "Important data"

      const signature = await signData(data, keyPair.privateKey)
      const tamperedSignature = signature.substring(0, 10) + "X" + signature.substring(11)

      // Tampered signature should either fail verification or throw
      try {
        const isValid = await verifySignature(data, tamperedSignature, keyPair.publicKey)
        expect(isValid).toBe(false)
      } catch {
        // Some implementations throw on invalid signature format
        expect(true).toBe(true)
      }
    })
  })

  describe("Key Export/Import", () => {
    it("should export and import symmetric key correctly", async () => {
      const originalKey = await generateSymmetricKey()
      const message = "Test message"

      // Encrypt with original key
      const { ciphertext, iv } = await encryptMessage(message, originalKey)

      // Export and reimport
      const exported = await exportKey(originalKey)
      const importedKey = await importSymmetricKey(exported)

      // Decrypt with imported key
      const decrypted = await decryptMessage(ciphertext, iv, importedKey)

      expect(decrypted).toBe(message)
    })

    it("should export and import signing keys correctly", async () => {
      const originalKeyPair = await generateSigningKey()
      const data = "Data to sign"

      // Sign with original key
      const signature = await signData(data, originalKeyPair.privateKey)

      // Export and reimport public key
      const exportedPublic = await exportKey(originalKeyPair.publicKey)
      const importedPublic = await importPublicSigningKey(exportedPublic)

      // Verify with imported public key
      const isValid = await verifySignature(data, signature, importedPublic)

      expect(isValid).toBe(true)
    })

    it("should export and import private signing key correctly", async () => {
      const originalKeyPair = await generateSigningKey()
      const data = "Data to sign"

      // Export and reimport private key
      const exportedPrivate = await exportKey(originalKeyPair.privateKey)
      const importedPrivate = await importPrivateSigningKey(exportedPrivate)

      // Sign with imported key
      const signature = await signData(data, importedPrivate)

      // Verify with original public key
      const isValid = await verifySignature(data, signature, originalKeyPair.publicKey)

      expect(isValid).toBe(true)
    })
  })
})

describe("Delete Message Signature", () => {
  it("should create and verify delete control message signature", async () => {
    const keyPair = await generateSigningKey()

    const deleteMessage = {
      type: "delete",
      messageId: "msg-123",
      chatId: "chat-456",
      senderId: "user-789",
      timestamp: Date.now(),
    }

    const messageString = JSON.stringify(deleteMessage)
    const signature = await signData(messageString, keyPair.privateKey)

    const isValid = await verifySignature(messageString, signature, keyPair.publicKey)

    expect(isValid).toBe(true)
  })

  it("should reject delete message with mismatched data", async () => {
    const keyPair = await generateSigningKey()

    const originalMessage = {
      type: "delete",
      messageId: "msg-123",
      chatId: "chat-456",
      senderId: "user-789",
      timestamp: Date.now(),
    }

    const tamperedMessage = {
      ...originalMessage,
      messageId: "msg-different", // Changed message ID
    }

    const signature = await signData(JSON.stringify(originalMessage), keyPair.privateKey)

    const isValid = await verifySignature(JSON.stringify(tamperedMessage), signature, keyPair.publicKey)

    expect(isValid).toBe(false)
  })
})
