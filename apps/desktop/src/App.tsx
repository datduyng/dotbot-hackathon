import { 
  // Must use HashRouter for Electron production builds - fixes React Router v5 issue
  // https://stackoverflow.com/questions/74638616/blank-page-after-build-electron-react-app
  HashRouter as Router,
  Routes,
  Route,
  Navigate
} from 'react-router-dom'
import { useState, useEffect } from 'react'
import Onboard from '@/pages/Onboard'
import Settings from '@/pages/Settings'
import Notifications from '@/pages/Notifications'
import ErrorBoundary from '@/components/ErrorBoundary'

function App() {
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const completed = await window.electronAPI.getOnboardingCompleted()
        setOnboardingCompleted(completed)
      } catch (error) {
        setOnboardingCompleted(false)
      } finally {
        setLoading(false)
      }
    }

    // Add a small delay to ensure APIs are ready
    setTimeout(() => {
      checkOnboardingStatus()
    }, 100)
  }, [])
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-foreground">
        <div className="text-center">
          <div className="mx-auto mb-4 w-8 h-8 rounded-full border-b-2 animate-spin border-primary"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }
  return (
    <Router>
      <div className="min-h-screen bg-background text-foreground">
        <Routes>
          <Route 
            path="/" 
            element={
              onboardingCompleted ? 
                <Navigate to="/notifications" replace /> : 
                <Navigate to="/onboard" replace />
            } 
          />
          <Route path="/onboard" element={<Onboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route 
            path="/notifications" 
            element={
              <ErrorBoundary>
                <Notifications />
              </ErrorBoundary>
            } 
          />
        </Routes>
      </div>
    </Router>
  )
}

export default App
