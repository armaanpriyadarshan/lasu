import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'

import { ThemedText } from '@/components/themed-text'
import { Colors } from '@/constants/theme'
import { useAuth } from '@/lib/auth'
import { listAgents, createAgent, type Agent } from '@/lib/api'

const C = Colors.light
const isWeb = Platform.OS === 'web'

export default function AgentsScreen() {
  const { userId } = useAuth()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const isDesktop = width > 768

  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useFocusEffect(
    useCallback(() => {
      if (!userId) return
      setLoading(true)
      listAgents(userId)
        .then(({ agents }) => setAgents(agents))
        .catch(() => {})
        .finally(() => setLoading(false))
    }, [userId])
  )

  const handleCreate = async () => {
    if (!userId || !name.trim() || !description.trim()) return
    setCreating(true)
    setError('')
    try {
      const agent = await createAgent(userId, name.trim(), description.trim())
      setShowCreate(false)
      setName('')
      setDescription('')
      router.push(`/chat/${agent.id}`)
    } catch (e: any) {
      setError(e.message || 'Failed to create agent')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.pencil} />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.pageContent, isDesktop && styles.pageContentDesk]}
    >
      <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
        <ThemedText serif style={[styles.title, { color: C.ink }]}>
          Your agents
        </ThemedText>
        <Pressable
          onPress={() => setShowCreate(true)}
          style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.7 }]}
        >
          <ThemedText style={[styles.createBtnText, { color: C.white }]}>
            + Create agent
          </ThemedText>
        </Pressable>
      </Animated.View>

      {showCreate && (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.createForm}>
          <TextInput
            placeholder="Agent name"
            placeholderTextColor={C.pencil}
            value={name}
            onChangeText={setName}
            style={[styles.input, { color: C.ink, borderColor: C.ruledLine }]}
          />
          <TextInput
            placeholder="What should this agent do?"
            placeholderTextColor={C.pencil}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            style={[styles.input, styles.inputMulti, { color: C.ink, borderColor: C.ruledLine }]}
          />
          {error ? (
            <ThemedText style={[styles.errorText, { color: C.errorText }]}>{error}</ThemedText>
          ) : null}
          <View style={styles.createActions}>
            <Pressable
              onPress={() => { setShowCreate(false); setError('') }}
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
            >
              <ThemedText style={{ color: C.pencil }}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={handleCreate}
              disabled={creating || !name.trim() || !description.trim()}
              style={({ pressed }) => [
                styles.submitBtn,
                (creating || !name.trim() || !description.trim()) && { opacity: 0.5 },
                pressed && { opacity: 0.7 },
              ]}
            >
              {creating ? (
                <ActivityIndicator color={C.white} size="small" />
              ) : (
                <ThemedText style={[styles.submitBtnText, { color: C.white }]}>Create</ThemedText>
              )}
            </Pressable>
          </View>
        </Animated.View>
      )}

      {agents.length === 0 && !showCreate ? (
        <Animated.View entering={FadeIn.duration(500).delay(200)} style={styles.empty}>
          <ThemedText serif style={[styles.emptyTitle, { color: C.fadedInk }]}>
            No agents yet
          </ThemedText>
          <ThemedText style={[styles.emptyText, { color: C.pencil }]}>
            Create your first agent to get started.
          </ThemedText>
        </Animated.View>
      ) : (
        <View style={[styles.agentGrid, isDesktop && styles.agentGridDesk]}>
          {agents.map((agent, i) => (
            <Pressable
              key={agent.id}
              onPress={() => router.push(`/chat/${agent.id}`)}
              style={({ pressed }) => [pressed && { opacity: 0.8 }]}
            >
              <Animated.View
                entering={FadeInDown.duration(300).delay(i * 80)}
                style={styles.agentCard}
              >
                <View style={styles.agentAvatar}>
                  <ThemedText style={[styles.agentInitial, { color: C.white }]}>
                    {agent.name.charAt(0).toUpperCase()}
                  </ThemedText>
                </View>
                <View style={styles.agentInfo}>
                  <ThemedText style={[styles.agentName, { color: C.ink }]}>
                    {agent.name}
                  </ThemedText>
                  <ThemedText
                    numberOfLines={2}
                    style={[styles.agentDesc, { color: C.pencil }]}
                  >
                    {agent.description}
                  </ThemedText>
                </View>
              </Animated.View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.parchment },
  pageContent: { padding: 24, paddingBottom: 80 },
  pageContentDesk: { padding: 28, paddingHorizontal: 32, maxWidth: 960 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-serif)' } as any),
  },
  createBtn: {
    backgroundColor: C.ink,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  createBtnText: {
    fontSize: 13,
    fontWeight: '500',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  createForm: {
    backgroundColor: C.agedPaper,
    borderWidth: 0.5,
    borderColor: C.ruledLine,
    borderRadius: 10,
    padding: 20,
    marginBottom: 24,
    gap: 12,
  },
  input: {
    backgroundColor: C.parchment,
    borderWidth: 0.5,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    ...(isWeb && { fontFamily: 'var(--font-display)', outlineStyle: 'none' } as any),
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  errorText: { fontSize: 12 },
  createActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, ...(isWeb && { cursor: 'pointer' } as any) },
  submitBtn: {
    backgroundColor: C.ink,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  submitBtnText: { fontSize: 13, fontWeight: '500' },
  empty: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-serif)' } as any),
  },
  emptyText: {
    fontSize: 13,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  agentGrid: { gap: 12 },
  agentGridDesk: { flexDirection: 'row', flexWrap: 'wrap' },
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.agedPaper,
    borderWidth: 0.5,
    borderColor: C.ruledLine,
    borderRadius: 10,
    padding: 16,
    ...(isWeb && { cursor: 'pointer', transition: 'border-color 150ms ease', minWidth: 280 } as any),
  },
  agentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.tide,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentInitial: { fontSize: 16, fontWeight: '600' },
  agentInfo: { flex: 1, gap: 4 },
  agentName: {
    fontSize: 15,
    fontWeight: '500',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  agentDesc: {
    fontSize: 12,
    lineHeight: 18,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
})
