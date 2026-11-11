import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/client';
import { ErrorState, Loading } from '../components/ui';
import type { Props } from '../navigation/types';
import AnalyticsTab from './trip/AnalyticsTab';
import { colors, space, type } from '../theme';

export default function TripAnalyticsScreen({ route }: Props<'TripAnalytics'>) {
  const insets = useSafeAreaInsets();
  const { tripId } = route.params;

  const tripQuery = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => endpoints.trips.get(tripId),
  });

  if (tripQuery.isLoading) return <Loading />;
  if (tripQuery.isError || !tripQuery.data) {
    return (
      <ErrorState
        message={errorMessage(tripQuery.error)}
        onRetry={() => tripQuery.refetch()}
      />
    );
  }

  const trip = tripQuery.data;

  return (
    <View style={[styles.screen, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {/* Consistent Velto Section Header */}
      <View style={styles.header}>
        <Text style={type.caption}>TRIP ANALYTICS</Text>
        <Text style={styles.title} numberOfLines={1}>
          {trip.name}
        </Text>
        {trip.destination ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {trip.destination}
          </Text>
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        <AnalyticsTab trip={trip} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.4,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
});

