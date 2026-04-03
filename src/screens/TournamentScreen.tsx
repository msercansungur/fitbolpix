import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function TournamentScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tournament</Text>
      <Text style={styles.description}>
        Full World Cup 2026 tournament mode.
        {'\n\n'}Pick your nation, play through the group stage, survive knockouts, and win the final.
        {'\n\n'}Each match is a pixel art simulation with meme commentary.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
  description: { fontSize: 14, color: '#888', textAlign: 'center' },
});
