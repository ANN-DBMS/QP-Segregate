import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth } from '../../hooks/useAuth'
import { api } from '../../utils/api'
import ThemeToggle from '../../components/ThemeToggle'
import { 
  BookmarkIcon, 
  TrashIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface Bookmark {
  bookmark_id: number
  question_id: number
  question: {
    question_id: number
    question_text: string
    answer_text?: string
    marks?: number
    bloom_level?: number
    bloom_category?: string
    course_code: string
    unit_name?: string
    exam_type: string
    academic_year: number
    semester_type: string
    topic_tags?: string[]
    is_reviewed: boolean
    review_status?: string
  }
  notes?: string
  created_at: string
}

export default function StudentBookmarks() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [openAnswers, setOpenAnswers] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (!user) {
      router.push('/student/login')
      return
    }
    fetchBookmarks()
  }, [user, router])

  const fetchBookmarks = async () => {
    try {
      const response = await api.get('/api/student/bookmarks')
      setBookmarks(response.data)
    } catch (error: any) {
      console.error('Failed to fetch bookmarks:', error)
      toast.error('Failed to load bookmarks')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveBookmark = async (bookmarkId: number, questionId: number) => {
    try {
      await api.delete(`/api/student/bookmark/${questionId}`)
      setBookmarks(prev => prev.filter(b => b.bookmark_id !== bookmarkId))
      toast.success('Bookmark removed')
    } catch (error: any) {
      console.error('Failed to remove bookmark:', error)
      toast.error(error.response?.data?.detail || 'Failed to remove bookmark')
    }
  }

  const filteredBookmarks = bookmarks.filter(bookmark => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      bookmark.question.question_text.toLowerCase().includes(query) ||
      bookmark.question.course_code.toLowerCase().includes(query) ||
      bookmark.question.unit_name?.toLowerCase().includes(query) ||
      bookmark.notes?.toLowerCase().includes(query)
    )
  })

  if (!user) {
    return null
  }

  return (
    <>
      <Head>
        <title>My Bookmarks - QPaper AI</title>
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/student/dashboard')}
                  className="text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 transition-colors"
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Bookmarks</h1>
              </div>
              <div className="flex items-center space-x-4">
                <ThemeToggle />
                <button
                  onClick={logout}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search bookmarks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 dark:border-primary-400 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading bookmarks...</p>
            </div>
          ) : filteredBookmarks.length === 0 ? (
            <div className="text-center py-12">
              <BookmarkIcon className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {searchQuery ? 'No matching bookmarks' : 'No bookmarks yet'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {searchQuery 
                  ? 'Try adjusting your search query'
                  : 'Start bookmarking questions to save them for later'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => router.push('/student/search')}
                  className="btn-primary"
                >
                  Search Questions
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {filteredBookmarks.length} bookmark{filteredBookmarks.length !== 1 ? 's' : ''}
              </div>
              {filteredBookmarks.map((bookmark) => (
                <div
                  key={bookmark.bookmark_id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {bookmark.question.course_code}
                        </span>
                        {bookmark.question.unit_name && (
                          <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                            {bookmark.question.unit_name}
                          </span>
                        )}
                        {bookmark.question.marks && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {bookmark.question.marks} marks
                          </span>
                        )}
                        {!bookmark.question.is_reviewed && (
                          <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
                            Non-Reviewed
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
                        {bookmark.question.question_text}
                      </p>
                      {bookmark.question.topic_tags && bookmark.question.topic_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {bookmark.question.topic_tags.map((tag: string, idx: number) => (
                            <span
                              key={idx}
                              className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {bookmark.notes && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium">Notes:</span> {bookmark.notes}
                          </p>
                        </div>
                      )}
                      {bookmark.question.answer_text && (
                        <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenAnswers((prev) => ({
                                ...prev,
                                [bookmark.question.question_id]: !prev[bookmark.question.question_id],
                              }))
                            }
                            className="flex items-center text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
                          >
                            {openAnswers[bookmark.question.question_id] ? (
                              <ChevronUpIcon className="h-4 w-4 mr-1" />
                            ) : (
                              <ChevronDownIcon className="h-4 w-4 mr-1" />
                            )}
                            Answer
                          </button>
                          {openAnswers[bookmark.question.question_id] && (
                            <div className="mt-3 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                              {bookmark.question.answer_text}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                        Bookmarked on {new Date(bookmark.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveBookmark(bookmark.bookmark_id, bookmark.question_id)}
                      className="ml-4 p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="Remove bookmark"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  )
}

