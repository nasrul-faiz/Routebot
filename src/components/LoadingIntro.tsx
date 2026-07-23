import { useState, useEffect } from "react"
import { useTheme } from "@/hooks/use-theme"
import { Sun, Moon } from "lucide-react"

const STATUS_STEPS = [
  "Initialising system…",
  "Loading delivery routes…",
  "Syncing schedule data…",
  "Almost ready…",
]

export function LoadingIntro({ onEnter }: { onEnter: () => void }) {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const [exiting, setExiting] = useState(false)
  const [statusText, setStatusText] = useState("Initialising system…")
  const { mode, toggleMode } = useTheme()
  const isDark = mode === "dark"

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!visible || exiting) return
    let step = 0
    const statusInterval = setInterval(() => {
      step = Math.min(step + 1, STATUS_STEPS.length - 1)
      setStatusText(STATUS_STEPS[step])
    }, 600)
    return () => clearInterval(statusInterval)
  }, [visible, exiting])

  useEffect(() => {
    if (!visible || exiting) return
    let current = 0
    const tick = () => {
      const increment = Math.random() * 18 + 4
      current = Math.min(current + increment, 100)
      setProgress(current)
      if (current >= 100) {
        setTimeout(() => {
          setExiting(true)
          setTimeout(onEnter, 500)
        }, 350)
        return
      }
      setTimeout(tick, 180 + Math.random() * 120)
    }
    setTimeout(tick, 300)
  }, [visible, exiting, onEnter])

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col overflow-hidden transition-opacity duration-400 ease-in-out ${visible ? "opacity-100" : "opacity-0"}`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Exit fade */}
      <div
        className={`pointer-events-none absolute inset-0 z-50 bg-black transition-opacity duration-500 ease-in-out ${exiting ? "opacity-100" : "opacity-0"}`}
      />

      {/* Background */}
      <div className={`absolute inset-0 ${isDark ? "bg-[#0a0a0f]" : "bg-[#f5f7fa]"}`} />

      {/* Ambient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 480, height: 480,
            top: "-15%", left: "-10%",
            background: isDark
              ? "radial-gradient(circle, rgba(0,177,79,0.12) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(0,177,79,0.10) 0%, transparent 70%)",
            animation: "floatA 8s ease-in-out infinite",
          }}
        />
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 380, height: 380,
            bottom: "-10%", right: "-8%",
            background: isDark
              ? "radial-gradient(circle, rgba(0,160,176,0.10) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(0,160,176,0.08) 0%, transparent 70%)",
            animation: "floatB 10s ease-in-out infinite",
          }}
        />
        {/* grid lines */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: isDark
              ? "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)"
              : "linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex justify-between items-center px-6 sm:px-10 pt-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isDark ? "text-white/55" : "text-black/55"}`}>
            DBRUTALS
          </span>
        </div>
        <button
          onClick={toggleMode}
          aria-label="Toggle theme"
          className={`flex items-center justify-center w-9 h-9 rounded-full border transition-all duration-200 hover:scale-105 active:scale-95
            ${isDark ? "border-white/10 bg-white/5 hover:bg-white/10" : "border-black/10 bg-black/5 hover:bg-black/10"}`}
        >
          {isDark
            ? <Sun className="size-4 text-white/60" />
            : <Moon className="size-4 text-black/50" />}
        </button>
      </div>

      {/* Centre content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 gap-12">

        {/* Logo ring */}
        <div
          className={`transition-all duration-700 ${visible ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}
          style={{ transitionDelay: "100ms" }}
        >
          <div className="relative flex items-center justify-center">
            {/* Outer pulse ring */}
            <div
              className="absolute rounded-full border"
              style={{
                width: 140, height: 140,
                borderColor: "rgba(0,177,79,0.20)",
                animation: "ringPulse 2.4s ease-in-out infinite",
              }}
            />
            {/* Inner ring */}
            <div
              className="absolute rounded-full border"
              style={{
                width: 108, height: 108,
                borderColor: "rgba(0,177,79,0.35)",
                animation: "ringPulse 2.4s ease-in-out infinite 0.4s",
              }}
            />
            {/* Logo container */}
            <div
              className={`relative flex items-center justify-center w-20 h-20 rounded-2xl
                ${isDark ? "bg-white/5 border border-white/10" : "bg-white border border-black/8 shadow-lg"}`}
              style={{ backdropFilter: "blur(12px)" }}
            >
              <img src="/FamilyMart.png" alt="FamilyMart" className="w-12 h-12 object-contain" />
            </div>
          </div>
        </div>

        {/* Brand text */}
        <div
          className={`text-center transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          style={{ transitionDelay: "220ms" }}
        >
          <h1 className={`text-2xl font-bold tracking-tight mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>
            FamilyMart
          </h1>
          <p className={`text-xs font-semibold tracking-widest uppercase ${isDark ? "text-white/60" : "text-black/60"}`}>
            Vending Machine Operations
          </p>
        </div>

        {/* Progress block */}
        <div
          className={`w-full max-w-xs transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          style={{ transitionDelay: "340ms" }}
        >
          {/* Track */}
          <div className={`w-full h-[3px] rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-black/10"}`}>
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${Math.min(progress, 100)}%`,
                background: "linear-gradient(90deg, #00B14F, #00c96b)",
                boxShadow: "0 0 10px rgba(0,177,79,0.5)",
              }}
            />
          </div>

          {/* Labels */}
          <div className="flex items-center justify-between mt-3">
            <p className={`text-[11px] font-semibold ${isDark ? "text-white/70" : "text-black/70"}`}>
              {statusText}
            </p>
            <span className={`text-[11px] font-bold tabular-nums ${isDark ? "text-white/80" : "text-black/75"}`}>
              {Math.min(Math.round(progress), 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Bottom wordmark */}
      <div className="relative z-10 flex justify-center pb-8">
        <span className={`text-[10px] tracking-widest uppercase font-semibold ${isDark ? "text-white/35" : "text-black/35"}`}>
          Powered by Dbrutals · v1.0.0
        </span>
      </div>

      <style>{`
        @keyframes ringPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50%       { transform: scale(1.08); opacity: 1; }
        }
        @keyframes floatA {
          0%, 100% { transform: translate(0, 0); }
          50%       { transform: translate(30px, 20px); }
        }
        @keyframes floatB {
          0%, 100% { transform: translate(0, 0); }
          50%       { transform: translate(-20px, -30px); }
        }
      `}</style>
    </div>
  )
}
