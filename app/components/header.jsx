"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function Header({ userName, onLogout }) {
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  // FIXED: Removed TypeScript type annotation <string | null>
  const [userEmail, setUserEmail] = useState(null)
  const menuRef = useRef(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) &&
        buttonRef.current && !buttonRef.current.contains(event.target)) {
        setMobileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch user email on mount
  useEffect(() => {
    const getUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setUserEmail(user.email)
      }
    }
    getUserEmail()
  }, [])

  const handleNavigation = (path) => {
    router.push(path)
    setMobileMenuOpen(false)
  }

  return (
    <>
      <header className="w-full px-4 sm:px-6 md:px-8 py-4 bg-black border-b border-white/10 shadow-md flex items-center justify-between relative" style={{ zIndex: 40 }}>
        <div
          onClick={() => router.push("/dashboard")}
          className="text-xl font-bold text-white tracking-tight cursor-pointer"
        >
          Vox<span className="text-red-500">Scribe</span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:block">
          <ul className="flex items-center gap-8 text-sm">
            <li>
              <button
                onClick={() => router.push("/dashboard")}
                className="text-zinc-300 hover:text-white transition-colors"
              >
                Home
              </button>
            </li>
            <li>
              <button
                onClick={() => router.push("/transcription")}
                className="text-zinc-300 hover:text-white transition-colors"
              >
                Transcribe
              </button>
            </li>
            <li className="flex items-center gap-4 pl-4 border-l border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white text-sm font-medium">
                  {userName ? userName.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="text-zinc-300 text-sm hidden lg:block">
                  {userName || 'User'}
                </span>
              </div>
              <button
                onClick={onLogout}
                className="px-4 py-1.5 rounded-lg border border-white/10 text-zinc-300 hover:text-white hover:border-white/30 transition-all text-sm"
              >
                Logout
              </button>
            </li>
          </ul>
        </nav>

        {/* Mobile Header */}
        <div className="flex items-center gap-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white text-sm font-medium">
              {userName ? userName.charAt(0).toUpperCase() : 'U'}
            </div>
            {userName && isMobile && (
              <span className="text-zinc-300 text-sm max-w-[100px] truncate">
                {userName}
              </span>
            )}
          </div>

          <button
            ref={buttonRef}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Toggle menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5 text-zinc-300"
            >
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile Menu - No Blur */}
      {mobileMenuOpen && (
        <>
          {/* Solid backdrop */}
          <div
            className="fixed inset-0 bg-black/60 md:hidden"
            style={{ zIndex: 9998 }}
            onClick={() => setMobileMenuOpen(false)}
          />

          <div
            ref={menuRef}
            className="fixed top-20 right-4 w-64 md:hidden"
            style={{ zIndex: 9999 }}
          >
            <div className="bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              {/* User Info */}
              <div className="p-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white font-medium">
                    {userName ? userName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{userName || 'User'}</p>
                    <p className="text-zinc-500 text-xs truncate">{userEmail || 'Loading...'}</p>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-2">
                <button
                  onClick={() => handleNavigation("/dashboard")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span>Home</span>
                </button>

                <button
                  onClick={() => handleNavigation("/transcription")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <span>Transcribe</span>
                </button>

                <div className="h-px bg-white/5 my-2"></div>

                <button
                  onClick={() => {
                    onLogout()
                    setMobileMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}