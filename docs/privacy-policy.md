# Privacy Policy

**Last updated: March 31, 2026**

## 1. Introduction

Lasu ("we", "us", "our") operates an AI-powered personal assistant service. This Privacy Policy explains how we collect, use, store, and protect your personal information.

## 2. Information we collect

### Information you provide
- **Phone number**: Used for account creation, authentication, and SMS communication.
- **Messages**: The content of messages you send to and receive from the Service.
- **Memory data**: Facts and information extracted from your conversations, stored as key-value pairs linked to your account.

### Information collected automatically
- **Usage data**: Timestamps, message counts, and interaction patterns.
- **Device information**: Device type, operating system, and browser type when using the application.

## 3. How we use your information

We use your information to:
- Provide, maintain, and improve the Service
- Send and receive SMS messages on your behalf
- Extract and store memory facts to personalize responses
- Generate AI-powered responses using your conversation history and stored memory
- Authenticate your identity
- Communicate service updates

## 4. AI processing

Your messages and stored memory are sent to third-party AI providers (currently OpenAI) to generate responses. We send only the minimum context necessary. AI providers may process your data according to their own policies, but we use API configurations that do not permit training on your data.

## 5. Data storage and security

- Your data is stored in Supabase (hosted on AWS) with row-level security enabled.
- Phone numbers are stored in E.164 format.
- We use the Supabase service role key only on our backend server, never in client applications.
- Twilio handles SMS delivery and phone verification with their own security measures.
- We implement reasonable technical and organizational measures to protect your data, but no method of transmission or storage is 100% secure.

## 6. Data retention

- **Messages**: Retained for the lifetime of your account to provide conversation context.
- **Memory data**: Retained until you delete specific facts or your account.
- **Account data**: Retained until you request account deletion.

Upon account deletion, we will delete your data within 30 days, except where retention is required by law.

## 7. Data sharing

We do not sell your personal information. We share data only with:
- **AI providers** (OpenAI): To generate responses, via API with no-training configurations.
- **Twilio**: To send and receive SMS messages and verify phone numbers.
- **Supabase**: For data storage and real-time functionality.
- **Law enforcement**: When required by law or to protect rights and safety.

## 8. Your rights

You have the right to:
- **Access**: View all data we store about you through the application.
- **Delete**: Request deletion of your memory data or entire account.
- **Portability**: Request an export of your data.
- **Correction**: Update or correct your information.
- **Opt out of SMS**: Text STOP to our number at any time.

To exercise these rights, use the application settings or contact us at privacy@lasu.ai.

## 9. Children's privacy

The Service is not intended for anyone under 18 years of age. We do not knowingly collect information from children.

## 10. California residents (CCPA)

If you are a California resident, you have additional rights under the CCPA, including the right to know what personal information we collect and the right to request deletion. We do not sell personal information.

## 11. International users

The Service is operated in the United States. If you access the Service from outside the US, your information will be transferred to and processed in the US.

## 12. Changes to this policy

We may update this Privacy Policy from time to time. We will notify you of material changes via the Service or SMS. Continued use after changes constitutes acceptance.

## 13. Contact

For questions about this Privacy Policy, contact us at privacy@lasu.ai.
