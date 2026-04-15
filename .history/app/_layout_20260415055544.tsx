/**
 * Root Layout — expo-router
 *
 * Professional Web3 splash screen with "Get Started" button.
 * The splash stays visible until the user taps Get Started.
 */

import '@walletconnect/react-native-compat';

import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, StyleSheet, View, Text, Pressable, Dimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Defs, RadialGradient, Stop, Circle, LinearGradient, Polygon, Line, Rect, Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  Easing,
} from 'react-native-reanimated';

import { Web3Wrapper } from '@contexts/Web3Context';
import { EncryptionProvider } from '@contexts/EncryptionContext';
import { ErrorBoundary } from '@components/ErrorBoundary';
import { AppNavigator } from '@navigation/AppNavigator';

const { width: screenW, height: screenH } = Dimensions.get('window');

// ============================================
// Animated Background Orbs
// ============================================

function GlowOrb({ cx, cy, r, color, delay }: { cx: number; cy: number; r: number; color: string; delay: number }) {
  const opacity = useSharedValue(0.3);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.2, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.9, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(opacity.value, [0.2, 0.6], [0.15, 0.45]),
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.orbWrapper, { left: cx - r, top: cy - r, width: r * 2, height: r * 2 }, animatedStyle]}>
      <Svg width={r * 2} height={r * 2}>
        <Defs>
          <RadialGradient id={`orb-${color}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.6} />
            <Stop offset="50%" stopColor={color} stopOpacity={0.15} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={r} cy={r} r={r} fill={`url(#orb-${color})`} />
      </Svg>
    </Animated.View>
  );
}

// ============================================
// Animated Hex Grid (background decoration)
// ============================================

function HexGrid() {
  const hexSize = 40;
  const hexWidth = hexSize * 2;
  const hexHeight = Math.sqrt(3) * hexSize;

  const hexagons = [];
  for (let row = -1; row < 14; row++) {
    for (let col = -1; col < 8; col++) {
      const x = col * (hexWidth * 0.75) + (row % 2 === 0 ? hexWidth * 0.375 : 0);
      const y = row * hexHeight * 0.5;
      hexagons.push({ x, y, key: `${row}-${col}` });
    }
  }

  return (
    <Svg style={StyleSheet.absoluteFill} opacity={0.06}>
      {hexagons.map(({ x, y, key }) => {
        const points = Array.from({ length: 6 }, (_, i) => {
          const angle = (Math.PI / 180) * (60 * i - 30);
          return `${x + hexSize * Math.cos(angle)},${y + hexSize * Math.sin(angle)}`;
        }).join(' ');
        return <Polygon key={key} points={points} fill="none" stroke="#6C5CE7" strokeWidth={0.5} />;
      })}
    </Svg>
  );
}

// ============================================
// Network Nodes (floating dots + lines)
// ============================================

function NetworkNodes() {
  const nodes = [
    { x: 60, y: 120 }, { x: 180, y: 80 }, { x: 320, y: 150 },
    { x: 80, y: 320 }, { x: 260, y: 380 }, { x: 350, y: 280 },
    { x: 150, y: 450 }, { x: 50, y: 550 }, { x: 300, y: 520 },
    { x: 200, y: 600 }, { x: 380, y: 650 }, { x: 100, y: 700 },
  ];
  const lines = [
    [0, 1], [1, 2], [0, 3], [3, 4], [2, 5],
    [4, 6], [3, 7], [6, 8], [7, 9], [8, 10], [9, 11], [5, 8],
  ];

  return (
    <Svg style={StyleSheet.absoluteFill} opacity={0.12}>
      {lines.map(([a, b], i) => (
        <Line
          key={`l-${i}`}
          x1={nodes[a].x} y1={nodes[a].y}
          x2={nodes[b].x} y2={nodes[b].y}
          stroke="#00D2FF" strokeWidth={0.8}
        />
      ))}
      {nodes.map((n, i) => (
        <Circle key={`n-${i}`} cx={n.x} cy={n.y} r={2.5} fill="#00D2FF" />
      ))}
    </Svg>
  );
}

// ============================================
// Animated Shield Icon (SVG)
// ============================================

