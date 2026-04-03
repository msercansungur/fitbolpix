import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import FixturesScreen from '../screens/FixturesScreen';
import SimulatorScreen from '../screens/SimulatorScreen';
import TournamentScreen from '../screens/TournamentScreen';
import CollectionScreen from '../screens/CollectionScreen';

export type BottomTabParamList = {
  Home: undefined;
  Fixtures: undefined;
  Simulator: undefined;
  Tournament: undefined;
  Collection: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: true }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Fixtures" component={FixturesScreen} />
      <Tab.Screen name="Simulator" component={SimulatorScreen} />
      <Tab.Screen name="Tournament" component={TournamentScreen} />
      <Tab.Screen name="Collection" component={CollectionScreen} />
    </Tab.Navigator>
  );
}
