import { findHardcodedStrings, findPhysicalDirections, stripCode, usesNeverMirror } from './scan';

const texts = (src: string) => findHardcodedStrings(src).map((h) => h.text);

describe('findHardcodedStrings: JSX text', () => {
  it('reports JSX text with letters, with line numbers', () => {
    const src = ['export function A() {', '  return (', '    <View>', '      <Text style={s.h}>Settings</Text>', '    </View>', '  );', '}'].join('\n');
    expect(findHardcodedStrings(src)).toEqual([{ line: 4, text: 'Settings' }]);
  });

  it('reports multi-line text on the line where it starts', () => {
    const src = '<Text>\n  Connect your\n  TV first\n</Text>';
    expect(findHardcodedStrings(src)).toEqual([{ line: 2, text: 'Connect your TV first' }]);
  });

  it('reports literal words mixed with expressions', () => {
    expect(texts('<Text>{count} TVs found</Text>')).toEqual(['{count} TVs found']);
    expect(texts("<Text>Don't worry</Text>")).toEqual(["Don't worry"]);
  });

  it('accepts expressions only', () => {
    expect(texts("<Text>{t('app.settings.title')}</Text>")).toEqual([]);
    expect(texts("<Text>{t('a', { n: 2 })}</Text>")).toEqual([]);
    expect(texts('<Text>\n  {label}\n</Text>')).toEqual([]);
  });

  it('ignores glyphs, symbols and numbers', () => {
    for (const g of ['›', '+', '−', '•', '42', '✕', '…', '·', '&nbsp;', '‹ ›', '1/3']) {
      expect({ g, hits: texts(`<Text>${g}</Text>`) }).toEqual({ g, hits: [] });
    }
  });

  it('reports non-Latin text too', () => {
    expect(texts('<Text>設定</Text>')).toEqual(['設定']);
    expect(texts('<Text>الإعدادات</Text>')).toEqual(['الإعدادات']);
  });

  it('does not mistake TypeScript for JSX text', () => {
    const src = [
      'const [x, setX] = useState<string | null>(null);',
      'const f = (a: number) => a > max ? <A /> : <B />;',
      'const g = (a: number) => (a > b.max ? <A /> : null);',
      'const items = list.map((i) => <Row key={i} />);',
      'function h<T>(v: T): Array<T> { return [v]; }',
      'if (a > 0 && b < 2) { go(); }',
      'const el = cond ? <A>{x}</A> : null;',
      '<View>',
      '  {active ? (',
      '    <A />',
      '  ) : null} {more ? (',
      '    <B />',
      '  )}',
      '</View>',
    ].join('\n');
    expect(findHardcodedStrings(src)).toEqual([]);
  });

  it('does not read TypeScript generic signatures as JSX text (T78)', () => {
    const cases = [
      "function f<V>(a: X<V>) { return <Text>{t('a')}</Text>; }",
      'function g<T>(x: Wrapper<T>) {}\nfunction h<U>(y: Other<U>) {}',
      'function picker<V extends string>(\n  which: Picker,\n  options: Choice<V>[],\n): ReactElement[] {\n  const rows: ReactElement[] = [<Row key={which} />];\n}',
      'function p<V extends string>(a: V, options: readonly Choice<V>[]): ReactElement[] {\n  return [<Row key="a" />];\n}',
      'interface Choice<V extends string> { value: V }\ninterface Other<W> { a: W }',
      'const [open, setOpen] = useState<Foo | null>(null);\nconst x: Array<string> = [];\nreturn <View />;',
      'const id = <T,>(x: T) => x;\nconst ok = <T extends object>(x: T): Box<T> => box(x);\nreturn <View />;',
      'type M = Map<string, Array<Set<Foo>>>;\nfunction n<K, V>(m: Map<K, Array<V>>): Set<K> { return new Set<K>(); }\n<View />',
      "type Pick2<T> = Record<'a' | 'b', T>;\nfunction q<T>(cb: (v: T) => void): Promise<T> {}\n<View />",
    ];
    for (const src of cases) expect({ src, hits: texts(src) }).toEqual({ src, hits: [] });
  });

  it('still reports real JSX text next to generics (T78)', () => {
    expect(texts('function f<V>(a: X<V>) {\n  return <Text>Hello</Text>;\n}')).toEqual(['Hello']);
    expect(texts('const [a, b] = useState<Foo | null>(null);\nreturn <Text>Pick a TV</Text>;')).toEqual(['Pick a TV']);
    expect(texts('const id = <T,>(x: T) => x;\n<Text>Couch</Text>')).toEqual(['Couch']);
    expect(texts('for (let i=0;i<n;i++) { out.push(<Text>Row</Text>); }')).toEqual(['Row']);
    // a tag glued to text may be blanked like a generic, but the text is still reported
    expect(texts('<Text>Press<B>{x}</B></Text>').join(' ')).toContain('Press');
  });

  it('fragments and self-closing siblings', () => {
    expect(texts('<>\n  <Icon />Hello<Icon />\n</>')).toEqual(['Hello']);
  });
});

