import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Image from 'next/image'
import { 
  MagnifyingGlassIcon, 
  FunnelIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '../hooks/useAuth'
import { api } from '../utils/api'
import ThemeToggle from '../components/ThemeToggle'
import toast from 'react-hot-toast'

interface Question {
  question_id: number
  question_text: string
  marks?: number
  bloom_level?: number
  course_code: string
  unit_name?: string
  exam_type: string
  academic_year: number
  semester_type: string
  exam_date?: string
  variant_count: number
}

interface SearchFilters {
  course_codes: string[]
  unit_ids: number[]
  marks_min?: number
  marks_max?: number
  bloom_levels: number[]
  exam_types: string[]
  year_from?: number
  year_to?: number
}

export default function QPaperAI() {
  const router = useRouter()
  const { user, loading: authLoading, logout } = useAuth()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({
    course_codes: [],
    unit_ids: [],
    bloom_levels: [],
    exam_types: []
  })
  const [courses, setCourses] = useState<any[]>([])
  const [totalResults, setTotalResults] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!authLoading && !user) {
      toast.error('Please login to access the question bank')
      router.push('/student/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    // Only fetch data if user is authenticated
    if (!user) return

    // Get search query from URL
    const { q } = router.query
    if (q && typeof q === 'string') {
      setSearchQuery(q)
      performSearch(q)
    }

    fetchCourses()
  }, [router, user])

  const fetchCourses = async () => {
    if (!user) return
    try {
      const response = await api.get('/api/courses')
      setCourses(response.data)
    } catch (error) {
      console.error('Failed to fetch courses:', error)
    }
  }

  const performSearch = async (query: string = searchQuery) => {
    if (!user || !query.trim()) return

    setLoading(true)
    try {
      const response = await api.post('/api/public/search', {
        query,
        filters,
        page: currentPage,
        limit: 20
      })

      setQuestions(response.data.questions)
      setTotalResults(response.data.total)
    } catch (error: any) {
      console.error('Search failed:', error)
      toast.error(error.response?.data?.detail || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    performSearch()
  }

  const handleFilterChange = (filterType: keyof SearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }))
  }

  const clearFilters = () => {
    setFilters({
      course_codes: [],
      unit_ids: [],
      bloom_levels: [],
      exam_types: []
    })
  }

  const getBloomLevelColor = (level?: number) => {
    if (!level) return 'bg-gray-100 text-gray-800'
    
    const colors = {
      1: 'bg-red-100 text-red-800',
      2: 'bg-orange-100 text-orange-800',
      3: 'bg-yellow-100 text-yellow-800',
      4: 'bg-blue-100 text-blue-800',
      5: 'bg-purple-100 text-purple-800',
      6: 'bg-green-100 text-green-800'
    }
    return colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  // Show nothing if not authenticated or still loading
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>QPaper AI - Search Questions</title>
        <meta name="description" content="Search and explore question papers using AI-powered search" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <Image
                  src="/logo.png"
                  alt="QPaper AI Logo"
                  width={150}
                  height={45}
                  className="h-auto"
                  style={{ width: 'auto', height: 'auto' }}
                  priority
                />
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/')}
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Home
                </button>
                {user.role === 'STUDENT' && (
                  <button
                    onClick={() => router.push('/student/dashboard')}
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Dashboard
                  </button>
                )}
                {user.role === 'ADMIN' && (
                  <button
                    onClick={() => router.push('/admin/dashboard')}
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Dashboard
                  </button>
                )}
                <div className="flex items-center space-x-3">
                  {user?.profile_picture_url ? (
                    <img
                      src={user.profile_picture_url}
                      alt={user?.display_name || user?.username}
                      className="h-8 w-8 rounded-full border-2 border-gray-200 dark:border-gray-600"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold text-sm">
                      {(user?.display_name || user?.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.display_name || user?.email?.split('@')[0] || user?.username}
                  </span>
                </div>
                <button
                  onClick={() => {
                    logout()
                    router.push('/')
                  }}
                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Logout
                </button>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Search Form */}
          <div className="card dark:bg-gray-800 dark:border-gray-700 mb-6">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search for questions (e.g., 'explain database joins')"
                    className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex items-center"
                >
                  <MagnifyingGlassIcon className="h-5 w-5 mr-2" />
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <FunnelIcon className="h-4 w-4 mr-2" />
                  Filters
                  {showFilters ? (
                    <ChevronUpIcon className="h-4 w-4 ml-1" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4 ml-1" />
                  )}
                </button>

                {Object.values(filters).some(arr => Array.isArray(arr) ? arr.length > 0 : arr !== undefined && arr !== '') && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="card dark:bg-gray-800 dark:border-gray-700 mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Filters</h3>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Course
                  </label>
                  <select
                    multiple
                    className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={filters.course_codes}
                    onChange={(e) => handleFilterChange('course_codes', Array.from(e.target.selectedOptions, option => option.value))}
                  >
                    {courses.map(course => (
                      <option key={course.course_code} value={course.course_code}>
                        {course.course_code} - {course.course_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Marks Range
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      placeholder="Min"
                      className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      value={filters.marks_min || ''}
                      onChange={(e) => handleFilterChange('marks_min', e.target.value ? parseInt(e.target.value) : undefined)}
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      value={filters.marks_max || ''}
                      onChange={(e) => handleFilterChange('marks_max', e.target.value ? parseInt(e.target.value) : undefined)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Bloom Level
                  </label>
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5, 6].map(level => (
                      <label key={level} className="flex items-center">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 dark:bg-gray-700"
                          checked={filters.bloom_levels.includes(level)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleFilterChange('bloom_levels', [...filters.bloom_levels, level])
                            } else {
                              handleFilterChange('bloom_levels', filters.bloom_levels.filter(l => l !== level))
                            }
                          }}
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">L{level}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Exam Type
                  </label>
                  <div className="space-y-2">
                    {['CIE 1', 'CIE 2', 'Improvement CIE', 'SEE'].map(type => (
                      <label key={type} className="flex items-center">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 dark:bg-gray-700"
                          checked={filters.exam_types.includes(type)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleFilterChange('exam_types', [...filters.exam_types, type])
                            } else {
                              handleFilterChange('exam_types', filters.exam_types.filter(t => t !== type))
                            }
                          }}
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-300">Searching questions...</p>
              </div>
            ) : questions.length > 0 ? (
              <>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {totalResults} questions found
                  </p>
                </div>

                {questions.map((question) => (
                  <div key={question.question_id} className="card dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {question.course_code}
                          </span>
                          {question.unit_name && (
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              • {question.unit_name}
                            </span>
                          )}
                        </div>

                        <p className="text-gray-900 dark:text-white mb-3 line-clamp-3">
                          {question.question_text}
                        </p>

                        <div className="flex items-center space-x-4 text-sm">
                          {question.marks && (
                            <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                              {question.marks} marks
                            </span>
                          )}
                          {question.bloom_level && (
                            <span className={`px-2 py-1 rounded ${getBloomLevelColor(question.bloom_level)}`}>
                              L{question.bloom_level}
                            </span>
                          )}
                          <span className="text-gray-600 dark:text-gray-300">
                            {question.exam_type} • {question.academic_year}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        {question.variant_count > 0 && (
                          <button className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 transition-colors">
                            +{question.variant_count} variants
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : searchQuery ? (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-300">No questions found for your search.</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-300">Enter a search query to find questions.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  )
}

