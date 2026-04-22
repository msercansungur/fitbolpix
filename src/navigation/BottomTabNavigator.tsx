import React, { useRef, useEffect } from 'react';
import { Animated, View } from 'react-native';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

  useEffect(() => {
    if (selected) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: 90, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.00, duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [selected]);

  return (
    <TouchableOpacity
      {...(props as any)}
      activeOpacity={0.8}
      style={[props.style, {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 14,
        paddingBottom: 4,
      }]}
      onPress={props.onPress}
    >
      {selected && (
        <View style={{
          position: 'absolute',
          top: 0,
          width: 24,
          height: 3,
          backgroundColor: '#FACE43',
          borderBottomLeftRadius: 2,
          borderBottomRightRadius: 2,
        }} />
      )}
      <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
        {props.children}
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function BottomTabNavigator() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 72 + insets.bottom;
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: tabBarHeight,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        },
        tabBarBackground: () => (
          <LinearGradient
            colors={['transparent', '#060B10']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
            }}
          >
            <View style={{
              position: 'absolute',
              bottom: 8 + insets.bottom,
              left: 8,
              right: 8,
              top: 4,
              backgroundColor: '#0F2129',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#1C3948',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 1,
              shadowRadius: 0,
              elevation: 6,
            }} />
          </LinearGradient>
        ),
        tabBarActiveTintColor:   COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarItemStyle: {
          paddingTop: 0,
          paddingBottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarLabelStyle: {
          fontFamily: FONTS.pixel,
          fontSize: 9,
          letterSpacing: 0.5,
          marginTop: 2,
          textAlign: 'center',
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
