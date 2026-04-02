import { useEffect, useRef, useState } from 'react'
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
                placeholder="email"
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
                placeholder="password"
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
                dataSet={{ hover: 'ghost' }}
                style={({ pressed }) => [
                  styles.submitBtn,
                  pressed && styles.submitBtnPressed,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={C.pencil} size="small" />
                ) : (
                  <ThemedText style={[styles.submitText, { color: C.fadedInk }]}>
                    {mode === 'signup' ? 'sign up' : 'sign in'}
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
                <ThemedText style={[styles.googleText, { color: C.fadedInk }]}>
                  continue with google
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin')
                  setError('')
                }}
                style={({ pressed }) => [
                  styles.ghost,
                  pressed && styles.ghostPressed,
                ]}
              >
                <ThemedText type="small" style={{ color: C.pencil }}>
                  {mode === 'signin' ? "don't have an account? sign up" : 'already have an account? sign in'}
                </ThemedText>
              </Pressable>

              <View style={styles.legal}>
                <ThemedText style={[styles.legalText, { color: C.ruledLine }]}>
                  By continuing, you agree to our{' '}
                </ThemedText>
                <Pressable
                  onPress={() => router.push('/terms')}
                  style={({ pressed }) => pressed && { opacity: 0.5 }}
                >
                  <ThemedText style={[styles.legalLink, { color: C.pencil }]}>
                    terms of service
                  </ThemedText>
                </Pressable>
                <ThemedText style={[styles.legalText, { color: C.ruledLine }]}>
                  {' '}and{' '}
                </ThemedText>
                <Pressable
                  onPress={() => router.push('/privacy')}
                  style={({ pressed }) => pressed && { opacity: 0.5 }}
                >
                  <ThemedText style={[styles.legalLink, { color: C.pencil }]}>
                    privacy policy
                  </ThemedText>
                </Pressable>
              </View>
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
    marginBottom: 48,
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
    marginTop: 32,
    textTransform: 'uppercase',
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },
  inputArea: {
    width: '100%',
    maxWidth: 340,
  },
  card: {
    width: '100%',
    gap: 16,
    alignItems: 'center',
  },
  input: {
    width: '100%',
    fontSize: 16,
    color: C.ink,
    fontWeight: '400',
    borderBottomWidth: 1,
    borderBottomColor: C.ruledLine,
    paddingBottom: 6,
    ...(isWeb && {
      outlineStyle: 'none',
      fontFamily: 'var(--font-display)',
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
