import { useEffect, useState, memo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Alert, Image } from 'react-native';
import { TextInput, Button, Chip, Avatar, Divider, IconButton } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { router } from 'expo-router';

// ---- Inline theme: light, minimal, premium (matches Login / Signup) ----
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

  useEffect(() => {
    fetchRequests();
    fetchTowers();
    fetchFlats();

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

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>PORTL</Text>
          <Text style={styles.title}>Guard Dashboard</Text>
        </View>
        <IconButton icon="logout" size={22} iconColor={ACCENT} onPress={handleLogout} style={styles.logoutBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
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

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAGE_BG },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: CARD_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  eyebrow: { fontSize: 11, fontWeight: '700', color: ACCENT, letterSpacing: 1.5, marginBottom: 2 },
  title: { fontSize: 22, fontWeight: '700', color: INK },
  logoutBtn: { backgroundColor: ACCENT_SOFT, margin: 0 },
  container: { padding: 20, paddingBottom: 12 },

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
});