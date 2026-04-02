import React, { useCallback, useEffect, useRef, useState } from 'react'
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
import { SvgIcon } from '@/components/icons'
import { Colors } from '@/constants/theme'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { listAgents, createAgent, deleteAgent, type Agent } from '@/lib/api'

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
  const [emoji, setEmoji] = useState('🤖')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [tone, setTone] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  useEffect(() => {
    if (!menuOpen || Platform.OS !== 'web') return
    const handler = () => setMenuOpen(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [menuOpen])

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

  const refresh = () => {
    if (!userId) return
    listAgents(userId)
      .then(({ agents }) => setAgents(agents))
      .catch(() => {})
  }

  const handleDelete = async (agentId: string) => {
    setDeleting(agentId)
    try {
      await deleteAgent(agentId)
      setAgents((prev) => prev.filter((a) => a.id !== agentId))
    } catch {
    } finally {
      setDeleting(null)
    }
  }

  const handleCreate = async () => {
    if (!userId || !name.trim() || !description.trim()) return
    setCreating(true)
    setError('')
    try {
      const finalEmoji = avatarUrl || emoji
      const finalTone = tone.trim() || 'balanced'
      const agent = await createAgent(userId, name.trim(), description.trim(), finalEmoji, finalTone)
      setShowCreate(false)
      setName('')
      setDescription('')
      setEmoji('🤖')
      setAvatarUrl(null)
      setTone('')
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
          {/* Avatar picker */}
          <View style={styles.emojiSection}>
            <Pressable
              onPress={() => setShowEmojiPicker(!showEmojiPicker)}
              style={styles.emojiBtn}
            >
              {avatarUrl ? (
                isWeb ? React.createElement('img', {
                  src: avatarUrl,
                  style: { width: 48, height: 48, borderRadius: 12, objectFit: 'cover' },
                }) : null
              ) : (
                <ThemedText style={styles.emojiBtnText}>{emoji}</ThemedText>
              )}
            </Pressable>
            <ThemedText style={[styles.emojiHint, { color: C.pencil }]}>Tap to change</ThemedText>
          </View>
          {showEmojiPicker && (
            <Animated.View entering={FadeIn.duration(150)} style={styles.emojiGrid}>
              {['🤖','🧠','🔍','📊','🎯','💡','⚡','🌐'].map((e) => (
                <Pressable
                  key={e}
                  onPress={() => { setEmoji(e); setAvatarUrl(null); setShowEmojiPicker(false) }}
                  dataSet={{ hover: 'vellum' }}
                  style={[styles.emojiOption, !avatarUrl && emoji === e && styles.emojiOptionActive]}
                >
                  <ThemedText style={styles.emojiOptionText}>{e}</ThemedText>
                </Pressable>
              ))}
              <Pressable
                onPress={() => { if (isWeb) fileInputRef.current?.click() }}
                dataSet={{ hover: 'vellum' }}
                style={styles.emojiOption}
              >
                <SvgIcon name="image" size={20} color={C.pencil} />
              </Pressable>
            </Animated.View>
          )}
          {isWeb && React.createElement('input', {
            ref: fileInputRef,
            type: 'file',
            accept: 'image/*',
            style: { display: 'none' },
            onChange: async (e: any) => {
              const file = e.target.files?.[0]
              if (!file) return
              const ext = file.name.split('.').pop()
              const path = `${Date.now()}.${ext}`
              const { error } = await supabase.storage.from('avatars').upload(path, file)
              if (error) return
              const { data } = supabase.storage.from('avatars').getPublicUrl(path)
              setAvatarUrl(data.publicUrl)
              setShowEmojiPicker(false)
            },
          })}

          <ThemedText style={[styles.formLabel, { color: C.pencil }]}>NAME</ThemedText>
          <TextInput
            placeholder="e.g. Atlas, Scout, Sage..."
            placeholderTextColor={C.ruledLine}
            value={name}
            onChangeText={setName}
            autoFocus
            style={[styles.input, { color: C.ink }]}
          />

          <ThemedText style={[styles.formLabel, { color: C.pencil }]}>DESCRIPTION</ThemedText>
          <TextInput
            placeholder="What should this agent do? Be specific — this shapes its personality and abilities."
            placeholderTextColor={C.ruledLine}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            style={[styles.input, styles.inputMulti, { color: C.ink }]}
          />

          <ThemedText style={[styles.formLabel, { color: C.pencil }]}>TONE</ThemedText>
          <TextInput
            placeholder="e.g. casual and friendly, concise and direct, formal..."
            placeholderTextColor={C.ruledLine}
            value={tone}
            onChangeText={setTone}
            style={[styles.input, { color: C.ink }]}
          />

          {error ? (
            <ThemedText style={[styles.errorText, { color: C.errorText }]}>{error}</ThemedText>
          ) : null}

          <View style={styles.createActions}>
            <Pressable
              onPress={() => { setShowCreate(false); setName(''); setDescription(''); setEmoji('🤖'); setAvatarUrl(null); setTone(''); setError(''); setShowEmojiPicker(false) }}
              dataSet={{ hover: 'darken' }}
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
            >
              <ThemedText style={[styles.cancelText, { color: C.pencil }]}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={handleCreate}
              disabled={creating || !name.trim() || !description.trim()}
              dataSet={{ hover: 'solid' }}
              style={({ pressed }) => [
                styles.submitBtn,
                (creating || !name.trim() || !description.trim()) && { opacity: 0.4 },
                pressed && { opacity: 0.7 },
              ]}
            >
              {creating ? (
                <ActivityIndicator color={C.white} size="small" />
              ) : (
                <ThemedText style={[styles.submitBtnText, { color: C.white }]}>Create Agent</ThemedText>
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
            <Animated.View
              key={agent.id}
              entering={FadeInDown.duration(300).delay(i * 80)}
              dataSet={{ hover: 'border' }}
              style={styles.agentCard}
            >
              <Pressable
                onPress={() => { if (!menuOpen) router.push(`/chat/${agent.id}`) }}
                style={styles.agentCardInner}
              >
                <View style={styles.agentAvatar}>
                  {agent.emoji?.startsWith('http') ? (
                    isWeb ? React.createElement('img', {
                      src: agent.emoji,
                      style: { width: 40, height: 40, borderRadius: 12, objectFit: 'cover' },
                    }) : null
                  ) : (
                    <ThemedText style={styles.agentEmoji}>
                      {agent.emoji || agent.name.charAt(0).toUpperCase()}
                    </ThemedText>
                  )}
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
              </Pressable>
                <View style={styles.menuWrapper}>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation()
                      setMenuOpen(menuOpen === agent.id ? null : agent.id)
                    }}
                    dataSet={{ hover: 'menuTrigger' }}
                    style={styles.menuBtn}
                  >
                    <ThemedText style={[styles.menuDots, { color: C.pencil }]}>⋮</ThemedText>
                  </Pressable>
                  <View
                    style={[
                      styles.menuDropdown,
                      {
                        opacity: menuOpen === agent.id ? 1 : 0,
                        transform: [{ translateY: menuOpen === agent.id ? 0 : -4 }],
                        pointerEvents: menuOpen === agent.id ? 'auto' : 'none',
                      } as any,
                    ]}
                  >
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation()
                        setMenuOpen(null)
                        handleDelete(agent.id)
                      }}
                      disabled={deleting === agent.id}
                      dataSet={{ hover: 'vellum' }}
                      style={({ pressed }) => [
                        styles.menuItem,
                        pressed && { backgroundColor: C.vellum },
                      ]}
                    >
                      <ThemedText style={[styles.menuItemText, { color: '#C53030' }]}>
                        {deleting === agent.id ? 'Deleting...' : 'Delete'}
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
            </Animated.View>
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
    marginBottom: 32,
    gap: 6,
  },
  emojiSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  emojiBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: C.agedPaper,
    alignItems: 'center',
    justifyContent: 'center',
    ...(isWeb && { cursor: 'pointer', transition: 'background-color 150ms ease' } as any),
  },
  emojiBtnText: {
    fontSize: 28,
  },
  emojiHint: {
    fontSize: 10,
    marginTop: 6,
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 2,
    marginBottom: 8,
  },
  emojiOption: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    ...(isWeb && { cursor: 'pointer', transition: 'background-color 150ms ease' } as any),
  },
  emojiOptionActive: {
    backgroundColor: C.agedPaper,
  },
  emojiOptionText: {
    fontSize: 20,
  },
  formLabel: {
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 2,
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },
  input: {
    backgroundColor: C.agedPaper,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    ...(isWeb && { fontFamily: 'var(--font-display)', outlineStyle: 'none' } as any),
  },
  inputMulti: { minHeight: 100, textAlignVertical: 'top' },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
    marginTop: 16,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  cancelText: {
    fontSize: 13,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  submitBtn: {
    backgroundColor: C.ink,
    paddingVertical: 11,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '500',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
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
    backgroundColor: C.parchment,
    borderRadius: 10,
    padding: 16,
    ...(isWeb && { transition: 'background-color 150ms ease', minWidth: 280 } as any),
  },
  agentCardInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  agentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.agedPaper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentEmoji: { fontSize: 20 },
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
  menuWrapper: {
    position: 'relative',
  },
  menuBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  menuDots: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
  },
  menuDropdown: {
    position: 'absolute',
    top: 32,
    right: 0,
    backgroundColor: C.parchment,
    borderWidth: 0.5,
    borderColor: C.ruledLine,
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 120,
    ...(isWeb && {
      boxShadow: '0 4px 12px rgba(26, 26, 24, 0.1)',
      zIndex: 10,
      transition: 'opacity 150ms ease, transform 150ms ease',
    } as any),
  },
  menuItem: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    marginHorizontal: 4,
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
})
