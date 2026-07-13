import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Alert } from 'react-native';
import { TextInput, Button, SegmentedButtons, Card, Chip } from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { router } from 'expo-router';

type VisitorRequest = {
  id: string;
  status: string;
  entry_time: string | null;
  exit_time: string | null;
  pre_approved: boolean;
  visitors: { name: string; visitor_type: string } | null;
  flats: { flat_number: string } | null;
};

export default function GuardHome() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [visitorType, setVisitorType] = useState('guest');
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<VisitorRequest[]>([]);
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
      .select('id, status, entry_time, exit_time, pre_approved, visitors(name, visitor_type), flats(flat_number)')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) setRequests(data as any);
  };

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel('visitor_requests_guard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visitor_requests' },
        () => fetchRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRegisterVisitor = async () => {
    if (!name || !flatNumber) {
      Alert.alert('Missing info', 'Name and flat number are required');
      return;
    }
    setLoading(true);

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

    const { data: visitor, error: visitorError } = await supabase
      .from('visitors')
      .insert({ name, phone, visitor_type: visitorType })
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
    setLoading(false);
  };

  const markEntry = async (id: string) => {
    const { error } = await supabase
      .from('visitor_requests')
      .update({ entry_time: new Date().toISOString() })
      .eq('id', id);
    if (error) Alert.alert('Error', error.message);
  };

  const markExit = async (id: string) => {
    const { error } = await supabase
      .from('visitor_requests')
      .update({ exit_time: new Date().toISOString() })
      .eq('id', id);
    if (error) Alert.alert('Error', error.message);
  };

  const statusColor = (status: string) => {
    if (status === 'approved') return '#2e7d32';
    if (status === 'denied') return '#c62828';
    return '#ef6c00';
  };

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
      <Button mode="contained" onPress={handleRegisterVisitor} loading={loading} style={styles.input}>
        Send Approval Request
      </Button>

      <Text style={styles.section}>Live Requests</Text>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <Text style={styles.visitorName}>{item.visitors?.name}</Text>
                <Chip textStyle={{ color: 'white' }} style={{ backgroundColor: statusColor(item.status) }}>
                  {item.pre_approved ? 'pre-approved' : item.status}
                </Chip>
              </View>
              <Text style={styles.meta}>Flat {item.flats?.flat_number} · {item.visitors?.visitor_type}</Text>
              {item.entry_time && <Text style={styles.meta}>Entered: {new Date(item.entry_time).toLocaleTimeString()}</Text>}
              {item.exit_time && <Text style={styles.meta}>Exited: {new Date(item.exit_time).toLocaleTimeString()}</Text>}
            </Card.Content>
            {item.status === 'approved' && !item.entry_time && (
              <Card.Actions>
                <Button mode="contained" onPress={() => markEntry(item.id)}>Mark Entry</Button>
              </Card.Actions>
            )}
            {item.entry_time && !item.exit_time && (
              <Card.Actions>
                <Button mode="outlined" onPress={() => markExit(item.id)}>Mark Exit</Button>
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
  visitorName: { fontSize: 16, fontWeight: '600' },
  meta: { color: '#666', marginTop: 4 },
});