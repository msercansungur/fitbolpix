import React, { useRef, useEffect } from 'react';
import { Animated, View } from 'react-native';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { TouchableOpacity } from 'react-native';
import HomeScreen              from '../screens/HomeScreen';
import FixturesScreen          from '../screens/FixturesScreen';
import SimulatorScreen         from '../screens/SimulatorScreen';
import PenaltyMenuScreen       from '../screens/PenaltyMenuScreen';
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
  Penalty: { homeTeamId?: string; awayTeamId?: string; mode?: string; fixtureId?: string; result?: { homeTeamId: string; awayTeamId: string; mode: 'best_of_5' | 'sudden_death'; homeScore: number; awayScore: number; winnerId: string | null; kicks: Array<{ teamId: string; outcome: 'goal' | 'saved' | 'miss' }>; rounds: number; } } | undefined;
  Tournament: undefined;
  Collection: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

// ─── Animated tab button ──────────────────────────────────────────────────────
function AnimatedTabButton(props: BottomTabBarButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const selected = !!props.accessibilityState?.selected;

  // Pulse on focus
  useEffect(() => {
    if (selected) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: 90,  useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.00, duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [selected]);

  return (
    <TouchableOpacity
      {...(props as any)}
      activeOpacity={0.8}
      style={[
        props.style,
        {
          flex: 1,
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
          overflow: 'visible',
        },
      ]}
      onPress={props.onPress}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {selected && (
          <View style={{
            position: 'absolute',
            top: 0,
            left: 8,
            right: 8,
            height: 3,
            backgroundColor: '#FACE43',
            borderBottomLeftRadius: 2,
            borderBottomRightRadius: 2,
          }} />
        )}
        <Animated.View style={{ transform: [{ scale }] }}>
          {props.children}
        </Animated.View>
      </View>
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
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 4,
          paddingBottom: 4,
        },
        tabBarLabelStyle: {
          fontFamily: FONTS.pixel,
          fontSize: 9,
          letterSpacing: 0.5,
          marginTop: 2,
          textAlign: 'center',
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 0,
          paddingBottom: 4,
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
        options={{
          tabBarLabel: 'Cup Fixture',
          tabBarIcon: ({ color, size }) => <FixturesIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Simulator"
        component={SimulatorScreen}
        options={{ tabBarIcon: ({ color, size }) => <SimulatorIcon color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Penalty"
        component={PenaltyMenuScreen}
        options={{ tabBarIcon: ({ color, size }) => <PenaltyIcon color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Tournament"
        component={TournamentScreen}
        options={{
          tabBarLabel: 'Road to Glory',
          tabBarIcon: ({ color, size }) => <TournamentIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Collection"
        component={CollectionScreen}
        options={{ tabBarIcon: ({ color, size }) => <CollectionIcon color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}
