"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import Header from "@/app/components/header"

type Word = {
  text: string
  time: string
}

type Sentence = {
  speaker: string
  words: Word[]
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
  const [recentFiles, setRecentFiles] = useState<string[]>([])

  const [currentTime, setCurrentTime] = useState<number>(0)
  const [totalTime, setTotalTime] = useState<number>(0)
  const [volume, setVolume] = useState<number>(0.8)

  const { id } = useParams()

  useEffect(() => {
    const stored = JSON.parse(
      localStorage.getItem("voxscribe_files") || "[]"
    )

    // Find current file
    const current = stored.find((f: any) => f.id === id)

    if (current) {
      setAudioName(current.name)

      // Convert plain transcript string → UI sentence format
      if (current.transcript) {
        setSentences([
          {
            speaker: "Speaker 1",
            words: current.transcript.split(" ").map((word: string) => ({
              text: word,
              time: "",
            })),
          },
        ])
      }
    }

    // Populate recent files (left sidebar)
    setRecentFiles(
      stored.slice(0, 5).map((f: any) => f.name)
    )
  }, [id])

  // Progress % for audio bar
  const progressPercent =
    totalTime > 0 ? (currentTime / totalTime) * 100 : 0

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-br from-black via-zinc-900 to-black overflow-hidden">

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
      <Header />

      {/* Main layout */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-10 flex gap-8">

        {/* LEFT: Recent Files */}
        <div className="w-64 shrink-0 hidden md:block">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl shadow p-4">
            <h3 className="text-sm font-semibold text-white mb-3">
              Recent Files
            </h3>

            {recentFiles.length === 0 ? (
              <p className="text-sm text-zinc-400">
                No recent files
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                {recentFiles.map((file, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-zinc-300"
                  >
                    {file}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MIDDLE: Transcript */}
        <div className="flex-1">

          {/* File info */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl p-6 mb-6">
            <h1 className="text-xl font-semibold text-white mb-1">
              {audioName || "No file selected"}
            </h1>
            <p className="text-sm text-zinc-400">
              {/* Backend injects date */}
              —
            </p>
          </div>

          {/* Transcript display (READ-ONLY UI) */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl p-6 min-h-[260px]">
            {sentences.length === 0 ? (
              <div className="text-center text-zinc-400">
                <p className="mb-2">📝 No transcript yet</p>
                <p className="text-sm">
                  Transcript will appear here once generated
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sentences.map((sentence, i) => (
                  <div
                    key={i}
                    className="rounded-lg p-3 hover:bg-white/5 transition"
                  >
                    {/* Speaker */}
                    <div className="text-xs text-red-400 font-semibold mb-1">
                      {sentence.speaker}
                    </div>

                    {/* Words */}
                    <div className="text-white leading-relaxed break-words overflow-wrap-anywhere">
                      {sentence.words.map((word, j) => (
                        <span
                          key={j}
                          className="mr-1 hover:text-red-400 transition inline-block"
                          title={word.time}
                        >
                          {word.text}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Export */}
        <div className="w-72 shrink-0 hidden lg:block">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl shadow p-4">
            <h3 className="text-sm font-semibold text-white mb-3">
              Export
            </h3>

            <div className="space-y-2 text-sm">
              <button className="w-full px-3 py-2 rounded-lg hover:bg-white/10 text-zinc-300">
                📄 Download PDF
              </button>
              <button className="w-full px-3 py-2 rounded-lg hover:bg-white/10 text-zinc-300">
                📝 Download DOCX
              </button>
              <button className="w-full px-3 py-2 rounded-lg hover:bg-white/10 text-zinc-300">
                📃 Download TXT
              </button>
              <button className="w-full px-3 py-2 rounded-lg hover:bg-white/10 text-zinc-300">
                🎬 Download SRT
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom audio bar (centered + volume) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-3xl bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-3 shadow-2xl flex items-center gap-4">

        {/* Play / Pause */}
        <button className="text-white text-xl hover:scale-105 transition">
          ▶
        </button>

        {/* Progress bar */}
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-red-600 to-pink-600 rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Time */}
        <div className="text-xs text-zinc-400 whitespace-nowrap">
          {currentTime || 0} / {totalTime || 0}
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">🔊</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-24 accent-red-300 cursor-pointer"
          />
        </div>

      </div>
    </div>
  )
}