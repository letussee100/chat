// Standalone crypto utilities for testing
// This mirrors the hook but works outside React context

const DB_NAME = "secure-chat-keys"
const STORE_NAME = "keys"

export interface KeyPair {
  publicKey: JsonWebKey
  privateKey: JsonWebKey
}

export interface StoredKeys {
  encryptionKey: KeyPair
  signingKey: KeyPair
  exportedAt: number
}

// Generate AES-GCM key for message encryption
export async function generateEncryptionKey(): Promise<CryptoKeyPair> {
  // For asymmetric encryption, we use RSA-OAEP
  return await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  )
}

// Generate ECDSA key pair for signing
export async function generateSigningKey(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"],
  )
}

// Generate symmetric AES-GCM key for message encryption
export async function generateSymmetricKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"],
  )
}

// Encrypt message with AES-GCM
export async function encryptMessage(message: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data)

  return {
    ciphertext: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv),
  }
}

// Decrypt message with AES-GCM
export async function decryptMessage(ciphertext: string, iv: string, key: CryptoKey): Promise<string> {
  const decoder = new TextDecoder()
  const encryptedData = base64ToArrayBuffer(ciphertext)
  const ivBuffer = base64ToArrayBuffer(iv)

  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBuffer }, key, encryptedData)

  return decoder.decode(decrypted)
}

// Sign data with ECDSA
export async function signData(data: string, privateKey: CryptoKey): Promise<string> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)

  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, dataBuffer)

  return arrayBufferToBase64(signature)
}

// Verify signature with ECDSA
export async function verifySignature(data: string, signature: string, publicKey: CryptoKey): Promise<boolean> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const signatureBuffer = base64ToArrayBuffer(signature)

  return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, signatureBuffer, dataBuffer)
}

// Export key to JWK format
export async function exportKey(key: CryptoKey): Promise<JsonWebKey> {
  return await crypto.subtle.exportKey("jwk", key)
}

// Import public key from JWK
export async function importPublicSigningKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"])
}

// Import private key from JWK
export async function importPrivateSigningKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"])
}

// Import symmetric key from JWK
export async function importSymmetricKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await crypto.subtle.importKey("jwk", jwk, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])
}

// Utility functions
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

// Generate a random chat key and encrypt it for a recipient
export async function generateAndEncryptChatKey(
  recipientPublicKey: CryptoKey,
): Promise<{ encryptedKey: string; rawKey: CryptoKey }> {
  const chatKey = await generateSymmetricKey()
  const exportedKey = await exportKey(chatKey)
  const keyString = JSON.stringify(exportedKey)

  const encoder = new TextEncoder()
  const keyData = encoder.encode(keyString)

  const encrypted = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, recipientPublicKey, keyData)

  return {
    encryptedKey: arrayBufferToBase64(encrypted),
    rawKey: chatKey,
  }
}

// Decrypt a chat key using private key
export async function decryptChatKey(encryptedKey: string, privateKey: CryptoKey): Promise<CryptoKey> {
  const encryptedData = base64ToArrayBuffer(encryptedKey)

  const decrypted = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, encryptedData)

  const decoder = new TextDecoder()
  const keyString = decoder.decode(decrypted)
  const jwk = JSON.parse(keyString)

  return await importSymmetricKey(jwk)
}
