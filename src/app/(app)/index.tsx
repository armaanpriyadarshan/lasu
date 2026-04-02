import { useCallback, useState } from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'

import { useFocusEffect, useRouter } from 'expo-router'
import { ThemedText } from '@/components/themed-text'
import { Colors } from '@/constants/theme'
import { useAuth } from '@/lib/auth'
import { listAgents, type Agent } from '@/lib/api'

const C = Colors.light
const isWeb = Platform.OS === 'web'

// ── Helpers ──────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function relativeTime(minutesAgo: number) {
  if (minutesAgo < 1) return 'just now'
  if (minutesAgo < 60) return `${minutesAgo}m ago`
  return `${Math.floor(minutesAgo / 60)}h ago`
}

// ── Mock data ────────────────────────────────────────────────────────

type ActivityItem = {
  id: string
  text: string
  minutesAgo: number
  dotColor: string
  badge?: { label: string; bg: string; text: string }
}

const ACTIVITY: ActivityItem[] = [
  {
    id: '1',
    text: 'Sent morning digest',
    minutesAgo: 2,
    dotColor: C.connectedText,
    badge: { label: 'delivered', bg: C.connected, text: C.connectedText },
  },
  {
    id: '2',
    text: 'Extracted 3 new memory facts from conversation',
    minutesAgo: 3,
    dotColor: C.connectedText,
  },
  {
    id: '3',
    text: 'Received message from user',
    minutesAgo: 4,
    dotColor: C.tide,
    badge: { label: 'inbound', bg: C.info, text: C.infoText },
  },
  {
    id: '4',
    text: 'Scheduled daily check-in for 6:00 PM',
    minutesAgo: 9,
    dotColor: C.tide,
    badge: { label: 'scheduled', bg: C.info, text: C.infoText },
  },
  {
    id: '5',
    text: 'Calendar sync completed — 4 events imported',
    minutesAgo: 34,
    dotColor: C.connectedText,
  },
  {
    id: '6',
    text: 'Awaiting approval: draft reply to Sarah',
    minutesAgo: 48,
    dotColor: C.waxSeal,
    badge: { label: 'awaiting approval', bg: C.warning, text: C.warningText },
  },
]

const CHANNELS = [
  { name: 'App', color: C.connectedText },
]

// ── Components ───────────────────────────────────────────────────────
function StatCard({ label, value, subtitle, positive, index }: {
  label: string; value: string; subtitle: string; positive: boolean; index: number
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(300).delay(100 + index * 80)}

      dataSet={{ hover: 'card' }}
      style={styles.statCard}
    >
      <ThemedText style={[styles.statLabel, { color: C.pencil }]}>{label}</ThemedText>
      <ThemedText style={[styles.statValue, { color: C.ink }]}>{value}</ThemedText>
      <ThemedText style={[styles.statSub, { color: positive ? '#1A6B47' : C.pencil }]}>
        {subtitle}
      </ThemedText>
    </Animated.View>
  )
}

function ActivityRow({ item, index }: { item: ActivityItem; index: number }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(250).delay(300 + index * 60)}

      dataSet={{ hover: 'card' }}
      style={styles.activityCard}
    >
      <View style={styles.activityInner}>
        <View style={[styles.activityDot, { backgroundColor: item.dotColor }]} />
        <View style={styles.activityContent}>
          <ThemedText style={[styles.activityText, { color: C.fadedInk }]}>
            {item.text}
          </ThemedText>
          <View style={styles.activityMeta}>
            <ThemedText style={[styles.activityTime, { color: C.pencil }]}>
              {relativeTime(item.minutesAgo)}
            </ThemedText>
            {item.badge && (
              <View style={[styles.badge, { backgroundColor: item.badge.bg }]}>
                <ThemedText style={[styles.badgeText, { color: item.badge.text }]}>
                  {item.badge.label}
                </ThemedText>
              </View>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  )
}

