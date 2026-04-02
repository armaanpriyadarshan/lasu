import { Platform, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ThemedText } from '@/components/themed-text'
import { Colors } from '@/constants/theme'

const C = Colors.light
const isWeb = Platform.OS === 'web'

export default function TermsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText serif style={[styles.title, { color: C.ink }]}>Terms of Service</ThemedText>

        <ThemedText serif style={[styles.heading, { color: C.ink }]}>1. Acceptance of Terms</ThemedText>
        <ThemedText style={[styles.body, { color: C.fadedInk }]}>By accessing or using sudo ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</ThemedText>

        <ThemedText serif style={[styles.heading, { color: C.ink }]}>2. Description of Service</ThemedText>
        <ThemedText style={[styles.body, { color: C.fadedInk }]}>sudo is an AI-powered personal assistant that communicates via SMS and a companion application. The Service processes your messages, extracts and stores information you share, and responds on your behalf.</ThemedText>

        <ThemedText serif style={[styles.heading, { color: C.ink }]}>3. Eligibility</ThemedText>
        <ThemedText style={[styles.body, { color: C.fadedInk }]}>You must be at least 18 years old and capable of forming a binding contract to use the Service.</ThemedText>

        <ThemedText serif style={[styles.heading, { color: C.ink }]}>4. Account and Phone Number</ThemedText>
        <ThemedText style={[styles.body, { color: C.fadedInk }]}>You register using your phone number. You are responsible for maintaining the security of your account and for all activity under it.</ThemedText>

        <ThemedText serif style={[styles.heading, { color: C.ink }]}>5. Acceptable Use</ThemedText>
        <ThemedText style={[styles.body, { color: C.fadedInk }]}>You agree not to use the Service for any unlawful purpose, transmit harmful content, attempt unauthorized access, send spam, or reverse engineer any part of the Service.</ThemedText>

        <ThemedText serif style={[styles.heading, { color: C.ink }]}>6. AI-Generated Content</ThemedText>
        <ThemedText style={[styles.body, { color: C.fadedInk }]}>The Service uses artificial intelligence to generate responses. AI-generated content may be inaccurate, incomplete, or inappropriate. Responses are not professional advice. You are responsible for evaluating and acting on any information provided.</ThemedText>

        <ThemedText serif style={[styles.heading, { color: C.ink }]}>7. Data and Memory</ThemedText>
        <ThemedText style={[styles.body, { color: C.fadedInk }]}>The Service extracts and stores facts from your conversations to provide personalized responses. You can view stored memory data in the application. You may request deletion of your data at any time.</ThemedText>

        <ThemedText serif style={[styles.heading, { color: C.ink }]}>8. Consent to Receive SMS Messages</ThemedText>
        <ThemedText style={[styles.body, { color: C.fadedInk }]}>By providing your phone number and verifying it through our application, you expressly consent to receive recurring SMS messages from sudo at the phone number you provided. These messages include responses from your AI agent, verification codes, and service-related notifications. Message frequency varies based on your usage. Message and data rates may apply. Your consent to receive SMS messages is not a condition of purchasing any goods or services, but is required to use the Service as SMS is the primary communication channel. You may revoke your consent and opt out of receiving SMS messages at any time by texting STOP to the sudo phone number. After opting out, you will receive a final confirmation message and no further SMS messages will be sent. You may text START to re-subscribe. For help, text HELP or contact support@getsudo.com.</ThemedText>

        <ThemedText serif style={[styles.heading, { color: C.ink }]}>9. Termination</ThemedText>
        <ThemedText style={[styles.body, { color: C.fadedInk }]}>We may terminate or suspend your account at any time for conduct that violates these Terms. You may terminate your account at any time through the application.</ThemedText>

        <ThemedText serif style={[styles.heading, { color: C.ink }]}>10. Disclaimer of Warranties</ThemedText>
        <ThemedText style={[styles.body, { color: C.fadedInk }]}>The Service is provided "as is" and "as available" without warranties of any kind, whether express or implied.</ThemedText>

        <ThemedText serif style={[styles.heading, { color: C.ink }]}>11. Limitation of Liability</ThemedText>
        <ThemedText style={[styles.body, { color: C.fadedInk }]}>In no event shall sudo be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Service.</ThemedText>

        <ThemedText serif style={[styles.heading, { color: C.ink }]}>12. Contact</ThemedText>
        <ThemedText style={[styles.body, { color: C.fadedInk }]}>For questions about these Terms, contact us at legal@getsudo.com.</ThemedText>
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
