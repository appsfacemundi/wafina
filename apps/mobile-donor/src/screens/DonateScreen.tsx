import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  CONDITIONS,
  DELIVERY_METHOD_LABEL_KEY,
  DELIVERY_METHODS,
  ITEM_TYPES,
  MEDICAL_SUPPLY_INFO,
  RECIPIENT_CATEGORIES,
  RECIPIENT_CATEGORY_LABEL_KEY,
  type CorporateAccount,
  type DeliveryMethod,
  type RecipientCategory,
} from '@wafina/shared';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ErrorBanner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ApiError, apiFetch, uploadDonationPhoto } from '@/lib/api';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

type LocationStatus = 'capturing' | 'captured' | 'failed' | 'geocoding' | 'geocoded';
type Props = NativeStackScreenProps<RootStackParamList, 'Donate'>;

/** Donate screen redesign, 2026-08-07 — numbered section header matching the new brand mockup. */
function SectionHeader({ n, title }: { n: number; title: string }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <View style={styles.sectionBadge}>
        <Text style={styles.sectionBadgeText}>{n}</Text>
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

/** A label like "👨‍👩‍👧 Pessoas" splits into an emoji "icon" and its text — no separate icon set to maintain. */
function splitEmojiLabel(label: string): { emoji: string; text: string } {
  const spaceIndex = label.indexOf(' ');
  if (spaceIndex === -1) return { emoji: '', text: label };
  return { emoji: label.slice(0, spaceIndex), text: label.slice(spaceIndex + 1) };
}

function EmojiChip({
  emoji,
  text,
  selected,
  onPress,
  wide,
}: {
  emoji: string;
  text: string;
  selected: boolean;
  onPress: () => void;
  wide?: boolean;
}) {
  return (
    <Pressable
      style={[styles.chip, wide && styles.chipWide, selected && styles.chipSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={styles.chipEmoji}>{emoji}</Text>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={2}>
        {text}
      </Text>
    </Pressable>
  );
}

function IconChip({
  icon,
  text,
  selected,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Ionicons name={icon} size={20} color={selected ? colors.accent : colors.textMuted} />
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{text}</Text>
    </Pressable>
  );
}

const CONDITION_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Novo: 'sparkles-outline',
  Usado: 'time-outline',
  'Bom estado': 'checkmark-circle-outline',
};

/**
 * RC1 rejection-loop fix, 2026-08-13 — a photo value that could be either a
 * freshly-picked local asset (ImagePicker.ImagePickerAsset) or the existing
 * remote URL prefilled in edit mode. Only the fields this screen actually
 * reads are required, so both shapes satisfy it structurally.
 *
 * V2 multi-photo (2026-08-17) — a local (freshly-picked, not yet uploaded)
 * entry always has a `file://`/`content://`/`ph://`-style uri; a remote
 * (already on Drive, kept as-is) entry always has an `http(s)://` uri —
 * onSubmit uses that prefix to decide which entries need uploading.
 */
type PhotoValue = { uri: string; mimeType?: string };

/** V2 multi-photo (2026-08-17) — mirrors the server's own MAX_PHOTOS cap (assertValidPhotoCount). */
const MAX_PHOTOS = 10;
/**
 * Longest edge, in px, after resize — large enough to show genuine detail
 * (a car's dashboard/odometer/damage), small enough to keep upload time and
 * Drive storage reasonable. Requirement was previously unmet even for the
 * single-photo case (quality: 0.8 alone only affects JPEG re-encoding, not
 * pixel dimensions).
 */
const MAX_PHOTO_DIMENSION = 1600;

async function compressPhotoAsset(asset: { uri: string; width?: number; height?: number }): Promise<PhotoValue> {
  const actions: ImageManipulator.Action[] =
    asset.width && asset.height && Math.max(asset.width, asset.height) > MAX_PHOTO_DIMENSION
      ? [
          asset.width >= asset.height
            ? { resize: { width: MAX_PHOTO_DIMENSION } }
            : { resize: { height: MAX_PHOTO_DIMENSION } },
        ]
      : [];
  const result = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return { uri: result.uri, mimeType: 'image/jpeg' };
}

export function DonateScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { firebaseUser, session } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  // RC1 rejection-loop fix, 2026-08-13 — when opened from MyDonationsScreen's
  // "Editar" action on a rejected donation, this same screen prefills every
  // field from the existing donation and PATCHes instead of POSTing. See the
  // RootStackParamList comment for why the full object (not just an ID) is
  // passed through navigation.
  const editDonation = route.params?.editDonation;
  const isEditMode = !!editDonation;

  const [itemType, setItemType] = useState<string>(editDonation?.Item_Type ?? ITEM_TYPES[0]);
  // RC1 UX fix, 2026-08-10 — reverted the "start at 1" default: it let a
  // donor swipe/submit past the quantity step without ever touching it,
  // silently sending whatever the last value was. Starting empty forces a
  // deliberate entry; submitting empty is now a real, visible validation
  // failure instead of a silent default.
  const [quantity, setQuantity] = useState(editDonation ? String(editDonation.Quantity) : '');
  // RC1 audit fix, 2026-08-10 — server-side validation already rejected an
  // invalid quantity/missing photo; this only adds the visual cue so the
  // donor can immediately see WHICH field the top error banner is about,
  // instead of having to re-scan the whole form.
  const [quantityInvalid, setQuantityInvalid] = useState(false);
  const [photoMissing, setPhotoMissing] = useState(false);
  const [condition, setCondition] = useState<string>(editDonation?.Condition ?? CONDITIONS[0]);
  const [recipientCategory, setRecipientCategory] = useState<RecipientCategory>(
    editDonation?.Recipient_Category ?? RECIPIENT_CATEGORIES[0],
  );
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(
    editDonation?.Delivery_Method ?? DELIVERY_METHODS[0],
  );
  // V2 multi-photo (2026-08-17) — up to MAX_PHOTOS, first = cover. Prefilled
  // from the full Photos array in edit mode (falling back to the single
  // legacy Photo for the rare pre-Photos donation row — see rowToDonation).
  const [photos, setPhotos] = useState<PhotoValue[]>(
    editDonation
      ? (editDonation.Photos.length > 0 ? editDonation.Photos : [editDonation.Photo].filter(Boolean)).map((uri) => ({
          uri,
        }))
      : [],
  );

  const [corporateAccount, setCorporateAccount] = useState<CorporateAccount | null>(null);
  const [isCorporateDonation, setIsCorporateDonation] = useState(false);

  const [locationStatus, setLocationStatus] = useState<LocationStatus>(isEditMode ? 'captured' : 'capturing');
  const [lat, setLat] = useState(editDonation ? String(editDonation.Location.lat) : '');
  const [lng, setLng] = useState(editDonation ? String(editDonation.Location.lng) : '');
  const [address, setAddress] = useState(editDonation?.Address ?? '');
  const [locationError, setLocationError] = useState('');
  // Donate screen redesign, 2026-08-07 — the address/override field is
  // valuable (see RC1 pickup-location fix) but not needed on the common
  // path where GPS just works, so it's tucked behind a link rather than
  // always taking up space — "fast to fill" for the donor who has nothing
  // to add, still available for the one who does.
  const [addressExpanded, setAddressExpanded] = useState(!!editDonation?.Address);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Bug fix, 2026-08-11 — a fast double-tap could call onSubmit() twice
  // before the `submitting` state update actually re-renders the Button as
  // disabled (React state isn't synchronous), firing two overlapping photo
  // uploads. A ref updates immediately, in the same tick, so this closes the
  // race window `setSubmitting` alone couldn't.
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!firebaseUser || !session?.corporateAccountId) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setCorporateAccount(await apiFetch<CorporateAccount | null>('/donor/corporate-account', { idToken }));
      } catch {
        // Non-critical — the form just falls back to personal-only if this fails.
      }
    })();
  }, [firebaseUser, session?.corporateAccountId]);

  useEffect(() => {
    // Edit mode already has a valid location from the original submission —
    // re-capturing GPS here would silently move the pickup point out from
    // under a donor who's just fixing an unrelated field like Item_Type.
    if (isEditMode) return;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('failed');
        return;
      }
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLat(String(position.coords.latitude));
        setLng(String(position.coords.longitude));
        setLocationStatus('captured');
      } catch {
        setLocationStatus('failed');
      }
    })();
  }, []);

  // Pilot feedback, 2026-08-05: only the gallery was ever offered here —
  // Institution's success-story photo already got a camera option
  // (2026-08-04); this was the last of the three upload points to catch up.
  //
  // V2 multi-photo (2026-08-17) — camera stays one-shot-per-tap (that's how
  // capture works); the library picker now allows selecting several at once,
  // up to whatever room is left. Both compress before adding to state.
  async function onPickFromCamera() {
    if (photos.length >= MAX_PHOTOS) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setError(t('donate.cameraPermissionError'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const compressed = await compressPhotoAsset(result.assets[0]);
      setPhotos((prev) => [...prev, compressed].slice(0, MAX_PHOTOS));
    }
  }

  async function onPickFromLibrary() {
    if (photos.length >= MAX_PHOTOS) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError(t('donate.libraryPermissionError'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
    });
    if (!result.canceled && result.assets.length > 0) {
      const compressed = await Promise.all(result.assets.map(compressPhotoAsset));
      setPhotos((prev) => [...prev, ...compressed].slice(0, MAX_PHOTOS));
    }
  }

  function onPickPhoto() {
    Alert.alert(t('donate.addPhoto'), undefined, [
      { text: t('donate.takePhoto'), onPress: onPickFromCamera },
      { text: t('donate.chooseFromLibrary'), onPress: onPickFromLibrary },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  /** V2 multi-photo (2026-08-17) — non-cover thumbnails also offer "make cover"; the cover thumbnail only offers remove. */
  function onPhotoThumbnailPress(index: number) {
    const options: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [];
    if (index !== 0) {
      options.push({ text: t('donate.makeCover'), onPress: () => onMakeCover(index) });
    }
    options.push({ text: t('donate.removePhoto'), onPress: () => onRemovePhoto(index), style: 'destructive' });
    options.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(t('donate.photoOptionsTitle'), undefined, options);
  }

  function onRemovePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function onMakeCover(index: number) {
    setPhotos((prev) => {
      if (index <= 0 || index >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.unshift(item);
      return copy;
    });
  }

  const hasValidLocation =
    lat !== '' && lng !== '' && !(Number(lat) === 0 && Number(lng) === 0) && !Number.isNaN(Number(lat));

  async function onFindAddress() {
    setLocationError('');
    if (!address.trim()) {
      setLocationError(t('donate.addressRequiredError'));
      return;
    }
    setLocationStatus('geocoding');
    try {
      const idToken = await firebaseUser?.getIdToken();
      const result = await apiFetch<{ lat: number; lng: number }>(
        `/geo-regions/geocode?address=${encodeURIComponent(address)}`,
        { idToken },
      );
      setLat(String(result.lat));
      setLng(String(result.lng));
      setLocationStatus('geocoded');
    } catch (err) {
      setLocationError(err instanceof ApiError ? err.message : t('donate.geocodeFailedError'));
      setLocationStatus('failed');
    }
  }

  const quantityNumber = Number(quantity) || 0;
  function adjustQuantity(delta: number) {
    setQuantity(String(Math.max(1, quantityNumber + delta)));
  }

  // RC1 UX fix, 2026-08-10 — when a required field blocks submission, jump
  // the donor straight to it instead of leaving them to scroll and hunt for
  // which field the top error banner is about.
  const scrollRef = useRef<ScrollView>(null);
  const quantityInputRef = useRef<TextInput>(null);
  const photoSectionRef = useRef<View>(null);

  // Works against TextInput or View refs at runtime — RN's TS types don't
  // model ScrollView as a valid measureLayout target, so this goes through
  // `unknown` rather than fighting RefObject variance for one call site.
  type MeasureLayoutFn = (relativeToNativeNode: unknown, onSuccess: (x: number, y: number) => void) => void;
  function scrollToSection(current: unknown) {
    try {
      (current as { measureLayout?: MeasureLayoutFn } | null)?.measureLayout?.(scrollRef.current, (_x, y) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
      });
    } catch {
      // Best-effort — the field's own error state is still visible either way.
    }
  }

  async function onSubmit() {
    if (submittingRef.current) return;

    setError('');
    setPhotoMissing(false);
    setQuantityInvalid(false);

    if (!quantity || Number(quantity) < 1) {
      setQuantityInvalid(true);
      setError(t('donate.quantityRequiredError'));
      scrollToSection(quantityInputRef.current);
      quantityInputRef.current?.focus();
      return;
    }
    if (photos.length === 0) {
      setPhotoMissing(true);
      setError(t('donate.photoRequiredErrorFull'));
      scrollToSection(photoSectionRef.current);
      return;
    }
    if (!hasValidLocation) {
      setError(t('donate.locationRequiredError'));
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const idToken = await firebaseUser?.getIdToken();

      // V2 multi-photo (2026-08-17) — `uploadAsync` only ever sends one file
      // per request (see lib/api.ts), so each photo uploads individually,
      // sequentially (bounds concurrency on a possibly-poor mobile
      // connection); an already-remote entry (kept, unchanged, edit mode
      // only) is never re-uploaded — its http(s) URL is reused as-is.
      const photoUrls: string[] = [];
      for (const p of photos) {
        photoUrls.push(p.uri.startsWith('http') ? p.uri : await uploadDonationPhoto(p.uri, idToken, p.mimeType ?? 'image/jpeg'));
      }

      if (isEditMode) {
        // RC1 rejection-loop fix, 2026-08-13 / V2 multi-photo, 2026-08-17 —
        // only send Photos in the patch if the set actually changed
        // (added/removed/reordered/re-uploaded); otherwise a plain field-only
        // PATCH leaves the existing Photos untouched.
        const photosChanged =
          photoUrls.length !== editDonation!.Photos.length ||
          photoUrls.some((url, i) => url !== editDonation!.Photos[i]);

        await apiFetch(`/donations/${editDonation!.Donation_ID}`, {
          method: 'PATCH',
          idToken,
          body: {
            Item_Type: itemType,
            Quantity: Number(quantity),
            Condition: condition,
            Recipient_Category: recipientCategory,
            Delivery_Method: deliveryMethod,
            Address: address,
            Location: { lat: Number(lat), lng: Number(lng) },
            ...(photosChanged ? { Photos: photoUrls } : {}),
          },
        });
        showToast(t('donate.editSuccess'));
        navigation.navigate('Tabs', { screen: 'MyDonations' });
        return;
      }

      await apiFetch('/donations', {
        method: 'POST',
        idToken,
        body: {
          Item_Type: itemType,
          Quantity: Number(quantity),
          Condition: condition,
          Recipient_Category: recipientCategory,
          Delivery_Method: deliveryMethod,
          Address: address,
          Location_lat: lat,
          Location_lng: lng,
          Photos: photoUrls,
          ...(corporateAccount ? { isCorporateDonation: String(isCorporateDonation) } : {}),
        },
      });
      setQuantity('1');
      setPhotos([]);
      showToast(t('donate.submitSuccess'));
      // Real-device finding, 2026-08-04: staying on the form after a
      // successful submit read as "did this actually work?" — the toast
      // above is easy to miss, and nothing on this screen changes to confirm
      // it. Navigating to the list where the new donation now appears is the
      // clearest possible confirmation.
      navigation.navigate('Tabs', { screen: 'MyDonations' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t(isEditMode ? 'donate.editError' : 'donate.submitError'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const recipientChips = RECIPIENT_CATEGORIES.map((c) => ({
    value: c,
    ...splitEmojiLabel(t(RECIPIENT_CATEGORY_LABEL_KEY[c])),
  }));
  const deliveryChips = DELIVERY_METHODS.map((m) => ({
    value: m,
    ...splitEmojiLabel(t(DELIVERY_METHOD_LABEL_KEY[m])),
  }));

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerSpacer} />
          <Text style={styles.title}>{t(isEditMode ? 'donate.editTitle' : 'donate.title')}</Text>
          {/* Navigation audit, 2026-08-07 — now that this screen is a modal
              reached from Home's "Doar agora" button (not a tab), it needs an
              explicit way back for anyone who opens it and changes their
              mind; the OS back gesture/button alone isn't discoverable
              enough on Android. */}
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t('donate.close')}
            hitSlop={12}
            style={styles.headerSpacer}
          >
            <Ionicons name="close" size={26} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Text style={styles.heroIcon}>{isEditMode ? '✏️' : '🎁'}</Text>
          </View>
          <Text style={styles.heroTitle}>{t(isEditMode ? 'donate.editHeroTitle' : 'donate.heroTitle')}</Text>
          <Text style={styles.heroSubtitle}>{t(isEditMode ? 'donate.editHeroSubtitle' : 'donate.heroSubtitle')}</Text>
        </View>

        {/* RC1 rejection-loop fix, 2026-08-13 — the whole reason this screen
            has an edit mode: without this, the donor sees a red "Rejeitada"
            badge on their donation card but never learns why. */}
        {isEditMode && editDonation?.Approval_Rejection_Reason && (
          <ErrorBanner message={`${t('donations.rejectionReasonLabel')} ${editDonation.Approval_Rejection_Reason}`} />
        )}

        <Card style={{ gap: spacing[5] }}>
          <View style={{ gap: spacing[2] }}>
            <SectionHeader n={1} title={t('donate.sectionItemType')} />
            <Select
              label={t('donate.sectionItemType')}
              hideLabel
              value={itemType}
              onValueChange={setItemType}
              options={ITEM_TYPES}
            />
            {/* 'Material Médico' addition, 2026-08-07 — see MEDICAL_SUPPLY_INFO's comment in @wafina/shared. */}
            {itemType === 'Material Médico' && (
              <View style={styles.medicalSupplyNotice}>
                <Ionicons name="information-circle-outline" size={16} color={colors.info} />
                <Text style={styles.medicalSupplyNoticeText}>{MEDICAL_SUPPLY_INFO}</Text>
              </View>
            )}
          </View>

          <View style={{ gap: spacing[2] }}>
            <View style={styles.photoHeaderRow}>
              <SectionHeader n={2} title={t('donate.sectionQuantity')} />
              <View style={styles.requiredPill}>
                <Text style={styles.requiredPillText}>{t('donate.required')}</Text>
              </View>
            </View>
            <View style={[styles.stepperRow, quantityInvalid && styles.stepperRowInvalid]}>
              <Pressable
                style={styles.stepperBtn}
                onPress={() => {
                  setQuantityInvalid(false);
                  adjustQuantity(-1);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('donate.decreaseQuantity')}
                hitSlop={8}
              >
                <Ionicons name="remove" size={20} color={colors.accentText} />
              </Pressable>
              {/* Real-device feedback, 2026-08-07 — the stepper-only quantity forced a tap-and-hold for anything beyond a couple of items; typing the number directly is faster for larger quantities. */}
              <View style={styles.stepperInputWrap}>
                <TextInput
                  ref={quantityInputRef}
                  style={styles.stepperInput}
                  value={quantity}
                  placeholder="0"
                  placeholderTextColor={colors.textFaint}
                  onChangeText={(v) => {
                    setQuantityInvalid(false);
                    setQuantity(v.replace(/[^0-9]/g, '').slice(0, 6));
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  accessibilityLabel={t('donate.quantityLabel')}
                />
              </View>
              <Pressable
                style={styles.stepperBtn}
                onPress={() => {
                  setQuantityInvalid(false);
                  adjustQuantity(1);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('donate.increaseQuantity')}
                hitSlop={8}
              >
                <Ionicons name="add" size={20} color={colors.accentText} />
              </Pressable>
            </View>
            {quantityInvalid ? (
              <Text style={styles.fieldErrorText}>⚠️ {t('donate.quantityRequiredError')}</Text>
            ) : (
              <Text style={styles.hint}>{t('donate.quantityRequiredHint')}</Text>
            )}
          </View>

          <View style={{ gap: spacing[2] }}>
            <SectionHeader n={3} title={t('donate.sectionCondition')} />
            <View style={styles.chipRow}>
              {CONDITIONS.map((c) => (
                <IconChip
                  key={c}
                  icon={CONDITION_ICON[c] ?? 'ellipse-outline'}
                  text={c}
                  selected={condition === c}
                  onPress={() => setCondition(c)}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: spacing[2] }}>
            <SectionHeader n={4} title={t('donate.sectionRecipient')} />
            <View style={styles.chipRow}>
              {recipientChips.map((c) => (
                <EmojiChip
                  key={c.value}
                  emoji={c.emoji}
                  text={c.text}
                  selected={recipientCategory === c.value}
                  onPress={() => setRecipientCategory(c.value)}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: spacing[2] }}>
            <SectionHeader n={5} title={t('donate.sectionDeliveryMethod')} />
            <View style={styles.chipRow}>
              {deliveryChips.map((m) => (
                <EmojiChip
                  key={m.value}
                  emoji={m.emoji}
                  text={m.text}
                  selected={deliveryMethod === m.value}
                  onPress={() => setDeliveryMethod(m.value)}
                  wide
                />
              ))}
            </View>
          </View>

          {/* RC1 rejection-loop fix, 2026-08-13 — Corporate_Account_ID is set once at
              creation and isn't part of editDonation's patchable fields (see
              services/donations.ts), so this choice is meaningless once editing. */}
          {corporateAccount && !isEditMode && (
            <View style={{ gap: spacing[2] }}>
              <SectionHeader n={6} title={t('donate.sectionDonateAs')} />
              <Select
                label={t('donate.donateAsLabel')}
                hideLabel
                value={isCorporateDonation ? 'corporate' : 'personal'}
                onValueChange={(v) => setIsCorporateDonation(v === 'corporate')}
                options={[
                  { label: t('donate.personalDonationOption'), value: 'personal' },
                  {
                    label: t('donate.corporateDonationOption', { company: corporateAccount.Company_Name }),
                    value: 'corporate',
                  },
                ]}
              />
            </View>
          )}

          <View ref={photoSectionRef} style={{ gap: spacing[2] }}>
            <View style={styles.photoHeaderRow}>
              <SectionHeader n={corporateAccount && !isEditMode ? 7 : 6} title={t('donate.sectionPhoto')} />
              <View style={styles.requiredPill}>
                <Text style={styles.requiredPillText}>{t('donate.required')}</Text>
              </View>
            </View>
            {photos.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photoRow}
              >
                {photos.map((p, index) => (
                  <Pressable
                    key={`${p.uri}-${index}`}
                    onPress={() => onPhotoThumbnailPress(index)}
                    style={styles.photoThumbWrap}
                    accessibilityRole="button"
                    accessibilityLabel={index === 0 ? t('donate.coverBadge') : t('donate.photoOptionsTitle')}
                  >
                    <Image source={{ uri: p.uri }} style={styles.photoThumb} resizeMode="cover" />
                    {index === 0 && (
                      <View style={styles.coverBadge}>
                        <Text style={styles.coverBadgeText}>{t('donate.coverBadge')}</Text>
                      </View>
                    )}
                    <Pressable
                      style={styles.removePhotoBtn}
                      onPress={() => onRemovePhoto(index)}
                      accessibilityRole="button"
                      accessibilityLabel={t('donate.removePhoto')}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={14} color={colors.accentText} />
                    </Pressable>
                  </Pressable>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <Pressable
                    style={styles.addPhotoTile}
                    onPress={onPickPhoto}
                    accessibilityRole="button"
                    accessibilityLabel={t('donate.addPhoto')}
                  >
                    <Ionicons name="add" size={26} color={colors.textMuted} />
                  </Pressable>
                )}
              </ScrollView>
            ) : (
              <Pressable
                style={[styles.uploadWell, photoMissing && styles.uploadWellInvalid]}
                onPress={() => {
                  setPhotoMissing(false);
                  onPickPhoto();
                }}
              >
                <Ionicons
                  name="camera-outline"
                  size={28}
                  color={photoMissing ? colors.danger : colors.textMuted}
                />
                <Text style={[styles.uploadText, photoMissing && { color: colors.danger }]}>
                  {t('donate.addPhoto')}
                </Text>
                <Text style={styles.uploadHint}>{t('donate.photoHint')}</Text>
              </Pressable>
            )}
            {photos.length > 0 && (
              <Text style={styles.hint}>{t('donate.photoCountHint', { count: photos.length, max: MAX_PHOTOS })}</Text>
            )}
            {photoMissing && <Text style={styles.fieldErrorText}>{t('donate.photoRequiredError')}</Text>}
          </View>

          <View style={{ gap: spacing[2] }}>
            {locationStatus === 'capturing' && <Text style={styles.hint}>{t('donate.gettingLocation')}</Text>}
            {(locationStatus === 'captured' || locationStatus === 'geocoded') && (
              <View style={styles.locationPill}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.locationPillTitle}>{t('donate.locationConfirmedTitle')}</Text>
                  <Text style={styles.locationPillHint}>{t('donate.locationConfirmedHint')}</Text>
                </View>
              </View>
            )}
            {(locationStatus === 'failed' || locationStatus === 'geocoding') && (
              <Text style={styles.hint}>{t('donate.locationFailedHint')}</Text>
            )}
            {/*
              RC1 pickup-location fix, 2026-08-07 — collapsed by default when
              GPS succeeds (keeps the form fast to fill), but always
              reachable: a map pin alone leaves the institution no way to
              identify the exact door/apartment or override where GPS
              happened to catch the donor standing. Forced open when GPS
              failed, since an address is then the only way to get a valid
              location at all.
            */}
            {!addressExpanded && (locationStatus === 'captured' || locationStatus === 'geocoded') ? (
              <Pressable onPress={() => setAddressExpanded(true)} hitSlop={4}>
                <Text style={styles.addressToggle}>{t('donate.addAddressToggle')}</Text>
              </Pressable>
            ) : (
              <View style={{ gap: spacing[2] }}>
                <Input
                  label={
                    locationStatus === 'failed' || locationStatus === 'geocoding'
                      ? t('donate.addressLabelFailed')
                      : t('donate.addressLabelOptional')
                  }
                  placeholder={t('donate.addressPlaceholder')}
                  value={address}
                  onChangeText={setAddress}
                />
                <Button variant="secondary" onPress={onFindAddress} loading={locationStatus === 'geocoding'}>
                  {hasValidLocation ? t('donate.useAddressInsteadOfGps') : t('donate.confirmAddress')}
                </Button>
                {locationError ? <ErrorBanner message={locationError} /> : null}
              </View>
            )}
          </View>

          {error ? <ErrorBanner message={error} /> : null}

          <Button variant="primary" size="large" onPress={onSubmit} loading={submitting} fullWidth>
            {t(isEditMode ? 'donate.saveChangesButton' : 'donate.submitButton')}
          </Button>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing[6],
    paddingBottom: spacing[12],
    gap: spacing[5],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Real-device feedback, 2026-08-07 — "Doar" read as off-center (pushed
  // left) because it shared the row with only a right-side close button.
  // A matching invisible spacer on the left balances the close icon's
  // width so the flex:1 title actually lands in the visual center.
  headerSpacer: {
    width: 26,
  },
  title: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
    textAlign: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: spacing[1],
    paddingBottom: spacing[1],
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.ctaSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  heroIcon: {
    fontSize: 26,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 19,
    color: colors.text,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: 'Manrope-400',
    fontSize: 13.5,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing[4],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  sectionBadge: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeText: {
    fontFamily: 'Manrope-700',
    fontSize: 12,
    color: colors.accentText,
  },
  sectionTitle: {
    fontFamily: 'Manrope-700',
    fontSize: 14.5,
    color: colors.text,
  },
  label: {
    fontFamily: 'Manrope-600',
    fontSize: 13,
    color: colors.text,
  },
  hint: {
    fontFamily: 'Manrope-400',
    fontSize: 12,
    color: colors.textFaint,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[5],
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  stepperRowInvalid: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInputWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[1],
    minWidth: 90,
    justifyContent: 'center',
  },
  stepperInput: {
    fontFamily: 'Manrope-700',
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    minWidth: 24,
    padding: 0,
  },
  stepperUnit: {
    fontFamily: 'Manrope-600',
    fontSize: 14,
    color: colors.text,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  chip: {
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
  },
  chipWide: {
    flexBasis: '47%',
  },
  chipSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipEmoji: {
    fontSize: 22,
  },
  chipText: {
    fontFamily: 'Manrope-600',
    fontSize: 12.5,
    color: colors.textMuted,
    textAlign: 'center',
  },
  chipTextSelected: {
    color: colors.accent,
  },
  photoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requiredPill: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.full,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  requiredPillText: {
    fontFamily: 'Manrope-700',
    fontSize: 10.5,
    letterSpacing: 0.4,
    color: colors.danger,
  },
  fieldErrorText: {
    fontFamily: 'Manrope-400',
    fontSize: 12.5,
    color: colors.danger,
  },
  uploadWell: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing[6],
    alignItems: 'center',
    gap: spacing[1],
  },
  uploadWellInvalid: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  uploadText: {
    fontFamily: 'Manrope-600',
    fontSize: 13.5,
    color: colors.textMuted,
  },
  uploadHint: {
    fontFamily: 'Manrope-400',
    fontSize: 11.5,
    color: colors.textFaint,
  },
  // V2 multi-photo (2026-08-17) — horizontal thumbnail row replacing the old
  // single full-width preview.
  photoRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  photoThumbWrap: {
    position: 'relative',
    width: 92,
    height: 92,
  },
  photoThumb: {
    width: 92,
    height: 92,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  coverBadge: {
    position: 'absolute',
    bottom: spacing[1],
    left: spacing[1],
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: radius.full,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  coverBadgeText: {
    fontFamily: 'Manrope-700',
    fontSize: 9.5,
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  addPhotoTile: {
    width: 92,
    height: 92,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing[3],
  },
  locationPillTitle: {
    fontFamily: 'Manrope-700',
    fontSize: 13.5,
    color: colors.text,
  },
  locationPillHint: {
    fontFamily: 'Manrope-400',
    fontSize: 12,
    color: colors.textMuted,
  },
  addressToggle: {
    fontFamily: 'Manrope-600',
    fontSize: 13,
    color: colors.accent,
  },
  medicalSupplyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    backgroundColor: colors.infoSoft,
    borderRadius: radius.md,
    padding: spacing[3],
  },
  medicalSupplyNoticeText: {
    flex: 1,
    fontFamily: 'Manrope-400',
    fontSize: 12,
    color: colors.text,
  },
});
