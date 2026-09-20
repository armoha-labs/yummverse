/** With no kitchen workflow, "NEW" no longer means "waiting for the kitchen to accept it" —
 * it means "placed, waiting to be served directly" (orderLifecycle.service.ts lets "served"
 * apply straight from NEW when kitchen is disabled). Every other status reads the same either
 * way, so this only ever touches NEW. */
export function orderStatusLabel(status: string, kitchenEnabled: boolean): string {
  return !kitchenEnabled && status === "NEW" ? "PLACED" : status;
}
