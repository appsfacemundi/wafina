import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { daysAgoLabel, type CollectionPoint, type Donation, type ReceberEligibility } from '@wafina/shared';
import type * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Linking,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PanResponderGestureState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Photo } from '@/components/Photo';
import { ThankYouNoteModal } from '@/components/ThankYouNoteModal';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiFetch, uploadFile, ApiError } from '@/lib/api';
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
  centerStyle,
  onMeasureHeight,
}: {
  donation: Donation;
  isTop: boolean;
  pan: Animated.ValueXY;
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'] | Record<string, never>;
  centerStyle: { top: number } | null;
  onMeasureHeight?: (height: number) => void;
}) {
  const { t } = useTranslation();
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
      onLayout={
        isTop && onMeasureHeight ? (e) => onMeasureHeight(e.nativeEvent.layout.height) : undefined
      }
      style={[
        styles.cardWrap,
        centerStyle,
        isTop
          ? { transform: [{ translateX: pan.x }, { translateY: dampedTranslateY }, { rotate }] }
          : { transform: [{ scale: nextCardScale }, { translateY: nextCardTranslateY }] },
      ]}
    >
      <Card style={styles.card}>
        {/* RECEBER UX refinement, 2026-08-11 — 'cover' here deliberately
            departs from the app-wide 'contain' default (see Photo.tsx):
            on this card the photo IS the card, per spec ("main visual
            element... immersive and premium"), so filling the frame edge-
            to-edge matters more than avoiding a crop. Other Photo call
            sites (success stories, etc.) are untouched. */}
        <Photo uri={donation.Photo} style={styles.photo} placeholderIcon="🎁" resizeMode="cover" />
        <View style={styles.availableBadge}>
          <View style={styles.availableDot} />
          <Text style={styles.availableBadgeText}>{t('receber.available')}</Text>
        </View>
        <View style={styles.wafinaBadge}>
          <Text style={styles.wafinaBadgeText}>{t('receber.wafinaBadge')}</Text>
        </View>
        {isTop && (
          <>
            {/* Bug fix, 2026-08-11 — this used to read "QUERO RECEBER" during a
                raw right-drag, which falsely promised a reservation the
                gesture no longer makes (see animateCardOut). Only the ❤️
                button reserves now, so this stamp is relabeled to match what
                a drag actually does: move to the next card. */}
            <Animated.View style={[styles.stamp, styles.stampLike, { opacity: likeOpacity }]}>
              <Text style={styles.stampLikeText}>{t('receber.swipeStampNext')}</Text>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.stampPass, { opacity: passOpacity }]}>
              <Text style={styles.stampPassText}>{t('receber.swipeStampPass')}</Text>
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
              <Text style={styles.metaChipText}>
                {t('receber.quantityAbbrev')}: {donation.Quantity}
              </Text>
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
          <Text style={styles.dateLabel}>{t('receber.publishedLabel', { time: daysAgoLabel(donation.Date_Submitted) })}</Text>
        </View>
      </Card>
    </Animated.View>
  );
}

