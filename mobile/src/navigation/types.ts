import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Expense } from '../api/types';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Verify: { email: string };
  Trips: undefined;
  CreateTrip: undefined;
  Trip: { tripId: string };
  ExpenseForm: { tripId: string; expense?: Expense };
  ExpenseDetail: { tripId: string; expense: Expense };
  Join: { code?: string } | undefined;
  Notifications: undefined;
  Profile: undefined;
};

export type Props<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
