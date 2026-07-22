import { useEffect, useState, memo, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Alert,
  Image,
  Platform,
  Modal,
  Pressable,
  KeyboardAvoidingView,
} from "react-native";
import {
  TextInput,
  Button,
  Chip,
  Avatar,
  Divider,
  IconButton,
} from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const INK = "#15131F";
const INK_MUTED = "#6B6878";
const INK_FAINT = "#A6A3B3";
const ACCENT = "#4F3FE0";
const ACCENT_SOFT = "#EFECFD";
const GOLD = "#C9922B";
const PAGE_BG = "#EFEEF5";
const CARD_BG = "#FFFFFF";
const BORDER = "#ECEAF2";
const INPUT_BG = "#F5F4F9";
const SUCCESS = "#1E9E5A";
const SUCCESS_BG = "#E9F8EF";
const DANGER = "#C23B3B";
const DANGER_BG = "#FBEAEA";

type VisitorRequest = {
  id: string;
  status: string;
  entry_time: string | null;
  exit_time: string | null;
  pre_approved: boolean;
  created_at: string;
  visitors: {
    name: string;
    visitor_type: string;
    photo_url: string | null;
  } | null;
  flats: { flat_number: string; tower_id: string } | null;
};
type Tower = { id: string; name: string };
type Flat = { id: string; tower_id: string; flat_number: string };
type MyGuardProfile = { full_name: string; phone: string | null };

type SOSAlert = {
  id: string;
  emergency_type: string;
  status: string;
  created_at: string;
  profiles: {
    full_name: string;
    phone: string | null;
  } | null;
  flats: {
    flat_number: string;
    towers: { name: string } | null;
  } | null;
};

const statusColor = (status: string) => {
  if (status === "approved") return SUCCESS;
  if (status === "denied") return DANGER;
  return GOLD;
};

const statusBg = (status: string) => {
  if (status === "approved") return SUCCESS_BG;
  if (status === "denied") return DANGER_BG;
  return "#FBF3E4";
};

const isExpiredDelivery = (item: VisitorRequest) => {
  if (item.visitors?.visitor_type !== "delivery") return false;
  if (item.status !== "approved" || item.entry_time) return false;
  const minutesSince =
    (Date.now() - new Date(item.created_at).getTime()) / 60000;
  return minutesSince > 30;
};

