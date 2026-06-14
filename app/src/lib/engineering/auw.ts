export type SimpleComponent = {
  weightGrams: number;
  quantity: number;
};

/**
 * Calculates the All-Up Weight (AUW) in grams.
 * Simply sums up the weight * quantity of each slot and adds the custom payload weight.
 * For composite boards like AIO, the slots for integrated items are left empty,
 * so this natural summation avoids any double-counting of weight.
 */
export function calcAUW(
  components: SimpleComponent[],
  customPayloadWeightGrams = 0
): number {
  const componentWeight = components.reduce((sum, item) => {
    return sum + (item.weightGrams ?? 0) * (item.quantity ?? 1);
  }, 0);

  return componentWeight + customPayloadWeightGrams;
}
