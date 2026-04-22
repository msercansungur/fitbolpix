import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Animated,
} from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { BottomTabParamList } from '../navigation/BottomTabNavigator';
import { COLORS, SPACING, FONTS, RADIUS } from '../constants/theme';
import { NATIONS, NATIONS_BY_ID } from '../constants/nations';
import PageHeader from '../components/PageHeader';
import { Team } from '../types/simulator';
import { PENALTY_GAME_HTML } from '../assets/penalty-game/penaltyGame';
import { useMatchStore } from '../store/useMatchStore';

type Props = BottomTabScreenProps<BottomTabParamList, 'Penalty'>;

// ─── Kit colours for all 48 WC2026 nations ────────────────────────────────────
// Phaser hex format: 0xRRGGBB
const KIT_COLORS: Record<string, number> = {
  // Group A
  mex:  0x006847,   // Mexico — dark green
  rsa:  0x007A4D,   // South Africa — green
  kor:  0xC60C30,   // South Korea — red
  cze:  0xD7141A,   // Czech Republic — red
  // Group B
  can:  0xFF0000,   // Canada — red
  bih:  0x002395,   // Bosnia — blue
  qat:  0x8D1B3D,   // Qatar — maroon
  swi:  0xFF0000,   // Switzerland — red
  // Group C
  bra:  0xF7D116,   // Brazil — yellow
  mor:  0xC1272D,   // Morocco — red
  hai:  0x00209F,   // Haiti — blue
  sco:  0x003078,   // Scotland — dark blue
  // Group D
  usa:  0x002868,   // USA — navy
  par:  0xD52B1E,   // Paraguay — red
  aus:  0xFFD700,   // Australia — gold
  tur:  0xE30A17,   // Türkiye — red
  // Group E
  ger:  0xFFFFFF,   // Germany — white (will use alt colour in game)
  cur:  0x003DA5,   // Curaçao — blue
  civ:  0xF77F00,   // Ivory Coast — orange
  ecua: 0xFFD100,   // Ecuador — yellow
  // Group F
  ned:  0xFF6200,   // Netherlands — orange
  jpn:  0x002B7F,   // Japan — navy
  swe:  0x006AA7,   // Sweden — blue
  tun:  0xE70013,   // Tunisia — red
  // Group G
  bel:  0xED2939,   // Belgium — red
  egy:  0xC8102E,   // Egypt — red
  iri:  0x239F40,   // Iran — green
  nzl:  0x000000,   // New Zealand — black
  // Group H
  spa:  0xAA151B,   // Spain — red
  cpv:  0x003893,   // Cape Verde — blue
  ksa:  0x006C35,   // Saudi Arabia — green
  uru:  0x5EB6E4,   // Uruguay — sky blue
  // Group I
  fra:  0x002395,   // France — blue
  sen:  0x00853F,   // Senegal — green
  irq:  0x007A3D,   // Iraq — green
  nor:  0xEF2B2D,   // Norway — red
  // Group J
  arg:  0x74ACDF,   // Argentina — sky blue
  alg:  0x006233,   // Algeria — green
  aut:  0xED2939,   // Austria — red
  jor:  0x007A3D,   // Jordan — green
  // Group K
  por:  0x006600,   // Portugal — dark green
  cod:  0x007FFF,   // DR Congo — blue
  uzb:  0x1EB53A,   // Uzbekistan — green
  col:  0xFCD116,   // Colombia — yellow
  // Group L
  eng:  0xFFFFFF,   // England — white (will use alt colour in game)
  cro:  0xFF0000,   // Croatia — red
  gha:  0x006B3F,   // Ghana — green
  pan:  0xD21034,   // Panama — red
};

