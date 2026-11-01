import { QueryClient } from '@tanstack/react-query';

/** After any change in a trip, refresh everything that shows it. */
export function invalidateTrip(qc: QueryClient, tripId: string) {
  qc.invalidateQueries({ queryKey: ['trip', tripId] });
  qc.invalidateQueries({ queryKey: ['expenses', tripId] });
  qc.invalidateQueries({ queryKey: ['balances', tripId] });
  qc.invalidateQueries({ queryKey: ['activities', tripId] });
  qc.invalidateQueries({ queryKey: ['stats', tripId] });
  qc.invalidateQueries({ queryKey: ['trips'] });
}
