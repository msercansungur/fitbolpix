import React, { useRef, useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useSimulator } from '../hooks/useSimulator';
import { NATIONS, NATIONS_BY_ID, NATIONS_BY_GROUP } from '../constants/nations';
import { GROUP_FIXTURES, GROUPS, fixturesByGroup } from '../constants/fixtures';
import { COLORS, SPACING, FONTS, RADIUS } from '../constants/theme';
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
type SimMode    = 'match' | 'tournament';
type TourneyView = 'groups' | 'knockout' | 'matchdays';

// ─── Event icons / colours ────────────────────────────────────────────────────

const EVENT_ICON: Record<EventType, string> = {
  goal: '⚽', yellow_card: '🟨', red_card: '🟥', save: '🧤',
  foul: '🦶', var_check: '📺', injury: '🏥',
  kickoff: '🏁', halftime: '⏸️', fulltime: '🏆',
};

const EVENT_COLOR: Record<EventType, string> = {
  goal:        COLORS.accent,
  yellow_card: COLORS.accent,
  red_card:    COLORS.danger,
  save:        COLORS.accentTeal,
  foul:        COLORS.warning,
  var_check:   '#c084fc',
  injury:      COLORS.warning,
  kickoff:     COLORS.textSecondary,
  halftime:    COLORS.textSecondary,
  fulltime:    COLORS.accent,
};

// ─── Shared sub-components ────────────────────────────────────────────────────

