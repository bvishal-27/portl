import { useEffect, useState, memo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Alert, Image, Platform, Modal, Pressable } from 'react-native';
import { TextInput, Button, Chip, Avatar, Divider, IconButton } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { router } from 'expo-router';

// ---- Inline theme: light, minimal, premium (matches Login / Signup / Admin / Resident) ----
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
  entry_time: string | null;
  exit_time: string | null;
  pre_approved: boolean;
  created_at: string;
  visitors: { name: string; visitor_type: string; photo_url: string | null } | null;
  flats: { flat_number: string; tower_id: string } | null;
};
type Tower = { id: string; name: string };
type Flat = { id: string; tower_id: string; flat_number: string };
type MyGuardProfile = { full_name: string; phone: string | null };

const statusColor = (status: string) => {
  if (status === 'approved') return SUCCESS;
  if (status === 'denied') return DANGER;
  return GOLD;
};

const statusBg = (status: string) => {
  if (status === 'approved') return SUCCESS_BG;
  if (status === 'denied') return DANGER_BG;
  return '#FBF3E4';
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
  return (
    <View style={styles.card}>
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
                textStyle={{ color: statusColor(item.status), fontWeight: '600', fontSize: 12 }}
                style={{ backgroundColor: statusBg(item.status) }}
              >
                {item.pre_approved ? 'pre-approved' : item.status}
              </Chip>
            </View>
            <Text style={styles.meta}>Flat {item.flats?.flat_number} · {item.visitors?.visitor_type}</Text>
            <Text style={styles.metaFaint}>{new Date(item.created_at).toLocaleString()}</Text>
            {(item.entry_time || item.exit_time) && (
              <View style={styles.timeRow}>
                {item.entry_time && (
                  <View style={styles.timeChip}>
                    <Text style={styles.timeChipText}>In {new Date(item.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                )}
                {item.exit_time && (
                  <View style={styles.timeChip}>
                    <Text style={styles.timeChipText}>Out {new Date(item.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
      {((item.status === 'approved' && !item.entry_time) || (item.entry_time && !item.exit_time)) ? (
        <View>
          <Divider style={{ backgroundColor: BORDER }} />
          <View style={styles.cardActions}>
            {item.status === 'approved' && !item.entry_time && (
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
  const [tab, setTab] = useState('home');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [visitorType, setVisitorType] = useState('guest');
  const [customVisitorType, setCustomVisitorType] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const actionLoadingRef = useRef<string | null>(null);
  const [requests, setRequests] = useState<VisitorRequest[]>([]);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [filterTower, setFilterTower] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchFlat, setSearchFlat] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const userId = useAuthStore((s) => s.userId);
  const clearSession = useAuthStore((s) => s.clearSession);

  // ---- bottom nav / Profile page state ----
  const [profileOpen, setProfileOpen] = useState(false);
  const [myProfile, setMyProfile] = useState<MyGuardProfile | null>(null);

  useEffect(() => {
    actionLoadingRef.current = actionLoadingId;
  }, [actionLoadingId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearSession();
    router.replace('/(auth)/login');
  };

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('visitor_requests')
      .select('id, status, entry_time, exit_time, pre_approved, created_at, visitors(name, visitor_type, photo_url), flats(flat_number, tower_id)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error && data) setRequests(data as any);
  };

  const fetchTowers = async () => {
    const { data } = await supabase.from('towers').select('*').order('name');
    if (data) setTowers(data);
  };

  const fetchFlats = async () => {
    const { data } = await supabase.from('flats').select('*').order('flat_number');
    if (data) setFlats(data);
  };

  // Pulls name/phone for the Profile page. Read-only, additive — mirrors Admin/Resident's fetchMyProfile.
  const fetchMyProfile = async () => {
    const { data } = await supabase.from('profiles').select('full_name, phone').eq('id', userId).single();
    if (data) setMyProfile({ full_name: (data as any).full_name, phone: (data as any).phone ?? null });
  };

  useEffect(() => {
    fetchRequests();
    fetchTowers();
    fetchFlats();
    fetchMyProfile();

    const channel = supabase
      .channel('visitor_requests_guard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitor_requests' }, () => fetchRequests())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const uploadPhoto = async (uri: string): Promise<string | null> => {
    try {
      const fileName = `visitor_${Date.now()}.jpg`;
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const arrayBuffer = decode(base64);
      const { error } = await supabase.storage.from('portl-images').upload(fileName, arrayBuffer, { contentType: 'image/jpeg' });
      if (error) {
        console.log('Upload error:', error.message);
        return null;
      }
      const { data } = supabase.storage.from('portl-images').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (err) {
      console.log('Upload failed:', err);
      return null;
    }
  };

  const handleRegisterVisitor = async () => {
    if (loading) return;
    if (!name || !flatNumber) {
      Alert.alert('Missing info', 'Name and flat number are required');
      return;
    }
    if (visitorType === 'other' && !customVisitorType.trim()) {
      Alert.alert('Missing info', 'Please specify the visitor type');
      return;
    }
    setLoading(true);
    try {
      const { data: flat, error: flatError } = await supabase
        .from('flats')
        .select('id')
        .eq('flat_number', flatNumber)
        .single();

      if (flatError || !flat) {
        Alert.alert('Flat not found', `No flat with number "${flatNumber}"`);
        setLoading(false);
        return;
      }

      let photoUrl: string | null = null;
      if (photoUri) photoUrl = await uploadPhoto(photoUri);

      const finalVisitorType = visitorType === 'other' ? customVisitorType.trim() : visitorType;

      const { data: visitor, error: visitorError } = await supabase
        .from('visitors')
        .insert({ name, phone, visitor_type: finalVisitorType, photo_url: photoUrl })
        .select()
        .single();

      if (visitorError || !visitor) {
        Alert.alert('Error', visitorError?.message ?? 'Could not create visitor');
        setLoading(false);
        return;
      }

      const { error: requestError } = await supabase.from('visitor_requests').insert({
        visitor_id: visitor.id,
        flat_id: flat.id,
        requested_by: userId,
        status: 'pending',
      });

      if (requestError) {
        Alert.alert('Error', requestError.message);
        setLoading(false);
        return;
      }

      setName('');
      setPhone('');
      setFlatNumber('');
      setPhotoUri(null);
      setCustomVisitorType('');
      Alert.alert('Request sent', `${name}'s visit request was sent for approval`);
    } catch (err) {
      Alert.alert('Something went wrong', 'Please check your connection and try again');
    } finally {
      setLoading(false);
    }
  };

  const markEntry = useCallback(async (id: string) => {
    if (actionLoadingRef.current) return;
    actionLoadingRef.current = id;
    setActionLoadingId(id);
    try {
      const { error } = await supabase.from('visitor_requests').update({ entry_time: new Date().toISOString() }).eq('id', id);
      if (error) Alert.alert('Error', error.message);
    } catch {
      Alert.alert('Something went wrong', 'Please try again');
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
      const { error } = await supabase.from('visitor_requests').update({ exit_time: new Date().toISOString() }).eq('id', id);
      if (error) Alert.alert('Error', error.message);
    } catch {
      Alert.alert('Something went wrong', 'Please try again');
    } finally {
      actionLoadingRef.current = null;
      setActionLoadingId(null);
    }
  }, []);

  const activeFilterCount = (filterStatus !== 'all' ? 1 : 0) + (filterType !== 'all' ? 1 : 0) + (filterTower !== 'all' ? 1 : 0);

  let filtered = requests;
  if (filterStatus !== 'all') filtered = filtered.filter((r) => r.status === filterStatus);
  if (filterType !== 'all') filtered = filtered.filter((r) => r.visitors?.visitor_type === filterType);
  if (filterTower !== 'all') filtered = filtered.filter((r) => r.flats?.tower_id === filterTower);
  if (searchFlat.trim()) filtered = filtered.filter((r) => r.flats?.flat_number?.toLowerCase().includes(searchFlat.trim().toLowerCase()));

  filtered = [...filtered].sort((a, b) => {
    const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortOrder === 'newest' ? -diff : diff;
  });

  const inputTheme = { colors: { onSurfaceVariant: INK_MUTED, background: 'transparent', primary: ACCENT } };

  // ---- Derived, display-only values for the Home dashboard + Profile page (no new fetches) ----
  const firstName = myProfile?.full_name?.split(' ')[0] ?? 'Guard';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toDateString();
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const insideCount = requests.filter((r) => r.entry_time && !r.exit_time).length;
  const entriesTodayCount = requests.filter((r) => r.entry_time && new Date(r.entry_time).toDateString() === today).length;
  const awaitingApproval = requests.filter((r) => r.status === 'pending').slice(0, 3);
  const awaitingEntry = requests.filter((r) => r.status === 'approved' && !r.entry_time).slice(0, 3);

  const goToTab = (key: string) => {
    setTab(key);
    setProfileOpen(false);
  };

  return (
    <View style={styles.screen}>
      {/* ---------------- Top Header ---------------- */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.title}>{firstName}</Text>
          <View style={styles.roleBadge}>
            <IconButton icon="shield-account-outline" size={14} iconColor={ACCENT} style={{ margin: 0, marginRight: -4 }} />
            <Text style={styles.roleBadgeText}>Security Guard</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {tab === 'home' && (
          <>
            {/* Quick stats */}
            <View style={styles.statsRow}>
              <Pressable style={styles.statCard} onPress={() => goToTab('requests')}>
                <Text style={[styles.statNum, pendingCount > 0 && { color: GOLD }]}>{pendingCount}</Text>
                <Text style={styles.statLabel}>Awaiting Approval</Text>
              </Pressable>
              <Pressable style={styles.statCard} onPress={() => goToTab('requests')}>
                <Text style={styles.statNum}>{insideCount}</Text>
                <Text style={styles.statLabel}>Currently Inside</Text>
              </Pressable>
              <Pressable style={styles.statCard} onPress={() => goToTab('requests')}>
                <Text style={styles.statNum}>{entriesTodayCount}</Text>
                <Text style={styles.statLabel}>Entries Today</Text>
              </Pressable>
            </View>

            {/* Quick actions */}
            <Text style={styles.homeSectionLabel}>Quick Actions</Text>
            <View style={styles.quickActionsRow}>
              <Pressable style={styles.quickActionTile} onPress={() => goToTab('register')}>
                <Avatar.Icon size={40} icon="account-plus" style={{ backgroundColor: ACCENT_SOFT }} color={ACCENT} />
                <Text style={styles.quickActionLabel}>Register Visitor</Text>
              </Pressable>
              <Pressable style={styles.quickActionTile} onPress={() => goToTab('requests')}>
                <Avatar.Icon size={40} icon="account-clock" style={{ backgroundColor: ACCENT_SOFT }} color={ACCENT} />
                <Text style={styles.quickActionLabel}>Live Requests</Text>
              </Pressable>
            </View>

            {/* Awaiting entry preview — approved visitors not yet checked in */}
            {awaitingEntry.length > 0 && (
              <>
                <View style={[styles.sectionHeaderRow, { marginTop: 8 }]}>
                  <Avatar.Icon size={30} icon="login" style={styles.sectionIcon} color={ACCENT} />
                  <Text style={styles.sectionTitle}>Ready to Check In</Text>
                  <Pressable onPress={() => goToTab('requests')}><Text style={styles.viewAllLink}>View all</Text></Pressable>
                </View>
                {awaitingEntry.map((item) => (
                  <View key={item.id} style={[styles.card, { marginBottom: 12 }]}>
                    <View style={{ padding: 16 }}>
                      <View style={styles.rowWithImage}>
                        {item.visitors?.photo_url ? (
                          <Image source={{ uri: item.visitors.photo_url }} style={styles.thumb} />
                        ) : (
                          <View style={styles.thumbPlaceholder}><Text style={styles.thumbInitial}>{item.visitors?.name?.[0]?.toUpperCase() ?? '?'}</Text></View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.visitorName}>{item.visitors?.name}</Text>
                          <Text style={styles.meta}>Flat {item.flats?.flat_number} · {item.visitors?.visitor_type}</Text>
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

            {/* Awaiting admin approval preview */}
            <View style={[styles.sectionHeaderRow, { marginTop: awaitingEntry.length > 0 ? 8 : 8 }]}>
              <Avatar.Icon size={30} icon="clock-alert-outline" style={{ backgroundColor: '#FBF3E4' }} color={GOLD} />
              <Text style={styles.sectionTitle}>Awaiting Admin Approval</Text>
              <Pressable onPress={() => goToTab('requests')}><Text style={styles.viewAllLink}>View all</Text></Pressable>
            </View>
            {awaitingApproval.length === 0 ? (
              <View style={[styles.emptyState, { marginBottom: 12 }]}>
                <Avatar.Icon size={44} icon="check-circle-outline" style={{ backgroundColor: ACCENT_SOFT }} color={ACCENT} />
                <Text style={styles.empty}>Nothing waiting on admin right now</Text>
              </View>
            ) : (
              awaitingApproval.map((item) => (
                <View key={item.id} style={[styles.card, { marginBottom: 12 }]}>
                  <View style={{ padding: 16 }}>
                    <View style={styles.rowWithImage}>
                      {item.visitors?.photo_url ? (
                        <Image source={{ uri: item.visitors.photo_url }} style={styles.thumb} />
                      ) : (
                        <View style={styles.thumbPlaceholder}><Text style={styles.thumbInitial}>{item.visitors?.name?.[0]?.toUpperCase() ?? '?'}</Text></View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.visitorName}>{item.visitors?.name}</Text>
                        <Text style={styles.meta}>Flat {item.flats?.flat_number} · {item.visitors?.visitor_type}</Text>
                        <Text style={styles.metaFaint}>{new Date(item.created_at).toLocaleString()}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {tab === 'register' && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Avatar.Icon size={30} icon="account-plus" style={styles.sectionIcon} color={ACCENT} />
              <Text style={styles.sectionTitle}>Register Visitor</Text>
            </View>

            <View style={styles.inputWrap}>
              <TextInput mode="flat" label="Visitor Name" value={name} onChangeText={setName} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} />
            </View>
            <View style={styles.inputWrap}>
              <TextInput mode="flat" label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} />
            </View>
            <View style={styles.inputWrap}>
              <TextInput mode="flat" label="Flat Number" value={flatNumber} onChangeText={setFlatNumber} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} />
            </View>

            <Text style={styles.fieldLabel}>Visitor Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.segmentedScroll}>
              <View style={styles.typeChipRow}>
                {[
                  { value: 'guest', label: 'Guest', icon: 'account' },
                  { value: 'delivery', label: 'Delivery', icon: 'package-variant' },
                  { value: 'cab', label: 'Cab', icon: 'car' },
                  { value: 'service', label: 'Service', icon: 'wrench' },
                  { value: 'other', label: 'Other', icon: 'dots-horizontal' },
                ].map((opt) => (
                  <Chip
                    key={opt.value}
                    icon={opt.icon}
                    selected={visitorType === opt.value}
                    onPress={() => setVisitorType(opt.value)}
                    style={[styles.typeChip, visitorType === opt.value && styles.typeChipSelected]}
                    textStyle={visitorType === opt.value ? styles.typeChipTextSelected : styles.typeChipText}
                    selectedColor={ACCENT}
                  >
                    {opt.label}
                  </Chip>
                ))}
              </View>
            </ScrollView>

            {visitorType === 'other' && (
              <View style={styles.inputWrap}>
                <TextInput mode="flat" label="Specify visitor type" value={customVisitorType} onChangeText={setCustomVisitorType} style={styles.input} underlineColor="transparent" activeUnderlineColor="transparent" textColor={INK} theme={inputTheme} />
              </View>
            )}

            <View style={styles.photoRow}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.previewImage} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Avatar.Icon size={36} icon="camera" style={{ backgroundColor: 'transparent' }} color={INK_FAINT} />
                </View>
              )}
              <Button mode="outlined" onPress={pickPhoto} icon="camera" textColor={ACCENT} style={styles.photoButton}>
                {photoUri ? 'Retake Photo' : 'Take Visitor Photo'}
              </Button>
            </View>

            <Button mode="contained" onPress={handleRegisterVisitor} loading={loading} disabled={loading} buttonColor={ACCENT} textColor="#fff" style={styles.submitButton} contentStyle={{ paddingVertical: 4 }}>
              Send Approval Request
            </Button>
          </View>
        )}

        {tab === 'requests' && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Avatar.Icon size={30} icon="account-clock" style={styles.sectionIcon} color={ACCENT} />
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
                left={<TextInput.Icon icon="magnify" color={INK_FAINT} />}
                right={searchFlat ? <TextInput.Icon icon="close" color={INK_FAINT} onPress={() => setSearchFlat('')} /> : undefined}
              />
            </View>

            <View style={styles.toolbarRow}>
              <Chip
                icon="filter-variant"
                selected={filtersOpen}
                onPress={() => setFiltersOpen((v) => !v)}
                style={[styles.toolbarChip, filtersOpen && styles.chipSelected]}
                textStyle={filtersOpen ? styles.chipTextSelected : styles.chipText}
                selectedColor={ACCENT}
              >
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </Chip>
              <Button
                compact
                mode="text"
                icon={sortOrder === 'newest' ? 'sort-clock-descending' : 'sort-clock-ascending'}
                textColor={ACCENT}
                onPress={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              >
                {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
              </Button>
            </View>

            {filtersOpen && (
              <View style={styles.filterCard}>
                <Text style={styles.filterLabel}>Status</Text>
                <View style={styles.filterRow}>
                  {['all', 'pending', 'approved', 'denied'].map((f) => (
                    <Chip key={f} selected={filterStatus === f} onPress={() => setFilterStatus(f)} style={[styles.filterChip, filterStatus === f && styles.chipSelected]} textStyle={filterStatus === f ? styles.chipTextSelected : styles.chipText} selectedColor={ACCENT}>
                      {f}
                    </Chip>
                  ))}
                </View>

                <Text style={styles.filterLabel}>Visitor Type</Text>
                <View style={styles.filterRow}>
                  {['all', 'guest', 'delivery', 'cab', 'service', 'other'].map((f) => (
                    <Chip key={f} selected={filterType === f} onPress={() => setFilterType(f)} style={[styles.filterChip, filterType === f && styles.chipSelected]} textStyle={filterType === f ? styles.chipTextSelected : styles.chipText} selectedColor={ACCENT}>
                      {f}
                    </Chip>
                  ))}
                </View>

                {towers.length > 0 && (
                  <>
                    <Text style={styles.filterLabel}>Tower</Text>
                    <View style={styles.filterRow}>
                      <Chip selected={filterTower === 'all'} onPress={() => setFilterTower('all')} style={[styles.filterChip, filterTower === 'all' && styles.chipSelected]} textStyle={filterTower === 'all' ? styles.chipTextSelected : styles.chipText} selectedColor={ACCENT}>
                        all
                      </Chip>
                      {towers.map((t) => (
                        <Chip key={t.id} selected={filterTower === t.id} onPress={() => setFilterTower(t.id)} style={[styles.filterChip, filterTower === t.id && styles.chipSelected]} textStyle={filterTower === t.id ? styles.chipTextSelected : styles.chipText} selectedColor={ACCENT}>
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
                <Avatar.Icon size={48} icon="clipboard-search-outline" style={{ backgroundColor: ACCENT_SOFT }} color={ACCENT} />
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

        {/* extra bottom padding so content never sits under the fixed bottom nav */}
        <View style={{ height: 90 }} />
      </ScrollView>

      {/* ---------------- Bottom Nav Bar ---------------- */}
      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem} onPress={() => setTab('home')} hitSlop={8}>
          <View style={[styles.navIconWrap, tab === 'home' && styles.navIconWrapActive]}>
            <IconButton icon="home-variant" size={22} iconColor={tab === 'home' ? ACCENT : INK_FAINT} style={{ margin: 0 }} />
          </View>
          <Text style={[styles.navLabel, tab === 'home' && styles.navLabelActive]}>Home</Text>
        </Pressable>

        <Pressable style={styles.navItem} onPress={() => setTab('register')} hitSlop={8}>
          <View style={[styles.navIconWrap, tab === 'register' && styles.navIconWrapActive]}>
            <IconButton icon="account-plus-outline" size={22} iconColor={tab === 'register' ? ACCENT : INK_FAINT} style={{ margin: 0 }} />
          </View>
          <Text style={[styles.navLabel, tab === 'register' && styles.navLabelActive]}>Register</Text>
        </Pressable>

        <Pressable style={styles.navItem} onPress={() => setTab('requests')} hitSlop={8}>
          <View style={[styles.navIconWrap, tab === 'requests' && styles.navIconWrapActive]}>
            <IconButton icon="account-clock-outline" size={22} iconColor={tab === 'requests' ? ACCENT : INK_FAINT} style={{ margin: 0 }} />
            {pendingCount > 0 && tab !== 'requests' && <View style={styles.navDot} />}
          </View>
          <Text style={[styles.navLabel, tab === 'requests' && styles.navLabelActive]}>Requests</Text>
        </Pressable>

        <Pressable style={styles.navItem} onPress={() => setProfileOpen(true)} hitSlop={8}>
          <View style={styles.navIconWrap}>
            <View style={styles.navAvatar}>
              <Text style={styles.navAvatarInitial}>{myProfile?.full_name?.[0]?.toUpperCase() ?? 'G'}</Text>
            </View>
          </View>
          <Text style={styles.navLabel}>Profile</Text>
        </Pressable>
      </View>

      {/* ---------------- Profile — full page, about you only ---------------- */}
      <Modal visible={profileOpen} animationType="slide" onRequestClose={() => setProfileOpen(false)}>
        <View style={styles.profileScreen}>
          <View style={styles.profileTopBar}>
            <IconButton icon="arrow-left" size={24} iconColor={INK} onPress={() => setProfileOpen(false)} style={{ margin: 0 }} />
            <Text style={styles.profileTopBarTitle}>Profile</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {/* Identity card */}
            <View style={styles.profileIdCard}>
              <View style={styles.profileBigAvatar}>
                <Text style={styles.profileBigAvatarInitial}>{myProfile?.full_name?.[0]?.toUpperCase() ?? 'G'}</Text>
              </View>
              <Text style={styles.profileBigName}>{myProfile?.full_name ?? 'Guard'}</Text>
              <View style={styles.profileRoleChip}>
                <IconButton icon="shield-account-outline" size={16} iconColor={ACCENT} style={{ margin: 0, marginRight: -4 }} />
                <Text style={styles.profileRoleChipText}>Security Guard</Text>
              </View>
              {myProfile?.phone ? (
                <View style={styles.profilePhoneRow}>
                  <IconButton icon="phone-outline" size={16} iconColor={INK_MUTED} style={{ margin: 0 }} />
                  <Text style={styles.profilePhoneText}>{myProfile.phone}</Text>
                </View>
              ) : null}
            </View>

            {/* Stats — read-only summary of the shift, not navigation */}
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

            {/* Log out */}
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

  // ---- Header ----
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 18,
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

  // ---- Home dashboard ----
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  statCard: { flex: 1, borderRadius: 16, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, alignItems: 'center', paddingVertical: 14 },
  statNum: { fontSize: 20, fontWeight: '800', color: INK },
  statLabel: { fontSize: 11, color: INK_MUTED, marginTop: 4, textAlign: 'center', fontWeight: '600' },
  homeSectionLabel: { fontSize: 13, fontWeight: '700', color: INK_MUTED, marginBottom: 10, letterSpacing: 0.3, textTransform: 'uppercase' },
  quickActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  quickActionTile: { flex: 1, alignItems: 'center', gap: 8 },
  quickActionLabel: { fontSize: 11, color: INK_MUTED, fontWeight: '600', textAlign: 'center' },
  viewAllLink: { fontSize: 13, fontWeight: '700', color: ACCENT },

  sectionCard: {
    marginBottom: 24,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    shadowColor: '#151329',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  sectionIcon: { backgroundColor: ACCENT_SOFT },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: INK, flex: 1 },
  countBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: ACCENT,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    overflow: 'hidden',
  },

  fieldLabel: { fontSize: 12, fontWeight: '600', color: INK_MUTED, marginBottom: 8, marginTop: 2 },

  inputWrap: {
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: 14,
  },
  input: { backgroundColor: 'transparent' },

  segmentedScroll: { marginBottom: 14 },
  typeChipRow: { flexDirection: 'row', gap: 8 },
  typeChip: { backgroundColor: INPUT_BG, borderWidth: 1, borderColor: 'transparent' },
  typeChipSelected: { backgroundColor: ACCENT_SOFT, borderColor: ACCENT },
  typeChipText: { color: INK_MUTED },
  typeChipTextSelected: { color: INK, fontWeight: '700' },

  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  previewImage: { width: 64, height: 64, borderRadius: 12 },
  photoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoButton: { flex: 1, borderColor: ACCENT },
  submitButton: { borderRadius: 14, marginTop: 4 },

  toolbarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  toolbarChip: { backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER },
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
    overflow: 'hidden',
  },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', padding: 12, gap: 8 },
  actionBtn: { borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowWithImage: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  visitorName: { fontSize: 16, fontWeight: '700', color: INK, flexShrink: 1 },
  meta: { color: INK_MUTED, marginTop: 3, fontSize: 13 },
  metaFaint: { color: INK_FAINT, marginTop: 2, fontSize: 12 },
  thumb: { width: 52, height: 52, borderRadius: 26 },
  thumbPlaceholder: { width: 52, height: 52, borderRadius: 26, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
  thumbInitial: { color: 'white', fontSize: 19, fontWeight: '700' },

  timeRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  timeChip: { backgroundColor: ACCENT_SOFT, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  timeChipText: { fontSize: 11, fontWeight: '600', color: ACCENT },

  filterLabel: { fontSize: 12, fontWeight: '600', color: INK_MUTED, marginBottom: 6, marginTop: 6 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  filterChip: { marginBottom: 4, backgroundColor: INPUT_BG, borderWidth: 1, borderColor: 'transparent' },
  chipSelected: { backgroundColor: ACCENT_SOFT, borderColor: ACCENT },
  chipText: { color: INK_MUTED },
  chipTextSelected: { color: INK, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  empty: { color: INK_FAINT, fontSize: 14 },

  // ---- Bottom Nav ----
  bottomNav: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 12,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIconWrap: { width: 44, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  navIconWrapActive: { backgroundColor: ACCENT_SOFT },
  navDot: { position: 'absolute', top: 2, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: DANGER, borderWidth: 1.5, borderColor: CARD_BG },
  navLabel: { fontSize: 11, color: INK_FAINT, fontWeight: '600', marginTop: 2 },
  navLabelActive: { color: ACCENT },
  navAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
  navAvatarInitial: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // ---- Full Profile page (about you only) ----
  profileScreen: { flex: 1, backgroundColor: PAGE_BG },
  profileTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 8, paddingBottom: 12,
    backgroundColor: CARD_BG, borderBottomWidth: 1, borderBottomColor: BORDER,
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
    flexDirection: 'row', alignItems: 'center', backgroundColor: ACCENT_SOFT,
    borderRadius: 20, paddingLeft: 8, paddingRight: 14, paddingVertical: 5, marginTop: 10,
  },
  profileRoleChipText: { fontSize: 13, fontWeight: '700', color: ACCENT },
  profilePhoneRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  profilePhoneText: { fontSize: 14, color: INK_MUTED, fontWeight: '600' },

  profileSectionLabel: { fontSize: 13, fontWeight: '700', color: INK_MUTED, marginBottom: 10, marginLeft: 4, letterSpacing: 0.3, textTransform: 'uppercase' },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  statTile: {
    flex: 1, backgroundColor: CARD_BG, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', paddingVertical: 16,
  },
  statTileNum: { fontSize: 20, fontWeight: '800', color: INK },
  statTileLabel: { fontSize: 11, color: INK_MUTED, marginTop: 4, textAlign: 'center', fontWeight: '600' },

  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: DANGER_BG, borderRadius: 16, paddingVertical: 14,
  },
  logoutButtonText: { color: DANGER, fontSize: 15, fontWeight: '700' },
});