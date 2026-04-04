import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { BottomTabParamList } from '../navigation/BottomTabNavigator';
import { COLORS, SPACING, FONT_SIZE } from '../constants/theme';
import { NATIONS, NATIONS_BY_ID } from '../constants/nations';
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

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function PenaltyWebViewScreen({ route }: Props) {
  const paramHome = route.params?.homeTeamId ?? null;
  const paramAway = route.params?.awayTeamId ?? null;
  const paramMode = (route.params as any)?.mode ?? null;
  const paramFixture = (route.params as any)?.fixtureId ?? null;

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
  const [setupPhase,   setSetupPhase]   = useState<'mode' | 'teams'>(
    paramHome && paramAway ? 'teams' : 'mode',
  );
  const [webViewKey,   setWebViewKey]   = useState(0);

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
        } else if (data.type === 'back') {
          setGameStarted(false);
          setSetupPhase('mode');
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
    return buildConfig(home, away, mode, 'home');
  })();

  // ── GAME RUNNING: WebView only ─────────────────────────────────────────
  if (gameStarted && pickedHome && pickedAway) {
    return (
      <SafeAreaView style={styles.gameRoot}>
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
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    );
  }

  // ── SETUP: mode select ─────────────────────────────────────────────────
  if (setupPhase === 'mode') {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.pageTitle}>⚽ PENALTY SHOOTOUT</Text>
        <Text style={styles.pageSub}>Choose match format</Text>

        <View style={styles.modeButtons}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'best_of_5' && styles.modeBtnActive]}
            onPress={() => setMode('best_of_5')}
            activeOpacity={0.8}
          >
            <Text style={styles.modeBtnTitle}>BEST OF 5</Text>
            <Text style={styles.modeBtnSub}>5 kicks each — classic shootout</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeBtn, mode === 'sudden_death' && styles.modeBtnActive]}
            onPress={() => setMode('sudden_death')}
            activeOpacity={0.8}
          >
            <Text style={styles.modeBtnTitle}>SUDDEN DEATH</Text>
            <Text style={styles.modeBtnSub}>One miss and it's over</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.nextBtn}
          onPress={() => setSetupPhase('teams')}
          activeOpacity={0.8}
        >
          <Text style={styles.nextBtnText}>NEXT: PICK TEAMS ▶</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── SETUP: team select ─────────────────────────────────────────────────
  const canStart = pickedHome !== null && pickedAway !== null;
  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.pageTitle}>⚽ PENALTY SHOOTOUT</Text>
      <Text style={styles.pageSub}>
        {mode === 'best_of_5' ? 'Best of 5' : 'Sudden Death'} —
        <Text
          style={styles.changeMode}
          onPress={() => setSetupPhase('mode')}
        >
          {' '}change
        </Text>
      </Text>

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
    backgroundColor: COLORS.background,
  },
  gameRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
  },

  // Headers
  pageTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: SPACING.md,
    letterSpacing: 2,
  },
  pageSub: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  changeMode: {
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },

  // Mode select
  modeButtons: {
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  modeBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    padding: SPACING.md,
    alignItems: 'center',
  },
  modeBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}18`,
  },
  modeBtnTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  modeBtnSub: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  nextBtn: {
    margin: SPACING.md,
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: SPACING.md,
    alignItems: 'center',
  },
  nextBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 1,
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
    fontSize: FONT_SIZE.xs,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  pickerList: {
    flex: 1,
    backgroundColor: COLORS.surface,
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
    fontSize: FONT_SIZE.xs,
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
    backgroundColor: COLORS.surfaceAlt,
  },
  startBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 1,
  },
});
