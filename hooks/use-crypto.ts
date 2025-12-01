"use client"

import { useCallback, useEffect, useState } from "react"

// IndexedDB Database Name
const DB_NAME = "SecureChatKeys"
const STORE_NAME = "cryptoKeys"
const DB_VERSION = 1

interface StoredKeyPair {
  id: string
  encryptionKey: CryptoKey
  signingKeyPair: {
    publicKey: CryptoKey
    privateKey: CryptoKey
  }
  exportedPublicKey: string // Base64 for server storage
}

// Open IndexedDB
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }
  })
}

// AES-GCM Encryption
export async function encryptMessage(plaintext: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plaintext)
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data)

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  }
}

// AES-GCM Decryption
export async function decryptMessage(ciphertext: string, iv: string, key: CryptoKey): Promise<string> {
  const encryptedData = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))
  const ivData = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0))

  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivData }, key, encryptedData)

  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}

// Sign data with ECDSA
export async function signData(data: string, privateKey: CryptoKey): Promise<string> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)

  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, dataBuffer)

  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

// Verify signature with ECDSA
export async function verifySignature(data: string, signature: string, publicKey: CryptoKey): Promise<boolean> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const signatureBuffer = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0))

  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, signatureBuffer, dataBuffer)
}

// Import public key from base64
export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const keyData = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0))

  return crypto.subtle.importKey("spki", keyData, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"])
}

export function useCrypto() {
  const [isReady, setIsReady] = useState(false)
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null)
  const [signingKeyPair, setSigningKeyPair] = useState<{
    publicKey: CryptoKey
    privateKey: CryptoKey
  } | null>(null)
  const [publicKeyExport, setPublicKeyExport] = useState<string | null>(null)

  // Generate new encryption key (AES-GCM)
  const generateEncryptionKey = useCallback(async (): Promise<CryptoKey> => {
    return crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true, // extractable for export/import
      ["encrypt", "decrypt"],
    )
  }, [])

  // Generate signing key pair (ECDSA)
  const generateSigningKeyPair = useCallback(async (): Promise<CryptoKeyPair> => {
    return crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])
  }, [])

  // Export encryption key to base64
  const exportKey = useCallback(async (key: CryptoKey): Promise<string> => {
    const exported = await crypto.subtle.exportKey("raw", key)
    return btoa(String.fromCharCode(...new Uint8Array(exported)))
  }, [])

  // Import encryption key from base64
  const importKey = useCallback(async (base64Key: string): Promise<CryptoKey> => {
    const keyData = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0))
    return crypto.subtle.importKey("raw", keyData, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])
  }, [])

  // Save keys to IndexedDB
  const saveKeys = useCallback(
    async (encKey: CryptoKey, signKeys: { publicKey: CryptoKey; privateKey: CryptoKey }, exportedPubKey: string) => {
      const db = await openDatabase()
      const transaction = db.transaction(STORE_NAME, "readwrite")
      const store = transaction.objectStore(STORE_NAME)

      await new Promise<void>((resolve, reject) => {
        const request = store.put({
          id: "primary",
          encryptionKey: encKey,
          signingKeyPair: signKeys,
          exportedPublicKey: exportedPubKey,
        })
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    },
    [],
  )

  // Load keys from IndexedDB
  const loadKeys = useCallback(async (): Promise<StoredKeyPair | null> => {
    const db = await openDatabase()
    const transaction = db.transaction(STORE_NAME, "readonly")
    const store = transaction.objectStore(STORE_NAME)

    return new Promise((resolve, reject) => {
      const request = store.get("primary")
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }, [])

  // Initialize or generate keys
  const initializeKeys = useCallback(async () => {
    try {
      // Try to load existing keys
      const stored = await loadKeys()

      if (stored) {
        setEncryptionKey(stored.encryptionKey)
        setSigningKeyPair(stored.signingKeyPair)
        setPublicKeyExport(stored.exportedPublicKey)
        setIsReady(true)
        return stored.exportedPublicKey
      }

      // Generate new keys
      const newEncKey = await generateEncryptionKey()
      const newSignKeys = await generateSigningKeyPair()

      // Export public key for server
      const pubKeyExport = await crypto.subtle.exportKey("spki", newSignKeys.publicKey)
      const exportedPubKey = btoa(String.fromCharCode(...new Uint8Array(pubKeyExport)))

      // Save to IndexedDB
      await saveKeys(
        newEncKey,
        { publicKey: newSignKeys.publicKey, privateKey: newSignKeys.privateKey },
        exportedPubKey,
      )

      setEncryptionKey(newEncKey)
      setSigningKeyPair({
        publicKey: newSignKeys.publicKey,
        privateKey: newSignKeys.privateKey,
      })
      setPublicKeyExport(exportedPubKey)
      setIsReady(true)

      return exportedPubKey
    } catch (error) {
      console.error("Failed to initialize crypto keys:", error)
      setIsReady(false)
      return null
    }
  }, [loadKeys, generateEncryptionKey, generateSigningKeyPair, saveKeys])

  // Clear all keys (for logout)
  const clearKeys = useCallback(async () => {
    const db = await openDatabase()
    const transaction = db.transaction(STORE_NAME, "readwrite")
    const store = transaction.objectStore(STORE_NAME)

    await new Promise<void>((resolve, reject) => {
      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    setEncryptionKey(null)
    setSigningKeyPair(null)
    setPublicKeyExport(null)
    setIsReady(false)
  }, [])

  // Auto-initialize on mount
  useEffect(() => {
    initializeKeys()
  }, [initializeKeys])

  return {
    isReady,
    encryptionKey,
    signingKeyPair,
    publicKeyExport,
    encryptMessage: encryptionKey ? (plaintext: string) => encryptMessage(plaintext, encryptionKey) : null,
    decryptMessage: encryptionKey
      ? (ciphertext: string, iv: string) => decryptMessage(ciphertext, iv, encryptionKey)
      : null,
    signData: signingKeyPair ? (data: string) => signData(data, signingKeyPair.privateKey) : null,
    verifySignature,
    importPublicKey,
    exportKey,
    importKey,
    initializeKeys,
    clearKeys,
  }
}
