import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAuth } from '../../hooks/useAuth'
import ThemeToggle from '../../components/ThemeToggle'
import { api } from '../../utils/api'
import { 
  MagnifyingGlassIcon, 
  BookmarkIcon, 
  FunnelIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface Question {
  question_id: number
  question_text: string
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
  paper_id?: number
  variant_count: number
  topic_tags?: string[]
  is_reviewed?: boolean
  review_status?: string
  image_path?: string
  answer_text?: string
  answer_assets?: { answer_asset_id: number; file_path: string; caption?: string | null; created_at?: string | null }[]
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

export default function StudentSearch() {
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
    review_status: 'all'  // Default to showing all questions (including non-reviewed)
  })
  const [courses, setCourses] = useState<any[]>([])
  const [availableUnits, setAvailableUnits] = useState<any[]>([])
  const [totalResults, setTotalResults] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [openAnswers, setOpenAnswers] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (!user) {
      router.push('/student/login')
      return
    }

    fetchCourses()

    // Get search query from URL
    const { q, course } = router.query
    if (q && typeof q === 'string') {
      setSearchQuery(q)
      performSearch(q)
    } else if (course && typeof course === 'string') {
      // If course filter is in URL, set it and show questions for that course
      setFilters(prev => ({
        ...prev,
        course_codes: [course]
      }))
      // Perform search with empty query to show all questions for the course
      setTimeout(() => performSearch(''), 100)
    } else {
      // Show all questions on page load (empty search)
      setTimeout(() => {
        performSearch('')
        setIsInitialLoad(false)
      }, 500)
    }
  }, [user, router])

  const fetchCourses = async () => {
    try {
      const response = await api.get('/api/courses')
      setCourses(Array.isArray(response.data) ? response.data : [])
    } catch (error: any) {
      console.error('Failed to fetch courses:', error)
      setCourses([])
    }
  }

  const fetchUnitsForCourses = async (courseCodes: string[]) => {
    if (courseCodes.length === 0) {
      setAvailableUnits([])
      return
    }
    
    try {
      // Fetch units for all selected courses
      const unitPromises = courseCodes.map(async (courseCode) => {
        try {
          const response = await api.get(`/api/courses/${courseCode}/units`)
          return response.data.map((unit: any) => ({
            ...unit,
            course_code: courseCode
          }))
        } catch (error) {
          console.error(`Failed to fetch units for ${courseCode}:`, error)
          return []
        }
      })
      
      const unitsArrays = await Promise.all(unitPromises)
      const allUnits = unitsArrays.flat()
      setAvailableUnits(allUnits)
    } catch (error: any) {
      console.error('Failed to fetch units:', error)
      setAvailableUnits([])
    }
  }

  const performSearch = async (query: string = searchQuery) => {
    setLoading(true)
    try {
      const response = await api.post('/api/student/search', {
        query: query.trim() || '',  // Allow empty query to show all questions
        filters: filters || {},
        page: currentPage,
        limit: 20
      })

      setQuestions(Array.isArray(response.data.questions) ? response.data.questions : [])
      setTotalResults(response.data.total || 0)
    } catch (error: any) {
      console.error('Search failed:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to search questions'
      toast.error(errorMessage)
      setQuestions([])
      setTotalResults(0)
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
    setFilters(prev => {
      const newFilters = {
        ...prev,
        [filterType]: value
      }
      
      // When course codes change, fetch units for those courses
      if (filterType === 'course_codes') {
        fetchUnitsForCourses(value)
        // Clear unit_ids when courses change
        newFilters.unit_ids = []
      }
      
      return newFilters
    })
    // Trigger search when filters change
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
      topic_tags: [],
      review_status: 'all'
    })
  }

  const bookmarkQuestion = async (questionId: number) => {
    try {
      await api.post(`/api/student/bookmark/${questionId}`)
      toast.success('Question bookmarked successfully!')
    } catch (error: any) {
      console.error('Failed to bookmark question:', error)
      if (error.response?.status === 400) {
        toast.error('Question is already bookmarked')
      } else {
        toast.error('Failed to bookmark question')
      }
    }
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

  if (!user) {
    return null
  }

  return (
    <>
      <Head>
        <title>Search Questions - QPaper AI</title>
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
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Search Questions</h1>
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
          {/* Search Form */}
          <div className="card mb-6 dark:bg-gray-800 dark:border-gray-700">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search for questions (leave empty to browse all questions)"
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
                <button
                  type="button"
                  onClick={async () => {
                    setSearchQuery('')
                    setCurrentPage(1)
                    setFilters({
                      course_codes: [],
                      unit_ids: [],
                      bloom_levels: [],
                      exam_types: [],
                      review_status: 'all'
                    })
                    await performSearch('')
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
                    size={5}
                  >
                    {courses.length > 0 ? (
                      courses.map(course => (
                        <option key={course.course_code} value={course.course_code}>
                          {course.course_code} - {course.course_name}
                        </option>
                      ))
                    ) : (
                      <option disabled>No courses available</option>
                    )}
                  </select>
                  {courses.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Loading courses...</p>
                  )}
                </div>

                {/* Units Filter - Only show when courses are selected */}
                {filters.course_codes.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Units
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableUnits.length > 0 ? (
                        availableUnits.map((unit) => (
                          <button
                            key={unit.unit_id}
                            type="button"
                            onClick={() => {
                              const isSelected = filters.unit_ids.includes(unit.unit_id)
                              if (isSelected) {
                                handleFilterChange('unit_ids', filters.unit_ids.filter(id => id !== unit.unit_id))
                              } else {
                                handleFilterChange('unit_ids', [...filters.unit_ids, unit.unit_id])
                              }
                            }}
                            className={`px-3 py-1 rounded-full text-sm transition-colors ${
                              filters.unit_ids.includes(unit.unit_id)
                                ? 'bg-primary-600 dark:bg-primary-500 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                          >
                            {unit.unit_name || `Unit ${unit.unit_number}`}
                          </button>
                        ))
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400">Loading units...</p>
                      )}
                    </div>
                    {filters.unit_ids.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleFilterChange('unit_ids', [])}
                        className="mt-2 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        Clear units
                      </button>
                    )}
                  </div>
                )}

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

                        <p className="text-gray-900 dark:text-gray-100 mb-3 line-clamp-3">
                          {question.question_text}
                        </p>

                        {question.image_path && (
                          <div className="mb-3">
                            <img
                              src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/${question.image_path}`}
                              alt="Question diagram"
                              className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700"
                              onError={(e) => {
                                // Hide image if it fails to load
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          </div>
                        )}

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
                          <span className="text-gray-600 dark:text-gray-400">
                            {question.exam_type} • Year {question.academic_year}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        {question.variant_count > 0 && (
                          <button className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 transition-colors">
                            +{question.variant_count} variants
                          </button>
                        )}
                        <button
                          onClick={() => bookmarkQuestion(question.question_id)}
                          className="text-gray-400 dark:text-gray-500 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors"
                        >
                          <BookmarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    {(question.answer_text || (question.answer_assets && question.answer_assets.length > 0)) && (
                      <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenAnswers((prev) => ({
                              ...prev,
                              [question.question_id]: !prev[question.question_id],
                            }))
                          }
                          className="flex items-center text-sm font-medium text-primary-700 dark:text-primary-300 hover:underline"
                        >
                          {openAnswers[question.question_id] ? (
                            <ChevronUpIcon className="h-4 w-4 mr-1" />
                          ) : (
                            <ChevronDownIcon className="h-4 w-4 mr-1" />
                          )}
                          Answer
                        </button>

                        {openAnswers[question.question_id] && (
                          <div className="mt-3 text-sm text-gray-800 dark:text-gray-200 space-y-3">
                            {question.answer_text && (
                              <div className="whitespace-pre-wrap">{question.answer_text}</div>
                            )}
                            {question.answer_assets && question.answer_assets.length > 0 && (
                              <div className="space-y-3">
                                {question.answer_assets.map((asset) => (
                                  <div key={asset.answer_asset_id}>
                                    <img
                                      src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/${asset.file_path}`}
                                      alt={asset.caption || 'Answer image'}
                                      className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none'
                                      }}
                                    />
                                    {asset.caption && (
                                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{asset.caption}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
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