// ─── Build injected config string ─────────────────────────────────────────────
function buildConfig(
  home: Team,
  away: Team,
  mode: 'best_of_5' | 'sudden_death',
  userTeam: 'home' | 'away',
): string {
  const homeColor = KIT_COLORS[home.id] ?? 0xe74c3c;
  const awayColor = KIT_COLORS[away.id] ?? 0x3498db;
  const cfg = {
    homeTeam: {
      id:               home.id,
      name:             home.name,
      flag:             home.flag,
      kitColor:         homeColor,
      penalty_skill:    home.penalty_skill    ?? 65,
      goalkeeper_rating: home.goalkeeper_rating ?? 65,
    },
    awayTeam: {
      id:               away.id,
      name:             away.name,
      flag:             away.flag,
      kitColor:         awayColor,
      penalty_skill:    away.penalty_skill    ?? 65,
      goalkeeper_rating: away.goalkeeper_rating ?? 65,
    },
    mode,
    userTeam,
  };
  return `window.GAME_CONFIG = ${JSON.stringify(cfg)}; true;`;
}

// ─── Team picker sub-component ─────────────────────────────────────────────────
function TeamPicker({
  label,
  selected,
  onSelect,
  exclude,
}: {
  label:    string;
  selected: string | null;
  onSelect: (id: string) => void;
  exclude:  string | null;
}) {
  return (
    <View style={styles.pickerBlock}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <ScrollView style={styles.pickerList} nestedScrollEnabled>
        {NATIONS.map((t) => {
          const isSel = t.id === selected;
          const isExc = t.id === exclude;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.pickerItem, isSel && styles.pickerItemSel, isExc && styles.pickerItemDis]}
              onPress={() => !isExc && onSelect(t.id)}
              activeOpacity={isExc ? 1 : 0.7}
            >
              <Text style={styles.pickerFlag}>{t.flag}</Text>
              <Text style={[styles.pickerName, isSel && styles.pickerNameSel, isExc && styles.pickerNameDis]}>
                {t.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Pixel art icons ──────────────────────────────────────────────────────────

function GoalpostIcon({ color, size }: { color: string; size: number }) {
  const postW = 4, barH = 4;
  const postH = Math.floor(size * 0.6);
  const innerW = size - postW * 2;
  const netLines = 3;
  const netGap = (postH - barH) / (netLines + 1);
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {/* Crossbar */}
      <View style={{ width: size - 4, height: barH, backgroundColor: color, borderRadius: 1 }} />
      {/* Posts + net area */}
      <View style={{ flexDirection: 'row', width: size - 4, height: postH - barH }}>
        <View style={{ width: postW, backgroundColor: color }} />
        <View style={{ flex: 1, position: 'relative' }}>
          {Array.from({ length: netLines }).map((_, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                top: Math.floor(netGap * (i + 1)),
                left: 2, right: 2,
                height: 1,
                backgroundColor: 'rgba(255,255,255,0.18)',
              }}
            />
          ))}
        </View>
        <View style={{ width: postW, backgroundColor: color }} />
      </View>
    </View>
  );
}

const SKULL_GRID = [
  [0,1,1,1,1,1,0],
  [1,1,1,1,1,1,1],
  [1,0,1,1,1,0,1],
  [1,1,1,1,1,1,1],
  [1,1,0,1,0,1,1],
  [0,1,1,1,1,1,0],
  [0,1,0,1,0,1,0],
];

function SkullIcon({ size }: { size: number }) {
  const px = Math.floor(size / 7);
  return (
    <View style={{ width: px * 7, height: px * 7 }}>
      {SKULL_GRID.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((cell, c) => (
            <View key={c} style={{ width: px, height: px, backgroundColor: cell ? '#E8E8E8' : 'transparent' }} />
          ))}
        </View>
      ))}
    </View>
  );
}

const TROPHY_GRID = [
  [0,1,1,1,1,1,0],
  [0,1,1,1,1,1,0],
  [0,0,1,1,1,0,0],
  [0,0,1,1,1,0,0],
  [0,0,0,1,0,0,0],
  [0,0,0,1,0,0,0],
  [0,0,1,1,1,0,0],
  [0,1,1,1,1,1,0],
];

