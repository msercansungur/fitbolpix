import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BottomTabNavigator from './BottomTabNavigator';
import AboutScreen from '../screens/AboutScreen';
import PenaltyScreen from '../screens/PenaltyScreen';

export type RootStackParamList = {
  MainTabs: undefined;
  About: undefined;
  PenaltyGame: {
    homeTeamId: string;
    awayTeamId: string;
    mode: 'best_of_5' | 'sudden_death';
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="MainTabs"    component={BottomTabNavigator} />
      <Stack.Screen name="About"       component={AboutScreen} />
      <Stack.Screen name="PenaltyGame" component={PenaltyScreen as any} />
    </Stack.Navigator>
  );
}