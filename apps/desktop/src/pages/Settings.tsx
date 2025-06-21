import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { Palette, Bell, Shield, Chrome, RotateCcw, Settings as SettingsIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import UpdateNotification from '@/components/UpdateNotification'
import DragHeader from '@/components/DragHeader'
import { UserSettings } from '@/types'

const Settings: React.FC = () => {
  const navigate = useNavigate()
  const [userSettings, setUserSettings] = useState<UserSettings>({
    autoStart: false,
    analytics: false,
    theme: 'system',
    startMinimized: false,
    notifications: {
      teamsStatusChanges: true,
      systemSleepPrevention: true
    }
  })
  const [loading, setLoading] = useState(true)

  // Load user settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await window.electronAPI.getUserSettings()
        setUserSettings(settings)
      } catch (error) {
        console.error('Failed to load user settings:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  // Save user settings
  const saveUserSettings = async (newSettings: Partial<UserSettings>) => {
    try {
      const updatedSettings = { ...userSettings, ...newSettings }
      await window.electronAPI.setUserSettings(updatedSettings)
      setUserSettings(updatedSettings)
    } catch (error) {
      console.error('Failed to save user settings:', error)
    }
  }

  // Handle auto-start toggle
  const handleAutoStartToggle = async (enabled: boolean) => {
    try {
      await window.electronAPI.setAutoStart(enabled)
      await saveUserSettings({ autoStart: enabled })
    } catch (error) {
      console.error('Failed to set auto-start:', error)
    }
  }

  // Handle analytics toggle
  const handleAnalyticsToggle = async (enabled: boolean) => {
    await saveUserSettings({ analytics: enabled })
  }

  // Handle notifications toggle
  const handleNotificationToggle = async (key: keyof UserSettings['notifications'], enabled: boolean) => {
    await saveUserSettings({
      notifications: {
        ...userSettings.notifications,
        [key]: enabled
      }
    })
  }

  const handleResetOnboarding = async () => {
    try {
      await window.electronAPI.setOnboardingCompleted(false)
      navigate('/onboard')
    } catch (error) {
      console.error('Failed to reset onboarding:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <DragHeader />
        <div className="container p-6 mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="text-lg">Loading settings...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="p-6 mx-auto space-y-6">
        <div className="flex items-center mb-6 space-x-2">
          <Chrome className="w-6 h-6" />
          <h1 className="text-3xl font-bold">Teams Keep-Alive</h1>
        </div>

        {/* Navigation */}
        <div className="flex mb-6 space-x-4">
          <Button 
            variant="outline" 
            onClick={() => navigate('/notifications')}
          >
            <Chrome className="mr-2 w-4 h-4" />
            Home
          </Button>
          <Button 
            variant="default" 
            className="bg-primary text-primary-foreground"
          >
            <SettingsIcon className="mr-2 w-4 h-4" />
            Settings
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Update Notification */}
          <div className="md:col-span-2">
            <UpdateNotification />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Palette className="w-5 h-5" />
                <span>Appearance</span>
              </CardTitle>
              <CardDescription>
                Customize the look and feel of your application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Theme</label>
                <Button variant="outline" size="sm">
                  {userSettings.theme.charAt(0).toUpperCase() + userSettings.theme.slice(1)}
                </Button>
              </div>
              {/* <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Start minimized</label>
                <Toggle
                  checked={userSettings.startMinimized}
                  onCheckedChange={(enabled) => saveUserSettings({ startMinimized: enabled })}
                />
              </div> */}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="w-5 h-5" />
                <span>Notifications</span>
              </CardTitle>
              <CardDescription>
                Manage your notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Teams status changes</label>
                <Toggle
                  checked={userSettings.notifications.teamsStatusChanges}
                  onCheckedChange={(enabled) => handleNotificationToggle('teamsStatusChanges', enabled)}
                />
              </div>
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">System sleep prevention</label>
                <Toggle
                  checked={userSettings.notifications.systemSleepPrevention}
                  onCheckedChange={(enabled) => handleNotificationToggle('systemSleepPrevention', enabled)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Privacy & Security</span>
              </CardTitle>
              <CardDescription>
                Control your privacy and security settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Analytics</label>
                <Toggle
                  checked={userSettings.analytics}
                  onCheckedChange={handleAnalyticsToggle}
                />
              </div>
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Auto-start with system</label>
                <Toggle
                  checked={userSettings.autoStart}
                  onCheckedChange={handleAutoStartToggle}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>About Teams Keep-Alive</CardTitle>
              <CardDescription>
                Information about this application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm"><span className="font-medium">Version:</span> 1.0.0</p>
                <p className="text-sm"><span className="font-medium">Purpose:</span> Keep Microsoft Teams active using Chrome</p>
                <p className="text-sm"><span className="font-medium">Features:</span> Chrome automation, WebAuthn support, activity simulation</p>
              </div>
              <div className="space-y-2">
                <Button className="w-full">Check for Updates</Button>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleResetOnboarding}
                >
                  <RotateCcw className="mr-2 w-4 h-4" />
                  Reset Onboarding
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Settings 