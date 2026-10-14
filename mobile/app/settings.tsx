import { Pressable, Text, View } from "react-native";
import Constants from "expo-constants";
import { useAuth } from "@/auth";
import { useTheme } from "@/lib/theme";

export default function Settings() {
  const theme = useTheme();
  const { session, signOut } = useAuth();
  return (
    <View style={{ padding: 20, gap: 16 }}>
      <View style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 16, gap: 4 }}>
        <Text style={{ color: theme.muted, fontSize: 13 }}>Signed in as</Text>
        <Text style={{ color: theme.text, fontSize: 17, fontWeight: "500" }}>{session?.user.email}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={() => void signOut()} style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 16 }}>
        <Text style={{ color: theme.critical, fontSize: 17, fontWeight: "500" }}>Sign out</Text>
      </Pressable>
      <Text style={{ color: theme.faint, fontSize: 13, textAlign: "center" }}>Selrano {Constants.expoConfig?.version}</Text>
    </View>
  );
}
