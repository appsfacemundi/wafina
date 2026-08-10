import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { daysAgoLabel, type Donation, type ReceberEligibility } from '@wafina/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PanResponderGestureState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Photo } from '@/components/Photo';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiFetch, ApiError } from '@/lib/api';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Receber'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;
const ROTATION_DEG = 10;
const SWIPE_OUT_DURATION = 220;

function formatEligibleDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** RC1 RECEBER cooldown countdown — live days/hours/minutes/seconds remaining until `targetIso`. */
function countdownParts(targetIso: string, now: number) {
  const diff = new Date(targetIso).getTime() - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return { days, hours, minutes, seconds, expired: false };
}

/**
 * RC1 RECEBER — a single discovery card. Only the top card in the stack is
 * draggable (isTop); cards behind it render static and slightly scaled down
 * so the next item is visibly present, per spec ("more donations available").
 * The drag position itself (`pan`) lives in the parent (ReceberScreen) so the
 * PASSAR/QUERO RECEBER buttons can drive the exact same animation a real
 * swipe does — there is only ever one code path for "this card leaves".
 */
function SwipeCard({
  donation,
  isTop,
  pan,
  panHandlers,
}: {
  donation: Donation;
  isTop: boolean;
  pan: Animated.ValueXY;
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'] | Record<string, never>;
}) {
  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: [`-${ROTATION_DEG}deg`, '0deg', `${ROTATION_DEG}deg`],
    extrapolate: 'clamp',
  });
  // Vertical drag is rendered at a fraction of the raw gesture so a
  // diagonal or accidental up/down finger movement doesn't fling the card
  // around — horizontal stays 1:1 with the finger, vertical is just a hint.
  const dampedTranslateY = pan.y.interpolate({
    inputRange: [-600, 0, 600],
    outputRange: [-90, 0, 90],
    extrapolate: 'clamp',
  });
  const likeOpacity = pan.x.interpolate({
    inputRange: [20, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const passOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  // The next card subtly advances as the top card is dragged away in either
  // direction, so the stack reads as "something is coming up next" rather
  // than a static backdrop.
  const nextCardScale = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: [1, 0.95, 1],
    extrapolate: 'clamp',
  });
  const nextCardTranslateY = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: [0, 10, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      {...panHandlers}
      style={[
        styles.cardWrap,
        isTop
          ? { transform: [{ translateX: pan.x }, { translateY: dampedTranslateY }, { rotate }] }
          : { transform: [{ scale: nextCardScale }, { translateY: nextCardTranslateY }] },
      ]}
    >
      <Card style={styles.card}>
        <Photo uri={donation.Photo} style={styles.photo} placeholderIcon="🎁" resizeMode="contain" />
        <View style={styles.availableBadge}>
          <View style={styles.availableDot} />
          <Text style={styles.availableBadgeText}>Disponível</Text>
        </View>
        <View style={styles.wafinaBadge}>
          <Text style={styles.wafinaBadgeText}>Wafina</Text>
        </View>
        {isTop && (
          <>
            <Animated.View style={[styles.stamp, styles.stampLike, { opacity: likeOpacity }]}>
              <Text style={styles.stampLikeText}>QUERO{'\n'}RECEBER</Text>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.stampPass, { opacity: passOpacity }]}>
              <Text style={styles.stampPassText}>PASSAR</Text>
            </Animated.View>
          </>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.itemType} numberOfLines={2}>
            {donation.Item_Type}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Ionicons name="cube-outline" size={13} color={colors.textMuted} />
              <Text style={styles.metaChipText}>Qtd: {donation.Quantity}</Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons name="sparkles-outline" size={13} color={colors.textMuted} />
              <Text style={styles.metaChipText}>{donation.Condition}</Text>
            </View>
          </View>
          {(donation.Address || donation.City) && (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color={colors.textFaint} />
              <Text style={styles.locationText} numberOfLines={1}>
                {[donation.Address, donation.City].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}
          <Text style={styles.dateLabel}>📅 Publicado {daysAgoLabel(donation.Date_Submitted)}</Text>
        </View>
      </Card>
    </Animated.View>
  );
}

export function ReceberScreen({ navigation }: Props) {
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<ReceberEligibility | null>(null);
  const [cards, setCards] = useState<Donation[] | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const pan = useRef(new Animated.ValueXY()).current;

  const load = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      const receberStatus = await apiFetch<ReceberEligibility>('/donations/receber-status', { idToken });
      setStatus(receberStatus);
      if (receberStatus.eligible) {
        setCards(await apiFetch<Donation[]>('/donations/available-for-me', { idToken }));
      } else {
        setCards(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as doações.');
    }
  }, [firebaseUser]);

  // Live regressive countdown for the cooldown screen — ticks every second
  // only while that screen is actually showing. When it reaches zero, the
  // server is re-checked (it remains the authority) so the screen advances
  // to the swipe stack on its own instead of leaving a stale "0s" on screen.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status?.reason !== 'cooldown') return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [status?.reason]);

  useEffect(() => {
    if (status?.reason === 'cooldown' && status.nextEligibleAt && countdownParts(status.nextEligibleAt, now).expired) {
      load();
    }
  }, [now, status, load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function removeTopCard() {
    setCards((prev) => (prev && prev.length > 0 ? prev.slice(1) : prev));
  }

  async function onPass() {
    // Pure local skip — RC1 keeps this simple (no "passed" persistence, see
    // the original RECEBER spec); reappears on a fresh load, which is the
    // expected behavior of a discovery list, not a bug.
    removeTopCard();
  }

  async function onSelect(donation: Donation) {
    setError('');
    try {
      const idToken = await firebaseUser?.getIdToken();
      // The real reservation call — the card animation is purely visual; this
      // request is what actually decides whether the item is theirs.
      await apiFetch<Donation>(`/donations/${donation.Donation_ID}/reserve`, { method: 'POST', idToken });
      showToast('Reservado! Tem 24 horas para ir buscar.');
      removeTopCard();
      await load();
    } catch (err) {
      // Someone else won the race, or the item was pulled — never leave the
      // stack stuck on a card that's no longer real.
      showToast(err instanceof ApiError ? err.message : 'Não foi possível reservar esta doação.');
      removeTopCard();
    }
  }

  function forceSwipe(direction: 'left' | 'right', donation: Donation) {
    if (isAnimating) return;
    setIsAnimating(true);
    // PanResponder's own move handler must stay JS-driven (see below) — an
    // Animated.Value can't be driven by both native and JS animations, so
    // every animation touching `pan` has to agree on useNativeDriver:false.
    Animated.timing(pan, {
      toValue: { x: direction === 'right' ? SCREEN_WIDTH * 1.4 : -SCREEN_WIDTH * 1.4, y: 20 },
      duration: SWIPE_OUT_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      setIsAnimating(false);
      if (direction === 'right') onSelect(donation);
      else onPass();
    });
  }

  function resetPosition() {
    Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 7, tension: 45 }).start();
  }

  const topDonation = cards?.[0] ?? null;

  // Real-device crash fix, 2026-08-10 — this used to be `useRef(PanResponder.create(...)).current`,
  // which builds the responder config exactly once on mount. Every handler
  // then permanently closed over that first render's `topDonation` (always
  // null, since `cards` starts null) and `isAnimating`, so release never
  // actually fired a swipe. Rebuilding via useMemo on the values the
  // handlers depend on keeps their closures current.
  //
  // Separately: onPanResponderMove MUST stay useNativeDriver:false. Native
  // driver here crashed on a real Android device with "Object is not a
  // function" inside PanResponder's internal _updateGestureStateOnMove —
  // PanResponder itself runs on the JS thread and isn't meant to hand its
  // move event to a native-driven Animated.event.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => !isAnimating,
        // Require the gesture to be clearly horizontal before claiming it, so
        // a vertical scroll-like touch doesn't get mistaken for a swipe.
        onMoveShouldSetPanResponder: (_evt, g: PanResponderGestureState) =>
          !isAnimating && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
        onPanResponderRelease: (_evt, g: PanResponderGestureState) => {
          if (!topDonation) return;
          if (g.dx > SWIPE_THRESHOLD) forceSwipe('right', topDonation);
          else if (g.dx < -SWIPE_THRESHOLD) forceSwipe('left', topDonation);
          else resetPosition();
        },
      }),
    [isAnimating, topDonation],
  );

  async function onConfirmReceived() {
    if (!status?.activeReservation) return;
    setConfirming(true);
    setError('');
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/donations/${status.activeReservation.Donation_ID}/confirm-received`, {
        method: 'POST',
        idToken,
      });
      showToast('Recebimento confirmado. Obrigado!');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível confirmar o recebimento.');
    } finally {
      setConfirming(false);
    }
  }

  // Closing here never signs the user out and never cancels an in-progress
  // reservation — it only leaves this screen. A reserved item keeps its
  // existing 24h window and is still reachable next time RECEBER is opened.
  const Header = (
    <View style={[styles.headerRow, { paddingTop: insets.top + spacing[5] }]}>
      <View style={styles.headerSpacer} />
      <Text style={styles.title}>Receber</Text>
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Fechar"
        hitSlop={10}
        style={styles.headerSpacer}
      >
        <Ionicons name="close" size={26} color={colors.textMuted} />
      </Pressable>
    </View>
  );

  // Loading
  if (status === null) {
    return (
      <View style={styles.screen}>
        {Header}
        <Text style={styles.loading}>A carregar…</Text>
      </View>
    );
  }

  // Reservation already active — resume pickup, never show the stack.
  if (status.reason === 'active_reservation' && status.activeReservation) {
    const reserved = status.activeReservation;
    return (
      <View style={styles.screen}>
        {Header}
        <View style={styles.content}>
          <View style={styles.reservedBanner}>
            <Ionicons name="time-outline" size={20} color={colors.warning} />
            <Text style={styles.reservedBannerText}>
              Esta doação está reservada para si. Reserva válida durante 24 horas.
            </Text>
          </View>
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          <Card style={styles.card}>
            <Photo uri={reserved.Photo} style={styles.photo} placeholderIcon="🎁" resizeMode="contain" />
            <View style={styles.cardBody}>
              <Text style={styles.itemType}>{reserved.Item_Type}</Text>
              <Text style={styles.locationText}>
                Qtd: {reserved.Quantity} · Estado: {reserved.Condition}
              </Text>
              {(reserved.City || reserved.Address) && (
                <View style={styles.metaRow}>
                  <Text style={styles.locationText}>
                    📍 {[reserved.Address, reserved.City].filter(Boolean).join(', ')}
                  </Text>
                  <Pressable
                    onPress={() =>
                      Linking.openURL(`https://www.google.com/maps?q=${reserved.Location.lat},${reserved.Location.lng}`)
                    }
                  >
                    <Text style={styles.mapLink}> Ver no mapa</Text>
                  </Pressable>
                </View>
              )}
              <Button onPress={onConfirmReceived} loading={confirming} fullWidth>
                Confirmar recebimento
              </Button>
            </View>
          </Card>
        </View>
      </View>
    );
  }

  // Cooldown (3 days since last confirmed receipt) — blocked, no stack,
  // shown with a live countdown to when they're free again.
  if (status.reason === 'cooldown' && status.nextEligibleAt) {
    const countdown = countdownParts(status.nextEligibleAt, now);
    return (
      <View style={styles.screen}>
        {Header}
        <View style={[styles.content, { alignItems: 'center', justifyContent: 'center', flex: 1 }]}>
          <View style={styles.cooldownIconWrap}>
            <Ionicons name="hourglass-outline" size={32} color={colors.warning} />
          </View>
          <Text style={styles.cooldownTitle}>Já recebeu uma doação recentemente</Text>
          <Text style={styles.cooldownText}>
            Para dar oportunidade a mais pessoas, cada Pessoa pode receber uma doação a cada 3 dias.
          </Text>
          <View style={styles.cooldownDateWrap}>
            <Text style={styles.cooldownDateLabel}>Pode receber novamente em</Text>
            <View style={styles.countdownRow}>
              {countdown.days > 0 && (
                <>
                  <View style={styles.countdownUnit}>
                    <Text style={styles.countdownValue}>{countdown.days}</Text>
                    <Text style={styles.countdownUnitLabel}>dias</Text>
                  </View>
                  <Text style={styles.countdownColon}>:</Text>
                </>
              )}
              <View style={styles.countdownUnit}>
                <Text style={styles.countdownValue}>{pad2(countdown.hours)}</Text>
                <Text style={styles.countdownUnitLabel}>h</Text>
              </View>
              <Text style={styles.countdownColon}>:</Text>
              <View style={styles.countdownUnit}>
                <Text style={styles.countdownValue}>{pad2(countdown.minutes)}</Text>
                <Text style={styles.countdownUnitLabel}>m</Text>
              </View>
              <Text style={styles.countdownColon}>:</Text>
              <View style={styles.countdownUnit}>
                <Text style={styles.countdownValue}>{pad2(countdown.seconds)}</Text>
                <Text style={styles.countdownUnitLabel}>s</Text>
              </View>
            </View>
            <Text style={styles.cooldownDate}>{formatEligibleDate(status.nextEligibleAt)}</Text>
          </View>
        </View>
      </View>
    );
  }

  // Eligible — the swipe stack.
  const stackCards = cards ?? [];

  return (
    <View style={styles.screen}>
      {Header}
      <View style={styles.content}>
        <Text style={styles.subtitle}>Encontre bens disponíveis para si.</Text>
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.stackArea}>
          {stackCards.length === 0 ? (
            <EmptyState
              title="Sem doações disponíveis"
              description="Não há doações disponíveis para si neste momento. Volte a verificar mais tarde."
              icon="gift-outline"
            />
          ) : (
            stackCards
              .slice(0, 2)
              .reverse()
              .map((donation, idx, arr) => {
                const isTop = idx === arr.length - 1;
                return (
                  <SwipeCard
                    key={donation.Donation_ID}
                    donation={donation}
                    isTop={isTop}
                    pan={pan}
                    panHandlers={isTop ? panResponder.panHandlers : {}}
                  />
                );
              })
          )}
        </View>

        {stackCards.length > 0 && topDonation && (
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => forceSwipe('left', topDonation)}
              accessibilityRole="button"
              accessibilityLabel="Passar"
              style={[styles.actionBtn, styles.passBtn]}
            >
              <Ionicons name="close" size={28} color={colors.danger} />
            </Pressable>
            <Pressable
              onPress={() => forceSwipe('right', topDonation)}
              accessibilityRole="button"
              accessibilityLabel="Quero Receber"
              style={[styles.actionBtn, styles.selectBtn]}
            >
              <Ionicons name="heart" size={26} color="#ffffff" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[3],
  },
  headerSpacer: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.text,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
    gap: spacing[3],
  },
  subtitle: {
    fontFamily: 'Manrope-400',
    fontSize: 13.5,
    color: colors.textMuted,
    textAlign: 'center',
  },
  loading: {
    fontFamily: 'Manrope-400',
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing[10],
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 8,
    padding: spacing[3],
  },
  errorText: {
    fontFamily: 'Manrope-400',
    fontSize: 13,
    color: colors.danger,
  },
  stackArea: {
    flex: 1,
    alignItems: 'center',
    // Anchored to the bottom of the available space (not centered) so the
    // PASSAR/QUERO RECEBER buttons sit close under the card instead of
    // leaving a large empty gap on taller screens.
    justifyContent: 'flex-end',
  },
  cardWrap: {
    position: 'absolute',
    width: '100%',
    maxWidth: 380,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
    gap: 0,
    borderRadius: radius.xl,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  photo: {
    width: '100%',
    height: 320,
    backgroundColor: colors.surface2,
  },
  availableBadge: {
    position: 'absolute',
    top: spacing[3],
    left: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.full,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  availableDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  availableBadgeText: {
    fontFamily: 'Manrope-700',
    fontSize: 11.5,
    color: colors.text,
  },
  wafinaBadge: {
    position: 'absolute',
    top: spacing[3],
    right: spacing[3],
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: radius.full,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  wafinaBadgeText: {
    fontFamily: 'Manrope-700',
    fontSize: 11,
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  stamp: {
    position: 'absolute',
    top: spacing[8],
    borderWidth: 3,
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  stampLike: {
    right: spacing[5],
    borderColor: colors.receive,
    transform: [{ rotate: '14deg' }],
  },
  stampLikeText: {
    fontFamily: 'Manrope-800',
    fontSize: 20,
    lineHeight: 22,
    color: colors.receive,
    textAlign: 'center',
  },
  stampPass: {
    left: spacing[5],
    borderColor: colors.danger,
    transform: [{ rotate: '-14deg' }],
  },
  stampPassText: {
    fontFamily: 'Manrope-800',
    fontSize: 20,
    color: colors.danger,
  },
  cardBody: {
    padding: spacing[4],
    gap: 6,
  },
  itemType: {
    fontFamily: fonts.display,
    fontSize: 19,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface2,
    borderRadius: radius.full,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  metaChipText: {
    fontFamily: 'Manrope-600',
    fontSize: 12,
    color: colors.textMuted,
  },
  locationText: {
    fontFamily: 'Manrope-400',
    fontSize: 13,
    color: colors.textMuted,
    flexShrink: 1,
  },
  mapLink: {
    fontFamily: 'Manrope-600',
    fontSize: 13,
    color: colors.accent,
  },
  dateLabel: {
    fontFamily: 'Manrope-400',
    fontSize: 11.5,
    color: colors.textFaint,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[6],
    paddingTop: spacing[3],
    paddingBottom: spacing[5],
  },
  actionBtn: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  passBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  selectBtn: {
    backgroundColor: colors.receive,
    width: 68,
    height: 68,
  },
  reservedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing[3],
  },
  reservedBannerText: {
    flex: 1,
    fontFamily: 'Manrope-600',
    fontSize: 13,
    color: colors.warning,
  },
  cooldownIconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  cooldownTitle: {
    fontFamily: fonts.display,
    fontSize: 19,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  cooldownText: {
    fontFamily: 'Manrope-400',
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing[5],
  },
  cooldownDateWrap: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    alignItems: 'center',
  },
  cooldownDateLabel: {
    fontFamily: 'Manrope-400',
    fontSize: 12,
    color: colors.textFaint,
    marginBottom: 4,
  },
  cooldownDate: {
    fontFamily: 'Manrope-400',
    fontSize: 12,
    color: colors.textFaint,
    marginTop: spacing[2],
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[1],
  },
  countdownUnit: {
    alignItems: 'center',
    minWidth: 32,
  },
  countdownValue: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  countdownUnitLabel: {
    fontFamily: 'Manrope-600',
    fontSize: 10,
    color: colors.textFaint,
    textTransform: 'uppercase',
  },
  countdownColon: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.textFaint,
    marginBottom: 12,
  },
});
