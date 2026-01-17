import React from 'react';
import Svg, { Circle, Path, Defs, LinearGradient, Stop, G, Ellipse } from 'react-native-svg';
import { KurdistanColors } from '../../theme/colors';

interface PezTokenLogoProps {
  size?: number;
}

/**
 * PEZ Token Logo - Matches the official pez_token_512.png design
 * 6 ovals around (alternating red and green)
 * Central sun with rays
 * Stylized Pezkuwi (mountain goat) head silhouette
 */
const PezTokenLogo: React.FC<PezTokenLogoProps> = ({ size = 56 }) => {
  // Generate 6 ovals positioned around the center
  const ovals = [
    { cx: 50, cy: 15, color: KurdistanColors.kesk },   // Top - green
    { cx: 80, cy: 30, color: KurdistanColors.sor },    // Top right - red
    { cx: 80, cy: 70, color: KurdistanColors.kesk },   // Bottom right - green
    { cx: 50, cy: 85, color: KurdistanColors.sor },    // Bottom - red
    { cx: 20, cy: 70, color: KurdistanColors.kesk },   // Bottom left - green
    { cx: 20, cy: 30, color: KurdistanColors.sor },    // Top left - red
  ];

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="pezSunGradient" x1="50%" y1="100%" x2="50%" y2="0%">
          <Stop offset="0%" stopColor="#FFD700" />
          <Stop offset="100%" stopColor="#FFA500" />
        </LinearGradient>
        <LinearGradient id="pezRamGradient" x1="50%" y1="0%" x2="50%" y2="100%">
          <Stop offset="0%" stopColor="#C4A35A" />
          <Stop offset="50%" stopColor="#8B7355" />
          <Stop offset="100%" stopColor="#5D4E37" />
        </LinearGradient>
      </Defs>

      {/* White background */}
      <Circle cx="50" cy="50" r="48" fill={KurdistanColors.spi} />

      {/* 6 Ovals around */}
      {ovals.map((oval, i) => (
        <Ellipse
          key={i}
          cx={oval.cx}
          cy={oval.cy}
          rx="12"
          ry="8"
          fill={oval.color}
          transform={`rotate(${i * 60}, ${oval.cx}, ${oval.cy})`}
        />
      ))}

      {/* Sun rays behind ram */}
      <G>
        {[...Array(16)].map((_, i) => {
          const angle = (i * 22.5) * (Math.PI / 180);
          const x1 = 50 + 18 * Math.cos(angle);
          const y1 = 50 + 18 * Math.sin(angle);
          const x2 = 50 + 28 * Math.cos(angle);
          const y2 = 50 + 28 * Math.sin(angle);
          return (
            <Path
              key={i}
              d={`M ${x1} ${y1} L ${x2} ${y2}`}
              stroke={KurdistanColors.zer}
              strokeWidth="3"
              strokeLinecap="round"
            />
          );
        })}
      </G>

      {/* Central circle for ram */}
      <Circle cx="50" cy="50" r="18" fill="url(#pezRamGradient)" />

      {/* Stylized Ram/Goat head silhouette */}
      {/* Ram face */}
      <Ellipse cx="50" cy="52" rx="10" ry="12" fill="#D4A96A" />

      {/* Ram horns - left */}
      <Path
        d="M 40 45 Q 32 38 30 48 Q 28 55 35 52"
        fill="none"
        stroke="#8B7355"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Ram horns - right */}
      <Path
        d="M 60 45 Q 68 38 70 48 Q 72 55 65 52"
        fill="none"
        stroke="#8B7355"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Ram ears - left */}
      <Ellipse cx="38" cy="48" rx="3" ry="5" fill="#C4A35A" />

      {/* Ram ears - right */}
      <Ellipse cx="62" cy="48" rx="3" ry="5" fill="#C4A35A" />

      {/* Ram eyes - left */}
      <Circle cx="45" cy="50" r="2" fill="#2D2D2D" />

      {/* Ram eyes - right */}
      <Circle cx="55" cy="50" r="2" fill="#2D2D2D" />

      {/* Ram nose */}
      <Ellipse cx="50" cy="58" rx="4" ry="3" fill="#8B6914" />

      {/* Ram nostrils */}
      <Circle cx="48" cy="58" r="1" fill="#5D4E37" />
      <Circle cx="52" cy="58" r="1" fill="#5D4E37" />
    </Svg>
  );
};

export default PezTokenLogo;
