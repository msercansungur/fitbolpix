import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen              from '../screens/HomeScreen';
import FixturesScreen          from '../screens/FixturesScreen';
import SimulatorScreen         from '../screens/SimulatorScreen';
import PenaltyWebViewScreen    from '../screens/PenaltyWebViewScreen';
import TournamentScreen        from '../screens/TournamentScreen';
import CollectionScreen        from '../screens/CollectionScreen';
import {
  HomeIcon,
  FixturesIcon,
  SimulatorIcon,
  PenaltyIcon,
  TournamentIcon,
  CollectionIcon,
} from '../components/PixelTabIcon';
import { COLORS, FONTS } from '../constants/theme';

export type BottomTabParamList = {
  Home:       undefined;
  Fixtures:   undefined;
  Simulator:  { homeTeamId: string; awayTeamId: string; fixtureId?: string } | undefined;
  Penalty:    { homeTeamId?: string; awayTeamId?: string; mode?: string; fixtureId?: string } | undefined;
  Tournament: undefined;
  Collection: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.bgPrimary,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor:   COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: {
          fontFamily: FONTS.body,
          fontSize: 10,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Fixtures"
        component={FixturesScreen}
        options={{
          tabBarIcon: ({ color, size }) => <FixturesIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Simulator"
        component={SimulatorScreen}
        options={{
          tabBarIcon: ({ color, size }) => <SimulatorIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Penalty"
        component={PenaltyWebViewScreen}
        options={{
          tabBarIcon: ({ color, size }) => <PenaltyIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Tournament"
        component={TournamentScreen}
        options={{
          tabBarIcon: ({ color, size }) => <TournamentIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Collection"
        component={CollectionScreen}
        options={{
          tabBarIcon: ({ color, size }) => <CollectionIcon color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}
