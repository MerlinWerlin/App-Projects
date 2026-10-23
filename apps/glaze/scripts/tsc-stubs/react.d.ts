// Hand-written approximation of @types/react 19.1 for the cloud strict-tsc harness (D74-3, T52).
// Not the real types: covers the public API Glaze uses, shaped like @types/react so wrong props,
// implicit any and bad narrowing in our code are caught. See scripts/README.md.

declare module 'react' {
  export type Key = string | number | bigint;
  export type JSXElementConstructor<P> =
    | ((props: P) => ReactNode | Promise<ReactNode>)
    | (new (props: P) => Component<any, any>);

  export interface ReactElement<P = unknown, T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>> {
    type: T;
    props: P;
    key: string | null;
  }
  export interface ReactPortal extends ReactElement {
    children: ReactNode;
  }
  export type AwaitedReactNode = ReactElement | string | number | bigint | Iterable<ReactNode> | ReactPortal | boolean | null | undefined;
  export type ReactNode =
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

  export interface RefObject<T> {
    current: T;
  }
  /** @deprecated in React 19 types; kept as an alias. */
  export interface MutableRefObject<T> {
    current: T;
  }
  export type RefCallback<T> = (instance: T | null) => void | (() => void);
  export type Ref<T> = RefCallback<T> | RefObject<T | null> | null;
  export type LegacyRef<T> = Ref<T>;
  export type ForwardedRef<T> = ((instance: T | null) => void) | RefObject<T | null> | null;

  export interface Attributes {
    key?: Key | null | undefined;
  }
  export interface RefAttributes<T> extends Attributes {
    ref?: Ref<T> | undefined;
  }
  export type PropsWithChildren<P = unknown> = P & { children?: ReactNode | undefined };
  export type PropsWithoutRef<P> = P extends any ? ('ref' extends keyof P ? Omit<P, 'ref'> : P) : P;
  export type PropsWithRef<P> = P;

  export interface FunctionComponent<P = {}> {
    (props: P): ReactNode | Promise<ReactNode>;
    displayName?: string | undefined;
  }
  export type FC<P = {}> = FunctionComponent<P>;
  export interface ComponentClass<P = {}, S = any> {
    new (props: P): Component<P, S>;
    displayName?: string | undefined;
    getDerivedStateFromError?: (error: any) => Partial<S> | null;
  }
  export type ComponentType<P = {}> = ComponentClass<P> | FunctionComponent<P>;
  export type ElementType<P = any> = string | JSXElementConstructor<P>;

  export interface ExoticComponent<P = {}> {
    (props: P): ReactNode;
    readonly $$typeof: symbol;
  }
  export interface NamedExoticComponent<P = {}> extends ExoticComponent<P> {
    displayName?: string | undefined;
  }
  export interface ForwardRefExoticComponent<P> extends NamedExoticComponent<P> {}
  export type MemoExoticComponent<T extends ComponentType<any>> = NamedExoticComponent<ComponentProps<T>> & {
    readonly type: T;
  };

  export type ComponentProps<T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any>> =
    T extends JSXElementConstructor<infer Props>
      ? Props
      : T extends keyof JSX.IntrinsicElements
        ? JSX.IntrinsicElements[T]
        : {};
  export type ComponentPropsWithoutRef<T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any>> = PropsWithoutRef<
    ComponentProps<T>
  >;
  export type ComponentPropsWithRef<T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any>> = ComponentProps<T>;
  export type ComponentRef<T> = T extends ForwardRefExoticComponent<infer P>
    ? P extends { ref?: infer R } ? (R extends RefObject<infer I> ? NonNullable<I> : R extends RefCallback<infer I> ? I : unknown) : unknown
    : T extends new (...args: any) => infer I
      ? I
      : unknown;
  export type ElementRef<T> = ComponentRef<T>;

  export interface ErrorInfo {
    componentStack?: string | null;
    digest?: string | null;
  }

  export class Component<P = {}, S = {}> {
    constructor(props: P);
    static contextType?: Context<any> | undefined;
    context: unknown;
    readonly props: Readonly<P>;
    state: Readonly<S>;
    setState<K extends keyof S>(
      state: ((prevState: Readonly<S>, props: Readonly<P>) => Pick<S, K> | S | null) | (Pick<S, K> | S | null),
      callback?: () => void,
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): ReactNode;
    componentDidMount?(): void;
    componentWillUnmount?(): void;
    componentDidUpdate?(prevProps: Readonly<P>, prevState: Readonly<S>, snapshot?: any): void;
    shouldComponentUpdate?(nextProps: Readonly<P>, nextState: Readonly<S>): boolean;
    componentDidCatch?(error: Error, errorInfo: ErrorInfo): void;
  }
  export class PureComponent<P = {}, S = {}> extends Component<P, S> {}

  export type Dispatch<A> = (value: A) => void;
  export type SetStateAction<S> = S | ((prevState: S) => S);
  export type DependencyList = readonly unknown[];
  export type EffectCallback = () => void | (() => void);
  export type Reducer<S, A> = (prevState: S, action: A) => S;

