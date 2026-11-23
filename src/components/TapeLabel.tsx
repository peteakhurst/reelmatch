import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { palette, text } from '../theme';

export function TapeLabel({
  children,
  color = palette.magenta,
  style,
}: {
  children: string;
  color?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.wrap, { borderColor: color, backgroundColor: color }, style]}>
      <Text style={[styles.text, { color: palette.bg }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  text: {
    ...text.monoSm,
    fontSize: 11,
    letterSpacing: 1.5,
  },
});
