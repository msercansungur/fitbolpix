import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SimulatorScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Match Simulator</Text>
      <Text style={styles.description}>
        Chaotic pixel art football match simulator.
        {'\n\n'}Watch procedurally generated matches unfold with Turkish & global meme commentary.
        {'\n\n'}Includes a playable penalty shootout mini-game.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
  description: { fontSize: 14, color: '#888', textAlign: 'center' },
});
