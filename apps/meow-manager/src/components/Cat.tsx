import React, { memo, useEffect, useRef } from "react";
import { AccessibilityInfo, Animated } from "react-native";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";

/** Original vector character and room, drawn for Meow Manager. */
export const Cat = memo(function Cat({
  size = 220,
  happy = false,
}: {
  size?: number;
  happy?: boolean;
}) {
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let mounted = true;
    let loop: Animated.CompositeAnimation | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || !mounted) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breath, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(breath, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    });
    return () => {
      mounted = false;
      loop?.stop();
    };
  }, [breath]);
  return (
    <Animated.View
      style={{
        width: size,
        height: size * 0.85,
        transform: [
          {
            translateY: breath.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -3],
            }),
          },
        ],
      }}
      accessible={false}
    >
      <Svg width="100%" height="100%" viewBox="0 0 260 220">
        <Ellipse
          cx="136"
          cy="204"
          rx="91"
          ry="10"
          fill="#DCCFC0"
          opacity=".36"
        />
        <Path
          d="M184 175 C243 187 240 136 214 141 C195 145 220 170 192 166"
          fill="none"
          stroke="#E6A57D"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <Path
          d="M80 151 Q69 195 93 202 L169 202 Q192 194 176 149"
          fill="#F6CF9E"
          stroke="#715C4F"
          strokeWidth="2.5"
        />
        <Ellipse cx="129" cy="179" rx="33" ry="25" fill="#FFF0DA" />
        <Path
          d="M68 86 L68 35 Q69 22 80 33 L107 57 M157 57 L187 31 Q199 24 197 40 L192 92"
          fill="#F6CF9E"
          stroke="#715C4F"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <Path d="M76 66 L77 42 L96 62 M167 63 L187 41 L187 70" fill="#ECAFA4" />
        <Path
          d="M63 100 Q59 59 128 55 Q199 56 199 105 Q201 153 131 158 Q57 155 63 100"
          fill="#F6CF9E"
          stroke="#715C4F"
          strokeWidth="2.5"
        />
        <Path
          d="M117 57 L121 76 M132 56 L132 78 M146 58 L143 75"
          stroke="#DEA571"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <Ellipse cx="86" cy="122" rx="13" ry="7" fill="#ECAFA4" opacity=".7" />
        <Ellipse cx="176" cy="122" rx="13" ry="7" fill="#ECAFA4" opacity=".7" />
        {happy ? (
          <G fill="none" stroke="#5B4A45" strokeWidth="4" strokeLinecap="round">
            <Path d="M91 108 Q99 97 107 108" />
            <Path d="M153 108 Q161 97 169 108" />
          </G>
        ) : (
          <G fill="#5B4A45">
            <Ellipse cx="99" cy="106" rx="4.5" ry="7" />
            <Ellipse cx="162" cy="106" rx="4.5" ry="7" />
            <Circle cx="100" cy="103" r="1.4" fill="#FFF7ED" />
            <Circle cx="163" cy="103" r="1.4" fill="#FFF7ED" />
          </G>
        )}
        <Path d="M125 119 Q131 116 137 119 L131 125 Z" fill="#BB7F79" />
        <Path
          d="M131 125 L131 129 Q124 136 119 129 M131 129 Q138 136 144 129"
          fill="none"
          stroke="#715C4F"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <Path
          d="M79 115 L53 111 M79 125 L52 130 M184 115 L210 111 M184 125 L211 130"
          stroke="#96765D"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <Path
          d="M107 154 L130 160 L153 153 L145 170 L131 164 L115 172 Z"
          fill="#B5A5CC"
          stroke="#86749F"
          strokeWidth="1.5"
        />
        <Circle cx="131" cy="162" r="5" fill="#D2C6E2" />
        <Rect
          x="111"
          y="174"
          width="56"
          height="36"
          rx="5"
          fill="#FBF7EE"
          stroke="#AE9F8D"
          strokeWidth="2"
          transform="rotate(-8 140 192)"
        />
        <Path
          d="M124 183 L154 179 M125 190 L147 187 M126 198 L150 194"
          stroke="#C8BAA5"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <Ellipse
          cx="105"
          cy="186"
          rx="13"
          ry="10"
          fill="#F6CF9E"
          stroke="#715C4F"
          strokeWidth="2"
        />
        <Ellipse
          cx="174"
          cy="184"
          rx="13"
          ry="10"
          fill="#F6CF9E"
          stroke="#715C4F"
          strokeWidth="2"
        />
        <Ellipse
          cx="92"
          cy="202"
          rx="17"
          ry="9"
          fill="#F6CF9E"
          stroke="#715C4F"
          strokeWidth="2"
        />
      </Svg>
    </Animated.View>
  );
});

export function RoomDecoration() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 580 240"
      preserveAspectRatio="xMidYMid slice"
    >
      <Circle cx="490" cy="40" r="82" fill="#F8E4B8" opacity=".65" />
      <Path
        d="M440 54 L440 126 Q440 139 455 139 L528 139 Q542 139 542 126 L542 54 Z"
        fill="#FDF6E4"
        stroke="#EADDC0"
        strokeWidth="3"
      />
      <Path
        d="M491 51 L491 139 M441 98 L542 98"
        stroke="#EADDC0"
        strokeWidth="3"
      />
      <Path
        d="M45 191 L45 147 M45 172 Q18 172 24 149 Q47 147 45 172 M45 158 Q67 160 70 137 Q47 133 45 158"
        fill="#A9B59A"
        stroke="#8F9F82"
        strokeWidth="2"
      />
      <Path d="M24 181 L67 181 L61 215 L31 215 Z" fill="#DCA58B" />
      <Path d="M56 222 L530 222" stroke="#E5D9CC" strokeWidth="2" />
      <Rect x="443" y="195" width="54" height="12" rx="3" fill="#CEC0DB" />
      <Rect x="452" y="208" width="59" height="13" rx="3" fill="#E5BDA7" />
      <Path
        d="M386 61 L390 72 L401 76 L390 80 L386 91 L382 80 L371 76 L382 72 Z"
        fill="#E2C68D"
      />
    </Svg>
  );
}
