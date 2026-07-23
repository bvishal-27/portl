import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PaperProvider, MD3LightTheme } from "react-native-paper";
import { View, ActivityIndicator, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/authStore";

const queryClient = new QueryClient();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Register exactly 2 Action Buttons for Visitor Approvals on Mobile Lock Screen
Notifications.setNotificationCategoryAsync("VISITOR_APPROVAL", [
  {
    identifier: "APPROVE_ACTION",
    buttonTitle: "✅ Allow Entry",
    options: { opensAppToForeground: false },
  },
  {
    identifier: "DENY_ACTION",
    buttonTitle: "❌ Deny Entry",
    options: { isDestructive: true, opensAppToForeground: false },
  },
]);

async function registerForPushNotifications(userId: string) {
  if (!Device.isDevice) {
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log(
      "Notification permission not granted - go to phone Settings > Apps > portl > Notifications and enable manually",
    );
    return;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.log(
        "EAS projectId not found - check app.json extra.eas.projectId",
      );
      return;
    }

    let token = null;
    let attempts = 0;
    while (!token && attempts < 2) {
      try {
        attempts++;
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        token = tokenData.data;
      } catch (err) {
        if (attempts >= 2) throw err;
        await new Promise((res) => setTimeout(res, 2000));
      }
    }

    if (token) {
      const { error } = await supabase
        .from("profiles")
        .update({ push_token: token })
        .eq("id", userId);

      if (error) {
        console.log("Failed to save push token to Supabase:", error.message);
      }
    }
  } catch (err) {
    console.log("Push token registration skipped due to network availability.");
  }
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.session.user.id)
          .single();

        if (profile) {
          setSession(data.session.user.id, profile.role);
          registerForPushNotifications(data.session.user.id);
        }
      }
      setReady(true);
    };
    init();
  }, []);

  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener(() => {});

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const actionId = response.actionIdentifier;
        const visitorRequestId =
          response.notification.request.content.data?.visitorRequestId ||
          response.notification.request.content.data?.requestId;

        if (!visitorRequestId) return;

        if (actionId === "APPROVE_ACTION") {
          await supabase
            .from("visitor_requests")
            .update({ status: "approved" })
            .eq("id", visitorRequestId);
        } else if (actionId === "DENY_ACTION") {
          await supabase
            .from("visitor_requests")
            .update({ status: "denied" })
            .eq("id", visitorRequestId);
        }
      },
    );

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={MD3LightTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(resident)" />
          <Stack.Screen name="(guard)" />
          <Stack.Screen name="(admin)" />
        </Stack>
      </PaperProvider>
    </QueryClientProvider>
  );
}