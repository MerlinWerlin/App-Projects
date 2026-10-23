/**
 * Infrared protocol encoders. Each returns what Android's ConsumerIrManager.transmit() takes: a carrier
 * frequency in Hz and a pattern of alternating on/off durations in microseconds, starting with "on"
 * (carrier burst) and ending with "on" (a trailing "off" means nothing to the transmitter, except as
 * the gap between repeated frames).
 *
 * Timings are the published nominal values for each protocol (see CODES.md). UNVERIFIED on real TVs:
 * no worker has a phone with an IR blaster.
 */

export type IrProtocol = 'nec' | 'samsung32' | 'sirc12' | 'rc5' | 'kaseikyo';

export interface IrFrame {
  frequency: number;
  pattern: number[];
}

/** Protocol + address + command, the facts a code-set table stores per key. */
export interface IrCode {
  protocol: IrProtocol;
  address: number;
  command: number;
}

export interface EncodeOptions {
  /** RC5 toggle bit (flip it on each new key press so the TV sees a new press). Default 0. */
  toggle?: 0 | 1;
}

function checkRange(name: string, v: number, max: number): void {
  if (!Number.isInteger(v) || v < 0 || v > max) throw new RangeError(`${name} must be an integer 0..${max}, got ${v}`);
}

/** Bits of `value`, least significant first. */
function lsbFirst(value: number, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push((value >> i) & 1);
  return out;
}

/** Bits of `value`, most significant first. */
function msbFirst(value: number, count: number): number[] {
  const out: number[] = [];
  for (let i = count - 1; i >= 0; i--) out.push((value >> i) & 1);
  return out;
}

/** Pulse-distance bits (NEC family): every bit is a fixed mark, a 1 has a longer space. */
function pulseDistance(bits: number[], mark: number, zeroSpace: number, oneSpace: number): number[] {
  const out: number[] = [];
  for (const b of bits) out.push(mark, b ? oneSpace : zeroSpace);
  return out;
}

// NEC: 9 ms lead mark, 4.5 ms space, 32 bits (560 us mark, 560 / 1690 us space), stop mark.
export const NEC = { frequency: 38000, leadMark: 9000, leadSpace: 4500, mark: 560, zero: 560, one: 1690 } as const;

/**
 * NEC: address, ~address, command, ~command, each byte LSB first. An address above 0xFF is NEC
 * "extended": its low byte then high byte replace address/~address.
 */
export function encodeNec(address: number, command: number): IrFrame {
  checkRange('NEC address', address, 0xffff);
  checkRange('NEC command', command, 0xff);
  const addrBits = address > 0xff ? lsbFirst(address, 16) : [...lsbFirst(address, 8), ...lsbFirst(~address & 0xff, 8)];
  const bits = [...addrBits, ...lsbFirst(command, 8), ...lsbFirst(~command & 0xff, 8)];
  return {
    frequency: NEC.frequency,
    pattern: [NEC.leadMark, NEC.leadSpace, ...pulseDistance(bits, NEC.mark, NEC.zero, NEC.one), NEC.mark],
  };
}

// Samsung32: like NEC but a 4.5 ms lead mark and the address byte sent twice (not inverted).
export const SAMSUNG32 = { frequency: 38000, leadMark: 4500, leadSpace: 4500, mark: 560, zero: 560, one: 1690 } as const;

export function encodeSamsung32(address: number, command: number): IrFrame {
  checkRange('Samsung32 address', address, 0xff);
  checkRange('Samsung32 command', command, 0xff);
  const bits = [...lsbFirst(address, 8), ...lsbFirst(address, 8), ...lsbFirst(command, 8), ...lsbFirst(~command & 0xff, 8)];
  return {
    frequency: SAMSUNG32.frequency,
    pattern: [SAMSUNG32.leadMark, SAMSUNG32.leadSpace, ...pulseDistance(bits, SAMSUNG32.mark, SAMSUNG32.zero, SAMSUNG32.one), SAMSUNG32.mark],
  };
}

// Sony SIRC 12-bit: 40 kHz, 2.4 ms header, pulse-width bits (1200 us mark = 1, 600 us = 0), 600 us spaces.
export const SIRC = { frequency: 40000, header: 2400, space: 600, one: 1200, zero: 600, period: 45000, repeats: 3 } as const;

/**
 * Sony SIRC 12-bit: 7 command bits then 5 address bits, LSB first. Sony TVs expect the frame more
 * than once, so it is sent `repeats` times (default 3) with frames starting every 45 ms.
 */
