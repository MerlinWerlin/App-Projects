// Offline stub of @types/react ~19.1 (only the public surface the app uses).
// Shapes follow DefinitelyTyped's react/index.d.ts for React 19; see ../README.md.

export = React;
export as namespace React;

declare namespace React {
  // ---- elements & nodes ----
  type Key = string | number | bigint;
  type JSXElementConstructor<P> =
    | ((props: P) => ReactNode | Promise<ReactNode>)
    | (new (props: P) => Component<any, any>);

  interface ReactElement<P = unknown, T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>> {
    type: T;
    props: P;
    key: string | null;
  }
  interface ReactPortal extends ReactElement {
    children: ReactNode;
  }
  type AwaitedReactNode = ReactElement | string | number | bigint | Iterable<ReactNode> | ReactPortal | boolean | null | undefined;
  type ReactNode =
    | ReactElement
    | string
    | number
    | bigint
    | Iterable<ReactNode>
    | ReactPortal
    | boolean
    | null
    | undefined
    | Promise<AwaitedReactNode>;

  // ---- refs ----
  interface RefObject<T> {
    current: T;
  }
  type RefCallback<T> = { bivarianceHack(instance: T | null): void | (() => void) }['bivarianceHack'];
  type Ref<T> = RefCallback<T> | RefObject<T | null> | null;
  type LegacyRef<T> = Ref<T>;
  type ForwardedRef<T> = ((instance: T | null) => void) | RefObject<T | null> | null;

  interface Attributes {
    key?: Key | null | undefined;
  }
  interface RefAttributes<T> extends Attributes {
    ref?: Ref<T> | undefined;
  }
  interface ClassAttributes<T> extends RefAttributes<T> {}

  // ---- components ----
  type PropsWithChildren<P = unknown> = P & { children?: ReactNode | undefined };
  type PropsWithoutRef<P> = P extends any ? ('ref' extends keyof P ? Omit<P, 'ref'> : P) : P;
  type PropsWithRef<P> = P;

  interface FunctionComponent<P = {}> {
    (props: P): ReactNode | Promise<ReactNode>;
    displayName?: string | undefined;
  }
  type FC<P = {}> = FunctionComponent<P>;

  interface ComponentClass<P = {}, S = any> {
    new (props: P): Component<P, S>;
    displayName?: string | undefined;
    defaultProps?: Partial<P> | undefined;
    getDerivedStateFromError?: (error: any) => Partial<S> | null;
    getDerivedStateFromProps?: (props: Readonly<P>, state: S) => Partial<S> | null;
  }
  type ComponentType<P = {}> = ComponentClass<P> | FunctionComponent<P>;
  type ElementType<P = any> =
    | { [K in keyof JSX.IntrinsicElements]: P extends JSX.IntrinsicElements[K] ? K : never }[keyof JSX.IntrinsicElements]
    | ComponentType<P>;

  interface ErrorInfo {
    componentStack?: string | null;
    digest?: string | null;
  }

  class Component<P = {}, S = {}> {
    constructor(props: P);
    readonly props: Readonly<P>;
    state: Readonly<S>;
    context: unknown;
    setState<K extends keyof S>(
      state: ((prevState: Readonly<S>, props: Readonly<P>) => Pick<S, K> | S | null) | (Pick<S, K> | S | null),
      callback?: () => void,
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): ReactNode;
    componentDidMount?(): void;
    shouldComponentUpdate?(nextProps: Readonly<P>, nextState: Readonly<S>): boolean;
    componentWillUnmount?(): void;
    componentDidCatch?(error: Error, errorInfo: ErrorInfo): void;
    componentDidUpdate?(prevProps: Readonly<P>, prevState: Readonly<S>): void;
  }
  class PureComponent<P = {}, S = {}> extends Component<P, S> {}

  interface ExoticComponent<P = {}> {
    (props: P): ReactNode;
    readonly $$typeof: symbol;
  }
  interface NamedExoticComponent<P = {}> extends ExoticComponent<P> {
    displayName?: string | undefined;
  }
  interface ForwardRefExoticComponent<P> extends NamedExoticComponent<P> {}
  type MemoExoticComponent<T extends ComponentType<any>> = NamedExoticComponent<ComponentPropsWithRef<T>> & {
    readonly type: T;
  };

  type ComponentProps<T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any>> =
    T extends JSXElementConstructor<infer Props> ? Props : T extends keyof JSX.IntrinsicElements ? JSX.IntrinsicElements[T] : {};
  type ComponentPropsWithRef<T extends ElementType> = T extends new (props: infer P) => Component<any, any>
    ? PropsWithoutRef<P> & RefAttributes<InstanceType<T>>
    : ComponentProps<T>;
  type ComponentPropsWithoutRef<T extends ElementType> = PropsWithoutRef<ComponentProps<T>>;
  type ComponentRef<T extends ElementType> = T extends new (...args: any) => infer I
    ? I
    : ComponentPropsWithRef<T> extends RefAttributes<infer R>
      ? R
      : never;
  type ElementRef<T extends ElementType> = ComponentRef<T>;

