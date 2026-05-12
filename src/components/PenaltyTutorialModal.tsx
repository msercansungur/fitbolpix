import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const SLIDES = [
  require('../../assets/penalty-tutorial/tutorial-1.png'),
  require('../../assets/penalty-tutorial/tutorial-2.png'),
  require('../../assets/penalty-tutorial/tutorial-3.png'),
  require('../../assets/penalty-tutorial/tutorial-4.png'),
];

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export default function PenaltyTutorialModal({ visible, onDismiss }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
      // Snap to first slide whenever the modal becomes visible
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    }
  }, [visible]);

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setCurrentIndex(idx);
  };

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.root}>
        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(_, i) => `tut-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumEnd}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <Image source={item} style={styles.image} resizeMode="contain" />
            </View>
          )}
        />

        {/* Close X — visible on all slides */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onDismiss}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Skip tutorial"
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        {/* Dot indicators */}
        <View style={styles.dotsRow} pointerEvents="none">
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIndex && styles.dotActive]}
            />
          ))}
        </View>

        {/* Got it! — only on last slide */}
        {isLastSlide && (
          <TouchableOpacity
            style={styles.gotItBtn}
            onPress={onDismiss}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Got it"
          >
            <Text style={styles.gotItText}>Got it!</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B171F',
  },
  slide: {
    width: SCREEN_W,
    height: SCREEN_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15,33,41,0.85)',
    borderWidth: 1,
    borderColor: '#1C3948',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeText: {
    color: '#F0F4F7',
    fontSize: 18,
    fontWeight: '700',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1C3948',
  },
  dotActive: {
    backgroundColor: '#FACE43',
  },
  gotItBtn: {
    position: 'absolute',
    bottom: 50,
    left: 40,
    right: 40,
    paddingVertical: 14,
    backgroundColor: '#FACE43',
    borderWidth: 1,
    borderColor: '#B98F1A',
    borderRadius: 8,
    alignItems: 'center',
  },
  gotItText: {
    fontFamily: 'BarlowCondensed_700Bold',
    color: '#0B171F',
    fontSize: 16,
    letterSpacing: 2,
    fontWeight: '800',
  },
});
