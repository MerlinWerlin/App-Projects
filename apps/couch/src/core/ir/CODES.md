# IR protocols and code sets — sources and licence note

**Everything here is UNVERIFIED on hardware.** No worker has an Android phone with an IR blaster or
the TVs in question. The setup flow (send Volume up, "did it work?") is the safety net.

## What was used

Only protocol facts that are widely published in many independent places (protocol write-ups,
application notes, hobbyist tutorials, Arduino IR library documentation and the many forum posts
listing the same 32-bit hex codes). Values were written out by hand in `codes.ts` and cross-checked
by reversing the familiar hex codes into address/command bytes (e.g. Samsung `E0E040BF` =
address 0x07, command 0x02; LG `20DF10EF` = address 0x04, command 0x08). Facts such as "command 18
is volume up" are not copyrightable; no file, table layout or text from any code database was
copied.

**Not used / not to be copied:** LIRC remote config files, IRDB / irdb.tk CSVs, Flipper IR files,
Global Caché / remote-central databases, or any other code database. If a larger code library is
wanted later, pick one with an explicit permissive licence and record it here first.

## Protocol timings (src/core/ir/protocols.ts)

| Protocol | Carrier | Frame |
|---|---|---|
| NEC | 38 kHz | 9000 on, 4500 off; 32 bits LSB first (addr, ~addr or addr high byte, cmd, ~cmd); bit = 560 on + 560 off (0) / 1690 off (1); stop 560 on |
| Samsung32 | 38 kHz | 4500 on, 4500 off; addr, addr, cmd, ~cmd; bits as NEC |
| Sony SIRC 12-bit | 40 kHz | 2400 on, 600 off; 7 command + 5 address bits LSB first; 1 = 1200 on, 0 = 600 on, 600 off between; sent 3x on a 45 ms period |
| Philips RC5 | 36 kHz | Manchester, 889 us half-bits; start 1, field (1 for cmd < 64), toggle, 5 address + 6 command bits MSB first; 1 = off/on, 0 = on/off |
| Panasonic (Kaseikyo 48) | 37 kHz | 3456 on, 1728 off; bytes 0x02 0x20 (vendor 0x2002), parity/address, address, command, XOR checksum, LSB first; bit = 432 on + 432 / 1296 off |

Only a single frame is sent per press (Sony: three). NEC "repeat" frames for held buttons are not
implemented.

## Code sets (src/core/ir/codes.ts)

| Brand | Set | Protocol / address | Confidence |
|---|---|---|---|
| Samsung | 1 | Samsung32 0x07 | High for power/volume/channel/mute/digits; navigation and Smart Hub medium |
| LG | 1 | NEC 0x04 | High for power/volume/channel/mute/digits; navigation/home/settings medium |
| Sony | 1 | SIRC-12 address 1 | High for power/volume/channel/mute/digits; navigation/home/input medium |
| Panasonic | 1 | Kaseikyo vendor 0x2002, address 0x008 | Medium (power, volume, mute, channel only) |
| Philips | 1 | RC5 system 0 | High for older (RC5) Philips; newer Philips use RC6, not implemented |
| Hisense, TCL | 1 | NEC extended 0xC7EA (Roku TV models) | Low-medium; only Roku TV models, the brands' own remotes are not covered |

Most brands have one candidate set, not the 4–7 the prototype mock-up shows; "Not sure" tries
every set once in the brand order above. Adding sets later: append to a brand's list (never
reorder, because saved TVs store `(irBrand, irSet)`).
