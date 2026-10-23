import { candidatesFor } from './codes';
import { encode } from './protocols';
import { IrSetup, defaultTvName } from './setup';
import type { IrTransmitter } from './transmitter';

function fakeTx(fail = false): IrTransmitter & { sent: { frequency: number; pattern: number[] }[] } {
  const sent: { frequency: number; pattern: number[] }[] = [];
  return {
    sent,
    async transmit(frequency, pattern) {
      if (fail) throw new Error('IR emitter busy');
      sent.push({ frequency, pattern });
    },
  };
}

describe('defaultTvName', () => {
  it('picks the next unused TV number', () => {
    expect(defaultTvName([])).toBe('TV 1');
    expect(defaultTvName(['Lounge', 'TV 1'])).toBe('TV 2');
    expect(defaultTvName(['TV 1', 'TV 3'])).toBe('TV 2');
    expect(defaultTvName(['tv 1', 'TV 2 ', 'Bedroom'])).toBe('TV 3');
  });
});

describe('IrSetup', () => {
  it('brand -> testing -> send VOL_UP -> yes -> naming -> done', async () => {
    const tx = fakeTx();
    const setup = new IrSetup(tx, () => ['Lounge', 'TV 1']);
    expect(setup.state.step).toBe('brand');

    const s1 = setup.pickBrand('Sony');
    expect(s1).toMatchObject({ step: 'testing', n: 1, total: candidatesFor('Sony').length, sent: false });

    expect(await setup.sendTest()).toBe(true);
    const sony = candidatesFor('Sony')[0]!.codeSet;
    const want = encode({ protocol: sony.protocol, address: sony.address, command: sony.keys.VOL_UP! });
    expect(tx.sent).toEqual([want]);
    expect(setup.state).toMatchObject({ step: 'testing', sent: true, sending: false, error: null });

    expect(setup.yes()).toMatchObject({ step: 'naming', name: 'TV 2', n: 1 });
    setup.setName('  Bedroom  ');
    const tv = setup.save();
    expect(tv).toEqual({ platform: 'ir', name: 'Bedroom', model: 'Sony · infrared code 1', irBrand: 'Sony', irSet: 1 });
    expect(setup.state).toEqual({ step: 'done', tv });
  });

  it('blank name falls back to the default', () => {
    const setup = new IrSetup(fakeTx());
    setup.pickBrand('LG');
    setup.yes();
    setup.setName('   ');
    expect(setup.save()?.name).toBe('TV 1');
  });

  it('"No" steps to the next set, then exhausts with the prototype message', () => {
    const setup = new IrSetup(fakeTx());
    setup.pickBrand('Not sure');
    const total = candidatesFor('Not sure').length;
    expect(total).toBeGreaterThan(1);
    for (let n = 2; n <= total; n++) expect(setup.no()).toMatchObject({ step: 'testing', n, sent: false });
    expect(setup.no()).toEqual({
      step: 'exhausted',
      choice: 'Not sure',
      message: 'Tried every Not sure code. Try "Not sure" to test them all.',
    });
  });

  it('exhausting one brand names it', () => {
    const setup = new IrSetup(fakeTx());
    setup.pickBrand('Samsung');
    let s = setup.state;
    while (s.step === 'testing') s = setup.no();
    expect(s).toMatchObject({ step: 'exhausted', message: 'Tried every Samsung code. Try "Not sure" to test them all.' });
    expect(setup.restart()).toEqual({ step: 'brand' });
  });

  it('"Not sure" saves the owning brand and its set number', async () => {
    const tx = fakeTx();
    const setup = new IrSetup(tx);
    setup.pickBrand('Not sure');
    setup.no(); // second candidate
    await setup.sendTest();
    const c = candidatesFor('Not sure')[1]!;
    expect(tx.sent[0]).toEqual(encode({ protocol: c.codeSet.protocol, address: c.codeSet.address, command: c.codeSet.keys.VOL_UP! }));
    setup.yes();
    expect(setup.save()).toMatchObject({ irBrand: c.brand, irSet: c.set, model: `${c.brand} · infrared code ${c.set}` });
  });

  it('a transmit failure is reported in state, not thrown', async () => {
    const setup = new IrSetup(fakeTx(true));
    setup.pickBrand('LG');
    expect(await setup.sendTest()).toBe(false);
    expect(setup.state).toMatchObject({ step: 'testing', sent: false, sending: false, error: 'IR emitter busy' });
    setup.no();
  });

  it('ignores actions that do not fit the current step', async () => {
    const setup = new IrSetup(fakeTx());
    expect(await setup.sendTest()).toBe(false);
    expect(setup.yes()).toEqual({ step: 'brand' });
    expect(setup.no()).toEqual({ step: 'brand' });
    expect(setup.save()).toBeNull();
  });

  it('notifies subscribers', () => {
    const setup = new IrSetup(fakeTx());
    const cb = jest.fn();
    const off = setup.subscribe(cb);
    setup.pickBrand('LG');
    off();
    setup.no();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
