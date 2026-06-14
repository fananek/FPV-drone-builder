/**
 * Calculates the ESC current headroom as a percentage margin.
 * A positive margin indicates headroom; a negative margin means the peak motor draw
 * exceeds the ESC's continuous rated current.
 */
export function calcEscCurrentHeadroom(
  escContinuousAmps: number,
  motorMaxCurrentAmps: number,
  motorCount: number
): number {
  if (escContinuousAmps <= 0) return 0;
  
  const margin = ((escContinuousAmps - motorMaxCurrentAmps) / escContinuousAmps) * 100;
  
  return margin;
}
