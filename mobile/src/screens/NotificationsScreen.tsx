import React, { useEffect } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/client';
import { EmptyState, ErrorState, Loading } from '../components/ui';
import { colors, space, type } from '../theme';
import { formatWhen } from '../utils/format';
import type { Props } from '../navigation/types';

export default function NotificationsScreen({ navigation }: Props<'Notifications'>) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: endpoints.notifications.list });

  // Opening the screen marks everything as read (the list keeps showing which ones were new).
  useEffect(() => {
    if (q.data && q.data.unread > 0) {
      endpoints.notifications.readAll().then(() => qc.invalidateQueries({ queryKey: ['notifications'] })).catch(() => undefined);
    }
  }, [q.data, qc]);

  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;

  return (
    <FlatList
      data={q.data.items}
      keyExtractor={(n) => n.id}
      contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}
      ListEmptyComponent={<EmptyState title="No notifications yet" hint="Join requests, new expenses and repayments will show up here." />}
      renderItem={({ item }) => (
        <Pressable onPress={() => { if (item.tripId) navigation.navigate('Trip', { tripId: item.tripId }); }}>
          <View style={{ flexDirection: 'row', paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 7, marginRight: space.md, backgroundColor: item.seen ? 'transparent' : colors.primary }} />
            <View style={{ flex: 1 }}>
              <Text style={type.body}>{item.message}</Text>
              <Text style={type.small}>{formatWhen(item.createdAt)}</Text>
            </View>
          </View>
        </Pressable>
      )}
    />
  );
}