  function forwardRef<T, P = {}>(
    render: (props: P, ref: ForwardedRef<T>) => ReactNode,
  ): ForwardRefExoticComponent<PropsWithoutRef<P> & RefAttributes<T>>;
  function memo<P extends object>(
    Component: FunctionComponent<P>,
    propsAreEqual?: (prevProps: Readonly<P>, nextProps: Readonly<P>) => boolean,
  ): NamedExoticComponent<P>;
  function memo<T extends ComponentType<any>>(
    Component: T,
    propsAreEqual?: (prevProps: Readonly<ComponentProps<T>>, nextProps: Readonly<ComponentProps<T>>) => boolean,
  ): MemoExoticComponent<T>;
  function lazy<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>): ExoticComponent<ComponentProps<T>>;

  function createElement<P extends {}>(type: string | JSXElementConstructor<P>, props?: (Attributes & P) | null, ...children: ReactNode[]): ReactElement<P>;
  function cloneElement<P>(element: ReactElement<P>, props?: Partial<P> & Attributes, ...children: ReactNode[]): ReactElement<P>;
  function isValidElement<P>(object: {} | null | undefined): object is ReactElement<P>;

  const Fragment: ExoticComponent<{ children?: ReactNode | undefined }>;
  const StrictMode: ExoticComponent<{ children?: ReactNode | undefined }>;
  const Suspense: ExoticComponent<{ children?: ReactNode | undefined; fallback?: ReactNode }>;

  interface ReactChildren {
    map<T, C>(children: C | ReadonlyArray<C>, fn: (child: C, index: number) => T): C extends null | undefined ? C : Array<Exclude<T, boolean | null | undefined>>;
    forEach<C>(children: C | ReadonlyArray<C>, fn: (child: C, index: number) => void): void;
    count(children: any): number;
    only<C>(children: C): C extends any[] ? never : C;
    toArray(children: ReactNode | ReactNode[]): Array<Exclude<ReactNode, boolean | null | undefined>>;
  }
  const Children: ReactChildren;

  // ---- context ----
  interface Provider<T> {
    (props: { value: T; children?: ReactNode | undefined }): ReactNode;
  }
  interface Consumer<T> {
    (props: { children: (value: T) => ReactNode }): ReactNode;
  }
  interface Context<T> extends Provider<T> {
    Provider: Provider<T>;
    Consumer: Consumer<T>;
    displayName?: string | undefined;
  }
  function createContext<T>(defaultValue: T): Context<T>;

  // ---- hooks ----
  type Dispatch<A> = (value: A) => void;
  type SetStateAction<S> = S | ((prevState: S) => S);
  type EffectCallback = () => void | (() => void);
  type DependencyList = readonly unknown[];
  type Reducer<S, A> = (prevState: S, action: A) => S;

  function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
  function useReducer<S, A extends unknown[]>(reducer: (prevState: S, ...args: A) => S, initialState: S): [S, (...args: A) => void];
  function useReducer<S, I, A extends unknown[]>(
    reducer: (prevState: S, ...args: A) => S,
    initialArg: I,
    init: (i: I) => S,
  ): [S, (...args: A) => void];
  function useRef<T>(initialValue: T): RefObject<T>;
  function useRef<T>(initialValue: T | null): RefObject<T | null>;
  function useRef<T>(initialValue: T | undefined): RefObject<T | undefined>;
  function useEffect(effect: EffectCallback, deps?: DependencyList): void;
  function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void;
  function useInsertionEffect(effect: EffectCallback, deps?: DependencyList): void;
  function useCallback<T extends Function>(callback: T, deps: DependencyList): T;
  function useMemo<T>(factory: () => T, deps: DependencyList): T;
  function useContext<T>(context: Context<T>): T;
  function useImperativeHandle<T, R extends T>(ref: Ref<T> | undefined, init: () => R, deps?: DependencyList): void;
  function useDeferredValue<T>(value: T, initialValue?: T): T;
  function useTransition(): [boolean, (callback: () => void) => void];
  function useId(): string;
  function useSyncExternalStore<Snapshot>(
    subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => Snapshot,
    getServerSnapshot?: () => Snapshot,
  ): Snapshot;
  function use<T>(usable: Promise<T> | Context<T>): T;
  function startTransition(scope: () => void): void;

  // ---- events (minimal; RN uses its own) ----
  interface SyntheticEvent<T = Element, E = Event> {
    currentTarget: T;
    target: EventTarget;
    nativeEvent: E;
    preventDefault(): void;
    stopPropagation(): void;
  }
  interface CSSProperties {
    [key: string]: string | number | undefined;
  }

  // React 19 scopes JSX under React (re-exported by react/jsx-runtime, which react-jsx uses).
  namespace JSX {
    type ElementType = string | JSXElementConstructor<any>;
    interface Element extends ReactElement<any, any> {}
    interface ElementClass extends Component<any> {
      render(): ReactNode;
    }
    interface ElementAttributesProperty {
      props: {};
    }
    interface ElementChildrenAttribute {
      children: {};
    }
    type LibraryManagedAttributes<C, P> = P;
    interface IntrinsicAttributes extends Attributes {}
    interface IntrinsicClassAttributes<T> extends RefAttributes<T> {}
    // React Native renders no intrinsic (lower-case) elements.
    interface IntrinsicElements {}
  }
}
