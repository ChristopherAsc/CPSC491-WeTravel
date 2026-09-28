import type { ReactNode } from "react"

interface MainContentProps {
  children: ReactNode
}

function MainContent({ children }: MainContentProps) {
  return (
    <main className="min-h-screen bg-white pb-24 md:pb-8">
      {children}
    </main>
  )
}

export default MainContent