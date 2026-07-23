import { useState, useEffect } from "react"
import { ArrowRight, CalendarDays, MapPin, Package, Layers, Users, Sun, Moon, Zap, Shield, BarChart3 } from "lucide-react"
import { useTheme } from "@/hooks/use-theme"

const FEATURES = [
  { icon: CalendarDays, title: "Route Calendar",      description: "Plan and track daily delivery routes with colour-coded schedules.", tag: "Operations" },
  { icon: MapPin,       title: "Location Tracking",   description: "Log delivery locations and manage stop records efficiently.",       tag: "Tracking" },
  { icon: Package,      title: "VM Management",       description: "Monitor vending machine stock, planograms, and movements.",          tag: "Inventory" },
  { icon: Users,        title: "Rooster",             description: "View shift schedules in weekly or monthly calendar view.",          tag: "Team" },
  { icon: Layers,       title: "Gallery",             description: "Store and browse VM photo albums organised by site.",               tag: "Media" },
  { icon: BarChart3,    title: "Analytics",           description: "Insights into delivery performance and route efficiency.",          tag: "Reports" },
]

const STATS = [
  { label: "Routes Managed", value: "1K+",  icon: MapPin },
  { label: "Active Users",   value: "500+", icon: Users },
  { label: "Stops Tracked",  value: "50K+", icon: Zap },
]

