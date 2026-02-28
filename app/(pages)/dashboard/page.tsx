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
      try {
        // 1. Get User
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
          console.error("Auth error or no user:", authError)
          router.replace("/auth/login")
          return
        }

        setUsername(user.user_metadata?.username ?? user.email?.split('@')[0] ?? "User")

        // 2. Fetch Files from Supabase
        // Ensure your table is named 'files' and has RLS policies allowing 'select' for authenticated users
        const { data, error } = await supabase
          .from('files')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) {
          // Log the full error object to debug RLS or schema issues
          console.error("Error fetching files details:", JSON.stringify(error, null, 2))
        } else if (data) {
          // Map snake_case DB fields to camelCase frontend type
          const mappedFiles: VoxFile[] = data.map((file) => ({
            id: file.id,
            name: file.name,
            size: file.size,
            duration: file.duration,
            language: file.language,
            createdAt: file.created_at, // Supabase returns ISO string in created_at
            status: file.status,
          }))
          setFiles(mappedFiles)
        }
      } catch (error) {
        console.error("Dashboard loading unexpected error:", error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace("/auth/login")
  }

  const clearRecentFiles = async () => {
    if (!confirm("Are you sure you want to delete all your files? This cannot be undone.")) {
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('files')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error("Error deleting files:", error)
      alert("Failed to delete files")
    } else {
      setFiles([])
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
        className="absolute -top-32 -left-32 w-96 h-96 bg-red-600/30 rounded-full blur-3xl will-change-transform!"
        animate={{ x: [0, 60, -40, 0], y: [0, 40, -60, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-32 -right-32 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl will-change-transform!"
        animate={{ x: [0, -50, 30, 0], y: [0, -40, 50, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Header */}
      <Header
        userName={username}
        onLogout={handleLogout}
      />

      {/* Main layout */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10 flex gap-8">

        {/* Main card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-xl font-semibold text-white">
              All Recent Files
            </div>

            <div className="flex items-center gap-3">
              {files.length > 0 && (
                <button
                  onClick={clearRecentFiles}
                  className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-red-400 transition cursor-pointer"
                >
                  🗑️ Clear All
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            {loading ? (
               <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-20 text-zinc-400"
              >
                Loading files...
              </motion.div>
            ) : files.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="text-center py-20"
              >
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-5xl mb-4"
                >
                  📂
                </motion.div>

                <h2 className="text-2xl font-semibold text-white mb-4">
                  Welcome to VoxScribe!
                </h2>

                <button
                  onClick={() => router.push("/transcription")}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-red-600 to-pink-600 text-white font-medium shadow-lg shadow-red-600/20 hover:shadow-red-600/40 transition"
                >
                  ⬆️ Transcribe Your First File
                </button>

                <p className="mt-4 text-sm text-zinc-400">
                  💡 TIP: Drag and drop files to upload them into VoxScribe.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="divide-y divide-white/10"
              >
                {files.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => router.push(`/file/${file.id}`)}
                    className="w-full text-left px-4 py-4 hover:bg-white/5 transition flex justify-between items-center cursor-pointer"
                  >
                    <div>
                      <p className="font-medium text-white">
                        {file.name}
                      </p>
                      <p className="text-sm text-zinc-400">
                        {file.language} •{" "}
                        {formatDuration(file.duration)} •{" "}
                        {new Date(file.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <span className="text-sm text-green-400">
                      {file.status}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}