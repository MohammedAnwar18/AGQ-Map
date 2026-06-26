import { WelcomeScreen } from "@/components/welcome-screen"

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background sm:p-6">
      {/* Mobile: full screen. Larger: a 9:16 device frame. */}
      <div className="relative h-screen w-full overflow-hidden bg-background sm:h-[860px] sm:max-h-[92vh] sm:w-[440px] sm:rounded-[2.75rem] sm:border sm:border-border/60 sm:shadow-2xl sm:shadow-black/60">
        <WelcomeScreen />
      </div>
    </main>
  )
}
