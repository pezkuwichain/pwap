import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Defs, RadialGradient, Stop } from 'react-native-svg';

interface KurdistanSunProps {
  size?: number;
}

const AnimatedView = Animated.View;

export const KurdistanSun: React.FC<KurdistanSunProps> = ({ size = 200 }) => {
  // Animation values
  const greenHaloRotation = useRef(new Animated.Value(0)).current;
  const redHaloRotation = useRef(new Animated.Value(0)).current;
  const yellowHaloRotation = useRef(new Animated.Value(0)).current;
  const raysPulse = useRef(new Animated.Value(1)).current;
  const glowPulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Green halo rotation (3s, clockwise)
    Animated.loop(
      Animated.timing(greenHaloRotation, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Red halo rotation (2.5s, counter-clockwise)
    Animated.loop(
      Animated.timing(redHaloRotation, {
        toValue: -1,
        duration: 2500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Yellow halo rotation (2s, clockwise)
    Animated.loop(
      Animated.timing(yellowHaloRotation, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Rays pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(raysPulse, {
          toValue: 0.7,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(raysPulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 0.3,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0.6,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const greenSpin = greenHaloRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const redSpin = redHaloRotation.interpolate({
    inputRange: [-1, 0],
    outputRange: ['-360deg', '0deg'],
  });

  const yellowSpin = yellowHaloRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const haloSize = size * 0.9;
  const borderWidth = size * 0.02;

  // Generate 21 rays for Kurdistan flag
  const rays = Array.from({ length: 21 }).map((_, i) => {
    const angle = (i * 360) / 21;
    return (
      <Line
        key={i}
        x1="100"
        y1="100"
        x2="100"
        y2="20"
        stroke="rgba(255, 255, 255, 0.9)"
        strokeWidth="3"
        strokeLinecap="round"
        transform={`rotate(${angle} 100 100)`}
      />
    );
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Rotating colored halos */}
      <View style={styles.halosContainer}>
        {/* Green halo (outermost) */}
        <AnimatedView
          style={[
            styles.halo,
            {
              width: haloSize,
              height: haloSize,
              borderWidth: borderWidth,
              borderTopColor: '#00FF00',
              borderBottomColor: '#00FF00',
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              transform: [{ rotate: greenSpin }],
            },
          ]}
        />
        {/* Red halo (middle) */}
        <AnimatedView
          style={[
            styles.halo,
            {
              width: haloSize * 0.8,
              height: haloSize * 0.8,
              borderWidth: borderWidth,
              borderTopColor: 'transparent',
              borderBottomColor: 'transparent',
              borderLeftColor: '#FF0000',
              borderRightColor: '#FF0000',
              transform: [{ rotate: redSpin }],
            },
          ]}
        />
        {/* Yellow halo (inner) */}
        <AnimatedView
          style={[
            styles.halo,
            {
              width: haloSize * 0.6,
              height: haloSize * 0.6,
              borderWidth: borderWidth,
              borderTopColor: '#FFD700',
              borderBottomColor: '#FFD700',
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              transform: [{ rotate: yellowSpin }],
            },
          ]}
        />
      </View>

      {/* Kurdistan Sun SVG with 21 rays */}
      <AnimatedView style={[styles.svgContainer, { opacity: raysPulse }]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Defs>
            <RadialGradient id="sunGradient" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="rgba(255, 255, 255, 0.8)" />
              <Stop offset="100%" stopColor="rgba(255, 255, 255, 0.2)" />
            </RadialGradient>
          </Defs>

          {/* Sun rays (21 rays for Kurdistan flag) */}
          {rays}

          {/* Central white circle */}
          <Circle cx="100" cy="100" r="35" fill="white" />

          {/* Inner glow */}
          <Circle cx="100" cy="100" r="35" fill="url(#sunGradient)" />
        </Svg>
      </AnimatedView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  halosContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    borderRadius: 1000,
  },
  svgContainer: {
    position: 'relative',
    zIndex: 1,
  },
});

export default KurdistanSun;
