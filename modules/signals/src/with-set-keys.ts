import {
  SignalStoreFeature,
  SignalStoreFeatureResult,
} from './signal-store-models';
import { Prettify } from './ts-helpers';
import {
  ExposedKeyFeature,
  ExposedKeyFeatureWithOverrides,
} from './with-expose-keys';

type ZipToOverrideMap<
  OutputAtPart extends SignalStoreFeatureResult[keyof SignalStoreFeatureResult],
  Keys extends readonly PropertyKey[],
  Overrides extends readonly PropertyKey[]
> = {
  [K in keyof Keys as K extends `${number}`
    ? Keys[K] extends keyof OutputAtPart
      ? K extends keyof Overrides
        ? Overrides[K]
        : Keys[K]
      : never
    : never]: K extends `${number}`
    ? Keys[K] extends keyof OutputAtPart
      ? OutputAtPart[Keys[K]]
      : never
    : never;
};

type WithSetExposedKeysFeaturePartOutput<
  OutputAtPart extends SignalStoreFeatureResult[keyof SignalStoreFeatureResult],
  Keys extends PropertyKey[],
  Overrides extends PropertyKey[]
> = Omit<OutputAtPart, Keys[number]> &
  ZipToOverrideMap<OutputAtPart, Keys, Overrides>;

export type SetExposedKeysOutput<
  Output extends SignalStoreFeatureResult,
  Keys extends PropertyKey[],
  Overrides extends PropertyKey[]
> = {
  state: Prettify<
    WithSetExposedKeysFeaturePartOutput<Output['state'], Keys, Overrides>
  >;
  props: Prettify<
    WithSetExposedKeysFeaturePartOutput<Output['props'], Keys, Overrides>
  >;
  methods: Prettify<
    WithSetExposedKeysFeaturePartOutput<Output['methods'], Keys, Overrides>
  >;
};

export function withSetKeys<
  Keys extends PropertyKey[],
  Overrides extends PropertyKey[],
  Input extends SignalStoreFeatureResult,
  Output extends SignalStoreFeatureResult
>(
  exposedKeyFeatureFactory: ExposedKeyFeature<Input, Output, Keys>,
  ...overrides: Overrides
) {
  return (
    exposedKeyFeatureFactory as ExposedKeyFeatureWithOverrides<
      Input,
      Output,
      Keys
    >
  )(...overrides) as unknown as SignalStoreFeature<
    Input,
    Prettify<SetExposedKeysOutput<Output, Keys, Overrides>>
  >;
}
