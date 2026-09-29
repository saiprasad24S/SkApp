import React, { useState } from 'react';
import { View, Image, StyleSheet, Text, ViewStyle, StyleProp } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Circle } from 'react-native-svg';

interface GradientAvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  strokeWidth?: number;
  innerSpacing?: number;
  style?: StyleProp<ViewStyle>;
}

export const GradientAvatar: React.FC<GradientAvatarProps> = ({
  uri,
  name = 'Employee',
  size = 108,
  strokeWidth = 3.5,
  innerSpacing = 3,
  style,
}) => {
  const [imageError, setImageError] = useState(false);

  const radius = (size - strokeWidth) / 2;
  const imageSize = size - strokeWidth * 2 - innerSpacing * 2;
  const initials = (name || 'E')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const showFallback = !uri || imageError;

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {/* Smooth Purple to Blue Gradient Ring */}
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={styles.svg}>
        <Defs>
          <LinearGradient id="avatarGradientRing" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#7C3AED" />
            <Stop offset="45%" stopColor="#6366F1" />
            <Stop offset="80%" stopColor="#0EA5E9" />
            <Stop offset="100%" stopColor="#06B6D4" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#avatarGradientRing)"
          strokeWidth={strokeWidth}
          fill="none"
        />
      </Svg>

      {/* Inner White Spacing / Border Ring */}
      <View
        style={[
          styles.innerRing,
          {
            width: imageSize,
            height: imageSize,
            borderRadius: imageSize / 2,
          },
        ]}
      >
        {showFallback ? (
          <View style={[styles.placeholder, { borderRadius: imageSize / 2 }]}>
            <Text style={[styles.initialsText, { fontSize: Math.max(16, Math.floor(imageSize * 0.36)) }]}>
              {initials}
            </Text>
          </View>
        ) : (
          <Image
            source={{ uri }}
            style={{ width: '100%', height: '100%', borderRadius: imageSize / 2 }}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  innerRing: {
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#ffffff',
    fontWeight: '700',
    letterSpacing: 1,
  },
});

export default GradientAvatar;
