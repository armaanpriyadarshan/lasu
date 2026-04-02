import { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import Animated, { FadeIn } from 'react-native-reanimated'

import { ThemedText } from '@/components/themed-text'
import { Colors } from '@/constants/theme'
import { useAuth } from '@/lib/auth'
import {
  getAgent, getAgentMessages, chatWithAgent,
  getAgentMemories, deleteAgentMemory,
  getPendingRequests, grantPermissionRequest, denyPermissionRequest,
  getAgentPermissions, revokePermission,
  getJobs, createJob, updateJob, deleteJob,
  type Agent, type AgentMessage, type AgentMemory,
  type PermissionRequest, type AgentPermission, type AgentJob,
} from '@/lib/api'

const C = Colors.light
const isWeb = Platform.OS === 'web'

export default function ChatScreen() {
  const { agentId } = useLocalSearchParams<{ agentId: string }>()
  const { userId } = useAuth()
  const router = useRouter()
  const flatListRef = useRef<FlatList>(null)

  const [agent, setAgent] = useState<Agent | null>(null)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [memories, setMemories] = useState<AgentMemory[]>([])
  const [showMemory, setShowMemory] = useState(false)
  const [permRequests, setPermRequests] = useState<PermissionRequest[]>([])
  const [permissions, setPermissions] = useState<AgentPermission[]>([])
  const [showPermissions, setShowPermissions] = useState(false)
  const [heartbeat, setHeartbeat] = useState<AgentJob | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (!agentId) return
      setLoading(true)
      Promise.all([
        getAgent(agentId),
        getAgentMessages(agentId),
        getAgentMemories(agentId),
        getPendingRequests(agentId),
        getAgentPermissions(agentId),
        getJobs(agentId),
      ])
        .then(([agentData, { messages }, { memories }, { requests }, { permissions }, { jobs }]) => {
          setAgent(agentData)
          setMessages(messages)
          setMemories(memories)
          setPermRequests(requests)
          setPermissions(permissions)
          setHeartbeat(jobs.find((j: AgentJob) => j.job_type === 'heartbeat') || null)
        })
        .catch(() => router.back())
        .finally(() => setLoading(false))
    }, [agentId])
  )

  const handleDeleteMemory = async (memoryId: string) => {
    if (!agentId) return
    await deleteAgentMemory(agentId, memoryId).catch(() => {})
    setMemories((prev) => prev.filter((m) => m.id !== memoryId))
  }

  const handleGrantPermission = async (requestId: string, grantType: 'one_time' | 'permanent') => {
    if (!agentId) return
    try {
      await grantPermissionRequest(agentId, requestId, grantType)
      setPermRequests((prev) => prev.filter((r) => r.id !== requestId))
      getAgentPermissions(agentId).then(({ permissions }) => setPermissions(permissions)).catch(() => {})
    } catch {}
  }

  const handleDenyPermission = async (requestId: string) => {
    if (!agentId) return
    try {
      await denyPermissionRequest(agentId, requestId)
      setPermRequests((prev) => prev.filter((r) => r.id !== requestId))
    } catch {}
  }

  const handleRevokePermission = async (permissionId: string) => {
    if (!agentId) return
    try {
      await revokePermission(agentId, permissionId)
      setPermissions((prev) => prev.filter((p) => p.id !== permissionId))
    } catch {}
  }

  const handleToggleHeartbeat = async () => {
    if (!agentId) return
    try {
      if (heartbeat) {
        if (heartbeat.enabled) {
          const updated = await updateJob(agentId, heartbeat.id, { enabled: false })
          setHeartbeat(updated)
        } else {
          const updated = await updateJob(agentId, heartbeat.id, { enabled: true })
          setHeartbeat(updated)
        }
      } else {
        const job = await createJob(agentId, 30)
        setHeartbeat(job)
      }
    } catch {}
  }

  const handleSend = async () => {
    if (!userId || !agentId || !input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)

    const userMsg: AgentMessage = { role: 'user', content: text, created_at: new Date().toISOString() }
    setMessages((prev) => [...prev, userMsg])

    try {
      const { reply } = await chatWithAgent(agentId, userId, text)
      const assistantMsg: AgentMessage = { role: 'assistant', content: reply, created_at: new Date().toISOString() }
      setMessages((prev) => [...prev, assistantMsg])
      // Refresh memories after each turn (extraction happens server-side)
      getAgentMemories(agentId).then(({ memories }) => setMemories(memories)).catch(() => {})
      getPendingRequests(agentId).then(({ requests }) => setPermRequests(requests)).catch(() => {})
    } catch {
      const errMsg: AgentMessage = { role: 'assistant', content: 'Something went wrong. Try again.', created_at: new Date().toISOString() }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setSending(false)
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.chatHeader}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ThemedText style={{ color: C.pencil, fontSize: 14 }}>{'< Back'}</ThemedText>
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <ThemedText style={[styles.headerInitial, { color: C.white }]}>
              {agent?.name.charAt(0).toUpperCase()}
            </ThemedText>
          </View>
          <ThemedText style={[styles.headerName, { color: C.ink }]}>
            {agent?.name}
          </ThemedText>
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={handleToggleHeartbeat}>
            <ThemedText style={{ color: heartbeat?.enabled ? C.connectedText : C.pencil, fontSize: 11 }}>
              {heartbeat?.enabled ? 'Live' : 'Idle'}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => { setShowPermissions(!showPermissions); setShowMemory(false) }}>
            <ThemedText style={{ color: showPermissions ? C.tide : C.pencil, fontSize: 11 }}>
              {permissions.filter((p) => p.grant_type === 'permanent').length > 0 ? `Perms (${permissions.filter((p) => p.grant_type === 'permanent').length})` : 'Perms'}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => { setShowMemory(!showMemory); setShowPermissions(false) }}>
            <ThemedText style={{ color: showMemory ? C.tide : C.pencil, fontSize: 11 }}>
              {memories.length > 0 ? `Memory (${memories.length})` : 'Memory'}
            </ThemedText>
          </Pressable>
        </View>
      </Animated.View>

      {showMemory && (
        <ScrollView style={styles.memoryPanel}>
          <ThemedText serif style={[styles.memoryTitle, { color: C.ink }]}>
            What {agent?.name} remembers
          </ThemedText>
          {memories.length === 0 ? (
            <ThemedText style={[styles.memoryEmpty, { color: C.pencil }]}>
              No memories yet. Chat more and {agent?.name} will learn about you.
            </ThemedText>
          ) : (
            memories.map((mem) => (
              <View key={mem.id} style={styles.memoryItem}>
                <View style={styles.memoryContent}>
                  <ThemedText style={[styles.memoryKey, { color: C.graphite }]}>
                    {mem.key.replace(/_/g, ' ')}
                  </ThemedText>
                  <ThemedText style={[styles.memoryValue, { color: C.fadedInk }]}>
                    {mem.value}
                  </ThemedText>
                </View>
                <Pressable onPress={() => handleDeleteMemory(mem.id)} style={styles.memoryDelete}>
                  <ThemedText style={{ color: C.pencil, fontSize: 12 }}>x</ThemedText>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {showPermissions && (
        <ScrollView style={styles.memoryPanel}>
          <ThemedText serif style={[styles.memoryTitle, { color: C.ink }]}>
            Permissions
          </ThemedText>
          {permissions.length === 0 ? (
            <ThemedText style={[styles.memoryEmpty, { color: C.pencil }]}>
              No permissions granted yet.
            </ThemedText>
          ) : (
            permissions.filter((p) => p.grant_type === 'permanent').map((perm) => (
              <View key={perm.id} style={styles.memoryItem}>
                <View style={styles.memoryContent}>
                  <ThemedText style={[styles.memoryKey, { color: C.graphite }]}>
                    {perm.permission}
                  </ThemedText>
                  <ThemedText style={[styles.memoryValue, { color: C.fadedInk }]}>
                    Always allowed
                  </ThemedText>
                </View>
                <Pressable onPress={() => handleRevokePermission(perm.id)} style={styles.memoryDelete}>
                  <ThemedText style={{ color: C.waxSeal, fontSize: 11 }}>Revoke</ThemedText>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <ThemedText serif style={[styles.emptyChatTitle, { color: C.fadedInk }]}>
              Start a conversation
            </ThemedText>
            <ThemedText style={[styles.emptyChatText, { color: C.pencil }]}>
              Say hello to {agent?.name}.
            </ThemedText>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.role === 'user' ? styles.bubbleUser : styles.bubbleAgent,
            ]}
          >
            <ThemedText
              style={[
                styles.bubbleText,
                { color: item.role === 'user' ? C.white : C.fadedInk },
              ]}
            >
              {item.content}
            </ThemedText>
          </View>
        )}
      />

      {permRequests.length > 0 && (
        <View style={styles.permRequestBar}>
          {permRequests.map((req) => (
            <View key={req.id} style={styles.permRequestCard}>
              <ThemedText style={[styles.permRequestText, { color: C.fadedInk }]}>
                {agent?.name} needs {req.permission} access
              </ThemedText>
              {req.reason ? (
                <ThemedText style={[styles.permRequestReason, { color: C.pencil }]}>
                  {req.reason}
                </ThemedText>
              ) : null}
              <View style={styles.permRequestActions}>
                <Pressable
                  onPress={() => handleGrantPermission(req.id, 'one_time')}
                  style={[styles.permBtn, styles.permBtnOutline]}
                >
                  <ThemedText style={[styles.permBtnText, { color: C.ink }]}>Allow once</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => handleGrantPermission(req.id, 'permanent')}
                  style={[styles.permBtn, styles.permBtnFilled]}
                >
                  <ThemedText style={[styles.permBtnText, { color: C.white }]}>Always allow</ThemedText>
                </Pressable>
                <Pressable onPress={() => handleDenyPermission(req.id)}>
                  <ThemedText style={{ color: C.pencil, fontSize: 12 }}>Deny</ThemedText>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Input */}
      <View style={styles.inputBar}>
        <TextInput
          placeholder={`Message ${agent?.name ?? 'agent'}...`}
          placeholderTextColor={C.pencil}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          editable={!sending}
          style={[styles.textInput, { color: C.ink, borderColor: C.ruledLine }]}
        />
        <Pressable
          onPress={handleSend}
          disabled={sending || !input.trim()}
          style={({ pressed }) => [
            styles.sendBtn,
            (sending || !input.trim()) && { opacity: 0.4 },
            pressed && { opacity: 0.7 },
          ]}
        >
          {sending ? (
            <ActivityIndicator color={C.white} size="small" />
          ) : (
            <ThemedText style={[styles.sendBtnText, { color: C.white }]}>Send</ThemedText>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.parchment },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: C.agedPaper,
    borderBottomWidth: 0.5,
    borderBottomColor: C.ruledLine,
  },
  backBtn: { width: 60 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.tide,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInitial: { fontSize: 14, fontWeight: '600' },
  headerName: {
    fontSize: 16,
    fontWeight: '500',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },

  messageList: { padding: 16, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' },
  emptyChat: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyChatTitle: {
    fontSize: 20,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-serif)' } as any),
  },
  emptyChatText: {
    fontSize: 13,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },

  bubble: {
    maxWidth: '80%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginBottom: 8,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: C.ink,
    borderBottomRightRadius: 4,
  },
  bubbleAgent: {
    alignSelf: 'flex-start',
    backgroundColor: C.agedPaper,
    borderWidth: 0.5,
    borderColor: C.ruledLine,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: C.agedPaper,
    borderTopWidth: 0.5,
    borderTopColor: C.ruledLine,
  },
  textInput: {
    flex: 1,
    backgroundColor: C.parchment,
    borderWidth: 0.5,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontSize: 14,
    ...(isWeb && { fontFamily: 'var(--font-display)', outlineStyle: 'none' } as any),
  },
  sendBtn: {
    backgroundColor: C.ink,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  sendBtnText: { fontSize: 13, fontWeight: '500' },

  memoryPanel: {
    backgroundColor: C.agedPaper,
    borderBottomWidth: 0.5,
    borderBottomColor: C.ruledLine,
    padding: 16,
    height: 700,
  },
  memoryTitle: {
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 12,
    ...(isWeb && { fontFamily: 'var(--font-serif)' } as any),
  },
  memoryEmpty: {
    fontSize: 13,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  memoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.ruledLine,
  },
  memoryContent: { flex: 1, gap: 2 },
  memoryKey: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },
  memoryValue: {
    fontSize: 13,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  memoryDelete: {
    padding: 8,
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    width: 120,
    justifyContent: 'flex-end',
  },
  permRequestBar: {
    padding: 12,
    gap: 8,
    backgroundColor: C.agedPaper,
    borderTopWidth: 0.5,
    borderTopColor: C.ruledLine,
  },
  permRequestCard: {
    backgroundColor: C.parchment,
    borderWidth: 0.5,
    borderColor: C.ruledLine,
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  permRequestText: {
    fontSize: 13,
    fontWeight: '500',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  permRequestReason: {
    fontSize: 12,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  permRequestActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  permBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 7,
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  permBtnOutline: {
    borderWidth: 0.5,
    borderColor: C.ruledLine,
    backgroundColor: C.parchment,
  },
  permBtnFilled: {
    backgroundColor: C.ink,
  },
  permBtnText: {
    fontSize: 12,
    fontWeight: '500',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
})
