import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeIn } from 'react-native-reanimated'
import { useRouter } from 'expo-router'

import { ThemedText } from '@/components/themed-text'
import { Colors } from '@/constants/theme'
import { useAuth } from '@/lib/auth'

const C = Colors.light
const isWeb = Platform.OS === 'web'

export default function StartPage() {
  const router = useRouter()
  const { userId, loading: authLoading, signIn, signUp, signInWithGoogle } = useAuth()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const passwordRef = useRef<TextInput>(null)

  useEffect(() => {
    if (!authLoading && userId) router.replace('/(app)')
  }, [authLoading, userId])

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Enter your email and password.')
      return
    }
    setError('')
    setLoading(true)
    try {
      if (mode === 'signup') {
        await signUp(email, password)
      } else {
        await signIn(email, password)
      }
      router.replace('/(app)')
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) return <View style={styles.page} />

  return (
    <View style={styles.page}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Animated.View entering={FadeIn.duration(1200).delay(200)}>
              <ThemedText serif style={[styles.title, { color: C.ink }]}>
                sudo
              </ThemedText>
            </Animated.View>
            <Animated.View entering={FadeIn.duration(1200).delay(900)}>
              <ThemedText serif style={[styles.tagline, { color: C.graphite }]}>
                the personal intelligence that knows you
              </ThemedText>
            </Animated.View>
          </View>

          {/* Form */}
          <Animated.View
            entering={FadeIn.duration(1200).delay(1600)}
            style={styles.inputArea}
          >
            <View style={styles.card}>
              <TextInput
                style={styles.input}
                placeholder="EMAIL"
                placeholderTextColor={C.pencil}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                value={email}
                onChangeText={(t) => { setEmail(t); setError('') }}
              />
              <TextInput
                ref={passwordRef}
                style={styles.input}
                placeholder="PASSWORD"
                placeholderTextColor={C.pencil}
                secureTextEntry
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
                value={password}
                onChangeText={(t) => { setPassword(t); setError('') }}
              />

              {error ? (
                <ThemedText style={styles.error}>{error}</ThemedText>
              ) : null}

              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                dataSet={{ hover: 'solid' }}
                style={({ pressed }) => [
                  styles.submitBtn,
                  pressed && styles.submitBtnPressed,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={C.pencil} size="small" />
                ) : (
                  <ThemedText style={[styles.submitText, { color: C.parchment }]}>
                    {mode === 'signup' ? 'Sign Up' : 'Sign In'}
                  </ThemedText>
                )}
              </Pressable>

              <ThemedText style={[styles.dividerText, { color: C.pencil }]}>or</ThemedText>

              <Pressable
                onPress={handleGoogle}
                dataSet={{ hover: 'ghost' }}
                style={({ pressed }) => [
                  styles.googleBtn,
                  pressed && styles.googleBtnPressed,
                ]}
              >
                <View style={styles.googleInner}>
                  {isWeb && React.createElement('div', {
                    style: { width: 18, height: 18, flexShrink: 0 },
                    dangerouslySetInnerHTML: { __html: '<svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 001 12c0 1.94.46 3.77 1.18 5.41l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>' },
                  })}
                  <ThemedText style={[styles.googleText, { color: C.fadedInk }]}>
                    Continue with Google
                  </ThemedText>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin')
                  setError('')
                }}
                dataSet={{ hover: 'darken' }}
                style={({ pressed }) => [
                  styles.ghost,
                  pressed && styles.ghostPressed,
                ]}
              >
                <ThemedText type="small" style={{ color: C.pencil }}>
                  {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                </ThemedText>
              </Pressable>

            </View>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: C.parchment,
    ...(isWeb && { minHeight: '100vh' } as any),
  },
  safe: {
    flex: 1,
    zIndex: 2,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  title: {
    fontSize: 72,
    fontWeight: '400',
    textAlign: 'center',
    letterSpacing: -0.5,
    ...(isWeb && { fontFamily: 'var(--font-serif)' } as any),
  },
  tagline: {
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 20,
    textTransform: 'uppercase',
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },
  inputArea: {
    width: '100%',
    maxWidth: 340,
  },
  card: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  input: {
    width: '100%',
    fontSize: 11,
    color: C.ink,
    fontWeight: '400',
    letterSpacing: 1,
    borderBottomWidth: 1,
    borderBottomColor: C.ruledLine,
    paddingBottom: 6,
    ...(isWeb && {
      outlineStyle: 'none',
      fontFamily: 'var(--font-mono)',
    } as any),
  },
  error: {
    color: C.errorText,
    fontSize: 13,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  submitBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: C.ink,
    alignItems: 'center',
    ...(isWeb && { cursor: 'pointer', transition: 'opacity 150ms ease' } as any),
  },
  submitBtnPressed: {
    opacity: 0.8,
  },
  submitText: {
    fontSize: 14,
    fontWeight: '400',
    color: C.parchment,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  dividerText: {
    fontSize: 11,
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },
  googleBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: C.ruledLine,
    alignItems: 'center',
    ...(isWeb && { cursor: 'pointer', transition: 'border-color 150ms ease, background-color 150ms ease' } as any),
  },
  googleBtnPressed: {
    borderColor: C.graphite,
    backgroundColor: C.vellum,
  },
  googleInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  googleText: {
    fontSize: 14,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  ghost: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  ghostPressed: {
    backgroundColor: C.vellum,
  },
  legal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  legalText: {
    fontSize: 10,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  legalLink: {
    fontSize: 10,
    textDecorationLine: 'underline',
    ...(isWeb && { fontFamily: 'var(--font-display)', cursor: 'pointer' } as any),
  },
})
