import { View, Text, StyleSheet } from 'react-native';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>P2P Storage Vault</Text>
      <Text style={styles.subtitle}>Decentralized File Storage</Text>
      <Text style={styles.status}>App loaded successfully!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D1B2A',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#42A5F5',
  },
  subtitle: {
    fontSize: 16,
    color: '#90CAF9',
    marginTop: 8,
  },
  status: {
    fontSize: 14,
    color: '#66BB6A',
    marginTop: 20,
  },
});