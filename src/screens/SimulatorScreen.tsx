import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ListRenderItem,
  Alert,
  Dimensions,
  Modal,
  TextInput,
  Animated,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useSimulator } from '../hooks/useSimulator';
import { NATIONS, NATIONS_BY_ID, NATIONS_BY_GROUP } from '../constants/nations';
import { GROUP_FIXTURES, GROUPS, fixturesByGroup } from '../constants/fixtures';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, PIXEL_SHADOW } from '../theme';
import { cardGreen, cardTeal } from '../theme/gradients';
import { MatchEvent, Team, EventType } from '../types/simulator';
import { BottomTabParamList } from '../navigation/BottomTabNavigator';
import {
  useSimulatorStore,
  selectSimStandings,
  selectSimResult,
  isSimulated,
} from '../store/useSimulatorStore';
import { simulateMatch, computeScore } from '../utils/simulator';
import { resolveKnockoutBracket } from '../utils/knockoutEngine';
import { ResolvedKnockoutMatch } from '../types/knockout';
import { KNOCKOUT_MATCHES } from '../constants/knockoutBracket';
import { MatchResult } from '../types/matchResult';
import KnockoutBracket from '../components/KnockoutBracket';
import PixelFlag from '../components/PixelFlag';
import { animateScore } from '../utils/scoreAnimation';
import { getMatchSimHTML, MatchSimConfig } from '../assets/match-sim/matchSim';
import { resolveKitColors } from '../utils/kitColors';

const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Kit colour map (hex number → injected into Phaser WebView) ───────────────
const KIT_COLORS: Record<string, number> = {
  mex:0x006847, rsa:0x007A4D, kor:0xC60C30, cze:0xD7141A,
  can:0xFF0000, bih:0x002395, qat:0x8D1B3D, swi:0xFF0000,
  bra:0x009c3b, mor:0xC1272D, hai:0x00209F, sco:0x003F87,
  usa:0x002868, par:0xD52B1E, aus:0x00843D, tur:0xE30A17,
  ger:0x000000, cur:0x003DA5, civ:0xFF8000, ecua:0xFFD100,
  ned:0xFF6600, jpn:0xBC002D, swe:0x006AA7, tun:0xE70013,
  bel:0xED2939, egy:0xC8102E, iri:0x239F40, nzl:0x00247D,
  spa:0xAA151B, cpv:0x003893, ksa:0x006C35, uru:0x5EB6E4,
  fra:0x003189, sen:0x00853F, irq:0xCE1126, nor:0xEF2B2D,
  arg:0x74ACDF, alg:0x006233, aut:0xED2939, jor:0x007A3D,
  por:0x006600, cod:0x007FFF, uzb:0x1EB53A, col:0xFCD116,
  eng:0xCF081F, cro:0xFF0000, gha:0x006B3F, pan:0xDB001B,
};

type Props = BottomTabScreenProps<BottomTabParamList, 'Simulator'>;
type SimMode     = 'match' | 'tournament';
type TourneyView = 'groups' | 'knockout' | 'matchdays';

// ─── Event icons / colours ────────────────────────────────────────────────────
const EVENT_ICON: Record<EventType, string> = {
  goal: '⚽', yellow_card: '🟨', red_card: '🟥', save: '🧤',
  foul: '🦶', var_check: '📺', injury: '🏥',
  kickoff: '🏁', halftime: '⏸️', fulltime: '🏆',
};

const EVENT_COLOR: Record<EventType, string> = {
  goal:        COLORS.gold,
  yellow_card: COLORS.gold,
  red_card:    COLORS.red,
  save:        COLORS.teal,
  foul:        '#F7AC38',
  var_check:   '#c084fc',
  injury:      '#F7AC38',
  kickoff:     COLORS.textSecondary,
  halftime:    COLORS.textSecondary,
  fulltime:    COLORS.gold,
};

// ─── Quick Match presets ──────────────────────────────────────────────────────
const QUICK_MATCHES: Array<{ home: string; away: string; label: string }> = [
  { home: 'arg', away: 'fra', label: 'WC 2022 FINAL' },
  { home: 'arg', away: 'bra', label: 'CLASSIC RIVALS' },
  { home: 'spa', away: 'por', label: 'CLÁSICO' },
  { home: 'ger', away: 'ned', label: 'GROUP OF DEATH' },
  { home: 'tur', away: 'eng', label: 'TURKEY CLASH' },
  { home: 'mor', away: 'jpn', label: 'UNDERDOGS' },
];

