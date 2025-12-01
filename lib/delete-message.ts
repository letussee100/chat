// Delete for Everyone - Client-side implementation
// This module handles creating signed delete events and verifying them

import { signData, verifySignature, importPublicKey } from "@/hooks/use-crypto"

// Delete control message schema
export interface DeleteControlMessage {
  messageId: string
  chatId: string
  senderId: string
  signature: string
  timestamp: number
}

// Create a signed delete event
export async function createDeleteEvent(
  messageId: string,
  chatId: string,
  senderId: string,
  signingPrivateKey: CryptoKey,
): Promise<DeleteControlMessage> {
  const timestamp = Date.now()

  // Data to sign - includes all identifying information
  const dataToSign = JSON.stringify({
    messageId,
    chatId,
    senderId,
    timestamp,
  })

  // Sign the data with sender's private key
  const signature = await signData(dataToSign, signingPrivateKey)

  return {
    messageId,
    chatId,
    senderId,
    signature,
    timestamp,
  }
}

// Verify a delete event signature
export async function verifyDeleteEvent(
  deleteEvent: DeleteControlMessage,
  senderPublicKeyBase64: string,
): Promise<boolean> {
  try {
    // Import the sender's public key
    const publicKey = await importPublicKey(senderPublicKeyBase64)

    // Reconstruct the data that was signed
    const dataToVerify = JSON.stringify({
      messageId: deleteEvent.messageId,
      chatId: deleteEvent.chatId,
      senderId: deleteEvent.senderId,
      timestamp: deleteEvent.timestamp,
    })

    // Verify the signature
    return await verifySignature(dataToVerify, deleteEvent.signature, publicKey)
  } catch (error) {
    console.error("Delete event verification failed:", error)
    return false
  }
}

// Delete event with sender public key for processing
interface DeleteEventWithKey extends DeleteControlMessage {
  senderPublicKey: string
}

// Process delete events from server
export async function processDeleteEvents(
  deleteEvents: DeleteEventWithKey[],
  localMessageStore: Map<string, unknown>,
  onDelete: (messageId: string) => void,
): Promise<string[]> {
  const deletedIds: string[] = []

  for (const event of deleteEvents) {
    // Skip if no public key available
    if (!event.senderPublicKey) {
      console.warn("No public key for delete event sender:", event.senderId)
      continue
    }

    // Verify the signature
    const isValid = await verifyDeleteEvent(
      {
        messageId: event.messageId,
        chatId: event.chatId,
        senderId: event.senderId,
        signature: event.signature,
        timestamp: event.timestamp,
      },
      event.senderPublicKey,
    )

    if (!isValid) {
      console.warn("Invalid delete signature for message:", event.messageId)
      continue
    }

    // Check if message exists locally
    if (localMessageStore.has(event.messageId)) {
      // Remove from local store
      localMessageStore.delete(event.messageId)
      deletedIds.push(event.messageId)

      // Notify UI to remove message
      onDelete(event.messageId)
    }
  }

  return deletedIds
}

// Send delete acknowledgment to server
export async function acknowledgeDelete(messageId: string, authToken: string): Promise<void> {
  await fetch("/api/delete/ack", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ messageId }),
  })
}

// Request message deletion (sender-initiated)
export async function requestDelete(
  deleteEvent: DeleteControlMessage,
  authToken: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(deleteEvent),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || "Failed to delete message" }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    }
  }
}

// Fetch pending delete events for offline sync
export async function fetchPendingDeletes(
  chatId: string,
  lastSyncTimestamp: number,
  authToken: string,
): Promise<DeleteEventWithKey[]> {
  try {
    const response = await fetch(`/api/delete?chatId=${chatId}&since=${lastSyncTimestamp}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })

    if (!response.ok) {
      return []
    }

    const data = await response.json()
    return data.deleteEvents || []
  } catch {
    return []
  }
}