function TrophyIcon({ color, size }: { color: string; size: number }) {
  const px = Math.floor(size / 8);
  return (
    <View style={{ width: px * 7, height: px * 8 }}>
      {TROPHY_GRID.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((cell, c) => (
            <View key={c} style={{ width: px, height: px, backgroundColor: cell ? color : 'transparent' }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function PenaltyWebViewScreen({ route }: Props) {
  const paramHome = route.params?.homeTeamId ?? null;
  const paramAway = route.params?.awayTeamId ?? null;
  const paramMode = (route.params as any)?.mode ?? null;
  const paramFixture = (route.params as any)?.fixtureId ?? null;
  const paramFirstShooter = (route.params as any)?.firstShooter ?? 'home';

  const insets = useSafeAreaInsets();

  const navigation = useNavigation();

  const saveResult         = useMatchStore((s: any) => s.saveResult);
  const saveKnockoutResult = useMatchStore((s: any) => s.saveKnockoutResult);

  // ── Setup state ────────────────────────────────────────────────────────
  const [gameStarted,  setGameStarted]  = useState(
    !!(paramHome && paramAway),
  );
  const [pickedHome,   setPickedHome]   = useState<string | null>(paramHome);
  const [pickedAway,   setPickedAway]   = useState<string | null>(paramAway);
  const [mode,         setMode]         = useState<'best_of_5' | 'sudden_death'>(
    paramMode === 'sudden_death' ? 'sudden_death' : 'best_of_5',
  );
  const [selectedMode, setSelectedMode] = useState<'best_of_5' | 'sudden_death' | null>(
    paramMode === 'sudden_death' ? 'sudden_death' : paramMode === 'best_of_5' ? 'best_of_5' : null,
  );
  const [setupPhase,   setSetupPhase]   = useState<'mode' | 'teams'>(
    paramHome && paramAway ? 'teams' : 'mode',
  );
  const [webViewKey,   setWebViewKey]   = useState(0);

  // ── Loading overlay state ──────────────────────────────────────────────
  const [gameLoading, setGameLoading] = useState(true);
  const loadingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (gameLoading) {
      Animated.timing(loadingAnim, {
        toValue: 1,
        duration: 9000,
        useNativeDriver: false,
      }).start();
    }
  }, [gameLoading]);

  // ── WebView message handler ────────────────────────────────────────────
  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'result' && paramFixture) {
          // Save to match store when launched from fixtures/simulator
          const homeTeam = pickedHome ? NATIONS_BY_ID[pickedHome] : null;
          const awayTeam = pickedAway ? NATIONS_BY_ID[pickedAway] : null;
          if (homeTeam && awayTeam) {
            if (paramFixture.startsWith('ko-')) {
              const matchId = parseInt(paramFixture.replace('ko-', ''), 10);
              if (!isNaN(matchId)) {
                saveKnockoutResult({
                  matchId,
                  homeTeamId:  homeTeam.id,
                  awayTeamId:  awayTeam.id,
                  homeScore:   data.homeScore,
                  awayScore:   data.awayScore,
                  events:      [],
                  simulatedAt: Date.now(),
                });
              }
            } else {
              saveResult({
                fixtureId:   paramFixture,
                homeTeamId:  homeTeam.id,
                awayTeamId:  awayTeam.id,
                homeScore:   data.homeScore,
                awayScore:   data.awayScore,
                events:      [],
                simulatedAt: Date.now(),
              });
            }
          }
        } else if (data.type === 'restart') {
          setWebViewKey((k) => k + 1);
          setGameLoading(true);
          loadingAnim.setValue(0);
        } else if (data.type === 'back') {
        navigation.goBack();
        }
      } catch (_) {}
    },
    [paramFixture, pickedHome, pickedAway, saveResult, saveKnockoutResult],
  );

  // ── Config string injected before page loads ───────────────────────────
  const configScript = (() => {
    const home = pickedHome ? NATIONS_BY_ID[pickedHome] : null;
    const away = pickedAway ? NATIONS_BY_ID[pickedAway] : null;
    if (!home || !away) return 'true;';
    return buildConfig(home, away, mode, paramFirstShooter);
  })();

  // ── GAME RUNNING: WebView only ─────────────────────────────────────────
  if (gameStarted && pickedHome && pickedAway) {
    return (
      <SafeAreaView style={styles.gameRoot}>
        <View style={{ flex: 1, paddingBottom: insets.bottom }}>
          <WebView
            key={webViewKey}
            source={{ html: PENALTY_GAME_HTML }}
            style={styles.webview}
            javaScriptEnabled
            originWhitelist={['*']}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            injectedJavaScriptBeforeContentLoaded={configScript}
            onMessage={handleMessage}
            onLoadEnd={() => setGameLoading(false)}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          />
          {gameLoading && (
            <View style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: '#0B171F',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}>
              <Text style={{
                fontFamily: 'BarlowCondensed_700Bold',
                fontSize: 20,
                color: '#FACE43',
                letterSpacing: 3,
                marginBottom: 16,
              }}>LOADING MATCH...</Text>
              <View style={{
                width: 200,
                height: 4,
                backgroundColor: '#1C3948',
                borderRadius: 2,
                overflow: 'hidden',
              }}>
                <Animated.View style={{
                  height: 4,
                  backgroundColor: '#FACE43',
                  width: loadingAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                }} />
              </View>
              <Text style={{
                fontFamily: 'BarlowCondensed_700Bold',
                fontSize: 11,
                color: '#58788D',
                letterSpacing: 2,
                marginTop: 12,
              }}>WARMING UP PIXEL ENGINE...</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── SETUP: mode select ─────────────────────────────────────────────────
  if (setupPhase === 'mode') {
    return (
      <SafeAreaView style={styles.root}>
        <PageHeader icon="🥅" title="PENALTY SHOOTOUT" subtitle="Choose match format" />

        <View style={styles.modeContent}>
          <Text style={styles.modeSubtitle}>SELECT YOUR MODE</Text>

          {/* Card 1: Best of 5 */}
          <TouchableOpacity
            style={[styles.modeCard, selectedMode === 'best_of_5' && { borderColor: '#94C952' }]}
            onPress={() => setSelectedMode('best_of_5')}
            activeOpacity={0.8}
          >
            <GoalpostIcon color="#94C952" size={40} />
            <View style={styles.modeCardText}>
              <Text style={styles.modeCardTitle}>BEST OF 5</Text>
              <Text style={styles.modeCardSub}>5 kicks each — classic shootout</Text>
              <View style={[styles.modeTag, { backgroundColor: 'rgba(148,201,82,0.2)' }]}>
                <Text style={[styles.modeTagText, { color: '#94C952' }]}>CLASSIC</Text>
              </View>
            </View>
            {selectedMode === 'best_of_5' && (
              <Text style={[styles.modeCheck, { color: '#94C952' }]}>✓</Text>
            )}
          </TouchableOpacity>

          {/* Card 2: Sudden Death */}
          <TouchableOpacity
            style={[styles.modeCard, selectedMode === 'sudden_death' && { borderColor: '#C2340B' }]}
            onPress={() => setSelectedMode('sudden_death')}
            activeOpacity={0.8}
          >
            <SkullIcon size={40} />
            <View style={styles.modeCardText}>
              <Text style={styles.modeCardTitle}>SUDDEN DEATH</Text>
              <Text style={styles.modeCardSub}>One miss and it's over</Text>
              <View style={[styles.modeTag, { backgroundColor: 'rgba(194,52,11,0.2)' }]}>
                <Text style={[styles.modeTagText, { color: '#C2340B' }]}>INTENSE</Text>
              </View>
            </View>
            {selectedMode === 'sudden_death' && (
              <Text style={[styles.modeCheck, { color: '#C2340B' }]}>✓</Text>
            )}
          </TouchableOpacity>

          {/* Card 3: Historical (coming soon — disabled) */}
          <View style={[styles.modeCard, { opacity: 0.5 }]}>
            <TrophyIcon color="#FACE43" size={40} />
            <View style={styles.modeCardText}>
              <Text style={[styles.modeCardTitle, { color: COLORS.textMuted }]}>HISTORICAL</Text>
              <Text style={[styles.modeCardSub, { color: COLORS.textMuted }]}>Relive iconic WC shootouts</Text>
              <View style={[styles.modeTag, { backgroundColor: 'rgba(250,206,67,0.2)' }]}>
                <Text style={[styles.modeTagText, { color: '#FACE43' }]}>COMING SOON</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Next button */}
        <TouchableOpacity
          style={[styles.nextBtn, !selectedMode && styles.nextBtnDisabled]}
          disabled={!selectedMode}
          onPress={() => {
            if (selectedMode) {
              setMode(selectedMode);
              setSetupPhase('teams');
            }
          }}
          activeOpacity={selectedMode ? 0.8 : 1}
        >
          <Text style={[styles.nextBtnText, !selectedMode && styles.nextBtnTextDisabled]}>
            NEXT: PICK TEAMS ▶
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── SETUP: team select ─────────────────────────────────────────────────
  const canStart = pickedHome !== null && pickedAway !== null;
  return (
    <SafeAreaView style={styles.root}>
      <PageHeader
        icon="🥅"
        title="PENALTY SHOOTOUT"
        subtitle={`${mode === 'best_of_5' ? 'Best of 5' : 'Sudden Death'} · tap to change mode`}
      />

      <View style={styles.teamPickers}>
        <TeamPicker label="YOUR TEAM" selected={pickedHome} onSelect={setPickedHome} exclude={pickedAway} />
        <TeamPicker label="OPPONENT"  selected={pickedAway} onSelect={setPickedAway} exclude={pickedHome} />
      </View>

      <TouchableOpacity
        style={[styles.startBtn, !canStart && styles.startBtnDis]}
        onPress={() => canStart && setGameStarted(true)}
        activeOpacity={canStart ? 0.8 : 1}
      >
        <Text style={styles.startBtnText}>▶  START SHOOTOUT</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Root containers
  root: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  gameRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
  },

  // Mode select
  modeContent: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  modeSubtitle: {
    fontFamily: FONTS.pixel,
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  modeCard: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  modeCardText: {
    flex: 1,
    marginLeft: 16,
  },
  modeCardTitle: {
    fontFamily: FONTS.pixel,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  modeCardSub: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  modeTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 8,
  },
  modeTagText: {
    fontFamily: FONTS.pixel,
    fontSize: 9,
  },
  modeCheck: {
    position: 'absolute',
    top: 10,
    right: 14,
    fontSize: 18,
    fontFamily: FONTS.pixel,
  },
  nextBtn: {
    marginHorizontal: SPACING.md,
    marginBottom: 24,
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnDisabled: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  nextBtnText: {
    fontFamily: FONTS.pixel,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  nextBtnTextDisabled: {
    color: COLORS.textMuted,
  },

  // Team pickers
  teamPickers: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: SPACING.sm,
    gap: SPACING.sm,
  },
  pickerBlock: { flex: 1 },
  pickerLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  pickerList: {
    flex: 1,
    backgroundColor: COLORS.bgSurface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 6,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerItemSel: {
    backgroundColor: `${COLORS.primary}28`,
  },
  pickerItemDis: { opacity: 0.3 },
  pickerFlag:    { fontSize: 15 },
  pickerName: {
    fontSize: 11,
    color: COLORS.textSecondary,
    flex: 1,
  },
  pickerNameSel: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  pickerNameDis: { color: COLORS.textMuted },

  // Start button
  startBtn: {
    margin: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: SPACING.md,
    alignItems: 'center',
  },
  startBtnDis: {
    backgroundColor: COLORS.bgCardAlt,
  },
  startBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 1,
  },
});