function VaultIcon() {
  const glowOpacity = useSharedValue(0.4);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.3, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.97, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowOpacity.value, [0.3, 0.8], [0.25, 0.6]),
    transform: [{ scale: pulseScale.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <View style={styles.iconContainer}>
      {/* Outer glow ring */}
      <Animated.View style={[styles.iconGlowRing, glowStyle]}>
        <Svg width={180} height={180}>
          <Defs>
            <RadialGradient id="icon-glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#6C5CE7" stopOpacity={0.5} />
              <Stop offset="40%" stopColor="#6C5CE7" stopOpacity={0.15} />
              <Stop offset="100%" stopColor="#6C5CE7" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={90} cy={90} r={90} fill="url(#icon-glow)" />
        </Svg>
      </Animated.View>

      {/* Main icon */}
      <Animated.View style={iconStyle}>
        <Svg width={120} height={140} viewBox="0 0 120 140">
          <Defs>
            <LinearGradient id="shield-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#A29BFE" />
              <Stop offset="50%" stopColor="#6C5CE7" />
              <Stop offset="100%" stopColor="#4834D4" />
            </LinearGradient>
            <LinearGradient id="shield-inner" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#00D2FF" />
              <Stop offset="100%" stopColor="#6C5CE7" />
            </LinearGradient>
            <LinearGradient id="lock-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#FFFFFF" />
              <Stop offset="100%" stopColor="#C8C6FF" />
            </LinearGradient>
            <LinearGradient id="lock-shackle" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#00D2FF" />
              <Stop offset="100%" stopColor="#4834D4" />
            </LinearGradient>
          </Defs>

          {/* Shield shape */}
          <Polygon
            points="60,5 110,30 110,75 60,130 10,75 10,30"
            fill="url(#shield-grad)"
            stroke="url(#shield-inner)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />

          {/* Inner shield border */}
          <Polygon
            points="60,18 100,38 100,72 60,120 20,72 20,38"
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={1}
            strokeLinejoin="round"
          />

          {/* Lock body */}
          <Rect x={40} y={62} width={40} height={32} rx={4} fill="url(#lock-grad)" />

          {/* Lock keyhole */}
          <Circle cx={60} cy={75} r={5} fill="#4834D4" />
          <Rect x={58} y={77} width={4} height={10} rx={2} fill="#4834D4" />

          {/* Lock shackle */}
          <Path
            d="M45,62 V50 A15,15 0 0 1 75,50 V62"
            fill="none"
            stroke="url(#lock-shackle)"
            strokeWidth={4}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

// ============================================
// Animated Entrance Text
// ============================================

function AnimatedTitle() {
  const titleY = useSharedValue(30);
  const titleOpacity = useSharedValue(0);
  const subY = useSharedValue(20);
  const subOpacity = useSharedValue(0);

  useEffect(() => {
    titleOpacity.value = withDelay(300, withTiming(1, { duration: 800 }));
    titleY.value = withDelay(300, withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) }));
    subOpacity.value = withDelay(600, withTiming(1, { duration: 800 }));
    subY.value = withDelay(600, withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) }));
  }, []);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));

  const subStyle = useAnimatedStyle(() => ({
    opacity: subOpacity.value,
    transform: [{ translateY: subY.value }],
  }));

  return (
    <View style={styles.titleBlock}>
      <Animated.Text style={[styles.appTitle, titleStyle]}>
        P2P STORAGE VAULT
      </Animated.Text>
      <Animated.Text style={[styles.appSubtitle, subStyle]}>
        Decentralized Encrypted Storage
      </Animated.Text>
      <Animated.Text style={[styles.appTagline, subStyle]}>
        Powered by IPFS & Blockchain
      </Animated.Text>
    </View>
  );
}

// ============================================
// Get Started Button
// ============================================

