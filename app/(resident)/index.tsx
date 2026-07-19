import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, ScrollView, Platform, Image } from 'react-native';
import { Button, TextInput, Chip, Avatar, Divider, IconButton } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { router } from 'expo-router';

// ---- Inline theme: light, minimal, premium (matches Login / Signup / Guard) ----
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

type VisitorRequest = {
  id: string;
  status: string;
  pre_approved: boolean;
  created_at: string;
  visitors: { name: string; phone: string; visitor_type: string; photo_url: string | null } | null;
};
type Notice = { id: string; title: string; body: string; created_at: string };
type PollOption = { id: string; option_text: string };
type Poll = { id: string; question: string; poll_options: PollOption[] };
type Vote = { poll_id: string; option_id: string; voter_id: string };
type Ticket = { id: string; category: string; description: string; status: string; created_at: string };
type Amenity = { id: string; name: string; capacity: number; slots: string[] };
type Booking = { id: string; amenity_id: string; booking_date: string; slot: string };
type Staff = { id: string; name: string; service_type: string; phone: string | null; photo_url: string | null };

const TABS = [
  { key: 'visitors', label: 'Visitors', icon: 'account-group' },
  { key: 'notices', label: 'Notices', icon: 'bullhorn' },
  { key: 'polls', label: 'Polls', icon: 'poll' },
  { key: 'helpdesk', label: 'Helpdesk', icon: 'headset' },
  { key: 'amenities', label: 'Amenities', icon: 'calendar-check' },
  { key: 'staff', label: 'Staff', icon: 'account-hard-hat' },
];

