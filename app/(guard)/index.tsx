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
  Switch,
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
const TEAL = "#0E7C7B";
const TEAL_BG = "#E4F5F4";

const APPROVAL_CYCLE_DAYS_DEFAULT = 30;
const REQUESTS_PAGE_SIZE = 5;
const QUICK_LIST_CAP = 8;
const TIMEOUT_SCAN_INTERVAL_MS = 60000;

type VisitorRequest = {
  id: string;
  status: string;
  resolution: string | null;
  entry_time: string | null;
  exit_time: string | null;
  pre_approved: boolean;
  otp_code: string | null;
  created_at: string;
  timeout_notified_at: string | null;
  visitors: {
    name: string;
    visitor_type: string;
    photo_url: string | null;
    vehicle_number: string | null;
    frequent_visitor_id: string | null;
  } | null;
  flats: { flat_number: string; tower_id: string } | null;
};
type Tower = { id: string; name: string };
type Flat = { id: string; tower_id: string; flat_number: string };
type MyGuardProfile = { full_name: string; phone: string | null };

type FrequentVisitor = {
  id: string;
  flat_id: string;
  name: string;
  phone: string | null;
  visitor_type: string;
  vehicle_number: string | null;
  photo_url: string | null;
  last_approved_at: string | null;
  approval_cycle_days: number | null;
};

type ActiveExpressPass = {
  id: string;
  flat_id: string;
  company_name: string;
  leave_at_gate_only: boolean;
  valid_until: string;
  created_at: string;
  flats: {
    flat_number: string;
    towers: { name: string } | null;
  } | null;
};

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

const FREQUENT_TYPES = [
  { value: "maid", label: "Maid", icon: "broom" },
  { value: "cleaner", label: "Cleaner", icon: "spray-bottle" },
  { value: "newspaper", label: "Newspaper", icon: "newspaper-variant-outline" },
  { value: "milkman", label: "Milkman", icon: "cup-outline" },
  { value: "driver", label: "Driver", icon: "steering" },
  { value: "school_bus", label: "School Bus", icon: "bus-school" },
  { value: "vegetable_vendor", label: "Vegetable Vendor", icon: "food-apple-outline" },
  { value: "other", label: "Other", icon: "dots-horizontal" },
];

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
  if (item.resolution === "left_at_gate") return false;
  const minutesSince =
    (Date.now() - new Date(item.created_at).getTime()) / 60000;
  return minutesSince > 30;
};

const needsReapproval = (fv: FrequentVisitor) => {
  if (!fv.last_approved_at) return true;
  const cycleDays = fv.approval_cycle_days ?? APPROVAL_CYCLE_DAYS_DEFAULT;
  const daysSince =
    (Date.now() - new Date(fv.last_approved_at).getTime()) / 86400000;
  return daysSince > cycleDays;
};

