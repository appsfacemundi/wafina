import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  CONDITIONS,
  DELIVERY_METHOD_LABEL,
  DELIVERY_METHODS,
  ITEM_TYPES,
  MEDICAL_SUPPLY_INFO,
  RECIPIENT_CATEGORIES,
  RECIPIENT_CATEGORY_LABEL,
  type CorporateAccount,
  type DeliveryMethod,
  type RecipientCategory,
} from '@wafina/shared';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorBanner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ApiError, apiFetch, uploadFile } from '@/lib/api';
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

export function DonateScreen({ navigation }: Props) {
  const { firebaseUser, session } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [itemType, setItemType] = useState<string>(ITEM_TYPES[0]);
  // Donate screen redesign, 2026-08-07 — a blank starting quantity read as an
  // incomplete/broken stepper (0 peças with a still-tappable "−"). Starting
  // at 1 matches how every stepper control behaves and needs one less tap
  // for the overwhelmingly common single-item donation.
  const [quantity, setQuantity] = useState('1');
  const [condition, setCondition] = useState<string>(CONDITIONS[0]);
  const [recipientCategory, setRecipientCategory] = useState<RecipientCategory>(RECIPIENT_CATEGORIES[0]);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(DELIVERY_METHODS[0]);
  const [city, setCity] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const [corporateAccount, setCorporateAccount] = useState<CorporateAccount | null>(null);
  const [isCorporateDonation, setIsCorporateDonation] = useState(false);

  const [locationStatus, setLocationStatus] = useState<LocationStatus>('capturing');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [address, setAddress] = useState('');
  const [locationError, setLocationError] = useState('');
  // Donate screen redesign, 2026-08-07 — the address/override field is
  // valuable (see RC1 pickup-location fix) but not needed on the common
  // path where GPS just works, so it's tucked behind a link rather than
  // always taking up space — "fast to fill" for the donor who has nothing
  // to add, still available for the one who does.
  const [addressExpanded, setAddressExpanded] = useState(false);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
  async function onPickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setError('É necessário acesso à câmara para tirar uma fotografia.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
  }

  async function onPickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('É necessário acesso às fotografias para anexar uma imagem.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
  }

  function onPickPhoto() {
    Alert.alert('Adicionar fotografia', undefined, [
      { text: 'Tirar fotografia', onPress: onPickFromCamera },
      { text: 'Escolher da galeria', onPress: onPickFromLibrary },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  const hasValidLocation =
    lat !== '' && lng !== '' && !(Number(lat) === 0 && Number(lng) === 0) && !Number.isNaN(Number(lat));

  async function onFindAddress() {
    setLocationError('');
    if (!address.trim()) {
      setLocationError('Introduza uma morada.');
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
      setLocationError(err instanceof ApiError ? err.message : 'Não foi possível localizar essa morada.');
      setLocationStatus('failed');
    }
  }

  const quantityNumber = Number(quantity) || 0;
  function adjustQuantity(delta: number) {
    setQuantity(String(Math.max(1, quantityNumber + delta)));
  }

  async function onSubmit() {
    setError('');

    if (!photo) {
      setError('Adicione uma fotografia da doação.');
      return;
    }
    if (!quantity || Number(quantity) < 1) {
      setError('Indique uma quantidade válida.');
      return;
    }
    if (!hasValidLocation) {
      setError('É necessária uma localização válida. Ative o GPS ou confirme a sua morada.');
      return;
    }

    setSubmitting(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await uploadFile('/donations', 'photo', photo.uri, {
        idToken,
        mimeType: photo.mimeType ?? 'image/jpeg',
        parameters: {
          Item_Type: itemType,
          Quantity: quantity,
          Condition: condition,
          Recipient_Category: recipientCategory,
          Delivery_Method: deliveryMethod,
          City: city,
          Address: address,
          Location_lat: lat,
          Location_lng: lng,
          ...(corporateAccount ? { isCorporateDonation: String(isCorporateDonation) } : {}),
        },
      });
      setQuantity('1');
      setPhoto(null);
      showToast('Doação submetida com sucesso!');
      // Real-device finding, 2026-08-04: staying on the form after a
      // successful submit read as "did this actually work?" — the toast
      // above is easy to miss, and nothing on this screen changes to confirm
      // it. Navigating to the list where the new donation now appears is the
      // clearest possible confirmation.
      navigation.navigate('Tabs', { screen: 'MyDonations' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível submeter a doação.');
    } finally {
      setSubmitting(false);
    }
  }

  const recipientChips = RECIPIENT_CATEGORIES.map((c) => ({ value: c, ...splitEmojiLabel(RECIPIENT_CATEGORY_LABEL[c]) }));
  const deliveryChips = DELIVERY_METHODS.map((m) => ({ value: m, ...splitEmojiLabel(DELIVERY_METHOD_LABEL[m]) }));

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerSpacer} />
          <Text style={styles.title}>Doar</Text>
          {/* Navigation audit, 2026-08-07 — now that this screen is a modal
              reached from Home's "Doar agora" button (not a tab), it needs an
              explicit way back for anyone who opens it and changes their
              mind; the OS back gesture/button alone isn't discoverable
              enough on Android. */}
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            hitSlop={12}
            style={styles.headerSpacer}
          >
            <Ionicons name="close" size={26} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Text style={styles.heroIcon}>🎁</Text>
          </View>
          <Text style={styles.heroTitle}>A sua doação transforma vidas</Text>
          <Text style={styles.heroSubtitle}>
            Preencha os dados abaixo para conectarmos a sua doação a quem mais precisa.
          </Text>
        </View>

        <Card style={{ gap: spacing[5] }}>
          <View style={{ gap: spacing[2] }}>
            <SectionHeader n={1} title="Tipo de item" />
            <Select label="Tipo de item" hideLabel value={itemType} onValueChange={setItemType} options={ITEM_TYPES} />
            {/* 'Material Médico' addition, 2026-08-07 — see MEDICAL_SUPPLY_INFO's comment in @wafina/shared. */}
            {itemType === 'Material Médico' && (
              <View style={styles.medicalSupplyNotice}>
                <Ionicons name="information-circle-outline" size={16} color={colors.info} />
                <Text style={styles.medicalSupplyNoticeText}>{MEDICAL_SUPPLY_INFO}</Text>
              </View>
            )}
          </View>

          <View style={{ gap: spacing[2] }}>
            <SectionHeader n={2} title="Quantidade" />
            <View style={styles.stepperRow}>
              <Pressable
                style={styles.stepperBtn}
                onPress={() => adjustQuantity(-1)}
                accessibilityRole="button"
                accessibilityLabel="Diminuir quantidade"
                hitSlop={8}
              >
                <Ionicons name="remove" size={20} color={colors.accentText} />
              </Pressable>
              {/* Real-device feedback, 2026-08-07 — the stepper-only quantity forced a tap-and-hold for anything beyond a couple of items; typing the number directly is faster for larger quantities. */}
              <View style={styles.stepperInputWrap}>
                <TextInput
                  style={styles.stepperInput}
                  value={quantity}
                  onChangeText={(v) => setQuantity(v.replace(/[^0-9]/g, ''))}
                  onBlur={() => setQuantity(String(Math.max(1, Number(quantity) || 1)))}
                  keyboardType="number-pad"
                  accessibilityLabel="Quantidade"
                />
                <Text style={styles.stepperUnit}>{quantityNumber === 1 ? 'peça' : 'peças'}</Text>
              </View>
              <Pressable
                style={styles.stepperBtn}
                onPress={() => adjustQuantity(1)}
                accessibilityRole="button"
                accessibilityLabel="Aumentar quantidade"
                hitSlop={8}
              >
                <Ionicons name="add" size={20} color={colors.accentText} />
              </Pressable>
            </View>
          </View>

          <View style={{ gap: spacing[2] }}>
            <SectionHeader n={3} title="Estado do item" />
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
            <SectionHeader n={4} title="Destinatário" />
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
            <SectionHeader n={5} title="Método de entrega" />
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

          {corporateAccount && (
            <View style={{ gap: spacing[2] }}>
              <SectionHeader n={6} title="Doar como" />
              <Select
                label="Doar como"
                hideLabel
                value={isCorporateDonation ? 'corporate' : 'personal'}
                onValueChange={(v) => setIsCorporateDonation(v === 'corporate')}
                options={[
                  { label: 'Doação Pessoal', value: 'personal' },
                  { label: `Doação da Empresa (${corporateAccount.Company_Name})`, value: 'corporate' },
                ]}
              />
            </View>
          )}

          <View style={{ gap: spacing[2] }}>
            <SectionHeader n={corporateAccount ? 7 : 6} title="Cidade (opcional)" />
            <Input label="Cidade" hideLabel placeholder="Ex: Luanda" value={city} onChangeText={setCity} />
          </View>

          <View style={{ gap: spacing[2] }}>
            <SectionHeader n={corporateAccount ? 8 : 7} title="Fotografia da doação" />
            {photo ? (
              <Pressable onPress={onPickPhoto} style={styles.previewWrap}>
                <Image source={{ uri: photo.uri }} style={styles.preview} />
                <Pressable
                  style={styles.removePhotoBtn}
                  onPress={() => setPhoto(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Remover fotografia"
                  hitSlop={8}
                >
                  <Ionicons name="close" size={16} color={colors.accentText} />
                </Pressable>
              </Pressable>
            ) : (
              <Pressable style={styles.uploadWell} onPress={onPickPhoto}>
                <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
                <Text style={styles.uploadText}>Adicionar fotografia</Text>
                <Text style={styles.uploadHint}>PNG, JPG até 8MB</Text>
              </Pressable>
            )}
          </View>

          <View style={{ gap: spacing[2] }}>
            {locationStatus === 'capturing' && <Text style={styles.hint}>A obter a sua localização…</Text>}
            {(locationStatus === 'captured' || locationStatus === 'geocoded') && (
              <View style={styles.locationPill}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.locationPillTitle}>Localização confirmada</Text>
                  <Text style={styles.locationPillHint}>
                    Usada apenas para conectar a doação a instituições próximas — a sua privacidade é respeitada.
                  </Text>
                </View>
              </View>
            )}
            {(locationStatus === 'failed' || locationStatus === 'geocoding') && (
              <Text style={styles.hint}>
                Não foi possível obter a sua localização automaticamente. Indique a morada de recolha.
              </Text>
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
                <Text style={styles.addressToggle}>+ Adicionar morada ou referência de recolha (opcional)</Text>
              </Pressable>
            ) : (
              <View style={{ gap: spacing[2] }}>
                <Input
                  label={locationStatus === 'failed' || locationStatus === 'geocoding' ? 'Morada de recolha' : 'Morada / referência de recolha (opcional)'}
                  placeholder="Ex: Rua Amílcar Cabral 23, apto 4B, portão azul"
                  value={address}
                  onChangeText={setAddress}
                />
                <Button variant="secondary" onPress={onFindAddress} loading={locationStatus === 'geocoding'}>
                  {hasValidLocation ? 'Recolher nesta morada em vez do GPS' : 'Confirmar morada'}
                </Button>
                {locationError ? <ErrorBanner message={locationError} /> : null}
              </View>
            )}
          </View>

          {error ? <ErrorBanner message={error} /> : null}

          <Button variant="cta" size="large" onPress={onSubmit} loading={submitting} fullWidth>
            ❤️ Confirmar doação
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
  uploadWell: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing[6],
    alignItems: 'center',
    gap: spacing[1],
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
  previewWrap: {
    position: 'relative',
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
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
