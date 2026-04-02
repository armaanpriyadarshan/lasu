import { useEffect, useState } from 'react'
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import { Redirect, Slot, usePathname, useRouter } from 'expo-router'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ThemedText } from '@/components/themed-text'
import { SvgIcon, type IconName } from '@/components/icons'
import { Colors } from '@/constants/theme'
import { useAuth } from '@/lib/auth'
import { getConfig, getMessages, getUser } from '@/lib/api'
import { formatE164Display } from '@/lib/phone'

const TELEGRAM_BOT = 'superuser_do_bot'

const isMobile = Platform.OS === 'ios' || Platform.OS === 'android'

const C = Colors.light
const isWeb = Platform.OS === 'web'

type NavItem = { key: string; label: string; icon: IconName }

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'dashboard', icon: 'grid' },
  { key: 'channels', label: 'channels', icon: 'globe' },
  { key: 'memory', label: 'memory', icon: 'bookmark' },
  { key: 'skills', label: 'skills', icon: 'star' },
  { key: 'settings', label: 'settings', icon: 'gear' },
]

export default function AppLayout() {
  const { userId, loading, signOut } = useAuth()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const isDesktop = width > 768
  const pathname = usePathname()
  const [hasMessages, setHasMessages] = useState<boolean | null>(null)
  const [smsNumber, setSmsNumber] = useState('')
  const [isTelegramUser, setIsTelegramUser] = useState(false)

  useEffect(() => {
    if (!userId) return
    getMessages(userId)
      .then(({ messages }) => setHasMessages(messages.length > 0))
      .catch(() => setHasMessages(false))
    getUser(userId)
      .then((u) => setIsTelegramUser(!u.phone_number))
      .catch(() => {})
  }, [userId])

  // Poll for first message while on setup
  useEffect(() => {
    if (!userId || hasMessages !== false) return
    if (!isTelegramUser) {
      getConfig().then((c) => setSmsNumber(c.sms_number)).catch(() => {})
    }
    const interval = setInterval(async () => {
      try {
        const { messages } = await getMessages(userId)
        if (messages.length > 0) setHasMessages(true)
      } catch {}
    }, 4000)
    return () => clearInterval(interval)
  }, [userId, hasMessages, isTelegramUser])

  const handleNumberPress = () => {
    Linking.openURL(`sms:${smsNumber}`)
  }

  const handleTelegramOpen = () => {
    Linking.openURL(`https://t.me/${TELEGRAM_BOT}?start=${userId}`)
  }

  const handleSignOut = async () => {
    router.replace('/')
    await signOut()
  }

  if (loading || hasMessages === null) return null
  if (!userId) return <Redirect href="/" />

  // No messages yet — show setup inline
  if (!hasMessages) {
    return (
      <View style={styles.shell}>
        <SafeAreaView style={styles.setupSafe}>
          <View style={styles.setupContent}>
            <Animated.View entering={FadeIn.duration(1200).delay(200)} style={styles.setupHeader}>
              <ThemedText serif style={[styles.setupTitle, { color: C.ink }]}>
                {isTelegramUser ? 'message sudo on telegram' : 'text sudo to get started'}
              </ThemedText>
              <ThemedText style={[styles.setupSubtitle, { color: C.graphite }]}>
                Say hi, ask a question, tell it about yourself.
              </ThemedText>
            </Animated.View>

            <Animated.View entering={FadeIn.duration(1200).delay(800)}>
              {isTelegramUser ? (
                <Pressable
                  onPress={handleTelegramOpen}
                  style={({ pressed }) => [
                    styles.setupNumberBtn,
                    pressed && styles.setupNumberBtnPressed,
                  ]}
                >
                  <ThemedText serif style={[styles.setupNumber, { color: C.ink }]}>
                    @{TELEGRAM_BOT}
                  </ThemedText>
                  <ThemedText style={[styles.setupAction, { color: C.pencil }]}>
                    open in telegram
                  </ThemedText>
                </Pressable>
              ) : smsNumber ? (
                <Pressable
                  onPress={handleNumberPress}
                  style={({ pressed }) => [
                    styles.setupNumberBtn,
                    pressed && styles.setupNumberBtnPressed,
                  ]}
                >
                  <ThemedText serif style={[styles.setupNumber, { color: C.ink }]}>
                    {formatE164Display(smsNumber)}
                  </ThemedText>
                  <ThemedText style={[styles.setupAction, { color: C.pencil }]}>
                    open in messages
                  </ThemedText>
                </Pressable>
              ) : null}
            </Animated.View>

            <Animated.View entering={FadeIn.duration(800).delay(2000)} style={styles.setupWaiting}>
              <View style={styles.setupDot} />
              <ThemedText style={[styles.setupWaitingText, { color: C.pencil }]}>
                Waiting for your first message
              </ThemedText>
            </Animated.View>
          </View>
        </SafeAreaView>
      </View>
    )
  }

  const activeKey = pathname === '/' || pathname === '/(app)' ? 'dashboard' : pathname.replace('/', '')

  return (
    <View style={[styles.shell, isDesktop && styles.shellDesktop]}>
      {isDesktop && (
        <View style={styles.sidebar}>
          {/* Logo */}
          <View style={styles.sidebarTop}>
            <ThemedText serif style={[styles.sidebarLogo, { color: C.ink }]}>
              sudo
            </ThemedText>
            <ThemedText style={[styles.sidebarSub, { color: C.pencil }]}>
              YOUR AI TWIN
            </ThemedText>
          </View>

          {/* Nav */}
          <View style={styles.sidebarNav}>
            {NAV_ITEMS.map((item) => {
              const active = item.key === activeKey
              return (
                <Pressable
                  key={item.key}

                  dataSet={!active ? { hover: 'vellum' } : undefined}
                  style={({ pressed }) => [
                    styles.navItem,
                    active && styles.navItemActive,
                    pressed && !active && styles.navItemHover,
                  ]}
                >
                  <SvgIcon name={item.icon} color={active ? C.ink : C.graphite} />
                  <ThemedText
                    style={[
                      styles.navText,
                      { color: active ? C.ink : C.graphite },
                      active && styles.navTextActive,
                    ]}
                  >
                    {item.label}
                  </ThemedText>
                </Pressable>
              )
            })}
          </View>

          {/* User */}
          <View style={styles.sidebarBottom}>
            <View style={styles.userDivider} />
            <View style={styles.userSection}>
              <View style={styles.userAvatar}>
                <ThemedText style={[styles.userInitial, { color: C.pencil }]}>A</ThemedText>
              </View>
              <View style={styles.userInfo}>
                <ThemedText style={[styles.userName, { color: C.fadedInk }]}>Armaan</ThemedText>
                <ThemedText style={[styles.userPlan, { color: C.pencil }]}>free tier</ThemedText>
              </View>
              <Pressable
                onPress={handleSignOut}

                dataSet={{ hover: 'dim' }}
                style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.5 }]}
              >
                <SvgIcon name="logout" />
              </Pressable>
            </View>
          </View>
        </View>
      )}

      <View style={styles.content}>
        <Slot />
      </View>

      {/* Bottom tab bar — mobile only */}
      {!isDesktop && (
        <View style={styles.tabBar}>
          {NAV_ITEMS.map((item) => {
            const active = item.key === activeKey
            return (
              <Pressable
                key={item.key}
                style={({ pressed }) => [
                  styles.tab,
                  pressed && { opacity: 0.5 },
                ]}
              >
                <SvgIcon svg={ICONS[item.icon as keyof typeof ICONS]} active={active} />
                <ThemedText
                  style={[
                    styles.tabLabel,
                    { color: active ? C.ink : C.pencil },
                  ]}
                >
                  {item.label}
                </ThemedText>
              </Pressable>
            )
          })}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: C.parchment,
    ...(isWeb && { minHeight: '100vh' } as any),
  },
  shellDesktop: {
    flexDirection: 'row',
  },
  sidebar: {
    width: 200,
    backgroundColor: C.agedPaper,
    paddingVertical: 24,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    ...(isWeb && {
      borderRightWidth: 0.5,
      borderRightColor: C.ruledLine,
    } as any),
  },
  sidebarTop: {
    gap: 2,
    marginBottom: 28,
  },
  sidebarLogo: {
    fontSize: 20,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-serif)' } as any),
  },
  sidebarSub: {
    fontSize: 10,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },
  sidebarNav: {
    gap: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'background-color 150ms ease',
    } as any),
  },
  navItemActive: {
    backgroundColor: C.vellum,
  },
  navItemHover: {
    backgroundColor: C.vellum,
  },
  navText: {
    fontSize: 13,
    fontWeight: '500',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  navTextActive: {
    fontWeight: '500',
  },
  sidebarBottom: {},
  userDivider: {
    height: 0.5,
    backgroundColor: C.ruledLine,
    marginBottom: 16,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userInfo: {
    flex: 1,
    gap: 0,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.ruledLine,
    backgroundColor: C.parchment,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInitial: {
    fontSize: 13,
    fontWeight: '500',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  userName: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  userPlan: {
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 13,
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },
  logoutBtn: {
    padding: 4,
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  content: {
    flex: 1,
    backgroundColor: C.parchment,
  },

  // ── Mobile tab bar ──
  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.parchment,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },

  // ── Setup (inline) ──
  setupSafe: {
    flex: 1,
  },
  setupContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  setupHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  setupTitle: {
    fontSize: 32,
    fontWeight: '400',
    textAlign: 'center',
    letterSpacing: -0.3,
    ...(isWeb && { fontFamily: 'var(--font-serif)' } as any),
  },
  setupSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  setupNumberBtn: {
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: C.ruledLine,
    borderRadius: 12,
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 32,
    backgroundColor: C.agedPaper,
    ...(isWeb && { cursor: 'pointer', transition: 'border-color 150ms ease' } as any),
  },
  setupNumberBtnPressed: {
    borderColor: C.graphite,
  },
  setupNumber: {
    fontSize: 26,
    fontWeight: '400',
    letterSpacing: 0.5,
    ...(isWeb && { fontFamily: 'var(--font-serif)' } as any),
  },
  setupAction: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 8,
    textTransform: 'uppercase',
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },
  setupWaiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 40,
  },
  setupDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.waxSeal,
  },
  setupWaitingText: {
    fontSize: 12,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },
})
