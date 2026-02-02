import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAuth } from '../../hooks/useAuth'
import { api } from '../../utils/api'
import ThemeToggle from '../../components/ThemeToggle'
import { 
  MagnifyingGlassIcon, 
  FunnelIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface Question {
  question_id: number
  question_text: string
  answer_text?: string
  marks?: number
  bloom_level?: number
  bloom_category?: string
  difficulty_level?: string
  course_code: string
  unit_name?: string
  exam_type: string
  academic_year: number
  semester_type: string
  exam_date?: string
  topic_tags?: string[]
  is_reviewed?: boolean
  review_status?: string
  image_path?: string
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
  topic_tags?: string[]
  review_status?: string  // 'all', 'reviewed', 'non-reviewed'
}

export default function AdminQuestionBank() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({
    course_codes: [],
    unit_ids: [],
    bloom_levels: [],
    exam_types: [],
    review_status: 'all'
  })
  const [courses, setCourses] = useState<any[]>([])
  const [totalResults, setTotalResults] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [openAnswers, setOpenAnswers] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      router.push('/admin/login')
      return
    }

    fetchCourses()
    // Show all questions on page load
    performSearch('')
    setIsInitialLoad(false)
  }, [user, router])

  const fetchCourses = async () => {
    try {
      const response = await api.get('/api/courses')
      setCourses(response.data)
    } catch (error) {
      console.error('Failed to fetch courses:', error)
    }
  }

  const performSearch = async (query: string = searchQuery) => {
    setLoading(true)
    try {
      const response = await api.post('/api/admin/questions/search', {
        query: query.trim() || '',
        filters,
        page: currentPage,
        limit: 20
      })

      setQuestions(response.data.questions)
      setTotalResults(response.data.total)
    } catch (error: any) {
      console.error('Search failed:', error)
      toast.error(error.response?.data?.detail || 'Failed to search questions')
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
    setCurrentPage(1)
  }

  // Trigger search when filters change (but not on initial mount)
  useEffect(() => {
    if (user && !isInitialLoad) {
      const timeoutId = setTimeout(() => {
        performSearch(searchQuery)
      }, 300) // Debounce filter changes
      return () => clearTimeout(timeoutId)
    }
  }, [filters])

  const clearFilters = () => {
    setFilters({
      course_codes: [],
      unit_ids: [],
      bloom_levels: [],
      exam_types: [],
      review_status: 'all'
    })
    setCurrentPage(1)
  }

  const getBloomLevelColor = (level?: number) => {
    if (!level) return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
    
    const colors = {
      1: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
      2: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
      3: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
      4: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
      5: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
      6: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
    }
    return colors[level as keyof typeof colors] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
  }

  const getDifficultyColor = (level?: string) => {
    switch (level) {
      case 'Easy': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
      case 'Medium': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
      case 'Hard': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
    }
  }

  if (!user || user.role !== 'ADMIN') {
    return null
  }

  return (
    <>
      <Head>
        <title>Question Bank - Admin - QPaper AI</title>
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/admin/dashboard')}
                  className="text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 transition-colors"
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Question Bank</h1>
              </div>
              <div className="flex items-center space-x-4">
                <ThemeToggle />
                <button
                  onClick={logout}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Search Form */}
          <div className="card mb-6">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search for questions (leave empty to browse all questions)"
                    className="input-field"
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
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setCurrentPage(1)
                    performSearch('')
                  }}
                  className="btn-secondary"
                  disabled={loading}
                >
                  Browse All
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

                {Object.values(filters).some(arr => Array.isArray(arr) ? arr.length > 0 : arr !== undefined && arr !== '' && arr !== 'all') && (
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
            <div className="card mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Filters</h3>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Course
                  </label>
                  <select
                    multiple
                    className="input-field"
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
                      className="input-field"
                      value={filters.marks_min || ''}
                      onChange={(e) => handleFilterChange('marks_min', e.target.value ? parseInt(e.target.value) : undefined)}
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      className="input-field"
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Review Status
                  </label>
                  <select
                    className="input-field"
                    value={filters.review_status || 'all'}
                    onChange={(e) => handleFilterChange('review_status', e.target.value)}
                  >
                    <option value="all">All Questions</option>
                    <option value="reviewed">Reviewed Only</option>
                    <option value="non-reviewed">Non-Reviewed Only</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 dark:border-primary-400 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Loading questions...</p>
              </div>
            ) : questions.length > 0 ? (
              <>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {totalResults} question{totalResults !== 1 ? 's' : ''} found
                    {!searchQuery.trim() && ' (showing all questions)'}
                  </p>
                </div>

                {questions.map((question) => (
                  <div key={question.question_id} className="card">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {question.course_code}
                          </span>
                          {question.unit_name && (
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              • {question.unit_name}
                            </span>
                          )}
                        </div>

                        <p className="text-gray-900 dark:text-white mb-3 line-clamp-3">
                          {question.question_text}
                        </p>

                        {question.topic_tags && question.topic_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {question.topic_tags.map((tag: string, idx: number) => (
                              <span
                                key={idx}
                                className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center flex-wrap gap-2 text-sm">
                          {question.marks && (
                            <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                              {question.marks} marks
                            </span>
                          )}
                          {question.bloom_level && (
                            <span className={`px-2 py-1 rounded ${getBloomLevelColor(question.bloom_level)}`}>
                              L{question.bloom_level}: {question.bloom_category}
                            </span>
                          )}
                          {question.difficulty_level && (
                            <span className={`px-2 py-1 rounded ${getDifficultyColor(question.difficulty_level)}`}>
                              {question.difficulty_level}
                            </span>
                          )}
                          {!question.is_reviewed && (
                            <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
                              Non-Reviewed
                            </span>
                          )}
                          {question.is_reviewed && question.review_status === 'APPROVED' && (
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                              Approved
                            </span>
                          )}
                          <span className="text-gray-600 dark:text-gray-400">
                            {question.exam_type} • Year {question.academic_year}
                          </span>
                        </div>

                        {question.image_path && (
                          <div className="mt-3">
                            <img
                              src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/${question.image_path}`}
                              alt="Question"
                              className="max-w-xs h-auto rounded border border-gray-300 dark:border-gray-600"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          </div>
                        )}
                        {question.answer_text && (
                          <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenAnswers((prev) => ({
                                  ...prev,
                                  [question.question_id]: !prev[question.question_id],
                                }))
                              }
                              className="flex items-center text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
                            >
                              {openAnswers[question.question_id] ? (
                                <ChevronUpIcon className="h-4 w-4 mr-1" />
                              ) : (
                                <ChevronDownIcon className="h-4 w-4 mr-1" />
                              )}
                              Answer
                            </button>
                            {openAnswers[question.question_id] && (
                              <div className="mt-3 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                {question.answer_text}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => router.push(`/admin/review?question=${question.question_id}`)}
                          className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 transition-colors"
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400">
                  {searchQuery ? 'No questions found for your search.' : 'No questions available. Try adjusting your filters.'}
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  )
}