const VisitorRowItem = memo(function VisitorRowItem({
  item,
  onSelect,
}: {
  item: VisitorRequest;
  onSelect: (item: VisitorRequest) => void;
}) {
  const expired = isExpiredDelivery(item);
  const isDelivery = item.visitors?.visitor_type === "delivery";
  const leftAtGate = item.resolution === "left_at_gate";
  const minsPassed = Math.floor(
    (Date.now() - new Date(item.created_at).getTime()) / 60000
  );

  return (
    <Pressable style={styles.compactRow} onPress={() => onSelect(item)}>
      {item.visitors?.photo_url ? (
        <Image source={{ uri: item.visitors.photo_url }} style={styles.thumbRow} />
      ) : (
        <View style={styles.thumbPlaceholderRow}>
          <Text style={styles.thumbInitialRow}>
            {item.visitors?.name?.[0]?.toUpperCase() ?? "?"}
          </Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
        <View style={styles.row}>
          <Text style={styles.visitorNameRow} numberOfLines={1}>
            {item.visitors?.name}
          </Text>
          <Chip
            compact
            style={[
              {
                backgroundColor: leftAtGate
                  ? TEAL_BG
                  : expired
                  ? DANGER_BG
                  : statusBg(item.status),
              },
              styles.rowStatusChip,
            ]}
            textStyle={{
              color: leftAtGate ? TEAL : expired ? DANGER : statusColor(item.status),
              fontWeight: "600",
              fontSize: 11,
            }}
          >
            {leftAtGate
              ? "left at gate"
              : expired
              ? "expired"
              : item.pre_approved
              ? "pre-approved"
              : item.status}
          </Chip>
        </View>
        <Text style={styles.metaRow} numberOfLines={1}>
          Flat {item.flats?.flat_number ?? "—"} · {item.visitors?.visitor_type}
        </Text>
        {item.visitors?.vehicle_number ? (
          <Text style={styles.metaRowVehicle} numberOfLines={1}>
            🚗 {item.visitors.vehicle_number}
          </Text>
        ) : null}
        {isDelivery && item.status === "approved" && !item.entry_time && !leftAtGate && (
          <Text style={[styles.timerTextRow, { color: expired ? DANGER : ACCENT }]}>
            {expired ? `🚨 Expired (${minsPassed}m)` : `⏳ Delivery: ${minsPassed}/30m`}
          </Text>
        )}
      </View>
      <IconButton icon="chevron-right" size={20} iconColor={INK_FAINT} style={{ margin: 0 }} />
    </Pressable>
  );
});

export default function GuardHome() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("home");

  // Quick Tab Mode Switch: 'regular' | 'express'
  const [quickSubTab, setQuickSubTab] = useState<"regular" | "express">("regular");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [visitorType, setVisitorType] = useState("guest");
  const [customVisitorType, setCustomVisitorType] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [saveAsFrequent, setSaveAsFrequent] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);

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
  const [requestsLimit, setRequestsLimit] = useState(REQUESTS_PAGE_SIZE);
  const userId = useAuthStore((s) => s.userId);
  const clearSession = useAuthStore((s) => s.clearSession);

  const [selectedVisitor, setSelectedVisitor] = useState<VisitorRequest | null>(null);
  const [inputOtp, setInputOtp] = useState("");

  const [sosAlerts, setSosAlerts] = useState<SOSAlert[]>([]);
  const [resolvingSosId, setResolvingSosId] = useState<string | null>(null);

  // Active Express Passes State
  const [activeExpressPasses, setActiveExpressPasses] = useState<ActiveExpressPass[]>([]);
  const [passProcessingId, setPassProcessingId] = useState<string | null>(null);

  const [residents, setResidents] = useState<
    { id: string; full_name: string; flat_id: string | null }[]
  >([]);

  const [destinationQuery, setDestinationQuery] = useState("");
  const [showDestinationResults, setShowDestinationResults] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [myProfile, setMyProfile] = useState<MyGuardProfile | null>(null);

  const [frequentVisitors, setFrequentVisitors] = useState<FrequentVisitor[]>([]);
  const [quickSearch, setQuickSearch] = useState("");
  const [showQuickResults, setShowQuickResults] = useState(false);
  const [quickLoadingId, setQuickLoadingId] = useState<string | null>(null);

  const notifyingTimeoutIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    actionLoadingRef.current = actionLoadingId;
  }, [actionLoadingId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearSession();
    router.replace("/(auth)/login");
  };

  const fetchActiveExpressPasses = async () => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("delivery_pre_approvals")
      .select(`
        id,
        flat_id,
        company_name,
        leave_at_gate_only,
        valid_until,
        created_at,
        flats:flat_id (
          flat_number,
          towers ( name )
        )
      `)
      .eq("is_used", false)
      .gte("valid_until", now)
      .order("valid_until", { ascending: true });

    if (!error && data) {
      setActiveExpressPasses(data as any);
    }
  };

  // CONSUME EXPRESS PASS (No Push Notification Sent)
  const consumeExpressPass = async (pass: ActiveExpressPass) => {
    setPassProcessingId(pass.id);
    try {
      await supabase
        .from("delivery_pre_approvals")
        .update({ is_used: true })
        .eq("id", pass.id);

      const { data: visitor } = await supabase
        .from("visitors")
        .insert({
          name: pass.company_name.toUpperCase(),
          visitor_type: pass.company_name.toLowerCase().includes("cab") ? "cab" : "delivery",
        })
        .select()
        .single();

      if (visitor) {
        const now = new Date().toISOString();
        await supabase.from("visitor_requests").insert({
          visitor_id: visitor.id,
          flat_id: pass.flat_id,
          requested_by: userId,
          status: "approved",
          pre_approved: true,
          resolution: pass.leave_at_gate_only ? "left_at_gate" : null,
          entry_time: now,
          exit_time: pass.leave_at_gate_only ? now : null,
        });
      }

      Alert.alert(
        "⚡ Express Pass Entry Logged",
        pass.leave_at_gate_only
          ? `Parcel for Flat ${pass.flats?.flat_number} marked as Left at Gate.`
          : `Entry marked for ${pass.company_name.toUpperCase()} (Flat ${pass.flats?.flat_number}).`
      );

      fetchActiveExpressPasses();
      fetchRequests();
    } finally {
      setPassProcessingId(null);
    }
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
        "id, status, resolution, entry_time, exit_time, pre_approved, otp_code, created_at, timeout_notified_at, visitors(name, visitor_type, photo_url, vehicle_number, frequent_visitor_id), flats(flat_number, tower_id)"
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && data) {
      setRequests(data as any);
      if (selectedVisitor) {
        const updatedSelected = (data as any[]).find((r) => r.id === selectedVisitor.id);
        if (updatedSelected) setSelectedVisitor(updatedSelected);
      }
    }
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
      .select("id, full_name, flat_id")
      .eq("role", "resident")
      .eq("approved", true);
    if (data) setResidents(data as any);
  };

  const fetchFrequentVisitors = async () => {
    const { data, error } = await supabase
      .from("frequent_visitors")
      .select(
        "id, flat_id, name, phone, visitor_type, vehicle_number, photo_url, last_approved_at, approval_cycle_days"
      )
      .order("name");
    if (!error && data) setFrequentVisitors(data as any);
  };

  useEffect(() => {
    fetchRequests();
    fetchTowers();
    fetchFlats();
    fetchMyProfile();
    fetchResidents();
    fetchActiveSosAlerts();
    fetchFrequentVisitors();
    fetchActiveExpressPasses();

    const channel = supabase
      .channel("visitor_requests_guard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visitor_requests" },
        () => fetchRequests()
      )
      .subscribe();

    const expressChannel = supabase
      .channel("express_passes_guard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_pre_approvals" },
        () => fetchActiveExpressPasses()
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

    const frequentChannel = supabase
      .channel("guard_frequent_visitors_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "frequent_visitors" },
        () => fetchFrequentVisitors()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(expressChannel);
      supabase.removeChannel(sosChannel);
      supabase.removeChannel(frequentChannel);
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
      if (error) return null;
      const { data } = supabase.storage
        .from("portl-images")
        .getPublicUrl(fileName);
      return data.publicUrl;
    } catch {
      return null;
    }
  };

  const sendResidentPush = async (
    flatId: string,
    title: string,
    body: string,
    requestId: string,
    categoryId?: string
  ) => {
    try {
      const { data: residentProfile } = await supabase
        .from("profiles")
        .select("push_token")
        .eq("flat_id", flatId)
        .eq("role", "resident")
        .not("push_token", "is", null)
        .maybeSingle();

      if (residentProfile?.push_token) {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: residentProfile.push_token,
            sound: "default",
            title,
            body,
            data: { visitorRequestId: requestId },
            ...(categoryId ? { categoryId } : {}),
          }),
        });
      }
    } catch (pushErr) {
      console.log("Push notification failed to send:", pushErr);
    }
  };

  const sendVisitorPush = async (
    flatId: string,
    visitorName: string,
    finalVisitorType: string,
    requestId: string
  ) => {
    await sendResidentPush(
      flatId,
      "🚪 Visitor at Main Gate!",
      `${visitorName} (${finalVisitorType}) is requesting entry to your flat.`,
      requestId,
      "VISITOR_APPROVAL"
    );
  };

  const notifyResidentOfDeliveryTimeout = useCallback(async (item: VisitorRequest) => {
    if (!item.flats || notifyingTimeoutIds.current.has(item.id)) return;
    notifyingTimeoutIds.current.add(item.id);
    try {
      const { data: claimed, error: claimError } = await supabase
        .from("visitor_requests")
        .update({ timeout_notified_at: new Date().toISOString() })
        .eq("id", item.id)
        .is("timeout_notified_at", null)
        .select()
        .single();

      if (claimError || !claimed) return;

      const flatRecord = flats.find(
        (f) => f.flat_number === item.flats?.flat_number
      );
      if (!flatRecord) return;

      await sendResidentPush(
        flatRecord.id,
        "📦 Delivery still waiting at the gate",
        `${item.visitors?.name ?? "A delivery"} has been waiting over 30 minutes uncollected. Please arrange pickup or ask security to hold it.`,
        item.id,
        "DELIVERY_TIMEOUT"
      );
    } finally {
      notifyingTimeoutIds.current.delete(item.id);
    }
  }, [flats]);

  useEffect(() => {
    const scanForTimeouts = () => {
      requests.forEach((item) => {
        if (isExpiredDelivery(item) && !item.timeout_notified_at) {
          notifyResidentOfDeliveryTimeout(item);
        }
      });
    };
    scanForTimeouts();
    const interval = setInterval(scanForTimeouts, TIMEOUT_SCAN_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [requests, notifyResidentOfDeliveryTimeout]);

  const resetNewVisitorForm = () => {
    setName("");
    setPhone("");
    setFlatNumber("");
    setDestinationQuery("");
    setShowDestinationResults(false);
    setPhotoUri(null);
    setCustomVisitorType("");
    setVehicleNumber("");
    setSaveAsFrequent(false);
    setShowMoreDetails(false);
    setVisitorType("guest");
  };

  const handleRegisterVisitor = async () => {
    if (loading) return;
    if (!name || !flatNumber) {
      Alert.alert("Missing info", "Name and flat / resident are required");
      return;
    }
    if (name.trim().length < 3 || name.trim().length > 15) {
      Alert.alert(
        "Invalid name",
        "Visitor name must be between 3 and 15 characters"
      );
      return;
    }
    if (!photoUri) {
      Alert.alert(
        "Photo required",
        "Please take a photo of the visitor before sending the request."
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

      const photoUrl = await uploadPhoto(photoUri);
      if (!photoUrl) {
        Alert.alert(
          "Photo upload failed",
          "Could not upload the visitor photo. Please check your connection and try again."
        );
        setLoading(false);
        return;
      }

      const finalVisitorType =
        visitorType === "other" ? customVisitorType.trim() : visitorType;

      const { data: visitor, error: visitorError } = await supabase
        .from("visitors")
        .insert({
          name,
          phone,
          visitor_type: finalVisitorType,
          photo_url: photoUrl,
          vehicle_number: vehicleNumber.trim() || null,
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

      const { data: newRequest, error: requestError } = await supabase
        .from("visitor_requests")
        .insert({
          visitor_id: visitor.id,
          flat_id: flat.id,
          requested_by: userId,
          status: "pending",
        })
        .select()
        .single();

      if (requestError || !newRequest) {
        Alert.alert("Error", requestError?.message ?? "Could not create request");
        setLoading(false);
        return;
      }

      if (saveAsFrequent) {
        const { error: freqError } = await supabase.from("frequent_visitors").insert({
          flat_id: flat.id,
          name,
          phone: phone.trim() || null,
          visitor_type: finalVisitorType,
          vehicle_number: vehicleNumber.trim() || null,
          photo_url: photoUrl,
        });
        if (freqError) console.log("Could not save frequent visitor:", freqError);
      }

      // Live Request requires resident action -> Send Push
      await sendVisitorPush(flat.id, name, finalVisitorType, newRequest.id);

      resetNewVisitorForm();
      Alert.alert(
        "Request Sent",
        `${name}'s visit request was sent for approval`
      );
    } catch {
      Alert.alert("Connection Error", "Please check your network connection.");
    } finally {
      setLoading(false);
    }
  };

  // HANDLE QUICK ENTRY (NO PUSH SENT IF AUTO-APPROVED)
  const handleQuickEntry = async (fv: FrequentVisitor) => {
    if (quickLoadingId) return;
    setQuickLoadingId(fv.id);
    try {
      const autoApprove = !needsReapproval(fv);

      const { data: visitor, error: visitorError } = await supabase
        .from("visitors")
        .insert({
          name: fv.name,
          phone: fv.phone,
          visitor_type: fv.visitor_type,
          photo_url: fv.photo_url,
          vehicle_number: fv.vehicle_number,
          frequent_visitor_id: fv.id,
        })
        .select()
        .single();

      if (visitorError || !visitor) {
        Alert.alert("Error", visitorError?.message ?? "Could not create visitor");
        return;
      }

      const { data: newRequest, error: requestError } = await supabase
        .from("visitor_requests")
        .insert({
          visitor_id: visitor.id,
          flat_id: fv.flat_id,
          requested_by: userId,
          status: autoApprove ? "approved" : "pending",
        })
        .select()
        .single();

      if (requestError || !newRequest) {
        Alert.alert("Error", requestError?.message ?? "Could not create request");
        return;
      }

      const flatLabel = flats.find((f) => f.id === fv.flat_id)?.flat_number ?? "";

      if (autoApprove) {
        // Already approved -> No Push Notification Sent!
        Alert.alert(
          "Entry Ready",
          `${fv.name} is a regular visitor — entry logged.`
        );
      } else {
        // Needs Re-approval -> Send Push
        await sendVisitorPush(fv.flat_id, fv.name, fv.visitor_type, newRequest.id);
        Alert.alert(
          "Re-approval Needed",
          `${fv.name}'s regular approval expired, request sent to Flat ${flatLabel} for approval.`
        );
      }
      setQuickSearch("");
      setShowQuickResults(false);
    } catch {
      Alert.alert("Connection Error", "Please check your network connection.");
    } finally {
      setQuickLoadingId(null);
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
      else {
        setSelectedVisitor(null);
        setInputOtp("");
      }
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
      else {
        setSelectedVisitor(null);
      }
    } catch {
      Alert.alert("Something went wrong", "Please try again");
    } finally {
      actionLoadingRef.current = null;
      setActionLoadingId(null);
    }
  }, []);

  const markLeftAtGate = useCallback(async (id: string) => {
    if (actionLoadingRef.current) return;
    actionLoadingRef.current = id;
    setActionLoadingId(id);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("visitor_requests")
        .update({
          resolution: "left_at_gate",
          entry_time: now,
          exit_time: now,
        })
        .eq("id", id);
      if (error) Alert.alert("Error", error.message);
      else {
        setSelectedVisitor(null);
      }
    } catch {
      Alert.alert("Something went wrong", "Please try again");
    } finally {
      actionLoadingRef.current = null;
      setActionLoadingId(null);
    }
  }, []);

  const handleOtpVerificationAndEntry = (item: VisitorRequest) => {
    if (inputOtp.trim().length !== 6) {
      Alert.alert("Invalid Code", "Please enter the 6-digit OTP passcode.");
      return;
    }
    if (inputOtp.trim() === item.otp_code?.trim()) {
      markEntry(item.id);
    } else {
      Alert.alert("Incorrect Passcode", "The OTP entered does not match the resident's invitation.");
    }
  };

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

  const visibleRequests = filtered.slice(0, requestsLimit);
  const hasMoreRequests = filtered.length > requestsLimit;

  const filteredFrequentVisitors = frequentVisitors.filter((fv) => {
    const q = quickSearch.trim().toLowerCase();
    if (!q) return true;
    const flatLabel =
      flats.find((f) => f.id === fv.flat_id)?.flat_number?.toLowerCase() ?? "";
    return (
      fv.name.toLowerCase().includes(q) ||
      fv.phone?.toLowerCase().includes(q) ||
      flatLabel.includes(q)
    );
  });

  const destinationMatches = residents
    .filter((r) => {
      const q = destinationQuery.trim().toLowerCase();
      if (!q) return false;
      return r.full_name?.toLowerCase().includes(q);
    })
    .slice(0, 5);

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
    .filter(
      (r) => r.status === "approved" && !r.entry_time && !isExpiredDelivery(r)
    )
    .slice(0, 3);

  const goToTab = (key: string) => {
    setTab(key);
    setProfileOpen(false);
    setRequestsLimit(REQUESTS_PAGE_SIZE);
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
          {/* TAB 1: HOME SCREEN (CLEAN UI) */}
          {tab === "home" && (
            <>
              {/* EMERGENCY SOS ALERTS */}
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
                          marginBottom: 16,
                        },
                      ]}
                    >
                      <View style={{ padding: 18 }}>
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

              {/* STATS ROW */}
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

              {/* QUICK ACTIONS ROW WITH 4 CLEAN TILES */}
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
                  onPress={() => {
                    setQuickSubTab("regular");
                    goToTab("quick");
                  }}
                >
                  <Avatar.Icon
                    size={40}
                    icon="account-sync"
                    style={{ backgroundColor: ACCENT_SOFT }}
                    color={ACCENT}
                  />
                  <Text style={styles.quickActionLabel}>Quick Entry</Text>
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

                <Pressable
                  style={styles.quickActionTile}
                  onPress={() => {
                    setQuickSubTab("express");
                    goToTab("quick");
                  }}
                >
                  <Avatar.Icon
                    size={40}
                    icon="flash-outline"
                    style={{ backgroundColor: ACCENT_SOFT }}
                    color={ACCENT}
                  />
                  <Text style={styles.quickActionLabel}>Express Pass</Text>
                  {activeExpressPasses.length > 0 && (
                    <View style={styles.tileBadge}>
                      <Text style={styles.tileBadgeText}>
                        {activeExpressPasses.length}
                      </Text>
                    </View>
                  )}
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
                    <VisitorRowItem
                      key={item.id}
                      item={item}
                      onSelect={(v) => {
                        setSelectedVisitor(v);
                        setInputOtp("");
                      }}
                    />
                  ))}
                </>
              )}

              <View style={[styles.sectionHeaderRow, { marginTop: 12 }]}>
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
                <View style={[styles.emptyState, { marginBottom: 16 }]}>
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
                  <VisitorRowItem
                    key={item.id}
                    item={item}
                    onSelect={(v) => {
                      setSelectedVisitor(v);
                      setInputOtp("");
                    }}
                  />
                ))
              )}
            </>
          )}

          {/* TAB 2: CLEAN REGISTER VISITOR FORM */}
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
                  label="Resident name or flat number"
                  value={destinationQuery}
                  onChangeText={(text) => {
                    setDestinationQuery(text);
                    setFlatNumber(text);
                    setShowDestinationResults(text.length > 0);
                  }}
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  textColor={INK}
                  theme={inputTheme}
                  cursorColor={ACCENT}
                  left={<TextInput.Icon icon="home-search-outline" color={INK_FAINT} />}
                  right={
                    destinationQuery ? (
                      <TextInput.Icon
                        icon="close"
                        color={INK_FAINT}
                        onPress={() => {
                          setDestinationQuery("");
                          setFlatNumber("");
                          setShowDestinationResults(false);
                        }}
                      />
                    ) : undefined
                  }
                />
              </View>

              {showDestinationResults && destinationMatches.length > 0 && (
                <View style={styles.searchResultsBox}>
                  {destinationMatches.map((r) => {
                    const flat = flats.find((f) => f.id === r.flat_id);
                    return (
                      <Pressable
                        key={r.id}
                        style={styles.searchResultItem}
                        onPress={() => {
                          if (flat) setFlatNumber(flat.flat_number);
                          setDestinationQuery(r.full_name);
                          setShowDestinationResults(false);
                        }}
                      >
                        <Text style={styles.searchResultName}>{r.full_name}</Text>
                        <Text style={styles.searchResultFlat}>
                          Flat {flat?.flat_number ?? "—"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

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
                    { value: "cab", label: "Cab / Rapido", icon: "car" },
                    { value: "service", label: "Service", icon: "wrench" },
                    ...FREQUENT_TYPES.filter((t) => t.value !== "other"),
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

              <Text style={styles.fieldLabel}>Visitor Photo *</Text>
              <View style={styles.photoRow}>
                {photoUri ? (
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.previewImage}
                  />
                ) : (
                  <View style={[styles.photoPlaceholder, styles.photoPlaceholderRequired]}>
                    <Avatar.Icon
                      size={36}
                      icon="camera"
                      style={{ backgroundColor: "transparent" }}
                      color={DANGER}
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
              {!photoUri && (
                <Text style={styles.photoRequiredHint}>
                  A photo is required before the request can be sent
                </Text>
              )}

              <Pressable
                style={styles.moreDetailsToggle}
                onPress={() => setShowMoreDetails((v) => !v)}
              >
                <Text style={styles.moreDetailsToggleText}>
                  {showMoreDetails ? "Hide" : "Add"} phone & vehicle (optional)
                </Text>
                <IconButton
                  icon={showMoreDetails ? "chevron-up" : "chevron-down"}
                  size={16}
                  iconColor={ACCENT}
                  style={{ margin: 0 }}
                />
              </Pressable>

              {showMoreDetails && (
                <>
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
                      label="Vehicle Number"
                      value={vehicleNumber}
                      onChangeText={(t) => setVehicleNumber(t.toUpperCase())}
                      autoCapitalize="characters"
                      style={styles.input}
                      underlineColor="transparent"
                      activeUnderlineColor="transparent"
                      textColor={INK}
                      theme={inputTheme}
                      cursorColor={ACCENT}
                      left={<TextInput.Icon icon="car-outline" color={INK_FAINT} />}
                    />
                  </View>
                </>
              )}

              <Pressable
                style={styles.saveFrequentRow}
                onPress={() => setSaveAsFrequent((v) => !v)}
              >
                <Text style={styles.saveFrequentTitle}>Save as regular visitor</Text>
                <Switch
                  value={saveAsFrequent}
                  onValueChange={setSaveAsFrequent}
                  color={ACCENT}
                />
              </Pressable>

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

          {/* TAB 3: QUICK ENTRY & EXPRESS PASSES */}
          {tab === "quick" && (
            <View style={styles.sectionCard}>
              {/* SEGMENT SWITCHER */}
              <View style={styles.formSwitcherContainer}>
                <Pressable
                  style={[
                    styles.formSwitcherTab,
                    quickSubTab === "regular" && styles.formSwitcherTabActive,
                  ]}
                  onPress={() => setQuickSubTab("regular")}
                >
                  <Text
                    style={[
                      styles.formSwitcherText,
                      quickSubTab === "regular" && styles.formSwitcherTextActive,
                    ]}
                  >
                    👥 Frequent Staff
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.formSwitcherTab,
                    quickSubTab === "express" && styles.formSwitcherTabActive,
                  ]}
                  onPress={() => setQuickSubTab("express")}
                >
                  <Text
                    style={[
                      styles.formSwitcherText,
                      quickSubTab === "express" && styles.formSwitcherTextActive,
                    ]}
                  >
                    ⚡ Express Passes
                    {activeExpressPasses.length > 0 ? ` (${activeExpressPasses.length})` : ""}
                  </Text>
                </Pressable>
              </View>

              {/* VIEW A: FREQUENT STAFF / REGULAR VISITORS */}
              {quickSubTab === "regular" && (
                <>
                  <View style={styles.inputWrap}>
                    <TextInput
                      mode="flat"
                      label="Search by name, phone, or flat"
                      value={quickSearch}
                      onChangeText={(text) => {
                        setQuickSearch(text);
                        setShowQuickResults(text.length > 0);
                      }}
                      style={styles.input}
                      underlineColor="transparent"
                      activeUnderlineColor="transparent"
                      textColor={INK}
                      theme={inputTheme}
                      cursorColor={ACCENT}
                      left={<TextInput.Icon icon="magnify" color={INK_FAINT} />}
                      right={
                        quickSearch ? (
                          <TextInput.Icon
                            icon="close"
                            color={INK_FAINT}
                            onPress={() => {
                              setQuickSearch("");
                              setShowQuickResults(false);
                            }}
                          />
                        ) : undefined
                      }
                    />
                  </View>

                  {showQuickResults && quickSearch.length > 0 ? (
                    <View style={styles.searchResultsBox}>
                      {filteredFrequentVisitors.length === 0 ? (
                        <Text style={styles.searchNoResults}>No matches found</Text>
                      ) : (
                        filteredFrequentVisitors.slice(0, 6).map((fv) => {
                          const flatLabel = flats.find((f) => f.id === fv.flat_id)?.flat_number;
                          const typeMeta = FREQUENT_TYPES.find((t) => t.value === fv.visitor_type);
                          const reapprove = needsReapproval(fv);
                          return (
                            <Pressable
                              key={fv.id}
                              style={styles.searchResultItem}
                              onPress={() => handleQuickEntry(fv)}
                              disabled={quickLoadingId === fv.id}
                            >
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                                {fv.photo_url ? (
                                  <Image source={{ uri: fv.photo_url }} style={styles.thumbRow} />
                                ) : (
                                  <View style={styles.thumbPlaceholderRow}>
                                    <Text style={styles.thumbInitialRow}>
                                      {fv.name?.[0]?.toUpperCase() ?? "?"}
                                    </Text>
                                  </View>
                                )}
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.searchResultName}>{fv.name}</Text>
                                  <Text style={styles.searchResultFlat}>
                                    {typeMeta?.label ?? fv.visitor_type} · Flat {flatLabel ?? "—"}
                                  </Text>
                                  <Chip
                                    compact
                                    style={{
                                      backgroundColor: reapprove ? "#FBF3E4" : SUCCESS_BG,
                                      alignSelf: "flex-start",
                                      marginTop: 4,
                                    }}
                                    textStyle={{
                                      color: reapprove ? GOLD : SUCCESS,
                                      fontSize: 10,
                                      fontWeight: "700",
                                    }}
                                  >
                                    {reapprove ? "needs re-approval" : "regular · auto-approved"}
                                  </Chip>
                                </View>
                              </View>
                              {quickLoadingId === fv.id ? (
                                <Text style={{ fontSize: 11, color: ACCENT }}>Sending…</Text>
                              ) : (
                                <IconButton icon="send" size={18} iconColor={ACCENT} style={{ margin: 0 }} />
                              )}
                            </Pressable>
                          );
                        })
                      )}
                    </View>
                  ) : frequentVisitors.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Avatar.Icon
                        size={44}
                        icon="account-sync-outline"
                        style={{ backgroundColor: ACCENT_SOFT }}
                        color={ACCENT}
                      />
                      <Text style={styles.empty}>
                        No regular visitors saved yet. Register a new visitor and toggle
                        "Save as regular visitor" to add one here.
                      </Text>
                    </View>
                  ) : (
                    <>
                      {frequentVisitors.slice(0, QUICK_LIST_CAP).map((fv) => {
                        const flatLabel = flats.find((f) => f.id === fv.flat_id)?.flat_number;
                        const typeMeta = FREQUENT_TYPES.find((t) => t.value === fv.visitor_type);
                        const reapprove = needsReapproval(fv);
                        return (
                          <View key={fv.id} style={styles.frequentRow}>
                            {fv.photo_url ? (
                              <Image source={{ uri: fv.photo_url }} style={styles.thumbRow} />
                            ) : (
                              <View style={styles.thumbPlaceholderRow}>
                                <Text style={styles.thumbInitialRow}>
                                  {fv.name?.[0]?.toUpperCase() ?? "?"}
                                </Text>
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={styles.visitorNameRow} numberOfLines={1}>
                                {fv.name}
                              </Text>
                              <Text style={styles.metaRow} numberOfLines={1}>
                                {typeMeta?.label ?? fv.visitor_type} · Flat {flatLabel ?? "—"}
                              </Text>
                              {fv.vehicle_number ? (
                                <Text style={styles.metaRowVehicle} numberOfLines={1}>
                                  🚗 {fv.vehicle_number}
                                </Text>
                              ) : null}
                              <Chip
                                compact
                                style={{
                                  backgroundColor: reapprove ? "#FBF3E4" : SUCCESS_BG,
                                  alignSelf: "flex-start",
                                  marginTop: 4,
                                }}
                                textStyle={{
                                  color: reapprove ? GOLD : SUCCESS,
                                  fontSize: 10,
                                  fontWeight: "700",
                                }}
                              >
                                {reapprove ? "needs re-approval" : "auto-approved"}
                              </Chip>
                            </View>
                            <Button
                              mode="contained"
                              buttonColor={ACCENT}
                              textColor="#fff"
                              compact
                              loading={quickLoadingId === fv.id}
                              disabled={quickLoadingId === fv.id}
                              onPress={() => handleQuickEntry(fv)}
                              style={{ borderRadius: 10 }}
                            >
                              Send
                            </Button>
                          </View>
                        );
                      })}
                      {frequentVisitors.length > QUICK_LIST_CAP && (
                        <Text style={styles.capHintText}>
                          Showing {QUICK_LIST_CAP} of {frequentVisitors.length} — search above to find others
                        </Text>
                      )}
                    </>
                  )}
                </>
              )}

              {/* VIEW B: ACTIVE EXPRESS PASSES (RESIDENT PRE-APPROVED DELIVERIES & CABS) */}
              {quickSubTab === "express" && (
                <>
                  {activeExpressPasses.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Avatar.Icon
                        size={44}
                        icon="flash-off"
                        style={{ backgroundColor: ACCENT_SOFT }}
                        color={ACCENT}
                      />
                      <Text style={styles.empty}>
                        No active Express Passes created by residents right now
                      </Text>
                    </View>
                  ) : (
                    activeExpressPasses.map((pass) => (
                      <View
                        key={pass.id}
                        style={[
                          styles.card,
                          {
                            borderColor: ACCENT,
                            borderWidth: 1.5,
                            marginBottom: 12,
                          },
                        ]}
                      >
                        <View style={{ padding: 16 }}>
                          <View style={styles.row}>
                            <Text style={[styles.visitorName, { fontSize: 17 }]}>
                              {pass.company_name.toUpperCase()}
                            </Text>
                            <Chip
                              compact
                              style={{
                                backgroundColor: pass.leave_at_gate_only
                                  ? TEAL_BG
                                  : SUCCESS_BG,
                              }}
                              textStyle={{
                                color: pass.leave_at_gate_only ? TEAL : SUCCESS,
                                fontWeight: "700",
                                fontSize: 11,
                              }}
                            >
                              {pass.leave_at_gate_only
                                ? "📦 Leave at Gate"
                                : "🟢 Allow Entry"}
                            </Chip>
                          </View>

                          <Text style={[styles.meta, { fontSize: 14, marginTop: 6 }]}>
                            Destination:{" "}
                            <Text style={{ fontWeight: "800", color: INK }}>
                              {pass.flats?.towers?.name
                                ? `${pass.flats.towers.name} · `
                                : ""}
                              Flat {pass.flats?.flat_number ?? "—"}
                            </Text>
                          </Text>

                          <Text style={styles.metaFaint}>
                            Valid Until:{" "}
                            {new Date(pass.valid_until).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </View>
                        <Divider style={{ backgroundColor: BORDER }} />
                        <View style={styles.cardActions}>
                          <Button
                            mode="contained"
                            buttonColor={pass.leave_at_gate_only ? TEAL : ACCENT}
                            textColor="#fff"
                            loading={passProcessingId === pass.id}
                            disabled={passProcessingId === pass.id}
                            onPress={() => consumeExpressPass(pass)}
                            style={{ borderRadius: 12, paddingHorizontal: 10 }}
                          >
                            {pass.leave_at_gate_only
                              ? "Received at Gate"
                              : "Mark Entry"}
                          </Button>
                        </View>
                      </View>
                    ))
                  )}
                </>
              )}
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
                  onChangeText={(t) => {
                    setSearchFlat(t);
                    setRequestsLimit(REQUESTS_PAGE_SIZE);
                  }}
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
                        onPress={() => {
                          setFilterStatus(f);
                          setRequestsLimit(REQUESTS_PAGE_SIZE);
                        }}
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
                        onPress={() => {
                          setFilterType(f);
                          setRequestsLimit(REQUESTS_PAGE_SIZE);
                        }}
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
                          onPress={() => {
                            setFilterTower("all");
                            setRequestsLimit(REQUESTS_PAGE_SIZE);
                          }}
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
                            onPress={() => {
                              setFilterTower(t.id);
                              setRequestsLimit(REQUESTS_PAGE_SIZE);
                            }}
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
                data={visibleRequests}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                renderItem={({ item }) => (
                  <VisitorRowItem
                    item={item}
                    onSelect={(v) => {
                      setSelectedVisitor(v);
                      setInputOtp("");
                    }}
                  />
                )}
              />

              {hasMoreRequests && (
                <Button
                  mode="outlined"
                  onPress={() => setRequestsLimit((n) => n + REQUESTS_PAGE_SIZE)}
                  textColor={ACCENT}
                  style={{ borderColor: ACCENT, borderRadius: 12, marginTop: 10 }}
                  icon="chevron-down"
                >
                  Load more ({filtered.length - requestsLimit} remaining)
                </Button>
              )}
            </>
          )}

          <View style={{ height: 90 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* SINGLE VISITOR FOCUSED CARD MODAL */}
      <Modal
        visible={!!selectedVisitor}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedVisitor(null)}
      >
        <View style={styles.modalBackdropContainer}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSelectedVisitor(null)}
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardAvoidingModalView}
          >
            <View style={styles.focusedCardModal}>
              {selectedVisitor && (
                <>
                  <View style={styles.modalTopHeader}>
                    <Text style={styles.modalTitle}>Visitor Pass Verification</Text>
                    <IconButton
                      icon="close"
                      size={22}
                      iconColor={INK}
                      onPress={() => setSelectedVisitor(null)}
                      style={{ margin: 0 }}
                    />
                  </View>

                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 16 }}
                  >
                    <View style={styles.focusedImageCenter}>
                      {selectedVisitor.visitors?.photo_url ? (
                        <Image
                          source={{ uri: selectedVisitor.visitors.photo_url }}
                          style={styles.focusedAvatar}
                        />
                      ) : (
                        <View style={styles.focusedAvatarPlaceholder}>
                          <Text style={styles.focusedAvatarInitial}>
                            {selectedVisitor.visitors?.name?.[0]?.toUpperCase() ?? "?"}
                          </Text>
                        </View>
                      )}

                      <Text style={styles.focusedVisitorName}>
                        {selectedVisitor.visitors?.name}
                      </Text>

                      <Chip
                        compact
                        textStyle={{
                          color:
                            selectedVisitor.resolution === "left_at_gate"
                              ? TEAL
                              : isExpiredDelivery(selectedVisitor)
                              ? DANGER
                              : statusColor(selectedVisitor.status),
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                        style={{
                          backgroundColor:
                            selectedVisitor.resolution === "left_at_gate"
                              ? TEAL_BG
                              : isExpiredDelivery(selectedVisitor)
                              ? DANGER_BG
                              : statusBg(selectedVisitor.status),
                          marginTop: 6,
                        }}
                      >
                        {selectedVisitor.resolution === "left_at_gate"
                          ? "Left at Gate"
                          : isExpiredDelivery(selectedVisitor)
                          ? "Expired Request"
                          : selectedVisitor.pre_approved
                          ? "Pre-Approved"
                          : selectedVisitor.visitors?.frequent_visitor_id &&
                            selectedVisitor.status === "approved"
                          ? "Regular · Approved"
                          : selectedVisitor.status}
                      </Chip>

                      {isExpiredDelivery(selectedVisitor) && selectedVisitor.timeout_notified_at && (
                        <Text style={styles.residentNotifiedHint}>
                          🔔 Resident notified at{" "}
                          {new Date(selectedVisitor.timeout_notified_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      )}
                    </View>

                    <Divider style={{ marginVertical: 14, backgroundColor: BORDER }} />

                    <View style={styles.detailMetaRow}>
                      <Text style={styles.detailLabel}>Destination Flat</Text>
                      <Text style={styles.detailValue}>
                        Flat {selectedVisitor.flats?.flat_number ?? "—"}
                      </Text>
                    </View>

                    <View style={styles.detailMetaRow}>
                      <Text style={styles.detailLabel}>Visitor Category</Text>
                      <Text style={styles.detailValue}>
                        {selectedVisitor.visitors?.visitor_type}
                      </Text>
                    </View>

                    {selectedVisitor.visitors?.vehicle_number && (
                      <View style={styles.detailMetaRow}>
                        <Text style={styles.detailLabel}>Vehicle Number</Text>
                        <Text style={styles.detailValue}>
                          {selectedVisitor.visitors.vehicle_number}
                        </Text>
                      </View>
                    )}

                    <View style={styles.detailMetaRow}>
                      <Text style={styles.detailLabel}>Request Time</Text>
                      <Text style={styles.detailValue}>
                        {new Date(selectedVisitor.created_at).toLocaleString()}
                      </Text>
                    </View>

                    {selectedVisitor.pre_approved &&
                      selectedVisitor.status === "approved" &&
                      !selectedVisitor.entry_time &&
                      !isExpiredDelivery(selectedVisitor) && (
                        <View style={styles.cardOtpBox}>
                          <Text style={styles.sectionSubtitleHeader}>
                            Guest Passcode Verification
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 8,
                              alignItems: "center",
                              marginTop: 6,
                            }}
                          >
                            <TextInput
                              mode="flat"
                              placeholder="Enter 6-digit OTP"
                              value={inputOtp}
                              onChangeText={(t) =>
                                setInputOtp(t.replace(/\D/g, "").slice(0, 6))
                              }
                              keyboardType="numeric"
                              maxLength={6}
                              style={styles.cardOtpInput}
                              underlineColor="transparent"
                              activeUnderlineColor="transparent"
                              textColor={INK}
                              dense
                            />
                            <Button
                              mode="contained"
                              buttonColor={ACCENT}
                              textColor="#fff"
                              loading={actionLoadingId === selectedVisitor.id}
                              disabled={
                                actionLoadingId === selectedVisitor.id ||
                                inputOtp.length !== 6
                              }
                              onPress={() =>
                                handleOtpVerificationAndEntry(selectedVisitor)
                              }
                              style={{ borderRadius: 10 }}
                              compact
                            >
                              Verify Passcode
                            </Button>
                          </View>

                          <Divider
                            style={{ marginVertical: 12, backgroundColor: BORDER }}
                          />

                          <Button
                            mode="outlined"
                            textColor={ACCENT}
                            icon="account-check-outline"
                            style={{ borderColor: ACCENT, borderRadius: 12 }}
                            loading={actionLoadingId === selectedVisitor.id}
                            disabled={actionLoadingId === selectedVisitor.id}
                            onPress={() => {
                              Alert.alert(
                                "Visual Identity Check",
                                `Confirm that visitor's face matches the pre-approved profile photo for ${selectedVisitor.visitors?.name}?`,
                                [
                                  { text: "Cancel", style: "cancel" },
                                  {
                                    text: "Confirm & Grant Entry",
                                    onPress: () => markEntry(selectedVisitor.id),
                                  },
                                ]
                              );
                            }}
                          >
                            Verify Identity via Photo Check
                          </Button>
                        </View>
                      )}

                    {!selectedVisitor.pre_approved &&
                      selectedVisitor.status === "approved" &&
                      !selectedVisitor.entry_time &&
                      !isExpiredDelivery(selectedVisitor) &&
                      selectedVisitor.resolution !== "left_at_gate" && (
                        <View style={{ gap: 10, marginTop: 16 }}>
                          <Button
                            mode="contained"
                            icon="login"
                            buttonColor={ACCENT}
                            textColor="#fff"
                            loading={actionLoadingId === selectedVisitor.id}
                            disabled={actionLoadingId === selectedVisitor.id}
                            onPress={() => markEntry(selectedVisitor.id)}
                            style={{ borderRadius: 14 }}
                          >
                            Mark Entry
                          </Button>

                          {selectedVisitor.visitors?.visitor_type === "delivery" && (
                            <Button
                              mode="outlined"
                              icon="package-down"
                              textColor={TEAL}
                              style={{ borderRadius: 14, borderColor: TEAL }}
                              loading={actionLoadingId === selectedVisitor.id}
                              disabled={actionLoadingId === selectedVisitor.id}
                              onPress={() => {
                                Alert.alert(
                                  "Leave at Gate",
                                  "Mark this parcel as left with security at the gate instead of a full entry?",
                                  [
                                    { text: "Cancel", style: "cancel" },
                                    {
                                      text: "Confirm",
                                      onPress: () => markLeftAtGate(selectedVisitor.id),
                                    },
                                  ]
                                );
                              }}
                            >
                              Leave at Gate
                            </Button>
                          )}
                        </View>
                      )}

                    {isExpiredDelivery(selectedVisitor) && (
                      <Button
                        mode="outlined"
                        icon="package-down"
                        textColor={TEAL}
                        style={{ borderRadius: 14, borderColor: TEAL, marginTop: 16 }}
                        loading={actionLoadingId === selectedVisitor.id}
                        disabled={actionLoadingId === selectedVisitor.id}
                        onPress={() => {
                          Alert.alert(
                            "Leave at Gate",
                            "Mark this parcel as left with security at the gate?",
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Confirm",
                                onPress: () => markLeftAtGate(selectedVisitor.id),
                              },
                            ]
                          );
                        }}
                      >
                        Leave at Gate
                      </Button>
                    )}

                    {selectedVisitor.entry_time && !selectedVisitor.exit_time && (
                      <Button
                        mode="outlined"
                        icon="logout"
                        textColor={ACCENT}
                        style={{
                          borderRadius: 14,
                          borderColor: ACCENT,
                          marginTop: 16,
                        }}
                        loading={actionLoadingId === selectedVisitor.id}
                        disabled={actionLoadingId === selectedVisitor.id}
                        onPress={() => markExit(selectedVisitor.id)}
                      >
                        Mark Exit
                      </Button>
                    )}
                  </ScrollView>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* BOTTOM NAV */}
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
              size={21}
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
              size={21}
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
          onPress={() => goToTab("quick")}
          hitSlop={8}
        >
          <View
            style={[
              styles.navIconWrap,
              tab === "quick" && styles.navIconWrapActive,
            ]}
          >
            <IconButton
              icon="account-sync-outline"
              size={21}
              iconColor={tab === "quick" ? ACCENT : INK_FAINT}
              style={{ margin: 0 }}
            />
            {activeExpressPasses.length > 0 && tab !== "quick" && (
              <View style={styles.navBadge}>
                <Text style={styles.navBadgeText}>
                  {activeExpressPasses.length}
                </Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.navLabel,
              tab === "quick" && styles.navLabelActive,
            ]}
          >
            Quick
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
              size={21}
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

      {/* RESTORED ORIGINAL GUARD PROFILE MODAL */}
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
  quickActionTile: { flex: 1, alignItems: "center", gap: 8, position: "relative" },
  quickActionLabel: {
    fontSize: 11,
    color: INK_MUTED,
    fontWeight: "600",
    textAlign: "center",
  },
  tileBadge: {
    position: "absolute",
    top: -2,
    right: 4,
    backgroundColor: DANGER,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  tileBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  viewAllLink: { fontSize: 13, fontWeight: "700", color: ACCENT },

  // FORM SEGMENT SWITCHER
  formSwitcherContainer: {
    flexDirection: "row",
    backgroundColor: INPUT_BG,
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  formSwitcherTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 12,
  },
  formSwitcherTabActive: {
    backgroundColor: CARD_BG,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  formSwitcherText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: INK_MUTED,
  },
  formSwitcherTextActive: {
    color: ACCENT,
    fontWeight: "800",
  },

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

  frequentRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: INPUT_BG,
    borderRadius: 16,
    padding: 12,
    gap: 12,
    marginBottom: 8,
  },

  saveFrequentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  saveFrequentTitle: { fontSize: 13, fontWeight: "700", color: INK },

  moreDetailsToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    marginBottom: 14,
    paddingVertical: 4,
  },
  moreDetailsToggleText: { fontSize: 12.5, fontWeight: "700", color: ACCENT },

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
    marginBottom: 8,
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
  photoPlaceholderRequired: { borderColor: DANGER, backgroundColor: DANGER_BG },
  photoRequiredHint: {
    fontSize: 11,
    color: DANGER,
    marginBottom: 16,
    marginTop: -2,
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

  compactRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 12,
    marginBottom: 8,
  },
  rowStatusChip: { flexShrink: 0, marginLeft: 6 },
  thumbRow: { width: 44, height: 44, borderRadius: 22 },
  thumbPlaceholderRow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
  },
  thumbInitialRow: { color: "#fff", fontSize: 16, fontWeight: "700" },
  visitorNameRow: { fontSize: 15, fontWeight: "700", color: INK, flexShrink: 1 },
  metaRow: { fontSize: 12, color: INK_MUTED, marginTop: 2 },
  metaRowVehicle: { fontSize: 11.5, color: INK_FAINT, marginTop: 1 },
  timerTextRow: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  capHintText: {
    fontSize: 11,
    color: INK_FAINT,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 4,
  },

  modalBackdropContainer: {
    flex: 1,
    backgroundColor: "rgba(21,19,31,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  keyboardAvoidingModalView: {
    width: "100%",
    maxHeight: "85%",
  },
  focusedCardModal: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: 20,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTopHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: { fontSize: 17, fontWeight: "800", color: INK },
  focusedImageCenter: { alignItems: "center", marginTop: 6 },
  focusedAvatar: { width: 90, height: 90, borderRadius: 45 },
  focusedAvatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
  },
  focusedAvatarInitial: { color: "#fff", fontSize: 34, fontWeight: "800" },
  focusedVisitorName: {
    fontSize: 20,
    fontWeight: "800",
    color: INK,
    marginTop: 10,
  },
  residentNotifiedHint: {
    fontSize: 11,
    color: TEAL,
    marginTop: 6,
    fontWeight: "600",
  },
  detailMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  detailLabel: { fontSize: 13, color: INK_MUTED, fontWeight: "500" },
  detailValue: { fontSize: 13, color: INK, fontWeight: "700" },

  card: {
    borderRadius: 18,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#151329",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardOtpBox: {
    marginTop: 14,
    backgroundColor: INPUT_BG,
    padding: 14,
    borderRadius: 16,
  },
  sectionSubtitleHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: INK,
  },
  cardOtpInput: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 8,
    fontSize: 14,
    height: 40,
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
  visitorName: { fontSize: 16, fontWeight: "700", color: INK, flexShrink: 1 },
  meta: { color: INK_MUTED, marginTop: 3, fontSize: 13 },
  metaFaint: { color: INK_FAINT, marginTop: 2, fontSize: 12 },

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
  empty: { color: INK_FAINT, fontSize: 14, textAlign: "center", paddingHorizontal: 16 },

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
    width: 40,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  navIconWrapActive: { backgroundColor: ACCENT_SOFT },
  navBadge: {
    position: "absolute",
    top: -2,
    right: 2,
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
  navLabel: { fontSize: 10.5, color: INK_FAINT, fontWeight: "600", marginTop: 2 },
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