// Active loans stay in the approval queue until every item has been returned.
export const COMPLETED_DISBURSEMENT_STATUSES = ['confirmed', 'cancelled', 'reversed', 'returned', 'rejected'] as const