// ── Page ─────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { width } = useWindowDimensions()
  const isDesktop = width > 768
  const { userId } = useAuth()
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])

  useFocusEffect(
    useCallback(() => {
      if (!userId) return
      listAgents(userId)
        .then(({ agents }) => setAgents(agents))
        .catch(() => {})
    }, [userId])
  )

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.pageContent, isDesktop && styles.pageContentDesk]}
    >
      {/* Greeting */}
      <Animated.View entering={FadeIn.duration(500)} style={styles.greetingSection}>
        <ThemedText serif style={[styles.greeting, { color: C.ink }]}>
          {getGreeting()}
        </ThemedText>
        <View style={styles.statusLine}>
          <View style={styles.statusDot} />
          <ThemedText style={[styles.statusText, { color: C.pencil }]}>
            Sailing smoothly
          </ThemedText>
        </View>
      </Animated.View>

      {/* Stat cards */}
      <View style={[styles.statsGrid, isDesktop && styles.statsGridDesk]}>
        {[
          { label: 'Messages today', value: '—', subtitle: 'Coming soon', positive: false },
          { label: 'Active agents', value: String(agents.length), subtitle: agents.length === 0 ? 'Create your first' : 'Running', positive: agents.length > 0 },
          { label: 'Skills running', value: '0', subtitle: 'Coming soon', positive: false },
        ].map((stat, i) => (
          <StatCard key={stat.label} {...stat} index={i} />
        ))}
      </View>

      {/* Activity feed */}
      <View style={styles.feedSection}>
        <Animated.View entering={FadeIn.duration(400).delay(250)}>
          <ThemedText serif style={[styles.sectionTitle, { color: C.ink }]}>
            Today's log
          </ThemedText>
        </Animated.View>

        <View style={styles.feedList}>
          {ACTIVITY.map((item, i) => (
            <ActivityRow key={item.id} item={item} index={i} />
          ))}
        </View>
      </View>

      {/* Channel pills */}
      <View style={styles.channelSection}>
        {CHANNELS.map((ch) => (
          <View key={ch.name} dataSet={{ hover: 'card' }} style={styles.channelPill}>
            <View style={[styles.channelDot, { backgroundColor: ch.color }]} />
            <ThemedText style={[styles.channelText, { color: C.fadedInk }]}>
              {ch.name}
            </ThemedText>
          </View>
        ))}
        <Pressable

          dataSet={{ hover: 'vellum' }}
          style={({ pressed }) => [styles.channelPillAdd, pressed && { backgroundColor: C.vellum }]}
        >
          <ThemedText style={[styles.channelText, { color: C.pencil }]}>
            + Add channel
          </ThemedText>
        </Pressable>
      </View>
      {agents.length > 0 && (
        <View style={styles.channelSection}>
          {agents.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => router.push(`/chat/${a.id}`)}
              style={styles.channelPill}
            >
              <View style={[styles.channelDot, { backgroundColor: C.tide }]} />
              <ThemedText style={[styles.channelText, { color: C.fadedInk }]}>
                {a.name}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

// ── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: C.parchment,
  },
  pageContent: {
    padding: 24,
    paddingBottom: 80,
  },
  pageContentDesk: {
    padding: 28,
    paddingHorizontal: 32,
    maxWidth: 960,
  },

  // ── Greeting ──
  greetingSection: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-serif)' } as any),
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.connectedText,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },

  // ── Stats ──
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  statsGridDesk: {},
  statCard: {
    flex: 1,
    backgroundColor: C.agedPaper,
    borderWidth: 0.5,
    borderColor: C.ruledLine,
    borderRadius: 10,
    padding: 16,
    gap: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },
  statValue: {
    fontSize: 24,
    fontWeight: '500',
    marginTop: 4,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  statSub: {
    fontSize: 10,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },

  // ── Feed ──
  feedSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '400',
    marginBottom: 14,
    ...(isWeb && { fontFamily: 'var(--font-serif)' } as any),
  },
  feedList: {
    gap: 8,
  },
  activityCard: {
    backgroundColor: C.agedPaper,
    borderWidth: 0.5,
    borderColor: C.ruledLine,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...(isWeb && {
      transition: 'border-color 150ms ease',
    } as any),
  },
  activityInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 20,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  activityTime: {
    fontSize: 10,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '500',
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },

  // ── Channels ──
  channelSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  channelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.agedPaper,
    borderWidth: 0.5,
    borderColor: C.ruledLine,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  channelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  channelText: {
    fontSize: 12,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  channelPillAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: C.ruledLine,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    ...(isWeb && { cursor: 'pointer' } as any),
  },
})
