import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function FixturesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fixtures</Text>
      <Text style={styles.description}>
        Real World Cup 2026 fixture data powered by API-Football.
        {'\n\n'}Browse group stage matches, knockout rounds, and live scores.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
  description: { fontSize: 14, color: '#888', textAlign: 'center' },
});
