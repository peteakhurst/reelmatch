import { StyleSheet, Text, View } from 'react-native';
import { palette, text } from '../theme';

export function StreamingChip({ name, color = palette.magenta }: { name: string; color?: string }) {
  return (
    <View style={[styles.wrap, { borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{name.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  text: {
    ...text.monoSm,
    fontSize: 11,
    letterSpacing: 1.5,
  },
});
