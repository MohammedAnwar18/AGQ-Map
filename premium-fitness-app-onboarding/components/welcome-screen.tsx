import Image from "next/image"
import { Activity, ArrowRight, Flame, HeartPulse, Timer } from "lucide-react"

const stats = [
  { icon: Flame, label: "Calories", value: "742", unit: "kcal" },
  { icon: HeartPulse, label: "Avg HR", value: "138", unit: "bpm" },
  { icon: Timer, label: "Pace", value: "4:52", unit: "/km" },
]

export function WelcomeScreen() {
  return (
    <section
      aria-label="Welcome onboarding"
      className="relative flex h-full w-full flex-col overflow-hidden"
    >
      {/* Background runner */}
      <div className="absolute inset-0">
        <Image
          src="/images/runner.png"
          alt="Translucent silhouette of an athlete running at full stride"
          fill
          priority
          className="object-cover object-center"
          sizes="(max-width: 480px) 100vw, 440px"
        />
        {/* Atmospheric overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/20 to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_70%_10%,transparent_30%,oklch(0.16_0.012_240/0.85)_100%)]" />
        {/* Neon glows */}
        <div className="absolute -left-16 top-24 size-56 rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute -right-20 bottom-40 size-64 rounded-full bg-accent/25 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col px-7 pb-10 pt-8">
        {/* Top bar */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_20px_-2px] shadow-primary/60">
              <Activity className="size-5" strokeWidth={2.5} />
            </span>
            <span className="text-lg font-semibold tracking-tight">PEAK</span>
          </div>
          <button
            type="button"
            className="rounded-full border border-border/70 bg-card/30 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-md transition-colors hover:text-foreground"
          >
            Skip
          </button>
        </header>

        {/* Floating stat chip */}
        <div className="mt-8 w-fit">
          <div className="flex items-center gap-2 rounded-full border border-accent/30 bg-card/30 px-3 py-1.5 backdrop-blur-md">
            <span className="size-2 animate-pulse rounded-full bg-accent shadow-[0_0_10px] shadow-accent" />
            <span className="text-xs font-medium text-foreground/90">
              Live session tracking
            </span>
          </div>
        </div>

        {/* Spacer pushes card to bottom */}
        <div className="flex-1" />

        {/* Glass card */}
        <div className="rounded-[2rem] border border-border/60 bg-card/40 p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl">
          {/* Stats row */}
          <div className="mb-6 grid grid-cols-3 gap-3">
            {stats.map(({ icon: Icon, label, value, unit }) => (
              <div
                key={label}
                className="rounded-2xl border border-border/50 bg-background/30 px-3 py-3 text-center backdrop-blur-md"
              >
                <Icon className="mx-auto mb-1.5 size-4 text-primary" strokeWidth={2.5} />
                <p className="text-base font-semibold leading-none">{value}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {label} · {unit}
                </p>
              </div>
            ))}
          </div>

          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
            Welcome to
          </p>
          <h1 className="mt-2 text-balance text-4xl font-semibold leading-[1.05] tracking-tight">
            Your Peak{" "}
            <span className="text-primary">Condition</span>
          </h1>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
            Track every run, beat, and breath. Intelligent insights that adapt
            to your body and push you further, every single day.
          </p>

          {/* CTA */}
          <button
            type="button"
            className="group mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground shadow-[0_0_30px_-4px] shadow-primary/70 transition-transform active:scale-[0.98]"
          >
            Get Started
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </button>

          <button
            type="button"
            className="mt-3 w-full text-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            I already have an account
          </button>

          {/* Progress dots */}
          <div className="mt-6 flex items-center justify-center gap-1.5">
            <span className="h-1.5 w-6 rounded-full bg-primary" />
            <span className="size-1.5 rounded-full bg-muted-foreground/40" />
            <span className="size-1.5 rounded-full bg-muted-foreground/40" />
          </div>
        </div>
      </div>
    </section>
  )
}
