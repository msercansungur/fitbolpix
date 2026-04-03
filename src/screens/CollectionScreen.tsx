import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CollectionScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Collection</Text>
      <Text style={styles.description}>
        Player card collection with pack opening.
        {'\n\n'}Earn packs by playing matches and tournaments.
        {'\n\n'}Collect pixel art player cards from all 48 World Cup nations.
        {'\n\n'}Premium packs available via IAP.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
  description: { fontSize: 14, color: '#888', textAlign: 'center' },
});
