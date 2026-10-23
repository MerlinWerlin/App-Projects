import type { DriverEvent } from '../driver';
import { IR_CODE_SETS } from '../ir/codes';
import { encodeNec, encodeRc5 } from '../ir/protocols';
import type { IrTransmitter } from '../ir/transmitter';
import { DriverError } from '../types';
import { IrDriver } from './ir';

function fakeTx(): IrTransmitter & { sent: { frequency: number; pattern: number[] }[] } {
  const sent: { frequency: number; pattern: number[] }[] = [];
  return {
    sent,
    async transmit(frequency, pattern) {
      sent.push({ frequency, pattern });
    },
  };
}

describe('IrDriver', () => {
  const lg = IR_CODE_SETS.LG[0]!;

  it('sendKey transmits the encoded code and reports it', async () => {
    const tx = fakeTx();
    let t = 1000;
    const d = new IrDriver(lg, tx, { now: () => (t += 4) });
    const events: DriverEvent[] = [];
    d.on((e) => events.push(e));
    await d.connect();
    await d.sendKey('VOL_UP');
    expect(tx.sent).toEqual([encodeNec(0x04, 0x02)]);
    expect(events).toEqual([
      { type: 'state', state: 'connected' },
      { type: 'sent', what: 'VOL_UP', ms: 4 },
    ]);
    expect(d.platform).toBe('ir');
  });

  it('unsupported keys throw DriverError("unsupported") and send nothing', async () => {
    const tx = fakeTx();
    const d = new IrDriver(IR_CODE_SETS.Panasonic[0]!, tx);
    await expect(d.sendKey('NUM_5')).rejects.toMatchObject({ code: 'unsupported' });
    await expect(d.sendKey('RED')).rejects.toBeInstanceOf(DriverError);
    expect(tx.sent).toEqual([]);
  });

  it('INPUT falls back to SOURCE', async () => {
    const tx = fakeTx();
    const d = new IrDriver(lg, tx);
    await d.sendKey('INPUT');
    expect(tx.sent).toEqual([encodeNec(0x04, lg.keys.SOURCE!)]);
  });

  it('capabilities: keys, plus numbers only when the set has all digits', () => {
    expect([...new IrDriver(lg, fakeTx()).capabilities].sort()).toEqual(['keys', 'numbers']);
    expect([...new IrDriver(IR_CODE_SETS.Panasonic[0]!, fakeTx()).capabilities]).toEqual(['keys']);
  });

  it('typing and apps are unsupported with a friendly message', async () => {
    const d = new IrDriver(lg, fakeTx());
    await expect(d.sendText('news')).rejects.toMatchObject({ code: 'unsupported', message: expect.stringMatching(/Wi-Fi/) });
    await expect(d.launchApp('netflix')).rejects.toMatchObject({ code: 'unsupported', message: expect.stringMatching(/Wi-Fi/) });
  });

  it('flips the RC5 toggle bit on each press', async () => {
    const tx = fakeTx();
    const d = new IrDriver(IR_CODE_SETS.Philips[0]!, tx);
    await d.sendKey('VOL_UP');
    await d.sendKey('VOL_UP');
    expect(tx.sent).toEqual([encodeRc5(0, 16, { toggle: 0 }), encodeRc5(0, 16, { toggle: 1 })]);
  });

  it('a transmitter failure propagates (the session turns it into lastError)', async () => {
    const d = new IrDriver(lg, {
      transmit: async () => {
        throw new Error('no emitter');
      },
    });
    await expect(d.sendKey('POWER')).rejects.toThrow('no emitter');
  });
});
