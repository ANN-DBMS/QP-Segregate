import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useAuth } from '../../hooks/useAuth'
import { useRouter } from 'next/router'
import ThemeToggle from '../../components/ThemeToggle'
import { api } from '../../utils/api'
import { 
  DocumentTextIcon, 
  QuestionMarkCircleIcon, 
  ClockIcon,
  ChartBarIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  ListBulletIcon
} from '@heroicons/react/24/outline'

interface DashboardStats {
  total_papers: number
  total_questions: number
  pending_reviews: number
  bloom_distribution: Record<string, number>
  course_breakdown: Record<string, number>
}

interface ReviewItem {
  review_id: number
  question_id: number
  question_text: string
  issue_type: string
  priority: number
  created_at: string
}

export default function AdminDashboard() {
  const { user, logout, loading: authLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingReviews, setLoadingReviews] = useState(true)

  useEffect(() => {
    if (!user) {
      router.push('/admin/login')
      return
    }

    fetchDashboardStats()
    fetchReviewQueue()
  }, [user, router])

  const fetchDashboardStats = async () => {
    try {
      const response = await api.get('/api/admin/analytics/dashboard')
      setStats(response.data)
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchReviewQueue = async () => {
    try {
      const response = await api.get('/api/admin/review-queue?limit=5')
      setReviewItems(response.data)
    } catch (error) {
      console.error('Failed to fetch review queue:', error)
    } finally {
      setLoadingReviews(false)
    }
  }

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
      case 2: return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
      case 3: return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
    }
  }

  const getIssueTypeColor = (issueType: string) => {
    switch (issueType) {
      case 'LOW_CONFIDENCE': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
      case 'AMBIGUOUS_UNIT': return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
      case 'OCR_ERROR': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
    }
  }

  const handleLogout = () => {
    logout()
    router.push('/')
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
        <title>Admin Dashboard - QPaper AI</title>
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
              </div>
              <div className="flex items-center space-x-4">
                <ThemeToggle />
                <button
                  onClick={() => router.push('/admin/activity')}
                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center space-x-1"
                >
                  <ListBulletIcon className="h-4 w-4" />
                  <span>Activity History</span>
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-300">Welcome, {user?.username}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <button
                onClick={() => router.push('/admin/upload-question-paper')}
                className="card dark:bg-gray-800 dark:border-gray-700 hover:shadow-md transition-shadow duration-200 text-left"
              >
                <div className="flex items-center">
                  <DocumentTextIcon className="h-8 w-8 text-primary-600 dark:text-primary-400 mr-3" />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Upload Question Paper</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Add new question paper</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push('/admin/question-bank')}
                className="card dark:bg-gray-800 dark:border-gray-700 hover:shadow-md transition-shadow duration-200 text-left"
              >
                <div className="flex items-center">
                  <ListBulletIcon className="h-8 w-8 text-blue-600 dark:text-blue-400 mr-3" />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Question Bank</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">View and search all questions</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push('/admin/courses')}
                className="card dark:bg-gray-800 dark:border-gray-700 hover:shadow-md transition-shadow duration-200 text-left"
              >
                <div className="flex items-center">
                  <DocumentTextIcon className="h-8 w-8 text-purple-600 dark:text-purple-400 mr-3" />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Manage Courses</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Course management</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push('/admin/uploads')}
                className="card dark:bg-gray-800 dark:border-gray-700 hover:shadow-md transition-shadow duration-200 text-left"
              >
                <div className="flex items-center">
                  <DocumentTextIcon className="h-8 w-8 text-orange-600 dark:text-orange-400 mr-3" />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Manage Uploads</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">View, edit, delete uploads</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Statistics */}
          {stats && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="card dark:bg-gray-800 dark:border-gray-700">
                <div className="flex items-center">
                  <DocumentTextIcon className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Papers</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.total_papers}</p>
                  </div>
                </div>
              </div>

              <div className="card dark:bg-gray-800 dark:border-gray-700">
                <div className="flex items-center">
                  <QuestionMarkCircleIcon className="h-8 w-8 text-green-600 dark:text-green-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Questions</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.total_questions}</p>
                  </div>
                </div>
              </div>

              <div className="card dark:bg-gray-800 dark:border-gray-700">
                <div className="flex items-center">
                  <ClockIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Pending Reviews</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.pending_reviews}</p>
                  </div>
                </div>
              </div>

              <div className="card dark:bg-gray-800 dark:border-gray-700">
                <div className="flex items-center">
                  <ChartBarIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Active Courses</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {Object.keys(stats.course_breakdown).length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Review Queue */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Review Queue</h2>
              <button
                onClick={() => router.push('/admin/review')}
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 flex items-center space-x-1 transition-colors"
              >
                <span>View All</span>
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>
            {loadingReviews ? (
              <div className="card dark:bg-gray-800 dark:border-gray-700">
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 dark:border-primary-400 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Loading review queue...</p>
                </div>
              </div>
            ) : reviewItems.length > 0 ? (
              <div className="card dark:bg-gray-800 dark:border-gray-700">
                <div className="space-y-3">
                  {reviewItems.map((item) => (
                    <div
                      key={item.review_id}
                      className="p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => router.push('/admin/review')}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(item.priority)}`}>
                              Priority {item.priority}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getIssueTypeColor(item.issue_type)}`}>
                              {item.issue_type.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-900 dark:text-white line-clamp-2 mb-2">
                            {item.question_text}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(item.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <ArrowRightIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 ml-4 flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card dark:bg-gray-800 dark:border-gray-700">
                <div className="text-center py-8">
                  <QuestionMarkCircleIcon className="h-12 w-12 text-green-600 dark:text-green-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">All Caught Up!</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">No items in the review queue.</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
