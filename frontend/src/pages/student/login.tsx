import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Image from 'next/image'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../../hooks/useAuth'
import ThemeToggle from '../../components/ThemeToggle'
import { useTheme } from '../../hooks/useTheme'

export default function StudentLogin() {
  const router = useRouter()
  const { googleLogin, loading } = useAuth()
  const { resolvedTheme } = useTheme()
  const [error, setError] = useState('')

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setError('')
    try {
      await googleLogin(credentialResponse.credential)
      router.push('/student/dashboard')
    } catch (err: any) {
      setError(err.message || 'Google login failed')
    }
  }

  const handleGoogleError = () => {
    setError('Google sign-in failed. Please try again.')
  }

  return (
    <>
      <Head>
        <title>Student Login - QPaper AI</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 transition-colors">
        <div className="max-w-md w-full space-y-8">
          <div className="flex justify-end">
            <ThemeToggle />
          </div>
          <div className="flex flex-col items-center">
            <Image
              src={resolvedTheme === 'dark' ? '/RVlogodark.png' : '/RVlogolight.png'}
              alt="RVCE Logo"
              width={100}
              height={100}
              className="h-auto mb-4"
              style={{ width: 'auto', height: 'auto' }}
              priority
            />
            <Image
              src="/logo.png"
              alt="QPaper AI Logo"
              width={250}
              height={75}
              className="h-auto mb-6"
              style={{ width: 'auto', height: 'auto' }}
              priority
            />
            <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white">
              Student Login
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300">
              Sign in with your RVCE Google account to access your question bank
            </p>
            <p className="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">
              Only @rvce.edu.in email addresses are allowed
            </p>
          </div>

          <div className="mt-8">
            <div className="card">
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="flex flex-col items-center justify-center space-y-4">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  useOneTap={false}
                  theme="outline"
                  size="large"
                  text="signin_with"
                  shape="rectangular"
                />
                
                {loading && (
                  <p className="text-sm text-gray-600">Signing in...</p>
                )}
              </div>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={() => router.push('/')}
              className="text-primary-600 hover:text-primary-500 text-sm"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