// ─── Pixel glyph ──────────────────────────────────────────────────────────────
type GlyphKind = 'trophy' | 'bolt' | 'ball' | 'chev' | 'back' | 'close';
const GLYPHS: Record<GlyphKind, string[]> = {
  trophy: ['111111','011110','011110','001100','011110','111111'],
  bolt:   ['000110','001100','011100','111100','001100','011000'],
  ball:   ['011110','110011','101101','101101','110011','011110'],
  chev:   ['010000','011000','011100','011100','011000','010000'],
  back:   ['000010','000110','001110','001110','000110','000010'],
  close:  ['100001','110011','011110','011110','110011','100001'],
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

// ─── Scoreboard (used by text-sim fallback flow) ──────────────────────────────
function Scoreboard({ homeTeam, awayTeam, homeScore, awayScore, minute, status }: {
  homeTeam: Team; awayTeam: Team;
  homeScore: number; awayScore: number;
  minute: number; status: string;
}) {
  const minuteLabel =
    status === 'running'  ? `⏱ ${minute}'` :
    status === 'finished' ? 'FULL TIME' : 'KICK OFF';
  return (
    <View style={styles.sbShadow}>
      <LinearGradient {...cardGreen} style={styles.sbCard}>
        <View style={styles.sbTeam}>
          <PixelFlag isoCode={homeTeam.isoCode} size={36} />
          <Text style={styles.sbName} numberOfLines={1}>{homeTeam.code3}</Text>
        </View>
        <View style={styles.sbCenter}>
          <Text style={styles.sbNumbers}>{homeScore} – {awayScore}</Text>
          <Text style={styles.sbMinute}>{minuteLabel}</Text>
        </View>
        <View style={[styles.sbTeam, styles.sbTeamRight]}>
          <PixelFlag isoCode={awayTeam.isoCode} size={36} />
          <Text style={styles.sbName} numberOfLines={1}>{awayTeam.code3}</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

// ─── Event item ───────────────────────────────────────────────────────────────
function EventItem({ event, homeId }: { event: MatchEvent; homeId: string }) {
  const isNeutral = event.teamId === '';
  const side  = isNeutral ? '' : event.teamId === homeId ? 'H' : 'A';
  const color = EVENT_COLOR[event.type];
  return (
    <View style={styles.evRow}>
      <Text style={styles.evIcon}>{EVENT_ICON[event.type]}</Text>
      <View style={styles.evBody}>
        <Text style={[styles.evMinute, { color }]}>
          {event.minute > 0 ? `${event.minute}'` : '0'}{side ? `  [${side}]` : ''}
        </Text>
        <Text style={styles.evCommentary}>{event.commentary}</Text>
      </View>
    </View>
  );
}

// ─── Formatting helpers ───────────────────────────────────────────────────────
function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Tournament standings row ─────────────────────────────────────────────────
function TourneyStandingRow({ team, standing, rank, isLast }: {
  team: Team;
  standing: ReturnType<typeof selectSimStandings>[number] | undefined;
  rank: number;
  isLast: boolean;
}) {
  const qualifies = rank <= 2;
  const gd        = standing ? standing.goalsFor - standing.goalsAgainst : 0;
  const gdColor   = gd > 0 ? COLORS.green : gd < 0 ? COLORS.red : COLORS.textSecondary;
  return (
    <View style={[styles.standRow, !isLast && styles.standRowBorder]}>
      {qualifies && <View style={styles.standQualBar} />}
      <Text style={styles.standRank}>{rank}</Text>
      <View style={styles.standFlagWrap}>
        <PixelFlag isoCode={team.isoCode} size={16} />
      </View>
      <Text style={styles.standName} numberOfLines={1}>{team.code3}</Text>
      <Text style={styles.standStat}>{standing?.played  ?? 0}</Text>
      <Text style={styles.standStat}>{standing?.won     ?? 0}</Text>
      <Text style={styles.standStat}>{standing?.drawn   ?? 0}</Text>
      <Text style={styles.standStat}>{standing?.lost    ?? 0}</Text>
      <Text style={[styles.standStat, { color: gdColor }]}>
        {gd >= 0 ? '+' : ''}{gd}
      </Text>
      <Text style={styles.standPts}>{standing?.points ?? 0}</Text>
    </View>
  );
}

// ─── Tournament fixture card ──────────────────────────────────────────────────
function TourneyFixtureCard({
  fixture, result, groupBadge, onQuickSim, onLongSim, onReset, animating,
}: {
  fixture: typeof GROUP_FIXTURES[number];
  result: MatchResult | null;
  groupBadge?: string;
  onQuickSim: () => void;
  onLongSim?: () => void;
  onReset?: () => void;
  animating?: boolean;
}) {
  const home = NATIONS_BY_ID[fixture.homeTeamId];
  const away = NATIONS_BY_ID[fixture.awayTeamId];
  const [dispHome, setDispHome] = useState(result?.homeScore ?? 0);
  const [dispAway, setDispAway] = useState(result?.awayScore ?? 0);

  useEffect(() => {
    if (!result) { setDispHome(0); setDispAway(0); return; }
    if (animating) {
      const c1 = animateScore(result.homeScore, setDispHome);
      const c2 = animateScore(result.awayScore, setDispAway);
      return () => { c1(); c2(); };
    } else {
      setDispHome(result.homeScore);
      setDispAway(result.awayScore);
    }
  }, [result?.homeScore, result?.awayScore, animating]);

  if (!home || !away) return null;
  const isPlayed    = result !== null;
  const homeWinner  = isPlayed && result!.homeScore > result!.awayScore;
  const awayWinner  = isPlayed && result!.awayScore > result!.homeScore;

  return (
    <View style={styles.tfxShadow}>
      <LinearGradient {...cardGreen} style={styles.tfxCard}>
        <View style={styles.tfxRow}>
          <View style={styles.tfxTeam}>
            <PixelFlag isoCode={home.isoCode} size={20} />
            <Text style={[styles.tfxCode, !homeWinner && isPlayed && styles.tfxCodeMuted]} numberOfLines={1}>
              {home.code3}
            </Text>
          </View>
          {isPlayed ? (
            <View style={styles.tfxScoreBox}>
              <Text style={styles.tfxScore}>{dispHome} – {dispAway}</Text>
              <Text style={styles.tfxScoreLabel}>FT</Text>
            </View>
          ) : (
            <Text style={styles.tfxVs}>VS</Text>
          )}
          <View style={[styles.tfxTeam, styles.tfxTeamRight]}>
            <Text style={[styles.tfxCode, styles.tfxCodeRight, !awayWinner && isPlayed && styles.tfxCodeMuted]} numberOfLines={1}>
              {away.code3}
            </Text>
            <PixelFlag isoCode={away.isoCode} size={20} />
          </View>
        </View>
        <View style={styles.tfxMeta}>
          <Text style={styles.tfxDate}>{formatDate(fixture.date)}</Text>
          <Text style={styles.tfxVenue} numberOfLines={1}>{fixture.venue}</Text>
          {groupBadge && (
            <View style={styles.tfxGroupBadge}>
              <Text style={styles.tfxGroupBadgeText}>{groupBadge.toUpperCase()}</Text>
            </View>
          )}
          {isPlayed ? (
            <View style={styles.tfxBtnRow}>
              <TouchableOpacity style={styles.tfxBtnQuick} onPress={onQuickSim} activeOpacity={0.75}>
                <Text style={styles.tfxBtnQuickText}>⚡ RE-SIM</Text>
              </TouchableOpacity>
              {onReset && (
                <TouchableOpacity style={styles.tfxBtnReset} onPress={onReset} activeOpacity={0.75}>
                  <Text style={styles.tfxBtnResetText}>↺</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.tfxBtnRow}>
              {onLongSim && (
                <TouchableOpacity style={styles.tfxBtnLong} onPress={onLongSim} activeOpacity={0.75}>
                  <Text style={styles.tfxBtnLongText}>▶</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.tfxBtnQuick} onPress={onQuickSim} activeOpacity={0.75}>
                <Text style={styles.tfxBtnQuickText}>⚡ SIM</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

// ─── Quick-sim helper ─────────────────────────────────────────────────────────
function runQuickSim(
  fixture: typeof GROUP_FIXTURES[number],
  saveResult: (r: MatchResult) => void,
): void {
  const home = NATIONS_BY_ID[fixture.homeTeamId];
  const away = NATIONS_BY_ID[fixture.awayTeamId];
  if (!home || !away) return;
  const events = simulateMatch(home, away, 'en');
  const score  = computeScore(events, home.id, away.id);
  saveResult({
    fixtureId:   fixture.id,
    homeTeamId:  home.id,
    awayTeamId:  away.id,
    homeScore:   score.home,
    awayScore:   score.away,
    events,
    simulatedAt: Date.now(),
  });
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function SimulatorScreen({ route }: Props) {
  const insets = useSafeAreaInsets();
  // ── MATCH mode state (preserved) ──────────────────────────────────────────
  const { state, selectHomeTeam, selectAwayTeam, resetMatch, setTeamsAndStart } = useSimulator();
  const feedRef   = useRef<FlatList<MatchEvent>>(null);
  const fixtureId = route.params?.fixtureId;

  // ── Mode + Tournament sub-view (preserved) ────────────────────────────────
  const [simMode,        setSimMode]       = useState<SimMode>('match');
  const [tourneyView,    setTourneyView]   = useState<TourneyView>('groups');
  const [activeGroup,    setActiveGroup]   = useState<string>('A');
  const [activeMatchday, setActiveMatchday] = useState<1 | 2 | 3>(1);
  const [pickerStep,     setPickerStep]    = useState<'home' | 'away'>('home');
  const [justSimmedId,   setJustSimmedId]  = useState<string | null>(null);

  // ── WebView match state (preserved) ───────────────────────────────────────
  const [webViewActive,  setWebViewActive] = useState(false);
  const [webMatchDone,   setWebMatchDone]  = useState(false);
  const pendingMatchRef = useRef<{
    homeTeam: Team; awayTeam: Team;
    homeScore: number; awayScore: number;
    events: ReturnType<typeof simulateMatch>;
  } | null>(null);
  const matchHtmlRef = useRef<string>('');

  // ── Visual-only state (new — picker modal + search) ───────────────────────
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Simulator store (preserved) ───────────────────────────────────────────
  const results         = useSimulatorStore((s) => s.results);
  const standings       = useSimulatorStore((s) => s.standings);
  const knockoutResults = useSimulatorStore((s) => s.knockoutResults);
  const saveResult      = useSimulatorStore((s) => s.saveResult);
  const saveKnockoutResult = useSimulatorStore((s) => s.saveKnockoutResult);
  const clearAll        = useSimulatorStore((s) => s.clearAll);

  // ── Auto-start when navigated with team params (preserved) ────────────────
  useEffect(() => {
    const homeId = route.params?.homeTeamId;
    const awayId = route.params?.awayTeamId;
    if (homeId && awayId) {
      const home = NATIONS_BY_ID[homeId];
      const away = NATIONS_BY_ID[awayId];
      if (home && away) {
        setSimMode('match');
        setTeamsAndStart(home, away);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.homeTeamId, route.params?.awayTeamId]);

  // ── Save match result to simulator store on finish (preserved) ────────────
  useEffect(() => {
    if (state.status !== 'finished' || !state.homeTeam || !state.awayTeam) return;
    const fid = fixtureId ?? `adhoc-${state.homeTeam.id}-${state.awayTeam.id}-${Date.now()}`;
    if (fid.startsWith('ko-')) {
      const matchId = parseInt(fid.replace('ko-', ''), 10);
      if (!isNaN(matchId)) {
        saveKnockoutResult({
          matchId,
          homeTeamId: state.homeTeam.id,
          awayTeamId: state.awayTeam.id,
          homeScore:  state.homeScore,
          awayScore:  state.awayScore,
          events:     state.events,
          simulatedAt: Date.now(),
        });
        return;
      }
    }
    saveResult({
      fixtureId:   fid,
      homeTeamId:  state.homeTeam.id,
      awayTeamId:  state.awayTeam.id,
      homeScore:   state.homeScore,
      awayScore:   state.awayScore,
      events:      state.events,
      simulatedAt: Date.now(),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // ── Auto-scroll event feed (preserved) ────────────────────────────────────
  useEffect(() => {
    if (state.events.length > 0) feedRef.current?.scrollToEnd({ animated: true });
  }, [state.events.length]);

  // ── Tournament helpers (preserved) ────────────────────────────────────────
  const sortedStandings = selectSimStandings(standings, activeGroup);
  const standingByTeam  = Object.fromEntries(sortedStandings.map((s) => [s.teamId, s]));
  const groupTeams: Team[] = sortedStandings.length === 4
    ? sortedStandings.map((s) => NATIONS_BY_ID[s.teamId]).filter(Boolean) as Team[]
    : (NATIONS_BY_GROUP[activeGroup] ?? []);
  const groupFixtures    = fixturesByGroup(activeGroup);
  const simulatedCount   = groupFixtures.filter((f) => isSimulated(results, f.id)).length;

  const matchdayFixtures = GROUP_FIXTURES
    .filter((f) => f.matchday === activeMatchday)
    .sort((a, b) => a.date.localeCompare(b.date));
  const matchdayPending = matchdayFixtures.filter((f) => !isSimulated(results, f.id)).length;

  const resolvedBracket = resolveKnockoutBracket(standings, results, knockoutResults);

  // ── Tournament actions (preserved) ────────────────────────────────────────
  const handleQuickSim = useCallback((fixture: typeof GROUP_FIXTURES[number]) => {
    runQuickSim(fixture, saveResult);
    setJustSimmedId(fixture.id);
    setTimeout(() => setJustSimmedId(null), 700);
  }, [saveResult]);

  const handleSimAll = useCallback((fixtures: typeof GROUP_FIXTURES) => {
    const pending = fixtures.filter((f) => !isSimulated(results, f.id));
    pending.forEach((f) => runQuickSim(f, saveResult));
  }, [results, saveResult]);

  const handleKnockoutQuickSim = useCallback((match: ResolvedKnockoutMatch) => {
    if (!match.homeTeamId || !match.awayTeamId) return;
    const home = NATIONS_BY_ID[match.homeTeamId];
    const away = NATIONS_BY_ID[match.awayTeamId];
    if (!home || !away) return;
    const events = simulateMatch(home, away, 'en');
    const score  = computeScore(events, home.id, away.id);
    const homeScore = score.home === score.away ? score.home + 1 : score.home;
    saveKnockoutResult({
      matchId:    match.def.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      homeScore,
      awayScore:  score.away,
      events,
      simulatedAt: Date.now(),
    });
  }, [saveKnockoutResult]);

  const handleSimulateWC = useCallback(() => {
    Alert.alert(
      'Simulate Entire Tournament?',
      'This will instantly simulate all 64 remaining matches and produce a winner.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '⚡ Simulate!',
          onPress: () => {
            const store = useSimulatorStore.getState();
            GROUP_FIXTURES.filter((f) => !(f.id in store.results)).forEach((f) => {
              const h = NATIONS_BY_ID[f.homeTeamId];
              const a = NATIONS_BY_ID[f.awayTeamId];
              if (!h || !a) return;
              const evts = simulateMatch(h, a, 'en');
              const sc   = computeScore(evts, h.id, a.id);
              store.saveResult({ fixtureId: f.id, homeTeamId: h.id, awayTeamId: a.id, homeScore: sc.home, awayScore: sc.away, events: evts, simulatedAt: Date.now() });
            });
            for (let round = 0; round < 32; round++) {
              const fresh    = useSimulatorStore.getState();
              const resolved = resolveKnockoutBracket(fresh.standings, fresh.results, fresh.knockoutResults);
              const next     = resolved.find((m) => m.result === null && m.homeTeamId !== null && m.awayTeamId !== null);
              if (!next) break;
              const h = NATIONS_BY_ID[next.homeTeamId!];
              const a = NATIONS_BY_ID[next.awayTeamId!];
              if (!h || !a) break;
              const evts = simulateMatch(h, a, 'en');
              const sc   = computeScore(evts, h.id, a.id);
              const hs   = sc.home === sc.away ? sc.home + 1 : sc.home;
              fresh.saveKnockoutResult({ matchId: next.def.id, homeTeamId: h.id, awayTeamId: a.id, homeScore: hs, awayScore: sc.away, events: evts, simulatedAt: Date.now() });
            }
            const final = useSimulatorStore.getState();
            const finalResolved = resolveKnockoutBracket(final.standings, final.results, final.knockoutResults);
            const finalMatch = finalResolved.find((m) => m.def.round === 'Final' && m.result !== null);
            if (finalMatch?.result) {
              const r = finalMatch.result;
              const winner = r.homeScore >= r.awayScore ? NATIONS_BY_ID[r.homeTeamId] : NATIONS_BY_ID[r.awayTeamId];
              if (winner) Alert.alert('🏆 World Football Championship Winner!', `${winner.flag} ${winner.name}`);
            }
          },
        },
      ],
    );
  }, []);

  const handleReset = useCallback(() => {
    Alert.alert('Reset Simulator?', 'This will clear all simulated results and standings.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => clearAll() },
    ]);
  }, [clearAll]);

  // ── Tournament sim overlay (preserved) ────────────────────────────────────
  const [tourneyOverlay, setTourneyOverlay] = useState<{
    key: string; html: string;
    homeTeamId: string; awayTeamId: string;
    fixtureId?: string; matchId?: number;
    simScore: { home: number; away: number };
    simEvents: MatchEvent[];
    contextLabel: string; teamsLabel: string;
  } | null>(null);

  const handleTourneyLongSim = useCallback((fixture: typeof GROUP_FIXTURES[number]) => {
    const home = NATIONS_BY_ID[fixture.homeTeamId];
    const away = NATIONS_BY_ID[fixture.awayTeamId];
    if (!home || !away) return;
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
    setTourneyOverlay({
      key: `tsim-grp-${fixture.id}-${Date.now()}`,
      html: getMatchSimHTML(config),
      homeTeamId: home.id, awayTeamId: away.id,
      fixtureId: fixture.id, simScore: score, simEvents: events,
      contextLabel: `GROUP ${fixture.group} · MATCHDAY ${fixture.matchday}`,
      teamsLabel: `${home.code3} vs ${away.code3}`,
    });
  }, []);

  const handleKnockoutLongSim = useCallback((match: ResolvedKnockoutMatch) => {
    if (!match.homeTeamId || !match.awayTeamId) return;
    const home = NATIONS_BY_ID[match.homeTeamId];
    const away = NATIONS_BY_ID[match.awayTeamId];
    if (!home || !away) return;
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
    setTourneyOverlay({
      key: `tsim-ko-${match.def.id}-${Date.now()}`,
      html: getMatchSimHTML(config),
      homeTeamId: home.id, awayTeamId: away.id,
      matchId: match.def.id, simScore: score, simEvents: events,
      contextLabel: `KNOCKOUT · ${match.def.round}`,
      teamsLabel: `${home.code3} vs ${away.code3}`,
    });
  }, []);

  const handleTourneyOverlayMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type !== 'MATCH_RESULT') return;
      const ov = tourneyOverlay;
      if (!ov) return;
      if (ov.fixtureId && !ov.matchId) {
        useSimulatorStore.getState().saveResult({
          fixtureId: ov.fixtureId, homeTeamId: ov.homeTeamId, awayTeamId: ov.awayTeamId,
          homeScore: ov.simScore.home, awayScore: ov.simScore.away,
          events: ov.simEvents, simulatedAt: Date.now(),
        });
      } else if (ov.matchId != null) {
        const hs = ov.simScore.home === ov.simScore.away ? ov.simScore.home + 1 : ov.simScore.home;
        useSimulatorStore.getState().saveKnockoutResult({
          matchId: ov.matchId, homeTeamId: ov.homeTeamId, awayTeamId: ov.awayTeamId,
          homeScore: hs, awayScore: ov.simScore.away,
          events: ov.simEvents, simulatedAt: Date.now(),
        });
      }
      setTourneyOverlay(null);
    } catch (_) {}
  }, [tourneyOverlay]);

  // ── Group fixture reset (preserved) ───────────────────────────────────────
  const handleResetGroupFixture = useCallback((fixtureId: string) => {
    const fixture = GROUP_FIXTURES.find((f) => f.id === fixtureId);
    if (!fixture) return;
    const group = fixture.group;
    const currentResults = useSimulatorStore.getState().results;
    const gFixtures = GROUP_FIXTURES.filter((f) => f.group === group);
    const otherResults = gFixtures
      .filter((f) => f.id !== fixtureId && currentResults[f.id])
      .map((f) => currentResults[f.id]);
    useSimulatorStore.getState().clearGroupResults(group);
    for (const r of otherResults) {
      useSimulatorStore.getState().saveResult(r);
    }
  }, []);

  // ── Knockout match reset with cascade (preserved) ─────────────────────────
  const handleResetKnockoutMatch = useCallback((match: ResolvedKnockoutMatch) => {
    const dependents = new Set<number>();
    const queue = [match.def.id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      dependents.add(current);
      for (const m of KNOCKOUT_MATCHES) {
        if (dependents.has(m.id)) continue;
        const refs = [m.homeSource, m.awaySource];
        for (const src of refs) {
          if ((src.kind === 'winner' || src.kind === 'loser') && src.matchId === current) {
            queue.push(m.id);
          }
        }
      }
    }
    useSimulatorStore.setState((state) => {
      const newKO = { ...state.knockoutResults };
      dependents.forEach((id) => { delete newKO[id]; });
      return { knockoutResults: newKO };
    });
  }, []);

  // ── WebView kick-off (preserved) ──────────────────────────────────────────
  const handleKickOff = useCallback(() => {
    const home = state.homeTeam;
    const away = state.awayTeam;
    if (!home || !away || home.id === away.id) return;
    const events = simulateMatch(home, away, 'en');
    const score  = computeScore(events, home.id, away.id);
    pendingMatchRef.current = { homeTeam: home, awayTeam: away, homeScore: score.home, awayScore: score.away, events };
    const resolved = resolveKitColors(home.id, away.id, KIT_COLORS);
    const config: MatchSimConfig = {
      homeId:         home.id,
      homeName:       home.name,
      homeCode:       home.code3,
      homeColor:      resolved.homeColor,
      homeStrength:   home.strength,
      homeFormation:  home.formation ?? '4-4-2',
      awayId:         away.id,
      awayName:       away.name,
      awayCode:       away.code3,
      awayColor:      resolved.awayColor,
      awayStrength:   away.strength,
      awayFormation:  away.formation ?? '4-4-2',
      events: events.map((e) => ({ type: e.type, teamId: e.teamId, minute: e.minute })),
      seed: Date.now() % 99991,
    };
    console.log('[MatchSim]', config.homeCode, 'vs', config.awayCode, 'events:', config.events.length);
    matchHtmlRef.current = getMatchSimHTML(config);
    setWebMatchDone(false);
    setWebViewActive(true);
  }, [state.homeTeam, state.awayTeam]);

  const handleWebViewMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type !== 'MATCH_RESULT') return;
      const pm = pendingMatchRef.current;
      if (!pm) return;
      setWebMatchDone(true);
      const fid = fixtureId ?? `adhoc-${pm.homeTeam.id}-${pm.awayTeam.id}-${Date.now()}`;
      if (fid.startsWith('ko-')) {
        const matchId = parseInt(fid.replace('ko-', ''), 10);
        if (!isNaN(matchId)) {
          saveKnockoutResult({ matchId, homeTeamId: pm.homeTeam.id, awayTeamId: pm.awayTeam.id, homeScore: pm.homeScore, awayScore: pm.awayScore, events: pm.events, simulatedAt: Date.now() });
          return;
        }
      }
      saveResult({ fixtureId: fid, homeTeamId: pm.homeTeam.id, awayTeamId: pm.awayTeam.id, homeScore: pm.homeScore, awayScore: pm.awayScore, events: pm.events, simulatedAt: Date.now() });
    } catch {
      // ignore malformed messages
    }
  }, [fixtureId, saveResult, saveKnockoutResult]);

  const handleNewMatch = useCallback(() => {
    setWebViewActive(false);
    setWebMatchDone(false);
    pendingMatchRef.current = null;
    resetMatch();
    setPickerStep('home');
  }, [resetMatch]);

  // ── UI-only handlers ──────────────────────────────────────────────────────
  const openPicker = useCallback((side: 'home' | 'away') => {
    setPickerStep(side);
    setSearchQuery('');
    setPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setSearchQuery('');
  }, []);

  const handlePickNation = useCallback((team: Team) => {
    if (pickerStep === 'home') selectHomeTeam(team);
    else selectAwayTeam(team);
    closePicker();
  }, [pickerStep, selectHomeTeam, selectAwayTeam, closePicker]);

  const handleShuffle = useCallback(() => {
    const i = Math.floor(Math.random() * NATIONS.length);
    let j = Math.floor(Math.random() * NATIONS.length);
    while (j === i) j = Math.floor(Math.random() * NATIONS.length);
    selectHomeTeam(NATIONS[i]);
    selectAwayTeam(NATIONS[j]);
  }, [selectHomeTeam, selectAwayTeam]);

  const handleQuickMatchPreset = useCallback((homeId: string, awayId: string) => {
    const h = NATIONS_BY_ID[homeId];
    const a = NATIONS_BY_ID[awayId];
    if (h && a) {
      selectHomeTeam(h);
      selectAwayTeam(a);
    }
  }, [selectHomeTeam, selectAwayTeam]);

  // Filtered nation list for picker modal
  const filteredNations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = [...NATIONS].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list;
    return list.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.code3.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  // Derived
  const bothSelected = state.homeTeam !== null && state.awayTeam !== null;
  const sameTeam     = state.homeTeam?.id === state.awayTeam?.id;
  const canKickOff   = bothSelected && !sameTeam;

  const renderEvent: ListRenderItem<MatchEvent> = ({ item }) => (
    <EventItem event={item} homeId={state.homeTeam?.id ?? ''} />
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TOP TOGGLE (Head to Head / Tournament Sim)
  // ═══════════════════════════════════════════════════════════════════════════
  const topToggle = (
    <View style={styles.topToggleWrap}>
      <View style={styles.topToggleInner}>
        {(['match', 'tournament'] as SimMode[]).map((m) => {
          const active = simMode === m;
          const label  = m === 'match' ? 'HEAD TO HEAD' : 'TOURNAMENT SIM';
          return (
            <TouchableOpacity
              key={m}
              activeOpacity={0.8}
              style={styles.topToggleSlot}
              onPress={() => setSimMode(m)}
            >
              {active ? (
                <LinearGradient {...cardGreen} style={styles.topToggleSeg}>
                  <Text style={styles.topToggleTextActive}>{label}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.topToggleSeg}>
                  <Text style={styles.topToggleText}>{label}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // NATION PICKER MODAL
  // ═══════════════════════════════════════════════════════════════════════════
  const pickerModal = (
    <Modal
      visible={pickerOpen}
      animationType="slide"
      transparent
      onRequestClose={closePicker}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>SELECT NATION</Text>
            <View style={styles.modalBadge}>
              <Text style={styles.modalBadgeText}>
                PICKING · {pickerStep === 'home' ? 'HOME' : 'AWAY'}
              </Text>
            </View>
            <TouchableOpacity onPress={closePicker} style={styles.modalClose} activeOpacity={0.7}>
              <Text style={styles.modalCloseX}>✕</Text>
            </TouchableOpacity>
          </View>
          {/* Search */}
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="SEARCH NATION..."
              placeholderTextColor={COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="characters"
            />
          </View>
          {/* List */}
          <ScrollView
            style={styles.modalList}
            contentContainerStyle={styles.modalListInner}
            keyboardShouldPersistTaps="handled"
          >
            {filteredNations.map((nation) => (
              <TouchableOpacity
                key={nation.id}
                style={styles.modalRow}
                activeOpacity={0.7}
                onPress={() => handlePickNation(nation)}
              >
                <PixelFlag isoCode={nation.isoCode} size={22} />
                <Text style={styles.modalRowName} numberOfLines={1}>{nation.name}</Text>
                <Text style={styles.modalRowCode}>{nation.code3}</Text>
              </TouchableOpacity>
            ))}
            {filteredNations.length === 0 && (
              <Text style={styles.modalEmpty}>No nations match "{searchQuery}"</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MATCH MODE
  // ═══════════════════════════════════════════════════════════════════════════
  if (simMode === 'match') {
    // ── Live WebView view ────────────────────────────────────────────────────
    if (webViewActive) {
      const pm = pendingMatchRef.current;
      return (
        <SafeAreaView style={styles.root}>
          {topToggle}
          {/* Top chrome bar */}
          <View style={styles.liveTopBar}>
            <TouchableOpacity onPress={handleNewMatch} style={styles.liveBackBtn} activeOpacity={0.7}>
              <PixelGlyph kind="back" color={COLORS.gold} />
            </TouchableOpacity>
            {pm && (
              <View style={styles.liveTopInfo}>
                <Text style={styles.liveTopCode}>{pm.homeTeam.code3}</Text>
                <Text style={styles.liveTopVs}>VS</Text>
                <Text style={styles.liveTopCode}>{pm.awayTeam.code3}</Text>
              </View>
            )}
            <View style={styles.liveStatusBadge}>
              <Text style={[styles.liveStatusText, webMatchDone && { color: COLORS.gold }]}>
                {webMatchDone ? 'FT' : 'LIVE'}
              </Text>
            </View>
          </View>

          {webMatchDone && pm ? (
            <View style={styles.matchResultScreen}>
              <View style={styles.matchResultShadow}>
                <LinearGradient {...cardGreen} style={styles.matchResultCard}>
                  <Text style={styles.matchResultTitle}>FULL TIME</Text>
                  <View style={styles.matchResultTeams}>
                    <View style={styles.matchResultTeam}>
                      <PixelFlag isoCode={pm.homeTeam.isoCode} size={40} />
                      <Text style={styles.matchResultCode}>{pm.homeTeam.code3}</Text>
                    </View>
                    <Text style={styles.matchResultScore}>{pm.homeScore} – {pm.awayScore}</Text>
                    <View style={styles.matchResultTeam}>
                      <PixelFlag isoCode={pm.awayTeam.isoCode} size={40} />
                      <Text style={styles.matchResultCode}>{pm.awayTeam.code3}</Text>
                    </View>
                  </View>
                  {pm.homeScore !== pm.awayScore && (
                    <Text style={styles.matchResultWinner}>
                      🏆 {pm.homeScore > pm.awayScore ? pm.homeTeam.code3 : pm.awayTeam.code3} WIN
                    </Text>
                  )}
                </LinearGradient>
              </View>
              <TouchableOpacity style={styles.ctaButton} onPress={handleNewMatch} activeOpacity={0.8}>
                <Text style={styles.ctaText}>🔄  NEW MATCH</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flex: 1, paddingBottom: 40 + insets.bottom }}>
              <WebView
                source={{ html: matchHtmlRef.current }}
                onMessage={handleWebViewMessage}
                style={styles.webViewMatch}
                javaScriptEnabled
                originWhitelist={['*']}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                scrollEnabled={false}
                bounces={false}
                overScrollMode="never"
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}
        </SafeAreaView>
      );
    }

    // ── Text-sim fallback flow (reachable via deep-link auto-start) ─────────
    if (state.status !== 'idle') {
      return (
        <SafeAreaView style={styles.root}>
          {topToggle}
          <Scoreboard
            homeTeam={state.homeTeam!}
            awayTeam={state.awayTeam!}
            homeScore={state.homeScore}
            awayScore={state.awayScore}
            minute={state.currentMinute}
            status={state.status}
          />
          <FlatList
            ref={feedRef}
            data={state.events}
            keyExtractor={(e) => e.id}
            renderItem={renderEvent}
            contentContainerStyle={[styles.feedContent, { paddingBottom: 120 + insets.bottom }]}
            style={styles.feed}
            onContentSizeChange={() => feedRef.current?.scrollToEnd({ animated: true })}
          />
          {state.status === 'finished' && (
            <TouchableOpacity style={styles.ctaButton} onPress={resetMatch} activeOpacity={0.8}>
              <Text style={styles.ctaText}>🔄  NEW MATCH</Text>
            </TouchableOpacity>
          )}
          {pickerModal}
        </SafeAreaView>
      );
    }

    // ── Team Select screen (idle) ──────────────────────────────────────────
    return (
      <SafeAreaView style={styles.root}>
        {topToggle}
        <ScrollView contentContainerStyle={[styles.h2hScroll, { paddingBottom: 120 + insets.bottom }]}>
          <Text style={styles.h2hTitle}>HEAD TO HEAD</Text>
          <Text style={styles.h2hSubtitle}>Tap a slot to pick a nation</Text>

          {/* Team slot cards with VS */}
          <View style={styles.slotRow}>
            <TeamSlot team={state.homeTeam} label="HOME" onPress={() => openPicker('home')} />
            <View style={styles.vsBadge}>
              <Text style={styles.vsText}>VS</Text>
            </View>
            <TeamSlot team={state.awayTeam} label="AWAY" onPress={() => openPicker('away')} />
          </View>

          {sameTeam && bothSelected && (
            <Text style={styles.sameTeamWarn}>⚠ Pick two different teams</Text>
          )}

          {/* Kick-off CTA */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleKickOff}
            disabled={!canKickOff}
            style={[styles.kickoffShadow, !canKickOff && { opacity: 0.5 }]}
          >
            <View style={styles.kickoffBtn}>
              <Text style={styles.kickoffBtnText}>⚡ KICK OFF MATCH</Text>
            </View>
          </TouchableOpacity>

          {/* Quick Match presets */}
          <View style={styles.quickSection}>
            <View style={styles.quickHeader}>
              <Text style={styles.quickLabel}>QUICK MATCH</Text>
              <TouchableOpacity onPress={handleShuffle} activeOpacity={0.7}>
                <Text style={styles.quickShuffle}>✕ SHUFFLE</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickList}
            >
              {QUICK_MATCHES.map((q, i) => {
                const h = NATIONS_BY_ID[q.home];
                const a = NATIONS_BY_ID[q.away];
                if (!h || !a) return null;
                return (
                  <TouchableOpacity
                    key={i}
                    activeOpacity={0.8}
                    onPress={() => handleQuickMatchPreset(q.home, q.away)}
                    style={styles.quickPillShadow}
                  >
                    <View style={styles.quickPill}>
                      <PixelFlag isoCode={h.isoCode} size={16} />
                      <Text style={styles.quickPillCodes}>
                        {h.code3} · {a.code3}
                      </Text>
                      <PixelFlag isoCode={a.isoCode} size={16} />
                      <Text style={styles.quickPillLabel}>{q.label}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>

        {pickerModal}
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOURNAMENT SIMULATION MODE
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={styles.root}>
      {topToggle}

      {/* Sub-view toggle */}
      <View style={styles.subTabsWrap}>
        <View style={styles.subTabsInner}>
          {(['groups', 'knockout', 'matchdays'] as TourneyView[]).map((v) => {
            const active = tourneyView === v;
            const label  = v === 'groups' ? 'GROUPS' : v === 'knockout' ? 'KNOCKOUT' : 'MATCHDAYS';
            return (
              <TouchableOpacity
                key={v}
                activeOpacity={0.8}
                style={styles.subTabSlot}
                onPress={() => setTourneyView(v)}
              >
                {active ? (
                  <LinearGradient {...cardGreen} style={styles.subTabSeg}>
                    <Text style={styles.subTabTextActive}>{label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.subTabSeg}>
                    <Text style={styles.subTabText}>{label}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Chip row (A-L for groups, MD for matchdays) */}
      {tourneyView !== 'knockout' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRowWrap}
          contentContainerStyle={styles.chipRow}
        >
          {tourneyView === 'groups'
            ? GROUPS.map((g) => {
                const active = activeGroup === g;
                return (
                  <TouchableOpacity
                    key={g}
                    activeOpacity={0.8}
                    onPress={() => setActiveGroup(g)}
                    style={styles.chipShadow}
                  >
                    {active ? (
                      <LinearGradient {...cardGreen} style={[styles.chip, styles.chipActive]}>
                        <Text style={styles.chipTextActive}>{g}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.chip}>
                        <Text style={styles.chipText}>{g}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            : ([1, 2, 3] as const).map((md) => {
                const active = activeMatchday === md;
                return (
                  <TouchableOpacity
                    key={md}
                    activeOpacity={0.8}
                    onPress={() => setActiveMatchday(md)}
                    style={styles.chipShadow}
                  >
                    {active ? (
                      <LinearGradient {...cardGreen} style={[styles.chipWide, styles.chipActive]}>
                        <Text style={styles.chipTextActive}>MD {md}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.chipWide}>
                        <Text style={styles.chipText}>MD {md}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
        </ScrollView>
      )}

      {/* ── GROUPS VIEW ──────────────────────────────────────────────────────── */}
      {tourneyView === 'groups' && (
        <ScrollView style={styles.content} contentContainerStyle={[styles.contentInner, { paddingBottom: 120 + insets.bottom }]}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>GROUP {activeGroup}</Text>
            <Text style={styles.sectionMeta}>{simulatedCount}/6 SIMULATED</Text>
          </View>

          {/* Standings card */}
          <View style={styles.standCardShadow}>
            <LinearGradient {...cardGreen} style={styles.standCard}>
              <View style={styles.standHead}>
                <Text style={[styles.standRank, styles.standHeadText]}>#</Text>
                <View style={styles.standFlagWrap} />
                <Text style={[styles.standName, styles.standHeadText]}>TEAM</Text>
                <Text style={[styles.standStat, styles.standHeadText]}>P</Text>
                <Text style={[styles.standStat, styles.standHeadText]}>W</Text>
                <Text style={[styles.standStat, styles.standHeadText]}>D</Text>
                <Text style={[styles.standStat, styles.standHeadText]}>L</Text>
                <Text style={[styles.standStat, styles.standHeadText]}>GD</Text>
                <Text style={[styles.standPts, styles.standHeadText]}>PTS</Text>
              </View>
              {groupTeams.map((t, i) => (
                <TourneyStandingRow
                  key={t.id}
                  team={t}
                  standing={standingByTeam[t.id]}
                  rank={i + 1}
                  isLast={i === groupTeams.length - 1}
                />
              ))}
            </LinearGradient>
          </View>

          {/* Matchday sections */}
          {([1, 2, 3] as const).map((md) => {
            const mdFixtures = groupFixtures.filter((f) => f.matchday === md);
            const mdPending  = mdFixtures.filter((f) => !isSimulated(results, f.id)).length;
            return (
              <View key={md}>
                <View style={styles.mdHeadRow}>
                  <Text style={styles.mdHeadLabel}>MATCHDAY {md}</Text>
                  {mdPending > 0 && (
                    <TouchableOpacity style={styles.simAllBtn} onPress={() => handleSimAll(mdFixtures)} activeOpacity={0.75}>
                      <Text style={styles.simAllBtnText}>⚡ SIM ALL</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {mdFixtures.map((fixture) => (
                  <TourneyFixtureCard
                    key={fixture.id}
                    fixture={fixture}
                    result={selectSimResult(results, fixture.id)}
                    onQuickSim={() => handleQuickSim(fixture)}
                    onLongSim={() => handleTourneyLongSim(fixture)}
                    onReset={() => handleResetGroupFixture(fixture.id)}
                    animating={justSimmedId === fixture.id}
                  />
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── MATCHDAYS VIEW ───────────────────────────────────────────────────── */}
      {tourneyView === 'matchdays' && (
        <ScrollView style={styles.content} contentContainerStyle={[styles.contentInner, { paddingBottom: 120 + insets.bottom }]}>
          <View style={styles.mdViewHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>MATCHDAY {activeMatchday}</Text>
              <Text style={styles.sectionMeta}>
                {matchdayFixtures.length - matchdayPending}/{matchdayFixtures.length} SIMULATED
              </Text>
            </View>
            {matchdayPending > 0 && (
              <TouchableOpacity
                style={styles.simAllMdBtn}
                onPress={() => handleSimAll(matchdayFixtures)}
                activeOpacity={0.8}
              >
                <Text style={styles.simAllMdBtnText}>⚡ SIM ALL</Text>
              </TouchableOpacity>
            )}
          </View>

          {matchdayFixtures.map((fixture) => (
            <TourneyFixtureCard
              key={fixture.id}
              fixture={fixture}
              result={selectSimResult(results, fixture.id)}
              groupBadge={`Group ${fixture.group}`}
              onQuickSim={() => handleQuickSim(fixture)}
              onLongSim={() => handleTourneyLongSim(fixture)}
              onReset={() => handleResetGroupFixture(fixture.id)}
              animating={justSimmedId === fixture.id}
            />
          ))}
        </ScrollView>
      )}

      {/* ── KNOCKOUT VIEW ────────────────────────────────────────────────────── */}
      {tourneyView === 'knockout' && (
        <View style={styles.content}>
          <KnockoutBracket
            resolved={resolvedBracket}
            onQuickSim={handleKnockoutQuickSim}
            onSimulate={handleKnockoutLongSim}
            onReset={handleResetKnockoutMatch}
          />
        </View>
      )}

      {/* Bottom sticky CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity activeOpacity={0.85} onPress={handleSimulateWC} style={styles.simWCWrap}>
          <LinearGradient {...cardGreen} style={styles.simWCBtn}>
            <Text style={styles.simWCText}>⚡ SIMULATE ENTIRE TOURNAMENT</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.7}>
          <Text style={styles.resetBtnText}>🗑</Text>
        </TouchableOpacity>
      </View>

      {/* Tournament sim overlay */}
      {tourneyOverlay && (
        <View style={styles.tourneyOverlay}>
          <View style={styles.tourneyOverlayHeader}>
            <Text style={styles.tourneyOverlayContext}>{tourneyOverlay.contextLabel}</Text>
            <Text style={styles.tourneyOverlayTeams}>{tourneyOverlay.teamsLabel}</Text>
            <TouchableOpacity onPress={() => setTourneyOverlay(null)} style={styles.tourneyOverlayClose} activeOpacity={0.7}>
              <Text style={styles.tourneyOverlayCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <WebView
            key={tourneyOverlay.key}
            source={{ html: tourneyOverlay.html }}
            style={{ flex: 1 }}
            javaScriptEnabled
            originWhitelist={['*']}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            onMessage={handleTourneyOverlayMessage}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Team slot card (H2H) ─────────────────────────────────────────────────────
function TeamSlot({ team, label, onPress }: { team: Team | null; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.slotShadow}>
      <LinearGradient {...cardGreen} style={styles.slotCard}>
        <Text style={styles.slotLabel}>{label}</Text>
        {team ? (
          <>
            <View style={styles.slotFlagWrap}>
              <PixelFlag isoCode={team.isoCode} size={48} />
            </View>
            <Text style={styles.slotCode}>{team.code3}</Text>
            <Text style={styles.slotName} numberOfLines={1}>{team.name}</Text>
            <Text style={styles.slotHint}>TAP TO CHANGE</Text>
          </>
        ) : (
          <>
            <View style={[styles.slotFlagWrap, styles.slotFlagEmpty]}>
              <Text style={styles.slotPlus}>+</Text>
            </View>
            <Text style={styles.slotCode}>SELECT</Text>
            <Text style={styles.slotName}>—</Text>
            <Text style={styles.slotHint}>TAP TO PICK</Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  // Top toggle (H2H / Tournament Sim)
  topToggleWrap: {
    paddingHorizontal: SPACING[16],
    paddingTop: SPACING[8],
    paddingBottom: SPACING[12],
  },
  topToggleInner: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    padding: 4,
    gap: 2,
    ...PIXEL_SHADOW,
  },
  topToggleSlot: {
    flex: 1,
    borderRadius: 7,
    overflow: 'hidden',
  },
  topToggleSeg: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 7,
  },
  topToggleText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
  },
  topToggleTextActive: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 12,
    color: COLORS.textPrimary,
    letterSpacing: 1.5,
  },

  // ─── H2H Team Select screen ───────────────────────────────────────────────
  h2hScroll: {
    padding: SPACING[16],
    paddingBottom: SPACING[48],
  },
  h2hTitle: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 18,
    color: COLORS.gold,
    letterSpacing: 2,
    marginTop: SPACING[4],
    textAlign: 'center',
  },
  h2hSubtitle: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: SPACING[20],
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING[8],
    marginBottom: SPACING[16],
  },
  slotShadow: {
    flex: 1,
    borderRadius: RADIUS.medium,
    ...PIXEL_SHADOW,
  },
  slotCard: {
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING[16],
    alignItems: 'center',
    gap: 4,
    overflow: 'hidden',
    minHeight: 180,
  },
  slotLabel: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.gold,
    letterSpacing: 2,
    marginBottom: 4,
  },
  slotFlagWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  slotFlagEmpty: {
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: RADIUS.small,
  },
  slotPlus: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 36,
    color: COLORS.textMuted,
  },
  slotCode: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 22,
    color: COLORS.textPrimary,
    letterSpacing: 2,
    marginTop: 2,
  },
  slotName: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: COLORS.textSecondary,
    maxWidth: '100%',
  },
  slotHint: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 9,
    color: COLORS.textPrimary,
    letterSpacing: 1,
    marginTop: 4,
  },
  vsBadge: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 18,
    color: COLORS.gold,
    letterSpacing: 2,
  },
  sameTeamWarn: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: '#F7AC38',
    textAlign: 'center',
    marginBottom: SPACING[8],
  },
  kickoffShadow: {
    borderRadius: RADIUS.medium,
    marginTop: SPACING[4],
    marginBottom: SPACING[24],
    ...PIXEL_SHADOW,
  },
  kickoffBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: RADIUS.medium,
    paddingVertical: 14,
    alignItems: 'center',
  },
  kickoffBtnText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 18,
    color: COLORS.background,
    letterSpacing: 2,
  },

  // Quick Match
  quickSection: {
    marginTop: SPACING[8],
  },
  quickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING[8],
  },
  quickLabel: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 2,
  },
  quickShuffle: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.teal,
    letterSpacing: 1.5,
  },
  quickList: {
    gap: SPACING[8],
    paddingVertical: 4,
  },
  quickPillShadow: {
    borderRadius: RADIUS.small,
    ...PIXEL_SHADOW,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  quickPillCodes: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  quickPillLabel: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 9,
    color: COLORS.gold,
    letterSpacing: 1,
    marginLeft: 4,
  },

  // Nation picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.large,
    borderTopRightRadius: RADIUS.large,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING[12],
    paddingHorizontal: SPACING[16],
    paddingBottom: SPACING[24],
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[8],
    marginBottom: SPACING[12],
  },
  modalTitle: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 16,
    color: COLORS.gold,
    letterSpacing: 2,
  },
  modalBadge: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignSelf: 'center',
  },
  modalBadgeText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  modalClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
  },
  modalCloseX: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  searchRow: {
    marginBottom: SPACING[8],
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    paddingHorizontal: SPACING[12],
    paddingVertical: SPACING[8],
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 13,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  modalList: {
    flexGrow: 0,
  },
  modalListInner: {
    paddingBottom: SPACING[16],
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[12],
    paddingVertical: SPACING[8],
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderStyle: 'dashed',
  },
  modalRowName: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  modalRowCode: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 12,
    color: COLORS.gold,
    letterSpacing: 1.5,
  },
  modalEmpty: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: SPACING[24],
  },

  // Live WebView top chrome
  liveTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING[12],
    paddingVertical: SPACING[8],
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  liveBackBtn: {
    width: 32,
    height: 32,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveTopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[8],
  },
  liveTopCode: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 15,
    color: COLORS.textPrimary,
    letterSpacing: 1.5,
  },
  liveTopVs: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  liveStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.red,
    minWidth: 44,
    alignItems: 'center',
  },
  liveStatusText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.red,
    letterSpacing: 1.5,
  },

  // WebView match
  webViewMatch: { flex: 1 },

  // Post-match result
  matchResultScreen: { flex: 1, justifyContent: 'center', padding: SPACING[16] },
  matchResultShadow: {
    borderRadius: RADIUS.large,
    ...PIXEL_SHADOW,
    marginBottom: SPACING[16],
  },
  matchResultCard: {
    borderRadius: RADIUS.large,
    borderWidth: 1,
    borderColor: COLORS.green,
    padding: SPACING[32],
    alignItems: 'center',
    overflow: 'hidden',
  },
  matchResultTitle: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 22,
    color: COLORS.gold,
    letterSpacing: 3,
    marginBottom: SPACING[24],
  },
  matchResultTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[16],
    marginBottom: SPACING[16],
  },
  matchResultTeam: { alignItems: 'center', gap: SPACING[4] },
  matchResultCode: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 13,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  matchResultScore: {
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 40,
    color: COLORS.textPrimary,
    letterSpacing: 4,
    minWidth: 90,
    textAlign: 'center',
  },
  matchResultWinner: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: COLORS.green,
    letterSpacing: 1,
    marginTop: SPACING[8],
  },

  // CTA (new match)
  ctaButton: {
    backgroundColor: COLORS.green,
    margin: SPACING[16],
    borderRadius: RADIUS.medium,
    paddingVertical: 14,
    alignItems: 'center',
    ...PIXEL_SHADOW,
  },
  ctaText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 18,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },

  // ─── Tournament Sim ───────────────────────────────────────────────────────
  subTabsWrap: {
    paddingHorizontal: SPACING[16],
    marginBottom: SPACING[12],
  },
  subTabsInner: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    padding: 4,
    gap: 2,
    ...PIXEL_SHADOW,
  },
  subTabSlot: {
    flex: 1,
    borderRadius: 7,
    overflow: 'hidden',
  },
  subTabSeg: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 7,
  },
  subTabText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
  },
  subTabTextActive: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 12,
    color: COLORS.textPrimary,
    letterSpacing: 1.5,
  },

  // Chip row
  chipRowWrap: {
    maxHeight: 48,
    marginBottom: SPACING[8],
  },
  chipRow: {
    paddingHorizontal: SPACING[16],
    gap: 6,
    alignItems: 'center',
    height: 46,
  },
  chipShadow: {
    borderRadius: RADIUS.small,
    ...PIXEL_SHADOW,
  },
  chip: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
  },
  chipWide: {
    width: 54,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
  },
  chipActive: {
    borderColor: COLORS.gold,
  },
  chipText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  chipTextActive: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },

  // Content
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: SPACING[16],
    paddingBottom: SPACING[24],
  },

  // Section row
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: SPACING[8],
  },
  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 18,
    color: COLORS.gold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionMeta: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },

  // Standings card
  standCardShadow: {
    borderRadius: RADIUS.medium,
    marginBottom: SPACING[20],
    ...PIXEL_SHADOW,
  },
  standCard: {
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.green,
    paddingHorizontal: SPACING[12],
    paddingTop: 6,
    paddingBottom: 6,
    overflow: 'hidden',
  },
  standHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,176,192,0.25)',
    borderStyle: 'dashed',
  },
  standHeadText: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 10,
    color: COLORS.textPrimary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  standRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
    position: 'relative',
  },
  standRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,176,192,0.15)',
    borderStyle: 'dashed',
  },
  standQualBar: {
    position: 'absolute',
    left: -10,
    top: 6,
    bottom: 6,
    width: 3,
    backgroundColor: COLORS.green,
  },
  standRank: {
    width: 16,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  standFlagWrap: {
    width: 22,
    alignItems: 'center',
  },
  standName: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  standStat: {
    width: 22,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  standPts: {
    width: 28,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 16,
    color: COLORS.gold,
    fontWeight: '800',
  },

  // Matchday header
  mdHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING[12],
    marginBottom: SPACING[8],
  },
  mdHeadLabel: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 13,
    color: COLORS.textMuted,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  simAllBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: '#F7AC38',
    paddingHorizontal: SPACING[12],
    paddingVertical: 6,
  },
  simAllBtnText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: '#F7AC38',
    letterSpacing: 1.5,
  },

  // Matchday view header
  mdViewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[12],
    marginBottom: SPACING[12],
  },
  simAllMdBtn: {
    backgroundColor: '#F7AC38',
    borderRadius: RADIUS.small,
    paddingHorizontal: SPACING[12],
    paddingVertical: 8,
    ...PIXEL_SHADOW,
  },
  simAllMdBtnText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 12,
    color: COLORS.background,
    letterSpacing: 1.5,
  },

  // Tournament fixture card
  tfxShadow: {
    borderRadius: RADIUS.medium,
    marginBottom: SPACING[8],
    ...PIXEL_SHADOW,
  },
  tfxCard: {
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  tfxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING[12],
    paddingVertical: SPACING[8],
  },
  tfxTeam: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[8],
  },
  tfxTeamRight: {
    justifyContent: 'flex-end',
  },
  tfxCode: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  tfxCodeRight: {
    textAlign: 'right',
  },
  tfxCodeMuted: {
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  tfxVs: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 13,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    paddingHorizontal: SPACING[8],
  },
  tfxScoreBox: {
    alignItems: 'center',
    paddingHorizontal: SPACING[8],
  },
  tfxScore: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 18,
    color: COLORS.gold,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tfxScoreLabel: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    marginTop: 2,
    fontWeight: '700',
  },
  tfxMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[8],
    paddingHorizontal: SPACING[12],
    paddingTop: 6,
    paddingBottom: SPACING[8],
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,176,192,0.15)',
    borderStyle: 'dashed',
  },
  tfxDate: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.gold,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  tfxVenue: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 10,
    color: COLORS.textPrimary,
  },
  tfxGroupBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.green,
    backgroundColor: 'rgba(148,201,82,0.07)',
  },
  tfxGroupBadgeText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: '#94C952',
    letterSpacing: 1,
    fontWeight: '700',
  },
  tfxBtnRow: {
    flexDirection: 'row',
    gap: 4,
  },
  tfxBtnQuick: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.small,
    paddingVertical: 4,
    paddingHorizontal: SPACING[8],
    borderWidth: 1,
    borderColor: '#F7AC38',
  },
  tfxBtnQuickText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: '#F7AC38',
    letterSpacing: 1,
  },
  tfxBtnLong: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.small,
    paddingVertical: 4,
    paddingHorizontal: SPACING[8],
    borderWidth: 1,
    borderColor: COLORS.green,
  },
  tfxBtnLongText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.green,
    letterSpacing: 1,
  },
  tfxBtnReset: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.small,
    paddingVertical: 4,
    paddingHorizontal: SPACING[8],
    borderWidth: 1,
    borderColor: COLORS.textMuted,
  },
  tfxBtnResetText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    padding: SPACING[12],
    gap: SPACING[8],
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  simWCWrap: {
    flex: 1,
    borderRadius: RADIUS.medium,
    ...PIXEL_SHADOW,
  },
  simWCBtn: {
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.green,
    paddingVertical: 14,
    alignItems: 'center',
    overflow: 'hidden',
  },
  simWCText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: COLORS.gold,
    letterSpacing: 2,
    fontWeight: '800',
  },
  resetBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.medium,
    paddingVertical: SPACING[12],
    paddingHorizontal: SPACING[16],
    borderWidth: 1,
    borderColor: COLORS.border,
    ...PIXEL_SHADOW,
  },
  resetBtnText: { fontSize: 16 },

  // Tournament sim overlay
  tourneyOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: '#000',
  },
  tourneyOverlayHeader: {
    height: 44,
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING[8],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tourneyOverlayContext: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.gold,
    letterSpacing: 1,
    flex: 1,
  },
  tourneyOverlayTeams: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: COLORS.textPrimary,
    textAlign: 'center',
    flex: 1,
  },
  tourneyOverlayClose: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  tourneyOverlayCloseText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 16,
    color: '#ffffff',
  },

  // ─── Text-sim fallback (scoreboard + event feed) ──────────────────────────
  sbShadow: {
    marginHorizontal: SPACING[16],
    marginBottom: SPACING[8],
    borderRadius: RADIUS.medium,
    ...PIXEL_SHADOW,
  },
  sbCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.green,
    padding: SPACING[16],
    overflow: 'hidden',
  },
  sbTeam: { flex: 1, alignItems: 'center', gap: SPACING[4] },
  sbTeamRight: {},
  sbName: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  sbCenter: { alignItems: 'center', paddingHorizontal: SPACING[16] },
  sbNumbers: {
    fontFamily: TYPOGRAPHY.fontMono,
    fontSize: 44,
    color: COLORS.gold,
    letterSpacing: 6,
  },
  sbMinute: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
    letterSpacing: 1,
  },

  feed: { flex: 1, marginHorizontal: SPACING[16] },
  feedContent: { paddingBottom: SPACING[16], gap: 2 },
  evRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.small,
    padding: SPACING[8],
    gap: SPACING[8],
    borderLeftWidth: 3,
    borderLeftColor: COLORS.border,
  },
  evIcon: { fontSize: 15, marginTop: 1 },
  evBody: { flex: 1 },
  evMinute: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    marginBottom: 2,
    fontWeight: '700',
  },
  evCommentary: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});
