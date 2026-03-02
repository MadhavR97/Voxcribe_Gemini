"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Header from "../../components/header"
import { supabase } from "@/lib/supabaseClient"

type VoxFile = {
  id: string
  name: string
  size: number
  duration: number
  language: string
  createdAt: string
  status: "processing" | "completed"
}

export default function DashboardPage() {
  const router = useRouter()

  const [files, setFiles] = useState<VoxFile[]>([])
  const [username, setUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDashboardData = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()

      if (!user || error) {
        router.replace("/auth/login")
        return
      }

      setUsername(
        user.user_metadata?.username ??
        user.email?.split("@")[0] ??
        "User"
      )

      const { data, error: fetchError } = await supabase
        .from("files")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (!fetchError && data) {
        const mapped: VoxFile[] = data.map((f) => ({
          id: f.id,
          name: f.name,
          size: f.size,
          duration: f.duration,
          language: f.language,
          createdAt: f.created_at,
          status: f.status,
        }))

        setFiles(mapped)
      }

      setLoading(false)
    }

    loadDashboardData()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace("/auth/login")
  }

  const clearRecentFiles = async () => {
    if (!confirm("Delete all files?")) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {

      /* ---------------- STORAGE DELETE ---------------- */

      const { data: storageFiles, error: listError } =
        await supabase.storage
          .from("audio-files")
          .list(user.id)

      if (listError) {
        console.error("List error:", listError)
      }

      if (storageFiles && storageFiles.length > 0) {

        const paths = storageFiles.map(
          (file) => `${user.id}/${file.name}`
        )

        const { error: removeError } =
          await supabase.storage
            .from("audio-files")
            .remove(paths)

        if (removeError) {
          console.error("Storage delete error:", removeError)
        }
      }

      /* ---------------- DATABASE DELETE ---------------- */

      const { error: dbError } = await supabase
        .from("files")
        .delete()
        .eq("user_id", user.id)

      if (dbError) {
        console.error("DB delete error:", dbError)
      }

      setFiles([])

    } catch (err) {
      console.error("Unexpected delete error:", err)
    }
  }

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

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

      <Header userName={username ?? "User"} onLogout={handleLogout} />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10 ">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl text-white font-semibold">
              All Recent Files
            </h2>

            {files.length > 0 && (
              <button
                onClick={clearRecentFiles}
                className="text-red-400 hover:text-red-300 transition-colors flex items-center gap-2 text-sm cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {loading ? (
              <div className="text-center py-20 text-zinc-400">
                Loading files...
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-20">

                <div className="text-5xl mb-4">📂</div>

                <h2 className="text-2xl text-white mb-4">
                  Welcome to VoxScribe!
                </h2>

                <button
                  onClick={() => router.push("/transcription")}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Transcribe Your First File
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {files.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => router.push(`/file/${file.id}`)}
                    className="w-full text-left px-4 py-4 hover:bg-white/5 flex justify-between items-center transition-colors cursor-pointer"
                  >
                    <div>
                      <p className="text-white font-medium">
                        {file.name}
                      </p>

                      <p className="text-zinc-400 text-sm">
                        {file.language} • {formatDuration(file.duration)} •{" "}
                        {new Date(file.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <span className="text-green-400 text-sm">
                      {file.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}