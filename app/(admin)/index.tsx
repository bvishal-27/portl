import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, Alert, Image } from 'react-native';
import { Button, Chip, TextInput, SegmentedButtons, Avatar, Divider, IconButton } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { router } from 'expo-router';

// ---- Inline theme: light, minimal, premium (matches Login / Signup / Guard / Resident) ----
const INK = '#15131F';
const INK_MUTED = '#6B6878';
const INK_FAINT = '#A6A3B3';
const ACCENT = '#4F3FE0';
const ACCENT_SOFT = '#EFECFD';
const GOLD = '#C9922B';
const PAGE_BG = '#FAFAFC';
const CARD_BG = '#FFFFFF';
const BORDER = '#ECEAF2';
const INPUT_BG = '#F5F4F9';
const SUCCESS = '#1E9E5A';
const SUCCESS_BG = '#E9F8EF';
const DANGER = '#C23B3B';
const DANGER_BG = '#FBEAEA';
const WARN = '#C9922B';
const WARN_BG = '#FBF3E4';

type VisitorRequest = {
  id: string;
  status: string;
  pre_approved: boolean;
  created_at: string;
  visitors: { name: string; visitor_type: string; photo_url: string | null } | null;
  flats: { flat_number: string } | null;
};
type Ticket = { id: string; category: string; description: string; status: string; created_at: string };
type Amenity = { id: string; name: string; capacity: number; slots: string[] };
type Booking = { id: string; amenity_id: string; booking_date: string; slot: string };
type Tower = { id: string; name: string };
type Flat = { id: string; tower_id: string; flat_number: string };
type Profile = { id: string; full_name: string; role: string; flat_id: string | null; approved: boolean };
type Staff = { id: string; name: string; service_type: string; phone: string | null; photo_url: string | null };

const MAIN_TABS = [
  { key: 'visitors', label: 'Visitors', icon: 'account-group' },
  { key: 'notices', label: 'Notices', icon: 'bullhorn' },
  { key: 'polls', label: 'Polls', icon: 'poll' },
  { key: 'tickets', label: 'Tickets', icon: 'headset' },
  { key: 'amenities', label: 'Amenities', icon: 'calendar-check' },
  { key: 'society', label: 'Society', icon: 'domain' },
];

export default function AdminHome() {
  const [requests, setRequests] = useState<VisitorRequest[]>([]);
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState('visitors');
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearSession();
    router.replace('/(auth)/login');
  };

  const fetchRequests = async () => {
    const { data } = await supabase.from('visitor_requests').select('id, status, pre_approved, created_at, visitors(name, visitor_type, photo_url), flats(flat_number)').order('created_at', { ascending: false }).limit(50);
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

  useEffect(() => {
    fetchRequests(); fetchTickets(); fetchAmenities(); fetchBookings();
    fetchTowers(); fetchFlats(); fetchResidents(); fetchStaff(); fetchAllNotices(); fetchAllPolls();

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
      if (error) Alert.alert('Error', error.message);
      else fetchFlats();
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
    else fetchResidents();
  };

  const rejectResident = async (id: string) => {
    Alert.alert('Reject request', 'This will permanently delete this signup request. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('profiles').delete().eq('id', id);
          if (error) Alert.alert('Error', error.message);
          else fetchResidents();
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
      else fetchResidents();
    }},
  ]);
};

