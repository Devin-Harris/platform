import {
  SignalStoreFeature,
  SignalStoreFeatureResult,
} from './signal-store-models';

type WithExposedKeysFeaturePartOutput<
  OutputAtPart extends SignalStoreFeatureResult[keyof SignalStoreFeatureResult],
  Keys extends PropertyKey[]
> = Omit<OutputAtPart, Keys[number]> & {
  [K in Keys[number] as K extends keyof OutputAtPart
    ? K
    : never]: K extends keyof OutputAtPart ? OutputAtPart[K] : never;
};

export type ExposedKeysOutput<
  Output extends SignalStoreFeatureResult,
  Keys extends PropertyKey[]
> = {
  state: WithExposedKeysFeaturePartOutput<Output['state'], Keys>;
  props: WithExposedKeysFeaturePartOutput<Output['props'], Keys>;
  methods: WithExposedKeysFeaturePartOutput<Output['methods'], Keys>;
};

const ExposedKeyFeatureSymbol = Symbol('ExposedKeyFeatureSymbol');
type ExposedKeyFeatureBrand<T> = T & {
  [ExposedKeyFeatureSymbol]: true;
};

export type ExposedKeyFeature<
  Input extends SignalStoreFeatureResult,
  Output extends SignalStoreFeatureResult,
  Keys extends PropertyKey[]
> = ExposedKeyFeatureBrand<
  () => SignalStoreFeature<Input, ExposedKeysOutput<Output, Keys>>
>;

export type ExposedKeyFeatureWithOverrides<
  Input extends SignalStoreFeatureResult,
  Output extends SignalStoreFeatureResult,
  Keys extends PropertyKey[]
> = ExposedKeyFeatureBrand<
  (
    ...args: PropertyKey[]
  ) => SignalStoreFeature<Input, ExposedKeysOutput<Output, Keys>>
>;

export function withExposeKeys<
  Keys extends PropertyKey[],
  Input extends SignalStoreFeatureResult,
  Output extends SignalStoreFeatureResult
>(
  featureFactory: (...keys: Keys) => SignalStoreFeature<Input, Output>,
  ...keys: Keys
): ExposedKeyFeature<Input, Output, Keys> {
  return ((...overrides: any[]) => {
    return ((store) => {
      const feature = featureFactory(
        ...(keys.map((key, i) => overrides[i] ?? key) as unknown as Keys)
      );
      return feature(store);
    }) as SignalStoreFeature<Input, ExposedKeysOutput<Output, Keys>>;
  }) as ExposedKeyFeatureWithOverrides<Input, Output, Keys>;
}
