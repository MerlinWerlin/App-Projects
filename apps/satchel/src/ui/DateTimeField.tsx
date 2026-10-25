// Date and time fields (T24): one tap opens the system picker, so a date or time is set with a thumb instead of
// typing YYYY-MM-DD / HH:MM. Android shows its own dialog; iPhone gets a bottom sheet with the calendar or wheel
// and Cancel / Done at the bottom, within thumb reach. Times are the booking's wall clock in its own zone
// (src/core/wallpicker.ts), read back as "09:30 Tokyo time". Without the picker module (or if it fails) the field
// is the typed text field it used to be.
import { useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDay, zoneCity } from '../core/format.ts';
import { isValidZone } from '../core/tz.ts';
import { dayFromPicker, isLocalDate, isWallTime, pickedValue, pickerDateForDay, pickerDateForTime, timeFromPicker } from '../core/wallpicker.ts';
import { SystemPicker, systemPickerAvailable } from '../native/datePicker.tsx';
import { useApp } from '../state/app.tsx';
import { fonts, radius, space, TOUCH } from '../theme/tokens.ts';
import { Button, PressableScale, TextField } from './kit.tsx';

type Common = {
  /** Label beside the picker button, e.g. "Start date". */
  label: string;
  /** Label for the typed fallback, with the format: "Start date (YYYY-MM-DD)". */
  typedLabel: string;
  value: string;
  onChange: (v: string) => void;
  /** Screen-reader hint, e.g. "Choose the start date." */
  hint: string;
  error?: string;
};

/** A labelled button that looks like a field and shows the current value. */
function FieldButton({ label, shown, hint, error, onPress }: { label: string; shown: string; hint: string; error?: string; onPress: () => void }) {
  const { theme, t } = useApp();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: theme.muted }}>{label}</Text>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('pickers.fieldValue', { field: label, value: shown })}
        accessibilityHint={error ? `${error} ${hint}` : hint}
        onPress={onPress}
        style={{
          minHeight: TOUCH,
          borderWidth: 1,
          borderColor: error ? theme.danger : theme.line,
          borderRadius: radius.s,
          paddingHorizontal: space.m,
          paddingVertical: space.s,
          backgroundColor: theme.card,
        }}
      >
        <Text style={{ fontFamily: fonts.body, fontSize: 16, color: theme.ink }}>{shown}</Text>
      </PressableScale>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 14, color: theme.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function PickerField({ mode, shown, initial, minimumDate, ...p }: Common & { mode: 'date' | 'time'; shown: string; initial: () => Date; minimumDate?: Date }) {
  const { theme, t, reduceMotion } = useApp();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const [draft, setDraft] = useState<Date>(initial);
  const fail = () => {
    setOpen(false);
    setBroken(true);
  };

  if (broken || !systemPickerAvailable()) {
    return <TextField label={p.typedLabel} value={p.value} onChange={p.onChange} autoCapitalize="none" error={p.error} />;
  }

  const show = () => {
    setDraft(initial());
    setOpen(true);
  };
  const variant = theme.dark ? 'dark' : 'light';

  if (Platform.OS !== 'ios') {
    // Android: the picker is a system dialog that opens when rendered and reports once.
    return (
      <>
        <FieldButton label={p.label} shown={shown} hint={p.hint} error={p.error} onPress={show} />
        {open ? (
          <SystemPicker
            value={draft}
            mode={mode}
            display="default"
            is24Hour
            minimumDate={minimumDate}
            themeVariant={variant}
            onChange={(e, date) => {
              setOpen(false);
              const v = pickedValue(mode, e.type, date);
              if (v !== null) p.onChange(v);
            }}
            onFail={fail}
          />
        ) : null}
      </>
    );
  }

  const done = () => {
    setOpen(false);
    p.onChange(mode === 'date' ? dayFromPicker(draft) : timeFromPicker(draft));
  };
  return (
    <>
      <FieldButton label={p.label} shown={shown} hint={p.hint} error={p.error} onPress={show} />
      <Modal visible={open} transparent animationType={reduceMotion ? 'fade' : 'slide'} onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            accessibilityHint={t('pickers.cancelHint')}
            onPress={() => setOpen(false)}
            style={{ flex: 1, backgroundColor: theme.scrim }}
          />
          <View
            accessibilityViewIsModal
            style={{
              backgroundColor: theme.card,
              borderTopLeftRadius: radius.l,
              borderTopRightRadius: radius.l,
              borderWidth: 1,
              borderColor: theme.line,
              paddingHorizontal: space.l,
              paddingTop: space.l,
              paddingBottom: insets.bottom + space.l,
              gap: space.m,
            }}
          >
            <Text accessibilityRole="header" style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>
              {p.label}
            </Text>
            <SystemPicker
              value={draft}
              mode={mode}
              display={mode === 'date' ? 'inline' : 'spinner'}
              minimumDate={minimumDate}
              themeVariant={variant}
              accentColor={theme.accent}
              onChange={(_e, date) => {
                if (date && !Number.isNaN(date.getTime())) setDraft(date);
              }}
              onFail={fail}
            />
            <View style={{ flexDirection: 'row', gap: space.m }}>
              <View style={{ flex: 1 }}>
                <Button label={t('common.cancel')} hint={t('pickers.cancelHint')} kind="quiet" onPress={() => setOpen(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label={t('pickers.done')} hint={t('pickers.doneHint')} onPress={done} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

/** A calendar date (YYYY-MM-DD). `fallbackDay` is where the calendar opens while the value is empty. */
export function DateField(props: Common & { fallbackDay: string; minimumDay?: string }) {
  const { t, lang } = useApp();
  const shown = isLocalDate(props.value) ? formatDay(props.value, lang) : props.value ? props.value : t('pickers.notSet');
  const min = props.minimumDay && isLocalDate(props.minimumDay) ? pickerDateForDay(props.minimumDay, props.minimumDay) : undefined;
  if (min) min.setHours(0, 0, 0, 0);
  return <PickerField {...props} mode="date" shown={shown} minimumDate={min} initial={() => pickerDateForDay(props.value, props.fallbackDay)} />;
}

/** A wall-clock time (HH:MM, 24-hour) in `zone`, shown as "09:30 Tokyo time" when the zone is known. */
export function TimeField(props: Common & { zone: string }) {
  const { t } = useApp();
  const time = props.value;
  const shown = isWallTime(time) ? (isValidZone(props.zone) ? t('item.zone', { time, city: zoneCity(props.zone) }) : time) : time || t('pickers.notSet');
  return <PickerField {...props} mode="time" shown={shown} initial={() => pickerDateForTime(time)} />;
}
