import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { SwipeDeck } from '../src/screens/SwipeDeck';
import { useUser } from '../src/state/user';
import { palette } from '../src/theme';

export default function Index() {
  const { hydrated, onboarded } = useUser();

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.bg }}>
        <ActivityIndicator color={palette.magenta} />
      </View>
    );
  }
  if (!onboarded) return <Redirect href="/onboarding" />;
  return <SwipeDeck />;
}
