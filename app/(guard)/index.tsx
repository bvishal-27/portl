import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Alert, Image } from 'react-native';
import { TextInput, Button, SegmentedButtons, Card, Chip } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { router } from 'expo-router';

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

export default function GuardHome() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [visitorType, setVisitorType] = useState('guest');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [requests, setRequests] = useState<VisitorRequest[]>([]);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [filterTower, setFilterTower] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchFlat, setSearchFlat] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const userId = useAuthStore((s) => s.userId);
  const clearSession = useAuthStore((s) => s.clearSession);

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
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      allowsEditing: true,
      aspect: [1, 1],
    });
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

      const { data: visitor, error: visitorError } = await supabase
        .from('visitors')
        .insert({ name, phone, visitor_type: visitorType, photo_url: photoUrl })
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
    } catch (err) {
      Alert.alert('Something went wrong', 'Please check your connection and try again');
    } finally {
      setLoading(false);
    }
  };

  const markEntry = async (id: string) => {
    if (actionLoadingId) return;
    setActionLoadingId(id);
    try {
      const { error } = await supabase.from('visitor_requests').update({ entry_time: new Date().toISOString() }).eq('id', id);
      if (error) Alert.alert('Error', error.message);
    } catch {
      Alert.alert('Something went wrong', 'Please try again');
    } finally {
      setActionLoadingId(null);
    }
  };

  const markExit = async (id: string) => {
    if (actionLoadingId) return;
    setActionLoadingId(id);
    try {
      const { error } = await supabase.from('visitor_requests').update({ exit_time: new Date().toISOString() }).eq('id', id);
      if (error) Alert.alert('Error', error.message);
    } catch {
      Alert.alert('Something went wrong', 'Please try again');
    } finally {
      setActionLoadingId(null);
    }
  };

  const statusColor = (status: string) => {
    if (status === 'approved') return '#2e7d32';
    if (status === 'denied') return '#c62828';
    return '#ef6c00';
  };

  // Apply filters
  let filtered = requests;
  if (filterStatus !== 'all') filtered = filtered.filter((r) => r.status === filterStatus);
  if (filterType !== 'all') filtered = filtered.filter((r) => r.visitors?.visitor_type === filterType);
  if (filterTower !== 'all') filtered = filtered.filter((r) => r.flats?.tower_id === filterTower);
  if (searchFlat.trim()) filtered = filtered.filter((r) => r.flats?.flat_number?.toLowerCase().includes(searchFlat.trim().toLowerCase()));

  filtered = [...filtered].sort((a, b) => {
    const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortOrder === 'newest' ? -diff : diff;
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Guard Dashboard</Text>

      <Text style={styles.section}>Register Visitor</Text>
      <TextInput label="Visitor Name" value={name} onChangeText={setName} style={styles.input} />
      <TextInput label="Phone (optional)" value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" />
      <TextInput label="Flat Number" value={flatNumber} onChangeText={setFlatNumber} style={styles.input} />
      <SegmentedButtons
        value={visitorType}
        onValueChange={setVisitorType}
        style={styles.input}
        buttons={[
          { value: 'guest', label: 'Guest' },
          { value: 'delivery', label: 'Delivery' },
          { value: 'cab', label: 'Cab' },
          { value: 'service', label: 'Service' },
        ]}
      />
      <Button mode="outlined" onPress={pickPhoto} style={styles.input}>
        {photoUri ? 'Retake Photo' : 'Take Visitor Photo'}
      </Button>
      {photoUri && <Image source={{ uri: photoUri }} style={styles.previewImage} />}
      <Button mode="contained" onPress={handleRegisterVisitor} loading={loading} disabled={loading} style={styles.input}>
        Send Approval Request
      </Button>

      <Text style={styles.section}>Live Requests</Text>

      <TextInput
        label="Search by flat number"
        value={searchFlat}
        onChangeText={setSearchFlat}
        style={styles.input}
        left={<TextInput.Icon icon="magnify" />}
      />

      <Text style={styles.filterLabel}>Status</Text>
      <View style={styles.filterRow}>
        {['all', 'pending', 'approved', 'denied'].map((f) => (
          <Chip key={f} selected={filterStatus === f} onPress={() => setFilterStatus(f)} style={styles.filterChip}>{f}</Chip>
        ))}
      </View>

      <Text style={styles.filterLabel}>Visitor Type</Text>
      <View style={styles.filterRow}>
        {['all', 'guest', 'delivery', 'cab', 'service'].map((f) => (
          <Chip key={f} selected={filterType === f} onPress={() => setFilterType(f)} style={styles.filterChip}>{f}</Chip>
        ))}
      </View>

      {towers.length > 0 && (
        <>
          <Text style={styles.filterLabel}>Tower</Text>
          <View style={styles.filterRow}>
            <Chip selected={filterTower === 'all'} onPress={() => setFilterTower('all')} style={styles.filterChip}>all</Chip>
            {towers.map((t) => (
              <Chip key={t.id} selected={filterTower === t.id} onPress={() => setFilterTower(t.id)} style={styles.filterChip}>{t.name}</Chip>
            ))}
          </View>
        </>
      )}

      <Button
        compact
        mode="text"
        onPress={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
        style={{ alignSelf: 'flex-start', marginBottom: 8 }}
      >
        Sort: {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
      </Button>

      {filtered.length === 0 && <Text style={styles.empty}>No matching requests</Text>}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
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
                    <Text style={styles.visitorName}>{item.visitors?.name}</Text>
                    <Chip textStyle={{ color: 'white' }} style={{ backgroundColor: statusColor(item.status) }}>
                      {item.pre_approved ? 'pre-approved' : item.status}
                    </Chip>
                  </View>
                  <Text style={styles.meta}>Flat {item.flats?.flat_number} · {item.visitors?.visitor_type}</Text>
                  <Text style={styles.meta}>{new Date(item.created_at).toLocaleString()}</Text>
                  {item.entry_time && <Text style={styles.meta}>Entered: {new Date(item.entry_time).toLocaleTimeString()}</Text>}
                  {item.exit_time && <Text style={styles.meta}>Exited: {new Date(item.exit_time).toLocaleTimeString()}</Text>}
                </View>
              </View>
            </Card.Content>
            {item.status === 'approved' && !item.entry_time && (
              <Card.Actions>
                <Button mode="contained" loading={actionLoadingId === item.id} disabled={actionLoadingId === item.id} onPress={() => markEntry(item.id)}>Mark Entry</Button>
              </Card.Actions>
            )}
            {item.entry_time && !item.exit_time && (
              <Card.Actions>
                <Button mode="outlined" loading={actionLoadingId === item.id} disabled={actionLoadingId === item.id} onPress={() => markExit(item.id)}>Mark Exit</Button>
              </Card.Actions>
            )}
          </Card>
        )}
      />

      <Button mode="outlined" onPress={handleLogout} style={{ marginTop: 20 }}>Log Out</Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  section: { fontSize: 16, fontWeight: '600', marginTop: 20, marginBottom: 10 },
  input: { marginBottom: 14 },
  card: { marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowWithImage: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  visitorName: { fontSize: 16, fontWeight: '600' },
  meta: { color: '#666', marginTop: 4 },
  previewImage: { width: 80, height: 80, borderRadius: 8, marginBottom: 14 },
  thumb: { width: 56, height: 56, borderRadius: 28 },
  thumbPlaceholder: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#673AB7', justifyContent: 'center', alignItems: 'center' },
  thumbInitial: { color: 'white', fontSize: 20, fontWeight: '700' },
  filterLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 4 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  filterChip: { marginBottom: 4 },
  empty: { color: '#888', fontStyle: 'italic', marginBottom: 12 },
});