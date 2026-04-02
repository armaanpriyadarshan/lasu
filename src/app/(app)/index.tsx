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
import { getDashboard, listAgents, type Agent, type DashboardStats } from '@/lib/api'

const C = Colors.light
const isWeb = Platform.OS === 'web'

// ── Helpers ──────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
  return `${Math.floor(diff / 1440)}d ago`
}

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

// ── Page ─────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { width } = useWindowDimensions()
  const isDesktop = width > 768
  const { userId } = useAuth()
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (!userId) return
      listAgents(userId)
        .then(({ agents }) => setAgents(agents))
        .catch(() => {})
      getDashboard(userId)
        .then(setStats)
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
          <View style={[styles.statusDot, { backgroundColor: agents.length > 0 ? C.connectedText : C.pencil }]} />
          <ThemedText style={[styles.statusText, { color: C.pencil }]}>
            {agents.length > 0 ? `${agents.length} agent${agents.length > 1 ? 's' : ''} active` : 'No agents yet'}
          </ThemedText>
        </View>
      </Animated.View>

      {/* Stat cards */}
      <View style={[styles.statsGrid, isDesktop && styles.statsGridDesk]}>
        {[
          {
            label: 'Messages today',
            value: String(stats?.messages_today ?? 0),
            subtitle: stats?.messages_today ? 'Keep going' : 'Send your first',
            positive: (stats?.messages_today ?? 0) > 0,
          },
          {
            label: 'Active agents',
            value: String(stats?.active_agents ?? 0),
            subtitle: (stats?.active_agents ?? 0) === 0 ? 'Create your first' : 'Running',
            positive: (stats?.active_agents ?? 0) > 0,
          },
          {
            label: 'Memory facts',
            value: String(stats?.total_memories ?? 0),
            subtitle: (stats?.total_memories ?? 0) === 0 ? 'Chat to build memory' : 'Learned from you',
            positive: (stats?.total_memories ?? 0) > 0,
          },
        ].map((stat, i) => (
          <StatCard key={stat.label} {...stat} index={i} />
        ))}
      </View>

      {/* Activity feed */}
      <View style={styles.feedSection}>
        <Animated.View entering={FadeIn.duration(400).delay(250)}>
          <ThemedText serif style={[styles.sectionTitle, { color: C.ink }]}>
            Recent activity
          </ThemedText>
        </Animated.View>

        <View style={styles.feedList}>
          {stats?.activity && stats.activity.length > 0 ? (
            stats.activity.map((item, i) => (
              <Animated.View
                key={item.id}
                entering={FadeInDown.duration(250).delay(300 + i * 60)}
                dataSet={{ hover: 'card' }}
                style={styles.activityCard}
              >
                <View style={styles.activityInner}>
                  <View style={[styles.activityDot, {
                    backgroundColor: item.role === 'assistant' ? C.connectedText : C.tide,
                  }]} />
                  <View style={styles.activityContent}>
                    <ThemedText style={[styles.activityText, { color: C.fadedInk }]}>
                      {item.text}
                    </ThemedText>
                    <View style={styles.activityMeta}>
                      <ThemedText style={[styles.activityTime, { color: C.pencil }]}>
                        {timeAgo(item.created_at)}
                      </ThemedText>
                      <View style={[styles.badge, {
                        backgroundColor: item.role === 'assistant' ? C.connected : C.info,
                      }]}>
                        <ThemedText style={[styles.badgeText, {
                          color: item.role === 'assistant' ? C.connectedText : C.infoText,
                        }]}>
                          {item.role === 'assistant' ? 'reply' : 'you'}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                </View>
              </Animated.View>
            ))
          ) : (
            <Animated.View entering={FadeIn.duration(400).delay(400)}>
              <ThemedText style={[styles.emptyText, { color: C.pencil }]}>
                No activity yet. Create an agent and start chatting.
              </ThemedText>
            </Animated.View>
          )}
        </View>
      </View>

      {/* Agent pills */}
      {agents.length > 0 && (
        <View style={styles.agentSection}>
          {agents.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => router.push(`/chat/${a.id}`)}
              dataSet={{ hover: 'card' }}
              style={styles.agentPill}
            >
              <View style={[styles.agentDot, { backgroundColor: C.tide }]} />
              <ThemedText style={[styles.agentText, { color: C.fadedInk }]}>
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
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 24,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },

  // ── Agent pills ──
  agentSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  agentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.agedPaper,
    borderWidth: 0.5,
    borderColor: C.ruledLine,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  agentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  agentText: {
    fontSize: 12,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
})
