import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const isWeb = Platform.OS === 'web';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'label' | 'link' | 'code';
  themeColor?: ThemeColor;
  serif?: boolean;
};

export function ThemedText({ style, type = 'default', themeColor, serif, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        isWeb && styles.webBase,
        serif && isWeb && styles.serifWeb,
        type === 'default' && styles.default,
        type === 'h1' && styles.h1,
        type === 'h2' && styles.h2,
        type === 'h3' && styles.h3,
        type === 'body' && styles.body,
        type === 'small' && styles.small,
        type === 'label' && styles.label,
        type === 'link' && styles.link,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  webBase: {
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  serifWeb: {
    ...(isWeb && { fontFamily: 'var(--font-serif)' } as any),
  },
  default: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400',
  },
  h1: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '500',
  },
  h2: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '500',
  },
  h3: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '400',
  },
  small: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  label: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: 0.44,
    textTransform: 'uppercase',
  },
  link: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
  },
});
