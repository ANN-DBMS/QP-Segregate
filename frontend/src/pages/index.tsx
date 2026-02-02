import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Image from 'next/image'
import { DocumentTextIcon, AcademicCapIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import ThemeToggle from '../components/ThemeToggle'
import { useTheme } from '../hooks/useTheme'

export default function Home() {
  const router = useRouter()
  const { resolvedTheme, mounted } = useTheme()
  const [userType, setUserType] = useState<'admin' | 'student' | null>(null)
  // Use fixed logo until mounted so server and client first paint match (avoids hydration error)
  const logoDark = mounted && resolvedTheme === 'dark'

  const handleLogin = (type: 'admin' | 'student') => {
    setUserType(type)
    router.push(`/${type}/login`)
  }

  return (
    <>
      <Head>
        <title>QPaper AI - Automated Question Paper Management</title>
        <meta name="description" content="Intelligent question paper extraction, classification, and management system" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-gray-900 dark:to-gray-800 transition-colors">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-4">
                <Image
                  src={logoDark ? '/RVlogodark.png' : '/RVlogolight.png'}
                  alt="RVCE Logo"
                  width={80}
                  height={80}
                  className="h-auto"
                  style={{ width: 'auto', height: 'auto' }}
                  priority
                />
                <Image
                  src="/logo.png"
                  alt="QPaper AI Logo"
                  width={200}
                  height={60}
                  className="h-auto"
                  style={{ width: 'auto', height: 'auto' }}
                  priority
                />
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => handleLogin('student')}
                  className="btn-primary"
                >
                  Student Login
                </button>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
              PYQ Insights for enhanced exam prep!
            </h2>
            <p className="mt-6 text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Extract, classify, and organize university question papers using AI-powered OCR, 
              NLP, and machine learning technologies.
            </p>
          </div>

          {/* Features */}
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="card text-center">
              <DocumentTextIcon className="h-12 w-12 text-primary-600 dark:text-primary-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Smart Extraction</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Automatically extract questions from scanned PDFs using advanced OCR technology
              </p>
            </div>

            <div className="card text-center">
              <AcademicCapIcon className="h-12 w-12 text-primary-600 dark:text-primary-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Intelligent Classification</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Classify questions by unit, Bloom taxonomy level, and difficulty automatically
              </p>
            </div>

            <div className="card text-center">
              <MagnifyingGlassIcon className="h-12 w-12 text-primary-600 dark:text-primary-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Semantic Search</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Find similar questions and detect duplicates using AI-powered similarity matching
              </p>
            </div>
          </div>

          {/* CTA Section */}
          <div className="mt-16 text-center">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Ready to get started?
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-8">
              Login to access the question bank and enhance your exam preparation
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => handleLogin('student')}
                className="btn-primary text-lg px-8 py-3"
              >
                Student Login
              </button>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white dark:bg-gray-800 border-t border-secondary-200 dark:border-gray-700 mt-16 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center text-gray-600 dark:text-gray-300">
              <p>&copy; Created by Ishita and Monal </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