export function encodeSirc12(address: number, command: number, repeats: number = SIRC.repeats): IrFrame {
  checkRange('SIRC address', address, 0x1f);
  checkRange('SIRC command', command, 0x7f);
  if (!Number.isInteger(repeats) || repeats < 1) throw new RangeError('repeats must be >= 1');
  const frame: number[] = [SIRC.header, SIRC.space];
  for (const b of [...lsbFirst(command, 7), ...lsbFirst(address, 5)]) frame.push(b ? SIRC.one : SIRC.zero, SIRC.space);
  frame.pop(); // no space after the last bit
  const length = frame.reduce((a, b) => a + b, 0);
  const pattern: number[] = [];
  for (let i = 0; i < repeats; i++) {
    if (i > 0) pattern.push(SIRC.period - length);
    pattern.push(...frame);
  }
  return { frequency: SIRC.frequency, pattern };
}

// Philips RC5: 36 kHz, Manchester, 889 us half-bits. A 1 is off-then-on, a 0 is on-then-off.
export const RC5 = { frequency: 36000, half: 889 } as const;

/**
 * RC5: start bit 1, field bit (1 for commands 0..63; 0 adds 64, "RC5X"), toggle, 5 address bits and
 * 6 command bits, MSB first. The leading half-bit of silence is dropped (a pattern starts "on").
 */
export function encodeRc5(address: number, command: number, opts: EncodeOptions = {}): IrFrame {
  checkRange('RC5 address', address, 0x1f);
  checkRange('RC5 command', command, 0x7f);
  const bits = [1, command < 64 ? 1 : 0, opts.toggle ?? 0, ...msbFirst(address, 5), ...msbFirst(command & 0x3f, 6)];
  const halves: boolean[] = [];
  for (const b of bits) halves.push(b === 0, b === 1);
  return { frequency: RC5.frequency, pattern: runs(halves, RC5.half) };
}

// Panasonic (Kaseikyo 48-bit): ~37 kHz, 432 us unit, 8T/4T header, 1T mark, 1T / 3T space.
export const KASEIKYO = { frequency: 37000, unit: 432, panasonicVendor: 0x2002 } as const;

/**
 * Panasonic's Kaseikyo frame: vendor 0x2002 (low byte first), then a byte with the vendor parity
 * nibble and the low address nibble, a byte with the rest of the address, the command, and an XOR
 * checksum of those three bytes. All bytes LSB first.
 */
export function encodeKaseikyo(address: number, command: number, vendor: number = KASEIKYO.panasonicVendor): IrFrame {
  checkRange('Kaseikyo address', address, 0xfff);
  checkRange('Kaseikyo command', command, 0xff);
  checkRange('Kaseikyo vendor', vendor, 0xffff);
  let parity = vendor ^ (vendor >> 8);
  parity = (parity ^ (parity >> 4)) & 0x0f;
  const b2 = parity | ((address & 0x0f) << 4);
  const b3 = (address >> 4) & 0xff;
  const bytes = [vendor & 0xff, vendor >> 8, b2, b3, command, b2 ^ b3 ^ command];
  const bits = bytes.flatMap((b) => lsbFirst(b, 8));
  const T = KASEIKYO.unit;
  return { frequency: KASEIKYO.frequency, pattern: [8 * T, 4 * T, ...pulseDistance(bits, T, T, 3 * T), T] };
}

/** Collapse on/off half-bits into durations; drops leading and trailing "off". */
function runs(levels: boolean[], unit: number): number[] {
  let i = 0;
  while (i < levels.length && !levels[i]) i++;
  let end = levels.length;
  while (end > i && !levels[end - 1]) end--;
  const out: number[] = [];
  let cur: boolean | null = null;
  for (let k = i; k < end; k++) {
    if (levels[k] === cur) out[out.length - 1] = (out[out.length - 1] ?? 0) + unit;
    else {
      out.push(unit);
      cur = levels[k] ?? false;
    }
  }
  return out;
}

export function encode(code: IrCode, opts: EncodeOptions = {}): IrFrame {
  switch (code.protocol) {
    case 'nec':
      return encodeNec(code.address, code.command);
    case 'samsung32':
      return encodeSamsung32(code.address, code.command);
    case 'sirc12':
      return encodeSirc12(code.address, code.command);
    case 'rc5':
      return encodeRc5(code.address, code.command, opts);
    case 'kaseikyo':
      return encodeKaseikyo(code.address, code.command);
  }
}

/** Total on+off time of a pattern in microseconds (ConsumerIrManager rejects patterns over 2 s). */
export function patternDuration(pattern: readonly number[]): number {
  return pattern.reduce((a, b) => a + b, 0);
}