export function LandingPage({ onEnter }: { onEnter: () => void }) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [active, setActive] = useState(0)
  const { mode, toggleMode } = useTheme()
  const isDark = mode === "dark"

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!visible) return
    const id = setInterval(() => setActive(p => (p + 1) % FEATURES.length), 4000)
    return () => clearInterval(id)
  }, [visible])

  const handleEnter = () => {
    setExiting(true)
    setTimeout(onEnter, 480)
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col overflow-y-auto transition-opacity duration-400 ease-in-out ${visible ? "opacity-100" : "opacity-0"}`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Exit overlay */}
      <div className={`pointer-events-none absolute inset-0 z-50 bg-black transition-opacity duration-500 ease-in-out ${exiting ? "opacity-100" : "opacity-0"}`} />

      {/* Background */}
      <div className={`absolute inset-0 ${isDark ? "bg-[#080c10]" : "bg-[#f0f4f8]"}`} />

      {/* Ambient gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute rounded-full blur-[120px]" style={{ width: 600, height: 600, top: "-20%", left: "-15%", background: isDark ? "rgba(0,177,79,0.09)" : "rgba(0,177,79,0.08)" }} />
        <div className="absolute rounded-full blur-[100px]" style={{ width: 400, height: 400, bottom: "5%", right: "-10%", background: isDark ? "rgba(0,140,255,0.07)" : "rgba(0,140,255,0.06)" }} />
        <div className="absolute rounded-full blur-[80px]"  style={{ width: 300, height: 300, top: "40%", left: "55%",  background: isDark ? "rgba(160,80,255,0.06)" : "rgba(160,80,255,0.05)" }} />
        {/* grid */}
        <div className="absolute inset-0" style={{
          backgroundImage: isDark
            ? "linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)"
            : "linear-gradient(rgba(0,0,0,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.03) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }} />
      </div>

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5">
        <div className="flex items-center gap-2.5">
          <img src="/FamilyMart.png" alt="FM" className="w-7 h-7 object-contain" />
          <span className={`text-sm font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
            FamilyMart <span className={`font-normal ${isDark ? "text-white/40" : "text-black/35"}`}>VM</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleMode}
            className={`flex items-center justify-center w-9 h-9 rounded-full border transition-all duration-200 hover:scale-105 active:scale-95
              ${isDark ? "border-white/10 bg-white/5 hover:bg-white/10 text-white/60" : "border-black/10 bg-black/5 hover:bg-black/10 text-black/50"}`}
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <button
            onClick={handleEnter}
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-green-500 hover:bg-green-400 text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] shadow-lg shadow-green-500/20"
          >
            Launch App
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 sm:px-10 py-14 sm:py-20 text-center">
        <div className="max-w-3xl mx-auto w-full">

          {/* Badge */}
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-8 border transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}
              ${isDark ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-green-50 border-green-200 text-green-700"}`}
            style={{ transitionDelay: "80ms" }}
          >
            <Shield className="size-3" />
            Next-gen delivery management
          </div>

          {/* Heading */}
          <h1
            className={`text-[clamp(2.4rem,8vw,5rem)] font-black tracking-tight leading-[1.05] mb-6 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"} ${isDark ? "text-white" : "text-gray-900"}`}
            style={{ transitionDelay: "160ms" }}
          >
            Delivery{" "}
            <span style={{ background: "linear-gradient(135deg,#00B14F,#00d95e)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              excellence
            </span>
            <br />
            made simple.
          </h1>

          {/* Sub */}
          <p
            className={`text-base sm:text-lg leading-relaxed mb-10 max-w-xl mx-auto transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"} ${isDark ? "text-white/50" : "text-black/50"}`}
            style={{ transitionDelay: "230ms" }}
          >
            Complete platform for route planning, location tracking, inventory management, and team scheduling — built for precision.
          </p>

          {/* CTAs */}
          <div
            className={`flex flex-col sm:flex-row items-center justify-center gap-3 mb-14 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
            style={{ transitionDelay: "300ms" }}
          >
            <button
              onClick={handleEnter}
              className="group flex items-center gap-2.5 px-7 py-3.5 rounded-2xl text-sm font-bold bg-green-500 hover:bg-green-400 text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] shadow-xl shadow-green-500/25"
            >
              Launch App
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            <button
              className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold border transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]
                ${isDark ? "border-white/12 bg-white/5 hover:bg-white/10 text-white/70" : "border-black/10 bg-white hover:bg-gray-50 text-gray-600 shadow-sm"}`}
            >
              Learn More
            </button>
          </div>

          {/* Stats strip */}
          <div
            className={`flex items-center justify-center gap-0 transition-all duration-700 ${visible ? "opacity-100" : "opacity-0"}`}
            style={{ transitionDelay: "380ms" }}
          >
            {STATS.map(({ label, value, icon: Icon }, i) => (
              <div key={i} className="flex items-center">
                <div className={`flex flex-col items-center px-8 py-4 ${i > 0 ? `border-l ${isDark ? "border-white/8" : "border-black/8"}` : ""}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Icon className="size-3 text-green-500" />
                    <span className={`text-2xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>{value}</span>
                  </div>
                  <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-white/30" : "text-black/35"}`}>{label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature showcase ────────────────────────────────────────────────── */}
      <section className={`relative z-10 px-6 sm:px-10 py-16 border-t ${isDark ? "border-white/6" : "border-black/6"}`}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className={`text-2xl sm:text-3xl font-black mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>
              Everything in one place
            </h2>
            <p className={`text-sm sm:text-base max-w-xl mx-auto ${isDark ? "text-white/40" : "text-black/40"}`}>
              All the tools your team needs — unified, fast, and intuitive.
            </p>
          </div>

          {/* Featured card + list */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Big active card */}
            <div
              className={`lg:col-span-2 relative rounded-3xl p-8 overflow-hidden border transition-all duration-500
                ${isDark ? "bg-white/4 border-white/8" : "bg-white border-black/6 shadow-lg"}`}
            >
              <div className="absolute inset-0 rounded-3xl" style={{ background: "linear-gradient(135deg, rgba(0,177,79,0.08) 0%, transparent 60%)" }} />
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-500/15 mb-6">
                  {(() => { const Icon = FEATURES[active].icon; return <Icon className="size-7 text-green-500" /> })()}
                </div>
                <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 text-green-500`}>{FEATURES[active].tag}</div>
                <h3 className={`text-xl font-black mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>{FEATURES[active].title}</h3>
                <p className={`text-sm leading-relaxed mb-6 ${isDark ? "text-white/45" : "text-black/45"}`}>{FEATURES[active].description}</p>
                {/* dots */}
                <div className="flex gap-1.5">
                  {FEATURES.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActive(i)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? "w-8 bg-green-500" : `w-1.5 ${isDark ? "bg-white/20" : "bg-black/15"}`}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Feature list */}
            <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FEATURES.map(({ icon: Icon, title, description, tag }, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`group text-left p-5 rounded-2xl border transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]
                    ${i === active
                      ? isDark ? "bg-green-500/10 border-green-500/30" : "bg-green-50 border-green-200"
                      : isDark ? "bg-white/3 border-white/6 hover:bg-white/6" : "bg-white border-black/6 hover:bg-gray-50 shadow-sm"
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl transition-colors duration-200
                      ${i === active ? "bg-green-500/20" : isDark ? "bg-white/6 group-hover:bg-white/10" : "bg-black/5 group-hover:bg-black/8"}`}>
                      <Icon className={`size-4 transition-colors ${i === active ? "text-green-500" : isDark ? "text-white/50" : "text-black/40"}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-bold leading-tight ${isDark ? "text-white" : "text-gray-900"}`}>{title}</span>
                        <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full
                          ${i === active ? "bg-green-500/20 text-green-600" : isDark ? "bg-white/8 text-white/35" : "bg-black/6 text-black/35"}`}>
                          {tag}
                        </span>
                      </div>
                      <p className={`text-[11px] leading-relaxed line-clamp-2 ${isDark ? "text-white/35" : "text-black/40"}`}>{description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer CTA ──────────────────────────────────────────────────────── */}
      <section className={`relative z-10 px-6 sm:px-10 py-16 border-t text-center ${isDark ? "border-white/6" : "border-black/6"}`}>
        <div className="max-w-xl mx-auto">
          <h2 className={`text-2xl sm:text-3xl font-black mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>
            Ready to optimise your deliveries?
          </h2>
          <p className={`text-sm mb-8 ${isDark ? "text-white/40" : "text-black/40"}`}>
            Join teams already streamlining their vending operations.
          </p>
          <button
            onClick={handleEnter}
            className="group inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-sm font-bold bg-green-500 hover:bg-green-400 text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] shadow-xl shadow-green-500/25"
          >
            Get Started Now
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
          <p className={`mt-8 text-[11px] ${isDark ? "text-white/15" : "text-black/20"}`}>
            Dbrutals · v1.0.0
          </p>
        </div>
      </section>
    </div>
  )
}
