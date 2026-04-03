import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fitbolpix</Text>
      <Text style={styles.subtitle}>World Cup 2026 Companion</Text>
      <Text style={styles.description}>
        Live scores, match simulator, tournament mode, and card collection — all in chaotic pixel art.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 18, color: '#555', marginBottom: 16 },
  description: { fontSize: 14, color: '#888', textAlign: 'center' },
});