function GetStartedButton({ onPress }: { onPress: () => void }) {
  const btnOpacity = useSharedValue(0);
  const btnY = useSharedValue(20);
  const pressedScale = useSharedValue(1);

  useEffect(() => {
    btnOpacity.value = withDelay(1000, withTiming(1, { duration: 800 }));
    btnY.value = withDelay(1000, withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) }));
  }, []);

  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [
      { translateY: btnY.value },
      { scale: pressedScale.value },
    ],
  }));

  return (
    <Animated.View style={[styles.buttonWrapper, btnStyle]}>
      <Pressable
        onPressIn={() => {
          pressedScale.value = withTiming(0.95, { duration: 100 });
        }}
        onPressOut={() => {
          pressedScale.value = withTiming(1, { duration: 150 });
        }}
        onPress={onPress}
        style={styles.buttonTouchable}
      >
        <Svg width={320} height={56} style={styles.buttonSvg}>
          <Defs>
            <LinearGradient id="btn-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#6C5CE7" />
              <Stop offset="50%" stopColor="#A29BFE" />
              <Stop offset="100%" stopColor="#00D2FF" />
            </LinearGradient>
            <LinearGradient id="btn-border" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#A29BFE" />
              <Stop offset="100%" stopColor="#00D2FF" />
            </LinearGradient>
          </Defs>
          {/* Button background */}
          <Rect x={1} y={1} width={318} height={54} rx={27} fill="url(#btn-grad)" />
          {/* Border glow */}
          <Rect x={0} y={0} width={320} height={56} rx={28} fill="none" stroke="url(#btn-border)" strokeWidth={1} />
        </Svg>
        <View style={styles.buttonLabelWrapper}>
          <Text style={styles.buttonLabel}>GET STARTED</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ============================================
// Feature Pills (bottom section)
// ============================================

function FeaturePills() {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(1200, withTiming(1, { duration: 1000 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.pillsRow, animStyle]}>
      <View style={styles.pill}>
        <Text style={styles.pillEmoji}>🔐</Text>
        <Text style={styles.pillText}>E2E Encrypted</Text>
      </View>
      <View style={styles.pill}>
        <Text style={styles.pillEmoji}>🌐</Text>
        <Text style={styles.pillText}>IPFS Powered</Text>
      </View>
      <View style={styles.pill}>
        <Text style={styles.pillEmoji}>⛓️</Text>
        <Text style={styles.pillText}>Blockchain</Text>
      </View>
    </Animated.View>
  );
}

// ============================================
// SPLASH SCREEN (full component)
// ============================================

function SplashScreen({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <View style={styles.splashContainer}>
      {/* Background gradient */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width={screenW} height={screenH}>
          <Defs>
            <RadialGradient id="bg-radial" cx="50%" cy="35%" r="70%">
              <Stop offset="0%" stopColor="#1A1A4E" stopOpacity={0.5} />
              <Stop offset="60%" stopColor="#0D0D2B" stopOpacity={0.3} />
              <Stop offset="100%" stopColor="#0A0A1A" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={screenW} height={screenH} fill="#0A0A1A" />
          <Rect width={screenW} height={screenH} fill="url(#bg-radial)" />
        </Svg>
      </View>

      {/* Decorative layers */}
      <HexGrid />
      <NetworkNodes />

      {/* Floating orbs */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <GlowOrb cx={80} cy={200} r={120} color="#6C5CE7" delay={0} />
        <GlowOrb cx={320} cy={150} r={100} color="#00D2FF" delay={800} />
        <GlowOrb cx={200} cy={650} r={140} color="#4834D4" delay={1600} />
      </View>

      {/* Content */}
      <View style={styles.splashContent}>
        <View style={styles.topSpacer} />

        {/* Vault Icon */}
        <VaultIcon />

        {/* Title */}
        <AnimatedTitle />

        {/* Feature Pills */}
        <FeaturePills />

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Version */}
        <Text style={styles.versionText}>v1.0.0</Text>

        {/* Get Started Button */}
        <GetStartedButton onPress={onGetStarted} />

        {/* Bottom spacing for safe area */}
        <View style={styles.bottomSafe} />
      </View>
    </View>
  );
}

// ============================================
// ROOT LAYOUT
// ============================================

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  const handleGetStarted = useCallback(() => {
    setShowSplash(false);
  }, []);

  if (showSplash) {
    return <SplashScreen onGetStarted={handleGetStarted} />;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <Web3Wrapper>
            <EncryptionProvider>
              <View style={styles.container}>
                <StatusBar
                  barStyle="light-content"
                  backgroundColor="#0A0A1A"
                  translucent={false}
                />
                <AppNavigator />
              </View>
            </EncryptionProvider>
          </Web3Wrapper>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#F7F8FC',
  },

  // --- Splash ---
  splashContainer: {
    flex: 1,
    backgroundColor: '#0A0A1A',
  },
  splashContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  topSpacer: {
    flex: 0.8,
  },
  bottomSafe: {
    height: 40,
  },

  // --- Orbs ---
  orbWrapper: {
    position: 'absolute',
  },

  // --- Icon ---
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  iconGlowRing: {
    position: 'absolute',
  },

  // --- Title ---
  titleBlock: {
    alignItems: 'center',
    marginBottom: 24,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 3,
    marginBottom: 8,
  },
  appSubtitle: {
    fontSize: 14,
    color: 'rgba(162, 155, 254, 0.8)',
    fontWeight: '500',
    letterSpacing: 1,
    marginBottom: 4,
  },
  appTagline: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.35)',
    fontWeight: '400',
  },

  // --- Feature Pills ---
  pillsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 92, 231, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.25)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  pillText: {
    fontSize: 10,
    color: 'rgba(162, 155, 254, 0.9)',
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // --- Version ---
  versionText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.2)',
    fontWeight: '500',
    marginBottom: 20,
  },

  // --- Button ---
  buttonWrapper: {
    width: 320,
    height: 56,
    marginBottom: 8,
  },
  buttonTouchable: {
    width: '100%',
    height: '100%',
  },
  buttonSvg: {
    position: 'absolute',
  },
  buttonLabelWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 3,
  },
});