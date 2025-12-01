"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2 } from "lucide-react"

interface VideoCallProps {
  chatId: string
  currentUserId: string
  targetUserId: string
  targetUserName: string
  onClose: () => void
}

export function VideoCall({ chatId, currentUserId, targetUserId, targetUserName, onClose }: VideoCallProps) {
  const [isConnecting, setIsConnecting] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new")

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const getIceServers = useCallback((): RTCIceServer[] => {
    const servers: RTCIceServer[] = [{ urls: process.env.NEXT_PUBLIC_STUN_URL || "stun:stun.l.google.com:19302" }]

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

  const sendSignal = useCallback(
    async (type: string, payload: string) => {
      await fetch("/api/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          payload,
          toUserId: targetUserId,
          chatId,
        }),
      })
    },
    [chatId, targetUserId],
  )

  const pollSignals = useCallback(async () => {
    try {
      const response = await fetch(`/api/signal?chatId=${chatId}&userId=${currentUserId}`)
      if (!response.ok) return []
      const data = await response.json()
      return data.signals || []
    } catch {
      return []
    }
  }, [chatId, currentUserId])

  const startCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      localStreamRef.current = stream

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      const pc = new RTCPeerConnection({ iceServers: getIceServers() })
      peerConnectionRef.current = pc

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream)
      })

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal("ice-candidate", JSON.stringify(event.candidate))
        }
      }

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0]
        }
      }

      pc.onconnectionstatechange = () => {
        setConnectionState(pc.connectionState)
        if (pc.connectionState === "connected") {
          setIsConnecting(false)
        }
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          onClose()
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await sendSignal("offer", JSON.stringify(offer))

      // Start polling for signals
      pollIntervalRef.current = setInterval(async () => {
        const signals = await pollSignals()
        for (const signal of signals) {
          if (signal.type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(signal.payload)))
          } else if (signal.type === "ice-candidate") {
            await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(signal.payload)))
          }
        }
      }, 1000)
    } catch (error) {
      console.error("Failed to start call:", error)
      onClose()
    }
  }, [getIceServers, sendSignal, pollSignals, onClose])

  const handleIncomingCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      localStreamRef.current = stream

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      const pc = new RTCPeerConnection({ iceServers: getIceServers() })
      peerConnectionRef.current = pc

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream)
      })

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal("ice-candidate", JSON.stringify(event.candidate))
        }
      }

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0]
        }
      }

      pc.onconnectionstatechange = () => {
        setConnectionState(pc.connectionState)
        if (pc.connectionState === "connected") {
          setIsConnecting(false)
        }
      }

      // Check for incoming offer
      pollIntervalRef.current = setInterval(async () => {
        const signals = await pollSignals()
        for (const signal of signals) {
          if (signal.type === "offer" && !pc.remoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(signal.payload)))
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            await sendSignal("answer", JSON.stringify(answer))
          } else if (signal.type === "ice-candidate") {
            await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(signal.payload)))
          }
        }
      }, 1000)
    } catch (error) {
      console.error("Failed to handle incoming call:", error)
    }
  }, [getIceServers, sendSignal, pollSignals])

  useEffect(() => {
    startCall()

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [startCall])

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMuted(!audioTrack.enabled)
      }
    }
  }

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoOff(!videoTrack.enabled)
      }
    }
  }

  const endCall = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Remote video (full screen) */}
      <div className="flex-1 relative">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />

        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-lg font-medium">Calling {targetUserName}...</p>
              <p className="text-sm text-muted-foreground mt-1">
                {connectionState === "connecting" ? "Connecting..." : "Waiting for answer..."}
              </p>
            </div>
          </div>
        )}

        {/* Local video (picture-in-picture) */}
        <div className="absolute top-4 right-4 w-32 h-48 md:w-48 md:h-64 bg-muted rounded-lg overflow-hidden shadow-lg">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <Button
          variant={isMuted ? "destructive" : "secondary"}
          size="lg"
          className="rounded-full w-14 h-14"
          onClick={toggleMute}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </Button>

        <Button variant="destructive" size="lg" className="rounded-full w-16 h-16" onClick={endCall}>
          <PhoneOff className="w-7 h-7" />
        </Button>

        <Button
          variant={isVideoOff ? "destructive" : "secondary"}
          size="lg"
          className="rounded-full w-14 h-14"
          onClick={toggleVideo}
        >
          {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
        </Button>
      </div>
    </div>
  )
}