const VisitorCard = memo(function VisitorCard({
  item,
  statusColor,
  statusBg,
  actionLoadingId,
  markEntry,
  markExit,
}: {
  item: VisitorRequest;
  statusColor: (s: string) => string;
  statusBg: (s: string) => string;
  actionLoadingId: string | null;
  markEntry: (id: string) => void;
  markExit: (id: string) => void;
}) {
  const expired = isExpiredDelivery(item);

  return (
    <View style={styles.card}>
      <View style={{ padding: 16 }}>
        <View style={styles.rowWithImage}>
          {item.visitors?.photo_url ? (
            <Image
              source={{ uri: item.visitors.photo_url }}
              style={styles.thumb}
            />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Text style={styles.thumbInitial}>
                {item.visitors?.name?.[0]?.toUpperCase() ?? "?"}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={styles.row}>
              <Text style={styles.visitorName} numberOfLines={1}>
                {item.visitors?.name}
              </Text>
              <Chip
                compact
                textStyle={{
                  color: expired ? DANGER : statusColor(item.status),
                  fontWeight: "600",
                  fontSize: 12,
                }}
                style={{
                  backgroundColor: expired ? DANGER_BG : statusBg(item.status),
                }}
              >
                {expired
                  ? "expired"
                  : item.pre_approved
                  ? "pre-approved"
                  : item.status}
              </Chip>
            </View>
            <Text style={styles.meta}>
              Flat {item.flats?.flat_number} · {item.visitors?.visitor_type}
            </Text>
            <Text style={styles.metaFaint}>
              {new Date(item.created_at).toLocaleString()}
            </Text>
            {(item.entry_time || item.exit_time) && (
              <View style={styles.timeRow}>
                {item.entry_time && (
                  <View style={styles.timeChip}>
                    <Text style={styles.timeChipText}>
                      In{" "}
                      {new Date(item.entry_time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                )}
                {item.exit_time && (
                  <View style={styles.timeChip}>
                    <Text style={styles.timeChipText}>
                      Out{" "}
                      {new Date(item.exit_time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
      {(item.status === "approved" && !item.entry_time && !expired) ||
      (item.entry_time && !item.exit_time) ? (
        <View>
          <Divider style={{ backgroundColor: BORDER }} />
          <View style={styles.cardActions}>
            {item.status === "approved" && !item.entry_time && !expired && (
              <Button
                mode="contained"
                icon="login"
                buttonColor={ACCENT}
                textColor="#fff"
                loading={actionLoadingId === item.id}
                disabled={actionLoadingId === item.id}
                onPress={() => markEntry(item.id)}
                style={styles.actionBtn}
              >
                Mark Entry
              </Button>
            )}
            {item.entry_time && !item.exit_time && (
              <Button
                mode="outlined"
                icon="logout"
                textColor={ACCENT}
                style={[styles.actionBtn, { borderColor: ACCENT }]}
                loading={actionLoadingId === item.id}
                disabled={actionLoadingId === item.id}
                onPress={() => markExit(item.id)}
              >
                Mark Exit
              </Button>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
});

export default function GuardHome() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("home");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [visitorType, setVisitorType] = useState("guest");
  const [customVisitorType, setCustomVisitorType] = useState("");

  const [otpVerify, setOtpVerify] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const actionLoadingRef = useRef<string | null>(null);
  const [requests, setRequests] = useState<VisitorRequest[]>([]);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [filterTower, setFilterTower] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchFlat, setSearchFlat] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const userId = useAuthStore((s) => s.userId);
  const clearSession = useAuthStore((s) => s.clearSession);

  const [sosAlerts, setSosAlerts] = useState<SOSAlert[]>([]);
  const [resolvingSosId, setResolvingSosId] = useState<string | null>(null);

  const [residents, setResidents] = useState<
    { full_name: string; flat_id: string | null }[]
  >([]);
  const [residentSearch, setResidentSearch] = useState("");
  const [showResidentResults, setShowResidentResults] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [myProfile, setMyProfile] = useState<MyGuardProfile | null>(null);

  useEffect(() => {
    actionLoadingRef.current = actionLoadingId;
  }, [actionLoadingId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearSession();
    router.replace("/(auth)/login");
  };

  const fetchActiveSosAlerts = async () => {
    const { data, error } = await supabase
      .from("sos_alerts")
      .select(
        `
        id,
        emergency_type,
        status,
        created_at,
        profiles:resident_id ( full_name, phone ),
        flats:flat_id ( flat_number, towers ( name ) )
      `
      )
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSosAlerts(data as any);
    }
  };

  const resolveSOS = async (sosId: string) => {
    setResolvingSosId(sosId);
    try {
      const { error } = await supabase
        .from("sos_alerts")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", sosId);

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      Alert.alert("Resolved", "The SOS alert has been marked as resolved.");
      fetchActiveSosAlerts();
    } finally {
      setResolvingSosId(null);
    }
  };

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from("visitor_requests")
      .select(
        "id, status, entry_time, exit_time, pre_approved, created_at, visitors(name, visitor_type, photo_url), flats(flat_number, tower_id)"
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error && data) setRequests(data as any);
  };

  const fetchTowers = async () => {
    const { data } = await supabase.from("towers").select("*").order("name");
    if (data) setTowers(data);
  };

  const fetchFlats = async () => {
    const { data } = await supabase
      .from("flats")
      .select("*")
      .order("flat_number");
    if (data) setFlats(data);
  };

  const fetchMyProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", userId)
      .single();
    if (data)
      setMyProfile({
        full_name: (data as any).full_name,
        phone: (data as any).phone ?? null,
      });
  };

  const fetchResidents = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, flat_id")
      .eq("role", "resident")
      .eq("approved", true);
    if (data) setResidents(data as any);
  };

  useEffect(() => {
    fetchRequests();
    fetchTowers();
    fetchFlats();
    fetchMyProfile();
    fetchResidents();
    fetchActiveSosAlerts();

    const channel = supabase
      .channel("visitor_requests_guard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visitor_requests" },
        () => fetchRequests()
      )
      .subscribe();

    const sosChannel = supabase
      .channel("guard_sos_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sos_alerts" },
        (payload) => {
          fetchActiveSosAlerts();
          if (payload.eventType === "INSERT") {
            Alert.alert(
              "🚨 EMERGENCY SOS ALERT",
              `New SOS trigger received! Check active alerts immediately.`
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(sosChannel);
    };
  }, []);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.5,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const uploadPhoto = async (uri: string): Promise<string | null> => {
    try {
      const fileName = `visitor_${Date.now()}.jpg`;
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      });
      const arrayBuffer = decode(base64);
      const { error } = await supabase.storage
        .from("portl-images")
        .upload(fileName, arrayBuffer, { contentType: "image/jpeg" });
      if (error) {
        console.log("Upload error:", error.message);
        return null;
      }
      const { data } = supabase.storage
        .from("portl-images")
        .getPublicUrl(fileName);
      return data.publicUrl;
    } catch (err) {
      console.log("Upload failed:", err);
      return null;
    }
  };

  const verifyOtp = async () => {
    if (otpVerify.trim().length !== 6) {
      Alert.alert("Invalid code", "Enter the 6-digit code");
      return;
    }
    setOtpLoading(true);
    try {
      const { data, error } = await supabase
        .from("visitor_requests")
        .select("id, flat_id, visitors(name), flats(flat_number)")
        .eq("otp_code", otpVerify.trim())
        .eq("status", "approved")
        .is("entry_time", null)
        .single();

      if (error || !data) {
        Alert.alert("Not found", "No matching pre-approved guest with this code");
        return;
      }
      Alert.alert(
        "Guest Verified",
        `${(data as any).visitors?.name} — Flat ${(data as any).flats?.flat_number}\n\nMark their entry from Live Requests.`
      );
      setOtpVerify("");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleRegisterVisitor = async () => {
    if (loading) return;
    if (!name || !flatNumber) {
      Alert.alert("Missing info", "Name and flat number are required");
      return;
    }
    if (name.trim().length < 3 || name.trim().length > 15) {
      Alert.alert(
        "Invalid name",
        "Visitor name must be between 3 and 15 characters"
      );
      return;
    }
    if (phone.trim().length > 0 && !/^\d{10}$/.test(phone.trim())) {
      Alert.alert("Invalid phone", "Phone number must be exactly 10 digits");
      return;
    }
    if (visitorType === "other" && !customVisitorType.trim()) {
      Alert.alert("Missing info", "Please specify the visitor type");
      return;
    }
    setLoading(true);
    try {
      const { data: flat, error: flatError } = await supabase
        .from("flats")
        .select("id")
        .eq("flat_number", flatNumber)
        .single();

      if (flatError || !flat) {
        Alert.alert("Flat not found", `No flat with number "${flatNumber}"`);
        setLoading(false);
        return;
      }

      let photoUrl: string | null = null;
      if (photoUri) photoUrl = await uploadPhoto(photoUri);

      const finalVisitorType =
        visitorType === "other" ? customVisitorType.trim() : visitorType;

      const { data: visitor, error: visitorError } = await supabase
        .from("visitors")
        .insert({
          name,
          phone,
          visitor_type: finalVisitorType,
          photo_url: photoUrl,
        })
        .select()
        .single();

      if (visitorError || !visitor) {
        Alert.alert(
          "Error",
          visitorError?.message ?? "Could not create visitor"
        );
        setLoading(false);
        return;
      }

      const { error: requestError } = await supabase
        .from("visitor_requests")
        .insert({
          visitor_id: visitor.id,
          flat_id: flat.id,
          requested_by: userId,
          status: "pending",
        });

      if (requestError) {
        Alert.alert("Error", requestError.message);
        setLoading(false);
        return;
      }

      setName("");
      setPhone("");
      setFlatNumber("");
      setResidentSearch("");
      setPhotoUri(null);
      setCustomVisitorType("");
      Alert.alert(
        "Request sent",
        `${name}'s visit request was sent for approval`
      );
    } catch (err) {
      Alert.alert(
        "Something went wrong",
        "Please check your connection and try again"
      );
    } finally {
      setLoading(false);
    }
  };

  const markEntry = useCallback(async (id: string) => {
    if (actionLoadingRef.current) return;
    actionLoadingRef.current = id;
    setActionLoadingId(id);
    try {
      const { error } = await supabase
        .from("visitor_requests")
        .update({ entry_time: new Date().toISOString() })
        .eq("id", id);
      if (error) Alert.alert("Error", error.message);
    } catch {
      Alert.alert("Something went wrong", "Please try again");
    } finally {
      actionLoadingRef.current = null;
      setActionLoadingId(null);
    }
  }, []);

  const markExit = useCallback(async (id: string) => {
    if (actionLoadingRef.current) return;
    actionLoadingRef.current = id;
    setActionLoadingId(id);
    try {
      const { error } = await supabase
        .from("visitor_requests")
        .update({ exit_time: new Date().toISOString() })
        .eq("id", id);
      if (error) Alert.alert("Error", error.message);
    } catch {
      Alert.alert("Something went wrong", "Please try again");
    } finally {
      actionLoadingRef.current = null;
      setActionLoadingId(null);
    }
  }, []);

  const activeFilterCount =
    (filterStatus !== "all" ? 1 : 0) +
    (filterType !== "all" ? 1 : 0) +
    (filterTower !== "all" ? 1 : 0);

  let filtered = requests;
  if (filterStatus !== "all")
    filtered = filtered.filter((r) => r.status === filterStatus);
  if (filterType !== "all")
    filtered = filtered.filter((r) => r.visitors?.visitor_type === filterType);
  if (filterTower !== "all")
    filtered = filtered.filter((r) => r.flats?.tower_id === filterTower);
  if (searchFlat.trim())
    filtered = filtered.filter((r) =>
      r.flats?.flat_number
        ?.toLowerCase()
        .includes(searchFlat.trim().toLowerCase())
    );

  filtered = [...filtered].sort((a, b) => {
    const diff =
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortOrder === "newest" ? -diff : diff;
  });

  const inputTheme = {
    colors: {
      onSurfaceVariant: INK_MUTED,
      background: "transparent",
      primary: ACCENT,
    },
  };

  const firstName = myProfile?.full_name?.split(" ")[0] ?? "Guard";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toDateString();
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const insideCount = requests.filter(
    (r) => r.entry_time && !r.exit_time
  ).length;
  const entriesTodayCount = requests.filter(
    (r) => r.entry_time && new Date(r.entry_time).toDateString() === today
  ).length;
  const awaitingApproval = requests
    .filter((r) => r.status === "pending")
    .slice(0, 3);
  const awaitingEntry = requests
    .filter((r) => r.status === "approved" && !r.entry_time && !isExpiredDelivery(r))
    .slice(0, 3);

  const goToTab = (key: string) => {
    setTab(key);
    setProfileOpen(false);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.title}>{firstName}</Text>
          <View style={styles.roleBadge}>
            <IconButton
              icon="shield-account-outline"
              size={14}
              iconColor={ACCENT}
              style={{ margin: 0, marginRight: -4 }}
            />
            <Text style={styles.roleBadgeText}>Security Guard</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {tab === "home" && (
            <>
              {sosAlerts.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <View style={styles.sectionHeaderRow}>
                    <Avatar.Icon
                      size={30}
                      icon="alert-octagon"
                      style={{ backgroundColor: DANGER_BG }}
                      color={DANGER}
                    />
                    <Text style={[styles.sectionTitle, { color: DANGER }]}>
                      Active Emergency SOS ({sosAlerts.length})
                    </Text>
                  </View>
                  {sosAlerts.map((sos) => (
                    <View
                      key={sos.id}
                      style={[
                        styles.card,
                        {
                          borderColor: DANGER,
                          borderWidth: 2,
                          marginBottom: 12,
                        },
                      ]}
                    >
                      <View style={{ padding: 16 }}>
                        <View style={styles.row}>
                          <Chip
                            compact
                            style={{ backgroundColor: DANGER_BG }}
                            textStyle={{
                              color: DANGER,
                              fontWeight: "700",
                              fontSize: 12,
                            }}
                          >
                            🚨 {sos.emergency_type}
                          </Chip>
                          <Text style={styles.metaFaint}>
                            {new Date(sos.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </View>

                        <Text
                          style={[
                            styles.visitorName,
                            { marginTop: 8, fontSize: 18 },
                          ]}
                        >
                          {sos.flats?.towers?.name
                            ? `${sos.flats.towers.name} · `
                            : ""}
                          Flat {sos.flats?.flat_number ?? "Unknown"}
                        </Text>
                        <Text style={styles.meta}>
                          Resident: {sos.profiles?.full_name ?? "Unknown"}
                        </Text>
                        {sos.profiles?.phone && (
                          <Text style={styles.meta}>
                            📞 {sos.profiles.phone}
                          </Text>
                        )}
                      </View>
                      <Divider style={{ backgroundColor: BORDER }} />
                      <View style={styles.cardActions}>
                        <Button
                          mode="contained"
                          buttonColor={DANGER}
                          textColor="#fff"
                          loading={resolvingSosId === sos.id}
                          disabled={resolvingSosId === sos.id}
                          onPress={() => resolveSOS(sos.id)}
                          style={{ borderRadius: 10 }}
                        >
                          Mark as Resolved
                        </Button>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.statsRow}>
                <Pressable
                  style={styles.statCard}
                  onPress={() => goToTab("requests")}
                >
                  <Text
                    style={[
                      styles.statNum,
                      pendingCount > 0 && { color: GOLD },
                    ]}
                  >
                    {pendingCount}
                  </Text>
                  <Text style={styles.statLabel}>Awaiting Approval</Text>
                </Pressable>
                <Pressable
                  style={styles.statCard}
                  onPress={() => goToTab("requests")}
                >
                  <Text style={styles.statNum}>{insideCount}</Text>
                  <Text style={styles.statLabel}>Currently Inside</Text>
                </Pressable>
                <Pressable
                  style={styles.statCard}
                  onPress={() => goToTab("requests")}
                >
                  <Text style={styles.statNum}>{entriesTodayCount}</Text>
                  <Text style={styles.statLabel}>Entries Today</Text>
                </Pressable>
              </View>

              <Text style={styles.homeSectionLabel}>Quick Actions</Text>
              <View style={styles.quickActionsRow}>
                <Pressable
                  style={styles.quickActionTile}
                  onPress={() => goToTab("register")}
                >
                  <Avatar.Icon
                    size={40}
                    icon="account-plus"
                    style={{ backgroundColor: ACCENT_SOFT }}
                    color={ACCENT}
                  />
                  <Text style={styles.quickActionLabel}>Register Visitor</Text>
                </Pressable>
                <Pressable
                  style={styles.quickActionTile}
                  onPress={() => goToTab("requests")}
                >
                  <Avatar.Icon
                    size={40}
                    icon="account-clock"
                    style={{ backgroundColor: ACCENT_SOFT }}
                    color={ACCENT}
                  />
                  <Text style={styles.quickActionLabel}>Live Requests</Text>
                </Pressable>
              </View>

              {awaitingEntry.length > 0 && (
                <>
                  <View style={[styles.sectionHeaderRow, { marginTop: 8 }]}>
                    <Avatar.Icon
                      size={30}
                      icon="login"
                      style={styles.sectionIcon}
                      color={ACCENT}
                    />
                    <Text style={styles.sectionTitle}>Ready to Check In</Text>
                    <Pressable onPress={() => goToTab("requests")}>
                      <Text style={styles.viewAllLink}>View all</Text>
                    </Pressable>
                  </View>
                  {awaitingEntry.map((item) => (
                    <View
                      key={item.id}
                      style={[styles.card, { marginBottom: 12 }]}
                    >
                      <View style={{ padding: 16 }}>
                        <View style={styles.rowWithImage}>
                          {item.visitors?.photo_url ? (
                            <Image
                              source={{ uri: item.visitors.photo_url }}
                              style={styles.thumb}
                            />
                          ) : (
                            <View style={styles.thumbPlaceholder}>
                              <Text style={styles.thumbInitial}>
                                {item.visitors?.name?.[0]?.toUpperCase() ?? "?"}
                              </Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.visitorName}>
                              {item.visitors?.name}
                            </Text>
                            <Text style={styles.meta}>
                              Flat {item.flats?.flat_number} ·{" "}
                              {item.visitors?.visitor_type}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Divider style={{ backgroundColor: BORDER }} />
                      <View style={styles.cardActions}>
                        <Button
                          mode="contained"
                          icon="login"
                          buttonColor={ACCENT}
                          textColor="#fff"
                          loading={actionLoadingId === item.id}
                          disabled={actionLoadingId === item.id}
                          onPress={() => markEntry(item.id)}
                          style={styles.actionBtn}
                        >
                          Mark Entry
                        </Button>
                      </View>
                    </View>
                  ))}
                </>
              )}

              <View
                style={[
                  styles.sectionHeaderRow,
                  { marginTop: awaitingEntry.length > 0 ? 8 : 8 },
                ]}
              >
                <Avatar.Icon
                  size={30}
                  icon="clock-alert-outline"
                  style={{ backgroundColor: "#FBF3E4" }}
                  color={GOLD}
                />
                <Text style={styles.sectionTitle}>
                  Awaiting Resident Approval
                </Text>
                <Pressable onPress={() => goToTab("requests")}>
                  <Text style={styles.viewAllLink}>View all</Text>
                </Pressable>
              </View>
              {awaitingApproval.length === 0 ? (
                <View style={[styles.emptyState, { marginBottom: 12 }]}>
                  <Avatar.Icon
                    size={44}
                    icon="check-circle-outline"
                    style={{ backgroundColor: ACCENT_SOFT }}
                    color={ACCENT}
                  />
                  <Text style={styles.empty}>
                    Nothing waiting on residents right now
                  </Text>
                </View>
              ) : (
                awaitingApproval.map((item) => (
                  <View
                    key={item.id}
                    style={[styles.card, { marginBottom: 12 }]}
                  >
                    <View style={{ padding: 16 }}>
                      <View style={styles.rowWithImage}>
                        {item.visitors?.photo_url ? (
                          <Image
                            source={{ uri: item.visitors.photo_url }}
                            style={styles.thumb}
                          />
                        ) : (
                          <View style={styles.thumbPlaceholder}>
                            <Text style={styles.thumbInitial}>
                              {item.visitors?.name?.[0]?.toUpperCase() ?? "?"}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.visitorName}>
                            {item.visitors?.name}
                          </Text>
                          <Text style={styles.meta}>
                            Flat {item.flats?.flat_number} ·{" "}
                            {item.visitors?.visitor_type}
                          </Text>
                          <Text style={styles.metaFaint}>
                            {new Date(item.created_at).toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </>
          )}

          {tab === "register" && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Avatar.Icon
                  size={30}
                  icon="account-plus"
                  style={styles.sectionIcon}
                  color={ACCENT}
                />
                <Text style={styles.sectionTitle}>Register Visitor</Text>
              </View>

              {/* OTP Verification UI */}
              <View style={styles.inputWrap}>
                <TextInput
                  mode="flat"
                  label="Verify guest by code (optional)"
                  value={otpVerify}
                  onChangeText={(t) =>
                    setOtpVerify(t.replace(/\D/g, "").slice(0, 6))
                  }
                  keyboardType="numeric"
                  maxLength={6}
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  textColor={INK}
                  theme={inputTheme}
                  cursorColor={ACCENT}
                />
              </View>
              <Button
                mode="outlined"
                onPress={verifyOtp}
                loading={otpLoading}
                disabled={otpLoading}
                textColor={ACCENT}
                style={[styles.input, { borderColor: ACCENT }]}
              >
                Verify Code
              </Button>
              <Divider style={{ marginVertical: 16, backgroundColor: BORDER }} />

              <View style={styles.inputWrap}>
                <TextInput
                  mode="flat"
                  label="Visitor Name"
                  value={name}
                  onChangeText={setName}
                  maxLength={15}
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  textColor={INK}
                  theme={inputTheme}
                  cursorColor={ACCENT}
                />
              </View>
              <View style={styles.inputWrap}>
                <TextInput
                  mode="flat"
                  label="Phone"
                  value={phone}
                  onChangeText={(t) => setPhone(t.replace(/\D/g, ""))}
                  keyboardType="phone-pad"
                  maxLength={10}
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  textColor={INK}
                  theme={inputTheme}
                  cursorColor={ACCENT}
                />
              </View>

              <View style={styles.inputWrap}>
                <TextInput
                  mode="flat"
                  label="Search resident by name (optional)"
                  value={residentSearch}
                  onChangeText={(text) => {
                    setResidentSearch(text);
                    setShowResidentResults(text.length > 0);
                  }}
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  textColor={INK}
                  theme={inputTheme}
                  cursorColor={ACCENT}
                  left={
                    <TextInput.Icon icon="account-search" color={INK_FAINT} />
                  }
                />
              </View>

              {showResidentResults && residentSearch.length > 0 && (
                <View style={styles.searchResultsBox}>
                  {residents
                    .filter((r) =>
                      r.full_name
                        ?.toLowerCase()
                        .includes(residentSearch.toLowerCase())
                    )
                    .slice(0, 5)
                    .map((r, idx) => {
                      const flat = flats.find((f) => f.id === r.flat_id);
                      return (
                        <Pressable
                          key={idx}
                          style={styles.searchResultItem}
                          onPress={() => {
                            if (flat) setFlatNumber(flat.flat_number);
                            setResidentSearch(r.full_name);
                            setShowResidentResults(false);
                          }}
                        >
                          <Text style={styles.searchResultName}>
                            {r.full_name}
                          </Text>
                          <Text style={styles.searchResultFlat}>
                            Flat {flat?.flat_number ?? "—"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  {residents.filter((r) =>
                    r.full_name
                      ?.toLowerCase()
                      .includes(residentSearch.toLowerCase())
                  ).length === 0 && (
                    <Text style={styles.searchNoResults}>
                      No resident found
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.inputWrap}>
                <TextInput
                  mode="flat"
                  label="Flat Number"
                  value={flatNumber}
                  onChangeText={setFlatNumber}
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  textColor={INK}
                  theme={inputTheme}
                  cursorColor={ACCENT}
                />
              </View>

              <Text style={styles.fieldLabel}>Visitor Type</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.segmentedScroll}
              >
                <View style={styles.typeChipRow}>
                  {[
                    { value: "guest", label: "Guest", icon: "account" },
                    {
                      value: "delivery",
                      label: "Delivery",
                      icon: "package-variant",
                    },
                    { value: "cab", label: "Cab", icon: "car" },
                    { value: "service", label: "Service", icon: "wrench" },
                    { value: "other", label: "Other", icon: "dots-horizontal" },
                  ].map((opt) => (
                    <Chip
                      key={opt.value}
                      icon={opt.icon}
                      selected={visitorType === opt.value}
                      onPress={() => setVisitorType(opt.value)}
                      style={[
                        styles.typeChip,
                        visitorType === opt.value && styles.typeChipSelected,
                      ]}
                      textStyle={
                        visitorType === opt.value
                          ? styles.typeChipTextSelected
                          : styles.typeChipText
                      }
                      selectedColor={ACCENT}
                    >
                      {opt.label}
                    </Chip>
                  ))}
                </View>
              </ScrollView>

              {visitorType === "other" && (
                <View style={styles.inputWrap}>
                  <TextInput
                    mode="flat"
                    label="Specify visitor type"
                    value={customVisitorType}
                    onChangeText={setCustomVisitorType}
                    style={styles.input}
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
                    textColor={INK}
                    theme={inputTheme}
                    cursorColor={ACCENT}
                  />
                </View>
              )}

              <View style={styles.photoRow}>
                {photoUri ? (
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.previewImage}
                  />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Avatar.Icon
                      size={36}
                      icon="camera"
                      style={{ backgroundColor: "transparent" }}
                      color={INK_FAINT}
                    />
                  </View>
                )}
                <Button
                  mode="outlined"
                  onPress={pickPhoto}
                  icon="camera"
                  textColor={ACCENT}
                  style={styles.photoButton}
                >
                  {photoUri ? "Retake Photo" : "Take Visitor Photo"}
                </Button>
              </View>

              <Button
                mode="contained"
                onPress={handleRegisterVisitor}
                loading={loading}
                disabled={loading}
                buttonColor={ACCENT}
                textColor="#fff"
                style={styles.submitButton}
                contentStyle={{ paddingVertical: 4 }}
              >
                Send Approval Request
              </Button>
            </View>
          )}

          {tab === "requests" && (
            <>
              <View style={styles.sectionHeaderRow}>
                <Avatar.Icon
                  size={30}
                  icon="account-clock"
                  style={styles.sectionIcon}
                  color={ACCENT}
                />
                <Text style={styles.sectionTitle}>Live Requests</Text>
                <Text style={styles.countBadge}>{filtered.length}</Text>
              </View>

              <View style={styles.inputWrap}>
                <TextInput
                  mode="flat"
                  label="Search by flat number"
                  value={searchFlat}
                  onChangeText={setSearchFlat}
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  textColor={INK}
                  theme={inputTheme}
                  cursorColor={ACCENT}
                  left={<TextInput.Icon icon="magnify" color={INK_FAINT} />}
                  right={
                    searchFlat ? (
                      <TextInput.Icon
                        icon="close"
                        color={INK_FAINT}
                        onPress={() => setSearchFlat("")}
                      />
                    ) : undefined
                  }
                />
              </View>

              <View style={styles.toolbarRow}>
                <Chip
                  icon="filter-variant"
                  selected={filtersOpen}
                  onPress={() => setFiltersOpen((v) => !v)}
                  style={[
                    styles.toolbarChip,
                    filtersOpen && styles.chipSelected,
                  ]}
                  textStyle={
                    filtersOpen ? styles.chipTextSelected : styles.chipText
                  }
                  selectedColor={ACCENT}
                >
                  Filters
                  {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                </Chip>
                <Button
                  compact
                  mode="text"
                  icon={
                    sortOrder === "newest"
                      ? "sort-clock-descending"
                      : "sort-clock-ascending"
                  }
                  textColor={ACCENT}
                  onPress={() =>
                    setSortOrder(sortOrder === "newest" ? "oldest" : "newest")
                  }
                >
                  {sortOrder === "newest" ? "Newest first" : "Oldest first"}
                </Button>
              </View>

              {filtersOpen && (
                <View style={styles.filterCard}>
                  <Text style={styles.filterLabel}>Status</Text>
                  <View style={styles.filterRow}>
                    {["all", "pending", "approved", "denied"].map((f) => (
                      <Chip
                        key={f}
                        selected={filterStatus === f}
                        onPress={() => setFilterStatus(f)}
                        style={[
                          styles.filterChip,
                          filterStatus === f && styles.chipSelected,
                        ]}
                        textStyle={
                          filterStatus === f
                            ? styles.chipTextSelected
                            : styles.chipText
                        }
                        selectedColor={ACCENT}
                      >
                        {f}
                      </Chip>
                    ))}
                  </View>

                  <Text style={styles.filterLabel}>Visitor Type</Text>
                  <View style={styles.filterRow}>
                    {[
                      "all",
                      "guest",
                      "delivery",
                      "cab",
                      "service",
                      "other",
                    ].map((f) => (
                      <Chip
                        key={f}
                        selected={filterType === f}
                        onPress={() => setFilterType(f)}
                        style={[
                          styles.filterChip,
                          filterType === f && styles.chipSelected,
                        ]}
                        textStyle={
                          filterType === f
                            ? styles.chipTextSelected
                            : styles.chipText
                        }
                        selectedColor={ACCENT}
                      >
                        {f}
                      </Chip>
                    ))}
                  </View>

                  {towers.length > 0 && (
                    <>
                      <Text style={styles.filterLabel}>Tower</Text>
                      <View style={styles.filterRow}>
                        <Chip
                          selected={filterTower === "all"}
                          onPress={() => setFilterTower("all")}
                          style={[
                            styles.filterChip,
                            filterTower === "all" && styles.chipSelected,
                          ]}
                          textStyle={
                            filterTower === "all"
                              ? styles.chipTextSelected
                              : styles.chipText
                          }
                          selectedColor={ACCENT}
                        >
                          all
                        </Chip>
                        {towers.map((t) => (
                          <Chip
                            key={t.id}
                            selected={filterTower === t.id}
                            onPress={() => setFilterTower(t.id)}
                            style={[
                              styles.filterChip,
                              filterTower === t.id && styles.chipSelected,
                            ]}
                            textStyle={
                              filterTower === t.id
                                ? styles.chipTextSelected
                                : styles.chipText
                            }
                            selectedColor={ACCENT}
                          >
                            {t.name}
                          </Chip>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              )}

              {filtered.length === 0 && (
                <View style={styles.emptyState}>
                  <Avatar.Icon
                    size={48}
                    icon="clipboard-search-outline"
                    style={{ backgroundColor: ACCENT_SOFT }}
                    color={ACCENT}
                  />
                  <Text style={styles.empty}>No matching requests</Text>
                </View>
              )}

              <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                renderItem={({ item }) => (
                  <VisitorCard
                    item={item}
                    statusColor={statusColor}
                    statusBg={statusBg}
                    actionLoadingId={actionLoadingId}
                    markEntry={markEntry}
                    markExit={markExit}
                  />
                )}
              />
            </>
          )}

          <View style={{ height: 90 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 10 }]}>
        <Pressable
          style={styles.navItem}
          onPress={() => goToTab("home")}
          hitSlop={8}
        >
          <View
            style={[
              styles.navIconWrap,
              tab === "home" && styles.navIconWrapActive,
            ]}
          >
            <IconButton
              icon="home-variant"
              size={22}
              iconColor={tab === "home" ? ACCENT : INK_FAINT}
              style={{ margin: 0 }}
            />
          </View>
          <Text
            style={[styles.navLabel, tab === "home" && styles.navLabelActive]}
          >
            Home
          </Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() => goToTab("register")}
          hitSlop={8}
        >
          <View
            style={[
              styles.navIconWrap,
              tab === "register" && styles.navIconWrapActive,
            ]}
          >
            <IconButton
              icon="account-plus-outline"
              size={22}
              iconColor={tab === "register" ? ACCENT : INK_FAINT}
              style={{ margin: 0 }}
            />
          </View>
          <Text
            style={[
              styles.navLabel,
              tab === "register" && styles.navLabelActive,
            ]}
          >
            Register
          </Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() => goToTab("requests")}
          hitSlop={8}
        >
          <View
            style={[
              styles.navIconWrap,
              tab === "requests" && styles.navIconWrapActive,
            ]}
          >
            <IconButton
              icon="account-clock-outline"
              size={22}
              iconColor={tab === "requests" ? ACCENT : INK_FAINT}
              style={{ margin: 0 }}
            />
            {pendingCount > 0 && tab !== "requests" && (
              <View style={styles.navBadge}>
                <Text style={styles.navBadgeText}>{pendingCount}</Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.navLabel,
              tab === "requests" && styles.navLabelActive,
            ]}
          >
            Requests
          </Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() => setProfileOpen(true)}
          hitSlop={8}
        >
          <View style={styles.navIconWrap}>
            <View style={styles.navAvatar}>
              <Text style={styles.navAvatarInitial}>
                {myProfile?.full_name?.[0]?.toUpperCase() ?? "G"}
              </Text>
            </View>
          </View>
          <Text style={styles.navLabel}>Profile</Text>
        </Pressable>
      </View>

      <Modal
        visible={profileOpen}
        animationType="slide"
        onRequestClose={() => setProfileOpen(false)}
      >
        <View style={styles.profileScreen}>
          <View style={[styles.profileTopBar, { paddingTop: insets.top + 12 }]}>
            <IconButton
              icon="arrow-left"
              size={24}
              iconColor={INK}
              onPress={() => setProfileOpen(false)}
              style={{ margin: 0 }}
            />
            <Text style={styles.profileTopBarTitle}>Profile</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.profileIdCard}>
              <View style={styles.profileBigAvatar}>
                <Text style={styles.profileBigAvatarInitial}>
                  {myProfile?.full_name?.[0]?.toUpperCase() ?? "G"}
                </Text>
              </View>
              <Text style={styles.profileBigName}>
                {myProfile?.full_name ?? "Guard"}
              </Text>
              <View style={styles.profileRoleChip}>
                <IconButton
                  icon="shield-account-outline"
                  size={16}
                  iconColor={ACCENT}
                  style={{ margin: 0, marginRight: -4 }}
                />
                <Text style={styles.profileRoleChipText}>Security Guard</Text>
              </View>
              {myProfile?.phone ? (
                <View style={styles.profilePhoneRow}>
                  <IconButton
                    icon="phone-outline"
                    size={16}
                    iconColor={INK_MUTED}
                    style={{ margin: 0 }}
                  />
                  <Text style={styles.profilePhoneText}>{myProfile.phone}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.profileSectionLabel}>Today's Summary</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statTile}>
                <Text style={styles.statTileNum}>{pendingCount}</Text>
                <Text style={styles.statTileLabel}>Awaiting Approval</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statTileNum}>{insideCount}</Text>
                <Text style={styles.statTileLabel}>Currently Inside</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statTileNum}>{entriesTodayCount}</Text>
                <Text style={styles.statTileLabel}>Entries Today</Text>
              </View>
            </View>

            <Pressable
              style={styles.logoutButton}
              onPress={() => {
                setProfileOpen(false);
                handleLogout();
              }}
            >
              <IconButton
                icon="logout"
                size={20}
                iconColor={DANGER}
                style={{ margin: 0 }}
              />
              <Text style={styles.logoutButtonText}>Log Out</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAGE_BG },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 18,
    backgroundColor: CARD_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  greeting: { fontSize: 13, color: INK_MUTED, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "800", color: INK, marginTop: 2 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: ACCENT_SOFT,
    borderRadius: 20,
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 3,
    marginTop: 8,
  },
  roleBadgeText: { fontSize: 12, fontWeight: "700", color: ACCENT },

  container: { padding: 20, paddingBottom: 12 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 22 },

  statCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    paddingVertical: 14,
  },

  statNum: { fontSize: 20, fontWeight: "800", color: INK },
  statLabel: {
    fontSize: 11,
    color: INK_MUTED,
    marginTop: 4,
    textAlign: "center",
    fontWeight: "600",
  },
  homeSectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: INK_MUTED,
    marginBottom: 10,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  quickActionsRow: { flexDirection: "row", gap: 10, marginBottom: 22 },
  quickActionTile: { flex: 1, alignItems: "center", gap: 8 },
  quickActionLabel: {
    fontSize: 11,
    color: INK_MUTED,
    fontWeight: "600",
    textAlign: "center",
  },
  viewAllLink: { fontSize: 13, fontWeight: "700", color: ACCENT },

  sectionCard: {
    marginBottom: 24,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    shadowColor: "#151329",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  sectionIcon: { backgroundColor: ACCENT_SOFT },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: INK, flex: 1 },
  countBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
    backgroundColor: ACCENT,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    overflow: "hidden",
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: INK_MUTED,
    marginBottom: 8,
    marginTop: 2,
  },

  inputWrap: {
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
    marginBottom: 14,
  },
  input: { backgroundColor: "transparent" },

  segmentedScroll: { marginBottom: 14 },
  typeChipRow: { flexDirection: "row", gap: 8 },
  typeChip: {
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: "transparent",
  },
  typeChipSelected: { backgroundColor: ACCENT_SOFT, borderColor: ACCENT },
  typeChipText: { color: INK_MUTED },
  typeChipTextSelected: { color: INK, fontWeight: "700" },

  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  previewImage: { width: 64, height: 64, borderRadius: 12 },
  photoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  photoButton: { flex: 1, borderColor: ACCENT },
  submitButton: { borderRadius: 14, marginTop: 4 },

  toolbarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  toolbarChip: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  filterCard: {
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
    padding: 16,
  },

  card: {
    borderRadius: 18,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    shadowColor: "#151329",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 12,
    gap: 8,
  },
  actionBtn: { borderRadius: 12 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  rowWithImage: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  visitorName: { fontSize: 16, fontWeight: "700", color: INK, flexShrink: 1 },
  meta: { color: INK_MUTED, marginTop: 3, fontSize: 13 },
  metaFaint: { color: INK_FAINT, marginTop: 2, fontSize: 12 },
  thumb: { width: 52, height: 52, borderRadius: 26 },
  thumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
  },
  thumbInitial: { color: "white", fontSize: 19, fontWeight: "700" },

  timeRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  timeChip: {
    backgroundColor: ACCENT_SOFT,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  timeChipText: { fontSize: 11, fontWeight: "600", color: ACCENT },

  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: INK_MUTED,
    marginBottom: 6,
    marginTop: 6,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  filterChip: {
    marginBottom: 4,
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: "transparent",
  },
  chipSelected: { backgroundColor: ACCENT_SOFT, borderColor: ACCENT },
  chipText: { color: INK_MUTED },
  chipTextSelected: { color: INK, fontWeight: "600" },

  emptyState: { alignItems: "center", paddingVertical: 32, gap: 10 },
  empty: { color: INK_FAINT, fontSize: 14 },

  searchResultsBox: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: -8,
    marginBottom: 14,
    overflow: "hidden",
  },
  searchResultItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  searchResultName: { fontSize: 14, fontWeight: "600", color: INK },
  searchResultFlat: { fontSize: 13, color: INK_MUTED },
  searchNoResults: {
    padding: 16,
    color: INK_FAINT,
    fontSize: 13,
    textAlign: "center",
  },

  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    backgroundColor: CARD_BG,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 12,
  },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  navIconWrap: {
    width: 44,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  navIconWrapActive: { backgroundColor: ACCENT_SOFT },
  navDot: {
    position: "absolute",
    top: 2,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DANGER,
    borderWidth: 1.5,
    borderColor: CARD_BG,
  },
  navBadge: {
    position: "absolute",
    top: -2,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: DANGER,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: CARD_BG,
  },
  navBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  navLabel: { fontSize: 11, color: INK_FAINT, fontWeight: "600", marginTop: 2 },
  navLabelActive: { color: ACCENT },
  navAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
  },
  navAvatarInitial: { color: "#fff", fontSize: 12, fontWeight: "700" },

  profileScreen: { flex: 1, backgroundColor: PAGE_BG },
  profileTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 12,
    backgroundColor: CARD_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  profileTopBarTitle: { fontSize: 17, fontWeight: "700", color: INK },

  profileIdCard: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 24,
    shadowColor: "#151329",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  profileBigAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  profileBigAvatarInitial: { color: "#fff", fontSize: 30, fontWeight: "800" },
  profileBigName: { fontSize: 20, fontWeight: "800", color: INK },
  profileRoleChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ACCENT_SOFT,
    borderRadius: 20,
    paddingLeft: 8,
    paddingRight: 14,
    paddingVertical: 5,
    marginTop: 10,
  },
  profileRoleChipText: { fontSize: 13, fontWeight: "700", color: ACCENT },
  profilePhoneRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  profilePhoneText: { fontSize: 14, color: INK_MUTED, fontWeight: "600" },

  profileSectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: INK_MUTED,
    marginBottom: 10,
    marginLeft: 4,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  statsGrid: { flexDirection: "row", gap: 10, marginBottom: 32 },
  statTile: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    paddingVertical: 16,
  },
  statTileNum: { fontSize: 20, fontWeight: "800", color: INK },
  statTileLabel: {
    fontSize: 11,
    color: INK_MUTED,
    marginTop: 4,
    textAlign: "center",
    fontWeight: "600",
  },

  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: DANGER_BG,
    borderRadius: 16,
    paddingVertical: 14,
  },
  logoutButtonText: { color: DANGER, fontSize: 15, fontWeight: "700" },
});