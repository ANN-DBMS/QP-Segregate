import { useState, useEffect, createContext, useContext } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { api } from '../utils/api'

interface User {
  user_id: number
  username: string
  email: string
  role: string
  branch_id?: number
  academic_year?: number
  profile_picture_url?: string
  display_name?: string
}

interface AuthContextType {
  user: User | null
  login: (username: string, password: string, role?: string) => Promise<void>
  googleLogin: (googleToken: string) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Always start as null/true so server and client first paint match (avoids hydration error).
  // User is restored from localStorage in useEffect after mount.
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem('token')
    if (token) {
      // Verify token and get user info
      verifyToken()
    } else {
      // No token - clear any stale user data
      localStorage.removeItem('user')
      setUser(null)
      setLoading(false)
    }
  }, [])

  const verifyToken = async () => {
    try {
      const response = await api.get('/api/auth/me')
      const userData = response.data
      setUser(userData)
      // Store user data in localStorage for faster reloads
      localStorage.setItem('user', JSON.stringify(userData))
    } catch (error: any) {
      // Only remove token if it's actually invalid (401 Unauthorized)
      // Don't remove on network errors, timeouts, or server errors
      if (error.response?.status === 401) {
        // Token is invalid or expired - remove everything
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setUser(null)
      } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        // Network error - keep token and user data from localStorage
        // User state is already set from localStorage in useState initializer
        console.warn('Network error during token verification. Using cached user data.')
      } else {
        // Other errors (500, etc.) - keep token and user data
        console.error('Token verification error (non-401):', error)
        // User state remains from localStorage
      }
    } finally {
      setLoading(false)
    }
  }

  const login = async (username: string, password: string, role?: string) => {
    setLoading(true)
    try {
      // OAuth2PasswordRequestForm expects URL-encoded form data
      const params = new URLSearchParams()
      params.append('username', username)
      params.append('password', password)

      const response = await api.post('/api/auth/login', params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })

      const { access_token } = response.data
      localStorage.setItem('token', access_token)

      // Get user info
      const userResponse = await api.get('/api/auth/me')
      const userData = userResponse.data
      setUser(userData)
      // Store user data in localStorage
      localStorage.setItem('user', JSON.stringify(userData))
      toast.success('Login successful!')
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Login failed'
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }

  const googleLogin = async (googleToken: string) => {
    setLoading(true)
    try {
      const response = await api.post('/api/auth/google-login', {
        token: googleToken
      })

      const { access_token } = response.data
      localStorage.setItem('token', access_token)

      // Get user info
      const userResponse = await api.get('/api/auth/me')
      const userData = userResponse.data
      setUser(userData)
      // Store user data in localStorage
      localStorage.setItem('user', JSON.stringify(userData))
      toast.success('Login successful!')
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Google login failed'
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    toast.success('Logged out successfully')
  }

  return (
    <AuthContext.Provider value={{ user, login, googleLogin, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
