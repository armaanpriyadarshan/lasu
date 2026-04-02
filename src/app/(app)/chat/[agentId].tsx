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
  getAgent, getAgentMessages, chatWithAgent, chatWithAgentStream,
  getAgentMemories, deleteAgentMemory,
  getPendingRequests, grantPermissionRequest, denyPermissionRequest,
  getAgentPermissions, grantPermission, revokePermission,
  getJobs, createJob, updateJob, deleteJob,
  getGoogleAuthUrl, getGoogleStatus,
  getAgentSessions, createNewSession, getSessionMessages,
  type Agent, type AgentMessage, type AgentMemory,
  type PermissionRequest, type AgentPermission, type AgentJob, type AgentSession,
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
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 300)
    return () => clearInterval(interval)
  }, [])
  return (
    <View style={typingStyles.row}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            typingStyles.dot,
            { opacity: (tick % 3) === i ? 1 : 0.25 },
          ]}
        />
      ))}
    </View>
  )
}

const typingStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.pencil,
  },
})

export default function ChatScreen() {
  const { agentId } = useLocalSearchParams<{ agentId: string }>()
  const { userId } = useAuth()
  const router = useRouter()
  const flatListRef = useRef<FlatList>(null)
  const lastFailedMessage = useRef<string | null>(null)

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
  const [googleConnected, setGoogleConnected] = useState(false)
  const [panel, setPanel] = useState<'none' | 'memory' | 'permissions'>('none')
  const [sessions, setSessions] = useState<AgentSession[]>([])
  const [activeSession, setActiveSession] = useState<AgentSession | null>(null)
  const [showSessions, setShowSessions] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (!agentId || !userId) return
      setLoading(true)
      Promise.all([
        getAgent(agentId),
        getAgentSessions(agentId),
        getAgentMemories(agentId),
        getPendingRequests(agentId),
        getAgentPermissions(agentId),
        getJobs(agentId),
        getGoogleStatus(userId),
      ])
        .then(async ([agentData, { sessions }, { memories }, { requests }, { permissions }, { jobs }, googleStatus]) => {
          setAgent(agentData)
          setSessions(sessions)
          setMemories(memories)
          setPermRequests(requests)
          setPermissions(permissions)
          setHeartbeat(jobs.find((j: AgentJob) => j.job_type === 'heartbeat') || null)
          setGoogleConnected(googleStatus.connected)

          // Load active session messages, or all messages if no sessions yet
          const active = sessions.find((s: AgentSession) => s.is_active)
          if (active) {
            setActiveSession(active)
            const { messages } = await getSessionMessages(agentId, active.id)
            setMessages(messages)
          } else {
            const { messages } = await getAgentMessages(agentId)
            setMessages(messages)
          }
        })
        .catch(() => router.back())
        .finally(() => setLoading(false))
    }, [agentId, userId])
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
      // Poll for connection, then auto-grant Google permissions
      const poll = setInterval(async () => {
        const { connected } = await getGoogleStatus(userId)
        if (connected) {
          clearInterval(poll)
          setGoogleConnected(true)
          if (agentId) {
            const googlePerms = ['calendar', 'email', 'contacts', 'files']
            for (const p of googlePerms) {
              await grantPermission(agentId, p).catch(() => {})
            }
            getAgentPermissions(agentId).then(({ permissions }) => setPermissions(permissions)).catch(() => {})
            // Retry the last failed message now that Google is connected
            if (lastFailedMessage.current) {
              const retryMsg = lastFailedMessage.current
              lastFailedMessage.current = null
              setInput(retryMsg)
              // Small delay to let permissions propagate, then auto-send
              setTimeout(() => {
                setInput('')
                handleSendMessage(retryMsg)
              }, 1000)
            }
          }
        }
      }, 2000)
      setTimeout(() => clearInterval(poll), 60000)
    } catch {}
  }

  const handleSendMessage = async (messageText: string) => {
    if (!userId || !agentId || !messageText.trim() || sending) return
    const text = messageText.trim()
    setSending(true)

    setMessages((prev) => [...prev, { role: 'user', content: text, created_at: new Date().toISOString() }])

    // Add placeholder for streaming reply
    const streamIdx = { current: -1 }
    setMessages((prev) => {
      streamIdx.current = prev.length
      return [...prev, { role: 'assistant', content: '', created_at: new Date().toISOString() }]
    })

    try {
      await chatWithAgentStream(
        agentId, userId, text,
        // onToken — append to the streaming message
        (token) => {
          setMessages((prev) => {
            const updated = [...prev]
            const idx = streamIdx.current
            if (idx >= 0 && updated[idx]) {
              updated[idx] = { ...updated[idx], content: updated[idx].content + token }
            }
            return updated
          })
        },
        // onToolCalls
        (toolCalls) => {
          if (toolCalls.length > 0) {
            const toolSummary = toolCalls.map((tc) => {
              if (tc.result === 'permission_denied') return `[${tc.tool}] Permission needed`
              if (tc.result.includes('not connected')) return `[${tc.tool}] Google account needed`
              return `[${tc.tool}] Done`
            }).join('\n')
            // Insert tool summary before the streaming message
            setMessages((prev) => {
              const updated = [...prev]
              updated.splice(streamIdx.current, 0, { role: 'assistant', content: `Tools used:\n${toolSummary}`, created_at: new Date().toISOString() })
              streamIdx.current += 1
              return updated
            })
            if (toolCalls.some((tc) => tc.result.includes('not connected') || tc.result.includes('Google account'))) {
              setShowGoogleConnect(true)
              lastFailedMessage.current = text
            }
          }
        },
        // onDone
        () => {
          setMessages((prev) => {
            const reply = prev[streamIdx.current]?.content || ''
            if (reply.includes('Google account not connected') || reply.includes('connect your Google account')) {
              setShowGoogleConnect(true)
              lastFailedMessage.current = text
            }
            return prev
          })
          getAgentMemories(agentId).then(({ memories }) => setMemories(memories)).catch(() => {})
          getPendingRequests(agentId).then(({ requests }) => setPermRequests(requests)).catch(() => {})
        },
      )
    } catch {
      setMessages((prev) => {
        const updated = [...prev]
        const idx = streamIdx.current
        if (idx >= 0 && updated[idx] && !updated[idx].content) {
          updated[idx] = { ...updated[idx], content: 'Something went wrong. Try again.' }
        }
        return updated
      })
    } finally {
      setSending(false)
    }
  }

  const handleSend = () => {
    if (!input.trim()) return
    const text = input.trim()
    setInput('')
    handleSendMessage(text)
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
              {/* Integrations */}
              <ThemedText style={[styles.sectionLabel, { color: C.pencil }]}>INTEGRATIONS</ThemedText>
              <View style={styles.integrationCard}>
                <View style={styles.integrationRow}>
                  <View style={styles.integrationIcon}>
                    {isWeb ? React.createElement('div', {
                      style: { width: 18, height: 18 },
                      dangerouslySetInnerHTML: { __html: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 001 12c0 1.94.46 3.77 1.18 5.41l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>' },
                    }) : null}
                  </View>
                  <View style={styles.integrationInfo}>
                    <ThemedText style={[styles.integrationName, { color: C.ink }]}>Google</ThemedText>
                    <ThemedText style={[styles.integrationDesc, { color: C.pencil }]}>
                      {googleConnected ? 'Calendar, Email, Contacts, Drive' : 'Connect for calendar, email, contacts, drive'}
                    </ThemedText>
                  </View>
                  {googleConnected ? (
                    <View style={styles.integrationBadge}>
                      <View style={[styles.integrationDot, { backgroundColor: C.connectedText }]} />
                      <ThemedText style={[styles.integrationStatus, { color: C.connectedText }]}>Connected</ThemedText>
                    </View>
                  ) : (
                    <Pressable onPress={handleConnectGoogle} dataSet={{ hover: 'solid' }} style={styles.integrationConnectBtn}>
                      <ThemedText style={[styles.integrationConnectText, { color: C.white }]}>Connect</ThemedText>
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Granted permissions */}
              <ThemedText style={[styles.sectionLabel, { color: C.pencil, marginTop: 20 }]}>GRANTED</ThemedText>
              {permCount === 0 ? (
                <ThemedText style={[styles.panelEmpty, { color: C.pencil }]}>
                  No permissions granted yet.
                </ThemedText>
              ) : (
                permissions.filter((p) => !p.revoked_at).map((perm) => {
                  const permIcons: Record<string, string> = { calendar: '📅', email: '📬', contacts: '👥', files: '📁', web: '🌐' }
                  return (
                    <View key={perm.id} style={styles.permGrantedRow}>
                      <ThemedText style={styles.permGrantedIcon}>{permIcons[perm.permission] || '🔑'}</ThemedText>
                      <ThemedText serif style={[styles.permGrantedName, { color: C.ink }]}>
                        {perm.permission.charAt(0).toUpperCase() + perm.permission.slice(1)}
                      </ThemedText>
                      <ThemedText style={[styles.permGrantedStatus, { color: C.pencil }]}>
                        {perm.grant_type === 'permanent' ? 'Always' : 'Once'}
                      </ThemedText>
                      <Pressable onPress={() => handleRevokePermission(perm.id)} dataSet={{ hover: 'darken' }} style={styles.panelAction}>
                        <ThemedText style={{ color: C.waxSeal, fontSize: 11 }}>Revoke</ThemedText>
                      </Pressable>
                    </View>
                  )
                })
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

            <View style={styles.sessionBar}>
              <Pressable
                onPress={async () => {
                  if (!agentId) return
                  const session = await createNewSession(agentId)
                  setActiveSession(session)
                  setMessages([])
                  const { sessions } = await getAgentSessions(agentId)
                  setSessions(sessions)
                }}
                dataSet={{ hover: 'vellum' }}
                style={styles.newChatBtn}
              >
                <ThemedText style={[styles.newChatText, { color: C.pencil }]}>+ New chat</ThemedText>
              </Pressable>
              {sessions.length > 1 && (
                <Pressable
                  onPress={() => setShowSessions(!showSessions)}
                  dataSet={{ hover: 'vellum' }}
                  style={styles.newChatBtn}
                >
                  <ThemedText style={[styles.newChatText, { color: C.pencil }]}>
                    {showSessions ? 'Hide history' : `${sessions.length} chats`}
                  </ThemedText>
                </Pressable>
              )}
            </View>

            {showSessions && (
              <View style={styles.sessionList}>
                {sessions.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={async () => {
                      if (!agentId) return
                      setActiveSession(s)
                      const { messages } = await getSessionMessages(agentId, s.id)
                      setMessages(messages)
                      setShowSessions(false)
                    }}
                    dataSet={{ hover: 'vellum' }}
                    style={[styles.sessionItem, activeSession?.id === s.id && styles.sessionItemActive]}
                  >
                    <View style={[styles.sessionDot, { backgroundColor: s.is_active ? C.connectedText : C.ruledLine }]} />
                    <ThemedText style={[styles.sessionText, { color: activeSession?.id === s.id ? C.ink : C.pencil }]}>
                      {s.title || new Date(s.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            )}

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
              <View style={styles.permIcon}>
                <SvgIcon name="shield" size={16} color={C.tide} />
              </View>
              <View style={styles.permBody}>
                <ThemedText style={[styles.permTitle, { color: C.ink }]}>
                  Allow {req.permission} access?
                </ThemedText>
                <ThemedText style={[styles.permDesc, { color: C.pencil }]}>
                  {req.reason || `${agent?.name} wants to use ${req.permission} tools.`}
                </ThemedText>
                <View style={styles.permActions}>
                  <Pressable
                    onPress={() => handleGrantPermission(req.id, 'permanent')}
                    dataSet={{ hover: 'solid' }}
                    style={styles.permBtnAllow}
                  >
                    <ThemedText style={[styles.permBtnText, { color: C.white }]}>Allow</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => handleGrantPermission(req.id, 'one_time')}
                    dataSet={{ hover: 'vellum' }}
                    style={styles.permBtnOnce}
                  >
                    <ThemedText style={[styles.permBtnText, { color: C.ink }]}>Once</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDenyPermission(req.id)}
                    dataSet={{ hover: 'darken' }}
                    style={styles.permBtnDeny}
                  >
                    <ThemedText style={[styles.permBtnDenyText, { color: C.pencil }]}>Deny</ThemedText>
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {showGoogleConnect && (
        <View style={styles.permBar}>
          <View style={styles.permCard}>
            <View style={styles.permIcon}>
              {isWeb ? React.createElement('div', {
                style: { width: 16, height: 16 },
                dangerouslySetInnerHTML: { __html: '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 001 12c0 1.94.46 3.77 1.18 5.41l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>' },
              }) : null}
            </View>
            <View style={styles.permBody}>
              <ThemedText style={[styles.permTitle, { color: C.ink }]}>
                Connect Google account
              </ThemedText>
              <ThemedText style={[styles.permDesc, { color: C.pencil }]}>
                Required for calendar, email, contacts, and drive tools.
              </ThemedText>
              <View style={styles.permActions}>
                <Pressable onPress={handleConnectGoogle} dataSet={{ hover: 'solid' }} style={styles.permBtnAllow}>
                  <ThemedText style={[styles.permBtnText, { color: C.white }]}>Connect</ThemedText>
                </Pressable>
                <Pressable onPress={() => setShowGoogleConnect(false)} dataSet={{ hover: 'darken' }} style={styles.permBtnDeny}>
                  <ThemedText style={[styles.permBtnDenyText, { color: C.pencil }]}>Dismiss</ThemedText>
                </Pressable>
              </View>
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
            <ThemedText style={[styles.sendBtnText, { color: C.white }]}>↑</ThemedText>
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
  sectionLabel: {
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 1,
    marginBottom: 8,
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },
  integrationCard: {
    backgroundColor: C.agedPaper,
    borderRadius: 10,
    padding: 14,
    marginBottom: 4,
  },
  integrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  integrationIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.parchment,
    alignItems: 'center',
    justifyContent: 'center',
  },
  integrationInfo: {
    flex: 1,
    gap: 2,
  },
  integrationName: {
    fontSize: 14,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-serif)' } as any),
  },
  integrationDesc: {
    fontSize: 11,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  integrationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  integrationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  integrationStatus: {
    fontSize: 11,
    fontWeight: '500',
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },
  integrationConnectBtn: {
    backgroundColor: C.ink,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  integrationConnectText: {
    fontSize: 12,
    fontWeight: '500',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  permGrantedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  permGrantedIcon: {
    fontSize: 18,
  },
  permGrantedName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-serif)' } as any),
  },
  permGrantedStatus: {
    fontSize: 10,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
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

  // ── Sessions ──
  sessionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  newChatBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    ...(isWeb && { cursor: 'pointer', transition: 'background-color 150ms ease' } as any),
  },
  newChatText: {
    fontSize: 11,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },
  sessionList: {
    marginTop: 8,
    gap: 2,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    ...(isWeb && { cursor: 'pointer', transition: 'background-color 150ms ease' } as any),
  },
  sessionItemActive: {
    backgroundColor: C.agedPaper,
  },
  sessionDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  sessionText: {
    fontSize: 11,
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  permCard: {
    flexDirection: 'row',
    backgroundColor: C.agedPaper,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  permIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: C.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  permBody: {
    flex: 1,
    gap: 4,
  },
  permTitle: {
    fontSize: 13,
    fontWeight: '500',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  permDesc: {
    fontSize: 12,
    lineHeight: 18,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  permActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  permBtnAllow: {
    backgroundColor: C.ink,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  permBtnOnce: {
    backgroundColor: C.parchment,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  permBtnDeny: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  permBtnText: {
    fontSize: 12,
    fontWeight: '500',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  permBtnDenyText: {
    fontSize: 11,
    fontWeight: '400',
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
