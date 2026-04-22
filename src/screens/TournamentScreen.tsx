import React, { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  Animated,
  Dimensions,
  Alert,
  Share,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { BottomTabParamList } from '../navigation/BottomTabNavigator';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, PIXEL_SHADOW } from '../theme';
import { cardGreen, cardTeal, cardRed, cardGold } from '../theme/gradients';
import { NATIONS, NATIONS_BY_ID } from '../constants/nations';
import { GROUP_FIXTURES } from '../constants/fixtures';
import { useTournamentMatchStore, selectTournamentStandings } from '../store/useTournamentMatchStore';
import { useTournamentStore } from '../store/useTournamentStore';
import { resolveKnockoutBracket, getBestThirdPlacers } from '../utils/knockoutEngine';
import { simulateMatch, computeScore } from '../utils/simulator';
import { TeamStanding } from '../types/matchResult';
import { KnockoutRound } from '../types/knockout';
import { Team } from '../types/simulator';
import PixelFlag from '../components/PixelFlag';
import KnockoutBracket from '../components/KnockoutBracket';
import { animateScore } from '../utils/scoreAnimation';
import { PENALTY_GAME_HTML } from '../assets/penalty-game/penaltyGame';
import { getMatchSimHTML, MatchSimConfig } from '../assets/match-sim/matchSim';
import { resolveKitColors } from '../utils/kitColors';

type Props = BottomTabScreenProps<BottomTabParamList, 'Tournament'>;

// ─── Kit colours for penalty/sim WebView config ──────────────────────────────
const KIT_COLORS: Record<string, number> = {
  mex:0x006847,rsa:0x007A4D,kor:0xC60C30,cze:0xD7141A,
  can:0xFF0000,bih:0x002395,qat:0x8D1B3D,swi:0xFF0000,
  bra:0xF7D116,mor:0xC1272D,hai:0x00209F,sco:0x003078,
  usa:0x002868,par:0xD52B1E,aus:0xFFD700,tur:0xE30A17,
  ger:0xFFFFFF,cur:0x003DA5,civ:0xF77F00,ecua:0xFFD100,
  ned:0xFF6200,jpn:0x002B7F,swe:0x006AA7,tun:0xE70013,
  bel:0xED2939,egy:0xC8102E,iri:0x239F40,nzl:0x000000,
  spa:0xAA151B,cpv:0x003893,ksa:0x006C35,uru:0x5EB6E4,
  fra:0x002395,sen:0x00853F,irq:0x007A3D,nor:0xEF2B2D,
  arg:0x74ACDF,alg:0x006233,aut:0xED2939,jor:0x007A3D,
  por:0x006600,cod:0x007FFF,uzb:0x1EB53A,col:0xFCD116,
  eng:0xFFFFFF,cro:0xFF0000,gha:0x006B3F,pan:0xD21034,
};

function buildPenaltyConfig(home: Team, away: Team, mode: 'best_of_5' | 'sudden_death' | 'best_of_5_draw', userTeam: 'home' | 'away'): string {
  const { homeColor, awayColor } = resolveKitColors(home.id, away.id, KIT_COLORS);
  const cfg = {
    homeTeam: { id:home.id, name:home.name, flag:home.flag, kitColor:homeColor, penalty_skill:home.penalty_skill??65, goalkeeper_rating:home.goalkeeper_rating??65 },
    awayTeam: { id:away.id, name:away.name, flag:away.flag, kitColor:awayColor, penalty_skill:away.penalty_skill??65, goalkeeper_rating:away.goalkeeper_rating??65 },
    mode, userTeam,
  };
  return `window.GAME_CONFIG = ${JSON.stringify(cfg)}; true;`;
}

function buildSimConfig(home: Team, away: Team): { html: string; events: ReturnType<typeof simulateMatch>; score: { home: number; away: number } } {
  const events = simulateMatch(home, away, 'en');
  const score  = computeScore(events, home.id, away.id);
  const { homeColor, awayColor } = resolveKitColors(home.id, away.id, KIT_COLORS);
  const config: MatchSimConfig = {
    homeId: home.id, homeName: home.name, homeCode: home.code3,
    homeColor, homeStrength: home.strength, homeFormation: home.formation ?? '4-4-2',
    awayId: away.id, awayName: away.name, awayCode: away.code3,
    awayColor, awayStrength: away.strength, awayFormation: away.formation ?? '4-4-2',
    events: events.map((e) => ({ type: e.type, teamId: e.teamId, minute: e.minute })),
    seed: Date.now() % 99991,
  };
  return { html: getMatchSimHTML(config), events, score };
}

// ─── Overlay state types ─────────────────────────────────────────────────────
type PenaltyOverlay = {
  key: string;
  homeTeamId: string;
  awayTeamId: string;
  mode: 'best_of_5' | 'sudden_death' | 'best_of_5_draw';
  userTeam: 'home' | 'away';
  fixtureId?: string;
  matchId?: number;
};

type SimOverlay = {
  key: string;
  homeTeamId: string;
  awayTeamId: string;
  html: string;
  fixtureId?: string;
  matchId?: number;
  simScore: { home: number; away: number };
  simEvents: import('../types/simulator').MatchEvent[];
  contextLabel?: string;
  teamsLabel?: string;
};

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Round display labels ─────────────────────────────────────────────────────
const ROUND_LABELS: Record<string, string> = {
  R32: 'ROUND OF 32',
  R16: 'ROUND OF 16',
  QF:  'QUARTER-FINAL',
  SF:  'SEMI-FINAL',
  '3rd': 'THIRD PLACE',
  Final: 'THE FINAL',
};

// ─── Champion phrases (per nation) ────────────────────────────────────────────
const CHAMPION_PHRASES: Record<string, { local: string; en: string }> = {
  tur: { local: 'Bizim çocuklar kazandı! 🏆',                         en: 'Our boys won it all!' },
  eng: { local: "Football's coming home! 🏆",                          en: 'England are world champions!' },
  arg: { local: '¡Muchachos, ahora nos volvimos a ilusionar! 🏆',      en: 'Argentina are world champions!' },
  bra: { local: 'É campeão! 🏆',                                       en: 'Brazil are world champions!' },
  spa: { local: '¡Campeones del mundo! 🏆',                            en: 'Spain are world champions!' },
  fra: { local: 'Ramenez la coupe à la maison! 🏆',                    en: 'France are world champions!' },
  ger: { local: 'Deutschland ist Weltmeister! 🏆',                     en: 'Germany are world champions!' },
};
const GENERIC_PHRASE = { local: 'We are the champions! 🏆', en: 'World Champions of 2026!' };

// ─── ELO bounds (difficulty dot mapping) ──────────────────────────────────────
const ELO_MIN = 1250;
const ELO_MAX = 1950;

function strengthToStars(strength: number): number {
  const clamped = Math.max(ELO_MIN, Math.min(ELO_MAX, strength));
  return Math.max(1, Math.min(5, Math.round((clamped - ELO_MIN) / 140)));
}

function DifficultyDots({ strength, dotSize = 4 }: { strength: number; dotSize?: number }) {
  const n = strengthToStars(strength);
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: i < n ? COLORS.gold : COLORS.border,
          }}
        />
      ))}
    </View>
  );
}

// ─── Pixel glyph (6×6) ────────────────────────────────────────────────────────
type GlyphKind = 'trophy' | 'ball' | 'check' | 'cross' | 'star' | 'shield' | 'flag' | 'search' | 'chevLeft' | 'chevRight';
const GLYPHS: Record<GlyphKind, string[]> = {
  trophy:    ['111111','011110','011110','001100','011110','111111'],
  ball:      ['011110','110011','101101','101101','110011','011110'],
  check:     ['000001','000011','100110','111100','011000','010000'],
  cross:     ['110011','111110','011100','011100','111110','110011'],
  star:      ['001100','001100','111111','011110','011110','110011'],
  shield:    ['111111','110011','100001','101101','110011','011110'],
  flag:      ['111110','110010','111110','100000','100000','100000'],
  search:    ['011100','110110','110110','011100','000110','000011'],
  chevLeft:  ['000001','000011','000110','000110','000011','000001'],
  chevRight: ['100000','110000','011000','011000','110000','100000'],
};

