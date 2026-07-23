import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Alert,
  Image,
  Platform,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Chip,
  TextInput,
  SegmentedButtons,
  Avatar,
  Divider,
  IconButton,
} from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { router } from 'expo-router';

const INK = '#15131F';
const INK_MUTED = '#6B6878';
const INK_FAINT = '#A6A3B3';
const ACCENT = '#4F3FE0';
const ACCENT_SOFT = '#EFECFD';
const GOLD = '#C9922B';
const PAGE_BG = '#EFEEF5';
const CARD_BG = '#FFFFFF';
const BORDER = '#ECEAF2';
const INPUT_BG = '#F5F4F9';
const SUCCESS = '#1E9E5A';
const SUCCESS_BG = '#E9F8EF';
const DANGER = '#C23B3B';
const DANGER_BG = '#FBEAEA';
const WARN = '#C9922B';
const WARN_BG = '#FBF3E4';
const TEAL = '#0E7C7B';
const TEAL_BG = '#E4F5F4';

type VisitorRequest = {
  id: string;
  status: string;
  resolution: string | null;
  pre_approved: boolean;
  otp_code: string | null;
  created_at: string;
  visitors: { name: string; visitor_type: string; photo_url: string | null } | null;
  flats: { flat_number: string } | null;
};
type Ticket = { id: string; category: string; description: string; status: string; created_at: string };
type Amenity = { id: string; name: string; capacity: number; slots: string[] };
type Booking = { id: string; amenity_id: string; booking_date: string; slot: string };
type Tower = { id: string; name: string };
type Flat = { id: string; tower_id: string; flat_number: string };
type Profile = { id: string; full_name: string; role: string; flat_id: string | null; approved: boolean; phone?: string | null };
type Staff = { id: string; name: string; service_type: string; phone: string | null; photo_url: string | null };
type Due = { id: string; flat_id: string; description: string; amount: number; due_date: string; status: string; paid_at: string | null };
type MyAdminProfile = { full_name: string; phone: string | null };

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

const MORE_TABS = [
  { key: 'notices', label: 'Notices', icon: 'bullhorn' },
  { key: 'polls', label: 'Polls', icon: 'poll' },
  { key: 'amenities', label: 'Amenities', icon: 'calendar-check' },
  { key: 'dues', label: 'Dues', icon: 'cash-multiple' },
  { key: 'society', label: 'Society', icon: 'domain' },
];

