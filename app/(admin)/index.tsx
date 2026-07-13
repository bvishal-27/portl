import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Button, Card, Chip } from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { router } from 'expo-router';

type VisitorRequest = {
  id: string;
  status: string;
  pre_approved: boolean;
  entry_time: string | null;
  exit_time: string | null;
  created_at: string;
  visitors: { name: string; visitor_type: string } | null;
  flats: { flat_number: string } | null;
};

export default function AdminHome() {
  const [requests, setRequests] = useState<VisitorRequest[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const clearSession = useAuthStore((s) => s.clearSession);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearSession();
    router.replace('/(auth)/login');
  };

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('visitor_requests')
      .select('id, status, pre_approved, entry_time, exit_time, created_at, visitors(name, visitor_type), flats(flat_number)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) setRequests(data as any);
  };

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel('visitor_requests_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitor_requests' }, () => fetchRequests())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const today = new Date().toDateString();
  const todayCount = requests.filter((r) => new Date(r.created_at).toDateString() === today).length;
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter);

  const statusColor = (status: string) => {
    if (status === 'approved') return '#2e7d32';
    if (status === 'denied') return '#c62828';
    return '#ef6c00';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Dashboard</Text>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Card.Content>
            <Text style={styles.statNum}>{todayCount}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </Card.Content>
        </Card>
        <Card style={styles.statCard}>
          <Card.Content>
            <Text style={styles.statNum}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </Card.Content>
        </Card>
        <Card style={styles.statCard}>
          <Card.Content>
            <Text style={styles.statNum}>{requests.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </Card.Content>
        </Card>
      </View>

      <Text style={styles.section}>Society Visitor Log</Text>
      <View style={styles.filterRow}>
        {['all', 'pending', 'approved', 'denied'].map((f) => (
          <Chip key={f} selected={filter === f} onPress={() => setFilter(f)} style={styles.filterChip}>
            {f}
          </Chip>
        ))}
      </View>

      {filtered.length === 0 && <Text style={styles.empty}>No visitor records</Text>}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <Text style={styles.visitorName}>{item.visitors?.name}</Text>
                <Chip textStyle={{ color: 'white', fontSize: 12 }} style={{ backgroundColor: statusColor(item.status) }}>
                  {item.pre_approved ? 'pre-approved' : item.status}
                </Chip>
              </View>
              <Text style={styles.meta}>
                Flat {item.flats?.flat_number} · {item.visitors?.visitor_type}
              </Text>
              <Text style={styles.meta}>{new Date(item.created_at).toLocaleString()}</Text>
            </Card.Content>
          </Card>
        )}
      />

      <Button mode="outlined" onPress={handleLogout} style={{ marginTop: 20 }}>Log Out</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1 },
  statNum: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  statLabel: { fontSize: 12, color: '#666', textAlign: 'center' },
  section: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  filterChip: { marginBottom: 4 },
  empty: { color: '#888', fontStyle: 'italic', marginBottom: 12 },
  card: { marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  visitorName: { fontSize: 15, fontWeight: '600' },
  meta: { color: '#666', marginTop: 2, fontSize: 13 },
});