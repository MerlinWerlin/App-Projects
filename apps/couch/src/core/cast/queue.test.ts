import { FakeTimer, flush } from './__tests__/fakes';
import { CastQueue, snapInterval } from './queue';
import type { QueueItem } from './queueTypes';

const photo = (id: string): QueueItem => ({ id, uri: `file:///${id}.jpg`, mime: 'image/jpeg', kind: 'photo', title: id });
const video = (id: string): QueueItem => ({ id, uri: `file:///${id}.mp4`, mime: 'video/mp4', kind: 'video', title: id, durationSec: 10 });

function setup(items: QueueItem[] = [photo('a'), photo('b'), photo('c')]) {
  const timer = new FakeTimer();
  const played: string[] = [];
  const fail = new Set<string>();
  const gates = new Map<string, Promise<void>>();
  const q = new CastQueue({
    timer,
    play: async (item, index) => {
      played.push(`${item.id}@${index}`);
      const g = gates.get(item.id);
      if (g) await g;
      if (fail.has(item.id)) throw new Error(`cannot play ${item.id}`);
    },
  });
  q.setItems(items);
  return { q, timer, played, fail, gates };
}

describe('CastQueue', () => {
  it('starts empty with defaults', () => {
    const q = new CastQueue({ play: async () => undefined, timer: new FakeTimer() });
    expect(q.snapshot()).toEqual({ items: [], index: -1, slideshow: false, intervalSec: 5, loop: false });
  });

  it('setItems casts nothing; start uses startIndex; next / prev move and stop at the ends', async () => {
    const { q, played } = setup();
    q.setItems([photo('a'), photo('b'), photo('c')], 1);
    expect(q.snapshot().index).toBe(-1);
    expect(played).toEqual([]);
    await q.start();
    expect(q.snapshot().index).toBe(1);
    await q.next();
    await q.next(); // at the end, no loop: stays
    expect(q.snapshot().index).toBe(2);
    await q.prev();
    await q.prev();
    await q.prev(); // at 0, no loop: stays
    expect(q.snapshot().index).toBe(0);
    expect(played).toEqual(['b@1', 'c@2', 'b@1', 'a@0']);
  });

  it('wraps both ways when loop is on', async () => {
    const { q, played } = setup();
    q.setLoop(true);
    await q.start(2);
    await q.next();
    expect(q.snapshot().index).toBe(0);
    await q.prev();
    expect(q.snapshot().index).toBe(2);
    expect(played).toEqual(['c@2', 'a@0', 'c@2']);
  });

  it('slideshow advances photos on the interval and stops at the end without loop', async () => {
    const { q, timer, played } = setup();
    q.setSlideshow(true);
    await q.start(0);
    await timer.advance(4999);
    expect(q.snapshot().index).toBe(0);
    await timer.advance(1);
    expect(q.snapshot().index).toBe(1);
    await timer.advance(5000);
    expect(q.snapshot().index).toBe(2);
    await timer.advance(5000);
    expect(q.snapshot()).toMatchObject({ index: 2, slideshow: false });
    expect(timer.active).toBe(0);
    expect(played).toEqual(['a@0', 'b@1', 'c@2']);
  });

  it('slideshow with loop keeps going round', async () => {
    const { q, timer, played } = setup([photo('a'), photo('b')]);
    q.setLoop(true);
    q.setSlideshow(true);
    await q.start();
    await timer.advance(15_000);
    expect(played).toEqual(['a@0', 'b@1', 'a@0', 'b@1']);
    expect(q.snapshot().slideshow).toBe(true);
  });

  it('interval snaps to the allowed values and re-arms the timer', async () => {
    expect(snapInterval(4)).toBe(3);
    expect(snapInterval(7)).toBe(5);
    expect(snapInterval(8)).toBe(10);
    expect(snapInterval(100)).toBe(30);
    expect(snapInterval(Number.NaN)).toBe(5);
    const { q, timer } = setup();
    q.setSlideshow(true);
    await q.start();
    q.setIntervalSec(12);
    expect(q.snapshot().intervalSec).toBe(10);
    await timer.advance(9999);
    expect(q.snapshot().index).toBe(0);
    await timer.advance(1);
    expect(q.snapshot().index).toBe(1);
  });

  it('a video is not timed: it plays to the end, then onMediaEnded advances in a slideshow', async () => {
    const { q, timer, played } = setup([photo('a'), video('v'), photo('c')]);
    q.setSlideshow(true);
    await q.start();
    await timer.advance(5000);
    expect(q.snapshot().index).toBe(1);
    expect(timer.active).toBe(0);
    await timer.advance(60_000);
    expect(q.snapshot().index).toBe(1);
    await q.onMediaEnded();
    expect(q.snapshot().index).toBe(2);
    expect(played).toEqual(['a@0', 'v@1', 'c@2']);
    expect(timer.active).toBe(1);
  });

  it('onMediaEnded stays put without slideshow or loop, and advances with loop', async () => {
    const { q } = setup([video('v1'), video('v2')]);
    await q.start();
    await q.onMediaEnded();
    expect(q.snapshot().index).toBe(0);
    q.setLoop(true);
    await q.onMediaEnded();
    expect(q.snapshot().index).toBe(1);
    await q.onMediaEnded();
    expect(q.snapshot().index).toBe(0);
  });

  it('a failing play leaves the index on the item, turns the slideshow off and rethrows', async () => {
    const { q, timer, fail } = setup();
    q.setSlideshow(true);
    await q.start();
    fail.add('b');
    await q.next().then(
      () => {
        throw new Error('should fail');
      },
      (e: Error) => expect(e.message).toBe('cannot play b'),
    );
    expect(q.snapshot()).toMatchObject({ index: 1, slideshow: false });
    expect(timer.active).toBe(0);
  });

  it('a slideshow tick whose play fails does not throw out of the timer', async () => {
    const { q, timer, fail } = setup();
    q.setSlideshow(true);
    await q.start();
    fail.add('b');
    await timer.advance(5000);
    expect(q.snapshot()).toMatchObject({ index: 1, slideshow: false });
  });

  it('ignores a stale play when next is pressed quickly', async () => {
    const { q, timer, gates, fail } = setup();
    q.setSlideshow(true);
    await q.start();
    let release!: () => void;
    gates.set('b', new Promise<void>((r) => (release = r)));
    fail.add('b');
    const slow = q.next(); // b hangs, then fails
    await flush();
    expect(q.snapshot().index).toBe(1);
    await q.next(); // c wins
    expect(q.snapshot().index).toBe(2);
    release();
    await slow; // stale failure is swallowed
    expect(q.snapshot()).toMatchObject({ index: 2, slideshow: true });
    expect(timer.active).toBe(1);
  });

  it('the slideshow timer waits for a pending play', async () => {
    const { q, timer, gates } = setup();
    let release!: () => void;
    gates.set('a', new Promise<void>((r) => (release = r)));
    q.setSlideshow(true);
    const p = q.start();
    await timer.advance(20_000);
    expect(q.snapshot().index).toBe(0);
    release();
    await p;
    expect(timer.active).toBe(1);
  });

  it('add, move and remove keep the index on the item on the TV', async () => {
    const { q, played } = setup();
    await q.start(1); // b
    q.add([photo('d')]);
    expect(q.snapshot().items.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
    q.move(1, 3); // b to the end
    expect(q.snapshot().items.map((i) => i.id)).toEqual(['a', 'c', 'd', 'b']);
    expect(q.snapshot().index).toBe(3);
    q.move(0, 3); // a past b
    expect(q.snapshot().items.map((i) => i.id)).toEqual(['c', 'd', 'b', 'a']);
    expect(q.snapshot().index).toBe(2);
    q.remove('c');
    expect(q.snapshot().index).toBe(1);
    q.remove('a');
    expect(q.snapshot().index).toBe(1);
    q.remove('nope');
    q.move(0, 9);
    expect(q.snapshot().items.map((i) => i.id)).toEqual(['d', 'b']);
    expect(played).toEqual(['b@1']);
  });

  it('removing the item on the TV casts the one taking its place; emptying goes to -1', async () => {
    const { q, played } = setup([photo('a'), photo('b')]);
    await q.start(1);
    q.remove('b');
    await flush();
    expect(q.snapshot().index).toBe(0);
    expect(played).toEqual(['b@1', 'a@0']);
    q.remove('a');
    expect(q.snapshot()).toMatchObject({ items: [], index: -1 });
  });

  it('notifies subscribers; clear and dispose stop timers', async () => {
    const { q, timer } = setup();
    const seen: number[] = [];
    const off = q.subscribe((s) => seen.push(s.index));
    q.setSlideshow(true);
    await q.start();
    expect(seen).toContain(0);
    off();
    q.clear();
    expect(q.snapshot()).toMatchObject({ items: [], index: -1, slideshow: false });
    expect(timer.active).toBe(0);
    q.setItems([photo('x')]);
    q.setSlideshow(true);
    await q.start();
    q.dispose();
    expect(timer.active).toBe(0);
    await q.next();
    expect(q.snapshot().index).toBe(0);
  });
});
