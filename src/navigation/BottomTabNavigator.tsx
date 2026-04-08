import React, { useRef, useEffect } from 'react';
import { Animated } from 'react-native';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { TouchableOpacity } from 'react-native';
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

// ─── Animated tab button ──────────────────────────────────────────────────────
function AnimatedTabButton(props: BottomTabBarButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  // Pulse on focus
  useEffect(() => {
    if (props.accessibilityState?.selected) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: 90,  useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.00, duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [props.accessibilityState?.selected]);

  return (
    <TouchableOpacity
      {...(props as any)}
      activeOpacity={0.8}
      style={[props.style, { flex: 1, alignItems: 'center', justifyContent: 'center' }]}
      onPress={props.onPress}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {props.children}
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.bgPrimary,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 12,
          paddingTop: 4,
        },
        tabBarActiveTintColor:   COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: {
          fontFamily: FONTS.pixel,
          fontSize: 9,
          letterSpacing: 0.5,
        },
        tabBarButton: (props) => <AnimatedTabButton {...props} />,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Fixtures"
        component={FixturesScreen}
        options={{ tabBarIcon: ({ color, size }) => <FixturesIcon color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Simulator"
        component={SimulatorScreen}
        options={{ tabBarIcon: ({ color, size }) => <SimulatorIcon color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Penalty"
        component={PenaltyWebViewScreen}
        options={{ tabBarIcon: ({ color, size }) => <PenaltyIcon color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Tournament"
        component={TournamentScreen}
        options={{ tabBarIcon: ({ color, size }) => <TournamentIcon color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Collection"
        component={CollectionScreen}
        options={{ tabBarIcon: ({ color, size }) => <CollectionIcon color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}
