import { Platform, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ThemedText } from '@/components/themed-text'
import { Colors } from '@/constants/theme'

const C = Colors.light
const isWeb = Platform.OS === 'web'

export default function PrivacyScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText serif style={[styles.title, { color: C.ink }]}>Privacy Policy</ThemedText>

        <ThemedText serif style={[styles.heading, { color: C.ink }]}>1. Information We Collect</ThemedText>
        <ThemedText style={[styles.body, { color: C.fadedInk }]}>We collect your email address for authentication, the content of messages you send and receive, and memory data (facts extracted from your conversations). We also collect usage data such as timestamps and interaction patterns.</ThemedText>

        <ThemedText serif style={[styles.heading, { color: C.ink }]}>2. How We Use Your Information</ThemedText>
        <ThemedText style={[styles.body, { color: C.fadedInk }]}>We use your information to provide and improve the Service, extract and store memory facts for personalized responses, generate AI-powered responses, and authenticate your identity.</ThemedText>

        <ThemedText serif style={[styles.heading, { color: C.ink }]}>3. AI Processing</ThemedText>
        <ThemedText style={[styles.body, { color: C.fadedInk }]}>Your messages and stored memory are sent to third-party AI providers to generate responses. We send only the minimum context necessary. We use API configurations that do not permit training on your data.</ThemedText>

        <ThemedText serif style={[styles.heading, { color: C.ink }]}>5. Data Storage and Security</ThemedText>
        <ThemedText style={[styles.body, { color: C.fadedInk }]}>Your data is stored in Supabase with row-level security enabled. We implement reasonable technical and organizational measures to protect your data, but no method of transmission or storage is 100% secure.</ThemedText>

        <ThemedText serif style={[styles.heading, { color: C.ink }]}>6. Data Retention</ThemedText>
        <ThemedText style={[styles.body, { color: C.fadedInk }]}>Messages and memory data are retained for the lifetime of your account. Upon account deletion, we will delete your data within 30 days, except where retention is required by law.</ThemedText>

        <ThemedText serif style={[styles.heading, { color: C.ink }]}>7. Data Sharing</ThemedText>
        <ThemedText style={[styles.body, { color: C.fadedInk }]}>We do not sell your personal information. We share data only with AI providers (for generating responses), Supabase (for data storage and authentication), and law enforcement when required by law.</ThemedText>

        <ThemedText serif style={[styles.heading, { color: C.ink }]}>8. Your Rights</ThemedText>
        <ThemedText style={[styles.body, { color: C.fadedInk }]}>You have the right to access, delete, export, and correct your data. To exercise these rights, use the application settings or contact us.</ThemedText>

        <ThemedText serif style={[styles.heading, { color: C.ink }]}>9. Children's Privacy</ThemedText>
        <ThemedText style={[styles.body, { color: C.fadedInk }]}>The Service is not intended for anyone under 18 years of age. We do not knowingly collect information from children.</ThemedText>

        <ThemedText serif style={[styles.heading, { color: C.ink }]}>10. Contact</ThemedText>
        <ThemedText style={[styles.body, { color: C.fadedInk }]}>For questions about this Privacy Policy, contact us at privacy@getsudo.com.</ThemedText>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.parchment },
  content: {
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 64,
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '400',
    marginBottom: 24,
    ...(isWeb && { fontFamily: 'var(--font-serif)' } as any),
  },
  heading: {
    fontSize: 16,
    fontWeight: '400',
    marginTop: 24,
    marginBottom: 8,
    ...(isWeb && { fontFamily: 'var(--font-serif)' } as any),
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
})
