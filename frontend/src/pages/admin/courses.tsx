import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAuth } from '../../hooks/useAuth'
import ThemeToggle from '../../components/ThemeToggle'
import { api } from '../../utils/api'
import { 
  DocumentTextIcon, 
  AcademicCapIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface Course {
  course_code: string
  course_name: string
  credits: number
  course_type: string
  description?: string
}

interface CourseUnit {
  unit_id: number
  unit_number: number
  unit_name: string
  topics?: string
}

export default function AdminCourses() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set())
  const [courseUnits, setCourseUnits] = useState<Record<string, CourseUnit[]>>({})
  const [loadingUnits, setLoadingUnits] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [formData, setFormData] = useState({
    course_code: '',
    course_name: '',
    credits: 1,
    course_type: 'CORE',
    description: ''
  })
  const [editSyllabusFile, setEditSyllabusFile] = useState<File | null>(null)
  const [editAcademicYear, setEditAcademicYear] = useState('')
  const [editSemesterType, setEditSemesterType] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const editFileInputRef = useRef<HTMLInputElement>(null)
  
  // Units to add during course creation
  const [courseUnitsToAdd, setCourseUnitsToAdd] = useState<Array<{unit_number: number, unit_name: string, topics: string}>>([])
  
  // Units to add during course editing
  const [editCourseUnitsToAdd, setEditCourseUnitsToAdd] = useState<Array<{unit_number: number, unit_name: string, topics: string}>>([])
  
  // Unit management state
  const [showAddUnitModal, setShowAddUnitModal] = useState(false)
  const [showEditUnitModal, setShowEditUnitModal] = useState(false)
  const [editingUnit, setEditingUnit] = useState<CourseUnit | null>(null)
  const [currentCourseForUnit, setCurrentCourseForUnit] = useState<string>('')
  const [unitFormData, setUnitFormData] = useState({
    unit_number: 1,
    unit_name: '',
    topics: ''
  })

  useEffect(() => {
    if (!user) {
      router.push('/admin/login')
      return
    }

    fetchCourses()
  }, [user, router])

  const fetchCourses = async () => {
    try {
      const response = await api.get('/api/courses')
      setCourses(response.data)
    } catch (error) {
      console.error('Failed to fetch courses:', error)
      toast.error('Failed to load courses')
    } finally {
      setLoading(false)
    }
  }

  const fetchCourseUnits = async (courseCode: string) => {
    if (courseUnits[courseCode]) {
      // Units already loaded
      return
    }

    setLoadingUnits(prev => new Set(prev).add(courseCode))
    try {
      const response = await api.get(`/api/courses/${courseCode}/units`)
      setCourseUnits(prev => ({
        ...prev,
        [courseCode]: response.data
      }))
    } catch (error) {
      console.error(`Failed to fetch units for ${courseCode}:`, error)
      toast.error(`Failed to load units for ${courseCode}`)
    } finally {
      setLoadingUnits(prev => {
        const newSet = new Set(prev)
        newSet.delete(courseCode)
        return newSet
      })
    }
  }

  const toggleCourse = (courseCode: string) => {
    const newExpanded = new Set(expandedCourses)
    if (newExpanded.has(courseCode)) {
      newExpanded.delete(courseCode)
    } else {
      newExpanded.add(courseCode)
      fetchCourseUnits(courseCode)
    }
    setExpandedCourses(newExpanded)
  }

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  const getCourseTypeColor = (courseType: string) => {
    switch (courseType?.toUpperCase()) {
      case 'CORE':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
      case 'ELECTIVE':
        return 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
      case 'LAB':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
    }
  }

  const openAddModal = () => {
    setFormData({
      course_code: '',
      course_name: '',
      credits: 1,
      course_type: 'CORE',
      description: ''
    })
    setCourseUnitsToAdd([])
    setShowAddModal(true)
  }

  const openEditModal = async (course: Course) => {
    setEditingCourse(course)
    setFormData({
      course_code: course.course_code,
      course_name: course.course_name,
      credits: course.credits,
      course_type: course.course_type,
      description: course.description || ''
    })
    // Reset edit syllabus fields
    setEditSyllabusFile(null)
    setEditAcademicYear('')
    setEditSemesterType('')
    setEditCourseUnitsToAdd([])
    
    // Load existing units for this course
    try {
      const unitsResponse = await api.get(`/api/courses/${course.course_code}/units`)
      // Don't populate editCourseUnitsToAdd with existing units - they're already managed separately
      // This is just for adding NEW units during edit
    } catch (error) {
      // If no units exist, that's fine
      console.log('No existing units found for course')
    }
    
    setShowEditModal(true)
  }

  const closeModals = () => {
    setShowAddModal(false)
    setShowEditModal(false)
    setEditingCourse(null)
    setFormData({
      course_code: '',
      course_name: '',
      credits: 1,
      course_type: 'CORE',
      description: ''
    })
    setEditSyllabusFile(null)
    setEditAcademicYear('')
    setEditSemesterType('')
    setCourseUnitsToAdd([])
    setEditCourseUnitsToAdd([])
    if (editFileInputRef.current) {
      editFileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      if (showAddModal) {
        // Create new course with optional syllabus
        const formDataToSend = new FormData()
        formDataToSend.append('course_code', formData.course_code)
        formDataToSend.append('course_name', formData.course_name)
        formDataToSend.append('credits', formData.credits.toString())
        formDataToSend.append('course_type', formData.course_type)
        if (formData.description) {
          formDataToSend.append('description', formData.description)
        }
        
        const response = await api.post('/api/courses', formDataToSend, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
        
        // Add units if any were provided
        if (courseUnitsToAdd.length > 0) {
          try {
            const unitPromises = courseUnitsToAdd.map(unit => 
              api.post(`/api/courses/${formData.course_code}/units`, {
                unit_number: unit.unit_number,
                unit_name: unit.unit_name,
                topics: unit.topics || null
              })
            )
            await Promise.all(unitPromises)
            toast.success(`Course ${formData.course_code} created successfully with ${courseUnitsToAdd.length} unit(s)`)
          } catch (error: any) {
            toast.error(`Course created but failed to add some units: ${error.response?.data?.detail || error.message}`)
          }
        } else {
          toast.success(`Course ${formData.course_code} created successfully`)
        }
        
        // Add to list
        setCourses(prev => [...prev, response.data].sort((a, b) => a.course_code.localeCompare(b.course_code)))
        
        // If units were added, refresh the units list
        if (courseUnitsToAdd.length > 0) {
          try {
            const unitsResponse = await api.get(`/api/courses/${formData.course_code}/units`)
            setCourseUnits(prev => ({
              ...prev,
              [formData.course_code]: unitsResponse.data
            }))
          } catch (error) {
            // Silently fail - units will be loaded when course is expanded
          }
        }
        
        // Close modal and reset form
        closeModals()
      } else if (showEditModal && editingCourse) {
        // Update existing course
        const formDataToSend = new FormData()
        
        // Add course metadata
        if (formData.course_name !== editingCourse.course_name) {
          formDataToSend.append('course_name', formData.course_name)
        }
        if (formData.credits !== editingCourse.credits) {
          formDataToSend.append('credits', formData.credits.toString())
        }
        if (formData.course_type !== editingCourse.course_type) {
          formDataToSend.append('course_type', formData.course_type)
        }
        if (formData.description !== (editingCourse.description || '')) {
          formDataToSend.append('description', formData.description)
        }

        const response = await api.put(`/api/courses/${editingCourse.course_code}`, formDataToSend, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
        
        // Add units if any were provided
        if (editCourseUnitsToAdd.length > 0) {
          try {
            const unitPromises = editCourseUnitsToAdd.map(unit => 
              api.post(`/api/courses/${editingCourse.course_code}/units`, {
                unit_number: unit.unit_number,
                unit_name: unit.unit_name,
                topics: unit.topics || null
              })
            )
            await Promise.all(unitPromises)
            toast.success(`Course ${editingCourse.course_code} updated successfully with ${editCourseUnitsToAdd.length} new unit(s)`)
            
            // Refresh units for this course
            try {
              const unitsResponse = await api.get(`/api/courses/${editingCourse.course_code}/units`)
              setCourseUnits(prev => ({
                ...prev,
                [editingCourse.course_code]: unitsResponse.data
              }))
            } catch (error) {
              // Silently fail - units will be loaded when course is expanded
            }
          } catch (error: any) {
            toast.error(`Course updated but failed to add some units: ${error.response?.data?.detail || error.message}`)
          }
        } else {
          toast.success(`Course ${editingCourse.course_code} updated successfully`)
        }
        
        // Update in list
        setCourses(prev => prev.map(c => 
          c.course_code === editingCourse.course_code ? response.data : c
        ))
      }
      closeModals()
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to save course'
      toast.error(errorMessage)
      console.error('Save course error:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'credits' ? parseInt(value) || 1 : value
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-colors">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading courses...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Course Management - QPaper AI</title>
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
                  ← Back to Dashboard
                </button>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Course Management</h1>
              </div>
              <div className="flex items-center space-x-4">
                <ThemeToggle />
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
          {/* Actions */}
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                All Courses ({courses.length})
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                View and manage course information and units
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="btn-primary flex items-center space-x-2"
            >
              <PlusIcon className="h-5 w-5" />
              <span>Add Course</span>
            </button>
          </div>

          {/* Courses List */}
          <div className="space-y-4">
            {courses.length === 0 ? (
              <div className="card dark:bg-gray-800 dark:border-gray-700 text-center py-12">
                <AcademicCapIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-300">No courses found</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Add your first course to get started
                </p>
              </div>
            ) : (
              courses.map((course) => (
                <div
                  key={course.course_code}
                  className="card dark:bg-gray-800 dark:border-gray-700 overflow-hidden"
                >
                  {/* Course Header */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => toggleCourse(course.course_code)}
                  >
                    <div className="flex items-center space-x-4 flex-1">
                      {expandedCourses.has(course.course_code) ? (
                        <ChevronDownIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                      ) : (
                        <ChevronRightIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {course.course_code}
                          </h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getCourseTypeColor(course.course_type)}`}>
                            {course.course_type}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          {course.course_name}
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>{course.credits} Credits</span>
                          {course.description && (
                            <span className="truncate max-w-md">{course.description}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditModal(course)
                        }}
                        className="p-2 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Edit course"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (!confirm(`Are you sure you want to delete course ${course.course_code}? This action cannot be undone.`)) {
                            return
                          }
                          try {
                            await api.delete(`/api/courses/${course.course_code}`)
                            toast.success(`Course ${course.course_code} deleted successfully`)
                            // Remove from list
                            setCourses(prev => prev.filter(c => c.course_code !== course.course_code))
                            // Remove from expanded courses if it was expanded
                            setExpandedCourses(prev => {
                              const newSet = new Set(prev)
                              newSet.delete(course.course_code)
                              return newSet
                            })
                            // Remove units from state
                            setCourseUnits(prev => {
                              const newUnits = { ...prev }
                              delete newUnits[course.course_code]
                              return newUnits
                            })
                          } catch (error: any) {
                            const errorMessage = error.response?.data?.detail || error.message || 'Failed to delete course'
                            toast.error(errorMessage)
                            console.error('Delete course error:', error)
                          }
                        }}
                        className="p-2 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Delete course"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Course Units */}
                  {expandedCourses.has(course.course_code) && (
                    <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                            Course Units
                          </h4>
                          <button
                            onClick={() => {
                              setCurrentCourseForUnit(course.course_code)
                              setUnitFormData({ unit_number: 1, unit_name: '', topics: '' })
                              setShowAddUnitModal(true)
                            }}
                            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 flex items-center space-x-1"
                          >
                            <PlusIcon className="h-4 w-4" />
                            <span>Add Unit</span>
                          </button>
                        </div>

                        {loadingUnits.has(course.course_code) ? (
                          <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">Loading units...</p>
                          </div>
                        ) : courseUnits[course.course_code]?.length > 0 ? (
                          <div className="space-y-2">
                            {courseUnits[course.course_code].map((unit) => (
                              <div
                                key={unit.unit_id}
                                className="flex items-start justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                      Unit {unit.unit_number}
                                    </span>
                                    <span className="text-sm text-gray-600 dark:text-gray-300">
                                      {unit.unit_name}
                                    </span>
                                  </div>
                                  {unit.topics && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      {unit.topics}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2 ml-4">
                                  <button
                                    onClick={() => {
                                      setEditingUnit(unit)
                                      setCurrentCourseForUnit(course.course_code)
                                      setUnitFormData({
                                        unit_number: unit.unit_number,
                                        unit_name: unit.unit_name,
                                        topics: unit.topics || ''
                                      })
                                      setShowEditUnitModal(true)
                                    }}
                                    className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                    title="Edit unit"
                                  >
                                    <PencilIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (confirm(`Are you sure you want to delete Unit ${unit.unit_number}: ${unit.unit_name}?`)) {
                                        try {
                                          await api.delete(`/api/courses/${course.course_code}/units/${unit.unit_id}`)
                                          toast.success('Unit deleted successfully')
                                          // Refresh units
                                          setCourseUnits(prev => {
                                            const updated = { ...prev }
                                            updated[course.course_code] = updated[course.course_code]?.filter(u => u.unit_id !== unit.unit_id) || []
                                            return updated
                                          })
                                        } catch (error: any) {
                                          toast.error(error.response?.data?.detail || 'Failed to delete unit')
                                        }
                                      }
                                    }}
                                    className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                    title="Delete unit"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                            No units found for this course
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </main>

        {/* Add Course Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add New Course</h3>
                <button
                  onClick={closeModals}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label htmlFor="course_code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Course Code *
                  </label>
                  <input
                    type="text"
                    id="course_code"
                    name="course_code"
                    required
                    maxLength={10}
                    className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={formData.course_code}
                    onChange={handleInputChange}
                    placeholder="e.g., CS301"
                  />
                </div>
                <div>
                  <label htmlFor="course_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Course Name *
                  </label>
                  <input
                    type="text"
                    id="course_name"
                    name="course_name"
                    required
                    className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={formData.course_name}
                    onChange={handleInputChange}
                    placeholder="e.g., Database Management Systems"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="credits" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Credits *
                    </label>
                    <input
                      type="number"
                      id="credits"
                      name="credits"
                      required
                      min="1"
                      max="10"
                      className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      value={formData.credits}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <label htmlFor="course_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Course Type *
                    </label>
                    <select
                      id="course_type"
                      name="course_type"
                      required
                      className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      value={formData.course_type}
                      onChange={handleInputChange}
                    >
                      <option value="CORE">CORE</option>
                      <option value="ELECTIVE">ELECTIVE</option>
                      <option value="LAB">LAB</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Course description..."
                  />
                </div>

                {/* Add Units Section */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Course Units (Syllabus)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setCourseUnitsToAdd(prev => [...prev, {
                          unit_number: prev.length + 1,
                          unit_name: '',
                          topics: ''
                        }])
                      }}
                      className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 flex items-center space-x-1"
                    >
                      <PlusIcon className="h-4 w-4" />
                      <span>Add Unit</span>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Add units with unit number, unit name, and topics
                  </p>
                  
                  {courseUnitsToAdd.length > 0 && (
                    <div className="space-y-3">
                      {courseUnitsToAdd.map((unit, index) => (
                        <div key={index} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Unit {unit.unit_number}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setCourseUnitsToAdd(prev => prev.filter((_, i) => i !== index))
                              }}
                              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                  Unit #
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                  value={unit.unit_number}
                                  onChange={(e) => {
                                    const newUnits = [...courseUnitsToAdd]
                                    newUnits[index].unit_number = parseInt(e.target.value) || 1
                                    setCourseUnitsToAdd(newUnits)
                                  }}
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                  Unit Name
                                </label>
                                <input
                                  type="text"
                                  className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                  value={unit.unit_name}
                                  onChange={(e) => {
                                    const newUnits = [...courseUnitsToAdd]
                                    newUnits[index].unit_name = e.target.value
                                    setCourseUnitsToAdd(newUnits)
                                  }}
                                  placeholder="e.g., Introduction to Database Systems"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                Topics (comma-separated)
                              </label>
                              <textarea
                                rows={2}
                                className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                value={unit.topics}
                                onChange={(e) => {
                                  const newUnits = [...courseUnitsToAdd]
                                  newUnits[index].topics = e.target.value
                                  setCourseUnitsToAdd(newUnits)
                                }}
                                placeholder="e.g., Database concepts, Data models, DBMS architecture"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {courseUnitsToAdd.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                      No units added yet. Click "Add Unit" to add units for this course.
                    </p>
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModals}
                    className="btn-secondary"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? 'Saving...' : 'Create Course'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Course Modal */}
        {showEditModal && editingCourse && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Course</h3>
                <button
                  onClick={closeModals}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label htmlFor="edit_course_code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Course Code
                  </label>
                  <input
                    type="text"
                    id="edit_course_code"
                    className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={formData.course_code}
                    disabled
                    readOnly
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Course code cannot be changed</p>
                </div>
                <div>
                  <label htmlFor="edit_course_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Course Name *
                  </label>
                  <input
                    type="text"
                    id="edit_course_name"
                    name="course_name"
                    required
                    className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={formData.course_name}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="edit_credits" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Credits *
                    </label>
                    <input
                      type="number"
                      id="edit_credits"
                      name="credits"
                      required
                      min="1"
                      max="10"
                      className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      value={formData.credits}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <label htmlFor="edit_course_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Course Type *
                    </label>
                    <select
                      id="edit_course_type"
                      name="course_type"
                      required
                      className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      value={formData.course_type}
                      onChange={handleInputChange}
                    >
                      <option value="CORE">CORE</option>
                      <option value="ELECTIVE">ELECTIVE</option>
                      <option value="LAB">LAB</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="edit_description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    id="edit_description"
                    name="description"
                    rows={3}
                    className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={formData.description}
                    onChange={handleInputChange}
                  />
                </div>

                {/* Add Units Section */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Add New Units (Optional)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEditCourseUnitsToAdd(prev => [...prev, {
                          unit_number: prev.length + 1,
                          unit_name: '',
                          topics: ''
                        }])
                      }}
                      className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 flex items-center space-x-1"
                    >
                      <PlusIcon className="h-4 w-4" />
                      <span>Add Unit</span>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Add new units with unit number, unit name, and topics. Existing units can be managed from the course list below.
                  </p>
                  
                  {editCourseUnitsToAdd.length > 0 && (
                    <div className="space-y-3">
                      {editCourseUnitsToAdd.map((unit, index) => (
                        <div key={index} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Unit {unit.unit_number}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditCourseUnitsToAdd(prev => prev.filter((_, i) => i !== index))
                              }}
                              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                  Unit #
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                  value={unit.unit_number}
                                  onChange={(e) => {
                                    const newUnits = [...editCourseUnitsToAdd]
                                    newUnits[index].unit_number = parseInt(e.target.value) || 1
                                    setEditCourseUnitsToAdd(newUnits)
                                  }}
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                  Unit Name
                                </label>
                                <input
                                  type="text"
                                  className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                  value={unit.unit_name}
                                  onChange={(e) => {
                                    const newUnits = [...editCourseUnitsToAdd]
                                    newUnits[index].unit_name = e.target.value
                                    setEditCourseUnitsToAdd(newUnits)
                                  }}
                                  placeholder="e.g., Introduction to Database Systems"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                Topics (comma-separated)
                              </label>
                              <textarea
                                rows={2}
                                className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                value={unit.topics}
                                onChange={(e) => {
                                  const newUnits = [...editCourseUnitsToAdd]
                                  newUnits[index].topics = e.target.value
                                  setEditCourseUnitsToAdd(newUnits)
                                }}
                                placeholder="e.g., Database concepts, Data models, DBMS architecture"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {editCourseUnitsToAdd.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                      No new units to add. Click "Add Unit" to add units for this course.
                    </p>
                  )}
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModals}
                    className="btn-secondary"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? 'Saving...' : 'Update Course'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
        {/* Add Unit Modal */}
        {showAddUnitModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add New Unit</h3>
                <button
                  onClick={() => {
                    setShowAddUnitModal(false)
                    setUnitFormData({ unit_number: 1, unit_name: '', topics: '' })
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  try {
                    const response = await api.post(`/api/courses/${currentCourseForUnit}/units`, {
                      unit_number: unitFormData.unit_number,
                      unit_name: unitFormData.unit_name,
                      topics: unitFormData.topics || null
                    })
                    toast.success('Unit added successfully')
                    // Refresh units
                    setCourseUnits(prev => ({
                      ...prev,
                      [currentCourseForUnit]: [...(prev[currentCourseForUnit] || []), response.data].sort((a, b) => a.unit_number - b.unit_number)
                    }))
                    setShowAddUnitModal(false)
                    setUnitFormData({ unit_number: 1, unit_name: '', topics: '' })
                  } catch (error: any) {
                    toast.error(error.response?.data?.detail || 'Failed to add unit')
                  }
                }}
                className="p-6 space-y-4"
              >
                <div>
                  <label htmlFor="unit_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Unit Number *
                  </label>
                  <input
                    type="number"
                    id="unit_number"
                    required
                    min="1"
                    className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={unitFormData.unit_number}
                    onChange={(e) => setUnitFormData(prev => ({ ...prev, unit_number: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <label htmlFor="unit_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Unit Name *
                  </label>
                  <input
                    type="text"
                    id="unit_name"
                    required
                    className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={unitFormData.unit_name}
                    onChange={(e) => setUnitFormData(prev => ({ ...prev, unit_name: e.target.value }))}
                    placeholder="e.g., Introduction to Database Systems"
                  />
                </div>
                <div>
                  <label htmlFor="unit_topics" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Topics (comma-separated or JSON array)
                  </label>
                  <textarea
                    id="unit_topics"
                    rows={4}
                    className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={unitFormData.topics}
                    onChange={(e) => setUnitFormData(prev => ({ ...prev, topics: e.target.value }))}
                    placeholder="e.g., Database concepts, Data models, DBMS architecture, Data independence"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Enter topics as comma-separated text or JSON array format
                  </p>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddUnitModal(false)
                      setUnitFormData({ unit_number: 1, unit_name: '', topics: '' })
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
                  >
                    Add Unit
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Unit Modal */}
        {showEditUnitModal && editingUnit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Unit</h3>
                <button
                  onClick={() => {
                    setShowEditUnitModal(false)
                    setEditingUnit(null)
                    setUnitFormData({ unit_number: 1, unit_name: '', topics: '' })
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  try {
                    const response = await api.put(`/api/courses/${currentCourseForUnit}/units/${editingUnit.unit_id}`, {
                      unit_number: unitFormData.unit_number,
                      unit_name: unitFormData.unit_name,
                      topics: unitFormData.topics || null
                    })
                    toast.success('Unit updated successfully')
                    // Refresh units
                    setCourseUnits(prev => ({
                      ...prev,
                      [currentCourseForUnit]: (prev[currentCourseForUnit] || []).map(u => 
                        u.unit_id === editingUnit.unit_id ? response.data : u
                      ).sort((a, b) => a.unit_number - b.unit_number)
                    }))
                    setShowEditUnitModal(false)
                    setEditingUnit(null)
                    setUnitFormData({ unit_number: 1, unit_name: '', topics: '' })
                  } catch (error: any) {
                    toast.error(error.response?.data?.detail || 'Failed to update unit')
                  }
                }}
                className="p-6 space-y-4"
              >
                <div>
                  <label htmlFor="edit_unit_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Unit Number *
                  </label>
                  <input
                    type="number"
                    id="edit_unit_number"
                    required
                    min="1"
                    className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={unitFormData.unit_number}
                    onChange={(e) => setUnitFormData(prev => ({ ...prev, unit_number: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <label htmlFor="edit_unit_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Unit Name *
                  </label>
                  <input
                    type="text"
                    id="edit_unit_name"
                    required
                    className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={unitFormData.unit_name}
                    onChange={(e) => setUnitFormData(prev => ({ ...prev, unit_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="edit_unit_topics" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Topics (comma-separated or JSON array)
                  </label>
                  <textarea
                    id="edit_unit_topics"
                    rows={4}
                    className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={unitFormData.topics}
                    onChange={(e) => setUnitFormData(prev => ({ ...prev, topics: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditUnitModal(false)
                      setEditingUnit(null)
                      setUnitFormData({ unit_number: 1, unit_name: '', topics: '' })
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
                  >
                    Update Unit
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </>
  )
}

