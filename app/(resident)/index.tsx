import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  ScrollView,
  Platform,
  Image,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Linking,
  Share,
} from "react-native";
import {
  Button,
  TextInput,
  Chip,
  Avatar,
  Divider,
  IconButton,
} from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
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

const statusColor = (status: string) => {
  if (status === "approved") return SUCCESS;
  if (status === "denied") return DANGER;
  return GOLD;
};

type VisitorRequest = {
  id: string;
  status: string;
  pre_approved: boolean;
  otp_code: string | null;
  entry_time: string | null;
  exit_time: string | null;
  created_at: string;
  visitors: {
    name: string;
    phone: string;
    visitor_type: string;
    photo_url: string | null;
  } | null;
};
type Notice = { id: string; title: string; body: string; created_at: string };
type PollOption = { id: string; option_text: string };
type Poll = { id: string; question: string; poll_options: PollOption[] };
type Vote = { poll_id: string; option_id: string; voter_id: string };
type Ticket = {
  id: string;
  category: string;
  description: string;
  status: string;
  created_at: string;
};
type Amenity = { id: string; name: string; capacity: number; slots: string[] };
type Booking = {
  id: string;
  amenity_id: string;
  booking_date: string;
  slot: string;
};
type Staff = {
  id: string;
  name: string;
  service_type: string;
  phone: string | null;
  photo_url: string | null;
};
type Due = {
  id: string;
  flat_id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  paid_at: string | null;
};
type MyProfile = {
  full_name: string;
  phone: string | null;
  flat_number: string | null;
  tower_name: string | null;
};

const MORE_TABS = [
  { key: "dues", label: "Dues", icon: "cash-multiple" },
  { key: "polls", label: "Polls", icon: "poll" },
  { key: "helpdesk", label: "Helpdesk", icon: "headset" },
  { key: "amenities", label: "Amenities", icon: "calendar-check" },
  { key: "staff", label: "Staff", icon: "account-hard-hat" },
];

const ENTRY_TYPES = [
  { label: "🍔 Food Delivery", key: "food" },
  { label: "📦 Parcel / E-Commerce", key: "parcel" },
  { label: "🚕 Cab / Rapido / Ride", key: "cab" },
  { label: "🛵 Other Service", key: "other" },
];

const VALIDITY_OPTIONS = [
  { label: "⏱️ Next 1 Hour", key: "1_hour" },
  { label: "⏱️ Next 2 Hours", key: "2_hours" },
  { label: "☀️ Valid Today", key: "today" },
  { label: "📦 Leave at Gate directly", key: "leave_at_gate" },
];

