import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
import { Button, Card } from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { router } from 'expo-router';

type VisitorRequest = {
  id: string;
  status: string;
  created_at: string;
  visitors: { name: string; phone: string; visitor_type: string } | null;
};

export default function ResidentHome() {
  const [requests, setRequests] = useState<VisitorRequest[]>([]);
  const [flatId, setFlatId] = useState<string | null>(null);
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
      .select('id, status, created_at, visitors(name, phone, visitor_type)')
      .eq('flat_id', currentFlatId)
      .order('created_at', { ascending: false });

    if (!error && data) setRequests(data as any);
  };

  useEffect(() => {
    const init = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('flat_id')
        .eq('id', userId)
        .single();

      if (!profile?.flat_id) return;
      setFlatId(profile.flat_id);
      fetchRequests(profile.flat_id);

      // Realtime subscription — this is the magic part
      const channel = supabase
        .channel('visitor_requests_resident')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'visitor_requests', filter: `flat_id=eq.${profile.flat_id}` },
          () => {
            fetchRequests(profile.flat_id);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };
    init();
  }, [userId]);

  const respondToRequest = async (requestId: string, status: 'approved' | 'denied') => {
    const { error } = await supabase
      .from('visitor_requests')
      .update({ status })
      .eq('id', requestId);

    if (error) Alert.alert('Error', error.message);
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const pastRequests = requests.filter((r) => r.status !== 'pending');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Resident Dashboard</Text>

      <Text style={styles.section}>Pending Approvals</Text>
      {pendingRequests.length === 0 && <Text style={styles.empty}>No pending requests</Text>}
      <FlatList
        data={pendingRequests}
        keyExtractor={(item) => item.id}
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
      <FlatList
        data={pastRequests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.historyRow}>
            <Text>{item.visitors?.name} — {item.status}</Text>
          </View>
        )}
      />

      <Button mode="outlined" onPress={handleLogout} style={{ marginTop: 20 }}>Log Out</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  section: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  empty: { color: '#888', fontStyle: 'italic' },
  card: { marginBottom: 12 },
  visitorName: { fontSize: 16, fontWeight: '600' },
  visitorType: { color: '#666', textTransform: 'capitalize' },
  historyRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#eee' },
});