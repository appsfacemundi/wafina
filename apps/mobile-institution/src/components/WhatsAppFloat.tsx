import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type PanResponderGestureState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme/tokens';

const WHATSAPP_URL = 'https://wa.me/351930935925';
const BUTTON_SIZE = 40;
const SCREEN = Dimensions.get('window');

/**
 * RC1 UX addition, 2026-08-10 — small floating WhatsApp contact button,
 * mirrors the web AppShell version. Rendered as a sibling to the root
 * navigator (same pattern as SwitchCountryPrompt) so it floats above every
 * authenticated screen. Dismissing it is deliberately session-only (no
 * persistence) — relaunching the app always shows it again.
 *
 * Draggable, 2026-08-10 — the user can drag it anywhere on screen. Position
 * tracking uses JS-driven Animated (useNativeDriver: false) deliberately:
 * PanResponder's move handler crashed on a real Android device when it was
 * native-driven (see ReceberScreen's swipe-card fix for the same issue).
 */
export function WhatsAppFloat() {
  const insets = useSafeAreaInsets();
  const [dismissed, setDismissed] = useState(false);

  const defaultX = SCREEN.width - BUTTON_SIZE - spacing[5];
  const defaultY = SCREEN.height - BUTTON_SIZE - insets.bottom - spacing[10];
  const pan = useRef(new Animated.ValueXY({ x: defaultX, y: defaultY })).current;
  const latestPos = useRef({ x: defaultX, y: defaultY });
  const draggedRef = useRef(false);

  useEffect(() => {
    const xId = pan.x.addListener(({ value }) => {
      latestPos.current.x = value;
    });
    const yId = pan.y.addListener(({ value }) => {
      latestPos.current.y = value;
    });
    return () => {
      pan.x.removeListener(xId);
      pan.y.removeListener(yId);
    };
  }, [pan]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        draggedRef.current = false;
        pan.setOffset({ x: latestPos.current.x, y: latestPos.current.y });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (evt, gestureState: PanResponderGestureState) => {
        if (Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4) draggedRef.current = true;
        Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(evt, gestureState);
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        const clampedX = Math.min(Math.max(0, latestPos.current.x), SCREEN.width - BUTTON_SIZE);
        const clampedY = Math.min(Math.max(0, latestPos.current.y), SCREEN.height - BUTTON_SIZE);
        pan.setValue({ x: clampedX, y: clampedY });
        if (!draggedRef.current) Linking.openURL(WHATSAPP_URL);
      },
    }),
  ).current;

  if (dismissed) return null;

  return (
    <Animated.View style={[styles.wrap, { transform: pan.getTranslateTransform() }]} pointerEvents="box-none">
      <View {...panResponder.panHandlers} style={styles.button} accessibilityRole="button" accessibilityLabel="Contactar via WhatsApp">
        <Ionicons name="logo-whatsapp" size={20} color="#ffffff" />
      </View>
      <Pressable
        style={styles.closeBtn}
        onPress={() => setDismissed(true)}
        accessibilityRole="button"
        accessibilityLabel="Ocultar atalho do WhatsApp"
        hitSlop={8}
      >
        <Ionicons name="close" size={10} color="#ffffff" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1000,
    elevation: 20,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: radius.full,
    backgroundColor: '#25d366',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  closeBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 17,
    height: 17,
    borderRadius: radius.full,
    backgroundColor: colors.textFaint,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
