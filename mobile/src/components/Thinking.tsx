import { useEffect, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { useTheme } from "@/lib/theme";

/** Shown before the first words: a softly pulsing dot, with what Selrano is doing when a tool runs. */
export function Thinking({ status }: { status: string | null }) {
  const theme = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View accessibilityRole="progressbar" accessibilityLabel={status || "Selrano is thinking"} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
      <Animated.View
        style={{
          width: 9,
          height: 9,
          borderRadius: 5,
          backgroundColor: theme.text,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) }]
        }}
      />
      {status ? <Text style={{ color: theme.muted, fontSize: 15, fontWeight: "500" }}>{status}</Text> : null}
    </View>
  );
}
