import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, ScrollView, Platform } from 'react-native';
import { Button, Card, TextInput, SegmentedButtons, Chip } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { router } from 'expo-router';

type VisitorRequest = {
  id: string;
  status: string;
  pre_approved: boolean;
  created_at: string;
  visitors: { name: string; phone: string; visitor_type: string } | null;
};

type Notice = { id: string; title: string; body: string; created_at: string };
type PollOption = { id: string; option_text: string };
type Poll = { id: string; question: string; poll_options: PollOption[] };
type Vote = { poll_id: string; option_id: string; voter_id: string };
type Ticket = { id: string; category: string; description: string; status: string; created_at: string };
type Amenity = { id: string; name: string; capacity: number; slots: string[] };
type Booking = { id: string; amenity_id: string; booking_date: string; slot: string };
type Staff = { id: string; name: string; service_type: string; phone: string | null };

export default function ResidentHome() {
  const [tab, setTab] = useState('visitors');
  const [requests, setRequests] = useState<VisitorRequest[]>([]);
  const [flatId, setFlatId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketCategory, setTicketCategory] = useState('general');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketLoading, setTicketLoading] = useState(false);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [bookingDate, setBookingDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllNotices, setShowAllNotices] = useState(false);
  const [showAllPolls, setShowAllPolls] = useState(false);
  const userId = useAuthStore((s) => s.userId);
  const clearSession = useAuthStore((s) => s.clearSession);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearSession();
    router.replace('/(auth)/login');
  };

  const fetchRequests = async (currentFlatId: string) => {
    const { data, error } = await supabase
      .from('visitor_requests')
      .select('id, status, pre_approved, created_at, visitors(name, phone, visitor_type)')
      .eq('flat_id', currentFlatId)
      .order('created_at', { ascending: false });
    if (!error && data) setRequests(data as any);
  };

  const fetchNotices = async () => {
    const { data } = await supabase.from('notices').select('*').order('created_at', { ascending: false });
    if (data) setNotices(data);
  };

  const fetchPolls = async () => {
    const { data } = await supabase.from('polls').select('id, question, poll_options(id, option_text)').order('created_at', { ascending: false });
    if (data) setPolls(data as any);
  };

  const fetchVotes = async () => {
    const { data } = await supabase.from('poll_votes').select('poll_id, option_id, voter_id');
    if (data) setVotes(data);
  };

  const fetchTickets = async () => {
    const { data } = await supabase.from('tickets').select('*').eq('resident_id', userId).order('created_at', { ascending: false });
    if (data) setTickets(data);
  };

  const fetchAmenities = async () => {
    const { data } = await supabase.from('amenities').select('*').order('created_at', { ascending: false });
    if (data) setAmenities(data);
  };

  const fetchMyBookings = async () => {
    const { data } = await supabase.from('bookings').select('*').eq('resident_id', userId).order('booking_date', { ascending: true });
    if (data) setMyBookings(data);
  };

  const fetchStaff = async () => {
    const { data } = await supabase.from('staff_directory').select('*').order('name');
    if (data) setStaff(data);
  };

  useEffect(() => {
    const init = async () => {
      const { data: profile } = await supabase.from('profiles').select('flat_id').eq('id', userId).single();
      if (!profile?.flat_id) return;
      setFlatId(profile.flat_id);
      fetchRequests(profile.flat_id);
      fetchNotices();
      fetchPolls();
      fetchVotes();
      fetchTickets();
      fetchAmenities();
      fetchMyBookings();
      fetchStaff();

      const visitorChannel = supabase
        .channel(`visitor_requests_resident_${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'visitor_requests', filter: `flat_id=eq.${profile.flat_id}` }, () => fetchRequests(profile.flat_id))
        .subscribe();

      const noticeChannel = supabase
        .channel(`notices_resident_${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => fetchNotices())
        .subscribe();

      const pollChannel = supabase
        .channel(`polls_resident_${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => fetchPolls())
        .subscribe();

      const voteChannel = supabase
        .channel(`votes_resident_${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => fetchVotes())
        .subscribe();

      const ticketChannel = supabase
        .channel(`tickets_resident_${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `resident_id=eq.${userId}` }, () => fetchTickets())
        .subscribe();

      const amenityChannel = supabase
        .channel(`amenities_resident_${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'amenities' }, () => fetchAmenities())
        .subscribe();

      const bookingChannel = supabase
        .channel(`bookings_resident_${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `resident_id=eq.${userId}` }, () => fetchMyBookings())
        .subscribe();

      const staffChannel = supabase
        .channel(`staff_resident_${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_directory' }, () => fetchStaff())
        .subscribe();

      return () => {
        supabase.removeChannel(visitorChannel);
        supabase.removeChannel(noticeChannel);
        supabase.removeChannel(pollChannel);
        supabase.removeChannel(voteChannel);
        supabase.removeChannel(ticketChannel);
        supabase.removeChannel(amenityChannel);
        supabase.removeChannel(bookingChannel);
        supabase.removeChannel(staffChannel);
      };
    };
    init();
  }, [userId]);

  const respondToRequest = async (requestId: string, status: 'approved' | 'denied') => {
    const { error } = await supabase.from('visitor_requests').update({ status }).eq('id', requestId);
    if (error) Alert.alert('Error', error.message);
  };

  const handlePreApprove = async () => {
    if (!guestName || !flatId) {
      Alert.alert('Missing info', 'Enter a guest name');
      return;
    }
    const { data: visitor, error: visitorError } = await supabase.from('visitors').insert({ name: guestName, visitor_type: 'guest' }).select().single();
    if (visitorError || !visitor) {
      Alert.alert('Error', visitorError?.message ?? 'Could not create guest');
      return;
    }
    const { error: requestError } = await supabase.from('visitor_requests').insert({
      visitor_id: visitor.id,
      flat_id: flatId,
      status: 'approved',
      pre_approved: true,
    });
    if (requestError) {
      Alert.alert('Error', requestError.message);
      return;
    }
    Alert.alert('Pre-approved', `${guestName} is pre-approved.`);
    setGuestName('');
  };

  const castVote = async (pollId: string, optionId: string) => {
    const { error } = await supabase.from('poll_votes').insert({ poll_id: pollId, option_id: optionId, voter_id: userId });
    if (error) Alert.alert('Already voted', 'You can only vote once per poll');
  };

  const handleRaiseTicket = async () => {
    if (ticketLoading) return;
    if (!ticketDescription) {
      Alert.alert('Missing info', 'Please describe the issue');
      return;
    }
    setTicketLoading(true);
    try {
      const { error } = await supabase.from('tickets').insert({
        resident_id: userId,
        category: ticketCategory,
        description: ticketDescription,
        status: 'open',
      });
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      setTicketDescription('');
      Alert.alert('Ticket raised', 'The admin has been notified');
    } catch {
      Alert.alert('Something went wrong', 'Check your connection and try again');
    } finally {
      setTicketLoading(false);
    }
  };

  const handleBookSlot = async (amenity: Amenity, slot: string) => {
    if (!bookingDate) {
      Alert.alert('Pick a date', 'Choose a date first');
      return;
    }
    const { error } = await supabase.from('bookings').insert({
      amenity_id: amenity.id,
      resident_id: userId,
      booking_date: bookingDate,
      slot,
    });
    if (error) {
      if (error.code === '23505') {
        Alert.alert('Already booked', 'This slot is taken for that date. Pick another.');
      } else {
        Alert.alert('Error', error.message);
      }
      return;
    }
    Alert.alert('Booked!', `${amenity.name} — ${slot} on ${bookingDate}`);
  };

  const cancelMyBooking = async (bookingId: string) => {
    const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    fetchMyBookings();
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const formatted = selectedDate.toISOString().split('T')[0];
      setBookingDate(formatted);
    }
  };

  const hasVoted = (pollId: string) => votes.some((v) => v.poll_id === pollId && v.voter_id === userId);
  const voteCount = (optionId: string) => votes.filter((v) => v.option_id === optionId).length;
  const amenityNameFor = (id: string) => amenities.find((a) => a.id === id)?.name ?? 'Unknown';

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const pastRequests = requests.filter((r) => r.status !== 'pending');
  const visibleHistory = showAllHistory ? pastRequests : pastRequests.slice(0, 5);
  const visibleNotices = showAllNotices ? notices : notices.slice(0, 5);
  const visiblePolls = showAllPolls ? polls : polls.slice(0, 3);
  const ticketStatusColor = (status: string) => (status === 'resolved' ? '#2e7d32' : status === 'in_progress' ? '#ef6c00' : '#616161');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Resident Dashboard</Text>

      <SegmentedButtons
        value={tab}
        onValueChange={setTab}
        style={styles.tabs}
        buttons={[
          { value: 'visitors', label: 'Visitors' },
          { value: 'notices', label: 'Notices' },
          { value: 'polls', label: 'Polls' },
        ]}
      />
      <SegmentedButtons
        value={tab}
        onValueChange={setTab}
        style={styles.tabs}
        buttons={[
          { value: 'helpdesk', label: 'Helpdesk' },
          { value: 'amenities', label: 'Amenities' },
          { value: 'staff', label: 'Staff' },
        ]}
      />

      {tab === 'visitors' && (
        <>
          <Text style={styles.section}>Pre-approve a Guest</Text>
          <View style={styles.row}>
            <TextInput label="Guest name" value={guestName} onChangeText={setGuestName} style={styles.guestInput} />
            <Button mode="contained" onPress={handlePreApprove} style={styles.guestBtn}>Add</Button>
          </View>
          <Text style={styles.section}>Pending Approvals</Text>
          {pendingRequests.length === 0 && <Text style={styles.empty}>No pending requests</Text>}
          <FlatList
            data={pendingRequests}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Card style={styles.card}>
                <Card.Content>
                  <Text style={styles.visitorName}>{item.visitors?.name}</Text>
                  <Text style={styles.visitorType}>{item.visitors?.visitor_type}</Text>
                </Card.Content>
                <Card.Actions>
                  <Button onPress={() => respondToRequest(item.id, 'denied')}>Deny</Button>
                  <Button mode="contained" onPress={() => respondToRequest(item.id, 'approved')}>Approve</Button>
                </Card.Actions>
              </Card>
            )}
          />
          <Text style={styles.section}>History</Text>
          {pastRequests.length === 0 && <Text style={styles.empty}>No visitor history yet</Text>}
          <FlatList
            data={visibleHistory}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.historyRow}>
                <Text>{item.visitors?.name} — {item.status}{item.pre_approved ? ' (pre-approved)' : ''}</Text>
              </View>
            )}
          />
          {pastRequests.length > 5 && (
            <Button compact onPress={() => setShowAllHistory(!showAllHistory)}>
              {showAllHistory ? 'Show less' : `View all (${pastRequests.length})`}
            </Button>
          )}
        </>
      )}

      {tab === 'notices' && (
        <>
          <Text style={styles.section}>Society Notices</Text>
          {notices.length === 0 && <Text style={styles.empty}>No notices yet</Text>}
          <FlatList
            data={visibleNotices}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Card style={styles.card}>
                <Card.Content>
                  <Text style={styles.visitorName}>{item.title}</Text>
                  <Text style={styles.noticeBody}>{item.body}</Text>
                  <Text style={styles.meta}>{new Date(item.created_at).toLocaleString()}</Text>
                </Card.Content>
              </Card>
            )}
          />
          {notices.length > 5 && (
            <Button compact onPress={() => setShowAllNotices(!showAllNotices)}>
              {showAllNotices ? 'Show less' : `View all (${notices.length})`}
            </Button>
          )}
        </>
      )}

      {tab === 'polls' && (
        <>
          <Text style={styles.section}>Community Polls</Text>
          {polls.length === 0 && <Text style={styles.empty}>No polls yet</Text>}
          {visiblePolls.map((poll) => (
            <Card key={poll.id} style={styles.card}>
              <Card.Content>
                <Text style={styles.visitorName}>{poll.question}</Text>
                {poll.poll_options?.map((opt) => (
                  <View key={opt.id} style={styles.pollOptionRow}>
                    <Text style={styles.pollOptionText}>{opt.option_text} — {voteCount(opt.id)} votes</Text>
                    {!hasVoted(poll.id) && (
                      <Button mode="outlined" compact onPress={() => castVote(poll.id, opt.id)}>Vote</Button>
                    )}
                  </View>
                ))}
                {hasVoted(poll.id) && <Text style={styles.votedLabel}>You voted</Text>}
              </Card.Content>
            </Card>
          ))}
          {polls.length > 3 && (
            <Button compact onPress={() => setShowAllPolls(!showAllPolls)}>
              {showAllPolls ? 'Show less' : `View all (${polls.length})`}
            </Button>
          )}
        </>
      )}

      {tab === 'helpdesk' && (
        <>
          <Text style={styles.section}>Raise a Ticket</Text>
          <SegmentedButtons
            value={ticketCategory}
            onValueChange={setTicketCategory}
            style={styles.input}
            buttons={[
              { value: 'general', label: 'General' },
              { value: 'maintenance', label: 'Maintenance' },
              { value: 'security', label: 'Security' },
            ]}
          />
          <TextInput label="Describe the issue" value={ticketDescription} onChangeText={setTicketDescription} multiline numberOfLines={3} style={styles.input} />
          <Button mode="contained" onPress={handleRaiseTicket} loading={ticketLoading} disabled={ticketLoading} style={styles.input}>Submit Ticket</Button>
          <Text style={styles.section}>My Tickets</Text>
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
                  <Text style={styles.noticeBody}>{item.description}</Text>
                  <Text style={styles.meta}>{new Date(item.created_at).toLocaleString()}</Text>
                </Card.Content>
              </Card>
            )}
          />
        </>
      )}

      {tab === 'amenities' && (
        <>
          <Text style={styles.section}>Book an Amenity</Text>
          <Button mode="outlined" onPress={() => setShowDatePicker(true)} style={styles.input}>
            {bookingDate ? `Date: ${bookingDate}` : 'Pick a Date'}
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
          {amenities.length === 0 && <Text style={styles.empty}>No amenities available yet</Text>}
          {amenities.map((amenity) => (
            <Card key={amenity.id} style={styles.card}>
              <Card.Content>
                <Text style={styles.visitorName}>{amenity.name}</Text>
                <Text style={styles.meta}>Capacity: {amenity.capacity}</Text>
                <View style={styles.slotWrap}>
                  {amenity.slots.map((slot) => (
                    <Chip key={slot} onPress={() => handleBookSlot(amenity, slot)} style={styles.slotChip}>
                      {slot}
                    </Chip>
                  ))}
                </View>
              </Card.Content>
            </Card>
          ))}
          <Text style={styles.section}>My Bookings</Text>
          {myBookings.length === 0 && <Text style={styles.empty}>No bookings yet</Text>}
          <FlatList
            data={myBookings}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Card style={styles.card}>
                <Card.Content>
                  <Text style={styles.visitorName}>{amenityNameFor(item.amenity_id)}</Text>
                  <Text style={styles.meta}>{item.booking_date} · {item.slot}</Text>
                </Card.Content>
                <Card.Actions>
                  <Button compact onPress={() => cancelMyBooking(item.id)}>Cancel</Button>
                </Card.Actions>
              </Card>
            )}
          />
        </>
      )}

      {tab === 'staff' && (
        <>
          <Text style={styles.section}>Staff & Service Directory</Text>
          {staff.length === 0 && <Text style={styles.empty}>No entries yet</Text>}
          {staff.map((s) => (
            <Card key={s.id} style={styles.card}>
              <Card.Content>
                <Text style={styles.visitorName}>{s.name}</Text>
                <Text style={styles.meta}>{s.service_type}{s.phone ? ` · ${s.phone}` : ''}</Text>
              </Card.Content>
            </Card>
          ))}
        </>
      )}

      <Button mode="outlined" onPress={handleLogout} style={{ marginTop: 20 }}>Log Out</Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  tabs: { marginBottom: 12 },
  section: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  empty: { color: '#888', fontStyle: 'italic' },
  card: { marginBottom: 12 },
  visitorName: { fontSize: 16, fontWeight: '600' },
  visitorType: { color: '#666', textTransform: 'capitalize' },
  historyRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#eee' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' },
  guestInput: { flex: 1 },
  guestBtn: { justifyContent: 'center' },
  noticeBody: { color: '#444', marginTop: 4 },
  meta: { color: '#888', fontSize: 12, marginTop: 6 },
  pollOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  pollOptionText: { flex: 1 },
  votedLabel: { color: '#2e7d32', marginTop: 8, fontWeight: '600' },
  input: { marginBottom: 12 },
  slotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  slotChip: { marginBottom: 4 },
});