const deleteVisitorRequest = async (id: string, name: string) => {
  Alert.alert('Delete Visitor Record', `Remove this visitor log entry for ${name}?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      const { error } = await supabase.from('visitor_requests').delete().eq('id', id);
      if (error) Alert.alert('Error', error.message);
    }},
  ]);
};

const overrideVisitorStatus = async (id: string, status: string) => {
  const { error } = await supabase.from('visitor_requests').update({ status }).eq('id', id);
  if (error) Alert.alert('Error', error.message);
};

const reassignResidentFlat = async (residentId: string, newFlatId: string) => {
  const { error } = await supabase.from('profiles').update({ flat_id: newFlatId }).eq('id', residentId);
  if (error) Alert.alert('Error', error.message);
  else {
    Alert.alert('Updated', 'Resident reassigned to new flat');
    fetchResidents();
  }
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
  const towerNameFor = (id: string) => towers.find((t) => t.id === id)?.name ?? 'Unknown';
  const flatNumberFor = (id: string | null) => flats.find((f) => f.id === id)?.flat_number ?? '—';
  const pendingResidents = residents.filter((r) => !r.approved);
  const approvedResidents = residents.filter((r) => r.approved);

  const inputTheme = { colors: { onSurfaceVariant: INK_MUTED, background: 'transparent', primary: ACCENT } };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>PORTL</Text>
          <Text style={styles.title}>Admin</Text>
        </View>
        <IconButton icon="logout" size={22} iconColor={ACCENT} onPress={handleLogout} style={styles.logoutBtn} />
      </View>

      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {MAIN_TABS.map((t) => (
            <Chip
              key={t.key}
              icon={t.icon}
              selected={tab === t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tabChip, tab === t.key && styles.tabChipSelected]}
              textStyle={tab === t.key ? { color: '#fff', fontWeight: '600' } : { color: INK_MUTED }}
            >
              {t.label}{t.key === 'society' && pendingResidents.length > 0 ? ` (${pendingResidents.length})` : ''}
            </Chip>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
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
                <Text style={styles.empty}>No visitor records</Text>
              </View>
            )}
           <FlatList data={filtered} keyExtractor={(i) => i.id} scrollEnabled={false} ItemSeparatorComponent={() => <View style={{ height: 12 }} />} renderItem={({ item }) => (
  <View style={styles.card}>
    <View style={{ padding: 16 }}>
      <View style={styles.rowWithImage}>
        {item.visitors?.photo_url ? (
          <Image source={{ uri: item.visitors.photo_url }} style={styles.thumb} />
        ) : (
          <View style={styles.thumbPlaceholder}><Text style={styles.thumbInitial}>{item.visitors?.name?.[0]?.toUpperCase() ?? '?'}</Text></View>
        )}
        <View style={{ flex: 1 }}>
          <View style={styles.row}>
            <Text style={styles.visitorName} numberOfLines={1}>{item.visitors?.name}</Text>
            <Chip compact textStyle={{ color: statusColor(item.status), fontWeight: '600', fontSize: 11 }} style={{ backgroundColor: statusBg(item.status) }}>
              {item.pre_approved ? 'pre-approved' : item.status}
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
  </View>
)} />
          </>
        )}

        {tab === 'notices' && (
  <View>
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeaderRow}>
        <Avatar.Icon size={30} icon="bullhorn" style={styles.sectionIcon} color={ACCENT} />
        <Text style={styles.sectionTitle}>Post a Notice</Text>
      </View>
      <View style={styles.inputWrap}><TextInput mode="flat" label="Title" value={noticeTitle} onChangeText={setNoticeTitle} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} /></View>
      <View style={styles.inputWrap}><TextInput mode="flat" label="Body" value={noticeBody} onChangeText={setNoticeBody} multiline numberOfLines={3} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} /></View>
      <Button mode="contained" onPress={handleCreateNotice} buttonColor={ACCENT} textColor="#fff" style={styles.submitButton} contentStyle={{ paddingVertical: 4 }}>Post Notice</Button>
    </View>
    <View style={styles.sectionHeaderRow}>
      <Avatar.Icon size={30} icon="format-list-bulleted" style={styles.sectionIcon} color={ACCENT} />
      <Text style={styles.sectionTitle}>Posted Notices ({allNotices.length})</Text>
    </View>
    {allNotices.map((n) => (
      <View key={n.id} style={[styles.card, { marginBottom: 12 }]}>
        <View style={{ padding: 16 }}>
          <Text style={styles.visitorName}>{n.title}</Text>
          <Text style={styles.meta}>{n.body}</Text>
          <Text style={styles.metaFaint}>{new Date(n.created_at).toLocaleString()}</Text>
        </View>
        <Divider style={{ backgroundColor: BORDER }} />
        <View style={styles.cardActions}><Button compact textColor={DANGER} onPress={() => deleteNotice(n.id)}>Delete</Button></View>
      </View>
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
      <View style={styles.inputWrap}><TextInput mode="flat" label="Question" value={pollQuestion} onChangeText={setPollQuestion} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} /></View>
      <View style={styles.inputWrap}><TextInput mode="flat" label="Option 1" value={pollOption1} onChangeText={setPollOption1} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} /></View>
      <View style={styles.inputWrap}><TextInput mode="flat" label="Option 2" value={pollOption2} onChangeText={setPollOption2} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} /></View>
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
              <Text style={styles.sectionTitle}>All Tickets</Text>
            </View>
            {tickets.length === 0 && <Text style={styles.empty}>No tickets raised yet</Text>}
            <FlatList data={tickets} keyExtractor={(i) => i.id} scrollEnabled={false} ItemSeparatorComponent={() => <View style={{ height: 12 }} />} renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={{ padding: 16 }}>
                  <View style={styles.row}>
                    <Text style={styles.visitorName}>{item.category}</Text>
                    <Chip compact textStyle={{ color: ticketStatusColor(item.status), fontWeight: '600', fontSize: 11 }} style={{ backgroundColor: ticketStatusBg(item.status) }}>{item.status.replace('_', ' ')}</Chip>
                  </View>
                  <Text style={styles.meta}>{item.description}</Text>
                  <Text style={styles.metaFaint}>{new Date(item.created_at).toLocaleString()}</Text>
                </View>
                <Divider style={{ backgroundColor: BORDER }} />
                <View style={styles.cardActions}>
                  {item.status !== 'in_progress' && <Button compact textColor={ACCENT} onPress={() => updateTicketStatus(item.id, 'in_progress')}>In Progress</Button>}
                  {item.status !== 'resolved' && <Button compact mode="contained" buttonColor={ACCENT} textColor="#fff" onPress={() => updateTicketStatus(item.id, 'resolved')}>Resolve</Button>}
                </View>
              </View>
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
              <View style={styles.inputWrap}><TextInput mode="flat" label="Amenity name" value={amenityName} onChangeText={setAmenityName} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} /></View>
              <View style={styles.inputWrap}><TextInput mode="flat" label="Capacity per slot" value={amenityCapacity} onChangeText={setAmenityCapacity} keyboardType="numeric" style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} /></View>
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
                <View style={styles.inputWrap}><TextInput mode="flat" label="Tower name (e.g. Tower B)" value={towerName} onChangeText={setTowerName} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} /></View>
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
                <View style={styles.inputWrap}><TextInput mode="flat" label="Flat number" value={flatNumber} onChangeText={setFlatNumber} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} /></View>
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
                  <View key={r.id} style={[styles.card, styles.pendingCard]}>
                    <View style={{ padding: 16 }}>
                      <View style={styles.rowWithImage}>
                        <View style={[styles.thumbPlaceholder, { backgroundColor: WARN }]}><Text style={styles.thumbInitial}>{r.full_name?.[0]?.toUpperCase() ?? '?'}</Text></View>
                        <View>
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
                  </View>
                ))}

                <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
                  <Avatar.Icon size={30} icon="account-group" style={styles.sectionIcon} color={ACCENT} />
                  <Text style={styles.sectionTitle}>All Residents ({approvedResidents.length})</Text>
                </View>
                {approvedResidents.map((r) => (
  <View key={r.id} style={[styles.card, { marginBottom: 12 }]}>
    <View style={{ padding: 16 }}>
      <View style={styles.rowWithImage}>
        <View style={styles.thumbPlaceholder}><Text style={styles.thumbInitial}>{r.full_name?.[0]?.toUpperCase() ?? '?'}</Text></View>
        <View>
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
  </View>
))}
              </View>
            )}

            {societySubTab === 'staff' && (
              <View>
                <View style={styles.sectionCard}>
                  <View style={styles.inputWrap}><TextInput mode="flat" label="Staff/service name" value={staffName} onChangeText={setStaffName} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} /></View>
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
                  <View style={styles.inputWrap}><TextInput mode="flat" label="Phone" value={staffPhone} onChangeText={setStaffPhone} keyboardType="phone-pad" style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} /></View>
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
                  <View key={s.id} style={[styles.card, { marginBottom: 12 }]}>
                    <View style={{ padding: 16 }}>
                      <View style={styles.rowWithImage}>
                        {s.photo_url ? (
                          <Image source={{ uri: s.photo_url }} style={styles.thumbSmall} />
                        ) : (
                          <View style={styles.thumbPlaceholderSmall}><Text style={styles.thumbInitialSmall}>{s.name[0]?.toUpperCase()}</Text></View>
                        )}
                        <View>
                          <Text style={styles.visitorName}>{s.name}</Text>
                          <Text style={styles.meta}>{s.service_type}{s.phone ? ` · ${s.phone}` : ''}</Text>
                        </View>
                      </View>
                    </View>
                    <Divider style={{ backgroundColor: BORDER }} />
                    <View style={styles.cardActions}><Button compact textColor={DANGER} onPress={() => deleteStaff(s.id)}>Remove</Button></View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAGE_BG },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 14, backgroundColor: CARD_BG, borderBottomWidth: 1, borderBottomColor: BORDER },
  eyebrow: { fontSize: 11, fontWeight: '700', color: ACCENT, letterSpacing: 1.5, marginBottom: 2 },
  title: { fontSize: 22, fontWeight: '700', color: INK },
  logoutBtn: { backgroundColor: ACCENT_SOFT, margin: 0 },
  tabBar: { backgroundColor: CARD_BG, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  tabChip: { backgroundColor: INPUT_BG },
  tabChipSelected: { backgroundColor: ACCENT },
  container: { padding: 20, paddingBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, borderRadius: 16, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, alignItems: 'center', paddingVertical: 14 },
  statNum: { fontSize: 22, fontWeight: '700', color: INK },
  statLabel: { fontSize: 12, color: INK_MUTED, marginTop: 2 },
  sectionCard: {
    marginBottom: 24, borderRadius: 20, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, padding: 20,
    shadowColor: '#151329', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 18, elevation: 2,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  sectionIcon: { backgroundColor: ACCENT_SOFT },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: INK, flex: 1 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: INK_MUTED, marginBottom: 8 },
  inputWrap: { backgroundColor: INPUT_BG, borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent', marginBottom: 14 },
  input: { backgroundColor: 'transparent' },
  segmented: { marginBottom: 14 },
  submitButton: { borderRadius: 14, marginTop: 4 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  filterChip: { marginBottom: 4, backgroundColor: INPUT_BG, borderWidth: 1, borderColor: 'transparent' },
  chipSelected: { backgroundColor: ACCENT_SOFT, borderColor: ACCENT },
  chipText: { color: INK_MUTED },
  chipTextSelected: { color: INK, fontWeight: '600' },
  card: { borderRadius: 18, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', padding: 12, gap: 4 },
  pendingCard: { borderWidth: 1.5, borderColor: WARN, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowWithImage: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  visitorName: { fontSize: 16, fontWeight: '700', color: INK },
  meta: { color: INK_MUTED, marginTop: 3, fontSize: 13 },
  metaFaint: { color: INK_FAINT, marginTop: 4, fontSize: 12 },
  thumb: { width: 52, height: 52, borderRadius: 26 },
  thumbPlaceholder: { width: 52, height: 52, borderRadius: 26, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
  thumbInitial: { color: 'white', fontSize: 19, fontWeight: '700' },
  thumbSmall: { width: 44, height: 44, borderRadius: 22 },
  thumbPlaceholderSmall: { width: 44, height: 44, borderRadius: 22, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
  thumbInitialSmall: { color: 'white', fontSize: 16, fontWeight: '700' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  previewImage: { width: 60, height: 60, borderRadius: 12 },
  photoPlaceholder: { width: 60, height: 60, borderRadius: 12, backgroundColor: INPUT_BG, borderWidth: 1, borderColor: BORDER, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  photoButton: { flex: 1, borderColor: ACCENT },
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  empty: { color: INK_FAINT, fontSize: 14 },
});