  export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
  export function useReducer<S, A>(reducer: Reducer<S, A>, initialState: S): [S, Dispatch<A>];
  export function useEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useInsertionEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useMemo<T>(factory: () => T, deps: DependencyList): T;
  export function useCallback<T extends Function>(callback: T, deps: DependencyList): T;
  export function useRef<T>(initialValue: T): RefObject<T>;
  export function useRef<T>(initialValue: T | null): RefObject<T | null>;
  export function useRef<T>(initialValue: T | undefined): RefObject<T | undefined>;
  export function useContext<T>(context: Context<T>): T;
  export function useId(): string;
  export function useImperativeHandle<T, R extends T>(ref: Ref<T> | undefined, init: () => R, deps?: DependencyList): void;
  export function useSyncExternalStore<Snapshot>(
    subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => Snapshot,
    getServerSnapshot?: () => Snapshot,
  ): Snapshot;
  export function useDeferredValue<T>(value: T, initialValue?: T): T;
  export type TransitionFunction = () => void | Promise<void>;
  export function useTransition(): [boolean, (callback: TransitionFunction) => void];
  export function startTransition(scope: TransitionFunction): void;
  export function use<T>(usable: Promise<T> | Context<T>): T;
  export function useDebugValue<T>(value: T, format?: (value: T) => any): void;

  export interface ProviderProps<T> {
    value: T;
    children?: ReactNode | undefined;
  }
  export interface ConsumerProps<T> {
    children: (value: T) => ReactNode;
  }
  export type Provider<T> = ExoticComponent<ProviderProps<T>>;
  export type Consumer<T> = ExoticComponent<ConsumerProps<T>>;
  export interface Context<T> extends Provider<T> {
    Provider: Provider<T>;
    Consumer: Consumer<T>;
    displayName?: string | undefined;
  }
  export function createContext<T>(defaultValue: T): Context<T>;

  export function memo<P extends object>(
    Component: FunctionComponent<P>,
    propsAreEqual?: (prevProps: Readonly<P>, nextProps: Readonly<P>) => boolean,
  ): NamedExoticComponent<P>;
  export function memo<T extends ComponentType<any>>(
    Component: T,
    propsAreEqual?: (prevProps: Readonly<ComponentProps<T>>, nextProps: Readonly<ComponentProps<T>>) => boolean,
  ): MemoExoticComponent<T>;
  export function forwardRef<T, P = {}>(
    render: (props: PropsWithoutRef<P>, ref: ForwardedRef<T>) => ReactNode,
  ): ForwardRefExoticComponent<PropsWithoutRef<P> & RefAttributes<T>>;
  export function lazy<T extends ComponentType<any>>(load: () => Promise<{ default: T }>): T;

  export const Fragment: ExoticComponent<{ children?: ReactNode | undefined }>;
  export const StrictMode: ExoticComponent<{ children?: ReactNode | undefined }>;
  export const Suspense: ExoticComponent<{ children?: ReactNode | undefined; fallback?: ReactNode }>;

  export function createElement(type: any, props?: any, ...children: ReactNode[]): ReactElement;
  export function cloneElement<P>(element: ReactElement<P>, props?: Partial<P> & Attributes, ...children: ReactNode[]): ReactElement<P>;
  export function isValidElement<P>(object: {} | null | undefined): object is ReactElement<P>;
  export function createRef<T>(): RefObject<T | null>;

  export const Children: {
    map<T, C>(children: C | readonly C[], fn: (child: C, index: number) => T): C extends null | undefined ? C : Array<Exclude<T, boolean | null | undefined>>;
    forEach<C>(children: C | readonly C[], fn: (child: C, index: number) => void): void;
    count(children: any): number;
    only<C>(children: C): C extends any[] ? never : C;
    toArray(children: ReactNode | ReactNode[]): Array<Exclude<ReactNode, boolean | null | undefined>>;
  };

  export namespace JSX {
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
    type LibraryManagedAttributes<C, P> = C extends { defaultProps: infer D } ? Defaultize<P, D> : P;
    interface IntrinsicAttributes extends Attributes {}
    interface IntrinsicClassAttributes<T> extends RefAttributes<T> {}
    // React Native has no host string elements usable from JSX.
    interface IntrinsicElements {}
  }
  type Defaultize<P, D> = P extends any
    ? string extends keyof P
      ? P
      : Pick<P, Exclude<keyof P, keyof D>> & Partial<Pick<P, Extract<keyof P, keyof D>>> & Partial<Pick<D, Exclude<keyof D, keyof P>>>
    : never;

  const React: {
    Component: typeof Component;
    Fragment: typeof Fragment;
    createElement: typeof createElement;
    useState: typeof useState;
    useEffect: typeof useEffect;
    useRef: typeof useRef;
    useMemo: typeof useMemo;
    useCallback: typeof useCallback;
  };
  export default React;
}

declare module 'react/jsx-runtime' {
  import type { Key, ReactElement, JSX as ReactJSX } from 'react';
  export namespace JSX {
    type ElementType = ReactJSX.ElementType;
    interface Element extends ReactJSX.Element {}
    interface ElementClass extends ReactJSX.ElementClass {}
    interface ElementAttributesProperty extends ReactJSX.ElementAttributesProperty {}
    interface ElementChildrenAttribute extends ReactJSX.ElementChildrenAttribute {}
    type LibraryManagedAttributes<C, P> = ReactJSX.LibraryManagedAttributes<C, P>;
    interface IntrinsicAttributes extends ReactJSX.IntrinsicAttributes {}
    interface IntrinsicClassAttributes<T> extends ReactJSX.IntrinsicClassAttributes<T> {}
    interface IntrinsicElements extends ReactJSX.IntrinsicElements {}
  }
  export function jsx(type: any, props: any, key?: Key): ReactElement;
  export function jsxs(type: any, props: any, key?: Key): ReactElement;
  export const Fragment: any;
}

declare module 'react/jsx-dev-runtime' {
  export * from 'react/jsx-runtime';
}
