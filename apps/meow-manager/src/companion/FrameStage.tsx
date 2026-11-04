import React, { useCallback, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { faceSources, roomSource, HEAD_RATIO, characterLayout } from "./assets";
import { layerOpacities, single, type Weights } from "./timeline";
import { useFrameClock } from "./useFrameClock";
import type { FrameStageProps } from "./FrameStage.types";
export default function FrameStage(props: FrameStageProps) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [ready, setReady] = useState(false);
  const loaded = useRef(new Set<string>());
  const [weights, setWeights] = useState<Weights>(
    props.opening === "doze" ? single(2) : single(4),
  );
  const key = useRef("");
  const paint = useCallback((value: Weights) => {
    const next = value.map((x) => x.toFixed(4)).join(",");
    if (next !== key.current) {
      key.current = next;
      setWeights(value);
    }
  }, []);
  useFrameClock(props, ready, paint);
  function onLoad(id: string) {
    loaded.current.add(id);
    if (loaded.current.size === 8) setReady(true);
  }
  const c = characterLayout(size.width, size.height),
    head = c.size * HEAD_RATIO;
  const opacity = layerOpacities(weights);
  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize(e.nativeEvent.layout)}
      accessibilityLabel="Animated 2D kitty"
      accessibilityRole="image"
    >
      <Image
        source={roomSource}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onLoad={() => onLoad("room")}
        onError={props.onError}
        accessible={false}
      />
      <View
        style={{
          position: "absolute",
          width: c.size,
          height: c.size,
          left: c.left,
          top: c.top,
        }}
        pointerEvents="none"
      >
        <View
          style={{
            position: "absolute",
            top: head,
            width: c.size,
            height: c.size - head,
            overflow: "hidden",
          }}
        >
          <Image
            source={faceSources[0]}
            style={{
              position: "absolute",
              top: -head,
              width: c.size,
              height: c.size,
            }}
            onLoad={() => onLoad("body")}
            onError={props.onError}
            accessible={false}
          />
        </View>
        <View
          style={{
            position: "absolute",
            width: c.size,
            height: head,
            overflow: "hidden",
          }}
        >
          {faceSources.map((source, i) => (
            <Image
              key={i}
              source={source}
              style={{
                position: "absolute",
                width: c.size,
                height: c.size,
                opacity: opacity[i],
              }}
              onLoad={() => onLoad(String(i))}
              onError={props.onError}
              accessible={false}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
