import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useAuth } from '../../hooks/useAuth'
import { useRouter } from 'next/router'
import ThemeToggle from '../../components/ThemeToggle'
import { api } from '../../utils/api'
import { 
  MagnifyingGlassIcon, 
  BookmarkIcon, 
  AcademicCapIcon,
  ClockIcon,
  StarIcon
} from '@heroicons/react/24/outline'

interface Course {
  course_code: string
  course_name: string
  credits: number
  course_type: string
}

export default function StudentDashboard() {
  const { user, logout, loading: authLoading } = useAuth()
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!user) {
      router.push('/student/login')
      return
    }

    fetchMyCourses()
  }, [user, router])

  // Refresh courses when returning from courses page or when page becomes visible
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        fetchMyCourses()
      }
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        fetchMyCourses()
      }
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user])

  const fetchMyCourses = async () => {
    try {
      // Use the api utility to ensure correct backend URL
      const response = await api.get('/api/student/my-courses')
      setCourses(Array.isArray(response.data) ? response.data : [])
    } catch (error: any) {
      console.error('Failed to fetch courses:', error)
      if (error.response) {
        console.error('Error response:', error.response.status, error.response.data)
      }
      setCourses([])
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/student/search?q=${encodeURIComponent(searchQuery)}`)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-colors">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Student Dashboard - QPaper AI</title>
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Dashboard</h1>
              </div>
              <div className="flex items-center space-x-4">
                <ThemeToggle />
                <div className="flex items-center space-x-3">
                  {user?.profile_picture_url ? (
                    <img
                      src={user.profile_picture_url}
                      alt={user?.display_name || user?.username}
                      className="h-10 w-10 rounded-full border-2 border-gray-200"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold">
                      {(user?.display_name || user?.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {user?.display_name || user?.email?.split('@')[0] || user?.username}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Search Section */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Search Questions</h2>
            <div className="card">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search for questions (e.g., 'explain database joins')"
                    className="input-field"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <button
                  onClick={handleSearch}
                  className="btn-primary flex items-center"
                >
                  <MagnifyingGlassIcon className="h-5 w-5 mr-2" />
                  Search
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <button
                onClick={() => router.push('/student/search')}
                className="card hover:shadow-md transition-shadow duration-200 text-left"
              >
                <div className="flex items-center">
                  <MagnifyingGlassIcon className="h-8 w-8 text-primary-600 dark:text-primary-400 mr-3" />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Search Questions</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Find specific questions</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push('/student/bookmarks')}
                className="card hover:shadow-md transition-shadow duration-200 text-left"
              >
                <div className="flex items-center">
                  <BookmarkIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-500 mr-3" />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">My Bookmarks</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Saved questions</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push('/student/practice')}
                className="card hover:shadow-md transition-shadow duration-200 text-left"
              >
                <div className="flex items-center">
                  <AcademicCapIcon className="h-8 w-8 text-green-600 dark:text-green-500 mr-3" />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Practice Mode</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Random questions</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push('/student/courses')}
                className="card hover:shadow-md transition-shadow duration-200 text-left"
              >
                <div className="flex items-center">
                  <StarIcon className="h-8 w-8 text-blue-600 dark:text-blue-500 mr-3" />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">My Courses</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">View course details</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* My Courses */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Courses</h2>
              <button
                onClick={fetchMyCourses}
                disabled={loading}
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 transition-colors disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            {loading ? (
              <p className="text-gray-600 dark:text-gray-400">Loading courses...</p>
            ) : courses.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                  <div key={course.course_code} className="card">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">{course.course_code}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{course.course_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          {course.credits} credits • {course.course_type}
                        </p>
                      </div>
                      <button
                        onClick={() => router.push(`/student/search?course=${course.course_code}`)}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 text-sm transition-colors"
                      >
                        View Questions
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card text-center py-8">
                <AcademicCapIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-300 mb-2">No courses selected</p>
                <button
                  onClick={() => router.push('/student/courses')}
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Select your courses
                </button>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
            <div className="card">
              <p className="text-gray-600 dark:text-gray-300">Recent activity will be displayed here...</p>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
