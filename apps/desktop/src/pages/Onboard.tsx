import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight, CheckCircle, Shield, Users, Clock, Coffee } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import DragHeader from '@/components/DragHeader'

const Onboard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0)
  const navigate = useNavigate()

  const steps = [
    {
      title: 'Welcome to Teams Keep-Alive',
      description: 'Keep your Microsoft Teams status active automatically',
      icon: <Users className="w-12 h-12 text-primary" />,
      content: (
        <div className="space-y-4 text-center">
          <p className="text-lg text-muted-foreground">
            Never appear "Away" in Microsoft Teams again. This app keeps your Teams status 
            active by preventing system sleep and simulating minimal user activity.
          </p>
        </div>
      )
    },
    {
      title: 'How It Works',
      description: 'Simple and effective keep-alive mechanism',
      icon: <Clock className="w-12 h-12 text-primary" />,
      content: (
        <div className="space-y-4">
          <ul className="space-y-2 text-left">
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Prevents your computer from sleeping</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Simulates minimal activity every 2 minutes</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Runs Teams in the background</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Maintains your "Available" status</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      title: 'Privacy & Control',
      description: 'You have full control over the process',
      icon: <Shield className="w-12 h-12 text-primary" />,
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Your Teams data remains private and secure. The app only simulates minimal 
            activity to prevent idle status - no data is collected or monitored.
          </p>
          <ul className="space-y-2 text-left">
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>No data collection or monitoring</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Start/stop anytime with one click</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Works with existing Teams installation</span>
            </li>
            <li className="flex items-center space-x-2">
              <Coffee className="w-4 h-4 text-blue-500" />
              <span>Perfect for coffee breaks and quick meetings</span>
            </li>
          </ul>
        </div>
      )
    }
  ]

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      // Complete onboarding
      try {
        await window.electronAPI.setOnboardingCompleted(true)
        navigate('/notifications')
      } catch (error) {
        console.error('Failed to save onboarding status:', error)
        // Still navigate to notifications even if saving fails
        navigate('/notifications')
      }
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className="min-h-screen">
      <DragHeader />
      <div className="flex justify-center items-center p-6 min-h-screen bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {steps[currentStep].icon}
            </div>
            <CardTitle className="text-2xl">{steps[currentStep].title}</CardTitle>
            <CardDescription className="text-base">
              {steps[currentStep].description}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {steps[currentStep].content}
            
            {/* Progress indicator */}
            <div className="flex justify-center space-x-2">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 w-8 rounded-full transition-colors ${
                    index === currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            
            {/* Navigation buttons */}
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
              >
                Previous
              </Button>
              
              <Button onClick={handleNext} className="flex items-center space-x-2">
                <span>{currentStep === steps.length - 1 ? 'Get Started' : 'Next'}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Onboard 