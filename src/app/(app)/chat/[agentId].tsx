import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
import { SvgIcon } from '@/components/icons'
import { Colors } from '@/constants/theme'
import { useAuth } from '@/lib/auth'
import {
  getAgent, getAgentMessages, chatWithAgent,
  getAgentMemories, deleteAgentMemory,
  getPendingRequests, grantPermissionRequest, denyPermissionRequest,
  getAgentPermissions, revokePermission,
  getJobs, createJob, updateJob, deleteJob,
  getGoogleAuthUrl,
  type Agent, type AgentMessage, type AgentMemory,
  type PermissionRequest, type AgentPermission, type AgentJob,
} from '@/lib/api'

const C = Colors.light
const isWeb = Platform.OS === 'web'

function renderMarkdown(text: string, color: string) {
  if (!isWeb) {
    return <ThemedText style={[styles.bubbleText, { color }]}>{text}</ThemedText>
  }
  // Simple markdown → HTML
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:#EBE5D5;padding:10px 12px;border-radius:6px;overflow-x:auto;font-family:var(--font-mono);font-size:12px;margin:6px 0;white-space:pre-wrap">$2</pre>')
    // inline code
    .replace(/`([^`]+)`/g, '<code style="background:#EBE5D5;padding:1px 5px;border-radius:3px;font-family:var(--font-mono);font-size:12px">$1</code>')
    // bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // unordered lists
    .replace(/^[-•] (.+)$/gm, '<li style="margin-left:16px;margin-bottom:2px">$1</li>')
    // newlines (but not inside pre)
    .replace(/\n/g, '<br/>')
  return React.createElement('div', {
    style: { color, fontSize: 14, lineHeight: '22px', fontFamily: 'var(--font-display)', wordBreak: 'break-word' },
    dangerouslySetInnerHTML: { __html: html },
  })
}

function TypingDots() {
  const [dots, setDots] = useState('.')
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '.' : d + '.'))
    }, 400)
    return () => clearInterval(interval)
  }, [])
  return (
    <View style={[typingStyles.bubble]}>
      <ThemedText style={[typingStyles.dots, { color: C.pencil }]}>{dots}</ThemedText>
    </View>
  )
}

const typingStyles = StyleSheet.create({
  bubble: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  dots: {
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: 2,
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },
})

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
  const [permRequests, setPermRequests] = useState<PermissionRequest[]>([])
  const [permissions, setPermissions] = useState<AgentPermission[]>([])
  const [heartbeat, setHeartbeat] = useState<AgentJob | null>(null)
  const [showGoogleConnect, setShowGoogleConnect] = useState(false)
  const [panel, setPanel] = useState<'none' | 'memory' | 'permissions'>('none')

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
        const updated = await updateJob(agentId, heartbeat.id, { enabled: !heartbeat.enabled })
        setHeartbeat(updated)
      } else {
        const job = await createJob(agentId, 30)
        setHeartbeat(job)
      }
    } catch {}
  }

  const handleConnectGoogle = async () => {
    if (!userId) return
    try {
      const { url } = await getGoogleAuthUrl(userId)
      Linking.openURL(url)
      setShowGoogleConnect(false)
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
      const { reply, tool_calls } = await chatWithAgent(agentId, userId, text)
      if (tool_calls && tool_calls.length > 0) {
        const toolSummary = tool_calls.map((tc: { tool: string; args: Record<string, unknown>; result: string }) => {
          if (tc.result === 'permission_denied') return `[${tc.tool}] Permission needed`
          if (tc.result.includes('not connected')) return `[${tc.tool}] Google account needed`
          return `[${tc.tool}] Done`
        }).join('\n')
        setMessages((prev) => [...prev, { role: 'assistant', content: `Tools used:\n${toolSummary}`, created_at: new Date().toISOString() }])
        // Show Google connect if any tool needs it
        if (tool_calls.some((tc: { result: string }) => tc.result.includes('not connected') || tc.result.includes('Google account'))) {
          setShowGoogleConnect(true)
        }
      }
      const assistantMsg: AgentMessage = { role: 'assistant', content: reply, created_at: new Date().toISOString() }
      setMessages((prev) => [...prev, assistantMsg])
      // Show Google connect prompt if agent reply mentions it
      if (reply.includes('Google account not connected') || reply.includes('connect your Google account') || reply.includes('Google account isn')) {
        setShowGoogleConnect(true)
      }
      // Refresh memories after each turn (extraction happens server-side)
      getAgentMemories(agentId).then(({ memories }) => setMemories(memories)).catch(() => {})
      getPendingRequests(agentId).then(({ requests }) => setPermRequests(requests)).catch(() => {})
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.', created_at: new Date().toISOString() }])
    } finally {
      setSending(false)
    }
  }

  const permCount = permissions.filter((p) => !p.revoked_at).length

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

      {/* Memory modal */}
      <Modal
        visible={panel === 'memory'}
        transparent
        animationType="fade"
        onRequestClose={() => setPanel('none')}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPanel('none')}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <ThemedText serif style={[styles.modalTitle, { color: C.ink }]}>
                Memory
              </ThemedText>
              <Pressable onPress={() => setPanel('none')} style={styles.modalClose}>
                <ThemedText style={{ color: C.pencil, fontSize: 18 }}>×</ThemedText>
              </Pressable>
            </View>
            <ScrollView style={styles.modalScroll}>
              {memories.length === 0 ? (
                <ThemedText style={[styles.panelEmpty, { color: C.pencil }]}>
                  No memories yet. Chat more and {agent?.name} will learn about you.
                </ThemedText>
              ) : (
                memories.map((mem) => (
                  <View key={mem.id} style={styles.panelItem}>
                    <View style={styles.panelItemContent}>
                      <ThemedText style={[styles.panelKey, { color: C.graphite }]}>
                        {mem.key.replace(/_/g, ' ')}
                      </ThemedText>
                      <ThemedText style={[styles.panelValue, { color: C.fadedInk }]}>
                        {mem.value}
                      </ThemedText>
                    </View>
                    <Pressable onPress={() => handleDeleteMemory(mem.id)} style={styles.panelAction}>
                      <ThemedText style={{ color: C.pencil, fontSize: 12 }}>×</ThemedText>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Permissions modal */}
      <Modal
        visible={panel === 'permissions'}
        transparent
        animationType="fade"
        onRequestClose={() => setPanel('none')}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPanel('none')}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <ThemedText serif style={[styles.modalTitle, { color: C.ink }]}>
                Permissions
              </ThemedText>
              <Pressable onPress={() => setPanel('none')} style={styles.modalClose}>
                <ThemedText style={{ color: C.pencil, fontSize: 18 }}>×</ThemedText>
              </Pressable>
            </View>
            <ScrollView style={styles.modalScroll}>
              {permCount === 0 ? (
                <ThemedText style={[styles.panelEmpty, { color: C.pencil }]}>
                  No permissions granted yet.
                </ThemedText>
              ) : (
                permissions.filter((p) => !p.revoked_at).map((perm) => (
                  <View key={perm.id} style={styles.panelItem}>
                    <View style={styles.panelItemContent}>
                      <ThemedText style={[styles.panelKey, { color: C.graphite }]}>
                        {perm.permission}
                      </ThemedText>
                      <ThemedText style={[styles.panelValue, { color: C.fadedInk }]}>
                        {perm.grant_type === 'permanent' ? 'Always allowed' : 'One-time'}
                      </ThemedText>
                    </View>
                    <Pressable onPress={() => handleRevokePermission(perm.id)} style={styles.panelAction}>
                      <ThemedText style={{ color: C.waxSeal, fontSize: 11 }}>Revoke</ThemedText>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={
          <Animated.View entering={FadeIn.duration(400)} style={styles.profileCenter}>
            <View style={styles.avatar}>
              {agent?.emoji?.startsWith('http') ? (
                isWeb ? React.createElement('img', {
                  src: agent.emoji,
                  style: { width: 52, height: 52, borderRadius: 16, objectFit: 'cover' },
                }) : null
              ) : (
                <ThemedText style={styles.avatarEmoji}>
                  {agent?.emoji || agent?.name.charAt(0).toUpperCase()}
                </ThemedText>
              )}
            </View>
            <View style={styles.nameRow}>
              <ThemedText serif style={[styles.agentName, { color: C.ink }]}>
                {agent?.name}
              </ThemedText>
              <Pressable onPress={handleToggleHeartbeat} style={styles.statusDotBtn}>
                <View style={[styles.statusDot, { backgroundColor: heartbeat?.enabled ? C.connectedText : C.pencil }]} />
              </Pressable>
            </View>
            <ThemedText style={[styles.agentDesc, { color: C.pencil }]} numberOfLines={2}>
              {agent?.description}
            </ThemedText>

            <View style={styles.chips}>
              <Pressable
                onPress={() => setPanel(panel === 'memory' ? 'none' : 'memory')}
                dataSet={{ hover: 'vellum' }}
                style={[styles.chip, panel === 'memory' && styles.chipActive]}
              >
                <SvgIcon name="nodes" size={12} color={panel === 'memory' ? C.tide : C.pencil} />
                <ThemedText style={[styles.chipText, { color: panel === 'memory' ? C.tide : C.pencil }]}>
                  {memories.length > 0 ? `MEMORY (${memories.length})` : 'MEMORY'}
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={() => setPanel(panel === 'permissions' ? 'none' : 'permissions')}
                dataSet={{ hover: 'vellum' }}
                style={[styles.chip, panel === 'permissions' && styles.chipActive]}
              >
                <SvgIcon name="shield" size={12} color={panel === 'permissions' ? C.tide : C.pencil} />
                <ThemedText style={[styles.chipText, { color: panel === 'permissions' ? C.tide : C.pencil }]}>
                  {permCount > 0 ? `PERMS (${permCount})` : 'PERMS'}
                </ThemedText>
              </Pressable>
            </View>

            {messages.length === 0 && (
              <View style={styles.emptyChat}>
                <ThemedText style={[styles.emptyChatText, { color: C.pencil }]}>
                  Say hello to {agent?.name}.
                </ThemedText>
              </View>
            )}
          </Animated.View>
        }
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAgent]}>
            {item.role === 'user' ? (
              <ThemedText style={[styles.bubbleText, { color: C.white }]}>
                {item.content}
              </ThemedText>
            ) : (
              renderMarkdown(item.content, C.fadedInk)
            )}
          </View>
        )}
        ListFooterComponent={sending ? <TypingDots /> : null}
      />

      {/* Permission requests */}
      {permRequests.length > 0 && (
        <View style={styles.permBar}>
          {permRequests.map((req) => (
            <View key={req.id} style={styles.permCard}>
              <ThemedText style={[styles.permText, { color: C.fadedInk }]}>
                {agent?.name} needs {req.permission} access
              </ThemedText>
              {req.reason ? (
                <ThemedText style={[styles.permReason, { color: C.pencil }]}>{req.reason}</ThemedText>
              ) : null}
              <View style={styles.permActions}>
                <Pressable onPress={() => handleGrantPermission(req.id, 'one_time')} style={[styles.permBtn, styles.permBtnOutline]}>
                  <ThemedText style={[styles.permBtnText, { color: C.ink }]}>Allow once</ThemedText>
                </Pressable>
                <Pressable onPress={() => handleGrantPermission(req.id, 'permanent')} style={[styles.permBtn, styles.permBtnFilled]}>
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

      {showGoogleConnect && (
        <View style={styles.permRequestBar}>
          <View style={styles.permRequestCard}>
            <ThemedText style={[styles.permRequestText, { color: C.fadedInk }]}>
              {agent?.name} needs access to your Google account
            </ThemedText>
            <ThemedText style={[styles.permRequestReason, { color: C.pencil }]}>
              Connect Google to use calendar, email, contacts, and drive tools.
            </ThemedText>
            <View style={styles.permRequestActions}>
              <Pressable
                onPress={handleConnectGoogle}
                style={[styles.permBtn, styles.permBtnFilled]}
              >
                <ThemedText style={[styles.permBtnText, { color: C.white }]}>Connect Google</ThemedText>
              </Pressable>
              <Pressable onPress={() => setShowGoogleConnect(false)}>
                <ThemedText style={{ color: C.pencil, fontSize: 12 }}>Dismiss</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputBar}>
        <View style={styles.inputRow}>
          <TextInput
            placeholder={`Message ${agent?.name ?? 'agent'}...`}
            placeholderTextColor={C.pencil}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!sending}
            style={[styles.textInput, { color: C.ink }]}
          />
          <Pressable
            onPress={handleSend}
            disabled={sending || !input.trim()}
            style={({ pressed }) => [
              styles.sendBtn,
              (sending || !input.trim()) && { opacity: 0.3 },
              pressed && { opacity: 0.7 },
            ]}
          >
            {sending ? (
              <ActivityIndicator color={C.white} size="small" />
            ) : (
              <ThemedText style={[styles.sendBtnText, { color: C.white }]}>↑</ThemedText>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.parchment, maxWidth: 720, alignSelf: 'center', width: '100%' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Profile (in list header) ──
  profileCenter: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 48,
    paddingBottom: 32,
  },
  nameRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDotBtn: {
    position: 'absolute',
    right: '100%',
    marginRight: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    padding: 4,
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: C.agedPaper,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarEmoji: {
    fontSize: 28,
  },
  agentName: {
    fontSize: 18,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-serif)' } as any),
  },
  agentDesc: {
    fontSize: 12,
    maxWidth: 300,
    textAlign: 'center',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  chips: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 0,
  },
  chip: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    ...(isWeb && { cursor: 'pointer', transition: 'background-color 150ms ease' } as any),
  },
  chipActive: {
    backgroundColor: C.agedPaper,
  },
  chipText: {
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.5,
    lineHeight: 12,
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },

  // ── Modals ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 24, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: C.parchment,
    borderRadius: 12,
    width: '100%',
    maxWidth: 480,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-serif)' } as any),
  },
  modalClose: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  panelEmpty: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  panelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.ruledLine,
  },
  panelItemContent: { flex: 1, gap: 2 },
  panelKey: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },
  panelValue: {
    fontSize: 13,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  panelAction: {
    padding: 8,
    ...(isWeb && { cursor: 'pointer' } as any),
  },

  // ── Messages ──
  messageList: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  emptyChat: { alignItems: 'center', marginTop: 16, gap: 8 },
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
    backgroundColor: 'transparent',
    paddingHorizontal: 2,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },

  // ── Permission requests ──
  permBar: {
    padding: 12,
    gap: 8,
  },
  permCard: {
    backgroundColor: C.agedPaper,
    borderWidth: 0.5,
    borderColor: C.ruledLine,
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  permText: {
    fontSize: 13,
    fontWeight: '500',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  permReason: {
    fontSize: 12,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  permActions: {
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

  // ── Input ──
  inputBar: {
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.agedPaper,
    borderRadius: 12,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
    ...(isWeb && { fontFamily: 'var(--font-display)', outlineStyle: 'none' } as any),
  },
  sendBtn: {
    backgroundColor: C.ink,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  sendBtnText: { fontSize: 16, fontWeight: '500' },
})
