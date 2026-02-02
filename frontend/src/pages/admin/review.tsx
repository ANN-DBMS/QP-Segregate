import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useAuth } from '../../hooks/useAuth'
import { useRouter } from 'next/router'
import { 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  PencilIcon,
  PhotoIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline'
import { api } from '../../utils/api'
import ThemeToggle from '../../components/ThemeToggle'
import toast from 'react-hot-toast'

interface ReviewItem {
  review_id: number
  question_id: number
  question_text: string
  issue_type: string
  suggested_correction: any
  priority: number
  created_at: string
  marks?: number
  bloom_level?: number
  bloom_category?: string
  unit_id?: number
  unit_name?: string
  unit_topics?: string[]  // Topics from the unit
  course_code?: string
  course_name?: string
  topic_tags?: string[]  // Topic tags assigned to the question
  image_path?: string
}

export default function AdminReview() {
  const { user } = useAuth()
  const router = useRouter()
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showImageUpload, setShowImageUpload] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<any>(null)
  const [editForm, setEditForm] = useState({
    question_text: '',
    unit_id: '',
    marks: '',
    bloom_taxonomy_level: '',
    bloom_category: '',
    topic_tags: '',  // Comma-separated
    answer_text: '',
    parent_question_id: ''
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [answerAssetFile, setAnswerAssetFile] = useState<File | null>(null)
  const [answerAssetCaption, setAnswerAssetCaption] = useState('')
  const [uploadingAnswerAsset, setUploadingAnswerAsset] = useState(false)
  const [units, setUnits] = useState<any[]>([])
  const [corrections, setCorrections] = useState({
    unit_id: '',
    bloom_level: '',
    marks: ''
  })

  useEffect(() => {
    if (!user) {
      router.push('/admin/login')
      return
    }

    fetchReviewQueue()
  }, [user, router])

  const fetchReviewQueue = async () => {
    try {
      const response = await api.get('/api/admin/review-queue')
      setReviewItems(response.data)
    } catch (error) {
      console.error('Failed to fetch review queue:', error)
      toast.error('Failed to load review queue')
    } finally {
      setLoading(false)
    }
  }

  const fetchQuestionDetails = async (questionId: number) => {
    try {
      // Get question details for editing
      const response = await api.get(`/api/admin/questions/${questionId}`)
      const question = response.data
      setEditingQuestion(question)
      
      // Parse topic tags
      let topicTagsStr = ''
      if (question.topic_tags) {
        try {
          const tags = typeof question.topic_tags === 'string' 
            ? JSON.parse(question.topic_tags) 
            : question.topic_tags
          topicTagsStr = Array.isArray(tags) ? tags.join(', ') : ''
        } catch {
          topicTagsStr = ''
        }
      }
      
      setEditForm({
        question_text: question.question_text || '',
        unit_id: question.unit_id?.toString() || '',
        marks: question.marks?.toString() || '',
        bloom_taxonomy_level: question.bloom_level?.toString() || '',
        bloom_category: question.bloom_category || '',
        topic_tags: topicTagsStr,
        answer_text: question.answer_text || '',
        parent_question_id: question.parent_question_id ? String(question.parent_question_id) : ''
      })
      
      // Fetch units for the course
      if (question.course_code) {
        try {
          const unitsResponse = await api.get(`/api/courses/${question.course_code}/units`)
          setUnits(unitsResponse.data)
        } catch {
          setUnits([])
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch question details:', error)
      toast.error('Failed to load question details')
    }
  }

  const handleEdit = async (questionId: number) => {
    try {
      await fetchQuestionDetails(questionId)
      setShowEditModal(true)
    } catch (error: any) {
      console.error('Failed to load question details:', error)
      toast.error('Failed to load question details for editing')
    }
  }

  const handleSaveEdit = async () => {
    if (!editingQuestion) return
    
    try {
      const payload: any = {}
      if (editForm.question_text) payload.question_text = editForm.question_text
      if (editForm.unit_id) payload.unit_id = parseInt(editForm.unit_id)
      if (editForm.marks) payload.marks = parseInt(editForm.marks)
      if (editForm.bloom_taxonomy_level) payload.bloom_taxonomy_level = parseInt(editForm.bloom_taxonomy_level)
      if (editForm.bloom_category) payload.bloom_category = editForm.bloom_category
      if (editForm.topic_tags) {
        payload.topic_tags = editForm.topic_tags.split(',').map((t: string) => t.trim()).filter((t: string) => t)
      }
      
      await api.put(`/api/admin/questions/${editingQuestion.question_id}`, payload)

      // Save answer text (optional; allow clearing)
      await api.put(`/api/admin/questions/${editingQuestion.question_id}/answer`, {
        answer_text: editForm.answer_text ?? ''
      })

      // Optional: override variant parent
      await api.put(`/api/admin/questions/${editingQuestion.question_id}/variant-parent`, {
        parent_question_id: editForm.parent_question_id ? parseInt(editForm.parent_question_id) : null
      })
      toast.success('Question updated successfully')
      setShowEditModal(false)
      setEditingQuestion(null)
      // Refresh review queue and selected item
      await fetchReviewQueue()
      // Reset selected item since it may have changed
      setSelectedItem(null)
    } catch (error: any) {
      console.error('Failed to update question:', error)
      toast.error(error.response?.data?.detail || 'Failed to update question')
    }
  }

  const handleUploadAnswerAsset = async () => {
    if (!editingQuestion || !answerAssetFile) {
      toast.error('Please select an answer image')
      return
    }
    setUploadingAnswerAsset(true)
    try {
      const fd = new FormData()
      fd.append('file', answerAssetFile)
      if (answerAssetCaption.trim()) fd.append('caption', answerAssetCaption.trim())

      await api.post(`/api/admin/questions/${editingQuestion.question_id}/answer/assets`, fd)
      toast.success('Answer image uploaded')
      setAnswerAssetFile(null)
      setAnswerAssetCaption('')
      await fetchQuestionDetails(editingQuestion.question_id)
    } catch (error: any) {
      console.error('Failed to upload answer image:', error)
      toast.error(error.response?.data?.detail || 'Failed to upload answer image')
    } finally {
      setUploadingAnswerAsset(false)
    }
  }

  const handleDeleteAnswerAsset = async (assetId: number) => {
    if (!editingQuestion) return
    try {
      await api.delete(`/api/admin/questions/${editingQuestion.question_id}/answer/assets/${assetId}`)
      toast.success('Answer image removed')
      await fetchQuestionDetails(editingQuestion.question_id)
    } catch (error: any) {
      console.error('Failed to delete answer image:', error)
      toast.error(error.response?.data?.detail || 'Failed to delete answer image')
    }
  }

  const handleImageUpload = async () => {
    if (!editingQuestion || !imageFile) {
      toast.error('Please select an image file')
      return
    }
    
    try {
      const formData = new FormData()
      formData.append('file', imageFile)
      
      // Don't set Content-Type header - axios will set it automatically with boundary
      await api.post(`/api/admin/questions/${editingQuestion.question_id}/image`, formData)
      toast.success('Image uploaded successfully')
      setShowImageUpload(false)
      setImageFile(null)
      // Refresh the question details and review queue
      await fetchQuestionDetails(editingQuestion.question_id)
      await fetchReviewQueue()
      // Update selected item if it's the same question to show the new image
      if (selectedItem && selectedItem.question_id === editingQuestion.question_id) {
        const updatedQuestion = await api.get(`/api/admin/questions/${editingQuestion.question_id}`)
        setSelectedItem(prev => prev ? {
          ...prev,
          image_path: updatedQuestion.data.image_path
        } : null)
      }
    } catch (error: any) {
      console.error('Failed to upload image:', error)
      toast.error(error.response?.data?.detail || 'Failed to upload image')
    }
  }

  const handleApprove = async (questionId: number, approved: boolean) => {
    try {
      // Build request body - only include defined values
      const requestBody: any = { approved }
      if (approved) {
        if (corrections.unit_id) {
          requestBody.unit_id = parseInt(corrections.unit_id)
        }
        if (corrections.bloom_level) {
          requestBody.bloom_level = parseInt(corrections.bloom_level)
        }
        if (corrections.marks) {
          requestBody.marks = parseInt(corrections.marks)
        }
      }

      // Use the api utility to ensure correct backend URL
      const response = await api.put(`/api/admin/approve-question/${questionId}`, requestBody)
      
      // Response is already parsed by axios
      const responseData = response.data

      toast.success(approved ? 'Question approved successfully' : 'Question marked as corrected')
      
      // Refresh review queue to reflect changes
      await fetchReviewQueue()
      setSelectedItem(null)
    } catch (error: any) {
      console.error('Failed to approve question:', error)
      toast.error(error.message || 'Failed to approve question')
    }
  }

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'bg-red-100 text-red-800'
      case 2: return 'bg-yellow-100 text-yellow-800'
      case 3: return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getIssueTypeColor = (issueType: string) => {
    switch (issueType) {
      case 'LOW_CONFIDENCE': return 'bg-yellow-100 text-yellow-800'
      case 'AMBIGUOUS_UNIT': return 'bg-blue-100 text-blue-800'
      case 'OCR_ERROR': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (!user) {
    return null
  }

  return (
    <>
      <Head>
        <title>Review Queue - QPaper AI</title>
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <button
                  onClick={() => router.push('/admin/dashboard')}
                  className="text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 mr-4 transition-colors"
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Review Queue</h1>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {reviewItems.length} items pending review
                </div>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 dark:border-primary-400 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading review queue...</p>
            </div>
          ) : reviewItems.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Review Items List */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Items to Review</h2>
                {reviewItems.map((item) => (
                  <div
                    key={item.review_id}
                    className={`card dark:bg-gray-800 dark:border-gray-700 cursor-pointer transition-colors duration-200 ${
                      selectedItem?.review_id === item.review_id
                        ? 'ring-2 ring-primary-500 dark:ring-primary-400 bg-primary-50 dark:bg-primary-900/20'
                        : 'hover:shadow-md'
                    }`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(item.priority)}`}>
                            Priority {item.priority}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getIssueTypeColor(item.issue_type)}`}>
                            {item.issue_type.replace('_', ' ')}
                          </span>
                        </div>
                        {item.course_code && (
                          <span className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                            {item.course_code}
                            {item.course_name && ` - ${item.course_name}`}
                          </span>
                        )}
                        <p className="text-sm text-gray-900 dark:text-white line-clamp-3">
                          {item.question_text}
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                          {item.marks && (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                              {item.marks} marks
                            </span>
                          )}
                          {item.bloom_level && (
                            <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-1 rounded">
                              L{item.bloom_level}: {item.bloom_category || 'N/A'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Review Panel */}
              {selectedItem && (
                <div className="card dark:bg-gray-800 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Review Question</h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(selectedItem.question_id)}
                        className="p-2 text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded transition-colors"
                        title="Edit question"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => {
                          fetchQuestionDetails(selectedItem.question_id)
                          setShowImageUpload(true)
                        }}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        title="Upload image"
                      >
                        <PhotoIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setSelectedItem(null)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Question Text
                      </label>
                      <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                        {selectedItem.question_text}
                      </div>
                    </div>

                    {selectedItem.image_path && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Question Image
                        </label>
                        <img
                          src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/${selectedItem.image_path}`}
                          alt="Question"
                          className="max-w-full h-auto rounded border border-gray-300 dark:border-gray-600"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      {selectedItem.course_code && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Course Code
                          </label>
                          <div className="text-sm text-gray-900 dark:text-white">
                            {selectedItem.course_code}
                            {selectedItem.course_name && (
                              <span className="text-gray-600 dark:text-gray-400 ml-2">
                                - {selectedItem.course_name}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {selectedItem.unit_name && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Unit
                          </label>
                          <div className="text-sm text-gray-900 dark:text-white">
                            {selectedItem.unit_name}
                          </div>
                        </div>
                      )}
                      {selectedItem.marks !== undefined && selectedItem.marks !== null && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Marks
                          </label>
                          <div className="text-sm text-gray-900 dark:text-white">
                            {selectedItem.marks}
                          </div>
                        </div>
                      )}
                      {selectedItem.bloom_level && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Bloom's Taxonomy
                          </label>
                          <div className="text-sm text-gray-900 dark:text-white">
                            Level {selectedItem.bloom_level}: {selectedItem.bloom_category || 'N/A'}
                          </div>
                        </div>
                      )}
                    </div>

                    {selectedItem.unit_topics && selectedItem.unit_topics.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Unit Topics
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {selectedItem.unit_topics.map((topic: string, idx: number) => (
                            <span
                              key={idx}
                              className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedItem.topic_tags && selectedItem.topic_tags.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Question Topic Tags
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {selectedItem.topic_tags.map((tag: string, idx: number) => (
                            <span
                              key={idx}
                              className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Issue Type
                      </label>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getIssueTypeColor(selectedItem.issue_type)}`}>
                        {selectedItem.issue_type.replace('_', ' ')}
                      </span>
                    </div>

                    {selectedItem.suggested_correction && Object.keys(selectedItem.suggested_correction).length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Suggested Corrections
                        </label>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
                          <pre className="whitespace-pre-wrap text-gray-900 dark:text-white">
                            {JSON.stringify(selectedItem.suggested_correction, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Answer section - visible entry point to add/edit answer */}
                    <div className="p-4 rounded-lg border border-teal-200 dark:border-teal-700 bg-teal-50/50 dark:bg-teal-900/20">
                      <h3 className="text-sm font-semibold text-teal-800 dark:text-teal-200 mb-2">Answer</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Add or edit the question&apos;s answer text and images in the edit form.
                      </p>
                      <button
                        onClick={() => handleEdit(selectedItem.question_id)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-800/50 hover:bg-teal-200 dark:hover:bg-teal-800 rounded-lg transition-colors"
                      >
                        <PencilIcon className="h-4 w-4" />
                        Edit question (add / edit answer)
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Unit ID (Optional)
                        </label>
                        <input
                          type="number"
                          className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          value={corrections.unit_id}
                          onChange={(e) => setCorrections(prev => ({ ...prev, unit_id: e.target.value }))}
                          placeholder="Enter unit ID"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Bloom Level (Optional)
                        </label>
                        <select
                          className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          value={corrections.bloom_level}
                          onChange={(e) => setCorrections(prev => ({ ...prev, bloom_level: e.target.value }))}
                        >
                          <option value="">Select Bloom Level</option>
                          <option value="1">L1 - Remembering</option>
                          <option value="2">L2 - Understanding</option>
                          <option value="3">L3 - Applying</option>
                          <option value="4">L4 - Analyzing</option>
                          <option value="5">L5 - Evaluating</option>
                          <option value="6">L6 - Creating</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Marks (Optional)
                        </label>
                        <input
                          type="number"
                          className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          value={corrections.marks}
                          onChange={(e) => setCorrections(prev => ({ ...prev, marks: e.target.value }))}
                          placeholder="Enter marks"
                        />
                      </div>
                    </div>

                    <div className="flex space-x-3 pt-4">
                      <button
                        onClick={() => handleApprove(selectedItem.question_id, true)}
                        className="flex-1 btn-primary flex items-center justify-center"
                      >
                        <CheckCircleIcon className="h-4 w-4 mr-2" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleApprove(selectedItem.question_id, false)}
                        className="flex-1 btn-secondary flex items-center justify-center"
                      >
                        <XMarkIcon className="h-4 w-4 mr-2" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckCircleIcon className="h-16 w-16 text-green-600 dark:text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">All Caught Up!</h2>
              <p className="text-gray-600 dark:text-gray-400">No items in the review queue.</p>
            </div>
          )}
        </main>

        {/* Edit Question Modal */}
        {showEditModal && editingQuestion && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Question</h2>
                  <button
                    onClick={() => {
                      setShowEditModal(false)
                      setEditingQuestion(null)
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Question Text *
                    </label>
                    <textarea
                      rows={6}
                      className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full"
                      value={editForm.question_text}
                      onChange={(e) => setEditForm(prev => ({ ...prev, question_text: e.target.value }))}
                      required
                    />
                  </div>

                  {/* Answer section - placed high so it's visible without scrolling */}
                  <div className="p-4 rounded-lg border-2 border-teal-200 dark:border-teal-700 bg-teal-50/50 dark:bg-teal-900/20">
                    <h3 className="text-sm font-semibold text-teal-800 dark:text-teal-200 mb-3">Answer (optional)</h3>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Answer text
                      </label>
                      <textarea
                        rows={4}
                        className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full"
                        value={editForm.answer_text}
                        onChange={(e) => setEditForm(prev => ({ ...prev, answer_text: e.target.value }))}
                        placeholder="Type the answer/solution here (optional)"
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Answer images</h4>
                      {Array.isArray(editingQuestion.answer_assets) && editingQuestion.answer_assets.length > 0 ? (
                        <div className="space-y-3 mb-4">
                          {editingQuestion.answer_assets.map((asset: any) => (
                            <div key={asset.answer_asset_id} className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <img
                                  src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/${asset.file_path}`}
                                  alt={asset.caption || 'Answer image'}
                                  className="max-w-full h-auto max-h-32 rounded-lg border border-gray-200 dark:border-gray-700"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                                {asset.caption && (
                                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{asset.caption}</div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteAnswerAsset(asset.answer_asset_id)}
                                className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">No answer images yet.</p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Image file</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setAnswerAssetFile(e.target.files?.[0] || null)}
                            className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Caption (optional)</label>
                          <input
                            type="text"
                            value={answerAssetCaption}
                            onChange={(e) => setAnswerAssetCaption(e.target.value)}
                            className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full"
                            placeholder="e.g., diagram"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleUploadAnswerAsset}
                        disabled={uploadingAnswerAsset || !answerAssetFile}
                        className="mt-2 btn-secondary text-sm disabled:opacity-50"
                      >
                        {uploadingAnswerAsset ? 'Uploading...' : 'Upload answer image'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Unit
                      </label>
                      <select
                        className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full"
                        value={editForm.unit_id}
                        onChange={(e) => setEditForm(prev => ({ ...prev, unit_id: e.target.value }))}
                      >
                        <option value="">Select Unit</option>
                        {units.map(unit => (
                          <option key={unit.unit_id} value={unit.unit_id}>
                            Unit {unit.unit_number}: {unit.unit_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Marks
                      </label>
                      <input
                        type="number"
                        className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full"
                        value={editForm.marks}
                        onChange={(e) => setEditForm(prev => ({ ...prev, marks: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Bloom Taxonomy Level
                      </label>
                      <select
                        className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full"
                        value={editForm.bloom_taxonomy_level}
                        onChange={(e) => setEditForm(prev => ({ ...prev, bloom_taxonomy_level: e.target.value }))}
                      >
                        <option value="">Select Level</option>
                        <option value="1">L1 - Remembering</option>
                        <option value="2">L2 - Understanding</option>
                        <option value="3">L3 - Applying</option>
                        <option value="4">L4 - Analyzing</option>
                        <option value="5">L5 - Evaluating</option>
                        <option value="6">L6 - Creating</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Bloom Category
                      </label>
                      <input
                        type="text"
                        className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full"
                        value={editForm.bloom_category}
                        onChange={(e) => setEditForm(prev => ({ ...prev, bloom_category: e.target.value }))}
                        placeholder="e.g., Understanding"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Topic Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full"
                      value={editForm.topic_tags}
                      onChange={(e) => setEditForm(prev => ({ ...prev, topic_tags: e.target.value }))}
                      placeholder="e.g., Database concepts, SQL, Normalization"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Variant Group Parent (Optional)
                    </label>
                    <input
                      type="number"
                      className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full"
                      value={editForm.parent_question_id}
                      onChange={(e) => setEditForm(prev => ({ ...prev, parent_question_id: e.target.value }))}
                      placeholder="Canonical question ID (leave empty to make canonical)"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Use this to manually group reworded questions under one canonical question.
                    </p>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      onClick={() => {
                        setShowEditModal(false)
                        setEditingQuestion(null)
                        setAnswerAssetFile(null)
                        setAnswerAssetCaption('')
                      }}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="btn-primary"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Image Upload Modal */}
        {showImageUpload && editingQuestion && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Upload Question Image</h2>
                  <button
                    onClick={() => {
                      setShowImageUpload(false)
                      setImageFile(null)
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Image
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      className="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full"
                    />
                  </div>

                  {editingQuestion.image_path && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Current Image
                      </label>
                      <img
                        src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/${editingQuestion.image_path}`}
                        alt="Question image"
                        className="max-w-full h-auto rounded border border-gray-300 dark:border-gray-600"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>
                  )}

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      onClick={() => {
                        setShowImageUpload(false)
                        setImageFile(null)
                      }}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleImageUpload}
                      disabled={!imageFile}
                      className="btn-primary disabled:opacity-50"
                    >
                      Upload Image
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
