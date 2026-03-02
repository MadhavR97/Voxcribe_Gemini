"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import Header from "@/app/components/header"
import { getAudioFile } from "@/app/utils/audioStorage"
import { supabase } from "@/lib/supabaseClient"

type Word = {
  text: string
  time: string
}

type WordWithTiming = {
  text: string
  start: number
  end: number
}

type Sentence = {
  speaker: string
  words: Word[]
}

type SentenceWithTiming = {
  speaker: string
  words: WordWithTiming[]
}

type StoredFile = {
  id: string
  name: string
  transcript?: string
  createdAt: string
}

export default function FilePage() {
  // 🔌 Backend will inject these later
  const [audioName, setAudioName] = useState<string>("")
  const [sentences, setSentences] = useState<Sentence[]>([])
  const [recentFiles, setRecentFiles] = useState<{ id: string; name: string }[]>([])
  const [mounted, setMounted] = useState(false)

  const [currentTime, setCurrentTime] = useState<number>(0)
  const [totalTime, setTotalTime] = useState<number>(0)
  const [volume, setVolume] = useState<number>(0.8)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [audioUrl, setAudioUrl] = useState<string>("")
  const [username, setUsername] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const activeWordRef = useRef<HTMLSpanElement | null>(null)
  const { id } = useParams()
  const router = useRouter()

  // Set mounted state to handle client-side only rendering
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace("/auth/login")
  }

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser()

      if (data?.user) {
        const username = data.user.user_metadata?.username
        setUsername(username ? username : "User")
      } else {
        setUsername("User")
      }
    }

    loadUser()
  }, [])

  // Word-level timings: distribute duration by character length for better sync with speech
  const sentencesWithTiming = useMemo((): SentenceWithTiming[] => {
    if (sentences.length === 0 || totalTime <= 0) return []
    const allWords = sentences.flatMap((s) => s.words)
    if (allWords.length === 0) return []
    const totalChars = allWords.reduce((acc, w) => acc + Math.max(1, w.text.length), 0)
    let t = 0
    let wi = 0
    return sentences.map((s) => ({
      speaker: s.speaker,
      words: s.words.map((w) => {
        const duration = (Math.max(1, w.text.length) / totalChars) * totalTime
        const start = t
        t += duration
        wi += 1
        const end = wi === allWords.length ? totalTime : t
        return { text: w.text, start, end }
      }),
    }))
  }, [sentences, totalTime])

  // Which word is currently being spoken (for highlight)
  const activeWord = useMemo((): { sentenceIndex: number; wordIndex: number } | null => {
    if (sentencesWithTiming.length === 0) return null
    for (let si = 0; si < sentencesWithTiming.length; si++) {
      const sent = sentencesWithTiming[si]
      for (let wi = 0; wi < sent.words.length; wi++) {
        const w = sent.words[wi]
        if (currentTime >= w.start && currentTime < w.end) return { sentenceIndex: si, wordIndex: wi }
      }
    }
    // At or past end: keep last word highlighted
    const last = sentencesWithTiming[sentencesWithTiming.length - 1]
    if (last.words.length > 0 && currentTime >= last.words[last.words.length - 1].start) {
      return { sentenceIndex: sentencesWithTiming.length - 1, wordIndex: last.words.length - 1 }
    }
    return null
  }, [sentencesWithTiming, currentTime])

  // Auto-scroll transcript so the active word stays in view
  useEffect(() => {
    if (activeWord) {
      activeWordRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [activeWord])

  useEffect(() => {
    const loadFile = async () => {
      if (!id) return

      try {
        // 1. Fetch file metadata from Supabase
        const { data: fileData, error } = await supabase
          .from('files')
          .select('*')
          .eq('id', id)
          .single()

        if (error || !fileData) {
          console.error("File not found in database:", error)
          // Fallback to localStorage if not found in DB (migration support)
          const stored = JSON.parse(localStorage.getItem("voxscribe_files") || "[]")
          const current = stored.find((f: any) => f.id === id)
          if (current) {
            setAudioName(current.name)
            processTranscript(current.transcript)
          }
          return
        }

        setAudioName(fileData.name)
        processTranscript(fileData.transcript)

        // 2. Fetch binary from IndexedDB (local cache)
        // Note: In a full production app, you'd fetch from Supabase Storage here
        const audioFile = await getAudioFile(fileData.id)
        if (audioFile) {
          setAudioUrl(URL.createObjectURL(audioFile))
        }

        // 3. Load recent files for sidebar
        const { data: recentData } = await supabase
          .from('files')
          .select('id, name')
          .order('created_at', { ascending: false })
          .limit(5)
        
        if (recentData) {
          setRecentFiles(recentData)
        }

      } catch (err) {
        console.error("Error loading file:", err)
      }
    }

    const processTranscript = (transcriptText: string) => {
      if (!transcriptText) return

      const temp: Sentence[] = []
      
      // Updated regex to better handle "Speaker X:" or "Person X:" labels
      // This splits the text by speaker labels while keeping the delimiter
      const parts = transcriptText.split(/(Speaker \d+:|Person \d+:)/i)
      
      let currentSpeaker = "Speaker 1"
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim()
        if (!part) continue
        
        const speakerMatch = part.match(/^(Speaker \d+|Person \d+):$/i)
        
        if (speakerMatch) {
          currentSpeaker = speakerMatch[1]
        } else {
          // It's content
          const words = part
            .split(/\s+/)
            .filter(Boolean)
            .map((w: string) => ({ text: w, time: "" }))
            
          temp.push({
            speaker: currentSpeaker,
            words
          })
        }
      }
      
      // If regex didn't match standard format, fallback to simple text
      if (temp.length === 0 && transcriptText.trim()) {
         temp.push({
           speaker: "Speaker 1",
           words: transcriptText.split(/\s+/).filter(Boolean).map(w => ({ text: w, time: "" }))
         })
      }

      setSentences(temp)
    }

    loadFile()
  }, [id])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setTotalTime(audio.duration)
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener("timeupdate", updateTime)
    audio.addEventListener("loadedmetadata", updateDuration)
    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)
    audio.addEventListener("ended", handleEnded)

    return () => {
      audio.removeEventListener("timeupdate", updateTime)
      audio.removeEventListener("loadedmetadata", updateDuration)
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
      audio.removeEventListener("ended", handleEnded)
    }
  }, [audioUrl])

  // Update volume when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  // Play/Pause handler
  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
  }

  // Format time helper
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)

    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  // Progress % for audio bar
  const progressPercent =
    totalTime > 0 ? (currentTime / totalTime) * 100 : 0

  // --- Export helpers ---
  const getBaseFilename = () =>
    (audioName || "transcript").replace(/\.[^/.]+$/, "") || "transcript"

  const getTranscriptText = () =>
    sentences
      .map((s) => `${s.speaker}: ${s.words.map((w) => w.text).join(" ")}`)
      .join("\n\n")
      .trim()

  const secondsToSrtTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    const ms = Math.round((seconds % 1) * 1000)
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`
  }

  const getSrtContent = () => {
    const hasTiming = totalTime > 0 && sentencesWithTiming.length > 0
    if (hasTiming) {
      return sentencesWithTiming
        .map((sent, i) => {
          const words = (sent as SentenceWithTiming).words
          if (words.length === 0) return ""
          const start = words[0].start
          const end = words[words.length - 1].end
          const text = words.map((w) => w.text).join(" ")
          return `${i + 1}\n${secondsToSrtTime(start)} --> ${secondsToSrtTime(end)}\n${sent.speaker}: ${text}\n`
        })
        .filter(Boolean)
        .join("\n")
    }
    // No timing: use sequential placeholders
    return sentences
      .map((sent, i) => {
        const text = sent.words.map((w) => w.text).join(" ")
        if (!text) return ""
        const start = i
        const end = i + 1
        return `${i + 1}\n${secondsToSrtTime(start)} --> ${secondsToSrtTime(end)}\n${sent.speaker}: ${text}\n`
      })
      .filter(Boolean)
      .join("\n")
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadTxt = () => {
    const text = getTranscriptText() || "(No transcript)"
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
    downloadBlob(blob, `${getBaseFilename()}.txt`)
  }

  const downloadSrt = () => {
    const srt = getSrtContent() || "1\n00:00:00,000 --> 00:00:01,000\n(No transcript)\n"
    const blob = new Blob([srt], { type: "text/plain;charset=utf-8" })
    downloadBlob(blob, `${getBaseFilename()}.srt`)
  }

  const downloadPdf = async () => {
    const text = getTranscriptText()

    if (!text || text.trim().length === 0) {
      alert("Transcript is empty. Generate transcription first.")
      return
    }

    try {
      const res = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          filename: getBaseFilename(),
        }),
      })

      if (!res.ok) throw new Error("PDF export failed")

      const blob = await res.blob()
      downloadBlob(blob, `${getBaseFilename()}.pdf`)
    } catch (e) {
      console.error("PDF export failed:", e)
    }
  }

  const downloadDocx = async () => {
    try {
      const res = await fetch("/api/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: getTranscriptText(),
          filename: getBaseFilename(),
        }),
      })
      if (!res.ok) throw new Error("DOCX export failed")
      const blob = await res.blob()
      downloadBlob(blob, `${getBaseFilename()}.docx`)
    } catch (e) {
      console.error("DOCX export failed:", e)
    }
  }

  // Format date consistently for both server and client
  const formatDate = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  // Don't render dynamic content until after mount to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="relative min-h-screen w-full bg-gradient-to-br from-black via-zinc-900 to-black overflow-hidden pb-32 md:pb-24">
        <Header userName={null} onLogout={() => {}} />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 min-w-0">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl p-5 sm:p-7 mb-6">
                <div className="h-8 bg-white/10 rounded animate-pulse mb-2"></div>
                <div className="h-4 bg-white/5 rounded w-32 animate-pulse"></div>
              </div>
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl p-5 sm:p-7 min-h-[260px]">
                <div className="space-y-4">
                  <div className="h-4 bg-white/10 rounded w-24 animate-pulse"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-white/5 rounded animate-pulse"></div>
                    <div className="h-4 bg-white/5 rounded animate-pulse"></div>
                    <div className="h-4 bg-white/5 rounded w-3/4 animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-br from-black via-zinc-900 to-black overflow-hidden pb-32 md:pb-24">
      {/* Background blobs */}
      <motion.div
        className="absolute -top-32 -left-32 w-96 h-96 bg-red-600/30 rounded-full blur-3xl"
        animate={{ x: [0, 60, -40, 0], y: [0, 40, -60, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-32 -right-32 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl"
        animate={{ x: [0, -50, 30, 0], y: [0, -40, 50, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Header */}
      <Header
        userName={username}
        onLogout={handleLogout}
      />

      {/* Main layout - responsive grid */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        
        {/* Mobile Recent Files - Collapsible Card */}
        <div className="mb-6 md:hidden">
          <details className="group">
            <summary className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl shadow p-4 cursor-pointer list-none flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-red-500 text-lg">📁</span>
                <h3 className="text-sm font-semibold text-white">Recent Files</h3>
                {recentFiles.length > 0 && (
                  <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full">
                    {recentFiles.length}
                  </span>
                )}
              </div>
              <span className="text-white/60 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            
            <div className="mt-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl shadow p-3">
              {recentFiles.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-4">No recent files</p>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {recentFiles.map((file, i) => (
                    <button
                      key={file.id || `recent-${i}`}
                      onClick={() => file.id && router.push(`/file/${file.id}`)}
                      className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/10 text-zinc-300 cursor-pointer transition flex items-center gap-3"
                    >
                      <span className="text-red-400/60 text-lg">🎵</span>
                      <span className="flex-1 truncate text-sm">{file.name}</span>
                      <span className="text-xs text-zinc-500">→</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </details>
        </div>

        {/* Main content grid - responsive layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* LEFT: Recent Files (hidden on mobile, visible on md+) */}
          <div className="hidden md:block lg:w-72 shrink-0">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl shadow p-5 sticky top-24">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-red-500 text-xl">📁</span>
                <h3 className="text-base font-semibold text-white">Recent Files</h3>
                {recentFiles.length > 0 && (
                  <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full ml-auto">
                    {recentFiles.length}
                  </span>
                )}
              </div>

              {recentFiles.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-6">
                  No recent files
                </p>
              ) : (
                <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
                  {recentFiles.map((file, i) => (
                    <button
                      key={file.id || `recent-${i}`}
                      onClick={() => file.id && router.push(`/file/${file.id}`)}
                      className={`w-full text-left px-4 py-3 rounded-xl transition flex items-center gap-3 ${
                        file.id === id 
                          ? 'bg-red-500/20 text-red-400 border-l-2 border-red-500' 
                          : 'hover:bg-white/10 text-zinc-300'
                      }`}
                      title={file.name}
                    >
                      <span className="text-red-400/60 text-lg shrink-0">🎵</span>
                      <span className="flex-1 truncate text-sm">{file.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* MIDDLE: Transcript - takes full width on mobile, flexible on desktop */}
          <div className="flex-1 min-w-0">
            {/* File info */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl p-5 sm:p-7 mb-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-red-500 text-2xl">🎧</span>
                <h1 className="text-lg sm:text-2xl font-semibold text-white truncate">
                  {audioName || "No file selected"}
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 pl-11">
                Uploaded • {formatDate(new Date())}
              </p>
            </div>

            {/* Transcript display with audio-synced highlighting */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl p-5 sm:p-7 min-h-[260px] max-h-[60vh] overflow-y-auto">
              {sentences.length === 0 ? (
                <div className="text-center text-zinc-400 py-12">
                  <p className="text-4xl mb-4">📝</p>
                  <p className="text-lg mb-2">No transcript yet</p>
                  <p className="text-xs sm:text-sm text-zinc-500">
                    Transcript will appear here once generated
                  </p>
                </div>
              ) : (
                (() => {
                  const useTiming = totalTime > 0 && sentencesWithTiming.length > 0
                  const list = useTiming ? sentencesWithTiming : sentences
                  return (
                    <div className="space-y-5">
                      {list.map((sentence, si) => (
                        <div key={si} className="rounded-lg p-3 sm:p-4 hover:bg-white/5 transition border-b border-white/5 pb-5 sm:pb-6">
                          <div className="flex items-center gap-2 mb-2 sm:mb-3">
                            <span className="text-red-500 text-xs sm:text-sm">●</span>
                            <div className="text-xs sm:text-sm text-red-500 font-bold uppercase tracking-widest">
                              {sentence.speaker}
                            </div>
                          </div>
                          <div className="text-white leading-relaxed break-words overflow-wrap-anywhere text-sm sm:text-base pl-4">
                            {useTiming
                              ? (sentence as SentenceWithTiming).words.map((word, wi) => {
                                const isActive = activeWord?.sentenceIndex === si && activeWord?.wordIndex === wi
                                return (
                                  <span
                                    key={wi}
                                    ref={isActive ? activeWordRef : undefined}
                                    onClick={() => {
                                      const a = audioRef.current
                                      if (a) a.currentTime = word.start
                                    }}
                                    className={`mr-1.5 inline-block transition-all cursor-pointer rounded px-0.5 -mx-0.5 ${
                                      isActive 
                                        ? 'bg-red-500/50 text-white scale-105' 
                                        : 'hover:text-red-400 hover:bg-white/10'
                                    }`}
                                    title={`${word.start.toFixed(1)}s – ${word.end.toFixed(1)}s`}
                                  >
                                    {word.text}
                                  </span>
                                )
                              })
                              : (sentence as Sentence).words.map((word, wi) => (
                                <span 
                                  key={wi} 
                                  className="mr-1.5 hover:text-red-400 hover:bg-white/10 transition inline-block rounded px-0.5" 
                                  title={word.time || undefined}
                                >
                                  {word.text}
                                </span>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()
              )}
            </div>
          </div>

          {/* RIGHT: Export - Desktop version */}
          <div className="hidden lg:block lg:w-72 shrink-0">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl shadow p-5 sticky top-24">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-red-500 text-xl">📤</span>
                <h3 className="text-base font-semibold text-white">Export</h3>
              </div>

              <div className="space-y-2">
                <button
                  onClick={downloadPdf}
                  className="w-full px-4 py-3 rounded-xl hover:bg-white/10 text-zinc-300 text-left cursor-pointer transition flex items-center gap-3 group"
                >
                  <span className="text-red-400/60 text-lg group-hover:scale-110 transition">📄</span>
                  <span className="flex-1">PDF Document</span>
                  <span className="text-xs text-zinc-500">↓</span>
                </button>
                <button
                  onClick={downloadDocx}
                  className="w-full px-4 py-3 rounded-xl hover:bg-white/10 text-zinc-300 text-left cursor-pointer transition flex items-center gap-3 group"
                >
                  <span className="text-red-400/60 text-lg group-hover:scale-110 transition">📝</span>
                  <span className="flex-1">Word Document</span>
                  <span className="text-xs text-zinc-500">↓</span>
                </button>
                <button
                  onClick={downloadTxt}
                  className="w-full px-4 py-3 rounded-xl hover:bg-white/10 text-zinc-300 text-left cursor-pointer transition flex items-center gap-3 group"
                >
                  <span className="text-red-400/60 text-lg group-hover:scale-110 transition">📃</span>
                  <span className="flex-1">Text File</span>
                  <span className="text-xs text-zinc-500">↓</span>
                </button>
                <button
                  onClick={downloadSrt}
                  className="w-full px-4 py-3 rounded-xl hover:bg-white/10 text-zinc-300 text-left cursor-pointer transition flex items-center gap-3 group"
                >
                  <span className="text-red-400/60 text-lg group-hover:scale-110 transition">🎬</span>
                  <span className="flex-1">Subtitles (SRT)</span>
                  <span className="text-xs text-zinc-500">↓</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Export Buttons - Enhanced Design */}
        <div className="mt-6 lg:hidden">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl shadow p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-red-500 text-xl">📤</span>
              <h3 className="text-base font-semibold text-white">Export Options</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={downloadPdf}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 cursor-pointer transition border border-white/5"
              >
                <span className="text-red-400 text-2xl">📄</span>
                <span className="text-xs font-medium">PDF</span>
              </button>
              <button
                onClick={downloadDocx}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 cursor-pointer transition border border-white/5"
              >
                <span className="text-red-400 text-2xl">📝</span>
                <span className="text-xs font-medium">DOCX</span>
              </button>
              <button
                onClick={downloadTxt}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 cursor-pointer transition border border-white/5"
              >
                <span className="text-red-400 text-2xl">📃</span>
                <span className="text-xs font-medium">TXT</span>
              </button>
              <button
                onClick={downloadSrt}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 cursor-pointer transition border border-white/5"
              >
                <span className="text-red-400 text-2xl">🎬</span>
                <span className="text-xs font-medium">SRT</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
        />
      )}

      {/* Bottom audio bar (responsive) */}
      {audioUrl && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-black/95 backdrop-blur-xl border-t border-white/10 px-4 py-3 shadow-2xl md:left-1/2 md:bottom-6 md:rounded-2xl md:border md:w-[95%] md:max-w-4xl md:-translate-x-1/2">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Play / Pause */}
            <button
              onClick={togglePlayPause}
              className="text-white text-2xl sm:text-3xl hover:scale-110 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0 w-10 h-10 flex items-center justify-center bg-white/5 rounded-full"
              disabled={!audioUrl}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>

            {/* Progress bar - takes remaining space */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <div 
                  className="flex-1 h-2 sm:h-2.5 bg-white/10 rounded-full overflow-hidden cursor-pointer"
                  onClick={(e) => {
                    const audio = audioRef.current
                    if (!audio) return
                    const rect = e.currentTarget.getBoundingClientRect()
                    const percent = (e.clientX - rect.left) / rect.width
                    audio.currentTime = percent * audio.duration
                  }}
                >
                  <div
                    className="h-full bg-gradient-to-r from-red-600 to-pink-600 rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                
                {/* Time - hidden on smallest screens, visible on sm+ */}
                <div className="hidden sm:block text-xs text-zinc-400 whitespace-nowrap font-mono">
                  {formatTime(currentTime)} / {formatTime(totalTime)}
                </div>
              </div>
              
              {/* Time under progress bar for mobile */}
              <div className="sm:hidden text-xs text-zinc-400 mt-1 text-right font-mono">
                {formatTime(currentTime)} / {formatTime(totalTime)}
              </div>
            </div>

            {/* Volume */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <span className="text-sm text-zinc-400">🔊</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-24 accent-red-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}