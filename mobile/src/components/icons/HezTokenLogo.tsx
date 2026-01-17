import React from 'react';
import Svg, { Circle, Path, Defs, LinearGradient, Stop, G, Text as SvgText, Polygon } from 'react-native-svg';
import { KurdistanColors } from '../../theme/colors';

interface HezTokenLogoProps {
  size?: number;
}

/**
 * HEZ Token Logo - Matches the official hez_token_512.png design
 * Three colored rings (Red, Yellow, Green)
 * Two mountains (green and red) with sun rising behind
 * "HEZ" text at bottom
 */
const HezTokenLogo: React.FC<HezTokenLogoProps> = ({ size = 56 }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="hezSunGradient" x1="50%" y1="100%" x2="50%" y2="0%">
          <Stop offset="0%" stopColor="#FFD700" />
          <Stop offset="100%" stopColor="#FFA500" />
        </LinearGradient>
      </Defs>

      {/* Outer Red Ring */}
      <Circle cx="50" cy="50" r="48" fill="none" stroke={KurdistanColors.sor} strokeWidth="4" />

      {/* Middle Yellow Ring */}
      <Circle cx="50" cy="50" r="42" fill="none" stroke={KurdistanColors.zer} strokeWidth="4" />

      {/* Inner Green Ring */}
      <Circle cx="50" cy="50" r="36" fill="none" stroke={KurdistanColors.kesk} strokeWidth="4" />

      {/* White Background Circle */}
      <Circle cx="50" cy="50" r="32" fill={KurdistanColors.spi} />

      {/* Sun behind mountains */}
      <Circle cx="50" cy="48" r="12" fill="url(#hezSunGradient)" />

      {/* Sun Rays */}
      <G>
        {[...Array(12)].map((_, i) => {
          const angle = ((i * 30) - 90) * (Math.PI / 180);
          const x1 = 50 + 14 * Math.cos(angle);
          const y1 = 48 + 14 * Math.sin(angle);
          const x2 = 50 + 20 * Math.cos(angle);
          const y2 = 48 + 20 * Math.sin(angle);
          // Only show rays above horizon (top half)
          if (y2 < 55) {
            return (
              <Path
                key={i}
                d={`M ${x1} ${y1} L ${x2} ${y2}`}
                stroke={KurdistanColors.zer}
                strokeWidth="2"
                strokeLinecap="round"
              />
            );
          }
          return null;
        })}
      </G>

      {/* Green Mountain (left, larger) */}
      <Polygon
        points="25,70 50,35 60,70"
        fill={KurdistanColors.kesk}
      />

      {/* Red Mountain (right, smaller, in front) */}
      <Polygon
        points="45,70 65,42 80,70"
        fill={KurdistanColors.sor}
      />

      {/* HEZ Text */}
      <SvgText
        x="50"
        y="80"
        fontSize="14"
        fontWeight="bold"
        fill={KurdistanColors.zer}
        textAnchor="middle"
      >
        HEZ
      </SvgText>
    </Svg>
  );
};

export default HezTokenLogo;
