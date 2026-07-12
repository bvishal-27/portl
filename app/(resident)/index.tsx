import { View, Text, StyleSheet } from 'react-native';

export default function ResidentHome() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Resident Dashboard</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 18, fontWeight: '600' },
});