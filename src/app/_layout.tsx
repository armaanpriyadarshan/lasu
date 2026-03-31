import { Stack } from 'expo-router'
import React from 'react'
import { StatusBar } from 'expo-status-bar'

import { AuthProvider } from '@/lib/auth'

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 200,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(app)" />
      </Stack>
    </AuthProvider>
  )
}
