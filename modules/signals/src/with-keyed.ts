import { computed, isSignal, Signal } from '@angular/core';
import { DeepSignal } from './deep-signal';
import { getInitialInnerStore } from './signal-store';
import {
  EmptyFeatureResult,
  InnerSignalStore,
  SignalStoreFeature,
  SignalStoreFeatureResult,
} from './signal-store-models';
import { getState, patchState, watchState } from './state-source';
import { withHooks } from './with-hooks';
import { withProps } from './with-props';

type WithKeyedPropsOutput<Output extends SignalStoreFeatureResult> = DeepSignal<
  PropsComputedSignalType<Output['props']>
> &
  PropsValueType<Output['props']> &
  Output['props'] &
  Output['methods'];

type WithKeyedOutputFeatureResult<
  Key extends string | symbol,
  Output extends SignalStoreFeatureResult
> = EmptyFeatureResult & {
  state: {
    [x in Key]: Output['state'];
  };
  props: {
    [x in Key]: WithKeyedPropsOutput<Output>;
  };
};

/**
 * @description
 * Allows pulling in feature properties, methods, etc... under a defined key
 *
 * @usageNotes
 * ```typescript
 * const withCommonFeature = () => signalStoreFeature(withState({commonField: 'Hello World!'}))
 *
 * signalStore(
 *   withKeyed('A', withCommonFeature()),
 *   withKeyed('B', withCommonFeature()),
 *   withMethods((store) => ({
 *     log() {
 *       console.log(store['A'].commonField())
 *       console.log(store['B'].commonField())
 *     }
 *   }))
 * );
 * ```
 * @param key identifier to expose feature under
 * @param feature feature to wrap under the provided key
 */
export function withKeyed<
  Key extends string | symbol,
  Input extends SignalStoreFeatureResult,
  Output extends SignalStoreFeatureResult
>(
  key: Key,
  feature: SignalStoreFeature<Input, Output>
): SignalStoreFeature<Input, WithKeyedOutputFeatureResult<Key, Output>> {
  return (store) => {
    const _innerStore = feature(
      getInitialInnerStore() as Parameters<SignalStoreFeature<Input, Output>>[0]
    );

    /** Add props, state, and methods under provided key */
    const { nonSignalProps, signalProps, computedSignalProps } =
      buildKeyedPropsInformation(_innerStore.props);

    const computedState = computed(() => {
      /** Read state under key from parent store, so writes done at higher level are used inside this feature */
      const rootState = getState(store) as WithKeyedOutputFeatureResult<
        Key,
        Output
      >['state'];
      return {
        ...rootState[key],
        ...computedSignalProps(),
      };
    });

    const props = computedState;
    Object.assign(props, nonSignalProps);
    Object.assign(props, signalProps);
    Object.assign(props, _innerStore.methods);
    Object.assign(props, _innerStore.stateSignals);

    const storeWithProps = withProps(() => {
      return {
        [key]: props,
      } as WithKeyedOutputFeatureResult<Key, Output>['props'];
    })(store);

    /** Add hooks from inner feature */
    const storeWithHooks = withHooks(() => _innerStore.hooks)(storeWithProps);

    /** Bubble state writes on inner store, back up to parent store */
    watchState(_innerStore, (state) => {
      patchState(store, { [key]: { state } } as any);
    });

    return storeWithHooks as InnerSignalStore<
      WithKeyedOutputFeatureResult<Key, Output>['state'],
      WithKeyedOutputFeatureResult<Key, Output>['props'],
      WithKeyedOutputFeatureResult<Key, Output>['methods']
    >;
  };
}

type PropsSignalsKeyType<PropsType> = {
  [x in keyof PropsType]: PropsType[x] extends Signal<any> ? x : never;
}[keyof PropsType];
type PropsSignalsType<PropsType> = {
  [x in PropsSignalsKeyType<PropsType>]: PropsType[x] extends Signal<any>
    ? PropsType[x]
    : never;
};
type PropsComputedSignalType<PropsType> = {
  [x in PropsSignalsKeyType<PropsType>]: PropsType[x] extends Signal<infer V>
    ? V
    : never;
};

type PropsValueKeyType<PropsType> = {
  [x in keyof PropsType]: PropsType[x] extends Signal<any> ? never : x;
}[keyof PropsType];
type PropsValueType<PropsType> = {
  [x in PropsValueKeyType<PropsType>]: PropsType[x];
};

function buildKeyedPropsInformation<P extends object = object>(props: P) {
  const propsKeys = Object.keys(props) as (keyof P)[];

  const signalKeys = propsKeys.filter((k) =>
    isSignal(props[k])
  ) as PropsSignalsKeyType<P>[];
  const signalProps = signalKeys.reduce((acc, k) => {
    acc[k] = props[k] as PropsSignalsType<P>[typeof k];
    return acc;
  }, {} as PropsSignalsType<P>);

  const computedSignalProps = computed(() => {
    return signalKeys.reduce((acc, k) => {
      const propSignal = props[k] as PropsSignalsType<P>[typeof k];
      acc[k] = propSignal();
      return acc;
    }, {} as PropsComputedSignalType<P>);
  });

  const nonSignalKeys = propsKeys.filter(
    (k) => !isSignal(props[k])
  ) as PropsValueKeyType<P>[];
  const nonSignalProps = nonSignalKeys.reduce((acc, k) => {
    acc[k] = props[k];
    return acc;
  }, {} as PropsValueType<P>);

  return {
    nonSignalProps,
    computedSignalProps,
    signalProps,
  };
}
