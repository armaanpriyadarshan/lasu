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
import { sendCode, verifyCode, authTelegram } from '@/lib/api'
import { formatToE164, formatPhone } from '@/lib/phone'

const C = Colors.light
const isWeb = Platform.OS === 'web'

// ── Main page ────────────────────────────────────────────────────────
export default function StartPage() {
  const router = useRouter()
  const { userId, loading: authLoading, signIn } = useAuth()

  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const codeRefs = useRef<(TextInput | null)[]>([])

  useEffect(() => {
    if (!authLoading && userId) router.replace('/(app)')
  }, [authLoading, userId])


  const handleSendCode = async () => {
    setError('')
    setLoading(true)
    try {
      await sendCode(formatToE164(phone))
      setStep('code')
    } catch {
      setError('Failed to send code. Check your number.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (codeValue: string) => {
    if (codeValue.length < 6) return
    setError('')
    setLoading(true)
    try {
      const result = await verifyCode(formatToE164(phone), codeValue)
      await signIn(result.user_id)
      router.replace('/(app)')
    } catch {
      setError('Invalid code. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCodeDigit = (text: string, i: number) => {
    const digits = code.split('')
    if (text) {
      digits[i] = text[text.length - 1]
      const joined = digits.join('')
      setCode(joined)
      if (joined.length === 6) {
        codeRefs.current[i]?.blur()
        setTimeout(() => handleVerifyCode(joined), 50)
      } else if (i < 5) {
        codeRefs.current[i + 1]?.focus()
      }
    } else {
      digits[i] = ''
      setCode(digits.join(''))
      if (i > 0) codeRefs.current[i - 1]?.focus()
    }
  }

  const handleTelegram = async () => {
    setError('')
    setLoading(true)
    try {
      const result = await authTelegram()
      await signIn(result.user_id)
      router.replace('/(app)')
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
                Lasu
              </ThemedText>
            </Animated.View>
            <Animated.View entering={FadeIn.duration(1200).delay(900)}>
              <ThemedText serif style={[styles.tagline, { color: C.graphite }]}>
                the personal intelligence that knows you
              </ThemedText>
            </Animated.View>
          </View>

          {/* Input */}
          <Animated.View
            entering={FadeIn.duration(1200).delay(1600)}
            style={styles.inputArea}
          >
            {step === 'phone' ? (
              <View key="phone" style={styles.card}>
                <View style={styles.phoneRow}>
                  <ThemedText style={[styles.prefix, { color: C.pencil }]}>
                    +1
                  </ThemedText>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="(555) 000-0000"
                    placeholderTextColor={C.pencil}
                    keyboardType="phone-pad"
                    returnKeyType="go"
                    onSubmitEditing={handleSendCode}
                    value={formatPhone(phone)}
                    onChangeText={(t) => {
                      setPhone(t.replace(/\D/g, '').slice(0, 10))
                      setError('')
                    }}
                    maxLength={14}
                    autoFocus
                  />
                  {loading ? (
                    <ActivityIndicator color={C.pencil} size="small" />
                  ) : (
                    <Pressable
                      onPress={handleSendCode}
                      style={({ pressed }) => [
                        styles.enterBtn,
                        pressed && styles.enterBtnPressed,
                      ]}
                    >
                      <ThemedText style={[styles.enterArrow, { color: C.pencil }]}>
                        ↵
                      </ThemedText>
                    </Pressable>
                  )}
                </View>

                {error ? (
                  <ThemedText style={styles.error}>{error}</ThemedText>
                ) : null}

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

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <ThemedText style={[styles.dividerText, { color: C.pencil }]}>or</ThemedText>
                  <View style={styles.dividerLine} />
                </View>

                <Pressable
                  onPress={handleTelegram}
                  style={({ pressed }) => [
                    styles.telegramBtn,
                    pressed && styles.telegramBtnPressed,
                  ]}
                >
                  <ThemedText style={[styles.telegramText, { color: C.fadedInk }]}>
                    Continue with Telegram
                  </ThemedText>
                </Pressable>
              </View>
            ) : (
              <View key="code" style={styles.card}>
                <ThemedText
                  type="small"
                  style={[styles.codeHint, { color: C.pencil }]}
                >
                  Code sent to +1 {formatPhone(phone)}
                </ThemedText>

                <View style={styles.codeRow}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <TextInput
                      key={i}
                      ref={(r) => {
                        codeRefs.current[i] = r
                      }}
                      style={[
                        styles.codeBox,
                        code[i] ? styles.codeBoxFill : styles.codeBoxEmpty,
                      ]}
                      keyboardType="number-pad"
                      maxLength={1}
                      value={code[i] ?? ''}
                      onChangeText={(t) => handleCodeDigit(t, i)}
                      autoFocus={i === 0}
                      selectTextOnFocus
                    />
                  ))}
                </View>

                {error ? (
                  <ThemedText style={styles.error}>{error}</ThemedText>
                ) : null}

                {loading ? (
                  <ActivityIndicator color={C.pencil} size="small" style={{ marginTop: 8 }} />
                ) : null}

                <Pressable
                  onPress={() => {
                    setStep('phone')
                    setCode('')
                    setError('')
                  }}
                  style={({ pressed }) => [
                    styles.ghost,
                    pressed && styles.ghostPressed,
                  ]}
                >
                  <ThemedText type="small" style={{ color: C.pencil }}>
                    Use a different number
                  </ThemedText>
                </Pressable>
              </View>
            )}
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

  // ── Header ──
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

  // ── Input area ──
  inputArea: {
    width: '100%',
    maxWidth: 340,
  },
  card: {
    width: '100%',
    gap: 16,
    alignItems: 'center',
  },

  // ── Phone ──
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: C.ruledLine,
    paddingBottom: 6,
  },
  prefix: {
    fontSize: 18,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  phoneInput: {
    flex: 1,
    fontSize: 18,
    color: C.ink,
    fontWeight: '400',
    ...(isWeb && {
      outlineStyle: 'none',
      fontFamily: 'var(--font-display)',
    } as any),
  },

  // ── Code ──
  codeHint: {
    textAlign: 'center',
    marginBottom: 4,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  codeBox: {
    width: 44,
    height: 50,
    borderRadius: 8,
    fontSize: 20,
    color: C.ink,
    textAlign: 'center',
    backgroundColor: C.agedPaper,
    ...(isWeb && {
      outlineStyle: 'none',
      fontFamily: 'var(--font-display)',
      transition: 'border-color 200ms ease',
    } as any),
  },
  codeBoxFill: {
    borderWidth: 2,
    borderColor: C.tide,
  },
  codeBoxEmpty: {
    borderWidth: 0.5,
    borderColor: C.ruledLine,
  },

  // ── Error ──
  error: {
    color: C.errorText,
    fontSize: 13,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },

  // ── Buttons ──
  enterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'background-color 150ms ease',
    } as any),
  },
  enterBtnPressed: {
    backgroundColor: C.vellum,
  },
  enterArrow: {
    fontSize: 22,
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },
  btnOff: {
    opacity: 0.35,
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

  // ── Divider ──
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: C.ruledLine,
  },
  dividerText: {
    fontSize: 11,
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },

  // ── Telegram ──
  telegramBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: C.ruledLine,
    alignItems: 'center',
    ...(isWeb && { cursor: 'pointer', transition: 'border-color 150ms ease' } as any),
  },
  telegramBtnPressed: {
    borderColor: C.graphite,
    backgroundColor: C.vellum,
  },
  telegramText: {
    fontSize: 14,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },

  // ── Legal ──
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