// 4-column nation card for sequential picker
function NationPickerCard({ team, selected, onPress }: {
  team: Team; selected: boolean; onPress: () => void;
}) {
  const cardW = (SCREEN_WIDTH - 32 - 9) / 4; // 4 cols, 16px padding each side, 3×3px gaps
  return (
    <TouchableOpacity
      style={[styles.nationCard, { width: cardW }, selected && styles.nationCardSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <PixelFlag isoCode={team.isoCode} size={28} />
      <Text style={[styles.nationCardCode, selected && styles.nationCardCodeSelected]}>
        {team.code3}
      </Text>
    </TouchableOpacity>
  );
}

function Scoreboard({ homeTeam, awayTeam, homeScore, awayScore, minute, status }: {
  homeTeam: Team; awayTeam: Team;
  homeScore: number; awayScore: number;
  minute: number; status: string;
}) {
  const minuteLabel =
    status === 'running'  ? `⏱ ${minute}'` :
    status === 'finished' ? 'FULL TIME' : 'KICK OFF';
  return (
    <View style={styles.scoreboard}>
      <View style={styles.scoreTeam}>
        <PixelFlag isoCode={homeTeam.isoCode} size={36} />
        <Text style={styles.scoreName} numberOfLines={1}>{homeTeam.code3}</Text>
      </View>
      <View style={styles.scoreCenter}>
        <Text style={styles.scoreNumbers}>{homeScore} – {awayScore}</Text>
        <Text style={styles.scoreMinute}>{minuteLabel}</Text>
      </View>
      <View style={[styles.scoreTeam, styles.scoreTeamRight]}>
        <PixelFlag isoCode={awayTeam.isoCode} size={36} />
        <Text style={styles.scoreName} numberOfLines={1}>{awayTeam.code3}</Text>
      </View>
    </View>
  );
}

function EventItem({ event, homeId }: { event: MatchEvent; homeId: string }) {
  const isNeutral = event.teamId === '';
  const side  = isNeutral ? '' : event.teamId === homeId ? 'H' : 'A';
  const color = EVENT_COLOR[event.type];
  return (
    <View style={styles.eventRow}>
      <Text style={styles.eventIcon}>{EVENT_ICON[event.type]}</Text>
      <View style={styles.eventBody}>
        <Text style={[styles.eventMinute, { color }]}>
          {event.minute > 0 ? `${event.minute}'` : '0'}{side ? `  [${side}]` : ''}
        </Text>
        <Text style={styles.eventCommentary}>{event.commentary}</Text>
      </View>
    </View>
  );
}

// ─── Tournament mode helpers ──────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Tournament — Standings row ───────────────────────────────────────────────

function TourneyStandingRow({ team, standing, rank }: {
  team: Team;
  standing: ReturnType<typeof selectSimStandings>[number] | undefined;
  rank: number;
}) {
  const qualifies = rank <= 2;
  const goalDiff  = standing ? standing.goalsFor - standing.goalsAgainst : 0;
  return (
    <View style={[styles.tableRow, qualifies && styles.tableRowQualifies]}>
      <Text style={styles.tableRank}>{rank}</Text>
      <View style={styles.tableFlag}><PixelFlag isoCode={team.isoCode} size={16} /></View>
      <Text style={styles.tableName} numberOfLines={1}>{team.code3}</Text>
      <Text style={styles.tableStat}>{standing?.played  ?? 0}</Text>
      <Text style={styles.tableStat}>{standing?.won     ?? 0}</Text>
      <Text style={styles.tableStat}>{standing?.drawn   ?? 0}</Text>
      <Text style={styles.tableStat}>{standing?.lost    ?? 0}</Text>
      <Text style={styles.tableStat}>{goalDiff >= 0 ? '+' : ''}{goalDiff}</Text>
      <Text style={[styles.tableStat, styles.tableStatPts]}>{standing?.points ?? 0}</Text>
    </View>
  );
}

// ─── Tournament — Fixture card with sim buttons ───────────────────────────────

function TourneyFixtureCard({ fixture, result, groupBadge, onQuickSim, onLongSim, onReset, animating }: {
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
  if (!home || !away) return null;
  const isPlayed = result !== null;

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

  return (
    <View style={[styles.fixtureCard, isPlayed && styles.fixtureCardPlayed]}>
      <View style={styles.fixtureTeams}>
        {groupBadge && (
          <View style={styles.groupBadge}>
            <Text style={styles.groupBadgeText}>{groupBadge}</Text>
          </View>
        )}
        <View style={styles.fixtureTeam}>
          <PixelFlag isoCode={home.isoCode} size={20} />
          <Text style={[styles.fixtureTeamName, isPlayed && result!.homeScore > result!.awayScore && styles.fixtureTeamWinner]} numberOfLines={1}>
            {home.code3}
          </Text>
        </View>
        {isPlayed ? (
          <View style={styles.fixtureScoreBox}>
            <Text style={styles.fixtureScore}>{dispHome} – {dispAway}</Text>
            <Text style={styles.fixtureScoreLabel}>FT</Text>
          </View>
        ) : (
          <Text style={styles.fixtureVs}>VS</Text>
        )}
        <View style={[styles.fixtureTeam, styles.fixtureTeamRight]}>
          <Text style={[styles.fixtureTeamName, styles.fixtureTeamNameRight, isPlayed && result!.awayScore > result!.homeScore && styles.fixtureTeamWinner]} numberOfLines={1}>
            {away.code3}
          </Text>
          <PixelFlag isoCode={away.isoCode} size={20} />
        </View>
      </View>
      <View style={styles.fixtureMeta}>
        <Text style={styles.fixtureDate}>{formatDate(fixture.date)}</Text>
        <Text style={styles.fixtureVenue} numberOfLines={1}>{fixture.venue}</Text>
        {isPlayed ? (
          <View style={styles.fixtureMetaBtns}>
            <TouchableOpacity style={styles.quickSimBtn} onPress={onQuickSim} activeOpacity={0.75}>
              <Text style={styles.quickSimBtnText}>⚡ RE-SIM</Text>
            </TouchableOpacity>
            {onReset && (
              <TouchableOpacity style={styles.resetSimBtn} onPress={onReset} activeOpacity={0.75}>
                <Text style={styles.resetSimBtnText}>↺</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.fixtureMetaBtns}>
            {onLongSim && (
              <TouchableOpacity style={styles.longSimSmBtn} onPress={onLongSim} activeOpacity={0.75}>
                <Text style={styles.longSimSmBtnText}>▶</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.quickSimBtn} onPress={onQuickSim} activeOpacity={0.75}>
              <Text style={styles.quickSimBtnText}>⚡ SIM</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
  // ── MATCH mode state ───────────────────────────────────────────────────────
  const { state, selectHomeTeam, selectAwayTeam, resetMatch, setTeamsAndStart } = useSimulator();
  const feedRef   = useRef<FlatList<MatchEvent>>(null);
  const fixtureId = route.params?.fixtureId;

  // ── Mode + Tournament sub-view ─────────────────────────────────────────────
  const [simMode,        setSimMode]       = useState<SimMode>('match');
  const [tourneyView,    setTourneyView]   = useState<TourneyView>('groups');
  const [activeGroup,    setActiveGroup]   = useState<string>('A');
  const [activeMatchday, setActiveMatchday] = useState<1 | 2 | 3>(1);
  const [pickerStep,     setPickerStep]    = useState<'home' | 'away'>('home');
  const [justSimmedId,   setJustSimmedId]  = useState<string | null>(null);

  // ── WebView match state ────────────────────────────────────────────────────
  const [webViewActive,  setWebViewActive] = useState(false);
  const [webMatchDone,   setWebMatchDone]  = useState(false);
  const pendingMatchRef = useRef<{
    homeTeam: Team; awayTeam: Team;
    homeScore: number; awayScore: number;
    events: ReturnType<typeof simulateMatch>;
  } | null>(null);
  // HTML is built once at kick-off with config baked in; stored in a ref to avoid re-renders
  const matchHtmlRef = useRef<string>('');

  // ── Simulator store (tournament mode reads/writes here) ────────────────────
  const results         = useSimulatorStore((s) => s.results);
  const standings       = useSimulatorStore((s) => s.standings);
  const knockoutResults = useSimulatorStore((s) => s.knockoutResults);
  const saveResult      = useSimulatorStore((s) => s.saveResult);
  const saveKnockoutResult = useSimulatorStore((s) => s.saveKnockoutResult);
  const clearAll        = useSimulatorStore((s) => s.clearAll);

  // ── Auto-start when navigated with team params ─────────────────────────────
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

  // ── Save match result to simulator store on finish ─────────────────────────
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

  // ── Auto-scroll event feed ─────────────────────────────────────────────────
  useEffect(() => {
    if (state.events.length > 0) feedRef.current?.scrollToEnd({ animated: true });
  }, [state.events.length]);

  // ── Tournament helpers ─────────────────────────────────────────────────────
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

  // ── Tournament actions ─────────────────────────────────────────────────────
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
      'Simulate Entire World Cup?',
      'This will instantly simulate all 64 remaining matches and produce a winner.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '⚡ Simulate!',
          onPress: () => {
            // 1. Fill all remaining group fixtures
            const store = useSimulatorStore.getState();
            GROUP_FIXTURES.filter((f) => !(f.id in store.results)).forEach((f) => {
              const h = NATIONS_BY_ID[f.homeTeamId];
              const a = NATIONS_BY_ID[f.awayTeamId];
              if (!h || !a) return;
              const evts = simulateMatch(h, a, 'en');
              const sc   = computeScore(evts, h.id, a.id);
              store.saveResult({ fixtureId: f.id, homeTeamId: h.id, awayTeamId: a.id, homeScore: sc.home, awayScore: sc.away, events: evts, simulatedAt: Date.now() });
            });
            // 2. Simulate knockout matches in dependency order
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
            // Find winner
            const final = useSimulatorStore.getState();
            const finalResolved = resolveKnockoutBracket(final.standings, final.results, final.knockoutResults);
            const finalMatch = finalResolved.find((m) => m.def.round === 'Final' && m.result !== null);
            if (finalMatch?.result) {
              const r = finalMatch.result;
              const winner = r.homeScore >= r.awayScore ? NATIONS_BY_ID[r.homeTeamId] : NATIONS_BY_ID[r.awayTeamId];
              if (winner) Alert.alert('🏆 World Cup Winner!', `${winner.flag} ${winner.name}`);
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

  // ── Tournament sim overlay (Long Sim for group + knockout) ────────────────
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
        // Group fixture
        useSimulatorStore.getState().saveResult({
          fixtureId: ov.fixtureId, homeTeamId: ov.homeTeamId, awayTeamId: ov.awayTeamId,
          homeScore: ov.simScore.home, awayScore: ov.simScore.away,
          events: ov.simEvents, simulatedAt: Date.now(),
        });
      } else if (ov.matchId != null) {
        // Knockout — draw gets home +1
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

  // ── Group fixture reset ───────────────────────────────────────────────────
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

  // ── Knockout match reset with cascade ─────────────────────────────────────
  const handleResetKnockoutMatch = useCallback((match: ResolvedKnockoutMatch) => {
    // Build forward-dependency graph: matchId → set of downstream matchIds
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
    // Remove all dependent knockout results
    useSimulatorStore.setState((state) => {
      const newKO = { ...state.knockoutResults };
      dependents.forEach((id) => { delete newKO[id]; });
      return { knockoutResults: newKO };
    });
  }, []);

  // ── WebView match handlers ─────────────────────────────────────────────────
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

  // ── Render helpers ─────────────────────────────────────────────────────────
  const bothSelected = state.homeTeam !== null && state.awayTeam !== null;
  const sameTeam     = state.homeTeam?.id === state.awayTeam?.id;
  const canKickOff   = bothSelected && !sameTeam;

  const renderNationCard: ListRenderItem<Team> = ({ item }) => {
    const isSelected = pickerStep === 'home'
      ? state.homeTeam?.id === item.id
      : state.awayTeam?.id === item.id;
    return (
      <NationPickerCard
        team={item}
        selected={isSelected}
        onPress={() => {
          if (pickerStep === 'home') {
            selectHomeTeam(item);
            setPickerStep('away');
          } else {
            selectAwayTeam(item);
          }
        }}
      />
    );
  };

  const renderEvent: ListRenderItem<MatchEvent> = ({ item }) => (
    <EventItem event={item} homeId={state.homeTeam?.id ?? ''} />
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TOP TOGGLE
  // ═══════════════════════════════════════════════════════════════════════════

  const topToggle = (
    <View style={styles.modeToggle}>
      {(['match', 'tournament'] as SimMode[]).map((m) => (
        <TouchableOpacity
          key={m}
          style={[styles.modeToggleBtn, simMode === m && styles.modeToggleActive]}
          onPress={() => setSimMode(m)}
          activeOpacity={0.7}
        >
          <Text style={[styles.modeToggleText, simMode === m && styles.modeToggleTextActive]}>
            {m === 'match' ? '⚽ HEAD TO HEAD' : '🏆 TOURNAMENT SIM'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MATCH MODE
  // ═══════════════════════════════════════════════════════════════════════════

  if (simMode === 'match') {
    // ── WebView match view ───────────────────────────────────────────────────
    if (webViewActive) {
      const pm = pendingMatchRef.current;
      return (
        <SafeAreaView style={styles.root}>
          {topToggle}
          {webMatchDone && pm ? (
            // Post-match result screen
            <View style={styles.matchResultScreen}>
              <View style={styles.matchResultCard}>
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
              </View>
              <TouchableOpacity style={styles.ctaButton} onPress={handleNewMatch} activeOpacity={0.8}>
                <Text style={styles.ctaText}>🔄  NEW MATCH</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Live Phaser WebView
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
          )}
        </SafeAreaView>
      );
    }

    if (state.status === 'idle') {
      // Selected team summary strip
      const homeStrip = state.homeTeam
        ? <View style={styles.selStrip}><PixelFlag isoCode={state.homeTeam.isoCode} size={18} /><Text style={styles.selStripText}>{state.homeTeam.code3}</Text></View>
        : <Text style={styles.selStripEmpty}>—</Text>;
      const awayStrip = state.awayTeam
        ? <View style={styles.selStrip}><PixelFlag isoCode={state.awayTeam.isoCode} size={18} /><Text style={styles.selStripText}>{state.awayTeam.code3}</Text></View>
        : <Text style={styles.selStripEmpty}>—</Text>;

      return (
        <SafeAreaView style={styles.root}>
          {topToggle}

          {/* Current selection bar */}
          <View style={styles.selBar}>
            <View style={styles.selSide}>
              <Text style={[styles.selLabel, pickerStep === 'home' && styles.selLabelActive]}>HOME</Text>
              {homeStrip}
            </View>
            <Text style={styles.selVs}>VS</Text>
            <View style={[styles.selSide, styles.selSideRight]}>
              <Text style={[styles.selLabel, pickerStep === 'away' && styles.selLabelActive]}>AWAY</Text>
              {awayStrip}
            </View>
          </View>
          <Text style={styles.pickerPrompt}>
            {pickerStep === 'home' ? 'SELECT HOME TEAM' : 'SELECT AWAY TEAM'}
          </Text>

          <FlatList
            data={NATIONS}
            keyExtractor={(t) => t.id}
            renderItem={renderNationCard}
            numColumns={4}
            columnWrapperStyle={styles.pickerRow}
            contentContainerStyle={styles.pickerList}
            style={styles.picker}
          />
          {pickerStep === 'away' && (
            <TouchableOpacity
              style={[styles.ctaButton, !canKickOff && styles.ctaButtonDisabled]}
              onPress={handleKickOff}
              disabled={!canKickOff}
              activeOpacity={0.8}
            >
              <Text style={styles.ctaText}>
                {sameTeam ? 'PICK DIFFERENT TEAM' : '⚽  KICK OFF!'}
              </Text>
            </TouchableOpacity>
          )}
          {pickerStep === 'away' && (
            <TouchableOpacity
              style={styles.backPickerBtn}
              onPress={() => setPickerStep('home')}
              activeOpacity={0.7}
            >
              <Text style={styles.backPickerText}>← CHANGE HOME TEAM</Text>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      );
    }

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
          contentContainerStyle={styles.feedContent}
          style={styles.feed}
          onContentSizeChange={() => feedRef.current?.scrollToEnd({ animated: true })}
        />
        {state.status === 'finished' && (
          <TouchableOpacity style={styles.ctaButton} onPress={resetMatch} activeOpacity={0.8}>
            <Text style={styles.ctaText}>🔄  NEW MATCH</Text>
          </TouchableOpacity>
        )}
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
      <View style={styles.viewToggle}>
        {(['groups', 'knockout', 'matchdays'] as TourneyView[]).map((v) => (
          <TouchableOpacity
            key={v}
            style={[styles.viewToggleBtn, tourneyView === v && styles.viewToggleActive]}
            onPress={() => setTourneyView(v)}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewToggleText, tourneyView === v && styles.viewToggleTextActive]}>
              {v === 'groups' ? 'Groups' : v === 'knockout' ? 'Knockout' : 'Matchdays'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Group / Matchday tab bar */}
      {tourneyView !== 'knockout' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
          style={styles.tabBarWrap}
        >
          {tourneyView === 'groups'
            ? GROUPS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.tab, activeGroup === g && styles.tabActive]}
                  onPress={() => setActiveGroup(g)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, activeGroup === g && styles.tabTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))
            : ([1, 2, 3] as const).map((md) => (
                <TouchableOpacity
                  key={md}
                  style={[styles.tab, styles.tabWide, activeMatchday === md && styles.tabActive]}
                  onPress={() => setActiveMatchday(md)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, activeMatchday === md && styles.tabTextActive]}>
                    MD {md}
                  </Text>
                </TouchableOpacity>
              ))}
        </ScrollView>
      )}

      {/* ── GROUPS VIEW ──────────────────────────────────────────────────────── */}
      {tourneyView === 'groups' && (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.groupHeadingRow}>
            <Text style={styles.sectionLabel}>GROUP {activeGroup}</Text>
            <Text style={styles.progressLabel}>{simulatedCount}/6 simulated</Text>
          </View>

          {/* Standings */}
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableRank, styles.tableHeaderText]}>#</Text>
              <Text style={[styles.tableFlag, styles.tableHeaderText]}> </Text>
              <Text style={[styles.tableName, styles.tableHeaderText]}>Team</Text>
              <Text style={[styles.tableStat, styles.tableHeaderText]}>P</Text>
              <Text style={[styles.tableStat, styles.tableHeaderText]}>W</Text>
              <Text style={[styles.tableStat, styles.tableHeaderText]}>D</Text>
              <Text style={[styles.tableStat, styles.tableHeaderText]}>L</Text>
              <Text style={[styles.tableStat, styles.tableHeaderText]}>GD</Text>
              <Text style={[styles.tableStat, styles.tableStatPts, styles.tableHeaderText]}>Pts</Text>
            </View>
            {groupTeams.map((t, i) => (
              <TourneyStandingRow key={t.id} team={t} standing={standingByTeam[t.id]} rank={i + 1} />
            ))}
          </View>

          {/* Fixtures by matchday with sim buttons */}
          {([1, 2, 3] as const).map((md) => {
            const mdFixtures = groupFixtures.filter((f) => f.matchday === md);
            const mdPending  = mdFixtures.filter((f) => !isSimulated(results, f.id)).length;
            return (
              <View key={md}>
                <View style={styles.matchdayHeaderRow}>
                  <Text style={styles.matchdayLabel}>Matchday {md}</Text>
                  {mdPending > 0 && (
                    <TouchableOpacity style={styles.simAllBtn} onPress={() => handleSimAll(mdFixtures)} activeOpacity={0.75}>
                      <Text style={styles.simAllBtnText}>⚡ Sim All</Text>
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
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.matchdayViewHeader}>
            <View>
              <Text style={styles.sectionLabel}>MATCHDAY {activeMatchday}</Text>
              <Text style={styles.progressLabel}>
                {matchdayFixtures.length - matchdayPending}/{matchdayFixtures.length} simulated
              </Text>
            </View>
            {matchdayPending > 0 && (
              <TouchableOpacity
                style={styles.simAllMatchdayBtn}
                onPress={() => handleSimAll(matchdayFixtures)}
                activeOpacity={0.8}
              >
                <Text style={styles.simAllMatchdayBtnText}>⚡ Sim All Matchday</Text>
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

      {/* Bottom action row */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.simWCBtn} onPress={handleSimulateWC} activeOpacity={0.8}>
          <Text style={styles.simWCBtnText}>⚡ SIMULATE ENTIRE WC</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.7}>
          <Text style={styles.resetBtnText}>🗑</Text>
        </TouchableOpacity>
      </View>

      {/* Tournament sim overlay (Long Sim WebView) */}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bgPrimary },

  // Mode toggle
  modeToggle: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  modeToggleBtn: { flex: 1, paddingVertical: SPACING.sm, alignItems: 'center' },
  modeToggleActive: { backgroundColor: COLORS.primary },
  modeToggleText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  modeToggleTextActive: { color: COLORS.textPrimary },

  // View sub-toggle
  viewToggle: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  viewToggleBtn: { flex: 1, paddingVertical: SPACING.xs + 2, alignItems: 'center' },
  viewToggleActive: { backgroundColor: COLORS.bgCard },
  viewToggleText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  viewToggleTextActive: { color: COLORS.accent },

  // Tab bar
  tabBarWrap: { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabBar: { paddingHorizontal: SPACING.sm, gap: SPACING.xs, alignItems: 'center', height: 44 },
  tab: {
    width: 34,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabWide: { width: 52 },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  tabTextActive: { color: COLORS.textPrimary },

  // Content
  content: { flex: 1 },
  contentInner: { padding: SPACING.md, paddingBottom: SPACING.xl },

  // Group heading
  groupHeadingRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: SPACING.sm },
  sectionLabel: {
    flex: 1,
    fontFamily: FONTS.heading,
    fontSize: 16,
    color: COLORS.accent,
    letterSpacing: 1.5,
  },
  progressLabel: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // Table
  table: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  tableHeader: {
    backgroundColor: COLORS.bgCardAlt,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableHeaderText: {
    fontFamily: FONTS.headingMedium,
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableRowQualifies: { borderLeftWidth: 3, borderLeftColor: COLORS.success },
  tableRank: {
    width: 16,
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginRight: 2,
  },
  tableFlag: { width: 22, marginRight: 4, alignItems: 'center' as const },
  tableName: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  tableStat: {
    width: 26,
    textAlign: 'center',
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  tableStatPts: {
    fontFamily: FONTS.bodyBold,
    color: COLORS.accent,
  },

  // Matchday section
  matchdayHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, marginTop: SPACING.xs },
  matchdayLabel: {
    flex: 1,
    fontFamily: FONTS.headingMedium,
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  simAllBtn: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.sm,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  simAllBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.warning,
  },

  // Matchday view header
  matchdayViewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: SPACING.sm },
  simAllMatchdayBtn: {
    backgroundColor: COLORS.warning,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  simAllMatchdayBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.bgPrimary,
  },

  // Fixture card
  fixtureCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  fixtureCardPlayed: { borderColor: COLORS.borderLight },
  fixtureTeams: { flexDirection: 'row', alignItems: 'center', padding: SPACING.sm, gap: SPACING.xs },
  groupBadge: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginRight: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  groupBadgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    color: COLORS.textMuted,
  },
  fixtureTeam: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  fixtureTeamRight: { justifyContent: 'flex-end' },
  fixtureFlag: { fontSize: 22 },
  fixtureTeamName: {
    flex: 1,
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  fixtureTeamNameRight: { textAlign: 'right' },
  fixtureTeamWinner: {
    fontFamily: FONTS.bodyBold,
    color: COLORS.textPrimary,
  },
  fixtureVs: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.textMuted,
    paddingHorizontal: SPACING.xs,
  },
  fixtureScoreBox: { alignItems: 'center', paddingHorizontal: SPACING.sm },
  fixtureScore: {
    fontFamily: FONTS.pixel,
    fontSize: 18,
    color: COLORS.accent,
    letterSpacing: 2,
  },
  fixtureScoreLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.success,
  },
  fixtureMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    gap: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  fixtureDate: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.textSecondary,
    width: 60,
  },
  fixtureVenue: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  quickSimBtn: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.sm,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  quickSimBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.warning,
  },
  fixtureMetaBtns: {
    flexDirection: 'row',
    gap: 4,
  },
  longSimSmBtn: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.sm,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  longSimSmBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  resetSimBtn: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.sm,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.textMuted,
  },
  resetSimBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // Tournament sim overlay
  tourneyOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: '#000',
  },
  tourneyOverlayHeader: {
    height: 44,
    backgroundColor: COLORS.bgPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tourneyOverlayContext: {
    fontFamily: FONTS.pixel,
    fontSize: 10,
    color: COLORS.accent,
    letterSpacing: 1,
    flex: 1,
  },
  tourneyOverlayTeams: {
    fontFamily: FONTS.heading,
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
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: '#ffffff',
  },

  // Bottom action bar
  bottomBar: {
    flexDirection: 'row',
    padding: SPACING.sm,
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bgSurface,
  },
  simWCBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  simWCBtnText: {
    fontFamily: FONTS.heading,
    fontSize: 14,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  resetBtn: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resetBtnText: { fontSize: 15 },

  // Match mode — sequential team picker
  selBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  selSide: { flex: 1, alignItems: 'flex-start', gap: 4 },
  selSideRight: { alignItems: 'flex-end' },
  selLabel: {
    fontFamily: FONTS.pixel,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  selLabelActive: { color: COLORS.accent },
  selStrip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  selStripText: {
    fontFamily: FONTS.pixel,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  selStripEmpty: {
    fontFamily: FONTS.pixel,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  selVs: {
    fontFamily: FONTS.pixel,
    fontSize: 12,
    color: COLORS.textMuted,
    paddingHorizontal: SPACING.md,
  },
  pickerPrompt: {
    fontFamily: FONTS.pixel,
    fontSize: 11,
    color: COLORS.accent,
    letterSpacing: 1,
    textAlign: 'center',
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.bgPrimary,
  },
  picker: { flex: 1 },
  pickerRow: { gap: 3, paddingHorizontal: 16, marginBottom: 3 },
  pickerList: { paddingTop: SPACING.xs, paddingBottom: SPACING.md },
  nationCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 3,
  },
  nationCardSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryLight },
  nationCardCode: {
    fontFamily: FONTS.pixel,
    fontSize: 9,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  nationCardCodeSelected: { color: COLORS.textPrimary },
  backPickerBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingBottom: SPACING.sm,
  },
  backPickerText: {
    fontFamily: FONTS.pixel,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },

  // Match mode — scoreboard
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scoreTeam:      { flex: 1, alignItems: 'center', gap: SPACING.xs },
  scoreTeamRight: {},
  scoreName: {
    fontFamily: FONTS.pixel,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  scoreCenter: { alignItems: 'center', paddingHorizontal: SPACING.md },
  scoreNumbers: {
    fontFamily: FONTS.pixel,
    fontSize: 44,
    color: COLORS.accent,
    letterSpacing: 6,
  },
  scoreMinute: {
    fontFamily: FONTS.pixel,
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
    letterSpacing: 1,
  },

  // Match mode — event feed
  feed: { flex: 1, marginHorizontal: SPACING.md },
  feedContent: { paddingBottom: SPACING.md, gap: 2 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    gap: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.border,
  },
  eventIcon: { fontSize: 15, marginTop: 1 },
  eventBody: { flex: 1 },
  eventMinute: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    marginBottom: 2,
  },
  eventCommentary: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  // CTA
  ctaButton: {
    backgroundColor: COLORS.primary,
    margin: SPACING.md,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  ctaButtonDisabled: { backgroundColor: COLORS.bgCard, opacity: 0.6 },
  ctaText: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },

  // WebView match
  webViewMatch: { flex: 1 },

  // Post-match result screen
  matchResultScreen: { flex: 1, justifyContent: 'center', padding: SPACING.md },
  matchResultCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  matchResultTitle: {
    fontFamily: FONTS.pixel,
    fontSize: 22,
    color: COLORS.accent,
    letterSpacing: 3,
    marginBottom: SPACING.lg,
  },
  matchResultTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  matchResultTeam: { alignItems: 'center', gap: SPACING.xs },
  matchResultCode: {
    fontFamily: FONTS.pixel,
    fontSize: 13,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  matchResultScore: {
    fontFamily: FONTS.pixel,
    fontSize: 40,
    color: COLORS.textPrimary,
    letterSpacing: 4,
    minWidth: 90,
    textAlign: 'center',
  },
  matchResultWinner: {
    fontFamily: FONTS.pixel,
    fontSize: 14,
    color: COLORS.success,
    letterSpacing: 1,
    marginTop: SPACING.sm,
  },
});
