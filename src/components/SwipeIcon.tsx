import Svg, { Path, Circle } from 'react-native-svg';

type Dir = 'left' | 'right' | 'up' | 'down';

export function SwipeIcon({ dir, color, size = 22 }: { dir: Dir; color: string; size?: number }) {
  const stroke = color;
  const sw = 2.2;
  switch (dir) {
    case 'left':
      // X (nope)
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M5 5l14 14M19 5L5 19" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'right':
      // Heart (queue)
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M12 21s-7-4.35-9.5-9C.83 8.5 3 4 7 4c2.1 0 3.5 1.2 5 3 1.5-1.8 2.9-3 5-3 4 0 6.17 4.5 4.5 8C19 16.65 12 21 12 21z"
            fill={stroke}
            stroke={stroke}
            strokeWidth={1}
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'up':
      // Eye (seen)
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
          />
          <Circle cx={12} cy={12} r={3} stroke={stroke} strokeWidth={sw} fill="none" />
        </Svg>
      );
    case 'down':
      // Clock (later)
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={9} stroke={stroke} strokeWidth={sw} fill="none" />
          <Path d="M12 7v5l3 2" stroke={stroke} strokeWidth={sw} strokeLinecap="round" fill="none" />
        </Svg>
      );
  }
}