export default function AdminHome() {
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<VisitorRequest[]>([]);
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState('home');
  const [societySubTab, setSocietySubTab] = useState('towers');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [residents, setResidents] = useState<Profile[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [allNotices, setAllNotices] = useState<{ id: string; title: string; body: string; created_at: string }[]>([]);
  const [allPolls, setAllPolls] = useState<{ id: string; question: string; created_at: string }[]>([]);
  const userId = useAuthStore((s) => s.userId);
  const clearSession = useAuthStore((s) => s.clearSession);

  const [sosAlerts, setSosAlerts] = useState<SOSAlert[]>([]);
  const [resolvingSosId, setResolvingSosId] = useState<string | null>(null);

  // Form states
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOption1, setPollOption1] = useState('');
  const [pollOption2, setPollOption2] = useState('');
  const [amenityName, setAmenityName] = useState('');
  const [amenityCapacity, setAmenityCapacity] = useState('1');
  const [towerName, setTowerName] = useState('');
  const [flatTowerId, setFlatTowerId] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffType, setStaffType] = useState('plumber');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffPhotoUri, setStaffPhotoUri] = useState<string | null>(null);
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const [dues, setDues] = useState<Due[]>([]);
  const [dueFlatId, setDueFlatId] = useState('');
  const [dueDescription, setDueDescription] = useState('');
  const [dueAmount, setDueAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueApplyAll, setDueApplyAll] = useState(false);

  // Modal Detail Inspection States
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorRequest | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<{ id: string; title: string; body: string; created_at: string } | null>(null);
  const [selectedResident, setSelectedResident] = useState<Profile | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [myProfile, setMyProfile] = useState<MyAdminProfile | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearSession();
    router.replace('/(auth)/login');
  };

  const callPhone = (phone: string | null) => {
    if (!phone) {
      Alert.alert('No Phone Number', 'No phone contact provided.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const fetchActiveSosAlerts = async () => {
    const { data, error } = await supabase
      .from('sos_alerts')
      .select(`
        id,
        emergency_type,
        status,
        created_at,
        profiles:resident_id ( full_name, phone ),
        flats:flat_id ( flat_number, towers ( name ) )
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (!error && data) setSosAlerts(data as any);
  };

  const resolveSOS = async (sosId: string) => {
    setResolvingSosId(sosId);
    try {
      const { error } = await supabase
        .from('sos_alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', sosId);

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      Alert.alert('Resolved', 'The SOS alert has been marked as resolved.');
      fetchActiveSosAlerts();
    } finally {
      setResolvingSosId(null);
    }
  };

  const fetchRequests = async () => {
    const { data } = await supabase
      .from('visitor_requests')
      .select('id, status, resolution, pre_approved, otp_code, created_at, visitors(name, visitor_type, photo_url), flats(flat_number)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setRequests(data as any);
  };

  const fetchTickets = async () => {
    const { data } = await supabase.from('tickets').select('*').order('created_at', { ascending: false });
    if (data) setTickets(data);
  };
  const fetchAmenities = async () => {
    const { data } = await supabase.from('amenities').select('*').order('created_at', { ascending: false });
    if (data) setAmenities(data);
  };
  const fetchBookings = async () => {
    const { data } = await supabase.from('bookings').select('*').order('booking_date', { ascending: true });
    if (data) setBookings(data);
  };
  const fetchTowers = async () => {
    const { data } = await supabase.from('towers').select('*').order('name');
    if (data) setTowers(data);
  };
  const fetchFlats = async () => {
    const { data } = await supabase.from('flats').select('*').order('flat_number');
    if (data) setFlats(data);
  };
  const fetchResidents = async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    if (data) setResidents(data);
  };
  const fetchStaff = async () => {
    const { data } = await supabase.from('staff_directory').select('*').order('name');
    if (data) setStaff(data);
  };
  const fetchAllNotices = async () => {
    const { data } = await supabase.from('notices').select('*').order('created_at', { ascending: false });
    if (data) setAllNotices(data);
  };
  const fetchAllPolls = async () => {
    const { data } = await supabase.from('polls').select('id, question, created_at').order('created_at', { ascending: false });
    if (data) setAllPolls(data);
  };
  const fetchDues = async () => {
    const { data } = await supabase.from('dues').select('*').order('due_date', { ascending: false });
    if (data) setDues(data);
  };
  const fetchMyProfile = async () => {
    const { data } = await supabase.from('profiles').select('full_name, phone').eq('id', userId).single();
    if (data) setMyProfile({ full_name: (data as any).full_name, phone: (data as any).phone ?? null });
  };

  useEffect(() => {
    fetchRequests(); fetchTickets(); fetchAmenities(); fetchBookings();
    fetchTowers(); fetchFlats(); fetchResidents(); fetchStaff(); fetchAllNotices(); fetchAllPolls(); fetchDues(); fetchMyProfile(); fetchActiveSosAlerts();

    const channels = [
      supabase.channel('visitor_requests_admin').on('postgres_changes', { event: '*', schema: 'public', table: 'visitor_requests' }, fetchRequests).subscribe(),
      supabase.channel('tickets_admin').on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, fetchTickets).subscribe(),
      supabase.channel('bookings_admin').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchBookings).subscribe(),
      supabase.channel('amenities_admin').on('postgres_changes', { event: '*', schema: 'public', table: 'amenities' }, fetchAmenities).subscribe(),
      supabase.channel('towers_admin').on('postgres_changes', { event: '*', schema: 'public', table: 'towers' }, fetchTowers).subscribe(),
      supabase.channel('flats_admin').on('postgres_changes', { event: '*', schema: 'public', table: 'flats' }, fetchFlats).subscribe(),
      supabase.channel('staff_admin').on('postgres_changes', { event: '*', schema: 'public', table: 'staff_directory' }, fetchStaff).subscribe(),
      supabase.channel('profiles_admin').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchResidents).subscribe(),
      supabase.channel('notices_admin_list').on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, fetchAllNotices).subscribe(),
      supabase.channel('polls_admin_list').on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, fetchAllPolls).subscribe(),
      supabase.channel('dues_admin').on('postgres_changes', { event: '*', schema: 'public', table: 'dues' }, fetchDues).subscribe(),
      supabase.channel('express_passes_admin').on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_pre_approvals' }, fetchRequests).subscribe(),
      supabase.channel('admin_sos_realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts' }, (payload) => {
        fetchActiveSosAlerts();
        if (payload.eventType === 'INSERT') {
          Alert.alert('🚨 EMERGENCY SOS ALERT', 'New SOS trigger received! Check active alerts immediately.');
        }
      }).subscribe(),
    ];

    return () => channels.forEach((c) => supabase.removeChannel(c));
  }, []);

  const handleCreateNotice = async () => {
    if (!noticeTitle || !noticeBody) { Alert.alert('Missing info', 'Enter both title and body'); return; }
    const { error } = await supabase.from('notices').insert({ title: noticeTitle, body: noticeBody, created_by: userId });
    if (error) { Alert.alert('Error', error.message); return; }
    Alert.alert('Notice posted', noticeTitle);
    setNoticeTitle(''); setNoticeBody('');
  };

  const handleCreatePoll = async () => {
    if (!pollQuestion || !pollOption1 || !pollOption2) { Alert.alert('Missing info', 'Fill question and both options'); return; }
    const { data: poll, error } = await supabase.from('polls').insert({ question: pollQuestion, created_by: userId }).select().single();
    if (error || !poll) { Alert.alert('Error', error?.message ?? 'Could not create poll'); return; }
    await supabase.from('poll_options').insert([{ poll_id: poll.id, option_text: pollOption1 }, { poll_id: poll.id, option_text: pollOption2 }]);
    Alert.alert('Poll created', pollQuestion);
    setPollQuestion(''); setPollOption1(''); setPollOption2('');
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    await supabase.from('tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', ticketId);
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket((prev) => prev ? { ...prev, status } : null);
    }
  };

  const handleCreateAmenity = async () => {
    if (!amenityName) { Alert.alert('Missing info', 'Enter an amenity name'); return; }
    const { error } = await supabase.from('amenities').insert({ name: amenityName, capacity: parseInt(amenityCapacity) || 1 });
    if (error) { Alert.alert('Error', error.message); return; }
    Alert.alert('Amenity added', `${amenityName} is now available`);
    setAmenityName(''); setAmenityCapacity('1');
  };

  const cancelBooking = async (bookingId: string) => {
    await supabase.from('bookings').delete().eq('id', bookingId);
  };

  const handleCreateTower = async () => {
    if (!towerName) { Alert.alert('Missing info', 'Enter a tower name'); return; }
    const { error } = await supabase.from('towers').insert({ name: towerName });
    if (error) { Alert.alert('Error', error.message); return; }
    Alert.alert('Tower added', towerName);
    setTowerName('');
    fetchTowers();
  };

  const handleCreateFlat = async () => {
    if (!flatTowerId || !flatNumber) { Alert.alert('Missing info', 'Pick a tower and enter flat number'); return; }
    const { error } = await supabase.from('flats').insert({ tower_id: flatTowerId, flat_number: flatNumber });
    if (error) { Alert.alert('Error', error.message); return; }
    Alert.alert('Flat added', flatNumber);
    setFlatNumber('');
    fetchFlats();
  };

  const pickStaffPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) setStaffPhotoUri(result.assets[0].uri);
  };

  const uploadStaffPhoto = async (uri: string): Promise<string | null> => {
    try {
      const fileName = `staff_${Date.now()}.jpg`;
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const arrayBuffer = decode(base64);
      const { error } = await supabase.storage.from('portl-images').upload(fileName, arrayBuffer, { contentType: 'image/jpeg' });
      if (error) return null;
      const { data } = supabase.storage.from('portl-images').getPublicUrl(fileName);
      return data.publicUrl;
    } catch {
      return null;
    }
  };

  const handleCreateStaff = async () => {
    if (!staffName) { Alert.alert('Missing info', 'Enter staff name'); return; }
    let photoUrl: string | null = null;
    if (staffPhotoUri) photoUrl = await uploadStaffPhoto(staffPhotoUri);
    const { error } = await supabase.from('staff_directory').insert({ name: staffName, service_type: staffType, phone: staffPhone, photo_url: photoUrl });
    if (error) { Alert.alert('Error', error.message); return; }
    Alert.alert('Added', `${staffName} added to directory`);
    setStaffName(''); setStaffPhone(''); setStaffPhotoUri(null);
  };

  const deleteStaff = async (id: string) => {
    await supabase.from('staff_directory').delete().eq('id', id);
    if (selectedStaff?.id === id) setSelectedStaff(null);
  };

  const deleteTower = async (id: string) => {
    Alert.alert('Delete Tower', 'This will also delete all flats in this tower. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('towers').delete().eq('id', id);
        if (error) Alert.alert('Error', error.message);
        else fetchTowers();
      }},
    ]);
  };

  const deleteFlat = async (id: string) => {
    Alert.alert('Delete Flat', 'This will remove the flat. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('flats').delete().eq('id', id);
        if (error) {
          if (error.code === '23503') {
            Alert.alert('Cannot delete', 'This flat has visitor records, residents, or dues linked to it. Remove those first.');
          } else {
            Alert.alert('Error', error.message);
          }
          return;
        }
        fetchFlats();
      }},
    ]);
  };

  const deleteAmenity = async (id: string) => {
    Alert.alert('Delete Amenity', 'This will also cancel any bookings for it. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('amenities').delete().eq('id', id);
        if (error) Alert.alert('Error', error.message);
        else fetchAmenities();
      }},
    ]);
  };

  const deleteNotice = async (id: string) => {
    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (error) Alert.alert('Error', error.message);
    else if (selectedNotice?.id === id) setSelectedNotice(null);
  };

  const deletePoll = async (id: string) => {
    Alert.alert('Delete Poll', 'This will remove the poll and its votes. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('polls').delete().eq('id', id);
        if (error) Alert.alert('Error', error.message);
      }},
    ]);
  };

  const approveResident = async (id: string) => {
    const { error } = await supabase.from('profiles').update({ approved: true }).eq('id', id);
    if (error) Alert.alert('Error', error.message);
    else {
      fetchResidents();
      if (selectedResident?.id === id) setSelectedResident(null);
    }
  };

  const rejectResident = async (id: string) => {
    Alert.alert('Reject request', 'This will permanently delete this signup request. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('profiles').delete().eq('id', id);
          if (error) Alert.alert('Error', error.message);
          else {
            fetchResidents();
            if (selectedResident?.id === id) setSelectedResident(null);
          }
        },
      },
    ]);
  };

  const deleteResident = async (id: string, name: string) => {
    Alert.alert('Remove Resident', `This will permanently remove ${name}'s access. Continue?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) Alert.alert('Error', error.message);
        else {
          fetchResidents();
          if (selectedResident?.id === id) setSelectedResident(null);
        }
      }},
    ]);
  };

  const deleteVisitorRequest = async (id: string, name: string) => {
    Alert.alert('Delete Visitor Record', `Remove this visitor log entry for ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('visitor_requests').delete().eq('id', id);
        if (error) Alert.alert('Error', error.message);
        else if (selectedVisitor?.id === id) setSelectedVisitor(null);
      }},
    ]);
  };

  const overrideVisitorStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('visitor_requests').update({ status }).eq('id', id);
    if (error) Alert.alert('Error', error.message);
    else if (selectedVisitor?.id === id) {
      setSelectedVisitor((prev) => prev ? { ...prev, status } : null);
    }
  };

  const reassignResidentFlat = async (residentId: string, newFlatId: string) => {
    const { error } = await supabase.from('profiles').update({ flat_id: newFlatId }).eq('id', residentId);
    if (error) Alert.alert('Error', error.message);
    else {
      Alert.alert('Updated', 'Resident reassigned to new flat');
      fetchResidents();
    }
  };

  const handleCreateDue = async () => {
    if (!dueDescription || !dueAmount || !dueDate) {
      Alert.alert('Missing info', 'Fill description, amount and due date');
      return;
    }
    if (!dueApplyAll && !dueFlatId) {
      Alert.alert('Missing info', 'Select a flat, or toggle "Apply to all flats"');
      return;
    }
    const amountNum = parseFloat(dueAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid positive number');
      return;
    }

    const targetFlats = dueApplyAll ? flats.map((f) => f.id) : [dueFlatId];

    const rows = targetFlats.map((flat_id) => ({
      flat_id,
      description: dueDescription,
      amount: amountNum,
      due_date: dueDate,
      status: 'pending',
    }));

    const { error } = await supabase.from('dues').insert(rows);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    Alert.alert('Due added', `Applied to ${targetFlats.length} flat(s)`);
    setDueDescription('');
    setDueAmount('');
    setDueDate('');
    setDueFlatId('');
    setDueApplyAll(false);
  };

  const deleteDue = async (id: string) => {
    const { error } = await supabase.from('dues').delete().eq('id', id);
    if (error) Alert.alert('Error', error.message);
  };

  const today = new Date().toDateString();
  const todayCount = requests.filter((r) => new Date(r.created_at).toDateString() === today).length;
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter);
  
  const statusColor = (s: string) => (s === 'approved' ? SUCCESS : s === 'denied' ? DANGER : WARN);
  const statusBg = (s: string) => (s === 'approved' ? SUCCESS_BG : s === 'denied' ? DANGER_BG : WARN_BG);
  const ticketStatusColor = (s: string) => (s === 'resolved' ? SUCCESS : s === 'in_progress' ? WARN : INK_MUTED);
  const ticketStatusBg = (s: string) => (s === 'resolved' ? SUCCESS_BG : s === 'in_progress' ? WARN_BG : INPUT_BG);
  const amenityNameFor = (id: string) => amenities.find((a) => a.id === id)?.name ?? 'Unknown';
  
  const pendingDues = dues.filter((d) => d.status !== 'paid');
  const paidDues = dues.filter((d) => d.status === 'paid');
  const totalDue = pendingDues.reduce((sum, d) => sum + Number(d.amount), 0);
  const flatsOwingCount = new Set(pendingDues.map((d) => d.flat_id)).size;
  const currentMonthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`;
  const collectedThisMonth = paidDues
    .filter((d) => d.paid_at && `${new Date(d.paid_at).getFullYear()}-${new Date(d.paid_at).getMonth()}` === currentMonthKey)
    .reduce((sum, d) => sum + Number(d.amount), 0);
  
  const towerNameFor = (id: string) => towers.find((t) => t.id === id)?.name ?? 'Unknown';
  const flatNumberFor = (id: string | null) => flats.find((f) => f.id === id)?.flat_number ?? '—';
  const pendingResidents = residents.filter((r) => !r.approved);
  const approvedResidents = residents.filter((r) => r.approved);

  const inputTheme = { colors: { onSurfaceVariant: INK_MUTED, background: 'transparent', primary: ACCENT } };

  const firstName = myProfile?.full_name?.split(' ')[0] ?? 'Admin';
  const openTicketsCount = tickets.filter((t) => t.status !== 'resolved').length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const latestNotice = allNotices[0] ?? null;
  const previewPendingResidents = pendingResidents.slice(0, 3);
  const isMoreActiveTab = MORE_TABS.some((t) => t.key === tab);

  const goToTab = (key: string) => {
    setTab(key);
    setMoreOpen(false);
    setProfileOpen(false);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.title}>{firstName}</Text>
          <View style={styles.roleBadge}>
            <IconButton icon="shield-check-outline" size={14} iconColor={ACCENT} style={{ margin: 0, marginRight: -4 }} />
            <Text style={styles.roleBadgeText}>Administrator</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {tab === 'home' && (
            <>
              {sosAlerts.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <View style={styles.sectionHeaderRow}>
                    <Avatar.Icon size={30} icon="alert-octagon" style={{ backgroundColor: DANGER_BG }} color={DANGER} />
                    <Text style={[styles.sectionTitle, { color: DANGER }]}>Active Emergency SOS ({sosAlerts.length})</Text>
                  </View>
                  {sosAlerts.map((sos) => (
                    <View key={sos.id} style={[styles.card, { borderColor: DANGER, borderWidth: 2, marginBottom: 12 }]}>
                      <View style={{ padding: 16 }}>
                        <View style={styles.row}>
                          <Chip compact style={{ backgroundColor: DANGER_BG }} textStyle={{ color: DANGER, fontWeight: '700', fontSize: 12 }}>
                            🚨 {sos.emergency_type}
                          </Chip>
                          <Text style={styles.metaFaint}>
                            {new Date(sos.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>

                        <Text style={[styles.visitorName, { marginTop: 8, fontSize: 18 }]}>
                          {sos.flats?.towers?.name ? `${sos.flats.towers.name} · ` : ''}Flat {sos.flats?.flat_number ?? 'Unknown'}
                        </Text>
                        <Text style={styles.meta}>Resident: {sos.profiles?.full_name ?? 'Unknown'}</Text>
                        {sos.profiles?.phone && <Text style={styles.meta}>📞 {sos.profiles.phone}</Text>}
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
                <Pressable style={styles.statCard} onPress={() => goToTab('visitors')}>
                  <Text style={styles.statNum}>{todayCount}</Text>
                  <Text style={styles.statLabel}>Visitors Today</Text>
                </Pressable>
                <Pressable style={styles.statCard} onPress={() => goToTab('visitors')}>
                  <Text style={[styles.statNum, pendingCount > 0 && { color: WARN }]}>{pendingCount}</Text>
                  <Text style={styles.statLabel}>Pending Visitors</Text>
                </Pressable>
                <Pressable style={styles.statCard} onPress={() => goToTab('tickets')}>
                  <Text style={styles.statNum}>{openTicketsCount}</Text>
                  <Text style={styles.statLabel}>Open Tickets</Text>
                </Pressable>
              </View>

              <Text style={styles.homeSectionLabel}>Quick Actions</Text>
              <View style={styles.quickActionsRow}>
                <Pressable style={styles.quickActionTile} onPress={() => goToTab('visitors')}>
                  <Avatar.Icon size={40} icon="account-group" style={{ backgroundColor: ACCENT_SOFT }} color={ACCENT} />
                  <Text style={styles.quickActionLabel}>Visitors</Text>
                </Pressable>
                <Pressable style={styles.quickActionTile} onPress={() => goToTab('tickets')}>
                  <Avatar.Icon size={40} icon="headset" style={{ backgroundColor: ACCENT_SOFT }} color={ACCENT} />
                  <Text style={styles.quickActionLabel}>Tickets</Text>
                </Pressable>
                <Pressable style={styles.quickActionTile} onPress={() => goToTab('notices')}>
                  <Avatar.Icon size={40} icon="bullhorn" style={{ backgroundColor: ACCENT_SOFT }} color={ACCENT} />
                  <Text style={styles.quickActionLabel}>Notices</Text>
                </Pressable>
                <Pressable style={styles.quickActionTile} onPress={() => goToTab('society')}>
                  <Avatar.Icon size={40} icon="domain" style={{ backgroundColor: ACCENT_SOFT }} color={ACCENT} />
                  <Text style={styles.quickActionLabel}>Society</Text>
                </Pressable>
              </View>

              {(pendingDues.length > 0 || paidDues.length > 0) && (
                <Pressable style={[styles.card, styles.duesSnapshotCard]} onPress={() => goToTab('dues')}>
                  <View style={styles.duesSnapshotRow}>
                    <View style={styles.duesSnapshotHalf}>
                      <Text style={styles.duesSnapshotLabel}>Pending</Text>
                      <Text style={[styles.duesSnapshotAmount, pendingDues.length > 0 && { color: DANGER }]}>₹{totalDue.toFixed(2)}</Text>
                      <Text style={styles.duesSnapshotSub}>{flatsOwingCount} flat{flatsOwingCount === 1 ? '' : 's'} owing</Text>
                    </View>
                    <View style={styles.duesSnapshotDivider} />
                    <View style={styles.duesSnapshotHalf}>
                      <Text style={styles.duesSnapshotLabel}>Collected this month</Text>
                      <Text style={[styles.duesSnapshotAmount, { color: SUCCESS }]}>₹{collectedThisMonth.toFixed(2)}</Text>
                      <Text style={styles.duesSnapshotSub}>{new Date().toLocaleDateString(undefined, { month: 'long' })}</Text>
                    </View>
                    <IconButton icon="chevron-right" size={20} iconColor={INK_FAINT} style={{ margin: 0 }} />
                  </View>
                </Pressable>
              )}

              {pendingResidents.length > 0 && (
                <>
                  <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
                    <Avatar.Icon size={30} icon="account-alert" style={{ backgroundColor: WARN_BG }} color={WARN} />
                    <Text style={styles.sectionTitle}>Pending Approvals</Text>
                    <Text style={styles.countBadge}>{pendingResidents.length}</Text>
                  </View>
                  {previewPendingResidents.map((r) => (
                    <Pressable key={r.id} style={[styles.card, styles.pendingCard]} onPress={() => setSelectedResident(r)}>
                      <View style={{ padding: 16 }}>
                        <View style={styles.rowWithImage}>
                          <View style={[styles.thumbPlaceholder, { backgroundColor: WARN }]}>
                            <Text style={styles.thumbInitial}>{r.full_name?.[0]?.toUpperCase() ?? '?'}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.visitorName}>{r.full_name}</Text>
                            <Text style={styles.meta}>{r.role} · Flat {flatNumberFor(r.flat_id)}</Text>
                          </View>
                        </View>
                      </View>
                      <Divider style={{ backgroundColor: BORDER }} />
                      <View style={styles.cardActions}>
                        <Button compact textColor={DANGER} onPress={() => rejectResident(r.id)}>Reject</Button>
                        <Button compact mode="contained" buttonColor={ACCENT} textColor="#fff" onPress={() => approveResident(r.id)}>Approve</Button>
                      </View>
                    </Pressable>
                  ))}
                  {pendingResidents.length > 3 && (
                    <Button compact textColor={ACCENT} onPress={() => { setSocietySubTab('residents'); goToTab('society'); }}>
                      View all ({pendingResidents.length})
                    </Button>
                  )}
                </>
              )}

              <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
                <Avatar.Icon size={30} icon="bullhorn" style={styles.sectionIcon} color={ACCENT} />
                <Text style={styles.sectionTitle}>Latest Notice</Text>
                <Pressable onPress={() => goToTab('notices')}><Text style={styles.viewAllLink}>View all</Text></Pressable>
              </View>
              {latestNotice ? (
                <Pressable style={[styles.card, { marginBottom: 20 }]} onPress={() => setSelectedNotice(latestNotice)}>
                  <View style={{ padding: 16 }}>
                    <Text style={styles.visitorName}>{latestNotice.title}</Text>
                    <Text style={styles.noticeBody} numberOfLines={2}>{latestNotice.body}</Text>
                    <Text style={styles.metaFaint}>Published: {new Date(latestNotice.created_at).toLocaleDateString()}</Text>
                  </View>
                </Pressable>
              ) : (
                <Text style={[styles.empty, { marginBottom: 20 }]}>No notices posted yet</Text>
              )}
            </>
          )}

          {tab === 'visitors' && (
            <>
              <View style={styles.statsRow}>
                <View style={styles.statCard}><Text style={styles.statNum}>{todayCount}</Text><Text style={styles.statLabel}>Today</Text></View>
                <View style={styles.statCard}><Text style={[styles.statNum, { color: WARN }]}>{pendingCount}</Text><Text style={styles.statLabel}>Pending</Text></View>
                <View style={styles.statCard}><Text style={styles.statNum}>{requests.length}</Text><Text style={styles.statLabel}>Total</Text></View>
              </View>

              <View style={styles.sectionHeaderRow}>
                <Avatar.Icon size={30} icon="clipboard-list" style={styles.sectionIcon} color={ACCENT} />
                <Text style={styles.sectionTitle}>Society Visitor Log</Text>
              </View>
              <View style={styles.filterRow}>
                {['all', 'pending', 'approved', 'denied'].map((f) => (
                  <Chip key={f} selected={filter === f} onPress={() => setFilter(f)} style={[styles.filterChip, filter === f && styles.chipSelected]} textStyle={filter === f ? styles.chipTextSelected : styles.chipText}>{f}</Chip>
                ))}
              </View>
              {filtered.length === 0 && (
                <View style={styles.emptyState}>
                  <Avatar.Icon size={44} icon="clipboard-search-outline" style={{ backgroundColor: ACCENT_SOFT }} color={ACCENT} />
                  <Text style={styles.empty}>No visitor records found</Text>
                </View>
              )}
              <FlatList
                data={filtered}
                keyExtractor={(i) => i.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                renderItem={({ item }) => (
                  <Pressable style={styles.card} onPress={() => setSelectedVisitor(item)}>
                    <View style={{ padding: 16 }}>
                      <View style={styles.rowWithImage}>
                        {item.visitors?.photo_url ? (
                          <Image source={{ uri: item.visitors.photo_url }} style={styles.thumb} />
                        ) : (
                          <View style={styles.thumbPlaceholder}>
                            <Text style={styles.thumbInitial}>{item.visitors?.name?.[0]?.toUpperCase() ?? '?'}</Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <View style={styles.row}>
                            <Text style={styles.visitorName} numberOfLines={1}>{item.visitors?.name}</Text>
                            <Chip 
                              compact 
                              textStyle={{ 
                                color: item.resolution === 'left_at_gate' ? TEAL : statusColor(item.status), 
                                fontWeight: '600', 
                                fontSize: 11 
                              }} 
                              style={{ 
                                backgroundColor: item.resolution === 'left_at_gate' ? TEAL_BG : statusBg(item.status) 
                              }}
                            >
                              {item.resolution === 'left_at_gate' ? 'left at gate' : item.pre_approved ? 'pre-approved' : item.status}
                            </Chip>
                          </View>
                          <Text style={styles.meta}>Flat {item.flats?.flat_number} · {item.visitors?.visitor_type}</Text>
                          <Text style={styles.metaFaint}>{new Date(item.created_at).toLocaleString()}</Text>
                        </View>
                      </View>
                    </View>
                    <Divider style={{ backgroundColor: BORDER }} />
                    <View style={[styles.cardActions, { flexWrap: 'wrap' }]}>
                      {item.status !== 'approved' && (
                        <IconButton icon="check-circle" iconColor={SUCCESS} size={20} onPress={() => overrideVisitorStatus(item.id, 'approved')} />
                      )}
                      {item.status !== 'denied' && (
                        <IconButton icon="close-circle" iconColor={WARN} size={20} onPress={() => overrideVisitorStatus(item.id, 'denied')} />
                      )}
                      <IconButton icon="delete" iconColor={DANGER} size={20} onPress={() => deleteVisitorRequest(item.id, item.visitors?.name ?? 'visitor')} />
                    </View>
                  </Pressable>
                )}
              />
            </>
          )}

          {tab === 'notices' && (
            <View>
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Avatar.Icon size={30} icon="bullhorn" style={styles.sectionIcon} color={ACCENT} />
                  <Text style={styles.sectionTitle}>Post a Notice</Text>
                </View>
                <View style={styles.inputWrap}><TextInput mode="flat" label="Title" value={noticeTitle} onChangeText={setNoticeTitle} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} cursorColor={ACCENT} selectionColor={ACCENT_SOFT} /></View>
                <View style={styles.inputWrap}><TextInput mode="flat" label="Body" value={noticeBody} onChangeText={setNoticeBody} multiline numberOfLines={3} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} cursorColor={ACCENT} selectionColor={ACCENT_SOFT} /></View>
                <Button mode="contained" onPress={handleCreateNotice} buttonColor={ACCENT} textColor="#fff" style={styles.submitButton} contentStyle={{ paddingVertical: 4 }}>Post Notice</Button>
              </View>
              <View style={styles.sectionHeaderRow}>
                <Avatar.Icon size={30} icon="format-list-bulleted" style={styles.sectionIcon} color={ACCENT} />
                <Text style={styles.sectionTitle}>Posted Notices ({allNotices.length})</Text>
              </View>
              {allNotices.map((n) => (
                <Pressable key={n.id} style={[styles.card, { marginBottom: 12 }]} onPress={() => setSelectedNotice(n)}>
                  <View style={{ padding: 16 }}>
                    <Text style={styles.visitorName}>{n.title}</Text>
                    <Text style={styles.meta} numberOfLines={2}>{n.body}</Text>
                    <Text style={styles.metaFaint}>{new Date(n.created_at).toLocaleString()}</Text>
                  </View>
                  <Divider style={{ backgroundColor: BORDER }} />
                  <View style={styles.cardActions}><Button compact textColor={DANGER} onPress={() => deleteNotice(n.id)}>Delete</Button></View>
                </Pressable>
              ))}
            </View>
          )}

          {tab === 'polls' && (
            <View>
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Avatar.Icon size={30} icon="poll" style={styles.sectionIcon} color={ACCENT} />
                  <Text style={styles.sectionTitle}>Create a Poll</Text>
                </View>
                <View style={styles.inputWrap}><TextInput mode="flat" label="Question" value={pollQuestion} onChangeText={setPollQuestion} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} cursorColor={ACCENT} selectionColor={ACCENT_SOFT} /></View>
                <View style={styles.inputWrap}><TextInput mode="flat" label="Option 1" value={pollOption1} onChangeText={setPollOption1} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} cursorColor={ACCENT} selectionColor={ACCENT_SOFT} /></View>
                <View style={styles.inputWrap}><TextInput mode="flat" label="Option 2" value={pollOption2} onChangeText={setPollOption2} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} cursorColor={ACCENT} selectionColor={ACCENT_SOFT} /></View>
                <Button mode="contained" onPress={handleCreatePoll} buttonColor={ACCENT} textColor="#fff" style={styles.submitButton} contentStyle={{ paddingVertical: 4 }}>Create Poll</Button>
              </View>
              <View style={styles.sectionHeaderRow}>
                <Avatar.Icon size={30} icon="format-list-bulleted" style={styles.sectionIcon} color={ACCENT} />
                <Text style={styles.sectionTitle}>Active Polls ({allPolls.length})</Text>
              </View>
              {allPolls.map((p) => (
                <View key={p.id} style={[styles.card, { marginBottom: 12 }]}>
                  <View style={{ padding: 16 }}>
                    <Text style={styles.visitorName}>{p.question}</Text>
                    <Text style={styles.metaFaint}>{new Date(p.created_at).toLocaleString()}</Text>
                  </View>
                  <Divider style={{ backgroundColor: BORDER }} />
                  <View style={styles.cardActions}><Button compact textColor={DANGER} onPress={() => deletePoll(p.id)}>Delete</Button></View>
                </View>
              ))}
            </View>
          )}

          {tab === 'tickets' && (
            <>
              <View style={styles.sectionHeaderRow}>
                <Avatar.Icon size={30} icon="headset" style={styles.sectionIcon} color={ACCENT} />
                <Text style={styles.sectionTitle}>All Support Tickets</Text>
              </View>
              {tickets.length === 0 && (
                <View style={styles.emptyState}>
                  <Avatar.Icon size={44} icon="check-circle-outline" style={{ backgroundColor: ACCENT_SOFT }} color={ACCENT} />
                  <Text style={styles.empty}>No tickets raised yet</Text>
                </View>
              )}
              <FlatList data={tickets} keyExtractor={(i) => i.id} scrollEnabled={false} ItemSeparatorComponent={() => <View style={{ height: 12 }} />} renderItem={({ item }) => (
                <Pressable style={styles.card} onPress={() => setSelectedTicket(item)}>
                  <View style={{ padding: 16 }}>
                    <View style={styles.row}>
                      <Text style={styles.visitorName}>{item.category}</Text>
                      <Chip compact textStyle={{ color: ticketStatusColor(item.status), fontWeight: '600', fontSize: 11 }} style={{ backgroundColor: ticketStatusBg(item.status) }}>{item.status.replace('_', ' ')}</Chip>
                    </View>
                    <Text style={styles.meta} numberOfLines={2}>{item.description}</Text>
                    <Text style={styles.metaFaint}>{new Date(item.created_at).toLocaleString()}</Text>
                  </View>
                  <Divider style={{ backgroundColor: BORDER }} />
                  <View style={styles.cardActions}>
                    {item.status !== 'in_progress' && <Button compact textColor={ACCENT} onPress={() => updateTicketStatus(item.id, 'in_progress')}>In Progress</Button>}
                    {item.status !== 'resolved' && <Button compact mode="contained" buttonColor={ACCENT} textColor="#fff" onPress={() => updateTicketStatus(item.id, 'resolved')}>Resolve</Button>}
                  </View>
                </Pressable>
              )} />
            </>
          )}

          {tab === 'amenities' && (
            <>
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Avatar.Icon size={30} icon="calendar-plus" style={styles.sectionIcon} color={ACCENT} />
                  <Text style={styles.sectionTitle}>Add Amenity</Text>
                </View>
                <View style={styles.inputWrap}><TextInput mode="flat" label="Amenity name" value={amenityName} onChangeText={setAmenityName} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} cursorColor={ACCENT} selectionColor={ACCENT_SOFT} /></View>
                <View style={styles.inputWrap}><TextInput mode="flat" label="Capacity per slot" value={amenityCapacity} onChangeText={setAmenityCapacity} keyboardType="numeric" style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} cursorColor={ACCENT} selectionColor={ACCENT_SOFT} /></View>
                <Button mode="contained" onPress={handleCreateAmenity} buttonColor={ACCENT} textColor="#fff" style={styles.submitButton} contentStyle={{ paddingVertical: 4 }}>Add Amenity</Button>
              </View>

              <View style={styles.sectionHeaderRow}>
                <Avatar.Icon size={30} icon="pool" style={styles.sectionIcon} color={ACCENT} />
                <Text style={styles.sectionTitle}>Amenities ({amenities.length})</Text>
              </View>
              {amenities.map((a) => (
                <View key={a.id} style={[styles.card, { marginBottom: 12 }]}>
                  <View style={{ padding: 16 }}>
                    <Text style={styles.visitorName}>{a.name}</Text>
                    <Text style={styles.meta}>Capacity: {a.capacity} · Slots: {a.slots.length}</Text>
                  </View>
                  <Divider style={{ backgroundColor: BORDER }} />
                  <View style={styles.cardActions}><Button compact textColor={DANGER} onPress={() => deleteAmenity(a.id)}>Delete</Button></View>
                </View>
              ))}

              <View style={styles.sectionHeaderRow}>
                <Avatar.Icon size={30} icon="calendar-clock" style={styles.sectionIcon} color={ACCENT} />
                <Text style={styles.sectionTitle}>All Bookings</Text>
              </View>
              {bookings.length === 0 && <Text style={styles.empty}>No bookings yet</Text>}
              <FlatList data={bookings} keyExtractor={(i) => i.id} scrollEnabled={false} ItemSeparatorComponent={() => <View style={{ height: 12 }} />} renderItem={({ item }) => (
                <View style={styles.card}>
                  <View style={{ padding: 16 }}>
                    <Text style={styles.visitorName}>{amenityNameFor(item.amenity_id)}</Text>
                    <Text style={styles.meta}>{item.booking_date} · {item.slot}</Text>
                  </View>
                  <Divider style={{ backgroundColor: BORDER }} />
                  <View style={styles.cardActions}><Button compact textColor={DANGER} onPress={() => cancelBooking(item.id)}>Cancel</Button></View>
                </View>
              )} />
            </>
          )}

          {tab === 'dues' && (
            <View>
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Avatar.Icon size={30} icon="cash-plus" style={styles.sectionIcon} color={ACCENT} />
                  <Text style={styles.sectionTitle}>Add a Due</Text>
                </View>
                <View style={styles.inputWrap}><TextInput mode="flat" label="Description (e.g. Maintenance - August)" value={dueDescription} onChangeText={setDueDescription} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} cursorColor={ACCENT} selectionColor={ACCENT_SOFT} /></View>
                <View style={styles.inputWrap}><TextInput mode="flat" label="Amount (₹)" value={dueAmount} onChangeText={setDueAmount} keyboardType="numeric" style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} cursorColor={ACCENT} selectionColor={ACCENT_SOFT} /></View>
                <View style={styles.inputWrap}><TextInput mode="flat" label="Due date (YYYY-MM-DD)" value={dueDate} onChangeText={setDueDate} placeholder="2026-08-05" style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} cursorColor={ACCENT} selectionColor={ACCENT_SOFT} /></View>

                <Chip
                  selected={dueApplyAll}
                  onPress={() => { setDueApplyAll(!dueApplyAll); setDueFlatId(''); }}
                  style={[styles.filterChip, dueApplyAll && styles.chipSelected, { marginBottom: 12 }]}
                  textStyle={dueApplyAll ? styles.chipTextSelected : styles.chipText}
                  icon="domain"
                >
                  Apply to all flats
                </Chip>

                {!dueApplyAll && (
                  <>
                    <Text style={styles.fieldLabel}>Select flat</Text>
                    <View style={styles.filterRow}>
                      {flats.map((f) => (
                        <Chip key={f.id} selected={dueFlatId === f.id} onPress={() => setDueFlatId(f.id)} style={[styles.filterChip, dueFlatId === f.id && styles.chipSelected]} textStyle={dueFlatId === f.id ? styles.chipTextSelected : styles.chipText}>
                          {f.flat_number}
                        </Chip>
                      ))}
                    </View>
                  </>
                )}

                <Button mode="contained" onPress={handleCreateDue} buttonColor={ACCENT} textColor="#fff" style={styles.submitButton} contentStyle={{ paddingVertical: 4 }}>Add Due</Button>
              </View>

              {pendingDues.length > 0 && (
                <View style={[styles.card, styles.totalDueCard, { marginBottom: 20 }]}>
                  <View style={{ padding: 16 }}>
                    <Text style={styles.totalDueLabel}>Total Outstanding</Text>
                    <Text style={styles.totalDueAmount}>₹{totalDue.toFixed(2)}</Text>
                  </View>
                </View>
              )}

              <View style={styles.sectionHeaderRow}>
                <Avatar.Icon size={30} icon="cash-multiple" style={styles.sectionIcon} color={ACCENT} />
                <Text style={styles.sectionTitle}>All Dues ({dues.length})</Text>
              </View>
              {dues.length === 0 && <Text style={styles.empty}>No dues added yet</Text>}
              {dues.map((d) => (
                <View key={d.id} style={[styles.card, { marginBottom: 12 }]}>
                  <View style={{ padding: 16 }}>
                    <View style={styles.row}>
                      <Text style={styles.visitorName}>Flat {flatNumberFor(d.flat_id)}</Text>
                      <Chip compact textStyle={{ color: d.status === 'paid' ? SUCCESS : WARN, fontWeight: '600', fontSize: 11 }} style={{ backgroundColor: d.status === 'paid' ? SUCCESS_BG : WARN_BG }}>
                        {d.status}
                      </Chip>
                    </View>
                    <Text style={styles.meta}>{d.description} · ₹{d.amount}</Text>
                    <Text style={styles.metaFaint}>Due: {d.due_date}{d.paid_at ? ` · Paid: ${new Date(d.paid_at).toLocaleDateString()}` : ''}</Text>
                  </View>
                  <Divider style={{ backgroundColor: BORDER }} />
                  <View style={styles.cardActions}><Button compact textColor={DANGER} onPress={() => deleteDue(d.id)}>Delete</Button></View>
                </View>
              ))}
            </View>
          )}

          {tab === 'society' && (
            <View>
              <View style={styles.filterRow}>
                {['towers', 'flats', 'residents', 'staff'].map((s) => (
                  <Chip key={s} selected={societySubTab === s} onPress={() => setSocietySubTab(s)} style={[styles.filterChip, societySubTab === s && styles.chipSelected]} textStyle={societySubTab === s ? styles.chipTextSelected : styles.chipText}>
                    {s}{s === 'residents' && pendingResidents.length > 0 ? ` (${pendingResidents.length})` : ''}
                  </Chip>
                ))}
              </View>

              {societySubTab === 'towers' && (
                <View style={styles.sectionCard}>
                  <View style={styles.inputWrap}><TextInput mode="flat" label="Tower name (e.g. Tower B)" value={towerName} onChangeText={setTowerName} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} cursorColor={ACCENT} selectionColor={ACCENT_SOFT} /></View>
                  <Button mode="contained" onPress={handleCreateTower} buttonColor={ACCENT} textColor="#fff" style={styles.submitButton} contentStyle={{ paddingVertical: 4 }}>Add Tower</Button>
                </View>
              )}
              {societySubTab === 'towers' && towers.map((t) => (
                <View key={t.id} style={[styles.card, { marginBottom: 12 }]}>
                  <View style={{ padding: 16 }}><Text style={styles.visitorName}>{t.name}</Text></View>
                  <Divider style={{ backgroundColor: BORDER }} />
                  <View style={styles.cardActions}><Button compact textColor={DANGER} onPress={() => deleteTower(t.id)}>Delete</Button></View>
                </View>
              ))}

              {societySubTab === 'flats' && (
                <View style={styles.sectionCard}>
                  <Text style={styles.fieldLabel}>Select tower, then add flat</Text>
                  <View style={styles.filterRow}>
                    {towers.map((t) => (
                      <Chip key={t.id} selected={flatTowerId === t.id} onPress={() => setFlatTowerId(t.id)} style={[styles.filterChip, flatTowerId === t.id && styles.chipSelected]} textStyle={flatTowerId === t.id ? styles.chipTextSelected : styles.chipText}>{t.name}</Chip>
                    ))}
                  </View>
                  <View style={styles.inputWrap}><TextInput mode="flat" label="Flat number" value={flatNumber} onChangeText={setFlatNumber} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} cursorColor={ACCENT} selectionColor={ACCENT_SOFT} /></View>
                  <Button mode="contained" onPress={handleCreateFlat} buttonColor={ACCENT} textColor="#fff" style={styles.submitButton} contentStyle={{ paddingVertical: 4 }}>Add Flat</Button>
                </View>
              )}
              {societySubTab === 'flats' && flats.map((f) => (
                <View key={f.id} style={[styles.card, { marginBottom: 12 }]}>
                  <View style={{ padding: 16 }}>
                    <Text style={styles.visitorName}>Flat {f.flat_number}</Text>
                    <Text style={styles.meta}>{towerNameFor(f.tower_id)}</Text>
                  </View>
                  <Divider style={{ backgroundColor: BORDER }} />
                  <View style={styles.cardActions}><Button compact textColor={DANGER} onPress={() => deleteFlat(f.id)}>Delete</Button></View>
                </View>
              ))}

              {societySubTab === 'residents' && (
                <View>
                  <View style={styles.sectionHeaderRow}>
                    <Avatar.Icon size={30} icon="account-alert" style={{ backgroundColor: WARN_BG }} color={WARN} />
                    <Text style={styles.sectionTitle}>Pending Approval ({pendingResidents.length})</Text>
                  </View>
                  {pendingResidents.length === 0 && <Text style={styles.empty}>No pending requests</Text>}
                  {pendingResidents.map((r) => (
                    <Pressable key={r.id} style={[styles.card, styles.pendingCard]} onPress={() => setSelectedResident(r)}>
                      <View style={{ padding: 16 }}>
                        <View style={styles.rowWithImage}>
                          <View style={[styles.thumbPlaceholder, { backgroundColor: WARN }]}>
                            <Text style={styles.thumbInitial}>{r.full_name?.[0]?.toUpperCase() ?? '?'}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.visitorName}>{r.full_name}</Text>
                            <Text style={styles.meta}>{r.role} · Flat {flatNumberFor(r.flat_id)}</Text>
                          </View>
                        </View>
                      </View>
                      <Divider style={{ backgroundColor: BORDER }} />
                      <View style={styles.cardActions}>
                        <Button compact textColor={DANGER} onPress={() => rejectResident(r.id)}>Reject</Button>
                        <Button compact mode="contained" buttonColor={ACCENT} textColor="#fff" onPress={() => approveResident(r.id)}>Approve</Button>
                      </View>
                    </Pressable>
                  ))}

                  <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
                    <Avatar.Icon size={30} icon="account-group" style={styles.sectionIcon} color={ACCENT} />
                    <Text style={styles.sectionTitle}>All Residents ({approvedResidents.length})</Text>
                  </View>
                  {approvedResidents.map((r) => (
                    <Pressable key={r.id} style={[styles.card, { marginBottom: 12 }]} onPress={() => setSelectedResident(r)}>
                      <View style={{ padding: 16 }}>
                        <View style={styles.rowWithImage}>
                          <View style={styles.thumbPlaceholder}>
                            <Text style={styles.thumbInitial}>{r.full_name?.[0]?.toUpperCase() ?? '?'}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.visitorName}>{r.full_name}</Text>
                            <Text style={styles.meta}>{r.role} · Flat {flatNumberFor(r.flat_id)}</Text>
                          </View>
                        </View>
                        {reassigningId === r.id && (
                          <View style={{ marginTop: 12 }}>
                            <Text style={styles.fieldLabel}>Move to flat:</Text>
                            <View style={styles.filterRow}>
                              {flats.map((f) => (
                                <Chip
                                  key={f.id}
                                  selected={r.flat_id === f.id}
                                  onPress={() => { reassignResidentFlat(r.id, f.id); setReassigningId(null); }}
                                  style={[styles.filterChip, r.flat_id === f.id && styles.chipSelected]}
                                  textStyle={r.flat_id === f.id ? styles.chipTextSelected : styles.chipText}
                                >
                                  {f.flat_number}
                                </Chip>
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                      <Divider style={{ backgroundColor: BORDER }} />
                      <View style={styles.cardActions}>
                        <Button compact textColor={ACCENT} onPress={() => setReassigningId(reassigningId === r.id ? null : r.id)}>
                          {reassigningId === r.id ? 'Cancel' : 'Reassign Flat'}
                        </Button>
                        <Button compact textColor={DANGER} onPress={() => deleteResident(r.id, r.full_name)}>Remove</Button>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

              {societySubTab === 'staff' && (
                <View>
                  <View style={styles.sectionCard}>
                    <View style={styles.inputWrap}><TextInput mode="flat" label="Staff/service name" value={staffName} onChangeText={setStaffName} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} cursorColor={ACCENT} selectionColor={ACCENT_SOFT} /></View>
                    <SegmentedButtons
                      value={staffType}
                      onValueChange={setStaffType}
                      style={styles.segmented}
                      theme={{ colors: { secondaryContainer: ACCENT_SOFT, onSecondaryContainer: ACCENT } }}
                      buttons={[
                        { value: 'plumber', label: 'Plumber' },
                        { value: 'electrician', label: 'Electrician' },
                        { value: 'milkman', label: 'Milkman' },
                        { value: 'other', label: 'Other' },
                      ]}
                    />
                    <View style={styles.inputWrap}><TextInput mode="flat" label="Phone" value={staffPhone} onChangeText={setStaffPhone} keyboardType="phone-pad" style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} cursorColor={ACCENT} selectionColor={ACCENT_SOFT} /></View>
                    <View style={styles.photoRow}>
                      {staffPhotoUri ? (
                        <Image source={{ uri: staffPhotoUri }} style={styles.previewImage} />
                      ) : (
                        <View style={styles.photoPlaceholder}><Avatar.Icon size={32} icon="camera" style={{ backgroundColor: 'transparent' }} color={INK_FAINT} /></View>
                      )}
                      <Button mode="outlined" onPress={pickStaffPhoto} icon="camera" textColor={ACCENT} style={styles.photoButton}>
                        {staffPhotoUri ? 'Retake' : 'Add Photo'}
                      </Button>
                    </View>
                    <Button mode="contained" onPress={handleCreateStaff} buttonColor={ACCENT} textColor="#fff" style={styles.submitButton} contentStyle={{ paddingVertical: 4 }}>Add to Directory</Button>
                  </View>
                  {staff.map((s) => (
                    <Pressable key={s.id} style={[styles.staffCard, { marginBottom: 12 }]} onPress={() => setSelectedStaff(s)}>
                      <View style={styles.staffCardContent}>
                        {s.photo_url ? (
                          <Image source={{ uri: s.photo_url }} style={styles.staffImage} />
                        ) : (
                          <View style={styles.staffAvatarPlaceholder}>
                            <Text style={styles.staffAvatarInitial}>{s.name[0]?.toUpperCase() ?? 'S'}</Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.staffNameText} numberOfLines={1}>{s.name}</Text>
                          <View style={styles.staffTagRow}>
                            <View style={styles.staffServiceBadge}>
                              <Text style={styles.staffServiceText}>{s.service_type}</Text>
                            </View>
                          </View>
                          <Text style={styles.staffPhoneText}>{s.phone ? `📞 ${s.phone}` : 'No phone provided'}</Text>
                        </View>
                        {s.phone && (
                          <IconButton icon="phone" size={20} iconColor="#fff" style={styles.staffCallIcon} onPress={() => callPhone(s.phone)} />
                        )}
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={{ height: 90 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* BOTTOM NAVIGATION */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 10 }]}>
        <Pressable style={styles.navItem} onPress={() => setTab('home')} hitSlop={8}>
          <View style={[styles.navIconWrap, tab === 'home' && styles.navIconWrapActive]}>
            <IconButton icon="home-variant" size={22} iconColor={tab === 'home' ? ACCENT : INK_FAINT} style={{ margin: 0 }} />
          </View>
          <Text style={[styles.navLabel, tab === 'home' && styles.navLabelActive]}>Home</Text>
        </Pressable>

        <Pressable style={styles.navItem} onPress={() => setTab('visitors')} hitSlop={8}>
          <View style={[styles.navIconWrap, tab === 'visitors' && styles.navIconWrapActive]}>
            <IconButton icon="account-group-outline" size={22} iconColor={tab === 'visitors' ? ACCENT : INK_FAINT} style={{ margin: 0 }} />
            {pendingCount > 0 && tab !== 'visitors' && (
              <View style={styles.navBadge}><Text style={styles.navBadgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text></View>
            )}
          </View>
          <Text style={[styles.navLabel, tab === 'visitors' && styles.navLabelActive]}>Visitors</Text>
        </Pressable>

        <Pressable style={styles.navItem} onPress={() => setTab('tickets')} hitSlop={8}>
          <View style={[styles.navIconWrap, tab === 'tickets' && styles.navIconWrapActive]}>
            <IconButton icon="headset" size={22} iconColor={tab === 'tickets' ? ACCENT : INK_FAINT} style={{ margin: 0 }} />
            {openTicketsCount > 0 && tab !== 'tickets' && (
              <View style={styles.navBadge}><Text style={styles.navBadgeText}>{openTicketsCount > 9 ? '9+' : openTicketsCount}</Text></View>
            )}
          </View>
          <Text style={[styles.navLabel, tab === 'tickets' && styles.navLabelActive]}>Tickets</Text>
        </Pressable>

        <Pressable style={styles.navItem} onPress={() => setMoreOpen(true)} hitSlop={8}>
          <View style={[styles.navIconWrap, isMoreActiveTab && styles.navIconWrapActive]}>
            <IconButton icon="dots-grid" size={22} iconColor={isMoreActiveTab ? ACCENT : INK_FAINT} style={{ margin: 0 }} />
            {pendingResidents.length > 0 && !isMoreActiveTab && (
              <View style={styles.navBadge}><Text style={styles.navBadgeText}>{pendingResidents.length > 9 ? '9+' : pendingResidents.length}</Text></View>
            )}
          </View>
          <Text style={[styles.navLabel, isMoreActiveTab && styles.navLabelActive]}>More</Text>
        </Pressable>

        <Pressable style={styles.navItem} onPress={() => setProfileOpen(true)} hitSlop={8}>
          <View style={styles.navIconWrap}>
            <View style={styles.navAvatar}>
              <Text style={styles.navAvatarInitial}>{myProfile?.full_name?.[0]?.toUpperCase() ?? 'A'}</Text>
            </View>
          </View>
          <Text style={styles.navLabel}>Profile</Text>
        </Pressable>
      </View>

      {/* VISITOR DETAIL MODAL */}
      <Modal visible={!!selectedVisitor} transparent animationType="fade" onRequestClose={() => setSelectedVisitor(null)}>
        <Pressable style={styles.sheetBackdropCenter} onPress={() => setSelectedVisitor(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {selectedVisitor && (
              <>
                <View style={styles.modalTopHeader}>
                  <Text style={styles.modalTitle}>Visitor Details</Text>
                  <IconButton icon="close" size={22} iconColor={INK} onPress={() => setSelectedVisitor(null)} style={{ margin: 0 }} />
                </View>

                <View style={{ alignItems: 'center', marginVertical: 8 }}>
                  {selectedVisitor.visitors?.photo_url ? (
                    <Image source={{ uri: selectedVisitor.visitors.photo_url }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                  ) : (
                    <Avatar.Text size={80} label={selectedVisitor.visitors?.name?.[0]?.toUpperCase() ?? '?'} style={{ backgroundColor: ACCENT }} />
                  )}
                  <Text style={[styles.visitorName, { fontSize: 18, marginTop: 10 }]}>{selectedVisitor.visitors?.name}</Text>
                  <Text style={styles.meta}>{selectedVisitor.visitors?.visitor_type}</Text>
                </View>

                <Divider style={{ marginVertical: 12, backgroundColor: BORDER }} />

                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Flat Destination</Text>
                  <Text style={styles.modalValue}>Flat {selectedVisitor.flats?.flat_number ?? '—'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Status</Text>
                  <Text style={[styles.modalValue, { color: selectedVisitor.resolution === 'left_at_gate' ? TEAL : statusColor(selectedVisitor.status) }]}>
                    {selectedVisitor.resolution === 'left_at_gate' ? 'Left at Gate' : selectedVisitor.pre_approved ? 'Pre-Approved' : selectedVisitor.status.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Logged Time</Text>
                  <Text style={styles.modalValue}>{new Date(selectedVisitor.created_at).toLocaleString()}</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                  {selectedVisitor.status !== 'approved' && (
                    <Button mode="contained" buttonColor={SUCCESS} textColor="#fff" style={{ flex: 1, borderRadius: 12 }} onPress={() => overrideVisitorStatus(selectedVisitor.id, 'approved')}>
                      Approve
                    </Button>
                  )}
                  {selectedVisitor.status !== 'denied' && (
                    <Button mode="contained" buttonColor={DANGER} textColor="#fff" style={{ flex: 1, borderRadius: 12 }} onPress={() => overrideVisitorStatus(selectedVisitor.id, 'denied')}>
                      Deny
                    </Button>
                  )}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* NOTICE DETAIL MODAL */}
      <Modal visible={!!selectedNotice} transparent animationType="fade" onRequestClose={() => setSelectedNotice(null)}>
        <Pressable style={styles.sheetBackdropCenter} onPress={() => setSelectedNotice(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {selectedNotice && (
              <>
                <View style={styles.modalTopHeader}>
                  <Text style={styles.modalTitle}>Society Announcement</Text>
                  <IconButton icon="close" size={22} iconColor={INK} onPress={() => setSelectedNotice(null)} style={{ margin: 0 }} />
                </View>

                <Text style={[styles.visitorName, { fontSize: 18, marginTop: 8 }]}>{selectedNotice.title}</Text>
                <Text style={styles.metaFaint}>Posted: {new Date(selectedNotice.created_at).toLocaleString()}</Text>

                <Divider style={{ marginVertical: 12, backgroundColor: BORDER }} />

                <ScrollView style={{ maxHeight: 200 }}>
                  <Text style={[styles.noticeBody, { fontSize: 14, lineHeight: 22 }]}>{selectedNotice.body}</Text>
                </ScrollView>

                <Button mode="contained" buttonColor={DANGER} textColor="#fff" style={{ marginTop: 16, borderRadius: 12 }} onPress={() => deleteNotice(selectedNotice.id)}>
                  Delete Announcement
                </Button>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* STAFF DETAIL MODAL */}
      <Modal visible={!!selectedStaff} transparent animationType="fade" onRequestClose={() => setSelectedStaff(null)}>
        <Pressable style={styles.sheetBackdropCenter} onPress={() => setSelectedStaff(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {selectedStaff && (
              <>
                <View style={styles.modalTopHeader}>
                  <Text style={styles.modalTitle}>Staff Profile</Text>
                  <IconButton icon="close" size={22} iconColor={INK} onPress={() => setSelectedStaff(null)} style={{ margin: 0 }} />
                </View>

                <View style={{ alignItems: 'center', marginVertical: 8 }}>
                  {selectedStaff.photo_url ? (
                    <Image source={{ uri: selectedStaff.photo_url }} style={{ width: 84, height: 84, borderRadius: 42 }} />
                  ) : (
                    <Avatar.Text size={84} label={selectedStaff.name[0]?.toUpperCase() ?? 'S'} style={{ backgroundColor: ACCENT }} />
                  )}
                  <Text style={[styles.visitorName, { fontSize: 18, marginTop: 10 }]}>{selectedStaff.name}</Text>
                  <Chip compact textStyle={{ color: ACCENT, fontWeight: '700', fontSize: 12 }} style={{ backgroundColor: ACCENT_SOFT, marginTop: 6 }}>
                    {selectedStaff.service_type}
                  </Chip>
                </View>

                <Divider style={{ marginVertical: 14, backgroundColor: BORDER }} />

                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Contact Phone</Text>
                  <Text style={styles.modalValue}>{selectedStaff.phone ?? 'Not Provided'}</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                  <Button mode="outlined" textColor={DANGER} style={{ flex: 1, borderColor: DANGER, borderRadius: 12 }} onPress={() => deleteStaff(selectedStaff.id)}>
                    Delete
                  </Button>
                  {selectedStaff.phone && (
                    <Button mode="contained" buttonColor={SUCCESS} textColor="#fff" icon="phone" style={{ flex: 1.2, borderRadius: 12 }} onPress={() => callPhone(selectedStaff.phone)}>
                      Call Staff
                    </Button>
                  )}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* TICKET DETAIL MODAL */}
      <Modal visible={!!selectedTicket} transparent animationType="fade" onRequestClose={() => setSelectedTicket(null)}>
        <Pressable style={styles.sheetBackdropCenter} onPress={() => setSelectedTicket(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {selectedTicket && (
              <>
                <View style={styles.modalTopHeader}>
                  <Text style={styles.modalTitle}>Ticket Inspection</Text>
                  <IconButton icon="close" size={22} iconColor={INK} onPress={() => setSelectedTicket(null)} style={{ margin: 0 }} />
                </View>

                <View style={styles.row}>
                  <Text style={[styles.visitorName, { fontSize: 18 }]}>Category: {selectedTicket.category}</Text>
                  <Chip compact textStyle={{ color: ticketStatusColor(selectedTicket.status), fontWeight: '700', fontSize: 12 }} style={{ backgroundColor: ticketStatusBg(selectedTicket.status) }}>
                    {selectedTicket.status.replace('_', ' ')}
                  </Chip>
                </View>

                <Text style={styles.metaFaint}>Created: {new Date(selectedTicket.created_at).toLocaleString()}</Text>

                <Divider style={{ marginVertical: 12, backgroundColor: BORDER }} />

                <Text style={styles.fieldLabel}>Resident Issue Description:</Text>
                <ScrollView style={{ maxHeight: 180 }}>
                  <Text style={[styles.noticeBody, { fontSize: 14 }]}>{selectedTicket.description}</Text>
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                  {selectedTicket.status !== 'in_progress' && (
                    <Button mode="outlined" textColor={ACCENT} style={{ flex: 1, borderColor: ACCENT, borderRadius: 12 }} onPress={() => updateTicketStatus(selectedTicket.id, 'in_progress')}>
                      In Progress
                    </Button>
                  )}
                  {selectedTicket.status !== 'resolved' && (
                    <Button mode="contained" buttonColor={ACCENT} textColor="#fff" style={{ flex: 1, borderRadius: 12 }} onPress={() => updateTicketStatus(selectedTicket.id, 'resolved')}>
                      Resolve
                    </Button>
                  )}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* RESIDENT PROFILE INSPECTION MODAL */}
      <Modal visible={!!selectedResident} transparent animationType="fade" onRequestClose={() => setSelectedResident(null)}>
        <Pressable style={styles.sheetBackdropCenter} onPress={() => setSelectedResident(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {selectedResident && (
              <>
                <View style={styles.modalTopHeader}>
                  <Text style={styles.modalTitle}>Resident Account Details</Text>
                  <IconButton icon="close" size={22} iconColor={INK} onPress={() => setSelectedResident(null)} style={{ margin: 0 }} />
                </View>

                <View style={{ alignItems: 'center', marginVertical: 8 }}>
                  <Avatar.Text size={72} label={selectedResident.full_name?.[0]?.toUpperCase() ?? '?'} style={{ backgroundColor: ACCENT }} />
                  <Text style={[styles.visitorName, { fontSize: 18, marginTop: 10 }]}>{selectedResident.full_name}</Text>
                  <Chip compact textStyle={{ color: selectedResident.approved ? SUCCESS : WARN, fontWeight: '700', fontSize: 12 }} style={{ backgroundColor: selectedResident.approved ? SUCCESS_BG : WARN_BG, marginTop: 6 }}>
                    {selectedResident.approved ? 'Approved Access' : 'Pending Verification'}
                  </Chip>
                </View>

                <Divider style={{ marginVertical: 12, backgroundColor: BORDER }} />

                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Role / Type</Text>
                  <Text style={styles.modalValue}>{selectedResident.role}</Text>
                </View>

                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Flat Assigned</Text>
                  <Text style={styles.modalValue}>Flat {flatNumberFor(selectedResident.flat_id)}</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                  {!selectedResident.approved ? (
                    <>
                      <Button mode="outlined" textColor={DANGER} style={{ flex: 1, borderColor: DANGER, borderRadius: 12 }} onPress={() => rejectResident(selectedResident.id)}>
                        Reject
                      </Button>
                      <Button mode="contained" buttonColor={ACCENT} textColor="#fff" style={{ flex: 1, borderRadius: 12 }} onPress={() => approveResident(selectedResident.id)}>
                        Approve
                      </Button>
                    </>
                  ) : (
                    <Button mode="outlined" textColor={DANGER} style={{ flex: 1, borderColor: DANGER, borderRadius: 12 }} onPress={() => deleteResident(selectedResident.id, selectedResident.full_name)}>
                      Remove Access
                    </Button>
                  )}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* MORE MENU BOTTOM SHEET */}
      <Modal visible={moreOpen} transparent animationType="slide" onRequestClose={() => setMoreOpen(false)}>
        <Pressable style={styles.sheetBackdropBottom} onPress={() => setMoreOpen(false)}>
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>More</Text>
            <Text style={styles.sheetSubtitle}>Manage every part of the society</Text>
            <View style={styles.moreGrid}>
              {MORE_TABS.map((t) => (
                <Pressable key={t.key} style={styles.moreGridTile} onPress={() => goToTab(t.key)}>
                  <Avatar.Icon size={48} icon={t.icon} style={{ backgroundColor: ACCENT_SOFT }} color={ACCENT} />
                  <Text style={styles.moreGridLabel}>{t.label}</Text>
                  {t.key === 'society' && pendingResidents.length > 0 && (
                    <View style={styles.moreGridBadge}><Text style={styles.moreGridBadgeText}>{pendingResidents.length}</Text></View>
                  )}
                  {t.key === 'dues' && pendingDues.length > 0 && (
                    <View style={styles.moreGridBadge}><Text style={styles.moreGridBadgeText}>{pendingDues.length}</Text></View>
                  )}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ADMIN PROFILE MODAL */}
      <Modal visible={profileOpen} animationType="slide" onRequestClose={() => setProfileOpen(false)}>
        <View style={styles.profileScreen}>
          <View style={[styles.profileTopBar, { paddingTop: insets.top + 12 }]}>
            <IconButton icon="arrow-left" size={24} iconColor={INK} onPress={() => setProfileOpen(false)} style={{ margin: 0 }} />
            <Text style={styles.profileTopBarTitle}>Profile</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <View style={styles.profileIdCard}>
              <View style={styles.profileBigAvatar}>
                <Text style={styles.profileBigAvatarInitial}>{myProfile?.full_name?.[0]?.toUpperCase() ?? 'A'}</Text>
              </View>
              <Text style={styles.profileBigName}>{myProfile?.full_name ?? 'Admin'}</Text>
              <View style={styles.profileRoleChip}>
                <IconButton icon="shield-check-outline" size={16} iconColor={ACCENT} style={{ margin: 0, marginRight: -4 }} />
                <Text style={styles.profileRoleChipText}>Administrator</Text>
              </View>
              {myProfile?.phone ? (
                <View style={styles.profilePhoneRow}>
                  <IconButton icon="phone-outline" size={16} iconColor={INK_MUTED} style={{ margin: 0 }} />
                  <Text style={styles.profilePhoneText}>{myProfile.phone}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.profileSectionLabel}>Society Summary</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statTile}>
                <Text style={styles.statTileNum}>{pendingCount}</Text>
                <Text style={styles.statTileLabel}>Pending Visitors</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statTileNum}>{openTicketsCount}</Text>
                <Text style={styles.statTileLabel}>Open Tickets</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statTileNum}>{pendingResidents.length}</Text>
                <Text style={styles.statTileLabel}>Approvals Due</Text>
              </View>
            </View>

            <Pressable style={styles.logoutButton} onPress={() => { setProfileOpen(false); handleLogout(); }}>
              <IconButton icon="logout" size={20} iconColor={DANGER} style={{ margin: 0 }} />
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingBottom: 18,
    backgroundColor: CARD_BG, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  greeting: { fontSize: 13, color: INK_MUTED, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '800', color: INK, marginTop: 2 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: ACCENT_SOFT, borderRadius: 20, paddingLeft: 6, paddingRight: 12, paddingVertical: 3, marginTop: 8,
  },
  roleBadgeText: { fontSize: 12, fontWeight: '700', color: ACCENT },

  container: { padding: 20, paddingBottom: 12 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },

  statCard: {
    flex: 1, borderRadius: 16, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, alignItems: 'center', paddingVertical: 14,
    shadowColor: '#151329', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  statNum: { fontSize: 20, fontWeight: '800', color: INK },
  statLabel: { fontSize: 11, color: INK_MUTED, marginTop: 4, textAlign: 'center', fontWeight: '600' },
  homeSectionLabel: { fontSize: 13, fontWeight: '700', color: INK_MUTED, marginBottom: 10, letterSpacing: 0.3, textTransform: 'uppercase' },
  quickActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  quickActionTile: { flex: 1, alignItems: 'center', gap: 8 },
  quickActionLabel: { fontSize: 11, color: INK_MUTED, fontWeight: '600', textAlign: 'center' },
  viewAllLink: { fontSize: 13, fontWeight: '700', color: ACCENT },

  tabChip: { backgroundColor: INPUT_BG },
  tabChipSelected: { backgroundColor: ACCENT },
  sectionCard: {
    marginBottom: 24, borderRadius: 20, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, padding: 20,
    shadowColor: '#151329', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 18, elevation: 2,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  sectionIcon: { backgroundColor: ACCENT_SOFT },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: INK, flex: 1 },
  countBadge: { fontSize: 12, fontWeight: '700', color: '#fff', backgroundColor: ACCENT, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 12, overflow: 'hidden' },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: INK, marginBottom: 6 },
  inputWrap: { backgroundColor: INPUT_BG, borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent', marginBottom: 14 },
  input: { backgroundColor: 'transparent' },
  segmented: { marginBottom: 14 },
  submitButton: { borderRadius: 14, marginTop: 4 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  filterChip: { marginBottom: 4, backgroundColor: INPUT_BG, borderWidth: 1, borderColor: 'transparent' },
  chipSelected: { backgroundColor: ACCENT_SOFT, borderColor: ACCENT },
  chipText: { color: INK_MUTED },
  chipTextSelected: { color: INK, fontWeight: '600' },

  card: {
    borderRadius: 18, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
    shadowColor: '#151329', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', padding: 12, gap: 4 },
  pendingCard: { borderWidth: 1.5, borderColor: WARN, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowWithImage: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  visitorName: { fontSize: 16, fontWeight: '700', color: INK },
  meta: { color: INK_MUTED, marginTop: 3, fontSize: 13 },
  metaFaint: { color: INK_FAINT, marginTop: 4, fontSize: 12 },
  noticeBody: { color: INK_MUTED, marginTop: 4, lineHeight: 20 },
  thumb: { width: 52, height: 52, borderRadius: 26 },
  thumbPlaceholder: { width: 52, height: 52, borderRadius: 26, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
  thumbInitial: { color: 'white', fontSize: 19, fontWeight: '700' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  previewImage: { width: 60, height: 60, borderRadius: 12 },
  photoPlaceholder: { width: 60, height: 60, borderRadius: 12, backgroundColor: INPUT_BG, borderWidth: 1, borderColor: BORDER, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  photoButton: { flex: 1, borderColor: ACCENT },
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  empty: { color: INK_FAINT, fontSize: 14 },
  totalDueCard: { backgroundColor: ACCENT },
  totalDueLabel: { color: '#fff', opacity: 0.85, fontSize: 13, fontWeight: '600' },
  totalDueAmount: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 4 },
  duesSnapshotCard: { marginBottom: 20 },
  duesSnapshotRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16 },
  duesSnapshotHalf: { flex: 1 },
  duesSnapshotLabel: { fontSize: 12, color: INK_MUTED, fontWeight: '600' },
  duesSnapshotAmount: { fontSize: 20, fontWeight: '800', color: INK, marginTop: 4 },
  duesSnapshotSub: { fontSize: 11, color: INK_FAINT, marginTop: 3 },
  duesSnapshotDivider: { width: 1, height: 40, backgroundColor: BORDER, marginHorizontal: 14 },

  staffCard: {
    borderRadius: 18, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
    shadowColor: '#151329', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  staffCardContent: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  staffImage: { width: 50, height: 50, borderRadius: 25 },
  staffAvatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
  staffAvatarInitial: { color: '#fff', fontSize: 20, fontWeight: '800' },
  staffNameText: { fontSize: 16, fontWeight: '700', color: INK },
  staffTagRow: { flexDirection: 'row', marginTop: 4, marginBottom: 2 },
  staffServiceBadge: { backgroundColor: ACCENT_SOFT, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  staffServiceText: { fontSize: 11, fontWeight: '700', color: ACCENT, textTransform: 'lowercase' },
  staffPhoneText: { fontSize: 12, color: INK_MUTED, marginTop: 2, fontWeight: '500' },
  staffCallIcon: { backgroundColor: SUCCESS, margin: 0, borderRadius: 20 },

  bottomNav: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', backgroundColor: CARD_BG, borderTopWidth: 1, borderTopColor: BORDER,
    paddingTop: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 12,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIconWrap: { width: 44, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  navIconWrapActive: { backgroundColor: ACCENT_SOFT },
  navBadge: { position: 'absolute', top: -2, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: DANGER, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: CARD_BG },
  navBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  navLabel: { fontSize: 11, color: INK_FAINT, fontWeight: '600', marginTop: 2 },
  navLabelActive: { color: ACCENT },
  navAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
  navAvatarInitial: { color: '#fff', fontSize: 12, fontWeight: '700' },

  sheetBackdropBottom: { flex: 1, backgroundColor: 'rgba(21,19,31,0.45)', justifyContent: 'flex-end' },
  sheetBackdropCenter: { flex: 1, backgroundColor: 'rgba(21,19,31,0.45)', justifyContent: 'center' },
  sheetCard: {
    backgroundColor: CARD_BG, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: BORDER, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 19, fontWeight: '800', color: INK },
  sheetSubtitle: { fontSize: 13, color: INK_MUTED, marginTop: 2, marginBottom: 18 },
  moreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  moreGridTile: { width: '30%', alignItems: 'center', gap: 8, paddingVertical: 10, position: 'relative' },
  moreGridLabel: { fontSize: 12, fontWeight: '600', color: INK, textAlign: 'center' },
  moreGridBadge: { position: 'absolute', top: 4, right: '18%', backgroundColor: DANGER, borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  moreGridBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  modalCard: {
    backgroundColor: CARD_BG, borderRadius: 24, marginHorizontal: 20, padding: 20, alignSelf: 'center', width: '90%',
  },
  modalTopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: INK },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  modalLabel: { fontSize: 13, color: INK_MUTED, fontWeight: '500' },
  modalValue: { fontSize: 13, color: INK, fontWeight: '700' },

  profileScreen: { flex: 1, backgroundColor: PAGE_BG },
  profileTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingBottom: 12, backgroundColor: CARD_BG, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  profileTopBarTitle: { fontSize: 17, fontWeight: '700', color: INK },

  profileIdCard: {
    backgroundColor: CARD_BG, borderRadius: 22, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, marginBottom: 24,
    shadowColor: '#151329', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 18, elevation: 2,
  },
  profileBigAvatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  profileBigAvatarInitial: { color: '#fff', fontSize: 30, fontWeight: '800' },
  profileBigName: { fontSize: 20, fontWeight: '800', color: INK },
  profileRoleChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: ACCENT_SOFT, borderRadius: 20, paddingLeft: 8, paddingRight: 14, paddingVertical: 5, marginTop: 10,
  },
  profileRoleChipText: { fontSize: 13, fontWeight: '700', color: ACCENT },
  profilePhoneRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  profilePhoneText: { fontSize: 14, color: INK_MUTED, fontWeight: '600' },

  profileSectionLabel: { fontSize: 13, fontWeight: '700', color: INK_MUTED, marginBottom: 10, marginLeft: 4, letterSpacing: 0.3, textTransform: 'uppercase' },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  statTile: {
    flex: 1, backgroundColor: CARD_BG, borderRadius: 16, borderWidth: 1, borderColor: BORDER, alignItems: 'center', paddingVertical: 16,
  },
  statTileNum: { fontSize: 20, fontWeight: '800', color: INK },
  statTileLabel: { fontSize: 11, color: INK_MUTED, marginTop: 4, textAlign: 'center', fontWeight: '600' },

  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: DANGER_BG, borderRadius: 16, paddingVertical: 14,
  },
  logoutButtonText: { color: DANGER, fontSize: 15, fontWeight: '700' },
});