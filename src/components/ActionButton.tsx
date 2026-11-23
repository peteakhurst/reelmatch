import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, text } from '../theme';
import { SwipeIcon } from './SwipeIcon';

type Dir = 'left' | 'right' | 'up' | 'down';
type Variant = 'sm' | 'md' | 'lg';

const SIZE: Record<Variant, number> = { sm: 44, md: 52, lg: 64 };

export function ActionButton({
  dir,
  label,
  color,
  variant = 'md',
  onPress,
}: {
  dir: Dir;
  label: string;
  color: string;
  variant?: Variant;
  onPress?: () => void;
}) {
  const size = SIZE[variant];
  const big = variant === 'lg';
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.wrap}>
      {/* hard offset shadow for the big primary button */}
      {big ? <View style={[styles.bigShadow, { backgroundColor: color }]} /> : null}
      <View
        style={[
          styles.button,
          { width: size, height: size, borderColor: color },
        ]}
      >
        <SwipeIcon dir={dir} color={color} size={big ? 28 : 22} />
      </View>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 6,
  },
  button: {
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: SIZE.lg,
    height: SIZE.lg,
    opacity: 1,
  },
  label: {
    ...text.monoSm,
    fontSize: 11,
    letterSpacing: 2,
  },
});
