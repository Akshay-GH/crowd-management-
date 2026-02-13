"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, LogOut } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function AmbulanceDashboard() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<string[]>([])
  const [user, setUser] = useState<{ name: string } | null>(null)

  useEffect(() => {
    // Check if user is logged in and is ambulance service via API
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me')
        if (!res.ok) {
          router.push('/signin')
          return
        }
        const data = await res.json()
        if (data.user.role !== 'ambulance') {
          router.push('/signin')
        } else {
          setUser(data.user)
        }
      } catch {
        router.push('/signin')
      }
    }
    checkAuth()

    // Simulate receiving emergency alerts
    const timer = setTimeout(() => {
      setNotifications([
        "Medical emergency reported at Main Building, Room 101.",
        "Student reported injury at Sports Field.",
      ])
    }, 2000)

    return () => clearTimeout(timer)
  }, [router])

  const handleEmergencyResponse = () => {
    // In a real app, you would send a response to your backend
    console.log("Emergency response triggered")
    setNotifications((prev) => [...prev, "Response team dispatched. ETA: 5 minutes."])
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/signin')
  }

  if (!user) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Ambulance Service Dashboard</h1>
          <div className="flex items-center gap-4">
            <span>Welcome, {user.name}</span>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        

          <Card>
            <CardHeader>
              <CardTitle>Video Feed</CardTitle>
              <CardDescription>Live video feed from emergency location</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-black rounded-md overflow-hidden">
                <video
                  src="/videos/fixed-ambulance-path.mp4" // Make sure the file is in your /public directory
                  controls
                  autoPlay
                  muted
                  loop
                  className="w-full h-full object-cover"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Emergency Response</CardTitle>
              <CardDescription>Respond to emergency alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={handleEmergencyResponse}>
                <Bell className="mr-2 h-4 w-4" />
                Dispatch Response Team
              </Button>
            </CardContent>
          </Card>


          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Emergency Notifications</CardTitle>
              <CardDescription>Recent emergency alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {notifications.length > 0 ? (
                notifications.map((notification, index) => (
                  <Alert key={index} variant={index === 0 ? "destructive" : "default"}>
                    <Bell className="h-4 w-4" />
                    <AlertTitle>Emergency Alert</AlertTitle>
                    <AlertDescription>{notification}</AlertDescription>
                  </Alert>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">No active emergencies</div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