export function ReceberScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { firebaseUser, session } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<ReceberEligibility | null>(null);
  const [cards, setCards] = useState<Donation[] | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  // Donation lifecycle emails, 2026-08-11 — the optional thank-you note modal.
  const [showThankYouModal, setShowThankYouModal] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Collection-point flow, 2026-08-10 — fetched once per reservation, scoped
  // server-side to the caller's own country (never invented client-side: a
  // null response means Wafina genuinely has no collection point configured
  // for that country yet, and the UI says so instead of showing fake data).
  const [collectionPoint, setCollectionPoint] = useState<CollectionPoint | null>(null);
  const [collectionPointFetchFailed, setCollectionPointFetchFailed] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeError, setCodeError] = useState('');

  // RECEBER UX refinement, 2026-08-11 — shown once immediately after a
  // successful reserve, before the reserved-donation main screen. Purely a
  // local presentation gate: the reservation itself is already committed
  // server-side by the time this is true (see onSelect), so closing the app
  // here or navigating away loses nothing — the reservation still stands.
  const [justReserved, setJustReserved] = useState(false);
  const [moreInfoExpanded, setMoreInfoExpanded] = useState(false);

  const pan = useRef(new Animated.ValueXY()).current;

  // Real-device layout fix, 2026-08-11 — measured (not guessed/hardcoded)
  // so the card centers correctly regardless of screen size or how many
  // text lines its body ends up wrapping to. Both start null; centerStyle
  // stays null (falls back to the cardWrap base style, effectively top-left)
  // for the one frame before both measurements land, which is not visible in
  // practice — measuring is not itself something a swipe/gesture code review
  // needs to touch, kept fully separate from the PanResponder logic below.
  const [stackAreaHeight, setStackAreaHeight] = useState<number | null>(null);
  const [cardHeight, setCardHeight] = useState<number | null>(null);
  const centerStyle =
    stackAreaHeight !== null && cardHeight !== null
      ? { top: Math.max(0, (stackAreaHeight - cardHeight) / 2) }
      : null;

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
      setError(err instanceof ApiError ? err.message : t('receber.loadError'));
    }
  }, [firebaseUser, t]);

  // Live regressive countdown for the cooldown AND active-reservation
  // screens — ticks every second only while one of those is actually
  // showing. When either reaches zero, the server is re-checked (it remains
  // the sole authority on expiry — see isReservationActive server-side) so
  // the screen advances on its own instead of leaving a stale "0s" on screen.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status?.reason !== 'cooldown' && status?.reason !== 'active_reservation') return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [status?.reason]);

  const reservationExpiresAtIso =
    status?.reason === 'active_reservation' && status.activeReservation?.Reserved_At
      ? new Date(new Date(status.activeReservation.Reserved_At).getTime() + 24 * 60 * 60 * 1000).toISOString()
      : null;
  const reservationCountdown = reservationExpiresAtIso ? countdownParts(reservationExpiresAtIso, now) : null;

  useEffect(() => {
    if (status?.reason === 'cooldown' && status.nextEligibleAt && countdownParts(status.nextEligibleAt, now).expired) {
      load();
    }
    if (reservationCountdown?.expired) {
      load();
    }
  }, [now, status, load]);

  // Collection-point flow, 2026-08-10 — fetched once per active reservation,
  // never invented client-side when Wafina has no point configured for this
  // country yet (null response — see getCollectionPointForCountry).
  useEffect(() => {
    if (status?.reason !== 'active_reservation' || !firebaseUser) return;
    setCollectionPointFetchFailed(false);
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setCollectionPoint(await apiFetch<CollectionPoint | null>('/donations/collection-point', { idToken }));
      } catch {
        setCollectionPointFetchFailed(true);
      }
    })();
  }, [status?.reason, firebaseUser]);

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
      removeTopCard();
      setJustReserved(true);
      await load();
    } catch (err) {
      // Someone else won the race, or the item was pulled — never leave the
      // stack stuck on a card that's no longer real.
      showToast(err instanceof ApiError ? err.message : t('receber.reserveFailedError'));
      removeTopCard();
    }
  }

  // Bug fix, 2026-08-11 — a raw right-drag gesture used to fall through to
  // the exact same `forceSwipe('right', ...)` the ❤️ button calls, which
  // unconditionally reserved the donation on completion. That meant simply
  // dragging a card past the threshold (no button tap at all) called
  // POST /donations/:id/reserve, generated a Collection_Code, and started
  // the 24h window — with zero explicit intent from the user. Per the fix
  // below, the raw gesture (both directions) now ONLY ever plays the fly-off
  // animation and removes the card (`onPass`) — it can never reserve. The
  // ❤️ "Quero Receber" button is the one and only path that can call
  // `onSelect` (the real reservation). The X button and a left-drag were
  // already pass-only and are unchanged in behavior.
  function animateCardOut(direction: 'left' | 'right', onDone: () => void) {
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
      onDone();
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
          // Gesture-driven release NEVER reserves, in either direction — see
          // animateCardOut's doc comment. Only the explicit ❤️ button (below,
          // in the JSX) is allowed to call onSelect.
          if (g.dx > SWIPE_THRESHOLD) animateCardOut('right', onPass);
          else if (g.dx < -SWIPE_THRESHOLD) animateCardOut('left', onPass);
          else resetPosition();
        },
      }),
    [isAnimating, topDonation],
  );

  // Collection-point flow, 2026-08-10 — entering the correct code only
  // unlocks Confirmar recebimento (via Collection_Code_Verified_At on the
  // refetched donation); it never calls confirm-received itself and never
  // starts the 3-day cooldown, which only begins at an actual confirmed
  // receipt — see verifyCollectionCode's server-side doc comment.
  async function onVerifyCode() {
    if (!status?.activeReservation || !codeInput.trim()) return;
    setCodeError('');
    setVerifyingCode(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/donations/${status.activeReservation.Donation_ID}/verify-collection-code`, {
        method: 'POST',
        idToken,
        body: { code: codeInput.trim() },
      });
      setCodeInput('');
      showToast(t('receber.codeVerifiedToast'));
      await load();
    } catch (err) {
      setCodeError(err instanceof ApiError ? err.message : t('receber.codeVerifyFailedError'));
    } finally {
      setVerifyingCode(false);
    }
  }

  // Donation lifecycle emails, 2026-08-11 — "Confirmar recebimento" opens
  // the optional thank-you note first instead of confirming directly.
  async function onConfirmReceived(message?: string, photo?: ImagePicker.ImagePickerAsset | null) {
    if (!status?.activeReservation) return;
    setConfirming(true);
    setError('');
    try {
      const idToken = await firebaseUser?.getIdToken();
      const donationId = status.activeReservation.Donation_ID;
      if (photo) {
        await uploadFile(`/donations/${donationId}/confirm-received`, 'photo', photo.uri, {
          idToken,
          mimeType: photo.mimeType ?? 'image/jpeg',
          parameters: message ? { thankYouMessage: message } : {},
        });
      } else {
        await apiFetch(`/donations/${donationId}/confirm-received`, {
          method: 'POST',
          idToken,
          body: message ? { thankYouMessage: message } : undefined,
        });
      }
      setShowThankYouModal(false);
      showToast(t('receber.receiptConfirmedToast'));
      await load();
    } catch (err) {
      // Close the modal on failure too, so the screen's own error banner
      // (rendered behind it) is actually visible instead of hidden by the
      // modal overlay.
      setShowThankYouModal(false);
      setError(err instanceof ApiError ? err.message : t('receber.receiptConfirmFailedError'));
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
      <Text style={styles.title}>{t('receber.title')}</Text>
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel={t('receber.close')}
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
        <Text style={styles.loading}>{t('common.loading')}</Text>
      </View>
    );
  }

  // Congratulations — shown exactly once, right after a successful reserve,
  // before the reserved-donation main screen. Never shows the 4-digit code
  // here (that only appears at the collection point, entered by staff/the
  // receiver there — see the primary reserved screen below).
  if (justReserved && status.reason === 'active_reservation' && status.activeReservation) {
    return (
      <View style={styles.screen}>
        {Header}
        <View style={styles.congratsWrap}>
          <View style={styles.congratsIconWrap}>
            <Text style={styles.congratsIcon}>🎉</Text>
          </View>
          <Text style={styles.congratsTitle}>{t('receber.congratsTitle')}</Text>
          <Text style={styles.congratsText}>{t('receber.congratsText')}</Text>
          <View style={styles.congratsNoticeCard}>
            <Ionicons name="time-outline" size={18} color={colors.accent} />
            <Text style={styles.congratsNoticeText}>{t('receber.congratsNotice')}</Text>
          </View>
          <Button onPress={() => setJustReserved(false)} fullWidth>
            {t('receber.congratsContinue')}
          </Button>
        </View>
      </View>
    );
  }

  // Reservation already active — this screen is the single source of truth
  // for pickup: everything the recipient needs (countdown, where to go, what
  // to bring, and the code-gated confirmation) lives here, nothing requires
  // navigating elsewhere. Never shows the swipe stack while a reservation is active.
  if (status.reason === 'active_reservation' && status.activeReservation) {
    const reserved = status.activeReservation;
    const codeVerified = Boolean(reserved.Collection_Code_Verified_At);
    const mapsQuery = collectionPoint
      ? encodeURIComponent([collectionPoint.Address, collectionPoint.City].filter(Boolean).join(', '))
      : '';

    return (
      <View style={styles.screen}>
        {Header}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.reservedScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* PRIMARY — kept deliberately minimal per spec: title, countdown,
              code entry, confirm. Everything else lives in "Mais informações". */}
          <Text style={styles.reservedTitle}>{t('receber.reservedTitle')}</Text>

          {reservationCountdown && !reservationCountdown.expired ? (
            <View style={styles.countdownCard}>
              <Text style={styles.countdownCardLabel}>{t('receber.countdownValidFor')}</Text>
              <View style={styles.countdownRow}>
                <View style={styles.countdownUnit}>
                  <Text style={styles.countdownValueLarge}>{pad2(reservationCountdown.hours)}</Text>
                  <Text style={styles.countdownUnitLabel}>h</Text>
                </View>
                <Text style={styles.countdownColonLarge}>:</Text>
                <View style={styles.countdownUnit}>
                  <Text style={styles.countdownValueLarge}>{pad2(reservationCountdown.minutes)}</Text>
                  <Text style={styles.countdownUnitLabel}>m</Text>
                </View>
                <Text style={styles.countdownColonLarge}>:</Text>
                <View style={styles.countdownUnit}>
                  <Text style={styles.countdownValueLarge}>{pad2(reservationCountdown.seconds)}</Text>
                  <Text style={styles.countdownUnitLabel}>s</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.countdownCard, styles.countdownCardExpired]}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
              <Text style={styles.countdownExpiredText}>{t('receber.reservationExpiredNotice')}</Text>
            </View>
          )}

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Receipt confirmation — gated on the code, never immediate */}
          <View style={styles.sectionCard}>
            {!codeVerified ? (
              <>
                <Text style={styles.sectionTitle}>{t('receber.enterCodeTitle')}</Text>
                <Text style={styles.locationText}>{t('receber.enterCodeHint')}</Text>
                <TextInput
                  value={codeInput}
                  onChangeText={(v) => {
                    setCodeError('');
                    setCodeInput(v.replace(/[^0-9]/g, '').slice(0, 4));
                  }}
                  placeholder="0000"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="number-pad"
                  maxLength={4}
                  style={styles.codeInput}
                />
                {codeError ? <Text style={styles.errorText}>{codeError}</Text> : null}
                <Button onPress={onVerifyCode} loading={verifyingCode} disabled={codeInput.length !== 4} fullWidth>
                  {t('receber.confirmCodeButton')}
                </Button>
              </>
            ) : (
              <>
                <View style={styles.codeVerifiedBanner}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={styles.codeVerifiedText}>{t('receber.codeVerifiedBanner')}</Text>
                </View>
                <Button onPress={() => setShowThankYouModal(true)} loading={confirming} fullWidth>
                  {t('receber.confirmReceiptButton')}
                </Button>
              </>
            )}
          </View>

          <Pressable
            onPress={() => setMoreInfoExpanded((v) => !v)}
            accessibilityRole="button"
            style={styles.moreInfoToggle}
          >
            <Text style={styles.moreInfoToggleIcon}>{moreInfoExpanded ? '☝️' : '👇'}</Text>
            <Text style={styles.moreInfoToggleText}>{t('receber.moreInfoToggle')}</Text>
            <Ionicons
              name={moreInfoExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.accent}
            />
          </Pressable>

          {/* SECONDARY — "Mais informações", collapsed by default */}
          {moreInfoExpanded && (
            <View style={styles.moreInfoSection}>
              <Text style={styles.reservedCode}>{reserved.Public_Donation_Code}</Text>

              <View style={styles.reservedItemRow}>
                <Photo
                  uri={reserved.Photo}
                  style={styles.reservedItemPhoto}
                  placeholderIcon="🎁"
                  resizeMode="cover"
                />
                <View style={styles.reservedItemInfo}>
                  <Text style={styles.itemType} numberOfLines={2}>
                    {reserved.Item_Type}
                  </Text>
                  <Text style={styles.locationText}>
                    {t('receber.itemQtyCondition', { qty: reserved.Quantity, condition: reserved.Condition })}
                  </Text>
                </View>
              </View>

              {/* Collection point — never invented; a null response means Wafina
                  genuinely has no point configured yet for this country. */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>{t('receber.collection.whereToCollect')}</Text>
                {collectionPoint ? (
                  <View style={styles.collectionPointBody}>
                    <Text style={styles.collectionPointName}>{collectionPoint.Name}</Text>
                    <Text style={styles.locationText}>{collectionPoint.Address}</Text>
                    {collectionPoint.City && <Text style={styles.locationText}>{collectionPoint.City}</Text>}
                    {collectionPoint.Opening_Hours && (
                      <Text style={styles.locationText}>
                        {t('receber.collection.hours', { hours: collectionPoint.Opening_Hours })}
                      </Text>
                    )}
                    {collectionPoint.Phone && (
                      <Pressable onPress={() => Linking.openURL(`tel:${collectionPoint.Phone}`)}>
                        <Text style={styles.mapLink}>📞 {collectionPoint.Phone}</Text>
                      </Pressable>
                    )}
                    {collectionPoint.Email && (
                      <Pressable onPress={() => Linking.openURL(`mailto:${collectionPoint.Email}`)}>
                        <Text style={styles.mapLink}>✉️ {collectionPoint.Email}</Text>
                      </Pressable>
                    )}
                    {collectionPoint.Phone && (
                      <Pressable
                        onPress={() => Linking.openURL(`https://wa.me/${collectionPoint.Phone!.replace(/\D/g, '')}`)}
                      >
                        <Text style={styles.mapLink}>{t('receber.collection.whatsapp')}</Text>
                      </Pressable>
                    )}
                    {collectionPoint.Directions && (
                      <Text style={[styles.locationText, styles.directionsText]}>{collectionPoint.Directions}</Text>
                    )}
                    <Pressable
                      onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`)}
                    >
                      <Text style={[styles.mapLink, styles.directionsLink]}>{t('receber.collection.directions')}</Text>
                    </Pressable>
                  </View>
                ) : collectionPointFetchFailed ? (
                  <Text style={styles.locationText}>{t('receber.collection.loadFailedHint')}</Text>
                ) : (
                  <Text style={styles.locationText}>{t('receber.collection.notConfiguredHint')}</Text>
                )}
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>{t('receber.collection.whatToBringTitle')}</Text>
                <Text style={styles.locationText}>{t('receber.collection.whatToBringHint')}</Text>
                {session?.wafinaId && (
                  <View style={styles.wafinaIdWrap}>
                    <Text style={styles.wafinaIdLabel}>{t('receber.collection.wafinaIdLabel')}</Text>
                    <Text style={styles.wafinaIdValue}>{session.wafinaId}</Text>
                  </View>
                )}
              </View>

              <View style={styles.progressRow}>
                <View style={styles.progressStep}>
                  <View style={[styles.progressDot, styles.progressDotDone]}>
                    <Ionicons name="checkmark" size={12} color="#ffffff" />
                  </View>
                  <Text style={styles.progressLabel}>{t('receber.progress.reserved')}</Text>
                </View>
                <View style={styles.progressLine} />
                <View style={styles.progressStep}>
                  <View style={[styles.progressDot, codeVerified && styles.progressDotDone]}>
                    {codeVerified ? (
                      <Ionicons name="checkmark" size={12} color="#ffffff" />
                    ) : (
                      <Text style={styles.progressDotPendingText}>2</Text>
                    )}
                  </View>
                  <Text style={styles.progressLabel}>{t('receber.progress.pickup')}</Text>
                </View>
                <View style={styles.progressLine} />
                <View style={styles.progressStep}>
                  <View style={styles.progressDot}>
                    <Text style={styles.progressDotPendingText}>3</Text>
                  </View>
                  <Text style={styles.progressLabel}>{t('receber.progress.received')}</Text>
                </View>
              </View>
              <Text style={styles.progressExplain}>{t('receber.progress.explain')}</Text>
            </View>
          )}
        </ScrollView>
        <ThankYouNoteModal
          visible={showThankYouModal}
          submitting={confirming}
          onSkip={() => onConfirmReceived()}
          onSubmit={(message, photo) => onConfirmReceived(message, photo)}
        />
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
          <Text style={styles.cooldownTitle}>{t('receber.cooldown.title')}</Text>
          <Text style={styles.cooldownText}>{t('receber.cooldown.text')}</Text>
          <View style={styles.cooldownDateWrap}>
            <Text style={styles.cooldownDateLabel}>{t('receber.cooldown.nextEligible')}</Text>
            <View style={styles.countdownRow}>
              {countdown.days > 0 && (
                <>
                  <View style={styles.countdownUnit}>
                    <Text style={styles.countdownValue}>{countdown.days}</Text>
                    <Text style={styles.countdownUnitLabel}>{t('receber.cooldown.days')}</Text>
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
        <Text style={styles.subtitle}>{t('receber.subtitle')}</Text>
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.stackArea} onLayout={(e) => setStackAreaHeight(e.nativeEvent.layout.height)}>
          {stackCards.length === 0 ? (
            <EmptyState
              title={t('receber.emptyEndTitle')}
              description={t('receber.emptyEndDescription')}
              icon="gift-outline"
              action={
                <Button variant="receive" onPress={load}>
                  {t('receber.viewAgain')}
                </Button>
              }
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
                    centerStyle={centerStyle}
                    onMeasureHeight={setCardHeight}
                  />
                );
              })
          )}
        </View>

        {stackCards.length > 0 && topDonation && (
          <View style={[styles.actionRow, { paddingBottom: insets.bottom + spacing[5] }]}>
            <Pressable
              onPress={() => animateCardOut('left', onPass)}
              accessibilityRole="button"
              accessibilityLabel={t('receber.passAccessibilityLabel')}
              style={[styles.actionBtn, styles.passBtn]}
            >
              <Ionicons name="close" size={28} color={colors.danger} />
            </Pressable>
            <Pressable
              // The ONLY path in this screen allowed to call onSelect — see
              // animateCardOut's doc comment for why the gesture path can't.
              onPress={() => animateCardOut('right', () => onSelect(topDonation))}
              accessibilityRole="button"
              accessibilityLabel={t('receber.selectAccessibilityLabel')}
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
    justifyContent: 'center',
  },
  cardWrap: {
    // Real-device finding, 2026-08-11 — an absolutely positioned card with no
    // explicit inset does NOT reliably inherit the parent's justifyContent on
    // every Android device (it was observed landing near the top instead of
    // centering/bottom-anchoring), so vertical position can't be left
    // implicit. Rather than pin to one edge (which just moves the leftover
    // space to the other side instead of removing it), the actual rendered
    // card height is measured once via onLayout (see the SwipeCard
    // component's onMeasureHeight) and used to compute an explicit `top`
    // that centers it — see centerStyle in ReceberScreen.
    position: 'absolute',
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
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
  // RECEBER UX refinement, 2026-08-11 — the countdown is now the single most
  // prominent element on the simplified primary screen (spec: "Large
  // prominent live countdown"), larger than the original inline value.
  countdownValueLarge: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  countdownColonLarge: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.textFaint,
    marginBottom: 14,
  },
  moreInfoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing[3],
  },
  moreInfoToggleIcon: {
    fontSize: 15,
  },
  moreInfoToggleText: {
    fontFamily: 'Manrope-700',
    fontSize: 13.5,
    color: colors.accent,
  },
  moreInfoSection: {
    gap: spacing[4],
  },
  congratsWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    gap: spacing[3],
  },
  congratsIconWrap: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.receiveSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  congratsIcon: {
    fontSize: 44,
  },
  congratsTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
    textAlign: 'center',
  },
  congratsText: {
    fontFamily: 'Manrope-400',
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  congratsNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  congratsNoticeText: {
    flex: 1,
    fontFamily: 'Manrope-600',
    fontSize: 13.5,
    color: colors.text,
  },
  reservedScrollContent: {
    gap: spacing[4],
    paddingBottom: spacing[10],
  },
  reservedTitle: {
    fontFamily: fonts.display,
    fontSize: 19,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing[2],
  },
  reservedCode: {
    fontFamily: 'Manrope-700',
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: -spacing[2],
  },
  countdownCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    alignItems: 'center',
    gap: spacing[2],
  },
  countdownCardLabel: {
    fontFamily: 'Manrope-600',
    fontSize: 12,
    color: colors.textFaint,
    textTransform: 'uppercase',
  },
  countdownCardExpired: {
    flexDirection: 'row',
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  countdownExpiredText: {
    fontFamily: 'Manrope-600',
    fontSize: 13,
    color: colors.danger,
    flex: 1,
  },
  reservedItemRow: {
    flexDirection: 'row',
    gap: spacing[3],
    alignItems: 'center',
  },
  // RECEBER UX refinement, 2026-08-11 — enlarged per feedback that the
  // "Saiba mais" item photo was too small to read at a glance (was 64x64).
  reservedItemPhoto: {
    width: 96,
    height: 96,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
  },
  reservedItemInfo: {
    flex: 1,
    gap: 2,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing[4],
    gap: spacing[2],
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 15.5,
    color: colors.text,
  },
  collectionPointBody: {
    gap: 4,
  },
  collectionPointName: {
    fontFamily: 'Manrope-700',
    fontSize: 14,
    color: colors.text,
  },
  directionsLink: {
    marginTop: 4,
  },
  directionsText: {
    marginTop: 2,
    fontStyle: 'italic',
  },
  wafinaIdWrap: {
    marginTop: 2,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  wafinaIdLabel: {
    fontFamily: 'Manrope-600',
    fontSize: 10,
    color: colors.textFaint,
    textTransform: 'uppercase',
  },
  wafinaIdValue: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
  },
  progressStep: {
    alignItems: 'center',
    gap: 4,
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  progressDotPendingText: {
    fontFamily: 'Manrope-700',
    fontSize: 11,
    color: colors.textFaint,
  },
  progressLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: colors.border,
    marginHorizontal: 4,
    marginBottom: 18,
  },
  progressLabel: {
    fontFamily: 'Manrope-600',
    fontSize: 11,
    color: colors.textMuted,
  },
  progressExplain: {
    fontFamily: 'Manrope-400',
    fontSize: 12.5,
    color: colors.textMuted,
    lineHeight: 18,
  },
  codeInput: {
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.text,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    marginVertical: spacing[2],
  },
  codeVerifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  codeVerifiedText: {
    fontFamily: 'Manrope-600',
    fontSize: 13,
    color: colors.success,
    flex: 1,
  },
});
