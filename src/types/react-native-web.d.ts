import 'react-native'

/**
 * Extend React Native's ViewProps to include React Native Web's
 * `dataSet` prop, which maps to HTML `data-*` attributes.
 */
declare module 'react-native' {
  interface ViewProps {
    dataSet?: Record<string, string | undefined>
  }
}
