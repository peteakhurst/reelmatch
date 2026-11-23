import { useLocalSearchParams } from 'expo-router';
import { MovieDetail } from '../../src/screens/MovieDetail';

export default function MovieRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) return null;
  return <MovieDetail id={numericId} />;
}
