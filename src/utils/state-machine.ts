import type { BookingStatus } from "../types/index.js";
import { AppError } from "../middleware/error-handler.js";

/**
 * Valid booking status transitions.
 * Terminal states (completed, cancelled) have no outgoing transitions.
 */
const validTransitions: Record<BookingStatus, BookingStatus[]> = {
  finding: ["negotiating", "cancelled"],
  negotiating: ["accepted", "cancelled"],
  accepted: ["arriving", "cancelled"],
  arriving: ["ontrip", "cancelled"],
  ontrip: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/**
 * Check if a status transition is valid.
 */
export function canTransition(
  from: BookingStatus,
  to: BookingStatus
): boolean {
  return validTransitions[from].includes(to);
}

/**
 * Assert that a transition is valid. Throws AppError if not.
 */
export function assertTransition(
  from: BookingStatus,
  to: BookingStatus
): void {
  if (!canTransition(from, to)) {
    throw new AppError(
      422,
      "INVALID_STATE_TRANSITION",
      `Cannot transition from '${from}' to '${to}'`
    );
  }
}

/**
 * Check if a status is terminal (no further transitions possible).
 */
export function isTerminalStatus(status: BookingStatus): boolean {
  return validTransitions[status].length === 0;
}
