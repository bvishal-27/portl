import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, Alert } from 'react-native';
import { Button, Card, Chip, TextInput, SegmentedButtons } from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { router } from 'expo-router';

type VisitorRequest = {
  id: string;
  status: string;
  pre_approved: boolean;
  created_at: string;
  visitors: { name: string; visitor_type: string } | null;
  flats: { flat_number: string } | null;
};

type Ticket = {
  id: string;
  category: string;
  description: string;
  status: string;
  created_at: string;
};

type Amenity = { id: string; name: string; capacity: number; slots: string[] };
type Booking = { id: string; amenity_id: string; booking_date: string; slot: string; resident_id: string };

export default function AdminHome() {
  const [requests, setRequests] = useState<VisitorRequest[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [tab, setTab] = useState('visitors');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const userId = useAuthStore((s) => s.userId);
  const clearSession = useAuthStore((s) => s.clearSession);

  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOption1, setPollOption1] = useState('');
  const [pollOption2, setPollOption2] = useState('');
  const [amenityName, setAmenityName] = useState('');
  const [amenityCapacity, setAmenityCapacity] = useState('1');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearSession();
    router.replace('/(auth)/login');
  };

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('visitor_requests')
      .select('id, status, pre_approved, created_at, visitors(name, visitor_type), flats(flat_number)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) setRequests(data as any);
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

  useEffect(() => {
    fetchRequests();
    fetchTickets();
    fetchAmenities();
    fetchBookings();

    const channel = supabase
      .channel('visitor_requests_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitor_requests' }, () => fetchRequests())
      .subscribe();

    const ticketChannel = supabase
      .channel('tickets_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => fetchTickets())
      .subscribe();

    const bookingChannel = supabase
      .channel('bookings_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => fetchBookings())
      .subscribe();

    const amenityChannel = supabase
      .channel('amenities_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'amenities' }, () => fetchAmenities())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(ticketChannel);
      supabase.removeChannel(bookingChannel);
      supabase.removeChannel(amenityChannel);
    };
  }, []);

  const handleCreateNotice = async () => {
    if (!noticeTitle || !noticeBody) return;
    const { error } = await supabase.from('notices').insert({ title: noticeTitle, body: noticeBody, created_by: userId });
    if (!error) {
      setNoticeTitle('');
      setNoticeBody('');
    }
  };

  const handleCreatePoll = async () => {
    if (!pollQuestion || !pollOption1 || !pollOption2) return;
    const { data: poll, error } = await supabase.from('polls').insert({ question: pollQuestion, created_by: userId }).select().single();
    if (error || !poll) return;
    await supabase.from('poll_options').insert([
      { poll_id: poll.id, option_text: pollOption1 },
      { poll_id: poll.id, option_text: pollOption2 },
    ]);
    setPollQuestion('');
    setPollOption1('');
    setPollOption2('');
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    const { error } = await supabase.from('tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', ticketId);
    if (error) console.log(error.message);
  };

  const handleCreateAmenity = async () => {
  if (!amenityName) {
    Alert.alert('Missing info', 'Enter an amenity name');
    return;
  }
  const { error } = await supabase.from('amenities').insert({
    name: amenityName,
    capacity: parseInt(amenityCapacity) || 1,
  });
  if (error) {
    Alert.alert('Error', error.message);
    return;
  }
  Alert.alert('Amenity added', `${amenityName} is now available for booking`);
  setAmenityName('');
  setAmenityCapacity('1');
  fetchAmenities();
};
  const cancelBooking = async (bookingId: string) => {
    await supabase.from('bookings').delete().eq('id', bookingId);
  };

  const today = new Date().toDateString();
  const todayCount = requests.filter((r) => new Date(r.created_at).toDateString() === today).length;
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter);
  const statusColor = (status: string) => (status === 'approved' ? '#2e7d32' : status === 'denied' ? '#c62828' : '#ef6c00');
  const ticketStatusColor = (status: string) => (status === 'resolved' ? '#2e7d32' : status === 'in_progress' ? '#ef6c00' : '#616161');
  const amenityName2 = (id: string) => amenities.find((a) => a.id === id)?.name ?? 'Unknown';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Admin Dashboard</Text>

      <SegmentedButtons
        value={tab}
        onValueChange={setTab}
        style={styles.tabs}
        buttons={[
          { value: 'visitors', label: 'Visitors' },
          { value: 'notices', label: 'Notices' },
          { value: 'polls', label: 'Polls' },
          { value: 'tickets', label: 'Tickets' },
          { value: 'amenities', label: 'Amenities' },
        ]}
      />

      {tab === 'visitors' && (
        <>
          <View style={styles.statsRow}>
            <Card style={styles.statCard}><Card.Content><Text style={styles.statNum}>{todayCount}</Text><Text style={styles.statLabel}>Today</Text></Card.Content></Card>
            <Card style={styles.statCard}><Card.Content><Text style={styles.statNum}>{pendingCount}</Text><Text style={styles.statLabel}>Pending</Text></Card.Content></Card>
            <Card style={styles.statCard}><Card.Content><Text style={styles.statNum}>{requests.length}</Text><Text style={styles.statLabel}>Total</Text></Card.Content></Card>
          </View>
          <View style={styles.filterRow}>
            {['all', 'pending', 'approved', 'denied'].map((f) => (
              <Chip key={f} selected={filter === f} onPress={() => setFilter(f)} style={styles.filterChip}>{f}</Chip>
            ))}
          </View>
          {filtered.length === 0 && <Text style={styles.empty}>No visitor records</Text>}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Card style={styles.card}>
                <Card.Content>
                  <View style={styles.row}>
                    <Text style={styles.visitorName}>{item.visitors?.name}</Text>
                    <Chip textStyle={{ color: 'white', fontSize: 12 }} style={{ backgroundColor: statusColor(item.status) }}>
                      {item.pre_approved ? 'pre-approved' : item.status}
                    </Chip>
                  </View>
                  <Text style={styles.meta}>Flat {item.flats?.flat_number} · {item.visitors?.visitor_type}</Text>
                  <Text style={styles.meta}>{new Date(item.created_at).toLocaleString()}</Text>
                </Card.Content>
              </Card>
            )}
          />
        </>
      )}

      {tab === 'notices' && (
        <View>
          <Text style={styles.section}>Post a Notice</Text>
          <TextInput label="Title" value={noticeTitle} onChangeText={setNoticeTitle} style={styles.input} />
          <TextInput label="Body" value={noticeBody} onChangeText={setNoticeBody} multiline numberOfLines={3} style={styles.input} />
          <Button mode="contained" onPress={handleCreateNotice} style={styles.input}>Post Notice</Button>
        </View>
      )}

      {tab === 'polls' && (
        <View>
          <Text style={styles.section}>Create a Poll</Text>
          <TextInput label="Question" value={pollQuestion} onChangeText={setPollQuestion} style={styles.input} />
          <TextInput label="Option 1" value={pollOption1} onChangeText={setPollOption1} style={styles.input} />
          <TextInput label="Option 2" value={pollOption2} onChangeText={setPollOption2} style={styles.input} />
          <Button mode="contained" onPress={handleCreatePoll} style={styles.input}>Create Poll</Button>
        </View>
      )}

      {tab === 'tickets' && (
        <View>
          <Text style={styles.section}>All Tickets</Text>
          {tickets.length === 0 && <Text style={styles.empty}>No tickets raised yet</Text>}
          <FlatList
            data={tickets}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Card style={styles.card}>
                <Card.Content>
                  <View style={styles.row}>
                    <Text style={styles.visitorName}>{item.category}</Text>
                    <Chip textStyle={{ color: 'white', fontSize: 12 }} style={{ backgroundColor: ticketStatusColor(item.status) }}>
                      {item.status.replace('_', ' ')}
                    </Chip>
                  </View>
                  <Text style={styles.meta}>{item.description}</Text>
                  <Text style={styles.meta}>{new Date(item.created_at).toLocaleString()}</Text>
                </Card.Content>
                <Card.Actions>
                  {item.status !== 'in_progress' && (
                    <Button compact onPress={() => updateTicketStatus(item.id, 'in_progress')}>In Progress</Button>
                  )}
                  {item.status !== 'resolved' && (
                    <Button compact mode="contained" onPress={() => updateTicketStatus(item.id, 'resolved')}>Resolve</Button>
                  )}
                </Card.Actions>
              </Card>
            )}
          />
        </View>
      )}

      {tab === 'amenities' && (
        <View>
          <Text style={styles.section}>Add Amenity</Text>
          <TextInput label="Amenity name (e.g. Clubhouse)" value={amenityName} onChangeText={setAmenityName} style={styles.input} />
          <TextInput label="Capacity per slot" value={amenityCapacity} onChangeText={setAmenityCapacity} keyboardType="numeric" style={styles.input} />
          <Button mode="contained" onPress={handleCreateAmenity} style={styles.input}>Add Amenity</Button>

          <Text style={styles.section}>Amenities ({amenities.length})</Text>
          {amenities.map((a) => (
            <Card key={a.id} style={styles.card}>
              <Card.Content>
                <Text style={styles.visitorName}>{a.name}</Text>
                <Text style={styles.meta}>Capacity: {a.capacity} · Slots: {a.slots.length}</Text>
              </Card.Content>
            </Card>
          ))}

          <Text style={styles.section}>All Bookings</Text>
          {bookings.length === 0 && <Text style={styles.empty}>No bookings yet</Text>}
          <FlatList
            data={bookings}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Card style={styles.card}>
                <Card.Content>
                  <Text style={styles.visitorName}>{amenityName2(item.amenity_id)}</Text>
                  <Text style={styles.meta}>{item.booking_date} · {item.slot}</Text>
                </Card.Content>
                <Card.Actions>
                  <Button compact onPress={() => cancelBooking(item.id)}>Cancel</Button>
                </Card.Actions>
              </Card>
            )}
          />
        </View>
      )}

      <Button mode="outlined" onPress={handleLogout} style={{ marginTop: 20 }}>Log Out</Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  tabs: { marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1 },
  statNum: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  statLabel: { fontSize: 12, color: '#666', textAlign: 'center' },
  section: { fontSize: 16, fontWeight: '600', marginBottom: 10, marginTop: 10 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  filterChip: { marginBottom: 4 },
  empty: { color: '#888', fontStyle: 'italic', marginBottom: 12 },
  card: { marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  visitorName: { fontSize: 15, fontWeight: '600' },
  meta: { color: '#666', marginTop: 2, fontSize: 13 },
  input: { marginBottom: 12 },
});