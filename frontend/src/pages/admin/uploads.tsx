import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAuth } from '../../hooks/useAuth'
import ThemeToggle from '../../components/ThemeToggle'
import { api } from '../../utils/api'
import { 
  DocumentTextIcon, 
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  FunnelIcon,
  DocumentPlusIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface Paper {
  paper_id: number
  course_code: string
  course_name?: string
  academic_year: number
  semester_type: string
  exam_type: string
  exam_date?: string
  pdf_path?: string
  answer_key_path?: string | null
  uploaded_by: number
  uploader_username?: string
  processing_status: string
  processing_progress: number
  total_questions_extracted: number
  file_size?: number
  page_count?: number
  created_at: string
}

export default function AdminUploads() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filterCourse, setFilterCourse] = useState('')
  const [filterFileType, setFilterFileType] = useState<'all' | 'question_paper' | 'syllabus'>('all')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null)
  const [editForm, setEditForm] = useState({
    course_code: '',
    academic_year: '',
    semester_type: '',
    exam_type: '',
    exam_date: ''
  })
  const [courses, setCourses] = useState<Array<{course_code: string, course_name: string}>>([])
  const [showQuestionsModal, setShowQuestionsModal] = useState(false)
  const [viewingPaperId, setViewingPaperId] = useState<number | null>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [openAnswers, setOpenAnswers] = useState<Record<number, boolean>>({})
  const [showAnswerSchemeModal, setShowAnswerSchemeModal] = useState(false)
  const [answerSchemePaper, setAnswerSchemePaper] = useState<Paper | null>(null)
  const [answerSchemeFile, setAnswerSchemeFile] = useState<File | null>(null)
  const [uploadingAnswerScheme, setUploadingAnswerScheme] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push('/admin/login')
      return
    }

    fetchUploads()
    fetchCourses()
  }, [user, router, page, filterCourse, filterFileType])

  const fetchCourses = async () => {
    try {
      const response = await api.get('/api/courses')
      setCourses(response.data.map((c: any) => ({ course_code: c.course_code, course_name: c.course_name })))
    } catch (error) {
      console.error('Failed to fetch courses:', error)
    }
  }

  const fetchUploads = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', '50')
      if (filterCourse) params.append('course_code', filterCourse)
      if (filterFileType !== 'all') params.append('file_type', filterFileType)
      
      const response = await api.get(`/api/admin/uploads?${params.toString()}`)
      setPapers(response.data)
      // Calculate total pages (assuming 50 per page for now)
      // In a real implementation, the API should return pagination info
    } catch (error: any) {
      console.error('Failed to fetch uploads:', error)
      toast.error(error.response?.data?.detail || 'Failed to load uploads')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (paper: Paper) => {
    setEditingPaper(paper)
    setEditForm({
      course_code: paper.course_code,
      academic_year: paper.academic_year.toString(),
      semester_type: paper.semester_type,
      exam_type: paper.exam_type,
      exam_date: paper.exam_date ? new Date(paper.exam_date).toISOString().split('T')[0] : ''
    })
    setShowEditModal(true)
  }

  const handleUpdate = async () => {
    if (!editingPaper) return

    try {
      const updateData: any = {}
      if (editForm.course_code !== editingPaper.course_code) updateData.course_code = editForm.course_code
      if (parseInt(editForm.academic_year) !== editingPaper.academic_year) updateData.academic_year = parseInt(editForm.academic_year)
      if (editForm.semester_type !== editingPaper.semester_type) updateData.semester_type = editForm.semester_type
      if (editForm.exam_type !== editingPaper.exam_type) updateData.exam_type = editForm.exam_type
      if (editForm.exam_date !== (editingPaper.exam_date ? new Date(editingPaper.exam_date).toISOString().split('T')[0] : '')) {
        updateData.exam_date = editForm.exam_date ? new Date(editForm.exam_date).toISOString() : null
      }

      await api.put(`/api/admin/uploads/${editingPaper.paper_id}`, updateData)
      toast.success('Upload updated successfully')
      setShowEditModal(false)
      fetchUploads()
    } catch (error: any) {
      console.error('Failed to update upload:', error)
      toast.error(error.response?.data?.detail || 'Failed to update upload')
    }
  }

  const handleViewQuestions = async (paperId: number) => {
    setViewingPaperId(paperId)
    setShowQuestionsModal(true)
    setLoadingQuestions(true)
    setQuestions([])
    
    try {
      const response = await api.get(`/api/admin/uploads/${paperId}/questions`)
      setQuestions(response.data.questions || [])
    } catch (error: any) {
      console.error('Failed to fetch questions:', error)
      toast.error(error.response?.data?.detail || 'Failed to load questions')
    } finally {
      setLoadingQuestions(false)
    }
  }

  const handleDelete = async (paperId: number, courseCode: string) => {
    if (!confirm(`Are you sure you want to delete this upload for ${courseCode}? This will also delete all associated questions.`)) {
      return
    }

    try {
      await api.delete(`/api/admin/uploads/${paperId}`)
      toast.success('Upload deleted successfully')
      fetchUploads()
    } catch (error: any) {
      console.error('Failed to delete upload:', error)
      toast.error(error.response?.data?.detail || 'Failed to delete upload')
    }
  }

  const openAnswerSchemeModal = (paper: Paper) => {
    setAnswerSchemePaper(paper)
    setAnswerSchemeFile(null)
    setShowAnswerSchemeModal(true)
  }

  const handleUploadAnswerScheme = async () => {
    if (!answerSchemePaper || !answerSchemeFile) {
      toast.error('Please select a PDF or DOC/DOCX file')
      return
    }
    const fn = answerSchemeFile.name.toLowerCase()
    if (!fn.endsWith('.pdf') && !fn.endsWith('.docx') && !fn.endsWith('.doc')) {
      toast.error('Answer scheme must be PDF or DOC/DOCX')
      return
    }
    setUploadingAnswerScheme(true)
    try {
      const formData = new FormData()
      formData.append('file', answerSchemeFile)
      await api.post(`/api/admin/papers/${answerSchemePaper.paper_id}/answer-key`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Answer scheme uploaded and linked to this question paper')
      setShowAnswerSchemeModal(false)
      setAnswerSchemePaper(null)
      setAnswerSchemeFile(null)
      fetchUploads()
    } catch (error: any) {
      console.error('Failed to upload answer scheme:', error)
      toast.error(error.response?.data?.detail || 'Failed to upload answer scheme')
    } finally {
      setUploadingAnswerScheme(false)
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
      case 'PROCESSING': return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
      case 'FAILED': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
      case 'METADATA_PENDING': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
    }
  }

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  if (loading && papers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-colors">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 dark:border-teal-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading uploads...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Manage Uploads - Admin Dashboard</title>
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/admin/dashboard')}
                  className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-semibold"
                >
                  ← Back to Dashboard
                </button>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Manage Uploads</h1>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/admin/activity')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  Activity History
                </button>
                <ThemeToggle />
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <div className="flex items-center space-x-4">
              <FunnelIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h2>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Course Code
                </label>
                <input
                  type="text"
                  value={filterCourse}
                  onChange={(e) => {
                    setFilterCourse(e.target.value.toUpperCase())
                    setPage(1)
                  }}
                  placeholder="Filter by course code"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  File Type
                </label>
                <select
                  value={filterFileType}
                  onChange={(e) => {
                    setFilterFileType(e.target.value as any)
                    setPage(1)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="all">All Types</option>
                  <option value="question_paper">Question Papers</option>
                  <option value="syllabus">Syllabi</option>
                </select>
              </div>
            </div>
          </div>

          {/* Uploads Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Course
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Academic Year / Semester
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Exam Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Questions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      File Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Answer Scheme
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Uploaded By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {papers.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        No uploads found
                      </td>
                    </tr>
                  ) : (
                    papers.map((paper) => (
                      <tr key={paper.paper_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {paper.course_code}
                          </div>
                          {paper.course_name && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {paper.course_name}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            Year {paper.academic_year}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {paper.semester_type}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {paper.exam_type}
                          </div>
                          {paper.exam_date && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {new Date(paper.exam_date).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(paper.processing_status)}`}>
                            {paper.processing_status}
                            {paper.processing_status === 'PROCESSING' && (
                              <span className="ml-1">({paper.processing_progress.toFixed(0)}%)</span>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {paper.total_questions_extracted}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {formatFileSize(paper.file_size)}
                          </div>
                          {paper.page_count && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {paper.page_count} pages
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {paper.answer_key_path ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                              <CheckCircleIcon className="h-4 w-4" />
                              Uploaded
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {paper.uploader_username || `User ${paper.uploaded_by}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {new Date(paper.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => openAnswerSchemeModal(paper)}
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 mr-4"
                            title={paper.answer_key_path ? 'Replace answer scheme' : 'Upload answer scheme'}
                          >
                            <DocumentPlusIcon className="h-5 w-5" />
                          </button>
                          {paper.total_questions_extracted > 0 && (
                            <button
                              onClick={() => handleViewQuestions(paper.paper_id)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-4"
                              title="View Questions"
                            >
                              <DocumentTextIcon className="h-5 w-5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(paper)}
                            className="text-teal-600 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 mr-4"
                            title="Edit"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(paper.paper_id, paper.course_code)}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                            title="Delete"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex justify-between items-center">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Page {page}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={papers.length < 50}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </main>

        {/* View Questions Modal */}
        {showQuestionsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Questions {viewingPaperId && `(Paper ID: ${viewingPaperId})`}
                  </h2>
                  <button
                    onClick={() => {
                      setShowQuestionsModal(false)
                      setViewingPaperId(null)
                      setQuestions([])
                      setOpenAnswers({})
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {loadingQuestions ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 dark:border-teal-400 mx-auto"></div>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">Loading questions...</p>
                  </div>
                ) : questions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No questions found for this paper.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Total: {questions.length} questions
                    </div>
                    {questions.map((q, idx) => (
                      <div key={q.question_id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              Q{q.question_number}
                            </span>
                            {q.marks && (
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                ({q.marks} marks)
                              </span>
                            )}
                            {q.unit_name && (
                              <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                                {q.unit_name}
                              </span>
                            )}
                            {!q.is_reviewed && (
                              <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
                                Non-Reviewed
                              </span>
                            )}
                          </div>
                          {q.bloom_level && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              Bloom: {q.bloom_level}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 mb-2 whitespace-pre-wrap">
                          {q.question_text}
                        </p>
                        {q.topic_tags && q.topic_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {q.topic_tags.map((tag: string, tagIdx: number) => (
                              <span key={tagIdx} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {q.classification_confidence !== null && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Confidence: {(q.classification_confidence * 100).toFixed(1)}%
                          </div>
                        )}
                        {q.answer_text && (
                          <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenAnswers((prev) => ({
                                  ...prev,
                                  [q.question_id]: !prev[q.question_id],
                                }))
                              }
                              className="flex items-center text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
                            >
                              {openAnswers[q.question_id] ? (
                                <ChevronUpIcon className="h-4 w-4 mr-1" />
                              ) : (
                                <ChevronDownIcon className="h-4 w-4 mr-1" />
                              )}
                              Answer
                            </button>
                            {openAnswers[q.question_id] && (
                              <div className="mt-3 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                {q.answer_text}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && editingPaper && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Upload</h2>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Course Code *
                    </label>
                    <select
                      value={editForm.course_code}
                      onChange={(e) => setEditForm({ ...editForm, course_code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 dark:bg-gray-700 dark:text-white"
                      required
                    >
                      <option value="">Select course</option>
                      {courses.map((course) => (
                        <option key={course.course_code} value={course.course_code}>
                          {course.course_code} - {course.course_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Academic Year *
                    </label>
                    <select
                      value={editForm.academic_year}
                      onChange={(e) => setEditForm({ ...editForm, academic_year: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 dark:bg-gray-700 dark:text-white"
                      required
                    >
                      <option value="">Select year</option>
                      <option value="1">Year 1</option>
                      <option value="2">Year 2</option>
                      <option value="3">Year 3</option>
                      <option value="4">Year 4</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Semester Type *
                    </label>
                    <select
                      value={editForm.semester_type}
                      onChange={(e) => setEditForm({ ...editForm, semester_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 dark:bg-gray-700 dark:text-white"
                      required
                    >
                      <option value="">Select semester</option>
                      <option value="ODD">ODD</option>
                      <option value="EVEN">EVEN</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Exam Type *
                    </label>
                    <select
                      value={editForm.exam_type}
                      onChange={(e) => setEditForm({ ...editForm, exam_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 dark:bg-gray-700 dark:text-white"
                      required
                    >
                      <option value="">Select exam type</option>
                      <option value="CIE 1">CIE 1</option>
                      <option value="CIE 2">CIE 2</option>
                      <option value="Improvement CIE">Improvement CIE</option>
                      <option value="SEE">SEE</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Exam Date
                    </label>
                    <input
                      type="date"
                      value={editForm.exam_date}
                      onChange={(e) => setEditForm({ ...editForm, exam_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdate}
                    className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md"
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Answer Scheme Modal */}
        {showAnswerSchemeModal && answerSchemePaper && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Upload Answer Scheme</h2>
                  <button
                    onClick={() => {
                      setShowAnswerSchemeModal(false)
                      setAnswerSchemePaper(null)
                      setAnswerSchemeFile(null)
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Link an answer scheme (PDF or DOC/DOCX) to this question paper: <strong className="text-gray-900 dark:text-white">{answerSchemePaper.course_code}</strong> — {answerSchemePaper.exam_type} (Year {answerSchemePaper.academic_year}, {answerSchemePaper.semester_type}).
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Answer scheme file (PDF, DOC, or DOCX)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setAnswerSchemeFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 dark:bg-gray-700 dark:text-white text-sm"
                  />
                  {answerSchemeFile && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Selected: {answerSchemeFile.name}
                    </p>
                  )}
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowAnswerSchemeModal(false)
                      setAnswerSchemePaper(null)
                      setAnswerSchemeFile(null)
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUploadAnswerScheme}
                    disabled={!answerSchemeFile || uploadingAnswerScheme}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingAnswerScheme ? 'Uploading…' : 'Upload & link'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