export default function ResidentHome() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("home");
  const [requests, setRequests] = useState<VisitorRequest[]>([]);
  const [flatId, setFlatId] = useState<string | null>(null);

  // Visitors Tab Form Switch: 'guest' | 'express'
  const [preApproveMode, setPreApproveMode] = useState<"guest" | "express">("guest");

  // Guest Pre-approval state
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestPhotoUri, setGuestPhotoUri] = useState<string | null>(null);
  const [guestLoading, setGuestLoading] = useState(false);

  // Express Pass (Delivery/Cab) State
  const [deliveryCategory, setDeliveryCategory] = useState("food");
  const [customDeliveryName, setCustomDeliveryName] = useState("");
  const [deliveryValidity, setDeliveryValidity] = useState("1_hour");
  const [deliveryLoading, setDeliveryLoading] = useState(false);

  // Dropdown Modal Pickers
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [validityPickerOpen, setValidityPickerOpen] = useState(false);

  const [notices, setNotices] = useState<Notice[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketCategory, setTicketCategory] = useState("general");
  const [customCategory, setCustomCategory] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketLoading, setTicketLoading] = useState(false);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [bookingDate, setBookingDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [dues, setDues] = useState<Due[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllNotices, setShowAllNotices] = useState(false);
  const [showAllPolls, setShowAllPolls] = useState(false);

  // Modal inspection states
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorRequest | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedReceiptDue, setSelectedReceiptDue] = useState<Due | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);

  const userId = useAuthStore((s) => s.userId);
  const clearSession = useAuthStore((s) => s.clearSession);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearSession();
    router.replace("/(auth)/login");
  };

  const copyToClipboard = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert("Code Copied", `Passcode ${code} copied to clipboard!`);
  };

  const buildPasscodeMessage = (visitorName: string, code: string) => {
    const flatLabel = `${myProfile?.tower_name ? myProfile.tower_name + " · " : ""}Flat ${myProfile?.flat_number ?? "—"}`;
    return `You're invited! 🏡\n\nHi ${visitorName}, you've been pre-approved to visit ${flatLabel}.\n\nYour entry passcode: ${code}\n\nPlease show this code to the security guard at the main gate on arrival.`;
  };

  const sharePasscode = async (visitorName: string, code: string) => {
    const msg = buildPasscodeMessage(visitorName, code);
    try {
      await Share.share(
        Platform.OS === "ios"
          ? { message: msg }
          : { message: msg, title: "Guest Entry Passcode" }
      );
    } catch {
      Alert.alert("Guest Passcode", msg);
    }
  };

  const callPhone = (phone: string | null) => {
    if (!phone) {
      Alert.alert("No Phone Number", "No contact phone provided for this staff member.");
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const sendSOS = async (emergencyType: string) => {
    if (sosLoading || !flatId) return;
    setSosLoading(true);
    try {
      const { error } = await supabase.from("sos_alerts").insert({
        resident_id: userId,
        flat_id: flatId,
        emergency_type: emergencyType,
        status: "active",
      });
      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      setSosOpen(false);
      Alert.alert("Alert Sent", "Guard and admin have been notified immediately.");
    } finally {
      setSosLoading(false);
    }
  };

  const fetchRequests = async (currentFlatId: string) => {
    const { data, error } = await supabase
      .from("visitor_requests")
      .select(
        "id, status, pre_approved, otp_code, entry_time, exit_time, created_at, visitors(name, phone, visitor_type, photo_url)"
      )
      .eq("flat_id", currentFlatId)
      .order("created_at", { ascending: false });
    if (!error && data) setRequests(data as any);
  };

  const fetchNotices = async () => {
    const { data } = await supabase
      .from("notices")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setNotices(data);
  };

  const fetchPolls = async () => {
    const { data } = await supabase
      .from("polls")
      .select("id, question, poll_options(id, option_text)")
      .order("created_at", { ascending: false });
    if (data) setPolls(data as any);
  };

  const fetchVotes = async () => {
    const { data } = await supabase
      .from("poll_votes")
      .select("poll_id, option_id, voter_id");
    if (data) setVotes(data);
  };

  const fetchTickets = async () => {
    const { data } = await supabase
      .from("tickets")
      .select("*")
      .eq("resident_id", userId)
      .order("created_at", { ascending: false });
    if (data) setTickets(data);
  };

  const fetchAmenities = async () => {
    const { data } = await supabase
      .from("amenities")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setAmenities(data);
  };

  const fetchMyBookings = async () => {
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("resident_id", userId)
      .order("booking_date", { ascending: true });
    if (data) setMyBookings(data);
  };

  const fetchStaff = async () => {
    const { data } = await supabase
      .from("staff_directory")
      .select("*")
      .order("name");
    if (data) setStaff(data);
  };

  const fetchDues = async (currentFlatId: string) => {
    const { data } = await supabase
      .from("dues")
      .select("*")
      .eq("flat_id", currentFlatId)
      .order("due_date", { ascending: false });
    if (data) setDues(data);
  };

  const fetchMyProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, phone, flats(flat_number, towers(name))")
      .eq("id", userId)
      .single();
    if (data) {
      setMyProfile({
        full_name: (data as any).full_name,
        phone: (data as any).phone,
        flat_number: (data as any).flats?.flat_number ?? null,
        tower_name: (data as any).flats?.towers?.name ?? null,
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    let channels: ReturnType<typeof supabase.channel>[] = [];

    const init = async () => {
      await supabase.removeAllChannels();

      const { data: profile } = await supabase
        .from("profiles")
        .select("flat_id")
        .eq("id", userId)
        .single();
      if (!profile?.flat_id || cancelled) return;
      setFlatId(profile.flat_id);
      fetchRequests(profile.flat_id);
      fetchNotices();
      fetchPolls();
      fetchVotes();
      fetchTickets();
      fetchAmenities();
      fetchMyBookings();
      fetchStaff();
      fetchDues(profile.flat_id);
      fetchMyProfile();

      if (cancelled) return;

      channels = [
        supabase
          .channel(`visitor_requests_resident_${userId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "visitor_requests",
              filter: `flat_id=eq.${profile.flat_id}`,
            },
            () => fetchRequests(profile.flat_id)
          )
          .subscribe(),
        supabase
          .channel(`notices_resident_${userId}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "notices" },
            () => fetchNotices()
          )
          .subscribe(),
        supabase
          .channel(`polls_resident_${userId}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "poll_votes" },
            () => fetchVotes()
          )
          .subscribe(),
        supabase
          .channel(`tickets_resident_${userId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "tickets",
              filter: `resident_id=eq.${userId}`,
            },
            () => fetchTickets()
          )
          .subscribe(),
        supabase
          .channel(`dues_resident_${userId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "dues",
              filter: `flat_id=eq.${profile.flat_id}`,
            },
            () => fetchDues(profile.flat_id)
          )
          .subscribe(),
      ];
    };

    init();

    return () => {
      cancelled = true;
      channels.forEach((c) => supabase.removeChannel(c));
      supabase.removeAllChannels();
    };
  }, [userId]);

  const respondToRequest = async (
    requestId: string,
    status: "approved" | "denied"
  ) => {
    const { error } = await supabase
      .from("visitor_requests")
      .update({ status })
      .eq("id", requestId);
    if (error) Alert.alert("Error", error.message);
  };

  const pickGuestPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.5,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) setGuestPhotoUri(result.assets[0].uri);
  };

  const uploadGuestPhoto = async (uri: string): Promise<string | null> => {
    try {
      const fileName = `guest_${Date.now()}.jpg`;
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

  const notifySelfOfPreApproval = async (visitorName: string, code: string) => {
    try {
      const { data: selfProfile } = await supabase
        .from("profiles")
        .select("push_token")
        .eq("id", userId)
        .maybeSingle();

      if (selfProfile?.push_token) {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: selfProfile.push_token,
            sound: "default",
            title: "✅ Guest Pre-approved",
            body: `${visitorName} is pre-approved for entry. Passcode: ${code}`,
            data: { screen: "visitors" },
          }),
        });
      }
    } catch (pushErr) {
      console.log("Self pre-approval notification failed:", pushErr);
    }
  };

  const handlePreApprove = async () => {
    if (guestLoading) return;
    if (!guestName || !flatId) {
      Alert.alert("Missing info", "Enter a guest name");
      return;
    }
    if (guestName.trim().length < 3 || guestName.trim().length > 15) {
      Alert.alert(
        "Invalid name",
        "Guest name must be between 3 and 15 characters"
      );
      return;
    }
    if (guestPhone.trim().length > 0 && !/^\d{10}$/.test(guestPhone.trim())) {
      Alert.alert("Invalid phone", "Phone number must be exactly 10 digits");
      return;
    }
    setGuestLoading(true);
    try {
      let photoUrl: string | null = null;
      if (guestPhotoUri) photoUrl = await uploadGuestPhoto(guestPhotoUri);
      const { data: visitor, error: visitorError } = await supabase
        .from("visitors")
        .insert({
          name: guestName,
          phone: guestPhone,
          visitor_type: "guest",
          photo_url: photoUrl,
        })
        .select()
        .single();
      if (visitorError || !visitor) {
        Alert.alert("Error", visitorError?.message ?? "Could not create guest");
        return;
      }
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const { error: requestError } = await supabase
        .from("visitor_requests")
        .insert({
          visitor_id: visitor.id,
          flat_id: flatId,
          status: "approved",
          pre_approved: true,
          otp_code: otpCode,
        });
      if (requestError) {
        Alert.alert("Error", requestError.message);
        return;
      }

      notifySelfOfPreApproval(guestName, otpCode);

      Alert.alert(
        "Pre-approved Successfully",
        `${guestName} is pre-approved.\n\nPasscode: ${otpCode}\n\nCode added to your Visitor History. Share it with your guest from there.`
      );
      setGuestName("");
      setGuestPhone("");
      setGuestPhotoUri(null);
    } finally {
      setGuestLoading(false);
    }
  };

  const handlePreApproveDelivery = async () => {
    if (!flatId) return;

    const finalCategory =
      deliveryCategory === "other" && customDeliveryName.trim()
        ? customDeliveryName.trim()
        : deliveryCategory;

    if (!finalCategory) {
      Alert.alert("Missing info", "Please specify the delivery name");
      return;
    }

    setDeliveryLoading(true);

    try {
      let validUntil = new Date();
      let leaveAtGateOnly = false;

      if (deliveryValidity === "1_hour") {
        validUntil.setHours(validUntil.getHours() + 1);
      } else if (deliveryValidity === "2_hours") {
        validUntil.setHours(validUntil.getHours() + 2);
      } else if (deliveryValidity === "today") {
        validUntil.setHours(23, 59, 59, 999);
      } else if (deliveryValidity === "leave_at_gate") {
        validUntil.setHours(validUntil.getHours() + 4);
        leaveAtGateOnly = true;
      }

      const { error } = await supabase.from("delivery_pre_approvals").insert({
        flat_id: flatId,
        resident_id: userId,
        company_name: finalCategory.toLowerCase(),
        leave_at_gate_only: leaveAtGateOnly,
        valid_until: validUntil.toISOString(),
      });

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      Alert.alert(
        "Express Pass Active! ⚡",
        `Pre-approval enabled for ${finalCategory.toUpperCase()}.\n\nInstructions: ${
          leaveAtGateOnly ? "Leave parcel at Gate." : "Allowed inside."
        }`
      );

      setCustomDeliveryName("");
    } finally {
      setDeliveryLoading(false);
    }
  };

  const castVote = async (pollId: string, optionId: string) => {
    const { error } = await supabase
      .from("poll_votes")
      .insert({ poll_id: pollId, option_id: optionId, voter_id: userId });
    if (error) Alert.alert("Already voted", "You can only vote once per poll");
  };

  const handleRaiseTicket = async () => {
    if (ticketLoading) return;
    if (!ticketDescription) {
      Alert.alert("Missing info", "Please describe the issue");
      return;
    }
    if (ticketCategory === "other" && !customCategory.trim()) {
      Alert.alert("Missing info", "Please specify the category");
      return;
    }
    setTicketLoading(true);
    try {
      const finalCategory =
        ticketCategory === "other" ? customCategory.trim() : ticketCategory;
      const { error } = await supabase.from("tickets").insert({
        resident_id: userId,
        category: finalCategory,
        description: ticketDescription,
        status: "open",
      });
      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      setTicketDescription("");
      setCustomCategory("");
      Alert.alert("Ticket raised", "The admin has been notified");
    } finally {
      setTicketLoading(false);
    }
  };

  const handleBookSlot = async (amenity: Amenity, slot: string) => {
    if (!bookingDate) {
      Alert.alert("Pick a date", "Choose a date first");
      return;
    }
    const { error } = await supabase.from("bookings").insert({
      amenity_id: amenity.id,
      resident_id: userId,
      booking_date: bookingDate,
      slot,
    });
    if (error) {
      if (error.code === "23505")
        Alert.alert(
          "Already Booked",
          "This slot is taken for that date. Pick another."
        );
      else Alert.alert("Error", error.message);
      return;
    }
    Alert.alert("Booked!", `${amenity.name} — ${slot} on ${bookingDate}`);
  };

  const cancelMyBooking = async (bookingId: string) => {
    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("id", bookingId);
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    fetchMyBookings();
  };

  const payDue = async (due: Due) => {
    if (payingId) return;
    setPayingId(due.id);
    try {
      const paidTimestamp = new Date().toISOString();
      const { error } = await supabase
        .from("dues")
        .update({ status: "paid", paid_at: paidTimestamp })
        .eq("id", due.id);
      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      setSelectedReceiptDue({
        ...due,
        status: "paid",
        paid_at: paidTimestamp,
      });
    } finally {
      setPayingId(null);
    }
  };

  const exportPDFInvoice = async (due: Due) => {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      const invNumber = `INV-${due.id.slice(0, 8).toUpperCase()}`;
      const paidDate = due.paid_at
        ? new Date(due.paid_at).toLocaleString("en-IN")
        : new Date().toLocaleString("en-IN");

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 32px; color: #15131F; }
            .header-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #4F3FE0; padding-bottom: 20px; }
            .logo-title { font-size: 26px; font-weight: 800; color: #4F3FE0; letter-spacing: 0.5px; }
            .sub-title { font-size: 13px; text-transform: uppercase; color: #6B6878; font-weight: 700; margin-top: 4px; }
            .badge-paid { background-color: #E9F8EF; color: #1E9E5A; border: 1px solid #1E9E5A; padding: 6px 16px; border-radius: 20px; font-weight: 800; font-size: 13px; }
            .info-grid { display: flex; justify-content: space-between; margin-top: 30px; }
            .info-col { flex: 1; }
            .label { font-size: 11px; font-weight: 700; color: #A6A3B3; text-transform: uppercase; letter-spacing: 0.5px; }
            .value { font-size: 15px; font-weight: 700; color: #15131F; margin-top: 4px; }
            .value-sub { font-size: 13px; color: #6B6878; font-weight: 500; margin-top: 2px; }
            .items-table { width: 100%; border-collapse: collapse; margin-top: 35px; }
            .items-table th { background-color: #EFECFD; color: #4F3FE0; text-align: left; padding: 12px 16px; font-size: 12px; font-weight: 700; text-transform: uppercase; border-radius: 6px; }
            .items-table td { padding: 16px; border-bottom: 1px solid #ECEAF2; font-size: 14px; }
            .total-card { background-color: #F5F4F9; border-radius: 14px; padding: 20px; margin-top: 30px; text-align: right; }
            .total-label { font-size: 12px; color: #6B6878; font-weight: 600; text-transform: uppercase; }
            .total-val { font-size: 28px; font-weight: 800; color: #4F3FE0; margin-top: 4px; }
            .footer-note { margin-top: 50px; text-align: center; font-size: 11px; color: #A6A3B3; border-top: 1px dashed #ECEAF2; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <div class="logo-title">PORTL SOCIETY SERVICES</div>
              <div class="sub-title">Official Digital Tax Receipt</div>
            </div>
            <div class="badge-paid">PAID ✓</div>
          </div>

          <div class="info-grid">
            <div class="info-col">
              <div class="label">Billed To</div>
              <div class="value">${myProfile?.full_name ?? "Resident"}</div>
              <div class="value-sub">${myProfile?.tower_name ? myProfile.tower_name + " · " : ""}Flat ${myProfile?.flat_number ?? "N/A"}</div>
            </div>
            <div class="info-col" style="text-align: right;">
              <div class="label">Receipt Reference</div>
              <div class="value">${invNumber}</div>
              <div class="value-sub">Date: ${paidDate}</div>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Payment Term</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>${due.description}</b></td>
                <td>Due by ${due.due_date}</td>
                <td style="text-align: right; font-weight: 700;">₹${due.amount}</td>
              </tr>
            </tbody>
          </table>

          <div class="total-card">
            <div class="total-label">Total Amount Paid</div>
            <div class="total-val">₹${due.amount}</div>
          </div>

          <div class="footer-note">
            This digital receipt is generated electronically by PORTL Society Management Systems.<br/>
            Valid proof of transaction. No physical signature required.
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { UTI: ".pdf", mimeType: "application/pdf" });
    } catch {
      Alert.alert("Error", "Could not generate invoice PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (selectedDate) setBookingDate(selectedDate.toISOString().split("T")[0]);
  };

  const hasVoted = (pollId: string) =>
    votes.some((v) => v.poll_id === pollId && v.voter_id === userId);
  const voteCount = (optionId: string) =>
    votes.filter((v) => v.option_id === optionId).length;
  const amenityNameFor = (id: string) =>
    amenities.find((a) => a.id === id)?.name ?? "Unknown";

  const pendingDues = dues.filter((d) => d.status !== "paid");
  const paidDues = dues.filter((d) => d.status === "paid");
  const totalDue = pendingDues.reduce((sum, d) => sum + Number(d.amount), 0);

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const pastRequests = requests.filter((r) => r.status !== "pending");
  const visibleHistory = showAllHistory
    ? pastRequests
    : pastRequests.slice(0, 5);
  const visibleNotices = showAllNotices ? notices : notices.slice(0, 5);
  const visiblePolls = showAllPolls ? polls : polls.slice(0, 3);

  const ticketStatusColor = (status: string) =>
    status === "resolved"
      ? SUCCESS
      : status === "in_progress"
      ? GOLD
      : INK_MUTED;
  const ticketStatusBg = (status: string) =>
    status === "resolved"
      ? SUCCESS_BG
      : status === "in_progress"
      ? "#FBF3E4"
      : INPUT_BG;

  const inputTheme = {
    colors: {
      onSurfaceVariant: INK_MUTED,
      background: "transparent",
      primary: ACCENT,
    },
  };

  const isMoreActiveTab = MORE_TABS.some((t) => t.key === tab);

  const firstName = myProfile?.full_name?.split(" ")[0] ?? "there";
  const openTicketsCount = tickets.filter(
    (t) => t.status !== "resolved"
  ).length;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const latestNotice = notices[0] ?? null;
  const nextBooking = myBookings[0] ?? null;

  const selectedCategoryObj = ENTRY_TYPES.find((c) => c.key === deliveryCategory);
  const selectedValidityObj = VALIDITY_OPTIONS.find((v) => v.key === deliveryValidity);

  const goToTab = (key: string) => {
    setTab(key);
    setMoreOpen(false);
    setProfileOpen(false);
  };

  return (
    <View style={styles.screen}>
      {/* Compact Top SOS Button */}
      <Pressable style={[styles.sosFab, { top: insets.top + 10 }]} onPress={() => setSosOpen(true)}>
        <IconButton
          icon="alert-octagon"
          size={16}
          iconColor="#fff"
          style={{ margin: 0 }}
        />
        <Text style={styles.sosFabText}>SOS</Text>
      </Pressable>

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.title}>{firstName}</Text>
          {(myProfile?.tower_name || myProfile?.flat_number) && (
            <View style={styles.flatBadge}>
              <IconButton
                icon="home-city-outline"
                size={14}
                iconColor={ACCENT}
                style={{ margin: 0, marginRight: -4 }}
              />
              <Text style={styles.flatBadgeText}>
                {myProfile?.tower_name ? `${myProfile.tower_name} · ` : ""}
                {myProfile?.flat_number ? `Flat ${myProfile.flat_number}` : ""}
              </Text>
            </View>
          )}
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
              <View style={styles.statsRow}>
                <Pressable
                  style={styles.statCard}
                  onPress={() => goToTab("dues")}
                >
                  <Text
                    style={[
                      styles.statNum,
                      pendingDues.length > 0 && { color: DANGER },
                    ]}
                  >
                    {pendingDues.length}
                  </Text>
                  <Text style={styles.statLabel}>Dues Pending</Text>
                </Pressable>
                <Pressable
                  style={styles.statCard}
                  onPress={() => goToTab("visitors")}
                >
                  <Text style={styles.statNum}>{pendingRequests.length}</Text>
                  <Text style={styles.statLabel}>Visitor Requests</Text>
                </Pressable>
                <Pressable
                  style={styles.statCard}
                  onPress={() => goToTab("helpdesk")}
                >
                  <Text style={styles.statNum}>{openTicketsCount}</Text>
                  <Text style={styles.statLabel}>Open Tickets</Text>
                </Pressable>
              </View>

              <Text style={styles.homeSectionLabel}>Quick Actions</Text>
              <View style={styles.quickActionsRow}>
                <Pressable
                  style={styles.quickActionTile}
                  onPress={() => goToTab("visitors")}
                >
                  <Avatar.Icon
                    size={40}
                    icon="account-plus"
                    style={{ backgroundColor: ACCENT_SOFT }}
                    color={ACCENT}
                  />
                  <Text style={styles.quickActionLabel}>Add Guest</Text>
                </Pressable>
                <Pressable
                  style={styles.quickActionTile}
                  onPress={() => goToTab("helpdesk")}
                >
                  <Avatar.Icon
                    size={40}
                    icon="headset"
                    style={{ backgroundColor: ACCENT_SOFT }}
                    color={ACCENT}
                  />
                  <Text style={styles.quickActionLabel}>Raise Ticket</Text>
                </Pressable>
                <Pressable
                  style={styles.quickActionTile}
                  onPress={() => goToTab("amenities")}
                >
                  <Avatar.Icon
                    size={40}
                    icon="calendar-check"
                    style={{ backgroundColor: ACCENT_SOFT }}
                    color={ACCENT}
                  />
                  <Text style={styles.quickActionLabel}>Book Slot</Text>
                </Pressable>
                <Pressable
                  style={styles.quickActionTile}
                  onPress={() => goToTab("dues")}
                >
                  <Avatar.Icon
                    size={40}
                    icon="cash-multiple"
                    style={{ backgroundColor: ACCENT_SOFT }}
                    color={ACCENT}
                  />
                  <Text style={styles.quickActionLabel}>Pay Dues</Text>
                </Pressable>
              </View>

              {pendingDues.length > 0 && (
                <Pressable
                  style={[styles.card, styles.totalDueCard]}
                  onPress={() => goToTab("dues")}
                >
                  <View
                    style={{
                      padding: 16,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.totalDueLabel}>
                        Total Outstanding
                      </Text>
                      <Text style={styles.totalDueAmount}>
                        ₹{totalDue.toFixed(2)}
                      </Text>
                    </View>
                    <IconButton
                      icon="chevron-right"
                      size={22}
                      iconColor="#fff"
                      style={{ margin: 0 }}
                    />
                  </View>
                </Pressable>
              )}

              <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
                <Avatar.Icon
                  size={30}
                  icon="bullhorn"
                  style={styles.sectionIcon}
                  color={ACCENT}
                />
                <Text style={styles.sectionTitle}>Latest Notice</Text>
                <Pressable onPress={() => goToTab("notices")}>
                  <Text style={styles.viewAllLink}>View all</Text>
                </Pressable>
              </View>
              {latestNotice ? (
                <Pressable
                  style={[styles.card, { marginBottom: 20 }]}
                  onPress={() => setSelectedNotice(latestNotice)}
                >
                  <View style={{ padding: 16 }}>
                    <Text style={styles.visitorName}>{latestNotice.title}</Text>
                    <Text style={styles.noticeBody} numberOfLines={2}>
                      {latestNotice.body}
                    </Text>
                    <Text style={styles.metaFaint}>
                      Published: {new Date(latestNotice.created_at).toLocaleDateString()} · Tap to read
                    </Text>
                  </View>
                </Pressable>
              ) : (
                <Text style={[styles.empty, { marginBottom: 20 }]}>
                  No notices yet
                </Text>
              )}

              {nextBooking && (
                <>
                  <View style={styles.sectionHeaderRow}>
                    <Avatar.Icon
                      size={30}
                      icon="calendar-clock"
                      style={styles.sectionIcon}
                      color={ACCENT}
                    />
                    <Text style={styles.sectionTitle}>Upcoming Booking</Text>
                    <Pressable onPress={() => goToTab("amenities")}>
                      <Text style={styles.viewAllLink}>View all</Text>
                    </Pressable>
                  </View>
                  <View style={[styles.card, { marginBottom: 8 }]}>
                    <View style={{ padding: 16 }}>
                      <Text style={styles.visitorName}>
                        {amenityNameFor(nextBooking.amenity_id)}
                      </Text>
                      <Text style={styles.meta}>
                        {nextBooking.booking_date} · {nextBooking.slot}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </>
          )}

          {tab === "visitors" && (
            <>
              {/* CLEAN UI SEGMENT SWITCHER */}
              <View style={styles.formSwitcherContainer}>
                <Pressable
                  style={[
                    styles.formSwitcherTab,
                    preApproveMode === "guest" && styles.formSwitcherTabActive,
                  ]}
                  onPress={() => setPreApproveMode("guest")}
                >
                  <Text
                    style={[
                      styles.formSwitcherText,
                      preApproveMode === "guest" && styles.formSwitcherTextActive,
                    ]}
                  >
                    👤 Guest Pass
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.formSwitcherTab,
                    preApproveMode === "express" && styles.formSwitcherTabActive,
                  ]}
                  onPress={() => setPreApproveMode("express")}
                >
                  <Text
                    style={[
                      styles.formSwitcherText,
                      preApproveMode === "express" && styles.formSwitcherTextActive,
                    ]}
                  >
                    ⚡ Express Pass
                  </Text>
                </Pressable>
              </View>

              {/* OPTION 1: GUEST PRE-APPROVAL */}
              {preApproveMode === "guest" && (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <Avatar.Icon
                      size={30}
                      icon="account-plus"
                      style={styles.sectionIcon}
                      color={ACCENT}
                    />
                    <Text style={styles.sectionTitle}>Pre-approve a Guest</Text>
                  </View>
                  <View style={styles.inputWrap}>
                    <TextInput
                      mode="flat"
                      label="Guest name"
                      value={guestName}
                      onChangeText={setGuestName}
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
                      label="Guest phone"
                      value={guestPhone}
                      onChangeText={(t) => setGuestPhone(t.replace(/\D/g, ""))}
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
                  <View style={styles.photoRow}>
                    {guestPhotoUri ? (
                      <Image
                        source={{ uri: guestPhotoUri }}
                        style={styles.previewImage}
                      />
                    ) : (
                      <View style={styles.photoPlaceholder}>
                        <Avatar.Icon
                          size={32}
                          icon="camera"
                          style={{ backgroundColor: "transparent" }}
                          color={INK_FAINT}
                        />
                      </View>
                    )}
                    <Button
                      mode="outlined"
                      onPress={pickGuestPhoto}
                      icon="camera"
                      textColor={ACCENT}
                      style={styles.photoButton}
                    >
                      {guestPhotoUri ? "Retake" : "Add Photo"}
                    </Button>
                  </View>
                  <Button
                    mode="contained"
                    onPress={handlePreApprove}
                    loading={guestLoading}
                    disabled={guestLoading}
                    buttonColor={ACCENT}
                    textColor="#fff"
                    style={styles.submitButton}
                    contentStyle={{ paddingVertical: 4 }}
                  >
                    Pre-approve Guest
                  </Button>
                </View>
              )}

              {/* OPTION 2: EXPRESS PASS (DELIVERY / CAB) */}
              {preApproveMode === "express" && (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <Avatar.Icon
                      size={30}
                      icon="flash-outline"
                      style={styles.sectionIcon}
                      color={ACCENT}
                    />
                    <Text style={styles.sectionTitle}>Express Pass (Services & Cabs)</Text>
                  </View>

                  {/* Dropdown 1: Type of Entry */}
                  <Text style={styles.fieldLabel}>Type of Entry</Text>
                  <Pressable
                    style={styles.dropdownSelector}
                    onPress={() => setTypePickerOpen(true)}
                  >
                    <Text style={styles.dropdownValueText}>
                      {selectedCategoryObj?.label ?? "Select Entry Type"}
                    </Text>
                    <IconButton
                      icon="chevron-down"
                      size={20}
                      iconColor={INK_MUTED}
                      style={{ margin: 0 }}
                    />
                  </Pressable>

                  {/* Custom Name input if "Other" selected */}
                  {deliveryCategory === "other" && (
                    <View style={[styles.inputWrap, { marginTop: 12 }]}>
                      <TextInput
                        mode="flat"
                        label="Specify Service / Company Name"
                        value={customDeliveryName}
                        onChangeText={setCustomDeliveryName}
                        style={styles.input}
                        underlineColor="transparent"
                        activeUnderlineColor="transparent"
                        textColor={INK}
                        theme={inputTheme}
                        cursorColor={ACCENT}
                      />
                    </View>
                  )}

                  {/* Dropdown 2: Validity Window / Action */}
                  <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
                    Validity Window / Action
                  </Text>
                  <Pressable
                    style={styles.dropdownSelector}
                    onPress={() => setValidityPickerOpen(true)}
                  >
                    <Text style={styles.dropdownValueText}>
                      {selectedValidityObj?.label ?? "Select Validity"}
                    </Text>
                    <IconButton
                      icon="chevron-down"
                      size={20}
                      iconColor={INK_MUTED}
                      style={{ margin: 0 }}
                    />
                  </Pressable>

                  <Button
                    mode="contained"
                    onPress={handlePreApproveDelivery}
                    loading={deliveryLoading}
                    disabled={deliveryLoading}
                    buttonColor={ACCENT}
                    textColor="#fff"
                    style={[styles.submitButton, { marginTop: 16 }]}
                    contentStyle={{ paddingVertical: 4 }}
                  >
                    Generate Express Pass
                  </Button>
                </View>
              )}

              {/* LIST 1: PENDING APPROVALS */}
              <View style={styles.sectionHeaderRow}>
                <Avatar.Icon
                  size={30}
                  icon="account-clock"
                  style={styles.sectionIcon}
                  color={ACCENT}
                />
                <Text style={styles.sectionTitle}>Pending Approvals</Text>
                {pendingRequests.length > 0 && (
                  <Text style={styles.countBadge}>
                    {pendingRequests.length}
                  </Text>
                )}
              </View>
              {pendingRequests.length === 0 && (
                <View style={styles.emptyState}>
                  <Avatar.Icon
                    size={44}
                    icon="check-circle-outline"
                    style={{ backgroundColor: ACCENT_SOFT }}
                    color={ACCENT}
                  />
                  <Text style={styles.empty}>No pending requests</Text>
                </View>
              )}
              <FlatList
                data={pendingRequests}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                renderItem={({ item }) => (
                  <Pressable style={styles.card} onPress={() => setSelectedVisitor(item)}>
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
                            {item.visitors?.visitor_type}
                            {item.visitors?.phone ? ` · ${item.visitors.phone}` : ""}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Divider style={{ backgroundColor: BORDER }} />
                    <View style={styles.cardActions}>
                      <Button
                        textColor={DANGER}
                        onPress={() => respondToRequest(item.id, "denied")}
                      >
                        Deny
                      </Button>
                      <Button
                        mode="contained"
                        buttonColor={ACCENT}
                        textColor="#fff"
                        onPress={() => respondToRequest(item.id, "approved")}
                      >
                        Approve
                      </Button>
                    </View>
                  </Pressable>
                )}
              />

              {/* LIST 2: VISITOR HISTORY */}
              <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
                <Avatar.Icon
                  size={30}
                  icon="history"
                  style={styles.sectionIcon}
                  color={ACCENT}
                />
                <Text style={styles.sectionTitle}>Visitor History</Text>
              </View>
              {pastRequests.length === 0 && (
                <Text style={styles.empty}>No visitor history yet</Text>
              )}
              <FlatList
                data={visibleHistory}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <Pressable style={styles.compactRow} onPress={() => setSelectedVisitor(item)}>
                    {item.visitors?.photo_url ? (
                      <Image
                        source={{ uri: item.visitors.photo_url }}
                        style={styles.thumbSmall}
                      />
                    ) : (
                      <View style={styles.thumbPlaceholderSmall}>
                        <Text style={styles.thumbInitialSmall}>
                          {item.visitors?.name?.[0]?.toUpperCase() ?? "?"}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={styles.historyName}>
                          {item.visitors?.name}
                        </Text>
                        <Chip
                          compact
                          textStyle={{
                            fontSize: 11,
                            fontWeight: "600",
                            color: item.status === "approved" ? SUCCESS : DANGER,
                          }}
                          style={{
                            backgroundColor:
                              item.status === "approved" ? SUCCESS_BG : DANGER_BG,
                          }}
                        >
                          {item.pre_approved ? "pre-approved" : item.status}
                        </Chip>
                      </View>

                      <Text style={styles.metaFaint}>
                        {new Date(item.created_at).toLocaleDateString()} · {item.visitors?.visitor_type}
                      </Text>

                      {(item.entry_time || item.exit_time) && (
                        <View style={styles.timeRow}>
                          {item.entry_time && (
                            <Text style={styles.timeTagText}>
                              In: {new Date(item.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          )}
                          {item.exit_time && (
                            <Text style={[styles.timeTagText, { color: INK_MUTED }]}>
                              Out: {new Date(item.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          )}
                        </View>
                      )}

                      {item.otp_code && item.status === "approved" && (
                        <View style={styles.otpActionRow}>
                          <View style={styles.otpBadgeContainer}>
                            <Text style={styles.otpBadgeText}>
                              Passcode: {item.otp_code}
                            </Text>
                          </View>

                          <IconButton
                            icon="content-copy"
                            size={16}
                            iconColor={ACCENT}
                            style={{ margin: 0 }}
                            onPress={() => copyToClipboard(item.otp_code!)}
                          />
                          <IconButton
                            icon="share-variant"
                            size={16}
                            iconColor={ACCENT}
                            style={{ margin: 0 }}
                            onPress={() =>
                              sharePasscode(item.visitors?.name ?? "Guest", item.otp_code!)
                            }
                          />
                        </View>
                      )}
                    </View>
                  </Pressable>
                )}
              />
              {pastRequests.length > 5 && (
                <Button
                  compact
                  textColor={ACCENT}
                  onPress={() => setShowAllHistory(!showAllHistory)}
                >
                  {showAllHistory
                    ? "Show less"
                    : `View all (${pastRequests.length})`}
                </Button>
              )}
            </>
          )}

          {tab === "notices" && (
            <>
              <View style={styles.sectionHeaderRow}>
                <Avatar.Icon
                  size={30}
                  icon="bullhorn"
                  style={styles.sectionIcon}
                  color={ACCENT}
                />
                <Text style={styles.sectionTitle}>Society Notices</Text>
              </View>
              {notices.length === 0 && (
                <View style={styles.emptyState}>
                  <Avatar.Icon
                    size={44}
                    icon="bullhorn-outline"
                    style={{ backgroundColor: ACCENT_SOFT }}
                    color={ACCENT}
                  />
                  <Text style={styles.empty}>No notices published yet</Text>
                </View>
              )}
              <FlatList
                data={visibleNotices}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                renderItem={({ item }) => (
                  <Pressable style={styles.card} onPress={() => setSelectedNotice(item)}>
                    <View style={{ padding: 16 }}>
                      <Text style={styles.visitorName}>{item.title}</Text>
                      <Text style={styles.noticeBody} numberOfLines={2}>
                        {item.body}
                      </Text>
                      <Text style={styles.metaFaint}>
                        {new Date(item.created_at).toLocaleString()}
                      </Text>
                    </View>
                  </Pressable>
                )}
              />
              {notices.length > 5 && (
                <Button
                  compact
                  textColor={ACCENT}
                  onPress={() => setShowAllNotices(!showAllNotices)}
                >
                  {showAllNotices
                    ? "Show less"
                    : `View all (${notices.length})`}
                </Button>
              )}
            </>
          )}

          {tab === "polls" && (
            <>
              <View style={styles.sectionHeaderRow}>
                <Avatar.Icon
                  size={30}
                  icon="poll"
                  style={styles.sectionIcon}
                  color={ACCENT}
                />
                <Text style={styles.sectionTitle}>Community Polls</Text>
              </View>
              {polls.length === 0 && (
                <View style={styles.emptyState}>
                  <Avatar.Icon
                    size={44}
                    icon="poll"
                    style={{ backgroundColor: ACCENT_SOFT }}
                    color={ACCENT}
                  />
                  <Text style={styles.empty}>No active polls</Text>
                </View>
              )}
              {visiblePolls.map((poll) => (
                <View key={poll.id} style={[styles.card, { marginBottom: 12 }]}>
                  <View style={{ padding: 16 }}>
                    <Text style={styles.visitorName}>{poll.question}</Text>
                    {poll.poll_options?.map((opt) => (
                      <View key={opt.id} style={styles.pollOptionRow}>
                        <Text style={styles.pollOptionText}>
                          {opt.option_text} — {voteCount(opt.id)} votes
                        </Text>
                        {!hasVoted(poll.id) && (
                          <Button
                            mode="outlined"
                            compact
                            textColor={ACCENT}
                            style={{ borderColor: ACCENT }}
                            onPress={() => castVote(poll.id, opt.id)}
                          >
                            Vote
                          </Button>
                        )}
                      </View>
                    ))}
                    {hasVoted(poll.id) && (
                      <Text style={styles.votedLabel}>✓ Vote Recorded</Text>
                    )}
                  </View>
                </View>
              ))}
              {polls.length > 3 && (
                <Button
                  compact
                  textColor={ACCENT}
                  onPress={() => setShowAllPolls(!showAllPolls)}
                >
                  {showAllPolls ? "Show less" : `View all (${polls.length})`}
                </Button>
              )}
            </>
          )}

          {tab === "helpdesk" && (
            <>
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Avatar.Icon
                    size={30}
                    icon="headset"
                    style={styles.sectionIcon}
                    color={ACCENT}
                  />
                  <Text style={styles.sectionTitle}>Raise a Ticket</Text>
                </View>
                <View style={styles.chipSelectRow}>
                  {["general", "maintenance", "security", "other"].map((c) => (
                    <Chip
                      key={c}
                      selected={ticketCategory === c}
                      onPress={() => setTicketCategory(c)}
                      style={[
                        styles.tabChip,
                        ticketCategory === c && styles.tabChipSelected,
                      ]}
                      textStyle={
                        ticketCategory === c
                          ? { color: "#fff" }
                          : { color: INK_MUTED }
                      }
                    >
                      {c}
                    </Chip>
                  ))}
                </View>
                {ticketCategory === "other" && (
                  <View style={styles.inputWrap}>
                    <TextInput
                      mode="flat"
                      label="Specify category"
                      value={customCategory}
                      onChangeText={setCustomCategory}
                      style={styles.input}
                      underlineColor="transparent"
                      activeUnderlineColor="transparent"
                      textColor={INK}
                      theme={inputTheme}
                      cursorColor={ACCENT}
                    />
                  </View>
                )}
                <View style={styles.inputWrap}>
                  <TextInput
                    mode="flat"
                    label="Describe the issue"
                    value={ticketDescription}
                    onChangeText={setTicketDescription}
                    multiline
                    numberOfLines={3}
                    style={styles.input}
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
                    textColor={INK}
                    theme={inputTheme}
                    cursorColor={ACCENT}
                  />
                </View>
                <Button
                  mode="contained"
                  onPress={handleRaiseTicket}
                  loading={ticketLoading}
                  disabled={ticketLoading}
                  buttonColor={ACCENT}
                  textColor="#fff"
                  style={styles.submitButton}
                  contentStyle={{ paddingVertical: 4 }}
                >
                  Submit Ticket
                </Button>
              </View>

              <View style={styles.sectionHeaderRow}>
                <Avatar.Icon
                  size={30}
                  icon="ticket-confirmation"
                  style={styles.sectionIcon}
                  color={ACCENT}
                />
                <Text style={styles.sectionTitle}>My Support Tickets</Text>
              </View>
              {tickets.length === 0 && (
                <Text style={styles.empty}>No tickets raised yet</Text>
              )}
              <FlatList
                data={tickets}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                renderItem={({ item }) => (
                  <Pressable style={styles.card} onPress={() => setSelectedTicket(item)}>
                    <View style={{ padding: 16 }}>
                      <View style={styles.row}>
                        <Text style={styles.visitorName}>{item.category}</Text>
                        <Chip
                          compact
                          textStyle={{
                            color: ticketStatusColor(item.status),
                            fontWeight: "600",
                            fontSize: 11,
                          }}
                          style={{
                            backgroundColor: ticketStatusBg(item.status),
                          }}
                        >
                          {item.status.replace("_", " ")}
                        </Chip>
                      </View>
                      <Text style={styles.noticeBody} numberOfLines={2}>
                        {item.description}
                      </Text>
                      <Text style={styles.metaFaint}>
                        {new Date(item.created_at).toLocaleString()}
                      </Text>
                    </View>
                  </Pressable>
                )}
              />
            </>
          )}

          {tab === "amenities" && (
            <>
              <View style={styles.sectionHeaderRow}>
                <Avatar.Icon
                  size={30}
                  icon="calendar-check"
                  style={styles.sectionIcon}
                  color={ACCENT}
                />
                <Text style={styles.sectionTitle}>Book an Amenity</Text>
              </View>
              <Button
                mode="outlined"
                onPress={() => setShowDatePicker(true)}
                icon="calendar"
                textColor={ACCENT}
                style={[styles.dateButton]}
              >
                {bookingDate ? `Selected Date: ${bookingDate}` : "Pick a Booking Date"}
              </Button>
              {showDatePicker && (
                <DateTimePicker
                  value={bookingDate ? new Date(bookingDate) : new Date()}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={onDateChange}
                />
              )}
              {amenities.length === 0 && (
                <Text style={styles.empty}>No amenities available right now</Text>
              )}
              {amenities.map((amenity) => (
                <View
                  key={amenity.id}
                  style={[styles.card, { marginBottom: 12 }]}
                >
                  <View style={{ padding: 16 }}>
                    <Text style={styles.visitorName}>{amenity.name}</Text>
                    <Text style={styles.meta}>
                      Capacity Limit: {amenity.capacity} persons
                    </Text>
                    <View style={styles.slotWrap}>
                      {amenity.slots.map((slot) => (
                        <Chip
                          key={slot}
                          onPress={() => handleBookSlot(amenity, slot)}
                          style={styles.slotChip}
                          textStyle={{ fontSize: 12, color: INK, fontWeight: '600' }}
                        >
                          {slot}
                        </Chip>
                      ))}
                    </View>
                  </View>
                </View>
              ))}

              <View style={styles.sectionHeaderRow}>
                <Avatar.Icon
                  size={30}
                  icon="calendar-clock"
                  style={styles.sectionIcon}
                  color={ACCENT}
                />
                <Text style={styles.sectionTitle}>My Active Bookings</Text>
              </View>
              {myBookings.length === 0 && (
                <Text style={styles.empty}>No active slot bookings</Text>
              )}
              <FlatList
                data={myBookings}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                renderItem={({ item }) => (
                  <View style={styles.card}>
                    <View style={{ padding: 16 }}>
                      <Text style={styles.visitorName}>
                        {amenityNameFor(item.amenity_id)}
                      </Text>
                      <Text style={styles.meta}>
                        {item.booking_date} · {item.slot}
                      </Text>
                    </View>
                    <Divider style={{ backgroundColor: BORDER }} />
                    <View style={styles.cardActions}>
                      <Button
                        compact
                        textColor={DANGER}
                        onPress={() => cancelMyBooking(item.id)}
                      >
                        Cancel Booking
                      </Button>
                    </View>
                  </View>
                )}
              />
            </>
          )}

          {tab === "dues" && (
            <>
              {pendingDues.length > 0 && (
                <View style={[styles.card, styles.totalDueCard]}>
                  <View style={{ padding: 16 }}>
                    <Text style={styles.totalDueLabel}>Total Outstanding</Text>
                    <Text style={styles.totalDueAmount}>
                      ₹{totalDue.toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}

              <View
                style={[
                  styles.sectionHeaderRow,
                  { marginTop: pendingDues.length > 0 ? 20 : 0 },
                ]}
              >
                <Avatar.Icon
                  size={30}
                  icon="cash-clock"
                  style={styles.sectionIcon}
                  color={ACCENT}
                />
                <Text style={styles.sectionTitle}>Pending Dues</Text>
                {pendingDues.length > 0 && (
                  <Text style={styles.countBadge}>{pendingDues.length}</Text>
                )}
              </View>
              {pendingDues.length === 0 && (
                <View style={styles.emptyState}>
                  <Avatar.Icon
                    size={44}
                    icon="check-circle-outline"
                    style={{ backgroundColor: ACCENT_SOFT }}
                    color={ACCENT}
                  />
                  <Text style={styles.empty}>No pending dues — all clear!</Text>
                </View>
              )}
              {pendingDues.map((d) => (
                <View key={d.id} style={[styles.card, { marginBottom: 12 }]}>
                  <View style={{ padding: 16 }}>
                    <View style={styles.row}>
                      <Text style={styles.visitorName}>{d.description}</Text>
                      <Text style={styles.dueAmount}>₹{d.amount}</Text>
                    </View>
                    <Text style={styles.metaFaint}>Due by {d.due_date}</Text>
                  </View>
                  <Divider style={{ backgroundColor: BORDER }} />
                  <View style={styles.cardActions}>
                    <Button
                      mode="contained"
                      buttonColor={ACCENT}
                      textColor="#fff"
                      loading={payingId === d.id}
                      disabled={payingId === d.id}
                      onPress={() => payDue(d)}
                    >
                      Pay Now
                    </Button>
                  </View>
                </View>
              ))}

              <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
                <Avatar.Icon
                  size={30}
                  icon="cash-check"
                  style={styles.sectionIcon}
                  color={ACCENT}
                />
                <Text style={styles.sectionTitle}>Payment History</Text>
              </View>
              {paidDues.length === 0 && (
                <Text style={styles.empty}>No payment records found</Text>
              )}
              {paidDues.map((d) => (
                <Pressable
                  key={d.id}
                  style={[styles.card, { marginBottom: 10 }]}
                  onPress={() => setSelectedReceiptDue(d)}
                >
                  <View style={{ padding: 16, flexDirection: "row", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.visitorName}>{d.description}</Text>
                      <Text style={styles.metaFaint}>
                        Paid {d.paid_at ? new Date(d.paid_at).toLocaleDateString() : ""} · Tap to view invoice
                      </Text>
                    </View>
                    <Chip
                      compact
                      textStyle={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: SUCCESS,
                      }}
                      style={{ backgroundColor: SUCCESS_BG }}
                    >
                      ₹{d.amount}
                    </Chip>
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {tab === "staff" && (
            <>
              <View style={styles.sectionHeaderRow}>
                <Avatar.Icon
                  size={30}
                  icon="account-hard-hat"
                  style={styles.sectionIcon}
                  color={ACCENT}
                />
                <Text style={styles.sectionTitle}>
                  Staff & Service Directory
                </Text>
              </View>
              {staff.length === 0 && (
                <View style={styles.emptyState}>
                  <Avatar.Icon
                    size={44}
                    icon="account-hard-hat"
                    style={{ backgroundColor: ACCENT_SOFT }}
                    color={ACCENT}
                  />
                  <Text style={styles.empty}>No directory entries available</Text>
                </View>
              )}
              {staff.map((s) => (
                <Pressable
                  key={s.id}
                  style={[styles.card, { marginBottom: 12 }]}
                  onPress={() => setSelectedStaff(s)}
                >
                  <View style={styles.staffCardContent}>
                    {s.photo_url ? (
                      <Image
                        source={{ uri: s.photo_url }}
                        style={styles.staffImage}
                      />
                    ) : (
                      <View style={styles.staffAvatarPlaceholder}>
                        <Text style={styles.staffAvatarInitial}>
                          {s.name[0]?.toUpperCase() ?? "S"}
                        </Text>
                      </View>
                    )}

                    <View style={{ flex: 1 }}>
                      <Text style={styles.staffNameText} numberOfLines={1}>
                        {s.name}
                      </Text>

                      <View style={styles.staffTagRow}>
                        <View style={styles.staffServiceBadge}>
                          <Text style={styles.staffServiceText}>
                            {s.service_type}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.staffPhoneText}>
                        {s.phone ? `📞 ${s.phone}` : "No phone provided"}
                      </Text>
                    </View>

                    {s.phone && (
                      <IconButton
                        icon="phone"
                        size={20}
                        iconColor="#fff"
                        style={styles.staffCallIcon}
                        onPress={() => callPhone(s.phone)}
                      />
                    )}
                  </View>
                </Pressable>
              ))}
            </>
          )}

          <View style={{ height: 90 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* BOTTOM NAVIGATION */}
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
          onPress={() => goToTab("notices")}
          hitSlop={8}
        >
          <View
            style={[
              styles.navIconWrap,
              tab === "notices" && styles.navIconWrapActive,
            ]}
          >
            <IconButton
              icon="bullhorn-outline"
              size={22}
              iconColor={tab === "notices" ? ACCENT : INK_FAINT}
              style={{ margin: 0 }}
            />
          </View>
          <Text
            style={[
              styles.navLabel,
              tab === "notices" && styles.navLabelActive,
            ]}
          >
            Notices
          </Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() => goToTab("visitors")}
          hitSlop={8}
        >
          <View
            style={[
              styles.navIconWrap,
              tab === "visitors" && styles.navIconWrapActive,
            ]}
          >
            <IconButton
              icon="account-group-outline"
              size={22}
              iconColor={tab === "visitors" ? ACCENT : INK_FAINT}
              style={{ margin: 0 }}
            />
            {pendingRequests.length > 0 && tab !== "visitors" && (
              <View style={styles.navBadge}>
                <Text style={styles.navBadgeText}>
                  {pendingRequests.length}
                </Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.navLabel,
              tab === "visitors" && styles.navLabelActive,
            ]}
          >
            Visitors
          </Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() => setMoreOpen(true)}
          hitSlop={8}
        >
          <View
            style={[
              styles.navIconWrap,
              isMoreActiveTab && styles.navIconWrapActive,
            ]}
          >
            <IconButton
              icon="dots-grid"
              size={22}
              iconColor={isMoreActiveTab ? ACCENT : INK_FAINT}
              style={{ margin: 0 }}
            />
            {pendingDues.length > 0 && !isMoreActiveTab && (
              <View style={styles.navBadge}>
                <Text style={styles.navBadgeText}>{pendingDues.length}</Text>
              </View>
            )}
          </View>
          <Text
            style={[styles.navLabel, isMoreActiveTab && styles.navLabelActive]}
          >
            More
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
                {myProfile?.full_name?.[0]?.toUpperCase() ?? "?"}
              </Text>
            </View>
          </View>
          <Text style={styles.navLabel}>Profile</Text>
        </Pressable>
      </View>

      {/* DROPDOWN MODAL: TYPE OF ENTRY */}
      <Modal
        visible={typePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTypePickerOpen(false)}
      >
        <Pressable
          style={styles.sheetBackdropBottom}
          onPress={() => setTypePickerOpen(false)}
        >
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Entry Type</Text>
            {ENTRY_TYPES.map((item) => (
              <Pressable
                key={item.key}
                style={[
                  styles.pickerOptionRow,
                  deliveryCategory === item.key && styles.pickerOptionSelected,
                ]}
                onPress={() => {
                  setDeliveryCategory(item.key);
                  setTypePickerOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    deliveryCategory === item.key && styles.pickerOptionTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
                {deliveryCategory === item.key && (
                  <IconButton
                    icon="check"
                    size={18}
                    iconColor={ACCENT}
                    style={{ margin: 0 }}
                  />
                )}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* DROPDOWN MODAL: VALIDITY WINDOW */}
      <Modal
        visible={validityPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setValidityPickerOpen(false)}
      >
        <Pressable
          style={styles.sheetBackdropBottom}
          onPress={() => setValidityPickerOpen(false)}
        >
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Validity / Action</Text>
            {VALIDITY_OPTIONS.filter((v) =>
              deliveryCategory === "cab" ? v.key !== "leave_at_gate" : true
            ).map((item) => (
              <Pressable
                key={item.key}
                style={[
                  styles.pickerOptionRow,
                  deliveryValidity === item.key && styles.pickerOptionSelected,
                ]}
                onPress={() => {
                  setDeliveryValidity(item.key);
                  setValidityPickerOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    deliveryValidity === item.key && styles.pickerOptionTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
                {deliveryValidity === item.key && (
                  <IconButton
                    icon="check"
                    size={18}
                    iconColor={ACCENT}
                    style={{ margin: 0 }}
                  />
                )}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* VISITOR CARD DETAIL MODAL */}
      <Modal
        visible={!!selectedVisitor}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedVisitor(null)}
      >
        <Pressable
          style={styles.sheetBackdropCenter}
          onPress={() => setSelectedVisitor(null)}
        >
          <Pressable style={styles.receiptCardModal} onPress={() => {}}>
            {selectedVisitor && (
              <>
                <View style={styles.modalTopHeader}>
                  <Text style={styles.modalTitle}>Visitor Details</Text>
                  <IconButton
                    icon="close"
                    size={22}
                    iconColor={INK}
                    onPress={() => setSelectedVisitor(null)}
                    style={{ margin: 0 }}
                  />
                </View>

                <View style={{ alignItems: "center", marginVertical: 8 }}>
                  {selectedVisitor.visitors?.photo_url ? (
                    <Image
                      source={{ uri: selectedVisitor.visitors.photo_url }}
                      style={{ width: 80, height: 80, borderRadius: 40 }}
                    />
                  ) : (
                    <Avatar.Text
                      size={80}
                      label={selectedVisitor.visitors?.name?.[0]?.toUpperCase() ?? "?"}
                      style={{ backgroundColor: ACCENT }}
                    />
                  )}
                  <Text style={[styles.visitorName, { fontSize: 18, marginTop: 10 }]}>
                    {selectedVisitor.visitors?.name}
                  </Text>
                  <Text style={styles.meta}>
                    {selectedVisitor.visitors?.visitor_type}
                  </Text>
                </View>

                <Divider style={{ marginVertical: 12, backgroundColor: BORDER }} />

                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Status</Text>
                  <Text style={[styles.receiptValue, { color: statusColor(selectedVisitor.status) }]}>
                    {selectedVisitor.pre_approved ? "Pre-Approved" : selectedVisitor.status.toUpperCase()}
                  </Text>
                </View>

                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Requested On</Text>
                  <Text style={styles.receiptValue}>
                    {new Date(selectedVisitor.created_at).toLocaleString()}
                  </Text>
                </View>

                {selectedVisitor.entry_time && (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Entry Time</Text>
                    <Text style={styles.receiptValue}>
                      {new Date(selectedVisitor.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                )}

                {selectedVisitor.exit_time && (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Exit Time</Text>
                    <Text style={styles.receiptValue}>
                      {new Date(selectedVisitor.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                )}

                {selectedVisitor.otp_code && (
                  <View style={[styles.cardOtpBoxModal, { marginTop: 12 }]}>
                    <View>
                      <Text style={styles.receiptLabel}>Passcode</Text>
                      <Text style={styles.otpModalCode}>{selectedVisitor.otp_code}</Text>
                    </View>
                    <View style={{ flexDirection: "row" }}>
                      <IconButton
                        icon="content-copy"
                        size={18}
                        iconColor={ACCENT}
                        style={{ margin: 0 }}
                        onPress={() => copyToClipboard(selectedVisitor.otp_code!)}
                      />
                      <IconButton
                        icon="share-variant"
                        size={18}
                        iconColor={ACCENT}
                        style={{ margin: 0 }}
                        onPress={() =>
                          sharePasscode(
                            selectedVisitor.visitors?.name ?? "Guest",
                            selectedVisitor.otp_code!
                          )
                        }
                      />
                    </View>
                  </View>
                )}

                <Button
                  mode="contained"
                  buttonColor={ACCENT}
                  textColor="#fff"
                  style={{ marginTop: 16, borderRadius: 12 }}
                  onPress={() => setSelectedVisitor(null)}
                >
                  Close
                </Button>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* NOTICE FULL DETAIL MODAL */}
      <Modal
        visible={!!selectedNotice}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedNotice(null)}
      >
        <Pressable
          style={styles.sheetBackdropCenter}
          onPress={() => setSelectedNotice(null)}
        >
          <Pressable style={styles.receiptCardModal} onPress={() => {}}>
            {selectedNotice && (
              <>
                <View style={styles.modalTopHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Avatar.Icon
                      size={24}
                      icon="bullhorn"
                      style={{ backgroundColor: ACCENT_SOFT }}
                      color={ACCENT}
                    />
                    <Text style={styles.modalTitle}>Society Announcement</Text>
                  </View>
                  <IconButton
                    icon="close"
                    size={22}
                    iconColor={INK}
                    onPress={() => setSelectedNotice(null)}
                    style={{ margin: 0 }}
                  />
                </View>

                <Text style={[styles.visitorName, { fontSize: 18, marginTop: 8 }]}>
                  {selectedNotice.title}
                </Text>

                <Text style={styles.metaFaint}>
                  Published: {new Date(selectedNotice.created_at).toLocaleString("en-IN")}
                </Text>

                <Divider style={{ marginVertical: 14, backgroundColor: BORDER }} />

                <ScrollView style={{ maxHeight: 220 }}>
                  <Text style={[styles.noticeBody, { fontSize: 14, lineHeight: 22 }]}>
                    {selectedNotice.body}
                  </Text>
                </ScrollView>

                <Button
                  mode="contained"
                  buttonColor={ACCENT}
                  textColor="#fff"
                  style={{ marginTop: 16, borderRadius: 12 }}
                  onPress={() => setSelectedNotice(null)}
                >
                  Close Notice
                </Button>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* STAFF FULL DETAIL MODAL */}
      <Modal
        visible={!!selectedStaff}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedStaff(null)}
      >
        <Pressable
          style={styles.sheetBackdropCenter}
          onPress={() => setSelectedStaff(null)}
        >
          <Pressable style={styles.receiptCardModal} onPress={() => {}}>
            {selectedStaff && (
              <>
                <View style={styles.modalTopHeader}>
                  <Text style={styles.modalTitle}>Staff Profile</Text>
                  <IconButton
                    icon="close"
                    size={22}
                    iconColor={INK}
                    onPress={() => setSelectedStaff(null)}
                    style={{ margin: 0 }}
                  />
                </View>

                <View style={{ alignItems: "center", marginVertical: 8 }}>
                  {selectedStaff.photo_url ? (
                    <Image
                      source={{ uri: selectedStaff.photo_url }}
                      style={{ width: 84, height: 84, borderRadius: 42 }}
                    />
                  ) : (
                    <Avatar.Text
                      size={84}
                      label={selectedStaff.name[0]?.toUpperCase() ?? "S"}
                      style={{ backgroundColor: ACCENT }}
                    />
                  )}
                  <Text style={[styles.visitorName, { fontSize: 18, marginTop: 10 }]}>
                    {selectedStaff.name}
                  </Text>
                  <Chip
                    compact
                    textStyle={{ color: ACCENT, fontWeight: "700", fontSize: 12 }}
                    style={{ backgroundColor: ACCENT_SOFT, marginTop: 6 }}
                  >
                    {selectedStaff.service_type}
                  </Chip>
                </View>

                <Divider style={{ marginVertical: 14, backgroundColor: BORDER }} />

                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Contact Number</Text>
                  <Text style={styles.receiptValue}>
                    {selectedStaff.phone ?? "Not Provided"}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
                  <Button
                    mode="outlined"
                    textColor={INK_MUTED}
                    style={{ flex: 1, borderColor: BORDER, borderRadius: 12 }}
                    onPress={() => setSelectedStaff(null)}
                  >
                    Close
                  </Button>
                  {selectedStaff.phone && (
                    <Button
                      mode="contained"
                      buttonColor={SUCCESS}
                      textColor="#fff"
                      icon="phone"
                      style={{ flex: 1.2, borderRadius: 12 }}
                      onPress={() => callPhone(selectedStaff.phone)}
                    >
                      Call Staff
                    </Button>
                  )}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* TICKET FULL DETAIL MODAL */}
      <Modal
        visible={!!selectedTicket}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTicket(null)}
      >
        <Pressable
          style={styles.sheetBackdropCenter}
          onPress={() => setSelectedTicket(null)}
        >
          <Pressable style={styles.receiptCardModal} onPress={() => {}}>
            {selectedTicket && (
              <>
                <View style={styles.modalTopHeader}>
                  <Text style={styles.modalTitle}>Ticket Details</Text>
                  <IconButton
                    icon="close"
                    size={22}
                    iconColor={INK}
                    onPress={() => setSelectedTicket(null)}
                    style={{ margin: 0 }}
                  />
                </View>

                <View style={styles.row}>
                  <Text style={[styles.visitorName, { fontSize: 18 }]}>
                    Category: {selectedTicket.category}
                  </Text>
                  <Chip
                    compact
                    textStyle={{
                      color: ticketStatusColor(selectedTicket.status),
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                    style={{ backgroundColor: ticketStatusBg(selectedTicket.status) }}
                  >
                    {selectedTicket.status.replace("_", " ")}
                  </Chip>
                </View>

                <Text style={styles.metaFaint}>
                  Raised: {new Date(selectedTicket.created_at).toLocaleString()}
                </Text>

                <Divider style={{ marginVertical: 12, backgroundColor: BORDER }} />

                <Text style={styles.fieldLabel}>Issue Description:</Text>
                <ScrollView style={{ maxHeight: 180 }}>
                  <Text style={[styles.noticeBody, { fontSize: 14 }]}>
                    {selectedTicket.description}
                  </Text>
                </ScrollView>

                <Button
                  mode="contained"
                  buttonColor={ACCENT}
                  textColor="#fff"
                  style={{ marginTop: 16, borderRadius: 12 }}
                  onPress={() => setSelectedTicket(null)}
                >
                  Close
                </Button>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* DIGITAL INVOICE MODAL WITH PDF GENERATION */}
      <Modal
        visible={!!selectedReceiptDue}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedReceiptDue(null)}
      >
        <Pressable
          style={styles.sheetBackdropCenter}
          onPress={() => setSelectedReceiptDue(null)}
        >
          <Pressable style={styles.receiptCardModal} onPress={() => {}}>
            <View style={styles.receiptHeader}>
              <Avatar.Icon
                size={40}
                icon="check-circle"
                style={{ backgroundColor: SUCCESS_BG }}
                color={SUCCESS}
              />
              <Text style={styles.receiptHeaderTitle}>PORTL SERVICES</Text>
              <Text style={styles.receiptHeaderSubtitle}>
                Official Payment Invoice
              </Text>
            </View>

            <Divider style={{ marginVertical: 14, backgroundColor: BORDER }} />

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Resident</Text>
              <Text style={styles.receiptValue}>
                {myProfile?.full_name ?? "Resident"}
              </Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Flat</Text>
              <Text style={styles.receiptValue}>
                {myProfile?.tower_name ? `${myProfile.tower_name} · ` : ""}
                {myProfile?.flat_number ?? "N/A"}
              </Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Description</Text>
              <Text style={styles.receiptValue}>
                {selectedReceiptDue?.description}
              </Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Date Paid</Text>
              <Text style={styles.receiptValue}>
                {selectedReceiptDue?.paid_at
                  ? new Date(selectedReceiptDue.paid_at).toLocaleString("en-IN")
                  : "Paid"}
              </Text>
            </View>

            <Divider style={{ marginVertical: 14, backgroundColor: BORDER }} />

            <View style={styles.receiptRow}>
              <Text style={[styles.receiptLabel, { fontSize: 16 }]}>
                Total Paid
              </Text>
              <Text style={styles.receiptTotalAmount}>
                ₹{selectedReceiptDue?.amount}
              </Text>
            </View>

            <View style={styles.receiptActions}>
              <Button
                mode="outlined"
                textColor={INK_MUTED}
                style={{ flex: 1, borderColor: BORDER, borderRadius: 12 }}
                onPress={() => setSelectedReceiptDue(null)}
              >
                Close
              </Button>
              <Button
                mode="contained"
                buttonColor={ACCENT}
                textColor="#fff"
                icon="file-pdf-box"
                loading={pdfLoading}
                disabled={pdfLoading}
                style={{ flex: 1.2, borderRadius: 12 }}
                onPress={() => {
                  if (selectedReceiptDue) exportPDFInvoice(selectedReceiptDue);
                }}
              >
                Export PDF
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* MORE MENU BOTTOM SHEET (STRICTLY FROM BOTTOM) */}
      <Modal
        visible={moreOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMoreOpen(false)}
      >
        <Pressable
          style={styles.sheetBackdropBottom}
          onPress={() => setMoreOpen(false)}
        >
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>More Services</Text>
            <Text style={styles.sheetSubtitle}>
              All society management options in one place
            </Text>
            <View style={styles.moreGrid}>
              {MORE_TABS.map((t) => (
                <Pressable
                  key={t.key}
                  style={styles.moreGridTile}
                  onPress={() => goToTab(t.key)}
                >
                  <Avatar.Icon
                    size={48}
                    icon={t.icon}
                    style={{ backgroundColor: ACCENT_SOFT }}
                    color={ACCENT}
                  />
                  <Text style={styles.moreGridLabel}>{t.label}</Text>
                  {t.key === "dues" && pendingDues.length > 0 && (
                    <View style={styles.moreGridBadge}>
                      <Text style={styles.moreGridBadgeText}>
                        {pendingDues.length}
                      </Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* IMPROVED PROFILE OVERLAY MODAL */}
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
            <Text style={styles.profileTopBarTitle}>Account & Profile</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.profileIdCard}>
              <View style={styles.profileBigAvatar}>
                <Text style={styles.profileBigAvatarInitial}>
                  {myProfile?.full_name?.[0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <Text style={styles.profileBigName}>
                {myProfile?.full_name ?? "Resident"}
              </Text>
              {(myProfile?.tower_name || myProfile?.flat_number) && (
                <View style={styles.profileFlatChip}>
                  <IconButton
                    icon="home-city-outline"
                    size={16}
                    iconColor={ACCENT}
                    style={{ margin: 0, marginRight: -4 }}
                  />
                  <Text style={styles.profileFlatChipText}>
                    {myProfile?.tower_name ? `${myProfile.tower_name} · ` : ""}
                    {myProfile?.flat_number
                      ? `Flat ${myProfile.flat_number}`
                      : ""}
                  </Text>
                </View>
              )}
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

            <Text style={styles.profileSectionLabel}>Dashboard Overview</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statTile}>
                <Text
                  style={[
                    styles.statTileNum,
                    pendingDues.length > 0 && { color: DANGER },
                  ]}
                >
                  {pendingDues.length}
                </Text>
                <Text style={styles.statTileLabel}>Pending Dues</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statTileNum}>{openTicketsCount}</Text>
                <Text style={styles.statTileLabel}>Open Tickets</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statTileNum}>{myBookings.length}</Text>
                <Text style={styles.statTileLabel}>Bookings</Text>
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

      {/* SOS MODAL */}
      <Modal
        visible={sosOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSosOpen(false)}
      >
        <Pressable
          style={styles.sheetBackdropBottom}
          onPress={() => setSosOpen(false)}
        >
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Emergency Alert</Text>
            <Text style={styles.sheetSubtitle}>
              This immediately notifies your guard and admin
            </Text>
            {[
              "Fire",
              "Medical Emergency",
              "Lift Stuck",
              "Security Threat",
              "Other",
            ].map((type) => (
              <Pressable
                key={type}
                style={styles.sosOptionRow}
                onPress={() => sendSOS(type)}
                disabled={sosLoading}
              >
                <IconButton
                  icon="alert-circle"
                  size={20}
                  iconColor={DANGER}
                  style={{ margin: 0 }}
                />
                <Text style={styles.sosOptionText}>{type}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
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
  flatBadge: {
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
  flatBadgeText: { fontSize: 12, fontWeight: "700", color: ACCENT },

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
    fontSize: 13,
    fontWeight: "600",
    color: INK_MUTED,
  },
  formSwitcherTextActive: {
    color: ACCENT,
    fontWeight: "800",
  },

  tabChip: { backgroundColor: INPUT_BG },
  tabChipSelected: { backgroundColor: ACCENT },
  sectionCard: {
    marginBottom: 20,
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
  fieldLabel: { fontSize: 12.5, fontWeight: "700", color: INK, marginBottom: 6, marginTop: 4 },
  
  // DROPDOWN FIELD
  dropdownSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  dropdownValueText: {
    fontSize: 14,
    fontWeight: "600",
    color: INK,
  },
  pickerOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  pickerOptionSelected: {
    backgroundColor: ACCENT_SOFT,
  },
  pickerOptionText: {
    fontSize: 15,
    fontWeight: "600",
    color: INK,
  },
  pickerOptionTextSelected: {
    color: ACCENT,
    fontWeight: "800",
  },

  inputWrap: {
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
    marginBottom: 14,
  },
  input: { backgroundColor: "transparent" },
  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  previewImage: { width: 60, height: 60, borderRadius: 12 },
  photoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  photoButton: { flex: 1, borderColor: ACCENT },
  submitButton: { borderRadius: 14, marginTop: 6 },
  dateButton: {
    borderColor: ACCENT,
    borderRadius: 14,
    marginBottom: 14,
    backgroundColor: CARD_BG,
  },
  chipSelectRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    flexWrap: "wrap",
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
    gap: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  rowWithImage: { flexDirection: "row", gap: 12, alignItems: "center" },
  visitorName: { fontSize: 16, fontWeight: "700", color: INK },
  meta: { color: INK_MUTED, marginTop: 3, fontSize: 13 },
  metaFaint: { color: INK_FAINT, marginTop: 4, fontSize: 12 },
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
  thumbSmall: { width: 40, height: 40, borderRadius: 20 },
  thumbPlaceholderSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
  },
  thumbInitialSmall: { color: "white", fontSize: 15, fontWeight: "700" },

  staffCardContent: {
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  staffImage: { width: 50, height: 50, borderRadius: 25 },
  staffAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
  },
  staffAvatarInitial: { color: "#fff", fontSize: 20, fontWeight: "800" },
  staffNameText: { fontSize: 16, fontWeight: "700", color: INK },
  staffTagRow: { flexDirection: "row", marginTop: 4, marginBottom: 2 },
  staffServiceBadge: {
    backgroundColor: ACCENT_SOFT,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  staffServiceText: {
    fontSize: 11,
    fontWeight: "700",
    color: ACCENT,
    textTransform: "lowercase",
  },
  staffPhoneText: { fontSize: 12, color: INK_MUTED, marginTop: 2, fontWeight: "500" },
  staffCallIcon: {
    backgroundColor: SUCCESS,
    margin: 0,
    borderRadius: 20,
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
  historyName: { fontSize: 14, fontWeight: "700", color: INK },
  noticeBody: { color: INK_MUTED, marginTop: 4, lineHeight: 20 },
  pollOptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  pollOptionText: { flex: 1, color: INK_MUTED },
  votedLabel: {
    color: SUCCESS,
    marginTop: 10,
    fontWeight: "600",
    fontSize: 13,
  },
  slotWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  slotChip: { marginBottom: 4, backgroundColor: INPUT_BG },
  emptyState: { alignItems: "center", paddingVertical: 24, gap: 10 },
  empty: { color: INK_FAINT, fontSize: 14 },
  totalDueCard: { backgroundColor: ACCENT },
  totalDueLabel: {
    color: "#fff",
    opacity: 0.85,
    fontSize: 13,
    fontWeight: "600",
  },
  totalDueAmount: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 4,
  },
  dueAmount: { fontSize: 16, fontWeight: "700", color: ACCENT },

  timeRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  timeTagText: { fontSize: 11, fontWeight: "700", color: ACCENT },

  otpActionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 4,
  },
  otpBadgeContainer: {
    backgroundColor: ACCENT_SOFT,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  otpBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: ACCENT,
  },

  modalTopHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: { fontSize: 17, fontWeight: "800", color: INK },

  receiptCardModal: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    marginHorizontal: 20,
    padding: 20,
    alignSelf: "center",
    width: "90%",
  },
  receiptHeader: {
    alignItems: "center",
    gap: 4,
  },
  receiptHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: INK,
    marginTop: 6,
  },
  receiptHeaderSubtitle: {
    fontSize: 12,
    color: INK_MUTED,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  receiptLabel: {
    fontSize: 13,
    color: INK_MUTED,
    fontWeight: "500",
  },
  receiptValue: {
    fontSize: 13,
    color: INK,
    fontWeight: "700",
  },
  receiptTotalAmount: {
    fontSize: 20,
    fontWeight: "800",
    color: ACCENT,
  },
  receiptActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },

  cardOtpBoxModal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: INPUT_BG,
    padding: 12,
    borderRadius: 12,
  },
  otpModalCode: {
    fontSize: 16,
    fontWeight: "800",
    color: ACCENT,
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

  // BOTTOM SHEET POSITION FIX (Strict Bottom Alignment)
  sheetBackdropBottom: {
    flex: 1,
    backgroundColor: "rgba(21,19,31,0.45)",
    justifyContent: "flex-end",
  },
  sheetBackdropCenter: {
    flex: 1,
    backgroundColor: "rgba(21,19,31,0.45)",
    justifyContent: "center",
  },
  sheetCard: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 19, fontWeight: "800", color: INK },
  sheetSubtitle: {
    fontSize: 13,
    color: INK_MUTED,
    marginTop: 2,
    marginBottom: 18,
  },
  moreGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  moreGridTile: {
    width: "30%",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    position: "relative",
  },
  moreGridLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: INK,
    textAlign: "center",
  },
  moreGridBadge: {
    position: "absolute",
    top: 4,
    right: "18%",
    backgroundColor: DANGER,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  moreGridBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

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
  profileFlatChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ACCENT_SOFT,
    borderRadius: 20,
    paddingLeft: 8,
    paddingRight: 14,
    paddingVertical: 5,
    marginTop: 10,
  },
  profileFlatChipText: { fontSize: 13, fontWeight: "700", color: ACCENT },
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

  sosFab: {
    position: "absolute",
    right: 16,
    zIndex: 100,
    backgroundColor: DANGER,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 2,
    paddingRight: 10,
    paddingVertical: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  sosFabText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
    marginLeft: -4,
  },
  sosOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 8,
  },
  sosOptionText: { fontSize: 15, fontWeight: "600", color: INK },
});