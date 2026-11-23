import { useWindowDimensions } from 'react-native';
import { layout } from './tokens';

/**
 * Width of the centred content column. Reads the *current* window size so it
 * updates when an iPhone Duo folds/unfolds (or a window resizes) — never cache
 * Dimensions at module load.
 */
export function useContentWidth(): number {
  const { width } = useWindowDimensions();
  return Math.min(width, layout.maxContentWidth);
}