function PixelGlyph({ kind, color, px = 2 }: { kind: GlyphKind; color: string; px?: number }) {
  return (
    <View style={{ width: px * 6, height: px * 6 }}>
      {GLYPHS[kind].map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.split('').map((c, ci) => (
            <View key={ci} style={{ width: px, height: px, backgroundColor: c === '1' ? color : 'transparent' }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Pixel trophy (16×18) ─────────────────────────────────────────────────────
const PIXEL_TROPHY = [
  '0011111111111100','0111111111111110','1100111111110011','1100111111110011',
  '1100111111110011','0110011111100110','0011001111001100','0000011111100000',
  '0000001111000000','0000001111000000','0000001111000000','0000011111100000',
  '0000111111110000','0001111111111000','0011111111111100','0111111111111110',
  '1111111111111111','1111111111111111',
];

function PixelTrophy({ size = 3 }: { size?: number }) {
  return (
    <View style={{ width: size * 16, height: size * 18 }}>
      {PIXEL_TROPHY.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.split('').map((c, ci) => (
            <View
              key={ci}
              style={{
                width: size,
                height: size,
                backgroundColor: c === '1' ? (ci < 3 || ci > 12 ? '#B98F1A' : COLORS.gold) : 'transparent',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Confetti (winner screen) ─────────────────────────────────────────────────
const CONFETTI_COLORS = [COLORS.gold, '#94C952', COLORS.teal, COLORS.red, '#F0F4F7', '#FF88FF'];
function Confetti() {
  const pieces = useRef(
    Array.from({ length: 28 }, (_, i) => ({
      x:     Math.random() * SCREEN_W,
      y:     new Animated.Value(-20 - Math.random() * 100),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size:  5 + Math.floor(Math.random() * 7),
      delay: i * 70,
    })),
  ).current;

  useEffect(() => {
    const anims = pieces.map((p) =>
      Animated.loop(
        Animated.timing(p.y, {
          toValue: 900,
          duration: 2200 + Math.random() * 1500,
          delay: p.delay,
          useNativeDriver: true,
        }),
      ),
    );
    Animated.parallel(anims).start();
    return () => anims.forEach((a) => a.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            transform: [{ translateY: p.y }],
          }}
        />
      ))}
    </View>
  );
}

// ─── Reusable top bar (Screens 2,3,4) ─────────────────────────────────────────
function TopBar({
  title, subtitle, onBack, right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.topBar}>
      {onBack && (
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.topBarBack}>
          <PixelGlyph kind="chevLeft" color={COLORS.textSecondary} px={2} />
        </TouchableOpacity>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.topBarTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.topBarSub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

// ─── Section header with dashed rule ──────────────────────────────────────────
function SectionHeader({
  icon, title, right,
}: {
  icon?: GlyphKind;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      {icon && <PixelGlyph kind={icon} color={COLORS.gold} px={2} />}
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      <View style={styles.sectionHeaderRule} />
      {right}
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Screen 2 — Standings row
// ═════════════════════════════════════════════════════════════════════════════
function StandingsRow({
  row, pos, isUser, qualifies, last,
}: {
  row: TeamStanding;
  pos: number;
  isUser: boolean;
  qualifies: boolean;
  last: boolean;
}) {
  const team = NATIONS_BY_ID[row.teamId];
  const gd   = row.goalsFor - row.goalsAgainst;
  return (
    <View style={[styles.standRow, !last && styles.standRowBorder]}>
      {qualifies && <View style={styles.standQualBar} />}
      <Text style={[
        styles.standPos,
        qualifies && { color: COLORS.green, fontWeight: '800' },
        isUser && !qualifies && { color: COLORS.gold },
      ]}>
        {pos}
      </Text>
      <View style={styles.standTeamCell}>
        {team && <PixelFlag isoCode={team.isoCode} size={16} />}
        <Text
          style={[styles.standName, isUser && styles.standNameUser]}
          numberOfLines={1}
        >
          {team?.code3 ?? row.teamId.toUpperCase()}
        </Text>
        {isUser && <Text style={styles.standMarker}>◂</Text>}
      </View>
      <Text style={styles.standStat}>{row.played}</Text>
      <Text style={styles.standStat}>{row.won}</Text>
      <Text style={styles.standStat}>{row.drawn}</Text>
      <Text style={styles.standStat}>{row.lost}</Text>
      <Text style={[styles.standStat, gd < 0 && { color: COLORS.textMuted }]}>
        {gd > 0 ? '+' : ''}{gd}
      </Text>
      <Text style={[styles.standPts, isUser && { color: COLORS.gold }]}>{row.points}</Text>
    </View>
  );
}

// ─── Screen 2 — Match card ────────────────────────────────────────────────────
function GroupMatchCard({
  fixture, homeTeam, awayTeam, result, isUserHome, isAnimating,
  selectedNationId, onQuickSim, onLongSim, onPenalties, locked,
}: {
  fixture: typeof GROUP_FIXTURES[number];
  homeTeam: import('../types/simulator').Team | undefined;
  awayTeam: import('../types/simulator').Team | undefined;
  result: import('../types/matchResult').MatchResult | null;
  isUserHome: boolean;
  isAnimating: boolean;
  selectedNationId: string;
  onQuickSim: () => void;
  onLongSim: () => void;
  onPenalties: () => void;
  locked: boolean;
}) {
  const [dispHome, setDispHome] = useState(result?.homeScore ?? 0);
  const [dispAway, setDispAway] = useState(result?.awayScore ?? 0);

  useEffect(() => {
    if (!result) { setDispHome(0); setDispAway(0); return; }
    if (isAnimating) {
      const c1 = animateScore(result.homeScore, setDispHome);
      const c2 = animateScore(result.awayScore, setDispAway);
      return () => { c1(); c2(); };
    } else {
      setDispHome(result.homeScore);
      setDispAway(result.awayScore);
    }
  }, [result?.homeScore, result?.awayScore, isAnimating]);

  if (!homeTeam || !awayTeam) return null;

  const isPlayed    = !!result;
  const userScore   = result ? (isUserHome ? result.homeScore : result.awayScore) : 0;
  const oppScore    = result ? (isUserHome ? result.awayScore : result.homeScore) : 0;
  const won         = isPlayed && userScore > oppScore;
  const lost        = isPlayed && userScore < oppScore;
  const resultLabel = isPlayed ? (won ? 'WIN' : lost ? 'LOSS' : 'DRAW') : '';
  const resultColor = won ? '#94C952' : lost ? COLORS.red : COLORS.textSecondary;
  const borderColor = isPlayed ? (won ? COLORS.green : lost ? COLORS.red : COLORS.border) : COLORS.border;

  return (
    <View style={[styles.matchShadow]}>
      <View style={[styles.matchCard, { borderColor }]}>
        <View style={styles.matchCardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.mdBadge}>
              <Text style={styles.mdBadgeText}>MD {fixture.matchday}</Text>
            </View>
            <Text style={styles.matchVenue} numberOfLines={1}>{fixture.venue}</Text>
          </View>
          {isPlayed ? (
            <View style={[
              styles.resultPill,
              { backgroundColor: won ? 'rgba(148,201,82,0.15)' : lost ? 'rgba(194,52,11,0.15)' : 'rgba(148,176,192,0.1)',
                borderColor: won ? COLORS.green : lost ? COLORS.red : COLORS.border },
            ]}>
              <Text style={[styles.resultPillText, { color: resultColor }]}>{resultLabel}</Text>
            </View>
          ) : (
            <Text style={styles.matchDate}>{fixture.date}</Text>
          )}
        </View>

        <View style={styles.matchTeamsRow}>
          <View style={[styles.matchTeamSide, { justifyContent: 'flex-end' }]}>
            <Text
              style={[styles.matchTeamName, homeTeam.id === selectedNationId && styles.matchTeamNameUser]}
              numberOfLines={1}
            >
              {homeTeam.code3}
            </Text>
            <PixelFlag isoCode={homeTeam.isoCode} size={22} />
          </View>
          <View style={styles.matchScoreBox}>
            {isPlayed ? (
              <Text style={styles.matchScore}>{dispHome}<Text style={styles.matchScoreDash}>–</Text>{dispAway}</Text>
            ) : (
              <Text style={styles.matchVs}>VS</Text>
            )}
          </View>
          <View style={[styles.matchTeamSide, { justifyContent: 'flex-start' }]}>
            <PixelFlag isoCode={awayTeam.isoCode} size={22} />
            <Text
              style={[styles.matchTeamName, awayTeam.id === selectedNationId && styles.matchTeamNameUser]}
              numberOfLines={1}
            >
              {awayTeam.code3}
            </Text>
          </View>
        </View>

        {!isPlayed && !locked && (
          <View style={styles.matchBtns}>
            <TouchableOpacity style={styles.simBtnOutline} onPress={onLongSim} activeOpacity={0.8}>
              <Text style={styles.simBtnOutlineText}>LONG SIM</Text>
              <Text style={styles.simBtnSub}>Watch</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.simBtnGold} onPress={onQuickSim} activeOpacity={0.8}>
              <Text style={styles.simBtnGoldText}>QUICK</Text>
              <Text style={[styles.simBtnSub, { color: 'rgba(11,23,31,0.7)' }]}>Instant</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.simBtnTeal} onPress={onPenalties} activeOpacity={0.8}>
              <Text style={styles.simBtnTealText}>PENALTY</Text>
              <Text style={[styles.simBtnSub, { color: COLORS.teal }]}>Shootout</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isPlayed && locked && (
          <View style={styles.matchLockedRow}>
            <Text style={styles.matchLockedText}>🔒 Play previous matchday first</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Stat block (Screen 4) ────────────────────────────────────────────────────
function StatBlock({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={[styles.statBlockValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.statBlockLabel}>{label}</Text>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Main screen
// ═════════════════════════════════════════════════════════════════════════════
export default function TournamentScreen(_props: Props) {
  const insets = useSafeAreaInsets();
  // ── Stores ──────────────────────────────────────────────────────────────
  const {
    isActive, hasWon, isEliminated, eliminatedAt, eliminatedBy,
    selectedNationId,
    startTournament, setEliminated, setWon, resetTournament,
  } = useTournamentStore();

  const results          = useTournamentMatchStore((s) => s.results);
  const standings        = useTournamentMatchStore((s) => s.standings);
  const knockoutResults  = useTournamentMatchStore((s) => s.knockoutResults);
  const clearAllKnockoutResults = useTournamentMatchStore((s) => s.clearAllKnockoutResults);
  const clearAllResults         = useTournamentMatchStore((s) => s.clearAll);

  // ── Derived nation data ──────────────────────────────────────────────────
  const userNation = selectedNationId ? NATIONS_BY_ID[selectedNationId] : null;
  const userGroup  = userNation?.group ?? null;

  // ── Group fixtures for user's 3 matches ─────────────────────────────────
  const userGroupFixtures = useMemo(() =>
    userGroup
      ? GROUP_FIXTURES.filter(
          (f) => f.group === userGroup &&
            (f.homeTeamId === selectedNationId || f.awayTeamId === selectedNationId),
        )
      : [],
    [userGroup, selectedNationId],
  );

  const allUserGroupPlayed = userGroupFixtures.every((f) => f.id in results);

  const groupStandings = useMemo(() =>
    userGroup ? selectTournamentStandings(standings, userGroup) : [],
    [standings, userGroup],
  );

  const userPosition = useMemo(() =>
    groupStandings.findIndex((s) => s.teamId === selectedNationId) + 1,
    [groupStandings, selectedNationId],
  );

  const qualificationStatus = useMemo((): 'qualified' | 'eliminated' | 'pending' => {
    if (!allUserGroupPlayed) return 'pending';
    if (userPosition <= 2) return 'qualified';
    if (userPosition === 4) return 'eliminated';
    const best8 = getBestThirdPlacers(standings, results);
    if (best8 === null) return 'pending';
    return best8.some((t: { teamId: string }) => t.teamId === selectedNationId) ? 'qualified' : 'eliminated';
  }, [allUserGroupPlayed, userPosition, standings, results, selectedNationId]);

  const resolvedBracket = useMemo(
    () => resolveKnockoutBracket(standings, results, knockoutResults),
    [standings, results, knockoutResults],
  );

  const userNextMatch = useMemo(() => {
    if (!selectedNationId) return null;
    return resolvedBracket.find(
      (m) =>
        (m.homeTeamId === selectedNationId || m.awayTeamId === selectedNationId) &&
        m.result === null,
    ) ?? null;
  }, [resolvedBracket, selectedNationId]);

  const userLastKnockoutMatch = useMemo(() => {
    if (!selectedNationId) return null;
    return resolvedBracket
      .filter(
        (m) =>
          m.result !== null &&
          (m.result.homeTeamId === selectedNationId || m.result.awayTeamId === selectedNationId),
      )
      .pop() ?? null;
  }, [resolvedBracket, selectedNationId]);

  useEffect(() => {
    if (!isActive || isEliminated || hasWon || !selectedNationId) return;
    if (!allUserGroupPlayed) return;
    if (qualificationStatus === 'eliminated') {
      setEliminated('groups', '');
      return;
    }
    if (!userLastKnockoutMatch?.result) return;
    const r = userLastKnockoutMatch.result;
    const userIsHome = r.homeTeamId === selectedNationId;
    const userScore  = userIsHome ? r.homeScore : r.awayScore;
    const oppScore   = userIsHome ? r.awayScore : r.homeScore;
    const oppId      = userIsHome ? r.awayTeamId : r.homeTeamId;
    if (userScore < oppScore) {
      const round = userLastKnockoutMatch.def.round as KnockoutRound;
      setEliminated(round, oppId);
    } else if (userLastKnockoutMatch.def.round === 'Final' && userScore > oppScore) {
      setWon();
    }
  }, [userLastKnockoutMatch, qualificationStatus, allUserGroupPlayed, isActive, isEliminated, hasWon]);

  // ── Helper: sim all remaining group fixtures (excluding user's own) ─────
  function simMissingGroupFixtures() {
    const freshResults   = useTournamentMatchStore.getState().results;
    const userFixtureIds = new Set((userGroupFixtures ?? []).map((f) => f.id));
    const missing = GROUP_FIXTURES.filter(
      (f) => !(f.id in freshResults) && !userFixtureIds.has(f.id),
    );
    if (missing.length === 0) return;
    for (const f of missing) {
      const h = NATIONS_BY_ID[f.homeTeamId];
      const a = NATIONS_BY_ID[f.awayTeamId];
      if (!h || !a) continue;
      const evts = simulateMatch(h, a, 'en');
      const sc   = computeScore(evts, h.id, a.id);
      useTournamentMatchStore.getState().saveResult({
        fixtureId: f.id, homeTeamId: h.id, awayTeamId: a.id,
        homeScore: sc.home, awayScore: sc.away, events: evts, simulatedAt: Date.now(),
      });
    }
  }

  const inKnockoutPhase = qualificationStatus === 'qualified' && allUserGroupPlayed;
  const safetyNetRanRef = useRef(false);
  useEffect(() => {
    if (!inKnockoutPhase) return;
    if (safetyNetRanRef.current) return;
    safetyNetRanRef.current = true;
    simMissingGroupFixtures();
  }, [inKnockoutPhase]);

  const thirdPlaceAutoRanRef = useRef(false);
  const userFinishedThird = allUserGroupPlayed && userPosition === 3;
  useEffect(() => {
    if (!userFinishedThird) return;
    if (thirdPlaceAutoRanRef.current) return;
    thirdPlaceAutoRanRef.current = true;
    simMissingGroupFixtures();
  }, [userFinishedThird]);

  // ── Action: simulate a group match ──────────────────────────────────────
  const handleSimulateGroup = useCallback((fixtureId: string) => {
    const fixture = GROUP_FIXTURES.find((f) => f.id === fixtureId);
    if (!fixture) return;
    const home = NATIONS_BY_ID[fixture.homeTeamId];
    const away = NATIONS_BY_ID[fixture.awayTeamId];
    if (!home || !away) return;

    const events = simulateMatch(home, away, 'en');
    const score  = computeScore(events, home.id, away.id);
    useTournamentMatchStore.getState().saveResult({
      fixtureId,
      homeTeamId:  home.id,
      awayTeamId:  away.id,
      homeScore:   score.home,
      awayScore:   score.away,
      events,
      simulatedAt: Date.now(),
    });

    const freshResults   = useTournamentMatchStore.getState().results;
    const userFixtureIds = new Set(userGroupFixtures.map((f) => f.id));
    const remaining      = GROUP_FIXTURES.filter(
      (f) => !(f.id in freshResults) && !userFixtureIds.has(f.id),
    );
    for (const f of remaining) {
      const h = NATIONS_BY_ID[f.homeTeamId];
      const a = NATIONS_BY_ID[f.awayTeamId];
      if (!h || !a) continue;
      const evts = simulateMatch(h, a, 'en');
      const sc   = computeScore(evts, h.id, a.id);
      useTournamentMatchStore.getState().saveResult({
        fixtureId: f.id, homeTeamId: h.id, awayTeamId: a.id,
        homeScore: sc.home, awayScore: sc.away, events: evts, simulatedAt: Date.now(),
      });
    }
  }, [userGroupFixtures]);

  // ── Action: simulate a knockout match ───────────────────────────────────
  const handleSimulateKnockout = useCallback(() => {
    if (!userNextMatch) return;
    const { def, homeTeamId, awayTeamId } = userNextMatch;
    if (!homeTeamId || !awayTeamId) return;
    const home = NATIONS_BY_ID[homeTeamId];
    const away = NATIONS_BY_ID[awayTeamId];
    if (!home || !away) return;
    const events = simulateMatch(home, away, 'en');
    const score  = computeScore(events, home.id, away.id);
    const finalHome = score.home === score.away ? score.home + 1 : score.home;
    useTournamentMatchStore.getState().saveKnockoutResult({
      matchId:    def.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      homeScore:  finalHome,
      awayScore:  score.away,
      events,
      simulatedAt: Date.now(),
    });

    for (let pass = 0; pass < 32; pass++) {
      const s        = useTournamentMatchStore.getState();
      const resolved = resolveKnockoutBracket(s.standings, s.results, s.knockoutResults);
      let simmedAny  = false;
      for (const match of resolved) {
        if (
          match.homeTeamId && match.awayTeamId &&
          !s.knockoutResults[match.def.id] &&
          match.homeTeamId !== selectedNationId &&
          match.awayTeamId !== selectedNationId
        ) {
          const h = NATIONS_BY_ID[match.homeTeamId];
          const a = NATIONS_BY_ID[match.awayTeamId];
          if (!h || !a) continue;
          const evts = simulateMatch(h, a, 'en');
          const sc   = computeScore(evts, h.id, a.id);
          const hs   = sc.home === sc.away ? sc.home + 1 : sc.home;
          useTournamentMatchStore.getState().saveKnockoutResult({
            matchId:    match.def.id,
            homeTeamId: h.id,
            awayTeamId: a.id,
            homeScore:  hs,
            awayScore:  sc.away,
            events:     evts,
            simulatedAt: Date.now(),
          });
          simmedAny = true;
        }
      }
      if (!simmedAny) break;
    }
  }, [userNextMatch, selectedNationId]);

  const [justSimmedGroupId, setJustSimmedGroupId] = useState<string | null>(null);

  const handleSimulateGroupAnimated = useCallback((fixtureId: string) => {
    handleSimulateGroup(fixtureId);
    setJustSimmedGroupId(fixtureId);
    setTimeout(() => setJustSimmedGroupId(null), 700);
  }, [handleSimulateGroup]);

  // ── Share result ──────────────────────────────────────────────────────────
  const handleShare = useCallback(async (nationId: string, nationName: string) => {
    try {
      const phrase = CHAMPION_PHRASES[nationId] ?? GENERIC_PHRASE;
      await Share.share({
        message:
          `🏆 I just won the 2026 World Football Championship with ${nationName} on FiTBOLPiX!\n` +
          `${phrase.local}\n` +
          `#FiTBOLPiX #Cup26`,
      });
    } catch (_) {}
  }, []);

  // ── Action: start tournament ─────────────────────────────────────────────
  const [pickedNation, setPickedNation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery]   = useState('');

  const filteredNations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return NATIONS;
    return NATIONS.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.code3.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q) ||
        n.group.toLowerCase() === q,
    );
  }, [searchQuery]);

  const handleBeginJourney = useCallback(() => {
    if (!pickedNation) return;
    const nation = NATIONS_BY_ID[pickedNation];
    if (!nation) return;
    clearAllResults();
    clearAllKnockoutResults();
    startTournament(pickedNation);
  }, [pickedNation, clearAllResults, clearAllKnockoutResults, startTournament]);

  const handleReset = useCallback(() => {
    clearAllResults();
    clearAllKnockoutResults();
    resetTournament();
    setPickedNation(null);
  }, [clearAllResults, clearAllKnockoutResults, resetTournament]);

  const handleStartOver = useCallback(() => {
    Alert.alert(
      'Start over?',
      'Your tournament progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Over',
          style: 'destructive',
          onPress: () => {
            clearAllResults();
            clearAllKnockoutResults();
            resetTournament();
            setPickedNation(null);
          },
        },
      ],
    );
  }, [clearAllResults, clearAllKnockoutResults, resetTournament]);

  // ── Overlay state ─────────────────────────────────────────────────────────
  const [penOverlay, setPenOverlay] = useState<PenaltyOverlay | null>(null);
  const [simOverlay, setSimOverlay] = useState<SimOverlay | null>(null);

  // ── KO sub-tab state ──────────────────────────────────────────────────────
  const [koTab, setKoTab] = useState<'tree' | 'match'>('match');

  const autoSimKnockout = useCallback(() => {
    for (let pass = 0; pass < 32; pass++) {
      const s        = useTournamentMatchStore.getState();
      const resolved = resolveKnockoutBracket(s.standings, s.results, s.knockoutResults);
      let simmedAny  = false;
      for (const match of resolved) {
        if (
          match.homeTeamId && match.awayTeamId &&
          !s.knockoutResults[match.def.id] &&
          match.homeTeamId !== selectedNationId &&
          match.awayTeamId !== selectedNationId
        ) {
          const h = NATIONS_BY_ID[match.homeTeamId];
          const a = NATIONS_BY_ID[match.awayTeamId];
          if (!h || !a) continue;
          const evts = simulateMatch(h, a, 'en');
          const sc   = computeScore(evts, h.id, a.id);
          const hs   = sc.home === sc.away ? sc.home + 1 : sc.home;
          useTournamentMatchStore.getState().saveKnockoutResult({
            matchId: match.def.id, homeTeamId: h.id, awayTeamId: a.id,
            homeScore: hs, awayScore: sc.away, events: evts, simulatedAt: Date.now(),
          });
          simmedAny = true;
        }
      }
      if (!simmedAny) break;
    }
  }, [selectedNationId]);

  // ── Finish tournament: sim every remaining KO match (incl. any involving
  // the user — e.g. the 3rd-place match when the user lost in the SF), then
  // transition to the Champion screen. Same Quick Sim logic as handleSimulateKnockout.
  const handleFinishTournament = useCallback(() => {
    for (let pass = 0; pass < 32; pass++) {
      const s        = useTournamentMatchStore.getState();
      const resolved = resolveKnockoutBracket(s.standings, s.results, s.knockoutResults);
      let simmedAny  = false;
      for (const match of resolved) {
        if (
          match.homeTeamId && match.awayTeamId &&
          !s.knockoutResults[match.def.id]
        ) {
          const h = NATIONS_BY_ID[match.homeTeamId];
          const a = NATIONS_BY_ID[match.awayTeamId];
          if (!h || !a) continue;
          const evts = simulateMatch(h, a, 'en');
          const sc   = computeScore(evts, h.id, a.id);
          const hs   = sc.home === sc.away ? sc.home + 1 : sc.home;
          useTournamentMatchStore.getState().saveKnockoutResult({
            matchId: match.def.id, homeTeamId: h.id, awayTeamId: a.id,
            homeScore: hs, awayScore: sc.away, events: evts, simulatedAt: Date.now(),
          });
          simmedAny = true;
        }
      }
      if (!simmedAny) break;
    }
    setWon();
  }, [setWon]);

  const handleGroupLongSim = useCallback((fixtureId: string) => {
    const fixture = GROUP_FIXTURES.find((f) => f.id === fixtureId);
    if (!fixture) return;
    const home = NATIONS_BY_ID[fixture.homeTeamId];
    const away = NATIONS_BY_ID[fixture.awayTeamId];
    if (!home || !away) return;
    const { html, events, score } = buildSimConfig(home, away);
    setSimOverlay({
      key: `sim-grp-${fixtureId}-${Date.now()}`,
      homeTeamId: home.id, awayTeamId: away.id,
      html, fixtureId, simScore: score, simEvents: events,
      contextLabel: `GROUP ${fixture.group} · MATCHDAY ${fixture.matchday}`,
      teamsLabel: `${home.code3} vs ${away.code3}`,
    });
  }, []);

  const handleGroupPenalties = useCallback((fixtureId: string) => {
    const fixture = GROUP_FIXTURES.find((f) => f.id === fixtureId);
    if (!fixture) return;
    const userIsHome = fixture.homeTeamId === selectedNationId;
    setPenOverlay({
      key: `pen-grp-${fixtureId}-${Date.now()}`,
      homeTeamId: fixture.homeTeamId, awayTeamId: fixture.awayTeamId,
      mode: 'best_of_5_draw', fixtureId,
      userTeam: userIsHome ? 'home' : 'away',
    });
  }, [selectedNationId]);

  const handleResetGroupMatch = useCallback((fixtureId: string) => {
    const fixture = GROUP_FIXTURES.find((f) => f.id === fixtureId);
    if (!fixture) return;
    const group = fixture.group;
    const currentResults = useTournamentMatchStore.getState().results;
    const groupFixtures = GROUP_FIXTURES.filter((f) => f.group === group);
    const otherResults = groupFixtures
      .filter((f) => f.id !== fixtureId && currentResults[f.id])
      .map((f) => currentResults[f.id]);
    useTournamentMatchStore.getState().clearGroupResults(group);
    for (const r of otherResults) {
      useTournamentMatchStore.getState().saveResult(r);
    }
  }, []);

  const handleKnockoutLongSim = useCallback(() => {
    if (!userNextMatch) return;
    const { def, homeTeamId, awayTeamId } = userNextMatch;
    if (!homeTeamId || !awayTeamId) return;
    const home = NATIONS_BY_ID[homeTeamId];
    const away = NATIONS_BY_ID[awayTeamId];
    if (!home || !away) return;
    const { html, events, score } = buildSimConfig(home, away);
    setSimOverlay({
      key: `sim-ko-${def.id}-${Date.now()}`,
      homeTeamId: home.id, awayTeamId: away.id,
      html, matchId: def.id, simScore: score, simEvents: events,
      contextLabel: `KNOCKOUT · ${ROUND_LABELS[def.round] ?? def.round}`,
      teamsLabel: `${home.code3} vs ${away.code3}`,
    });
  }, [userNextMatch]);

  const handleKnockoutPenalties = useCallback(() => {
    if (!userNextMatch) return;
    const { def, homeTeamId, awayTeamId } = userNextMatch;
    if (!homeTeamId || !awayTeamId) return;
    const userIsHome = homeTeamId === selectedNationId;
    setPenOverlay({
      key: `pen-ko-${def.id}-${Date.now()}`,
      homeTeamId, awayTeamId,
      mode: 'sudden_death', matchId: def.id,
      userTeam: userIsHome ? 'home' : 'away',
    });
  }, [userNextMatch, selectedNationId]);

  const handleSimMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type !== 'MATCH_RESULT') return;
      const ov = simOverlay;
      if (!ov) return;

      if (ov.fixtureId && !ov.matchId) {
        useTournamentMatchStore.getState().saveResult({
          fixtureId: ov.fixtureId, homeTeamId: ov.homeTeamId, awayTeamId: ov.awayTeamId,
          homeScore: ov.simScore.home, awayScore: ov.simScore.away,
          events: ov.simEvents, simulatedAt: Date.now(),
        });
        const freshResults = useTournamentMatchStore.getState().results;
        const userFixtureIds = new Set(userGroupFixtures.map((f) => f.id));
        const remaining = GROUP_FIXTURES.filter(
          (f) => !(f.id in freshResults) && !userFixtureIds.has(f.id),
        );
        for (const f of remaining) {
          const h = NATIONS_BY_ID[f.homeTeamId];
          const a = NATIONS_BY_ID[f.awayTeamId];
          if (!h || !a) continue;
          const evts = simulateMatch(h, a, 'en');
          const sc   = computeScore(evts, h.id, a.id);
          useTournamentMatchStore.getState().saveResult({
            fixtureId: f.id, homeTeamId: h.id, awayTeamId: a.id,
            homeScore: sc.home, awayScore: sc.away, events: evts, simulatedAt: Date.now(),
          });
        }
        setSimOverlay(null);
      } else if (ov.matchId != null) {
        const hs = ov.simScore.home;
        const as_ = ov.simScore.away;
        if (hs === as_) {
          setSimOverlay(null);
          setPenOverlay({
            key: `pen-ko-draw-${ov.matchId}-${Date.now()}`,
            homeTeamId: ov.homeTeamId, awayTeamId: ov.awayTeamId,
            mode: 'sudden_death', matchId: ov.matchId,
            userTeam: ov.homeTeamId === selectedNationId ? 'home' : 'away',
          });
        } else {
          useTournamentMatchStore.getState().saveKnockoutResult({
            matchId: ov.matchId, homeTeamId: ov.homeTeamId, awayTeamId: ov.awayTeamId,
            homeScore: hs, awayScore: as_, events: ov.simEvents, simulatedAt: Date.now(),
          });
          autoSimKnockout();
          setSimOverlay(null);
        }
      }
    } catch (_) {}
  }, [simOverlay, userGroupFixtures, autoSimKnockout, selectedNationId]);

  const handlePenMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'back') { setPenOverlay(null); return; }
      if (msg.type === 'restart') {
        if (penOverlay) setPenOverlay({ ...penOverlay, key: `${penOverlay.key}-r${Date.now()}` });
        return;
      }
      if (msg.type !== 'result') return;
      const ov = penOverlay;
      if (!ov) return;

      if (ov.fixtureId && !ov.matchId) {
        useTournamentMatchStore.getState().saveResult({
          fixtureId: ov.fixtureId, homeTeamId: ov.homeTeamId, awayTeamId: ov.awayTeamId,
          homeScore: msg.homeScore, awayScore: msg.awayScore,
          events: [], simulatedAt: Date.now(),
        });
        const freshResults = useTournamentMatchStore.getState().results;
        const userFixtureIds = new Set(userGroupFixtures.map((f) => f.id));
        const remaining = GROUP_FIXTURES.filter(
          (f) => !(f.id in freshResults) && !userFixtureIds.has(f.id),
        );
        for (const f of remaining) {
          const h = NATIONS_BY_ID[f.homeTeamId];
          const a = NATIONS_BY_ID[f.awayTeamId];
          if (!h || !a) continue;
          const evts = simulateMatch(h, a, 'en');
          const sc   = computeScore(evts, h.id, a.id);
          useTournamentMatchStore.getState().saveResult({
            fixtureId: f.id, homeTeamId: h.id, awayTeamId: a.id,
            homeScore: sc.home, awayScore: sc.away, events: evts, simulatedAt: Date.now(),
          });
        }
        setPenOverlay(null);
      } else if (ov.matchId != null) {
        useTournamentMatchStore.getState().saveKnockoutResult({
          matchId: ov.matchId, homeTeamId: ov.homeTeamId, awayTeamId: ov.awayTeamId,
          homeScore: msg.homeScore, awayScore: msg.awayScore,
          events: [], simulatedAt: Date.now(),
        });
        autoSimKnockout();
        setPenOverlay(null);
      }
    } catch (_) {}
  }, [penOverlay, userGroupFixtures, autoSimKnockout]);

  // ── Overlay rendering helper ────────────────────────────────────────────
  function renderOverlays() {
    if (simOverlay) {
      return (
        <View style={styles.overlayFull}>
          <View style={styles.overlayHeader}>
            <Text style={styles.overlayHeaderContext}>{simOverlay.contextLabel ?? ''}</Text>
            <Text style={styles.overlayHeaderTeams}>{simOverlay.teamsLabel ?? ''}</Text>
            <TouchableOpacity onPress={() => setSimOverlay(null)} style={styles.overlayHeaderClose} activeOpacity={0.7}>
              <Text style={styles.overlayCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <WebView
            key={simOverlay.key}
            source={{ html: simOverlay.html }}
            style={styles.overlayWebView}
            javaScriptEnabled
            originWhitelist={['*']}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            onMessage={handleSimMessage}
          />
        </View>
      );
    }
    if (penOverlay) {
      const home = NATIONS_BY_ID[penOverlay.homeTeamId];
      const away = NATIONS_BY_ID[penOverlay.awayTeamId];
      const configScript = home && away
        ? buildPenaltyConfig(home, away, penOverlay.mode, penOverlay.userTeam)
        : 'true;';
      return (
        <View style={styles.overlayFull}>
          <WebView
            key={penOverlay.key}
            source={{ html: PENALTY_GAME_HTML }}
            style={styles.overlayWebView}
            javaScriptEnabled
            originWhitelist={['*']}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            injectedJavaScriptBeforeContentLoaded={configScript}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            onMessage={handlePenMessage}
          />
          <TouchableOpacity style={styles.overlayCloseBtn} onPress={() => setPenOverlay(null)} activeOpacity={0.7}>
            <Text style={styles.overlayCloseBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 1 — TEAM SELECT (IDLE)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!isActive) {
    const selNation = pickedNation ? NATIONS_BY_ID[pickedNation] : null;

    return (
      <SafeAreaView style={styles.root}>
        <View style={{ flex: 1 }}>
          {/* Title block */}
          <View style={styles.s1Header}>
            <View style={styles.s1Eyebrow}>
              <PixelGlyph kind="trophy" color={COLORS.gold} px={2} />
              <Text style={styles.s1EyebrowText}>CAMPAIGN MODE</Text>
            </View>
            <Text style={styles.s1Title}>
              ROAD TO <Text style={{ color: COLORS.gold }}>GLORY</Text>
            </Text>
            <Text style={styles.s1Subtitle}>Pick your nation. Win the World Football Championship.</Text>
          </View>

          {/* Search */}
          <View style={styles.s1SearchWrap}>
            <View style={styles.s1SearchBox}>
              <PixelGlyph kind="search" color={COLORS.textMuted} px={2} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search nation or group (e.g. Türkiye, D)"
                placeholderTextColor={COLORS.textMuted}
                style={styles.s1SearchInput}
                autoCorrect={false}
                autoCapitalize="none"
              />
              <Text style={styles.s1SearchCount}>{filteredNations.length}/48</Text>
            </View>
          </View>

          {/* Grid */}
          <FlatList
            data={filteredNations}
            keyExtractor={(n) => n.id}
            numColumns={4}
            columnWrapperStyle={{ gap: 8 }}
            contentContainerStyle={[styles.s1GridContent, { paddingBottom: 100 + insets.bottom }]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = item.id === pickedNation;
              return (
                <TouchableOpacity
                  style={[
                    styles.s1NationCard,
                    isSelected && styles.s1NationCardSel,
                    { width: (SCREEN_W - 32 - 24) / 4 },
                  ]}
                  onPress={() => setPickedNation(item.id)}
                  activeOpacity={0.8}
                >
                  {isSelected && (
                    <View style={styles.s1CheckBadge}>
                      <PixelGlyph kind="check" color={COLORS.background} px={1.5} />
                    </View>
                  )}
                  <View style={styles.s1NationFlagWrap}>
                    <PixelFlag isoCode={item.isoCode} size={28} />
                  </View>
                  <Text style={[styles.s1NationCode, isSelected && { color: COLORS.gold }]}>
                    {item.code3}
                  </Text>
                  <Text style={styles.s1NationGroup}>GRP {item.group}</Text>
                  <DifficultyDots strength={item.strength} />
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.s1EmptyText}>No nation matches "{searchQuery}"</Text>
            }
          />

          {/* Sticky bottom CTA */}
          <View style={[styles.s1BottomBar, { bottom: 30 + insets.bottom }]}>
            <View style={styles.s1BottomLeft}>
              {selNation && (
                <>
                  <View style={styles.s1SelectedFlag}>
                    <PixelFlag isoCode={selNation.isoCode} size={24} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.s1SelectedLabel}>SELECTED</Text>
                    <Text style={styles.s1SelectedName} numberOfLines={1}>
                      {selNation.name.toUpperCase()}
                      <Text style={{ color: COLORS.textSecondary }}> · GROUP {selNation.group}</Text>
                    </Text>
                  </View>
                </>
              )}
            </View>
            <TouchableOpacity
              disabled={!pickedNation}
              onPress={handleBeginJourney}
              activeOpacity={pickedNation ? 0.85 : 1}
              style={[styles.s1CtaWrap, !pickedNation && { opacity: 0.5 }]}
            >
              <LinearGradient
                colors={[COLORS.gold, '#B98F1A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.s1Cta}
              >
                <Text style={styles.s1CtaText}>⚡ START</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 5 — CHAMPION (WINNER)
  // ═══════════════════════════════════════════════════════════════════════════
  if (hasWon && userNation) {
    const userStats = computeUserStats(selectedNationId!, results, knockoutResults);
    const phrase = CHAMPION_PHRASES[userNation.id] ?? GENERIC_PHRASE;

    return (
      <SafeAreaView style={styles.root}>
        <View style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={['#1B1408', COLORS.background]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <Confetti />
        <ScrollView contentContainerStyle={[styles.s5Scroll, { paddingBottom: 120 + insets.bottom }]} showsVerticalScrollIndicator={false}>
          {/* Eyebrow */}
          <View style={styles.s5Eyebrow}>
            <Text style={styles.s5EyebrowDiamond}>◆</Text>
            <Text style={styles.s5EyebrowText}>WORLD FOOTBALL CHAMPIONSHIP 2026 CHAMPIONS</Text>
            <Text style={styles.s5EyebrowDiamond}>◆</Text>
          </View>

          {/* Big flag card */}
          <View style={styles.s5FlagShadow}>
            <View style={styles.s5FlagCard}>
              <PixelFlag isoCode={userNation.isoCode} size={100} />
            </View>
          </View>

          {/* Nation name */}
          <Text style={styles.s5Nation} numberOfLines={1}>
            {userNation.name.toUpperCase()}
          </Text>

          {/* Localized phrase */}
          <View style={styles.s5PhraseShadow}>
            <View style={styles.s5PhraseCard}>
              <Text style={styles.s5PhraseLocal}>"{phrase.local}"</Text>
              <View style={styles.s5PhraseDivider} />
              <Text style={styles.s5PhraseEn}>"{phrase.en.toUpperCase()}"</Text>
            </View>
          </View>

          {/* Pixel trophy */}
          <View style={styles.s5TrophyShadow}>
            <View style={styles.s5TrophyCard}>
              <PixelTrophy size={3} />
              <Text style={styles.s5TrophyLabel}>FIFA WORLD FOOTBALL CHAMPIONSHIP™</Text>
            </View>
          </View>

          {/* Stats strip */}
          <View style={styles.s5StatsRow}>
            <View style={styles.s5MiniStat}>
              <Text style={styles.s5MiniStatValue}>{userStats.played}</Text>
              <Text style={styles.s5MiniStatLabel}>PLAYED</Text>
            </View>
            <View style={styles.s5MiniStat}>
              <Text style={styles.s5MiniStatValue}>{userStats.won}</Text>
              <Text style={styles.s5MiniStatLabel}>WINS</Text>
            </View>
            <View style={styles.s5MiniStat}>
              <Text style={styles.s5MiniStatValue}>{userStats.gf}</Text>
              <Text style={styles.s5MiniStatLabel}>GOALS</Text>
            </View>
            <View style={styles.s5MiniStat}>
              <Text style={[styles.s5MiniStatValue, { color: COLORS.gold }]}>★1</Text>
              <Text style={styles.s5MiniStatLabel}>RANK</Text>
            </View>
          </View>

          {/* CTAs */}
          <TouchableOpacity
            onPress={() => handleShare(userNation.id, userNation.name)}
            activeOpacity={0.85}
            style={styles.s5ShareWrap}
          >
            <LinearGradient
              colors={[COLORS.gold, '#B98F1A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.s5ShareBtn}
            >
              <Text style={styles.s5ShareText}>📤  SHARE VICTORY</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleReset} activeOpacity={0.85} style={styles.s5MenuBtn}>
            <Text style={styles.s5MenuText}>⌂ GO TO MAIN MENU</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 4 — ELIMINATED
  // ═══════════════════════════════════════════════════════════════════════════
  if (isEliminated && userNation) {
    const byTeam    = eliminatedBy ? NATIONS_BY_ID[eliminatedBy] : null;
    const roundLabel = eliminatedAt === 'groups'
      ? 'GROUP STAGE'
      : ROUND_LABELS[eliminatedAt ?? ''] ?? (eliminatedAt ?? '').toUpperCase();
    const userStats = computeUserStats(selectedNationId!, results, knockoutResults);
    const gdiff = userStats.gf - userStats.ga;

    // Final score string from last relevant match
    let finalScoreLine: string | null = null;
    if (byTeam && userLastKnockoutMatch?.result) {
      const r = userLastKnockoutMatch.result;
      const isHome = r.homeTeamId === selectedNationId;
      const u = isHome ? r.homeScore : r.awayScore;
      const o = isHome ? r.awayScore : r.homeScore;
      finalScoreLine = `${userNation.code3} ${u} – ${o} ${byTeam.code3}`;
    }

    const bestMoment = computeBestMoment(selectedNationId!, results, knockoutResults);

    return (
      <SafeAreaView style={styles.root}>
        <View style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={['rgba(194,52,11,0.18)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <ScrollView contentContainerStyle={[styles.s4Scroll, { paddingBottom: 120 + insets.bottom }]} showsVerticalScrollIndicator={false}>
          <TopBar title="CAMPAIGN OVER" subtitle="World Football Championship 2026" onBack={handleStartOver} />

          {/* Sad tile */}
          <View style={styles.s4SadWrap}>
            <View style={styles.s4SadTile}>
              <Text style={styles.s4SadEmoji}>😔</Text>
            </View>
          </View>

          <Text style={styles.s4Title}>ELIMINATED</Text>

          <View style={styles.s4RoundPillWrap}>
            <View style={styles.s4RoundPill}>
              <Text style={styles.s4RoundPillText}>
                ✕ {roundLabel}{byTeam ? ` · vs ${byTeam.name.toUpperCase()}` : ''}
              </Text>
            </View>
          </View>

          {finalScoreLine && (
            <Text style={styles.s4FinalScore}>
              Final score <Text style={{ color: COLORS.textPrimary }}>{finalScoreLine}</Text>
            </Text>
          )}

          {/* Stats */}
          <View style={styles.s4StatsBlock}>
            <SectionHeader icon="ball" title="YOUR CAMPAIGN" />
            <View style={styles.s4StatsRow}>
              <StatBlock label="Played" value={userStats.played} />
              <StatBlock label="Wins" value={userStats.won} accent="#94C952" />
              <StatBlock label="Draws" value={userStats.drawn} accent={COLORS.gold} />
              <StatBlock label="Losses" value={userStats.lost} accent={COLORS.red} />
            </View>
            <View style={[styles.s4StatsRow, { marginTop: SPACING[8] }]}>
              <StatBlock label="Goals For" value={userStats.gf} accent={COLORS.gold} />
              <StatBlock label="Goals Against" value={userStats.ga} accent={COLORS.textSecondary} />
              <StatBlock
                label="Diff"
                value={(gdiff >= 0 ? '+' : '') + gdiff}
                accent={gdiff >= 0 ? '#94C952' : COLORS.red}
              />
            </View>
          </View>

          {/* Best moment */}
          {bestMoment && (
            <View style={styles.s4BestShadow}>
              <View style={styles.s4BestCard}>
                <View style={styles.s4BestIcon}>
                  <PixelGlyph kind="star" color={COLORS.gold} px={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.s4BestLabel}>BEST MOMENT</Text>
                  <Text style={styles.s4BestText}>
                    <Text style={{ color: COLORS.gold, fontFamily: TYPOGRAPHY.fontHeading }}>
                      {bestMoment.userCode} {bestMoment.userScore}–{bestMoment.oppScore} {bestMoment.oppCode}
                    </Text>
                    <Text> — {bestMoment.context}</Text>
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* CTAs */}
          <View style={styles.s4Ctas}>
            <TouchableOpacity activeOpacity={0.85} onPress={handleReset} style={styles.s4MenuBtn}>
              <Text style={styles.s4MenuText}>⌂ GO TO MAIN MENU</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 2 — GROUP PHASE
  // ═══════════════════════════════════════════════════════════════════════════
  if (!inKnockoutPhase && userNation && userGroup) {
    const allGroupFixtures = GROUP_FIXTURES.filter((f) => f.group === userGroup);
    const playedCount = userGroupFixtures.filter((f) => f.id in results).length;

    const placeholderRows =
      groupStandings.length > 0
        ? null
        : allGroupFixtures
            .map((f) => [f.homeTeamId, f.awayTeamId])
            .flat()
            .filter((id, idx, arr) => arr.indexOf(id) === idx);

    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={[styles.scrollPad, { paddingBottom: 120 + insets.bottom }]} showsVerticalScrollIndicator={false}>
          <TopBar
            title={`GROUP ${userGroup} · ${userNation.name.toUpperCase()}`}
            subtitle="World Football Championship 2026 · Group Phase"
            onBack={handleStartOver}
            right={
              <View style={styles.topBarFlagRight}>
                <PixelFlag isoCode={userNation.isoCode} size={22} />
              </View>
            }
          />

          {/* Standings */}
          <View style={{ paddingHorizontal: SPACING[16], paddingTop: SPACING[8] }}>
            <SectionHeader
              icon="shield"
              title="STANDINGS"
              right={
                <Text style={styles.sectionRight}>
                  {playedCount}/3 PLAYED
                </Text>
              }
            />
            <View style={styles.standingsShadow}>
              <LinearGradient {...cardGreen} style={styles.standingsCard}>
                <View style={styles.standHeaderRow}>
                  <Text style={styles.standHPos}>#</Text>
                  <Text style={styles.standHName}>TEAM</Text>
                  <Text style={styles.standHStat}>P</Text>
                  <Text style={styles.standHStat}>W</Text>
                  <Text style={styles.standHStat}>D</Text>
                  <Text style={styles.standHStat}>L</Text>
                  <Text style={styles.standHStat}>GD</Text>
                  <Text style={styles.standHPts}>PTS</Text>
                </View>
                {groupStandings.length > 0
                  ? groupStandings.map((row, i) => (
                      <StandingsRow
                        key={row.teamId}
                        row={row}
                        pos={i + 1}
                        isUser={row.teamId === selectedNationId}
                        qualifies={i < 2}
                        last={i === groupStandings.length - 1}
                      />
                    ))
                  : (placeholderRows ?? []).map((teamId, i, arr) => {
                      const t = NATIONS_BY_ID[teamId];
                      return (
                        <View key={teamId} style={[styles.standRow, i < arr.length - 1 && styles.standRowBorder]}>
                          {i < 2 && <View style={styles.standQualBar} />}
                          <Text style={[
                            styles.standPos,
                            i < 2 && { color: COLORS.green, fontWeight: '800' },
                            teamId === selectedNationId && i >= 2 && { color: COLORS.gold },
                          ]}>{i + 1}</Text>
                          <View style={styles.standTeamCell}>
                            {t && <PixelFlag isoCode={t.isoCode} size={16} />}
                            <Text
                              style={[styles.standName, teamId === selectedNationId && styles.standNameUser]}
                              numberOfLines={1}
                            >
                              {t?.code3 ?? teamId.toUpperCase()}
                            </Text>
                            {teamId === selectedNationId && <Text style={styles.standMarker}>◂</Text>}
                          </View>
                          <Text style={styles.standStat}>0</Text>
                          <Text style={styles.standStat}>0</Text>
                          <Text style={styles.standStat}>0</Text>
                          <Text style={styles.standStat}>0</Text>
                          <Text style={styles.standStat}>0</Text>
                          <Text style={styles.standPts}>0</Text>
                        </View>
                      );
                    })}
                <View style={styles.standLegend}>
                  <View style={styles.standLegendDot} />
                  <Text style={styles.standLegendText}>Top 2 advance to knockouts</Text>
                </View>
              </LinearGradient>
            </View>
          </View>

          {/* Matches */}
          <View style={{ paddingHorizontal: SPACING[16], paddingTop: SPACING[16] }}>
            <SectionHeader icon="ball" title="YOUR MATCHES" />
            <View style={{ gap: 10 }}>
              {userGroupFixtures.map((fixture) => {
                const homeTeam   = NATIONS_BY_ID[fixture.homeTeamId];
                const awayTeam   = NATIONS_BY_ID[fixture.awayTeamId];
                const result     = results[fixture.id] ?? null;
                const isUserHome = fixture.homeTeamId === selectedNationId;
                const isAnimating = justSimmedGroupId === fixture.id;
                const md1Done = userGroupFixtures.filter((f) => f.matchday === 1 && f.id in results).length === 1;
                const md2Done = userGroupFixtures.filter((f) => f.matchday === 2 && f.id in results).length === 1;
                const isLocked = (fixture.matchday === 2 && !md1Done) || (fixture.matchday === 3 && !md2Done);
                return (
                  <GroupMatchCard
                    key={fixture.id}
                    fixture={fixture}
                    homeTeam={homeTeam}
                    awayTeam={awayTeam}
                    result={result}
                    isUserHome={isUserHome}
                    isAnimating={isAnimating}
                    selectedNationId={selectedNationId!}
                    onQuickSim={() => handleSimulateGroupAnimated(fixture.id)}
                    onLongSim={() => handleGroupLongSim(fixture.id)}
                    onPenalties={() => handleGroupPenalties(fixture.id)}
                    locked={isLocked}
                  />
                );
              })}
            </View>
          </View>

          {/* Proceed card */}
          {allUserGroupPlayed && (
            <View style={{ paddingHorizontal: SPACING[16], paddingTop: SPACING[12] }}>
              {qualificationStatus === 'qualified' && (
                <View style={styles.proceedShadow}>
                  <LinearGradient {...cardGreen} style={[styles.proceedCard, { borderColor: '#94C952' }]}>
                    <View style={styles.proceedHeadRow}>
                      <Text style={styles.proceedEmoji}>🏆</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.proceedTitle, { color: COLORS.gold }]}>GROUP COMPLETE</Text>
                        <Text style={styles.proceedSub}>
                          You finished <Text style={{ color: COLORS.gold }}>
                            {userPosition === 1 ? '1st' : userPosition === 2 ? '2nd' : userPosition === 3 ? '3rd' : `${userPosition}th`} in Group {userGroup}
                          </Text>. Advancing to the knockouts.
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity activeOpacity={0.85} onPress={() => { /* auto-advances via inKnockoutPhase */ }}>
                      <LinearGradient
                        colors={[COLORS.gold, '#B98F1A']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={styles.proceedBtn}
                      >
                        <Text style={styles.proceedBtnText}>GO TO NEXT ROUND ▸</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              )}

              {qualificationStatus === 'eliminated' && (
                <View style={styles.proceedShadow}>
                  <LinearGradient {...cardRed} style={[styles.proceedCard, { borderColor: COLORS.red }]}>
                    <View style={styles.proceedHeadRow}>
                      <Text style={styles.proceedEmoji}>😔</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.proceedTitle, { color: '#E86B47' }]}>ELIMINATED</Text>
                        <Text style={styles.proceedSub}>
                          Finished <Text style={{ color: '#E86B47' }}>
                            {userPosition}
                            {userPosition === 1 ? 'st' : userPosition === 2 ? 'nd' : userPosition === 3 ? 'rd' : 'th'}
                            {' '}in Group {userGroup}
                          </Text>. Campaign over.
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setEliminated('groups', '')}
                      style={styles.proceedRedBtn}
                    >
                      <Text style={styles.proceedRedBtnText}>GO TO MAIN MENU</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              )}

              {qualificationStatus === 'pending' && (
                <View style={styles.pendingBanner}>
                  <Text style={styles.pendingEmoji}>⏳</Text>
                  <Text style={styles.pendingText}>
                    3rd place — awaiting results from other groups...
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
        {renderOverlays()}
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 3 — KNOCKOUT
  // ═══════════════════════════════════════════════════════════════════════════
  if (userNation) {
    const nextMatch = userNextMatch;
    const opponent  = nextMatch
      ? NATIONS_BY_ID[
          nextMatch.homeTeamId === selectedNationId
            ? (nextMatch.awayTeamId ?? '')
            : (nextMatch.homeTeamId ?? '')
        ]
      : null;

    const roundLabel  = nextMatch ? (ROUND_LABELS[nextMatch.def.round] ?? nextMatch.def.round) : '';

    const previousKos = resolvedBracket.filter(
      (m) =>
        m.result !== null &&
        (m.result.homeTeamId === selectedNationId ||
          m.result.awayTeamId === selectedNationId),
    );

    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={[styles.scrollPad, { paddingBottom: 120 + insets.bottom }]} showsVerticalScrollIndicator={false}>
          <TopBar
            title="KNOCKOUTS"
            subtitle={nextMatch ? `${roundLabel} · Your path to the final` : 'Your path to the final'}
            onBack={handleStartOver}
            right={
              <View style={styles.topBarFlagRight}>
                <PixelFlag isoCode={userNation.isoCode} size={22} />
              </View>
            }
          />

          {/* Sub-tabs */}
          <View style={styles.koTabsWrap}>
            <View style={styles.koTabsInner}>
              {([
                { id: 'tree',  label: 'TOURNAMENT TREE' },
                { id: 'match', label: 'MY MATCH' },
              ] as const).map((t) => {
                const active = koTab === t.id;
                if (active) {
                  return (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => setKoTab(t.id)}
                      activeOpacity={0.85}
                      style={{ flex: 1 }}
                    >
                      <LinearGradient
                        colors={[COLORS.gold, '#B98F1A']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={styles.koTabActive}
                      >
                        <Text style={styles.koTabActiveText}>{t.label}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                }
                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setKoTab(t.id)}
                    activeOpacity={0.7}
                    style={styles.koTabInactive}
                  >
                    <Text style={styles.koTabInactiveText}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Tab content */}
          {koTab === 'tree' ? (
            <View style={{ paddingHorizontal: SPACING[8] }}>
              <KnockoutBracket resolved={resolvedBracket} />
            </View>
          ) : (
            <View style={{ paddingHorizontal: SPACING[16] }}>
              {nextMatch && opponent ? (
                <View style={styles.koMatchShadow}>
                  <LinearGradient {...cardGreen} style={styles.koMatchCard}>
                    <View style={styles.koMatchHeadRow}>
                      <View style={styles.koRoundBadge}>
                        <Text style={styles.koRoundBadgeText}>{roundLabel}</Text>
                      </View>
                      <Text style={styles.koMatchDate}>{nextMatch.def.date}</Text>
                    </View>

                    <View style={styles.koMatchTeamsRow}>
                      <View style={styles.koTeamSide}>
                        <View style={[styles.koTeamFlagWrap, { borderColor: COLORS.gold }]}>
                          <PixelFlag isoCode={userNation.isoCode} size={44} />
                        </View>
                        <Text style={[styles.koTeamName, { color: COLORS.gold }]} numberOfLines={1}>
                          {userNation.name.toUpperCase()}
                        </Text>
                        <DifficultyDots strength={userNation.strength} dotSize={4} />
                      </View>
                      <Text style={styles.koVs}>VS</Text>
                      <View style={styles.koTeamSide}>
                        <View style={[styles.koTeamFlagWrap, { borderColor: COLORS.border }]}>
                          <PixelFlag isoCode={opponent.isoCode} size={44} />
                        </View>
                        <Text style={styles.koTeamName} numberOfLines={1}>
                          {opponent.name.toUpperCase()}
                        </Text>
                        <DifficultyDots strength={opponent.strength} dotSize={4} />
                      </View>
                    </View>

                    <View style={styles.koVenueRow}>
                      <PixelGlyph kind="flag" color={COLORS.teal} px={2} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.koVenueName} numberOfLines={1}>
                          {nextMatch.def.venue.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.koBtnsRow}>
                      <TouchableOpacity
                        style={styles.simBtnOutline}
                        onPress={handleKnockoutLongSim}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.simBtnOutlineText}>LONG SIM</Text>
                        <Text style={styles.simBtnSub}>Watch 90'</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.simBtnGold}
                        onPress={handleSimulateKnockout}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.simBtnGoldText}>QUICK SIM</Text>
                        <Text style={[styles.simBtnSub, { color: 'rgba(11,23,31,0.7)' }]}>Instant</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.simBtnTeal}
                        onPress={handleKnockoutPenalties}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.simBtnTealText}>PENALTIES</Text>
                        <Text style={[styles.simBtnSub, { color: COLORS.teal }]}>Direct</Text>
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                </View>
              ) : (
                <View style={styles.waitingCard}>
                  <Text style={styles.waitingEmoji}>⏳</Text>
                  <Text style={styles.waitingText}>Waiting for bracket to resolve...</Text>
                  <Text style={styles.waitingHint}>
                    Other group results determine your next opponent.
                  </Text>
                </View>
              )}

              {previousKos.length > 0 && (
                <View style={{ marginTop: SPACING[16] }}>
                  <SectionHeader icon="star" title="PREVIOUS KNOCKOUTS" />
                  <View style={{ gap: 8 }}>
                    {previousKos.map((m) => {
                      const r = m.result!;
                      const isHome = r.homeTeamId === selectedNationId;
                      const uScore = isHome ? r.homeScore : r.awayScore;
                      const oScore = isHome ? r.awayScore : r.homeScore;
                      const oppId  = isHome ? r.awayTeamId : r.homeTeamId;
                      const opp    = NATIONS_BY_ID[oppId];
                      const won    = uScore > oScore;
                      return (
                        <View key={m.def.id} style={styles.prevKoShadow}>
                          <View style={styles.prevKoCard}>
                            <View style={styles.prevKoHead}>
                              <View style={styles.prevKoRoundBadge}>
                                <Text style={styles.prevKoRoundText}>
                                  {ROUND_LABELS[m.def.round] ?? m.def.round}
                                </Text>
                              </View>
                              <View style={styles.prevKoTeamRow}>
                                <PixelFlag isoCode={userNation.isoCode} size={16} />
                                <Text style={styles.prevKoUserCode}>{userNation.code3}</Text>
                                <View style={styles.prevKoScoreBox}>
                                  <Text style={styles.prevKoScoreText}>{uScore}–{oScore}</Text>
                                </View>
                                <Text style={styles.prevKoOppCode}>{opp?.code3 ?? '?'}</Text>
                                {opp && <PixelFlag isoCode={opp.isoCode} size={16} />}
                              </View>
                              <Text style={[styles.prevKoBadge, { color: won ? '#94C952' : COLORS.red }]}>
                                {won ? 'WIN' : 'LOSS'}
                              </Text>
                            </View>
                            <View style={styles.prevKoFoot}>
                              <Text style={styles.prevKoFootText} numberOfLines={1}>{m.def.venue}</Text>
                              <Text style={styles.prevKoFootText}>{m.def.date}</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>
        {renderOverlays()}
      </SafeAreaView>
    );
  }

  // Fallback
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.waitingCard}>
        <Text style={styles.waitingText}>Loading tournament...</Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Aggregate user's stats from all matches ────────────────────────────────
function computeUserStats(
  nationId: string,
  results: Record<string, import('../types/matchResult').MatchResult>,
  knockoutResults: Record<number, import('../types/knockout').KnockoutResult>,
) {
  let played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0;

  const processMatch = (homeId: string, awayId: string, hs: number, as_: number) => {
    if (homeId !== nationId && awayId !== nationId) return;
    played++;
    const isHome = homeId === nationId;
    const uScore = isHome ? hs : as_;
    const oScore = isHome ? as_ : hs;
    gf += uScore; ga += oScore;
    if (uScore > oScore) won++;
    else if (uScore < oScore) lost++;
    else drawn++;
  };

  Object.values(results).forEach((r) =>
    processMatch(r.homeTeamId, r.awayTeamId, r.homeScore, r.awayScore),
  );
  Object.values(knockoutResults).forEach((r) =>
    processMatch(r.homeTeamId, r.awayTeamId, r.homeScore, r.awayScore),
  );

  return { played, won, drawn, lost, gf, ga };
}

// ─── Best moment: user's win with largest GD (prefer knockout over group) ──
function computeBestMoment(
  nationId: string,
  results: Record<string, import('../types/matchResult').MatchResult>,
  knockoutResults: Record<number, import('../types/knockout').KnockoutResult>,
): { userCode: string; oppCode: string; userScore: number; oppScore: number; context: string } | null {
  const userNation = NATIONS_BY_ID[nationId];
  if (!userNation) return null;

  type Candidate = { userScore: number; oppScore: number; oppId: string; context: string; weight: number };
  const candidates: Candidate[] = [];

  Object.values(knockoutResults).forEach((r) => {
    if (r.homeTeamId !== nationId && r.awayTeamId !== nationId) return;
    const isHome = r.homeTeamId === nationId;
    const u = isHome ? r.homeScore : r.awayScore;
    const o = isHome ? r.awayScore : r.homeScore;
    if (u <= o) return;
    const oppId = isHome ? r.awayTeamId : r.homeTeamId;
    candidates.push({ userScore: u, oppScore: o, oppId, context: 'knockout win', weight: 100 + (u - o) });
  });

  Object.values(results).forEach((r) => {
    if (r.homeTeamId !== nationId && r.awayTeamId !== nationId) return;
    const isHome = r.homeTeamId === nationId;
    const u = isHome ? r.homeScore : r.awayScore;
    const o = isHome ? r.awayScore : r.homeScore;
    if (u <= o) return;
    const oppId = isHome ? r.awayTeamId : r.homeTeamId;
    candidates.push({ userScore: u, oppScore: o, oppId, context: 'group stage win', weight: u - o });
  });

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.weight - a.weight);
  const best = candidates[0];
  const opp = NATIONS_BY_ID[best.oppId];
  return {
    userCode: userNation.code3,
    oppCode: opp?.code3 ?? best.oppId.toUpperCase(),
    userScore: best.userScore,
    oppScore: best.oppScore,
    context: best.context,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: COLORS.background },
  scrollPad: { paddingBottom: SPACING[32] },

  // ── Top bar ────────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING[12],
    paddingHorizontal: SPACING[16],
    paddingTop: SPACING[8],
    paddingBottom: SPACING[8],
  },
  topBarBack: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.small,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...PIXEL_SHADOW,
  },
  topBarTitle: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 22,
    color: COLORS.gold,
    letterSpacing: 1.5,
    lineHeight: 24,
  },
  topBarSub: {
    marginTop: 2,
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  topBarFlagRight: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.small,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Section header ────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 13,
    color: COLORS.gold,
    letterSpacing: 2,
  },
  sectionHeaderRule: {
    flex: 1,
    height: 2,
    marginLeft: 4,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.border,
    borderStyle: 'dashed',
  },
  sectionRight: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },

  // ── Screen 1 — Team Select ────────────────────────────────────────────────
  s1Header: {
    paddingHorizontal: SPACING[16],
    paddingTop: SPACING[16],
    paddingBottom: SPACING[8],
  },
  s1Eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  s1EyebrowText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.gold,
    letterSpacing: 3,
  },
  s1Title: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 32,
    color: COLORS.textPrimary,
    letterSpacing: 1.5,
    lineHeight: 34,
  },
  s1Subtitle: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  s1SearchWrap: {
    paddingHorizontal: SPACING[16],
    paddingVertical: SPACING[8],
  },
  s1SearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
  },
  s1SearchInput: {
    flex: 1,
    padding: 0,
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  s1SearchCount: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
  },
  s1GridContent: {
    paddingHorizontal: SPACING[16],
    paddingTop: SPACING[4],
    paddingBottom: 260,
    gap: 8,
  },
  s1NationCard: {
    position: 'relative',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 5,
    ...PIXEL_SHADOW,
  },
  s1NationCardSel: {
    backgroundColor: COLORS.surfaceElevated,
    borderColor: COLORS.gold,
  },
  s1CheckBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: COLORS.gold,
    borderWidth: 1,
    borderColor: '#B98F1A',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  s1NationFlagWrap: {
    width: 40,
    height: 30,
    borderRadius: 3,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  s1NationCode: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 12,
    color: COLORS.textPrimary,
    letterSpacing: 1,
    lineHeight: 12,
  },
  s1NationGroup: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 8,
    color: COLORS.textMuted,
    letterSpacing: 1,
    lineHeight: 10,
  },
  s1EmptyText: {
    paddingVertical: SPACING[20],
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  s1BottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: SPACING[16],
    paddingTop: SPACING[12],
    paddingBottom: SPACING[12],
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  s1BottomLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 40,
  },
  s1SelectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: RADIUS.small,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.gold,
    marginBottom: 10,
    ...PIXEL_SHADOW,
  },
  s1SelectedFlag: {
    width: 34,
    height: 26,
    borderRadius: 3,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#B98F1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  s1SelectedLabel: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 9,
    color: '#B98F1A',
    letterSpacing: 2,
  },
  s1SelectedName: {
    marginTop: 2,
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  s1CtaWrap: {
    width: 120,
    borderRadius: RADIUS.small,
    ...PIXEL_SHADOW,
  },
  s1Cta: {
    paddingVertical: 10,
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: '#B98F1A',
    alignItems: 'center',
  },
  s1CtaText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 13,
    color: COLORS.background,
    letterSpacing: 1.5,
    fontWeight: '800',
  },

  // ── Screen 2 — Standings card ────────────────────────────────────────────
  standingsShadow: {
    borderRadius: RADIUS.small,
    ...PIXEL_SHADOW,
  },
  standingsCard: {
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: SPACING[16],
  },
  standHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  standHPos: {
    width: 16,
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  standHName: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
  },
  standHStat: {
    width: 22,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  standHPts: {
    width: 30,
    textAlign: 'right',
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  standRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    position: 'relative',
  },
  standRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,52,72,0.35)',
    borderStyle: 'dashed',
  },
  standQualBar: {
    position: 'absolute',
    left: -SPACING[8] - 4,
    top: 6,
    bottom: 6,
    width: 3,
    backgroundColor: '#94C952',
  },
  standPos: {
    width: 16,
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  standTeamCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  standName: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 13,
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  standNameUser: {
    color: COLORS.gold,
    fontWeight: '800',
  },
  standMarker: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: '#B98F1A',
    marginLeft: 2,
  },
  standStat: {
    width: 22,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  standPts: {
    width: 30,
    textAlign: 'right',
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '800',
  },
  standLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  standLegendDot: {
    width: 3,
    height: 10,
    backgroundColor: '#94C952',
  },
  standLegendText: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 10,
    color: COLORS.textMuted,
  },

  // ── Screen 2 — Match card ────────────────────────────────────────────────
  matchShadow: {
    borderRadius: RADIUS.small,
    ...PIXEL_SHADOW,
  },
  matchCard: {
    borderRadius: RADIUS.small,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    overflow: 'hidden',
  },
  matchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  mdBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: COLORS.gold,
    borderRadius: 2,
  },
  mdBadgeText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.background,
    letterSpacing: 1.5,
    fontWeight: '800',
  },
  matchVenue: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 10,
    color: COLORS.textMuted,
    maxWidth: 180,
  },
  matchDate: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.teal,
    letterSpacing: 1.5,
  },
  resultPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 2,
    borderWidth: 1,
  },
  resultPillText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '800',
  },
  matchTeamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  matchTeamSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  matchTeamName: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 13,
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  matchTeamNameUser: {
    color: COLORS.gold,
    fontWeight: '800',
  },
  matchScoreBox: {
    minWidth: 64,
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
  },
  matchScore: {
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 22,
    color: COLORS.gold,
    letterSpacing: 2,
    lineHeight: 22,
  },
  matchScoreDash: {
    color: COLORS.textMuted,
    fontSize: 16,
  },
  matchVs: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    fontWeight: '800',
  },
  matchBtns: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  simBtnOutline: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 2,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 5,
    alignItems: 'center',
    gap: 2,
    ...PIXEL_SHADOW,
  },
  simBtnOutlineText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.textPrimary,
    letterSpacing: 1,
    fontWeight: '800',
  },
  simBtnGold: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 2,
    backgroundColor: COLORS.gold,
    borderWidth: 1,
    borderColor: '#B98F1A',
    borderRadius: 5,
    alignItems: 'center',
    gap: 2,
    ...PIXEL_SHADOW,
  },
  simBtnGoldText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.background,
    letterSpacing: 1,
    fontWeight: '800',
  },
  simBtnTeal: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 2,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.teal,
    borderRadius: 5,
    alignItems: 'center',
    gap: 2,
    ...PIXEL_SHADOW,
  },
  simBtnTealText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.teal,
    letterSpacing: 1,
    fontWeight: '800',
  },
  simBtnSub: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 9,
    color: COLORS.textMuted,
  },
  matchLockedRow: {
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  matchLockedText: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // ── Screen 2 — Proceed card ──────────────────────────────────────────────
  proceedShadow: {
    borderRadius: RADIUS.medium,
    marginTop: SPACING[8],
    ...PIXEL_SHADOW,
  },
  proceedCard: {
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    padding: 14,
  },
  proceedHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  proceedEmoji: { fontSize: 24 },
  proceedTitle: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 16,
    letterSpacing: 1.5,
    fontWeight: '800',
  },
  proceedSub: {
    marginTop: 4,
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: 'rgba(240,244,247,0.85)',
    lineHeight: 14,
  },
  proceedBtn: {
    paddingVertical: 13,
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: '#B98F1A',
    alignItems: 'center',
  },
  proceedBtnText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: COLORS.background,
    letterSpacing: 2.5,
    fontWeight: '800',
  },
  proceedRedBtn: {
    paddingVertical: 12,
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: '#6A1A05',
    backgroundColor: COLORS.red,
    alignItems: 'center',
  },
  proceedRedBtnText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 13,
    color: COLORS.textPrimary,
    letterSpacing: 2,
    fontWeight: '800',
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginTop: SPACING[8],
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(250,206,67,0.08)',
  },
  pendingEmoji: { fontSize: 20 },
  pendingText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 12,
    color: COLORS.textPrimary,
  },

  // ── Screen 3 — KO tabs ──────────────────────────────────────────────────
  koTabsWrap: {
    paddingHorizontal: SPACING[16],
    paddingTop: SPACING[4],
    paddingBottom: SPACING[12],
  },
  koTabsInner: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
  },
  koTabActive: {
    paddingVertical: 9,
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: '#B98F1A',
    alignItems: 'center',
  },
  koTabActiveText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.background,
    letterSpacing: 1.5,
    fontWeight: '800',
  },
  koTabInactive: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
  },
  koTabInactiveText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
  },

  // ── Screen 3 — KO match card ────────────────────────────────────────────
  koMatchShadow: {
    borderRadius: RADIUS.medium,
    marginBottom: SPACING[4],
    ...PIXEL_SHADOW,
  },
  koMatchCard: {
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.gold,
    padding: 14,
  },
  koMatchHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  koRoundBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: COLORS.gold,
    borderRadius: 3,
  },
  koRoundBadgeText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.background,
    letterSpacing: 1.5,
    fontWeight: '800',
  },
  koMatchDate: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  koMatchTeamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  koTeamSide: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  koTeamFlagWrap: {
    width: 60,
    height: 46,
    borderRadius: 5,
    backgroundColor: COLORS.background,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  koTeamName: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 13,
    color: COLORS.textPrimary,
    letterSpacing: 1,
    textAlign: 'center',
    fontWeight: '800',
  },
  koVs: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 20,
    color: COLORS.textSecondary,
    letterSpacing: 3,
    fontWeight: '800',
  },
  koVenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 5,
    marginBottom: 12,
  },
  koVenueName: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  koBtnsRow: {
    flexDirection: 'row',
    gap: 6,
  },

  // ── Screen 3 — Previous knockouts ────────────────────────────────────────
  prevKoShadow: {
    borderRadius: RADIUS.small,
    ...PIXEL_SHADOW,
  },
  prevKoCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    overflow: 'hidden',
  },
  prevKoHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  prevKoRoundBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: COLORS.border,
    borderRadius: 2,
  },
  prevKoRoundText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 9,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
  },
  prevKoTeamRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  prevKoUserCode: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 12,
    color: COLORS.gold,
    fontWeight: '800',
  },
  prevKoScoreBox: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: COLORS.background,
    borderRadius: 3,
  },
  prevKoScoreText: {
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 16,
    color: COLORS.gold,
    letterSpacing: 1,
  },
  prevKoOppCode: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  prevKoBadge: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '800',
  },
  prevKoFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderStyle: 'dashed',
  },
  prevKoFootText: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 10,
    color: COLORS.textMuted,
    flexShrink: 1,
  },

  // ── Waiting card (KO fallback) ───────────────────────────────────────────
  waitingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING[20],
    alignItems: 'center',
    marginTop: SPACING[20],
    ...PIXEL_SHADOW,
  },
  waitingEmoji: { fontSize: 40, marginBottom: 8 },
  waitingText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 15,
    color: COLORS.textPrimary,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  waitingHint: {
    marginTop: 6,
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  // ── Screen 4 — Eliminated ────────────────────────────────────────────────
  s4Scroll: {
    paddingBottom: SPACING[32],
  },
  s4SadWrap: {
    alignItems: 'center',
    marginTop: SPACING[8],
  },
  s4SadTile: {
    width: 98,
    height: 98,
    borderRadius: 10,
    backgroundColor: '#3B1A0D',
    borderWidth: 2,
    borderColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
    ...PIXEL_SHADOW,
  },
  s4SadEmoji: { fontSize: 48 },
  s4Title: {
    marginTop: SPACING[12],
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 40,
    color: '#E86B47',
    letterSpacing: 3,
    fontWeight: '800',
  },
  s4RoundPillWrap: {
    alignItems: 'center',
    marginTop: 10,
  },
  s4RoundPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(194,52,11,0.15)',
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 4,
  },
  s4RoundPillText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: '#E86B47',
    letterSpacing: 1,
  },
  s4FinalScore: {
    marginTop: 10,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  s4StatsBlock: {
    paddingHorizontal: SPACING[16],
    paddingTop: SPACING[20],
    paddingBottom: SPACING[12],
  },
  s4StatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statBlock: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    alignItems: 'center',
    gap: 4,
    ...PIXEL_SHADOW,
  },
  statBlockValue: {
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 28,
    color: COLORS.textPrimary,
    lineHeight: 28,
  },
  statBlockLabel: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 1,
    textAlign: 'center',
  },
  s4BestShadow: {
    marginHorizontal: SPACING[16],
    borderRadius: RADIUS.small,
    ...PIXEL_SHADOW,
  },
  s4BestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
  },
  s4BestIcon: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#B98F1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  s4BestLabel: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: '#B98F1A',
    letterSpacing: 2,
  },
  s4BestText: {
    marginTop: 2,
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  s4Ctas: {
    paddingHorizontal: SPACING[16],
    paddingTop: SPACING[16],
    gap: 10,
  },
  s4FinishWrap: {
    borderRadius: RADIUS.small,
    ...PIXEL_SHADOW,
  },
  s4FinishBtn: {
    paddingVertical: 14,
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: '#004E2C',
    alignItems: 'center',
  },
  s4FinishText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: COLORS.textPrimary,
    letterSpacing: 2,
    fontWeight: '800',
  },
  s4FinishSub: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 10,
    color: 'rgba(240,244,247,0.7)',
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  s4MenuBtn: {
    paddingVertical: 12,
    borderRadius: RADIUS.small,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    ...PIXEL_SHADOW,
  },
  s4MenuText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    fontWeight: '800',
  },

  // ── Screen 5 — Champion ──────────────────────────────────────────────────
  s5Scroll: {
    paddingHorizontal: SPACING[20],
    paddingTop: SPACING[16],
    paddingBottom: SPACING[32],
    alignItems: 'center',
  },
  s5Eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#B98F1A',
    borderRadius: 4,
    marginBottom: 14,
    ...PIXEL_SHADOW,
  },
  s5EyebrowDiamond: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.gold,
  },
  s5EyebrowText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.gold,
    letterSpacing: 3,
    fontWeight: '800',
  },
  s5FlagShadow: {
    borderRadius: 12,
    marginBottom: 14,
    ...PIXEL_SHADOW,
  },
  s5FlagCard: {
    width: 180,
    height: 130,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 3,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  s5Nation: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 42,
    color: COLORS.gold,
    letterSpacing: 3,
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: '800',
  },
  s5PhraseShadow: {
    borderRadius: RADIUS.small,
    marginBottom: 18,
    ...PIXEL_SHADOW,
  },
  s5PhraseCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    alignItems: 'center',
  },
  s5PhraseLocal: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 15,
    color: COLORS.textPrimary,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
  s5PhraseDivider: {
    width: '100%',
    marginVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderStyle: 'dashed',
  },
  s5PhraseEn: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1,
    textAlign: 'center',
  },
  s5TrophyShadow: {
    borderRadius: RADIUS.medium,
    marginBottom: 14,
    ...PIXEL_SHADOW,
  },
  s5TrophyCard: {
    paddingHorizontal: 26,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: '#B98F1A',
    borderRadius: RADIUS.medium,
    alignItems: 'center',
    gap: 8,
  },
  s5TrophyLabel: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: '#B98F1A',
    letterSpacing: 1.5,
  },
  s5StatsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 18,
    width: '100%',
  },
  s5MiniStat: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 5,
    alignItems: 'center',
    gap: 2,
  },
  s5MiniStatValue: {
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  s5MiniStatLabel: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 8,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
  },
  s5ShareWrap: {
    width: '100%',
    borderRadius: RADIUS.small,
    marginBottom: 10,
    ...PIXEL_SHADOW,
  },
  s5ShareBtn: {
    paddingVertical: 15,
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: '#B98F1A',
    alignItems: 'center',
  },
  s5ShareText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 15,
    color: COLORS.background,
    letterSpacing: 3,
    fontWeight: '800',
  },
  s5MenuBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: RADIUS.small,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    ...PIXEL_SHADOW,
  },
  s5MenuText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    fontWeight: '800',
  },

  // ── Overlays ─────────────────────────────────────────────────────────────
  overlayFull: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: '#000',
  },
  overlayWebView: { flex: 1 },
  overlayHeader: {
    height: 44,
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING[8],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  overlayHeaderContext: {
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 10,
    color: COLORS.gold,
    letterSpacing: 1,
    flex: 1,
  },
  overlayHeaderTeams: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: COLORS.textPrimary,
    textAlign: 'center',
    flex: 1,
  },
  overlayHeaderClose: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  overlayCloseBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 101,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCloseBtnText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '800',
  },
});
