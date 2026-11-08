import React from 'react';
import {
  ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, space, type } from '../theme';

export function Button(props: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}) {
  const { title, onPress, variant = 'primary', loading, disabled, small, icon, style } = props;
  const bg = variant === 'primary' ? colors.primary
    : variant === 'danger' ? colors.danger
    : variant === 'secondary' ? colors.primarySoft
    : 'transparent';
  const fg = variant === 'primary' || variant === 'danger' ? '#fff'
    : variant === 'secondary' ? colors.primaryDark
    : colors.primary;
  const off = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size={small ? 'small' : 'small'} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={fg} /> : null}
          <Text style={[s.btnText, small && { fontSize: 13.5 }, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Field({ label, error, ...rest }: TextInputProps & { label?: string; error?: string }) {
  return (
    <View style={{ marginBottom: space.md }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.subtle}
        {...rest}
        style={[s.input, error ? { borderColor: colors.danger } : null, rest.style]}
      />
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Chip({
  label, selected, onPress, tone, icon,
}: {
  label: string; selected?: boolean; onPress?: () => void; tone?: 'warn' | 'good' | 'danger' | 'accent'; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const toneBg = tone === 'warn' ? colors.warnSoft
    : tone === 'good' ? colors.goodSoft
    : tone === 'danger' ? colors.dangerSoft
    : tone === 'accent' ? colors.accentSoft
    : '#fff';
  const toneFg = tone === 'warn' ? colors.warn
    : tone === 'good' ? colors.good
    : tone === 'danger' ? colors.danger
    : tone === 'accent' ? colors.accent
    : colors.ink;

  const body = (
    <View
      style={[
        s.chip,
        {
          backgroundColor: selected ? colors.primary : toneBg,
          borderColor: selected ? colors.primary : colors.line,
        },
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={14}
          color={selected ? '#fff' : toneFg}
          style={{ marginRight: 4 }}
        />
      ) : null}
      <Text style={{ color: selected ? '#fff' : toneFg, fontSize: 13, fontWeight: selected ? '600' : '500' }}>
        {label}
      </Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress} hitSlop={4}>{body}</Pressable> : body;
}

export function Center({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>{children}</View>;
}

export function Loading() {
  return <Center><ActivityIndicator size="large" color={colors.primary} /></Center>;
}

export function EmptyState({ title, hint, icon = 'receipt-outline' }: { title: string; hint?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <Center>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: space.md }}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={[type.heading, { textAlign: 'center' }]}>{title}</Text>
      {hint ? <Text style={[type.small, { textAlign: 'center', marginTop: space.xs, maxWidth: 280 }]}>{hint}</Text> : null}
    </Center>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Center>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: space.md }}>
        <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
      </View>
      <Text style={[type.body, { textAlign: 'center', marginBottom: space.lg }]}>{message}</Text>
      <Button title="Try again" onPress={onRetry} variant="secondary" />
    </Center>
  );
}

export function SectionTitle({ children, rightAction }: { children: React.ReactNode; rightAction?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.lg, marginBottom: space.sm }}>
      <Text style={type.heading}>{children}</Text>
      {rightAction}
    </View>
  );
}

const CUTE_AVATARS = [
  { emoji: '🦊', bg: '#FFE4E6', border: '#FDA4AF' },
  { emoji: '🐼', bg: '#E0F2FE', border: '#7DD3FC' },
  { emoji: '🦁', bg: '#FEF3C7', border: '#FCD34D' },
  { emoji: '🐨', bg: '#F3E8FF', border: '#D8B4FE' },
  { emoji: '🐰', bg: '#FCE7F3', border: '#F472B6' },
  { emoji: '🐯', bg: '#FFEDD5', border: '#FDBA74' },
  { emoji: '🦉', bg: '#E2E8F0', border: '#CBD5E1' },
  { emoji: '🐧', bg: '#CFFAFE', border: '#67E8F9' },
  { emoji: '🐬', bg: '#DBEAFE', border: '#93C5FD' },
  { emoji: '🦄', bg: '#FDF4FF', border: '#F0ABFC' },
  { emoji: '🐻', bg: '#FEF9C3', border: '#FDE047' },
  { emoji: '🐙', bg: '#F1F5F9', border: '#CBD5E1' },
  { emoji: '🦦', bg: '#DCFCE7', border: '#86EFAC' },
  { emoji: '🐸', bg: '#ECFDF5', border: '#6EE7B7' },
];

export function getCuteAvatar(name: string) {
  let hash = 0;
  const str = (name || 'User').trim();
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % CUTE_AVATARS.length;
  return CUTE_AVATARS[index];
}

