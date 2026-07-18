import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, Alert, Image } from 'react-native';
import { Button, Card, Chip, TextInput, SegmentedButtons, Avatar, Divider, IconButton } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { router } from 'expo-router';

const PRIMARY = '#673AB7';

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

  useEffect(() => {
    fetchRequests(); fetchTickets(); fetchAmenities(); fetchBookings();
    fetchTowers(); fetchFlats(); fetchResidents(); fetchStaff();

    const channels = [
      supabase.channel('visitor_requests_admin').on('postgres_changes', { event: '*', schema: 'public', table: 'visitor_requests' }, fetchRequests).subscribe(),
      supabase.channel('tickets_admin').on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, fetchTickets).subscribe(),
      supabase.channel('bookings_admin').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchBookings).subscribe(),
      supabase.channel('amenities_admin').on('postgres_changes', { event: '*', schema: 'public', table: 'amenities' }, fetchAmenities).subscribe(),
      supabase.channel('towers_admin').on('postgres_changes', { event: '*', schema: 'public', table: 'towers' }, fetchTowers).subscribe(),
      supabase.channel('flats_admin').on('postgres_changes', { event: '*', schema: 'public', table: 'flats' }, fetchFlats).subscribe(),
      supabase.channel('staff_admin').on('postgres_changes', { event: '*', schema: 'public', table: 'staff_directory' }, fetchStaff).subscribe(),
      supabase.channel('profiles_admin').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchResidents).subscribe(),
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

  const today = new Date().toDateString();
  const todayCount = requests.filter((r) => new Date(r.created_at).toDateString() === today).length;
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter);
  const statusColor = (s: string) => (s === 'approved' ? '#2e7d32' : s === 'denied' ? '#c62828' : '#ef6c00');
  const statusBg = (s: string) => (s === 'approved' ? '#e8f5e9' : s === 'denied' ? '#fdecea' : '#fff3e0');
  const ticketStatusColor = (s: string) => (s === 'resolved' ? '#2e7d32' : s === 'in_progress' ? '#ef6c00' : '#616161');
  const ticketStatusBg = (s: string) => (s === 'resolved' ? '#e8f5e9' : s === 'in_progress' ? '#fff3e0' : '#f0f0f0');
  const amenityNameFor = (id: string) => amenities.find((a) => a.id === id)?.name ?? 'Unknown';
  const towerNameFor = (id: string) => towers.find((t) => t.id === id)?.name ?? 'Unknown';
  const flatNumberFor = (id: string | null) => flats.find((f) => f.id === id)?.flat_number ?? '—';
  const pendingResidents = residents.filter((r) => !r.approved);
  const approvedResidents = residents.filter((r) => r.approved);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>PORTL</Text>
          <Text style={styles.title}>Admin</Text>
        </View>
        <IconButton icon="logout" size={22} iconColor={PRIMARY} onPress={handleLogout} style={styles.logoutBtn} />
      </View>

      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {MAIN_TABS.map((t) => (
            <Chip
              key={t.key}
              icon={t.icon}
              selected={tab === t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tabChip, tab === t.key && { backgroundColor: PRIMARY }]}
              textStyle={tab === t.key ? { color: 'white', fontWeight: '600' } : { color: '#4a4560' }}
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
              <Card style={styles.statCard} mode="elevated"><Card.Content style={styles.statContent}><Text style={styles.statNum}>{todayCount}</Text><Text style={styles.statLabel}>Today</Text></Card.Content></Card>
              <Card style={styles.statCard} mode="elevated"><Card.Content style={styles.statContent}><Text style={[styles.statNum, { color: '#ef6c00' }]}>{pendingCount}</Text><Text style={styles.statLabel}>Pending</Text></Card.Content></Card>
              <Card style={styles.statCard} mode="elevated"><Card.Content style={styles.statContent}><Text style={styles.statNum}>{requests.length}</Text><Text style={styles.statLabel}>Total</Text></Card.Content></Card>
            </View>

            <View style={styles.sectionHeaderRow}>
              <Avatar.Icon size={30} icon="clipboard-list" style={styles.sectionIcon} color={PRIMARY} />
              <Text style={styles.sectionTitle}>Society Visitor Log</Text>
            </View>
            <View style={styles.filterRow}>
              {['all', 'pending', 'approved', 'denied'].map((f) => (
                <Chip key={f} selected={filter === f} onPress={() => setFilter(f)} style={styles.filterChip} selectedColor={PRIMARY}>{f}</Chip>
              ))}
            </View>
            {filtered.length === 0 && (
              <View style={styles.emptyState}>
                <Avatar.Icon size={44} icon="clipboard-search-outline" style={{ backgroundColor: '#ede7f6' }} color={PRIMARY} />
                <Text style={styles.empty}>No visitor records</Text>
              </View>
            )}
            <FlatList data={filtered} keyExtractor={(i) => i.id} scrollEnabled={false} ItemSeparatorComponent={() => <View style={{ height: 12 }} />} renderItem={({ item }) => (
              <Card style={styles.card} mode="elevated"><Card.Content>
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
              </Card.Content></Card>
            )} />
          </>
        )}

        {tab === 'notices' && (
          <Card style={styles.sectionCard} mode="elevated">
            <Card.Content>
              <View style={styles.sectionHeaderRow}>
                <Avatar.Icon size={30} icon="bullhorn" style={styles.sectionIcon} color={PRIMARY} />
                <Text style={styles.sectionTitle}>Post a Notice</Text>
              </View>
              <TextInput mode="outlined" label="Title" value={noticeTitle} onChangeText={setNoticeTitle} style={styles.input} outlineColor="#e2ddef" activeOutlineColor={PRIMARY} />
              <TextInput mode="outlined" label="Body" value={noticeBody} onChangeText={setNoticeBody} multiline numberOfLines={3} style={styles.input} outlineColor="#e2ddef" activeOutlineColor={PRIMARY} />
              <Button mode="contained" onPress={handleCreateNotice} buttonColor={PRIMARY} style={styles.submitButton} contentStyle={{ paddingVertical: 4 }}>Post Notice</Button>
            </Card.Content>
          </Card>
        )}

        {tab === 'polls' && (
          <Card style={styles.sectionCard} mode="elevated">
            <Card.Content>
              <View style={styles.sectionHeaderRow}>
                <Avatar.Icon size={30} icon="poll" style={styles.sectionIcon} color={PRIMARY} />
                <Text style={styles.sectionTitle}>Create a Poll</Text>
              </View>
              <TextInput mode="outlined" label="Question" value={pollQuestion} onChangeText={setPollQuestion} style={styles.input} outlineColor="#e2ddef" activeOutlineColor={PRIMARY} />
              <TextInput mode="outlined" label="Option 1" value={pollOption1} onChangeText={setPollOption1} style={styles.input} outlineColor="#e2ddef" activeOutlineColor={PRIMARY} />
              <TextInput mode="outlined" label="Option 2" value={pollOption2} onChangeText={setPollOption2} style={styles.input} outlineColor="#e2ddef" activeOutlineColor={PRIMARY} />
              <Button mode="contained" onPress={handleCreatePoll} buttonColor={PRIMARY} style={styles.submitButton} contentStyle={{ paddingVertical: 4 }}>Create Poll</Button>
            </Card.Content>
          </Card>
        )}

        {tab === 'tickets' && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Avatar.Icon size={30} icon="headset" style={styles.sectionIcon} color={PRIMARY} />
              <Text style={styles.sectionTitle}>All Tickets</Text>
            </View>
            {tickets.length === 0 && <Text style={styles.empty}>No tickets raised yet</Text>}
            <FlatList data={tickets} keyExtractor={(i) => i.id} scrollEnabled={false} ItemSeparatorComponent={() => <View style={{ height: 12 }} />} renderItem={({ item }) => (
              <Card style={styles.card} mode="elevated"><Card.Content>
                <View style={styles.row}>
                  <Text style={styles.visitorName}>{item.category}</Text>
                  <Chip compact textStyle={{ color: ticketStatusColor(item.status), fontWeight: '600', fontSize: 11 }} style={{ backgroundColor: ticketStatusBg(item.status) }}>{item.status.replace('_', ' ')}</Chip>
                </View>
                <Text style={styles.meta}>{item.description}</Text>
                <Text style={styles.metaFaint}>{new Date(item.created_at).toLocaleString()}</Text>
              </Card.Content>
                <Divider style={{ marginTop: 8 }} />
                <Card.Actions>
                  {item.status !== 'in_progress' && <Button compact textColor={PRIMARY} onPress={() => updateTicketStatus(item.id, 'in_progress')}>In Progress</Button>}
                  {item.status !== 'resolved' && <Button compact mode="contained" buttonColor={PRIMARY} onPress={() => updateTicketStatus(item.id, 'resolved')}>Resolve</Button>}
                </Card.Actions>
              </Card>
            )} />
          </>
        )}

        {tab === 'amenities' && (
          <>
            <Card style={styles.sectionCard} mode="elevated">
              <Card.Content>
                <View style={styles.sectionHeaderRow}>
                  <Avatar.Icon size={30} icon="calendar-plus" style={styles.sectionIcon} color={PRIMARY} />
                  <Text style={styles.sectionTitle}>Add Amenity</Text>
                </View>
                <TextInput mode="outlined" label="Amenity name" value={amenityName} onChangeText={setAmenityName} style={styles.input} outlineColor="#e2ddef" activeOutlineColor={PRIMARY} />
                <TextInput mode="outlined" label="Capacity per slot" value={amenityCapacity} onChangeText={setAmenityCapacity} keyboardType="numeric" style={styles.input} outlineColor="#e2ddef" activeOutlineColor={PRIMARY} />
                <Button mode="contained" onPress={handleCreateAmenity} buttonColor={PRIMARY} style={styles.submitButton} contentStyle={{ paddingVertical: 4 }}>Add Amenity</Button>
              </Card.Content>
            </Card>

            <View style={styles.sectionHeaderRow}>
              <Avatar.Icon size={30} icon="pool" style={styles.sectionIcon} color={PRIMARY} />
              <Text style={styles.sectionTitle}>Amenities ({amenities.length})</Text>
            </View>
            {amenities.map((a) => (
              <Card key={a.id} style={[styles.card, { marginBottom: 12 }]} mode="elevated"><Card.Content>
                <Text style={styles.visitorName}>{a.name}</Text>
                <Text style={styles.meta}>Capacity: {a.capacity} · Slots: {a.slots.length}</Text>
              </Card.Content></Card>
            ))}

            <View style={styles.sectionHeaderRow}>
              <Avatar.Icon size={30} icon="calendar-clock" style={styles.sectionIcon} color={PRIMARY} />
              <Text style={styles.sectionTitle}>All Bookings</Text>
            </View>
            {bookings.length === 0 && <Text style={styles.empty}>No bookings yet</Text>}
            <FlatList data={bookings} keyExtractor={(i) => i.id} scrollEnabled={false} ItemSeparatorComponent={() => <View style={{ height: 12 }} />} renderItem={({ item }) => (
              <Card style={styles.card} mode="elevated"><Card.Content>
                <Text style={styles.visitorName}>{amenityNameFor(item.amenity_id)}</Text>
                <Text style={styles.meta}>{item.booking_date} · {item.slot}</Text>
              </Card.Content>
                <Divider style={{ marginTop: 6 }} />
                <Card.Actions><Button compact textColor="#c62828" onPress={() => cancelBooking(item.id)}>Cancel</Button></Card.Actions>
              </Card>
            )} />
          </>
        )}

        {tab === 'society' && (
          <View>
            <View style={styles.filterRow}>
              {['towers', 'flats', 'residents', 'staff'].map((s) => (
                <Chip key={s} selected={societySubTab === s} onPress={() => setSocietySubTab(s)} style={styles.filterChip} selectedColor={PRIMARY}>
                  {s}{s === 'residents' && pendingResidents.length > 0 ? ` (${pendingResidents.length})` : ''}
                </Chip>
              ))}
            </View>

            {societySubTab === 'towers' && (
              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <TextInput mode="outlined" label="Tower name (e.g. Tower B)" value={towerName} onChangeText={setTowerName} style={styles.input} outlineColor="#e2ddef" activeOutlineColor={PRIMARY} />
                  <Button mode="contained" onPress={handleCreateTower} buttonColor={PRIMARY} style={styles.submitButton} contentStyle={{ paddingVertical: 4 }}>Add Tower</Button>
                </Card.Content>
              </Card>
            )}
            {societySubTab === 'towers' && towers.map((t) => (
              <Card key={t.id} style={[styles.card, { marginBottom: 12 }]} mode="elevated"><Card.Content><Text style={styles.visitorName}>{t.name}</Text></Card.Content></Card>
            ))}

            {societySubTab === 'flats' && (
              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.fieldLabel}>Select tower, then add flat</Text>
                  <View style={styles.filterRow}>
                    {towers.map((t) => (
                      <Chip key={t.id} selected={flatTowerId === t.id} onPress={() => setFlatTowerId(t.id)} style={styles.filterChip} selectedColor={PRIMARY}>{t.name}</Chip>
                    ))}
                  </View>
                  <TextInput mode="outlined" label="Flat number" value={flatNumber} onChangeText={setFlatNumber} style={styles.input} outlineColor="#e2ddef" activeOutlineColor={PRIMARY} />
                  <Button mode="contained" onPress={handleCreateFlat} buttonColor={PRIMARY} style={styles.submitButton} contentStyle={{ paddingVertical: 4 }}>Add Flat</Button>
                </Card.Content>
              </Card>
            )}
            {societySubTab === 'flats' && flats.map((f) => (
              <Card key={f.id} style={[styles.card, { marginBottom: 12 }]} mode="elevated"><Card.Content>
                <Text style={styles.visitorName}>Flat {f.flat_number}</Text>
                <Text style={styles.meta}>{towerNameFor(f.tower_id)}</Text>
              </Card.Content></Card>
            ))}

            {societySubTab === 'residents' && (
              <View>
                <View style={styles.sectionHeaderRow}>
                  <Avatar.Icon size={30} icon="account-alert" style={{ backgroundColor: '#fff3e0' }} color="#ef6c00" />
                  <Text style={styles.sectionTitle}>Pending Approval ({pendingResidents.length})</Text>
                </View>
                {pendingResidents.length === 0 && <Text style={styles.empty}>No pending requests</Text>}
                {pendingResidents.map((r) => (
                  <Card key={r.id} style={[styles.card, styles.pendingCard]} mode="elevated"><Card.Content>
                    <View style={styles.rowWithImage}>
                      <View style={[styles.thumbPlaceholder, { backgroundColor: '#ef6c00' }]}><Text style={styles.thumbInitial}>{r.full_name?.[0]?.toUpperCase() ?? '?'}</Text></View>
                      <View>
                        <Text style={styles.visitorName}>{r.full_name}</Text>
                        <Text style={styles.meta}>{r.role} · Flat {flatNumberFor(r.flat_id)}</Text>
                      </View>
                    </View>
                  </Card.Content>
                    <Divider style={{ marginTop: 8 }} />
                    <Card.Actions>
                      <Button compact textColor="#c62828" onPress={() => rejectResident(r.id)}>Reject</Button>
                      <Button compact mode="contained" buttonColor={PRIMARY} onPress={() => approveResident(r.id)}>Approve</Button>
                    </Card.Actions>
                  </Card>
                ))}

                <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
                  <Avatar.Icon size={30} icon="account-group" style={styles.sectionIcon} color={PRIMARY} />
                  <Text style={styles.sectionTitle}>All Residents ({approvedResidents.length})</Text>
                </View>
                {approvedResidents.map((r) => (
                  <Card key={r.id} style={[styles.card, { marginBottom: 12 }]} mode="elevated"><Card.Content>
                    <View style={styles.rowWithImage}>
                      <View style={styles.thumbPlaceholder}><Text style={styles.thumbInitial}>{r.full_name?.[0]?.toUpperCase() ?? '?'}</Text></View>
                      <View>
                        <Text style={styles.visitorName}>{r.full_name}</Text>
                        <Text style={styles.meta}>{r.role} · Flat {flatNumberFor(r.flat_id)}</Text>
                      </View>
                    </View>
                  </Card.Content></Card>
                ))}
              </View>
            )}

            {societySubTab === 'staff' && (
              <View>
                <Card style={styles.sectionCard} mode="elevated">
                  <Card.Content>
                    <TextInput mode="outlined" label="Staff/service name" value={staffName} onChangeText={setStaffName} style={styles.input} outlineColor="#e2ddef" activeOutlineColor={PRIMARY} />
                    <SegmentedButtons
                      value={staffType}
                      onValueChange={setStaffType}
                      style={styles.input}
                      theme={{ colors: { secondaryContainer: '#ede7f6', onSecondaryContainer: PRIMARY } }}
                      buttons={[
                        { value: 'plumber', label: 'Plumber' },
                        { value: 'electrician', label: 'Electrician' },
                        { value: 'milkman', label: 'Milkman' },
                        { value: 'other', label: 'Other' },
                      ]}
                    />
                    <TextInput mode="outlined" label="Phone" value={staffPhone} onChangeText={setStaffPhone} keyboardType="phone-pad" style={styles.input} outlineColor="#e2ddef" activeOutlineColor={PRIMARY} />
                    <View style={styles.photoRow}>
                      {staffPhotoUri ? (
                        <Image source={{ uri: staffPhotoUri }} style={styles.previewImage} />
                      ) : (
                        <View style={styles.photoPlaceholder}><Avatar.Icon size={32} icon="camera" style={{ backgroundColor: 'transparent' }} color="#b3a6d6" /></View>
                      )}
                      <Button mode="outlined" onPress={pickStaffPhoto} icon="camera" textColor={PRIMARY} style={styles.photoButton}>
                        {staffPhotoUri ? 'Retake' : 'Add Photo'}
                      </Button>
                    </View>
                    <Button mode="contained" onPress={handleCreateStaff} buttonColor={PRIMARY} style={styles.submitButton} contentStyle={{ paddingVertical: 4 }}>Add to Directory</Button>
                  </Card.Content>
                </Card>
                {staff.map((s) => (
                  <Card key={s.id} style={[styles.card, { marginBottom: 12 }]} mode="elevated"><Card.Content>
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
                  </Card.Content>
                    <Divider style={{ marginTop: 8 }} />
                    <Card.Actions><Button compact textColor="#c62828" onPress={() => deleteStaff(s.id)}>Remove</Button></Card.Actions>
                  </Card>
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
  screen: { flex: 1, backgroundColor: '#f7f5fb' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ece7f5' },
  eyebrow: { fontSize: 11, fontWeight: '700', color: PRIMARY, letterSpacing: 1.5, marginBottom: 2 },
  title: { fontSize: 22, fontWeight: '700', color: '#1e1b2e' },
  logoutBtn: { backgroundColor: '#f3effa', margin: 0 },
  tabBar: { backgroundColor: '#fff', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#ece7f5' },
  tabChip: { backgroundColor: '#f3effa' },
  container: { padding: 20, paddingBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, borderRadius: 14 },
  statContent: { alignItems: 'center', paddingVertical: 4 },
  statNum: { fontSize: 22, fontWeight: '700', color: '#1e1b2e' },
  statLabel: { fontSize: 12, color: '#6b6480', marginTop: 2 },
  sectionCard: { marginBottom: 24, borderRadius: 16, backgroundColor: '#fff' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  sectionIcon: { backgroundColor: '#ede7f6' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1e1b2e', flex: 1 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#6b6480', marginBottom: 8 },
  input: { marginBottom: 14, backgroundColor: '#fff' },
  submitButton: { borderRadius: 10, marginTop: 4 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  filterChip: { marginBottom: 4, backgroundColor: '#f3effa' },
  card: { borderRadius: 14, backgroundColor: '#fff' },
  pendingCard: { borderWidth: 1.5, borderColor: '#ef6c00', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowWithImage: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  visitorName: { fontSize: 16, fontWeight: '700', color: '#1e1b2e' },
  meta: { color: '#6b6480', marginTop: 3, fontSize: 13 },
  metaFaint: { color: '#a49cbe', marginTop: 4, fontSize: 12 },
  thumb: { width: 52, height: 52, borderRadius: 26 },
  thumbPlaceholder: { width: 52, height: 52, borderRadius: 26, backgroundColor: PRIMARY, justifyContent: 'center', alignItems: 'center' },
  thumbInitial: { color: 'white', fontSize: 19, fontWeight: '700' },
  thumbSmall: { width: 44, height: 44, borderRadius: 22 },
  thumbPlaceholderSmall: { width: 44, height: 44, borderRadius: 22, backgroundColor: PRIMARY, justifyContent: 'center', alignItems: 'center' },
  thumbInitialSmall: { color: 'white', fontSize: 16, fontWeight: '700' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  previewImage: { width: 60, height: 60, borderRadius: 12 },
  photoPlaceholder: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#f3effa', borderWidth: 1, borderColor: '#e2ddef', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  photoButton: { flex: 1, borderColor: '#d9d0ee' },
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  empty: { color: '#8a82a6', fontSize: 14 },
});