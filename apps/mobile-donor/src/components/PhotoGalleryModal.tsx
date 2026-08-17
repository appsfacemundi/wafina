import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Photo } from './Photo';
import { radius, spacing } from '@/theme/tokens';

interface PhotoGalleryModalProps {
  visible: boolean;
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
}

/**
 * V2 multi-photo (2026-08-17) — full-screen swipeable viewer for a
 * donation's full Photos array, opened by tapping the cover thumbnail on a
 * donation card. Renders nothing when there's nothing to show, so callers
 * can pass `visible` unconditionally without a separate `photos.length`
 * check at the call site.
 */
export function PhotoGalleryModal({ visible, photos, initialIndex = 0, onClose }: PhotoGalleryModalProps) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);

  if (!visible || photos.length === 0) return null;

  function onMomentumScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={styles.closeBtn}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          hitSlop={12}
        >
          <Ionicons name="close" size={26} color="#ffffff" />
        </Pressable>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          contentOffset={{ x: initialIndex * width, y: 0 }}
        >
          {photos.map((uri, i) => (
            <View key={`${uri}-${i}`} style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
              <Photo uri={uri} style={styles.fullPhoto} resizeMode="contain" />
            </View>
          ))}
        </ScrollView>
        {photos.length > 1 && (
          <View style={styles.pageIndicator}>
            <Text style={styles.pageIndicatorText}>
              {index + 1}/{photos.length}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 8, 10, 0.94)',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 56,
    right: spacing[5],
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullPhoto: {
    width: '100%',
    height: '100%',
  },
  pageIndicator: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  pageIndicatorText: {
    fontFamily: 'Manrope-700',
    fontSize: 13,
    color: '#ffffff',
  },
});