export default function ResidentHome() {
  const [tab, setTab] = useState('visitors');
  const [requests, setRequests] = useState<VisitorRequest[]>([]);
  const [flatId, setFlatId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestPhotoUri, setGuestPhotoUri] = useState<string | null>(null);
  const [guestLoading, setGuestLoading] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketCategory, setTicketCategory] = useState('general');
  const [customCategory, setCustomCategory] = useState('');
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
      .select('id, status, pre_approved, created_at, visitors(name, phone, visitor_type, photo_url)')
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

  // FIXED: channels array now lives outside the async function so the
  // useEffect cleanup can actually reach it and unsubscribe properly.
  useEffect(() => {
    let cancelled = false;
    let channels: ReturnType<typeof supabase.channel>[] = [];

    const init = async () => {
      // IMPORTANT: clear any channels left over from a previous mount / Fast Refresh.
      // The supabase client is a singleton - its internal channel list survives
      // hot reloads even though React component state resets, so without this,
      // re-creating a channel with the same topic name throws
      // "cannot add postgres_changes callbacks ... after subscribe()".
      await supabase.removeAllChannels();

      const { data: profile } = await supabase.from('profiles').select('flat_id').eq('id', userId).single();
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

      if (cancelled) return; // guard in case unmounted while awaiting above

      channels = [
        supabase.channel(`visitor_requests_resident_${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'visitor_requests', filter: `flat_id=eq.${profile.flat_id}` }, () => fetchRequests(profile.flat_id)).subscribe(),
        supabase.channel(`notices_resident_${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => fetchNotices()).subscribe(),
        supabase.channel(`polls_resident_${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => fetchPolls()).subscribe(),
        supabase.channel(`votes_resident_${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => fetchVotes()).subscribe(),
        supabase.channel(`tickets_resident_${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `resident_id=eq.${userId}` }, () => fetchTickets()).subscribe(),
        supabase.channel(`amenities_resident_${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'amenities' }, () => fetchAmenities()).subscribe(),
        supabase.channel(`bookings_resident_${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `resident_id=eq.${userId}` }, () => fetchMyBookings()).subscribe(),
        supabase.channel(`staff_resident_${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'staff_directory' }, () => fetchStaff()).subscribe(),
      ];
    };

    init();

    // This is the actual useEffect cleanup now - it WILL run on unmount/re-run.
    return () => {
      cancelled = true;
      channels.forEach((c) => supabase.removeChannel(c));
      supabase.removeAllChannels();
    };
  }, [userId]);

  const respondToRequest = async (requestId: string, status: 'approved' | 'denied') => {
    const { error } = await supabase.from('visitor_requests').update({ status }).eq('id', requestId);
    if (error) Alert.alert('Error', error.message);
  };

  const pickGuestPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) setGuestPhotoUri(result.assets[0].uri);
  };

  const uploadGuestPhoto = async (uri: string): Promise<string | null> => {
    try {
      const fileName = `guest_${Date.now()}.jpg`;
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

  const handlePreApprove = async () => {
    if (guestLoading) return;
    if (!guestName || !flatId) {
      Alert.alert('Missing info', 'Enter a guest name');
      return;
    }
    setGuestLoading(true);
    try {
      let photoUrl: string | null = null;
      if (guestPhotoUri) photoUrl = await uploadGuestPhoto(guestPhotoUri);
      const { data: visitor, error: visitorError } = await supabase
        .from('visitors')
        .insert({ name: guestName, phone: guestPhone, visitor_type: 'guest', photo_url: photoUrl })
        .select()
        .single();
      if (visitorError || !visitor) {
        Alert.alert('Error', visitorError?.message ?? 'Could not create guest');
        return;
      }
      const { error: requestError } = await supabase.from('visitor_requests').insert({
        visitor_id: visitor.id, flat_id: flatId, status: 'approved', pre_approved: true,
      });
      if (requestError) {
        Alert.alert('Error', requestError.message);
        return;
      }
      Alert.alert('Pre-approved', `${guestName} is pre-approved.`);
      setGuestName('');
      setGuestPhone('');
      setGuestPhotoUri(null);
    } finally {
      setGuestLoading(false);
    }
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
    if (ticketCategory === 'other' && !customCategory.trim()) {
      Alert.alert('Missing info', 'Please specify the category');
      return;
    }
    setTicketLoading(true);
    try {
      const finalCategory = ticketCategory === 'other' ? customCategory.trim() : ticketCategory;
      const { error } = await supabase.from('tickets').insert({
        resident_id: userId, category: finalCategory, description: ticketDescription, status: 'open',
      });
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      setTicketDescription('');
      setCustomCategory('');
      Alert.alert('Ticket raised', 'The admin has been notified');
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
      amenity_id: amenity.id, resident_id: userId, booking_date: bookingDate, slot,
    });
    if (error) {
      if (error.code === '23505') Alert.alert('Already booked', 'This slot is taken for that date. Pick another.');
      else Alert.alert('Error', error.message);
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
    if (selectedDate) setBookingDate(selectedDate.toISOString().split('T')[0]);
  };

  const hasVoted = (pollId: string) => votes.some((v) => v.poll_id === pollId && v.voter_id === userId);
  const voteCount = (optionId: string) => votes.filter((v) => v.option_id === optionId).length;
  const amenityNameFor = (id: string) => amenities.find((a) => a.id === id)?.name ?? 'Unknown';

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const pastRequests = requests.filter((r) => r.status !== 'pending');
  const visibleHistory = showAllHistory ? pastRequests : pastRequests.slice(0, 5);
  const visibleNotices = showAllNotices ? notices : notices.slice(0, 5);
  const visiblePolls = showAllPolls ? polls : polls.slice(0, 3);
  const ticketStatusColor = (status: string) => (status === 'resolved' ? SUCCESS : status === 'in_progress' ? GOLD : INK_MUTED);
  const ticketStatusBg = (status: string) => (status === 'resolved' ? SUCCESS_BG : status === 'in_progress' ? '#FBF3E4' : INPUT_BG);

  const inputTheme = { colors: { onSurfaceVariant: INK_MUTED, background: 'transparent', primary: ACCENT } };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>PORTL</Text>
          <Text style={styles.title}>Resident</Text>
        </View>
        <IconButton icon="logout" size={22} iconColor={ACCENT} onPress={handleLogout} style={styles.logoutBtn} />
      </View>

      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {TABS.map((t) => (
            <Chip
              key={t.key}
              icon={t.icon}
              selected={tab === t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tabChip, tab === t.key && styles.tabChipSelected]}
              textStyle={tab === t.key ? { color: '#fff', fontWeight: '600' } : { color: INK_MUTED }}
              selectedColor="white"
            >
              {t.label}
            </Chip>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {tab === 'visitors' && (
          <>
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Avatar.Icon size={30} icon="account-plus" style={styles.sectionIcon} color={ACCENT} />
                <Text style={styles.sectionTitle}>Pre-approve a Guest</Text>
              </View>
              <View style={styles.inputWrap}>
                <TextInput mode="flat" label="Guest name" value={guestName} onChangeText={setGuestName} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} />
              </View>
              <View style={styles.inputWrap}>
                <TextInput mode="flat" label="Guest phone (optional)" value={guestPhone} onChangeText={setGuestPhone} keyboardType="phone-pad" style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} />
              </View>
              <View style={styles.photoRow}>
                {guestPhotoUri ? (
                  <Image source={{ uri: guestPhotoUri }} style={styles.previewImage} />
                ) : (
                  <View style={styles.photoPlaceholder}><Avatar.Icon size={32} icon="camera" style={{ backgroundColor: 'transparent' }} color={INK_FAINT} /></View>
                )}
                <Button mode="outlined" onPress={pickGuestPhoto} icon="camera" textColor={ACCENT} style={styles.photoButton}>
                  {guestPhotoUri ? 'Retake' : 'Add Photo'}
                </Button>
              </View>
              <Button mode="contained" onPress={handlePreApprove} loading={guestLoading} disabled={guestLoading} buttonColor={ACCENT} textColor="#fff" style={styles.submitButton} contentStyle={{ paddingVertical: 4 }}>
                Pre-approve Guest
              </Button>
            </View>

            <View style={styles.sectionHeaderRow}>
              <Avatar.Icon size={30} icon="account-clock" style={styles.sectionIcon} color={ACCENT} />
              <Text style={styles.sectionTitle}>Pending Approvals</Text>
              {pendingRequests.length > 0 && <Text style={styles.countBadge}>{pendingRequests.length}</Text>}
            </View>
            {pendingRequests.length === 0 && (
              <View style={styles.emptyState}>
                <Avatar.Icon size={44} icon="check-circle-outline" style={{ backgroundColor: ACCENT_SOFT }} color={ACCENT} />
                <Text style={styles.empty}>No pending requests</Text>
              </View>
            )}
            <FlatList data={pendingRequests} keyExtractor={(item) => item.id} scrollEnabled={false} ItemSeparatorComponent={() => <View style={{ height: 12 }} />} renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={{ padding: 16 }}>
                  <View style={styles.rowWithImage}>
                    {item.visitors?.photo_url ? (
                      <Image source={{ uri: item.visitors.photo_url }} style={styles.thumb} />
                    ) : (
                      <View style={styles.thumbPlaceholder}><Text style={styles.thumbInitial}>{item.visitors?.name?.[0]?.toUpperCase() ?? '?'}</Text></View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.visitorName}>{item.visitors?.name}</Text>
                      <Text style={styles.meta}>{item.visitors?.visitor_type}{item.visitors?.phone ? ` · ${item.visitors.phone}` : ''}</Text>
                    </View>
                  </View>
                </View>
                <Divider style={{ backgroundColor: BORDER }} />
                <View style={styles.cardActions}>
                  <Button textColor={DANGER} onPress={() => respondToRequest(item.id, 'denied')}>Deny</Button>
                  <Button mode="contained" buttonColor={ACCENT} textColor="#fff" onPress={() => respondToRequest(item.id, 'approved')}>Approve</Button>
                </View>
              </View>
            )} />

            <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
              <Avatar.Icon size={30} icon="history" style={styles.sectionIcon} color={ACCENT} />
              <Text style={styles.sectionTitle}>History</Text>
            </View>
            {pastRequests.length === 0 && <Text style={styles.empty}>No visitor history yet</Text>}
            <FlatList data={visibleHistory} keyExtractor={(item) => item.id} scrollEnabled={false} renderItem={({ item }) => (
              <View style={styles.historyRow}>
                {item.visitors?.photo_url ? (
                  <Image source={{ uri: item.visitors.photo_url }} style={styles.thumbSmall} />
                ) : (
                  <View style={styles.thumbPlaceholderSmall}><Text style={styles.thumbInitialSmall}>{item.visitors?.name?.[0]?.toUpperCase() ?? '?'}</Text></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyName}>{item.visitors?.name}</Text>
                  <Text style={styles.metaFaint}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
                <Chip compact textStyle={{ fontSize: 11, fontWeight: '600', color: item.status === 'approved' ? SUCCESS : DANGER }} style={{ backgroundColor: item.status === 'approved' ? SUCCESS_BG : DANGER_BG }}>
                  {item.pre_approved ? 'pre-approved' : item.status}
                </Chip>
              </View>
            )} />
            {pastRequests.length > 5 && (
              <Button compact textColor={ACCENT} onPress={() => setShowAllHistory(!showAllHistory)}>
                {showAllHistory ? 'Show less' : `View all (${pastRequests.length})`}
              </Button>
            )}
          </>
        )}

        {tab === 'notices' && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Avatar.Icon size={30} icon="bullhorn" style={styles.sectionIcon} color={ACCENT} />
              <Text style={styles.sectionTitle}>Society Notices</Text>
            </View>
            {notices.length === 0 && (
              <View style={styles.emptyState}>
                <Avatar.Icon size={44} icon="bullhorn-outline" style={{ backgroundColor: ACCENT_SOFT }} color={ACCENT} />
                <Text style={styles.empty}>No notices yet</Text>
              </View>
            )}
            <FlatList data={visibleNotices} keyExtractor={(item) => item.id} scrollEnabled={false} ItemSeparatorComponent={() => <View style={{ height: 12 }} />} renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={{ padding: 16 }}>
                  <Text style={styles.visitorName}>{item.title}</Text>
                  <Text style={styles.noticeBody}>{item.body}</Text>
                  <Text style={styles.metaFaint}>{new Date(item.created_at).toLocaleString()}</Text>
                </View>
              </View>
            )} />
            {notices.length > 5 && (
              <Button compact textColor={ACCENT} onPress={() => setShowAllNotices(!showAllNotices)}>
                {showAllNotices ? 'Show less' : `View all (${notices.length})`}
              </Button>
            )}
          </>
        )}

        {tab === 'polls' && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Avatar.Icon size={30} icon="poll" style={styles.sectionIcon} color={ACCENT} />
              <Text style={styles.sectionTitle}>Community Polls</Text>
            </View>
            {polls.length === 0 && (
              <View style={styles.emptyState}>
                <Avatar.Icon size={44} icon="poll" style={{ backgroundColor: ACCENT_SOFT }} color={ACCENT} />
                <Text style={styles.empty}>No polls yet</Text>
              </View>
            )}
            {visiblePolls.map((poll) => (
              <View key={poll.id} style={[styles.card, { marginBottom: 12 }]}>
                <View style={{ padding: 16 }}>
                  <Text style={styles.visitorName}>{poll.question}</Text>
                  {poll.poll_options?.map((opt) => (
                    <View key={opt.id} style={styles.pollOptionRow}>
                      <Text style={styles.pollOptionText}>{opt.option_text} — {voteCount(opt.id)} votes</Text>
                      {!hasVoted(poll.id) && <Button mode="outlined" compact textColor={ACCENT} style={{ borderColor: ACCENT }} onPress={() => castVote(poll.id, opt.id)}>Vote</Button>}
                    </View>
                  ))}
                  {hasVoted(poll.id) && <Text style={styles.votedLabel}>✓ You voted</Text>}
                </View>
              </View>
            ))}
            {polls.length > 3 && (
              <Button compact textColor={ACCENT} onPress={() => setShowAllPolls(!showAllPolls)}>
                {showAllPolls ? 'Show less' : `View all (${polls.length})`}
              </Button>
            )}
          </>
        )}

        {tab === 'helpdesk' && (
          <>
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Avatar.Icon size={30} icon="headset" style={styles.sectionIcon} color={ACCENT} />
                <Text style={styles.sectionTitle}>Raise a Ticket</Text>
              </View>
              <View style={styles.chipSelectRow}>
                {['general', 'maintenance', 'security', 'other'].map((c) => (
                  <Chip key={c} selected={ticketCategory === c} onPress={() => setTicketCategory(c)} style={[styles.tabChip, ticketCategory === c && styles.tabChipSelected]} textStyle={ticketCategory === c ? { color: '#fff' } : { color: INK_MUTED }}>
                    {c}
                  </Chip>
                ))}
              </View>
              {ticketCategory === 'other' && (
                <View style={styles.inputWrap}>
                  <TextInput mode="flat" label="Specify category" value={customCategory} onChangeText={setCustomCategory} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} />
                </View>
              )}
              <View style={styles.inputWrap}>
                <TextInput mode="flat" label="Describe the issue" value={ticketDescription} onChangeText={setTicketDescription} multiline numberOfLines={3} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} />
              </View>
              <Button mode="contained" onPress={handleRaiseTicket} loading={ticketLoading} disabled={ticketLoading} buttonColor={ACCENT} textColor="#fff" style={styles.submitButton} contentStyle={{ paddingVertical: 4 }}>
                Submit Ticket
              </Button>
            </View>

            <View style={styles.sectionHeaderRow}>
              <Avatar.Icon size={30} icon="ticket-confirmation" style={styles.sectionIcon} color={ACCENT} />
              <Text style={styles.sectionTitle}>My Tickets</Text>
            </View>
            {tickets.length === 0 && <Text style={styles.empty}>No tickets raised yet</Text>}
            <FlatList data={tickets} keyExtractor={(item) => item.id} scrollEnabled={false} ItemSeparatorComponent={() => <View style={{ height: 12 }} />} renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={{ padding: 16 }}>
                  <View style={styles.row}>
                    <Text style={styles.visitorName}>{item.category}</Text>
                    <Chip compact textStyle={{ color: ticketStatusColor(item.status), fontWeight: '600', fontSize: 11 }} style={{ backgroundColor: ticketStatusBg(item.status) }}>
                      {item.status.replace('_', ' ')}
                    </Chip>
                  </View>
                  <Text style={styles.noticeBody}>{item.description}</Text>
                  <Text style={styles.metaFaint}>{new Date(item.created_at).toLocaleString()}</Text>
                </View>
              </View>
            )} />
          </>
        )}

        {tab === 'amenities' && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Avatar.Icon size={30} icon="calendar-check" style={styles.sectionIcon} color={ACCENT} />
              <Text style={styles.sectionTitle}>Book an Amenity</Text>
            </View>
            <Button mode="outlined" onPress={() => setShowDatePicker(true)} icon="calendar" textColor={ACCENT} style={[styles.dateButton]}>
              {bookingDate ? `Date: ${bookingDate}` : 'Pick a Date'}
            </Button>
            {showDatePicker && (
              <DateTimePicker value={bookingDate ? new Date(bookingDate) : new Date()} mode="date" display="default" minimumDate={new Date()} onChange={onDateChange} />
            )}
            {amenities.length === 0 && <Text style={styles.empty}>No amenities available yet</Text>}
            {amenities.map((amenity) => (
              <View key={amenity.id} style={[styles.card, { marginBottom: 12 }]}>
                <View style={{ padding: 16 }}>
                  <Text style={styles.visitorName}>{amenity.name}</Text>
                  <Text style={styles.meta}>Capacity: {amenity.capacity}</Text>
                  <View style={styles.slotWrap}>
                    {amenity.slots.map((slot) => (
                      <Chip key={slot} onPress={() => handleBookSlot(amenity, slot)} style={styles.slotChip} textStyle={{ fontSize: 12, color: INK }}>{slot}</Chip>
                    ))}
                  </View>
                </View>
              </View>
            ))}

            <View style={styles.sectionHeaderRow}>
              <Avatar.Icon size={30} icon="calendar-clock" style={styles.sectionIcon} color={ACCENT} />
              <Text style={styles.sectionTitle}>My Bookings</Text>
            </View>
            {myBookings.length === 0 && <Text style={styles.empty}>No bookings yet</Text>}
            <FlatList data={myBookings} keyExtractor={(item) => item.id} scrollEnabled={false} ItemSeparatorComponent={() => <View style={{ height: 12 }} />} renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={{ padding: 16 }}>
                  <Text style={styles.visitorName}>{amenityNameFor(item.amenity_id)}</Text>
                  <Text style={styles.meta}>{item.booking_date} · {item.slot}</Text>
                </View>
                <Divider style={{ backgroundColor: BORDER }} />
                <View style={styles.cardActions}><Button compact textColor={DANGER} onPress={() => cancelMyBooking(item.id)}>Cancel</Button></View>
              </View>
            )} />
          </>
        )}

        {tab === 'staff' && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Avatar.Icon size={30} icon="account-hard-hat" style={styles.sectionIcon} color={ACCENT} />
              <Text style={styles.sectionTitle}>Staff & Service Directory</Text>
            </View>
            {staff.length === 0 && <Text style={styles.empty}>No entries yet</Text>}
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
              </View>
            ))}
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 14,
    backgroundColor: CARD_BG, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  eyebrow: { fontSize: 11, fontWeight: '700', color: ACCENT, letterSpacing: 1.5, marginBottom: 2 },
  title: { fontSize: 22, fontWeight: '700', color: INK },
  logoutBtn: { backgroundColor: ACCENT_SOFT, margin: 0 },
  tabBar: { backgroundColor: CARD_BG, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  tabChip: { backgroundColor: INPUT_BG },
  tabChipSelected: { backgroundColor: ACCENT },
  container: { padding: 20, paddingBottom: 12 },
  sectionCard: {
    marginBottom: 24, borderRadius: 20, backgroundColor: CARD_BG,
    borderWidth: 1, borderColor: BORDER, padding: 20,
    shadowColor: '#151329', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 18, elevation: 2,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  sectionIcon: { backgroundColor: ACCENT_SOFT },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: INK, flex: 1 },
  countBadge: { fontSize: 12, fontWeight: '700', color: '#fff', backgroundColor: ACCENT, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 12, overflow: 'hidden' },
  inputWrap: { backgroundColor: INPUT_BG, borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent', marginBottom: 14 },
  input: { backgroundColor: 'transparent' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  previewImage: { width: 60, height: 60, borderRadius: 12 },
  photoPlaceholder: { width: 60, height: 60, borderRadius: 12, backgroundColor: INPUT_BG, borderWidth: 1, borderColor: BORDER, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  photoButton: { flex: 1, borderColor: ACCENT },
  submitButton: { borderRadius: 14, marginTop: 4 },
  dateButton: { borderColor: ACCENT, borderRadius: 14, marginBottom: 14, backgroundColor: CARD_BG },
  chipSelectRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  card: { borderRadius: 18, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', padding: 12, gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowWithImage: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  visitorName: { fontSize: 16, fontWeight: '700', color: INK },
  meta: { color: INK_MUTED, marginTop: 3, fontSize: 13 },
  metaFaint: { color: INK_FAINT, marginTop: 4, fontSize: 12 },
  thumb: { width: 52, height: 52, borderRadius: 26 },
  thumbPlaceholder: { width: 52, height: 52, borderRadius: 26, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
  thumbInitial: { color: 'white', fontSize: 19, fontWeight: '700' },
  thumbSmall: { width: 40, height: 40, borderRadius: 20 },
  thumbPlaceholderSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
  thumbInitialSmall: { color: 'white', fontSize: 15, fontWeight: '700' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  historyName: { fontSize: 14, fontWeight: '600', color: INK },
  noticeBody: { color: INK_MUTED, marginTop: 4, lineHeight: 20 },
  pollOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  pollOptionText: { flex: 1, color: INK_MUTED },
  votedLabel: { color: SUCCESS, marginTop: 10, fontWeight: '600', fontSize: 13 },
  slotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  slotChip: { marginBottom: 4, backgroundColor: INPUT_BG },
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  empty: { color: INK_FAINT, fontSize: 14 },
});