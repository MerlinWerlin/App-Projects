// Offline type stubs for React 19 (oversight D75-1). Used only by `scripts/tsconfig.ui.json`
// so app/ and src/ui can be type-checked in the cloud, where node_modules cannot be installed.
// Hooks and core types are typed precisely enough to catch own-code mistakes; the real
// @types/react on the PC (`npx tsc --noEmit`) remains the authority.

declare module 'react' {
  export type Key = string | number | bigint;
  export interface ReactElement<P = any, T = any> {
    type: T;
    props: P;
    key: string | null;
  }
  export type ReactNode =
    | ReactElement
    | string
    | number
    | bigint
    | boolean
    | null
    | undefined
    | Iterable<ReactNode>
    | Promise<ReactNode>;
  export type PropsWithChildren<P = unknown> = P & { children?: ReactNode };

  export class Component<P = {}, S = {}> {
    constructor(props: P);
    readonly props: Readonly<P>;
    state: Readonly<S>;
    setState(s: Partial<S> | ((prev: S, props: P) => Partial<S> | null) | null, cb?: () => void): void;
    forceUpdate(cb?: () => void): void;
    render(): ReactNode;
    componentDidMount?(): void;
    componentWillUnmount?(): void;
    componentDidCatch?(error: unknown, info: { componentStack?: string | null }): void;
  }
  export class PureComponent<P = {}, S = {}> extends Component<P, S> {}
  export interface ComponentClass<P = {}> {
    new (props: P): Component<P, any>;
  }
  export type FunctionComponent<P = {}> = (props: P) => ReactNode;
  export type FC<P = {}> = FunctionComponent<P>;
  export type ComponentType<P = {}> = ComponentClass<P> | FunctionComponent<P>;
  export type JSXElementConstructor<P> = ((props: P) => ReactNode) | (new (props: P) => Component<any, any>);
  export type ElementType<P = any> = string | JSXElementConstructor<P>;
  export type ComponentProps<T> = T extends JSXElementConstructor<infer P> ? P : T extends ComponentType<infer Q> ? Q : {};
  export type ComponentPropsWithoutRef<T> = ComponentProps<T>;

  export interface RefObject<T> {
    current: T;
  }
  export type MutableRefObject<T> = RefObject<T>;
  export type RefCallback<T> = (instance: T | null) => void | (() => void);
  export type Ref<T> = RefCallback<T> | RefObject<T | null> | null;

  export type Dispatch<A> = (value: A) => void;
  export type SetStateAction<S> = S | ((prev: S) => S);
  export type DependencyList = readonly unknown[];
  export type EffectCallback = () => void | (() => void);

  export function useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
  export function useReducer<S, A>(reducer: (state: S, action: A) => S, initial: S): [S, Dispatch<A>];
  export function useReducer<S, A, I>(reducer: (state: S, action: A) => S, arg: I, init: (arg: I) => S): [S, Dispatch<A>];
  export function useReducer<S>(reducer: (state: S) => S, initial: S): [S, () => void];
  export function useRef<T>(initial: T): RefObject<T>;
  export function useRef<T>(initial: T | null): RefObject<T | null>;
  export function useRef<T = undefined>(): RefObject<T | undefined>;
  export function useEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useInsertionEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useCallback<T extends Function>(callback: T, deps: DependencyList): T;
  export function useMemo<T>(factory: () => T, deps: DependencyList): T;
  export function useId(): string;
  export function useSyncExternalStore<T>(
    subscribe: (onChange: () => void) => () => void,
    getSnapshot: () => T,
    getServerSnapshot?: () => T,
  ): T;
  export function useTransition(): [boolean, (cb: () => void) => void];
  export function useDeferredValue<T>(value: T): T;
  export function useImperativeHandle<T, R extends T>(ref: Ref<T> | undefined, init: () => R, deps?: DependencyList): void;

  export interface ProviderProps<T> {
    value: T;
    children?: ReactNode;
  }
  export interface Context<T> {
    Provider: FunctionComponent<ProviderProps<T>>;
    Consumer: FunctionComponent<{ children: (value: T) => ReactNode }>;
    displayName?: string;
  }
  export function createContext<T>(defaultValue: T): Context<T>;
  export function useContext<T>(context: Context<T>): T;
  export function use<T>(usable: Context<T> | Promise<T>): T;

  export function memo<T extends ComponentType<any>>(component: T, equal?: (a: any, b: any) => boolean): T;
  export function forwardRef<T, P = {}>(render: (props: P, ref: Ref<T>) => ReactNode): FunctionComponent<P & { ref?: Ref<T> }>;
  export function lazy<T extends ComponentType<any>>(load: () => Promise<{ default: T }>): T;
  export function isValidElement<P = any>(value: unknown): value is ReactElement<P>;
  export function cloneElement<P>(element: ReactElement<P>, props?: Partial<P> & { key?: Key }, ...children: ReactNode[]): ReactElement<P>;
  export function createElement(type: any, props?: any, ...children: ReactNode[]): ReactElement;
  export function startTransition(cb: () => void): void;

  export const Fragment: FunctionComponent<{ children?: ReactNode }>;
  export const StrictMode: FunctionComponent<{ children?: ReactNode }>;
  export const Suspense: FunctionComponent<{ children?: ReactNode; fallback?: ReactNode }>;

  export const Children: {
    map<T, C>(children: C | readonly C[], fn: (child: C, index: number) => T): C extends null | undefined ? C : T[];
    forEach<C>(children: C | readonly C[], fn: (child: C, index: number) => void): void;
    count(children: unknown): number;
    only<C>(children: C): C extends any[] ? never : C;
    toArray(children: ReactNode | ReactNode[]): Array<Exclude<ReactNode, boolean | null | undefined>>;
  };

  export namespace JSX {
    type ElementType = string | ((props: any) => ReactNode) | (new (props: any) => Component<any, any>);
    interface Element extends ReactElement<any, any> {}
    interface ElementClass {
      render(): ReactNode;
    }
    interface ElementAttributesProperty {
      props: {};
    }
    interface ElementChildrenAttribute {
      children: {};
    }
    interface IntrinsicAttributes {
      key?: Key | null;
    }
    interface IntrinsicClassAttributes<T> {
      ref?: Ref<T>;
    }
    interface IntrinsicElements {}
  }

  const React: {
    createElement: typeof createElement;
    Fragment: typeof Fragment;
  };
  export default React;
}

declare module 'react/jsx-runtime' {
  export { JSX } from 'react';
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module 'react/jsx-dev-runtime' {
  export { JSX } from 'react';
  export const jsxDEV: any;
  export const Fragment: any;
}

