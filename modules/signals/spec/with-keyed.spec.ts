import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import {
  getState,
  patchState,
  signalStore,
  signalStoreFeature,
  withHooks,
  withMethods,
  withState,
} from '../src';
import { withKeyed } from '../src/with-keyed';
import { getInitialInnerStore } from '../src/signal-store';
import { ChangeDetectorRef } from '@angular/core';

describe('withKeyed', () => {
  function withCommonFeature(field: string | number) {
    return signalStoreFeature(
      withState({
        commonField: field,
      }),
      withMethods((store) => ({
        setField(value: string | number) {
          patchState(store, { commonField: value });
        },
      })),
      withHooks(() => {
        return {
          onInit() {
            console.log(`init ${field}`);
          },
        };
      })
    );
  }

  enum Areas {
    Area1 = 'Area1',
    Area2 = 'Area2',
  }

  it('provides methods', async () => {
    const Store = signalStore(
      { providedIn: 'root' },
      withState(() => ({ rootField: 'Hello' })),
      withKeyed(Areas.Area1, withCommonFeature(1)),
      withKeyed(Areas.Area2, withCommonFeature(2))
    );

    const store = TestBed.inject(Store);

    store[Areas.Area1].setField(10);
    expect(store[Areas.Area1].commonField()).toEqual(10);
    expect(store[Areas.Area2].commonField()).toEqual(2);

    store[Areas.Area2].setField(20);
    expect(store[Areas.Area1].commonField()).toEqual(10);
    expect(store[Areas.Area2].commonField()).toEqual(20);

    expect(getState(store)).toEqual({
      rootField: 'Hello',
      [Areas.Area1]: { commonField: 10 },
      [Areas.Area2]: { commonField: 20 },
    });
  });

  it('provides scoped state signals', async () => {
    const Store = signalStore(
      { providedIn: 'root' },
      withState(() => ({ rootField: 'Hello' })),
      withKeyed(Areas.Area1, withCommonFeature(1)),
      withKeyed(Areas.Area2, withCommonFeature(2)),
      withMethods((store) => ({
        update: () => {
          // Common field should be ignored, and not mutate the keyed features commonField property
          patchState(store, () => ({ rootField: 'World', commonField: 1000 }));
        },
        updateArea1: () => {
          patchState(store, () => ({ [Areas.Area1]: { commonField: 1000 } }));
        },
        updateArea2: () => {
          patchState(store, () => ({ [Areas.Area2]: { commonField: 1000 } }));
        },
      }))
    );

    const store = TestBed.inject(Store);

    expect(getState(store)).toEqual({
      rootField: 'Hello',
      [Areas.Area1]: { commonField: 1 },
      [Areas.Area2]: { commonField: 2 },
    });
    expect(store[Areas.Area1].commonField()).toEqual(1);
    expect(store[Areas.Area2].commonField()).toEqual(2);

    store.update();
    TestBed.tick();

    expect(getState(store)).toEqual({
      rootField: 'World',
      commonField: 1000,
      [Areas.Area1]: { commonField: 1 },
      [Areas.Area2]: { commonField: 2 },
    });
    expect(store[Areas.Area1].commonField()).toEqual(1);
    expect(store[Areas.Area2].commonField()).toEqual(2);

    store.updateArea1();

    expect(getState(store)).toEqual({
      rootField: 'World',
      commonField: 1000,
      [Areas.Area1]: { commonField: 1000 },
      [Areas.Area2]: { commonField: 2 },
    });

    store.updateArea2();

    expect(getState(store)).toEqual({
      rootField: 'World',
      commonField: 1000,
      [Areas.Area1]: { commonField: 1000 },
      [Areas.Area2]: { commonField: 1000 },
    });
  });

  it('provides hooks', async () => {
    const messages: string[] = [];

    const withCommonFeatureAndHooks = () =>
      signalStoreFeature(
        withCommonFeature(1),
        withHooks(() => ({
          onInit() {
            messages.push('common init');
          },
          onDestroy() {
            messages.push('common destroy');
          },
        }))
      );

    const initialStore = getInitialInnerStore();
    let keyedHookStore: any;
    TestBed.runInInjectionContext(() => {
      keyedHookStore = withKeyed(
        Areas.Area1,
        withCommonFeatureAndHooks()
      )(initialStore);
    });
    const rootStore = withHooks(() => ({
      onInit() {
        messages.push('root init');
      },
      onDestroy() {
        messages.push('root destroy');
      },
    }))(keyedHookStore);

    expect(messages).toEqual([]);

    rootStore.hooks.onInit?.();

    expect(messages).toEqual(['common init', 'root init']);

    rootStore.hooks.onDestroy?.();

    expect(messages).toEqual([
      'common init',
      'root init',
      'common destroy',
      'root destroy',
    ]);
  });

  it('nested keyed features', async () => {
    const withC = () =>
      signalStoreFeature(withState(() => ({ commonField: 'C' })));
    const withB = () =>
      signalStoreFeature(
        withKeyed('C', withC()),
        withState(() => ({ commonField: 'B' }))
      );
    const withA = () =>
      signalStoreFeature(
        withKeyed('B', withB()),
        withState(() => ({ commonField: 'A' }))
      );

    const Store = signalStore({ providedIn: 'root' }, withKeyed('A', withA()));

    const store = TestBed.inject(Store);

    expect(getState(store)).toEqual({
      A: {
        commonField: 'A',
        B: { commonField: 'B', C: { commonField: 'C' } },
      },
    });
    expect(store.A()).toEqual({
      commonField: 'A',
      B: { commonField: 'B', C: { commonField: 'C' } },
    });
    expect(store.A.commonField()).toEqual('A');
    expect(store.A.B()).toEqual({ commonField: 'B', C: { commonField: 'C' } });
    expect(store.A.B.commonField()).toEqual('B');
    expect(store.A.B.C()).toEqual({ commonField: 'C' });
    expect(store.A.B.C.commonField()).toEqual('C');
  });
});