describe('findHardcodedStrings: props, options and alerts', () => {
  it('flags literal accessibility, placeholder and title props', () => {
    const src = [
      '<Pressable accessibilityLabel="Power" accessibilityHint=\'Turns the TV off\'>',
      '<TextInput placeholder={"Search apps"} />',
      '<Sheet title={`Pick a TV`} />',
      '<Button title="OK" />',
    ].join('\n');
    expect(findHardcodedStrings(src)).toEqual([
      { line: 1, text: 'Power' },
      { line: 1, text: 'Turns the TV off' },
      { line: 2, text: 'Search apps' },
      { line: 3, text: 'Pick a TV' },
      { line: 4, text: 'OK' },
    ]);
  });

  it('accepts t() and expressions in props', () => {
    expect(texts("<Pressable accessibilityLabel={t('ui.remote.power')} title={name} placeholder={`${n}`} />")).toEqual([]);
    expect(texts('<Pressable accessibilityLabel="›" />')).toEqual([]);
  });

  it('flags navigation options', () => {
    const src = "<Tabs.Screen options={{ title: 'Remote', tabBarLabel: 'Apps', headerTitle: \"TVs\" }} />";
    expect(texts(src)).toEqual(['Remote', 'Apps', 'TVs']);
    expect(texts("options={{ title: t('app.tabs.remote') }}")).toEqual([]);
  });

  it('flags Alert.alert literals but not button styles', () => {
    const src = [
      "Alert.alert('Forget this TV?', 'You can add it again later.', [",
      "  { text: 'Cancel', style: 'cancel' },",
      "  { text: 'Forget', style: 'destructive', onPress: forget },",
      ']);',
    ].join('\n');
    expect(findHardcodedStrings(src)).toEqual([
      { line: 1, text: 'Forget this TV?' },
      { line: 1, text: 'You can add it again later.' },
      { line: 2, text: 'Cancel' },
      { line: 3, text: 'Forget' },
    ]);
    expect(texts("Alert.alert(t('a.title'), t('a.body'), [{ text: t('a.ok') }]);")).toEqual([]);
  });
});

describe('findHardcodedStrings: ignores', () => {
  it('ignores comments of every kind', () => {
    const src = [
      '// <Text>Old copy</Text>',
      '/* <Text>Block</Text> */',
      '{/* <Text>JSX comment</Text> */}',
      '/**',
      ' * title: "Doc comment"',
      ' */',
      "const url = 'http://example.local'; // title: 'trailing'",
    ].join('\n');
    expect(findHardcodedStrings(src)).toEqual([]);
  });

  it('ignores import lines, single and multi-line', () => {
    const src = "import { title } from './x';\nimport {\n  Text,\n  View,\n} from 'react-native';\nexport { a } from './title';";
    expect(findHardcodedStrings(src)).toEqual([]);
  });

  it('honours i18n-ignore on that line only', () => {
    const src = [
      '<Text>Couch</Text> {/* i18n-ignore */}',
      '<Pressable accessibilityLabel="Couch Plus" /> // i18n-ignore brand',
      '<Text>Settings</Text>',
    ].join('\n');
    expect(findHardcodedStrings(src)).toEqual([{ line: 3, text: 'Settings' }]);
  });

  it('stripCode keeps line numbers', () => {
    const src = "a\n/* x\ny */\nb // c\nimport x from 'y';";
    const out = stripCode(src);
    expect(out.split('\n')).toHaveLength(5);
    expect(out.split('\n')[3]!.trimEnd()).toBe('b');
  });
});

describe('findPhysicalDirections', () => {
  it('finds physical left/right styles', () => {
    const src = [
      'const s = StyleSheet.create({',
      '  a: { marginLeft: 4, paddingRight: 2 },',
      '  b: { position: "absolute", left: 0, right : 8 },',
      "  c: { textAlign: 'left', borderLeftWidth: 1, borderRightWidth: 1 },",
      "  d: { marginStart: 4, paddingEnd: 2, start: 0, textAlign: 'center' },",
      "  e: { textAlign: \"right\" },",
      '});',
    ].join('\n');
    expect(findPhysicalDirections(src)).toEqual([
      { line: 2, text: 'marginLeft' },
      { line: 2, text: 'paddingRight' },
      { line: 3, text: 'left:' },
      { line: 3, text: 'right :' },
      { line: 4, text: "textAlign: 'left'" },
      { line: 4, text: 'borderLeftWidth' },
      { line: 4, text: 'borderRightWidth' },
      { line: 6, text: 'textAlign: "right"' },
    ]);
  });

  it('ignores comments, start/end, words containing left/right and i18n-ignore', () => {
    const src = [
      '// marginLeft: 4',
      'const leftover = 1; const copyright = 2; const dir = isLeft ? 1 : 0;',
      "const k = { key: 'LEFT', label: 'right' };",
      'const s = { left: 0 }; // i18n-ignore d-pad hit area',
      '{ borderTopLeftRadius: 4, marginHorizontal: 2 }',
    ].join('\n');
    expect(findPhysicalDirections(src)).toEqual([]);
  });
});

describe('usesNeverMirror', () => {
  it('detects the wrapper, the style and a literal ltr direction', () => {
    expect(usesNeverMirror('<NeverMirror style={s.pad}>{dpad}</NeverMirror>')).toBe(true);
    expect(usesNeverMirror('<View style={[s.row, NEVER_MIRROR_STYLE]} />')).toBe(true);
    expect(usesNeverMirror("<View style={{ direction: 'ltr' }} />")).toBe(true);
  });

  it('ignores imports and comments alone', () => {
    expect(usesNeverMirror("import { NeverMirror } from '../NeverMirror';\n<View />")).toBe(false);
    expect(usesNeverMirror('// TODO wrap in <NeverMirror>\n<View />')).toBe(false);
    expect(usesNeverMirror("<View style={{ direction: 'rtl' }} />")).toBe(false);
  });
});
