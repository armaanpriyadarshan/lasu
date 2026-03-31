import AsyncStorage from '@react-native-async-storage/async-storage'
import React, { createContext, useContext, useEffect, useState } from 'react'

type AuthState = {
  userId: string | null
  loading: boolean
  signIn: (userId: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  userId: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    AsyncStorage.getItem('user_id').then((id) => {
      setUserId(id)
      setLoading(false)
    })
  }, [])

  const signIn = async (id: string) => {
    await AsyncStorage.setItem('user_id', id)
    setUserId(id)
  }

  const signOut = async () => {
    await AsyncStorage.removeItem('user_id')
    setUserId(null)
  }

  return (
    <AuthContext.Provider value={{ userId, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
