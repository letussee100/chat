"use client"

import { useCallback, useRef, useState } from "react"

interface RTCConfig {
  iceServers: RTCIceServer[]
}

interface SignalMessage {
  type: "offer" | "answer" | "ice-candidate"
  payload: string
  fromUserId: string
  toUserId: string
  chatId: string
}

export function useWebRTC(chatId: string, userId: string, authToken: string) {
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new")
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isCallActive, setIsCallActive] = useState(false)

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Get TURN/STUN configuration from environment
  const getIceServers = useCallback((): RTCIceServer[] => {
    const servers: RTCIceServer[] = []

    // STUN server (public or custom)
    const stunUrl = process.env.NEXT_PUBLIC_STUN_URL || "stun:stun.l.google.com:19302"
    servers.push({ urls: stunUrl })

    // TURN server (required for NAT traversal)
    const turnUrl = process.env.NEXT_PUBLIC_TURN_URL
    const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME
    const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL

    if (turnUrl && turnUsername && turnCredential) {
      servers.push({
        urls: turnUrl,
        username: turnUsername,
        credential: turnCredential,
      })
    }

    return servers
  }, [])

  // Send signal to server
  const sendSignal = useCallback(
    async (signal: Omit<SignalMessage, "fromUserId">) => {
      await fetch("/api/signal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          ...signal,
          fromUserId: userId,
        }),
      })
    },
    [authToken, userId],
  )

  // Poll for signals from server
  const pollSignals = useCallback(async (): Promise<SignalMessage[]> => {
    try {
      const response = await fetch(`/api/signal?chatId=${chatId}&userId=${userId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })
      if (!response.ok) return []
      const data = await response.json()
      return data.signals || []
    } catch {
      return []
    }
  }, [chatId, userId, authToken])

  // Create peer connection
  const createPeerConnection = useCallback(
    (targetUserId: string): RTCPeerConnection => {
      const config: RTCConfig = {
        iceServers: getIceServers(),
      }

      const pc = new RTCPeerConnection(config)

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({
            type: "ice-candidate",
            payload: JSON.stringify(event.candidate),
            toUserId: targetUserId,
            chatId,
          })
        }
      }

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0])
      }

      pc.onconnectionstatechange = () => {
        setConnectionState(pc.connectionState)
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          endCall()
        }
      }

      return pc
    },
    [chatId, getIceServers, sendSignal],
  )

  // Start outgoing call
  const startCall = useCallback(
    async (targetUserId: string) => {
      try {
        // Get local media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        setLocalStream(stream)

        // Create peer connection
        const pc = createPeerConnection(targetUserId)
        peerConnectionRef.current = pc

        // Add local tracks
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream)
        })

        // Create and send offer
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        await sendSignal({
          type: "offer",
          payload: JSON.stringify(offer),
          toUserId: targetUserId,
          chatId,
        })

        setIsCallActive(true)

        // Start polling for answer and ICE candidates
        startSignalPolling(targetUserId)
      } catch (error) {
        console.error("Failed to start call:", error)
        throw error
      }
    },
    [chatId, createPeerConnection, sendSignal],
  )

  // Handle incoming offer
  const handleOffer = useCallback(
    async (offer: RTCSessionDescriptionInit, fromUserId: string) => {
      try {
        // Get local media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        setLocalStream(stream)

        // Create peer connection
        const pc = createPeerConnection(fromUserId)
        peerConnectionRef.current = pc

        // Add local tracks
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream)
        })

        // Set remote description and create answer
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        await sendSignal({
          type: "answer",
          payload: JSON.stringify(answer),
          toUserId: fromUserId,
          chatId,
        })

        setIsCallActive(true)
        startSignalPolling(fromUserId)
      } catch (error) {
        console.error("Failed to handle offer:", error)
        throw error
      }
    },
    [chatId, createPeerConnection, sendSignal],
  )

  // Handle incoming answer
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current
    if (!pc) return

    await pc.setRemoteDescription(new RTCSessionDescription(answer))
  }, [])

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current
    if (!pc) return

    await pc.addIceCandidate(new RTCIceCandidate(candidate))
  }, [])

  // Start polling for signals
  const startSignalPolling = useCallback(
    (targetUserId: string) => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }

      pollIntervalRef.current = setInterval(async () => {
        const signals = await pollSignals()

        for (const signal of signals) {
          if (signal.fromUserId !== targetUserId) continue

          switch (signal.type) {
            case "answer":
              await handleAnswer(JSON.parse(signal.payload))
              break
            case "ice-candidate":
              await handleIceCandidate(JSON.parse(signal.payload))
              break
          }
        }
      }, 1000) // Poll every second
    },
    [pollSignals, handleAnswer, handleIceCandidate],
  )

  // End call
  const endCall = useCallback(() => {
    // Stop polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
      setLocalStream(null)
    }

    setRemoteStream(null)
    setIsCallActive(false)
    setConnectionState("new")
  }, [localStream])

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        return audioTrack.enabled
      }
    }
    return false
  }, [localStream])

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        return videoTrack.enabled
      }
    }
    return false
  }, [localStream])

  return {
    connectionState,
    localStream,
    remoteStream,
    isCallActive,
    startCall,
    handleOffer,
    endCall,
    toggleAudio,
    toggleVideo,
    pollSignals,
  }
}