export function Avatar({
  name,
  size = 44,
  imageUri,
  color,
}: {
  name: string;
  size?: number;
  imageUri?: string | null;
  color?: string;
}) {
  const avatar = getCuteAvatar(name);
  const bg = color || avatar.bg;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        borderWidth: 1.5,
        borderColor: avatar.border,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Text style={{ fontSize: Math.round(size * 0.52), lineHeight: Math.round(size * 0.6) }}>
        {avatar.emoji}
      </Text>
    </View>
  );
}

/** Robust confirmation dialog that runs properly across Web, iOS, and Android. */
export function ConfirmModal(props: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onCancel}>
      <View style={s.backdrop}>
        <View style={s.dialog}>
          <Text style={[type.heading, { marginBottom: space.xs }]}>{props.title}</Text>
          <Text style={[type.body, { color: colors.muted, marginBottom: space.lg }]}>{props.message}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm }}>
            <Button title={props.cancelLabel ?? 'Cancel'} variant="ghost" small onPress={props.onCancel} disabled={props.loading} />
            <Button
              title={props.confirmLabel ?? 'Confirm'}
              variant={props.confirmVariant ?? 'primary'}
              small
              loading={props.loading}
              onPress={props.onConfirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Action sheet menu with proper options list, replacing native Alert.alert button arrays. */
export function ActionMenuModal(props: {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: { label: string; icon?: keyof typeof Ionicons.glyphMap; destructive?: boolean; onPress: () => void }[];
  onCancel: () => void;
}) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onCancel}>
      <Pressable style={s.backdrop} onPress={props.onCancel}>
        <Pressable style={s.actionSheet} onPress={(e) => e.stopPropagation()}>
          <View style={{ paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm }}>
            <Text style={type.heading}>{props.title}</Text>
            {props.subtitle ? <Text style={[type.small, { marginTop: 2 }]}>{props.subtitle}</Text> : null}
          </View>
          <View style={{ paddingVertical: space.xs }}>
            {props.options.map((opt, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  props.onCancel();
                  opt.onPress();
                }}
                style={({ pressed }) => [
                  s.menuItem,
                  { backgroundColor: pressed ? colors.lineLight : 'transparent' },
                ]}
              >
                {opt.icon ? (
                  <Ionicons
                    name={opt.icon}
                    size={20}
                    color={opt.destructive ? colors.danger : colors.ink}
                    style={{ marginRight: space.md }}
                  />
                ) : null}
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '500',
                    color: opt.destructive ? colors.danger : colors.ink,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={{ padding: space.md, borderTopWidth: 1, borderTopColor: colors.line }}>
            <Button title="Close" variant="ghost" small onPress={props.onCancel} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Small "type a name" popup used for rename / add person. */
export function PromptModal(props: {
  visible: boolean;
  title: string;
  placeholder?: string;
  initial?: string;
  confirmLabel?: string;
  autoCapitalize?: 'words' | 'sentences' | 'characters' | 'none';
  onCancel: () => void;
  onConfirm: (text: string) => void;
}) {
  const [text, setText] = React.useState(props.initial ?? '');
  React.useEffect(() => { if (props.visible) setText(props.initial ?? ''); }, [props.visible, props.initial]);

  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onCancel}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <Text style={[type.heading, { marginBottom: space.md }]}>{props.title}</Text>
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            placeholder={props.placeholder}
            placeholderTextColor={colors.subtle}
            autoCapitalize={props.autoCapitalize ?? 'words'}
            style={s.input}
            maxLength={100}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: space.lg, gap: space.sm }}>
            <Button title="Cancel" variant="ghost" small onPress={props.onCancel} />
            <Button
              title={props.confirmLabel ?? 'Save'}
              small
              disabled={!text.trim()}
              onPress={() => props.onConfirm(text.trim())}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  btn: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmall: {
    minHeight: 38,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
  },
  btnText: {
    fontSize: 15.5,
    fontWeight: '600',
  },
  label: {
    ...type.small,
    marginBottom: 6,
    fontWeight: '600',
    color: colors.ink,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    backgroundColor: '#fff',
    fontSize: 15.5,
    color: colors.ink,
  },
  error: {
    color: colors.danger,
    fontSize: 12.5,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: space.md,
    ...shadows.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    marginRight: space.xs + 2,
    marginBottom: space.xs + 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.lg,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: space.xl,
    width: '100%',
    maxWidth: 420,
    ...shadows.md,
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: space.xl,
    width: '100%',
    maxWidth: 400,
    ...shadows.md,
  },
  actionSheet: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    width: '100%',
    maxWidth: 420,
    overflow: 'hidden',
    ...shadows.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
});
