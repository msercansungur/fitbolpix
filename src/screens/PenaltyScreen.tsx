import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { BottomTabParamList } from '../navigation/BottomTabNavigator';
import { COLORS, SPACING } from '../constants/theme';
import { NATIONS, NATIONS_BY_ID } from '../constants/nations';
import { Team } from '../types/simulator';
import {
  ShootoutState,
  ShootoutMode,
  ShootoutPhase,
  KickPhase,
  GoalZone,
  ShotTechnique,
  ShotOutcome,
  KickRecord,
} from '../types/penalty';
import {
  generateGKDive,
  resolveUserShot,
  resolveCPUShot,
  checkShootoutEnd,
  getPenaltyCommentary,
  getRingDuration,
} from '../utils/penaltyEngine';
import GoalWebView from '../components/penalty/GoalWebView';
import AimOverlay  from '../components/penalty/AimOverlay';
import PowerBar    from '../components/penalty/PowerBar';
import AccuracyRing from '../components/penalty/AccuracyRing';
import ScoreTracker from '../components/penalty/ScoreTracker';

type Props = BottomTabScreenProps<BottomTabParamList, 'Penalty'>;

// ─── WebView goal dimensions (must match penaltyGameHtml constants) ────────────
const { width: SCREEN_W } = Dimensions.get('window');
const WV_H       = Math.round(SCREEN_W * 0.72); // GoalWebView height
const WV_GOAL_W  = SCREEN_W * 0.86;
const WV_GOAL_H  = WV_H * 0.58;
const WV_GOAL_X  = (SCREEN_W - WV_GOAL_W) / 2;
const WV_GOAL_Y  = WV_H * 0.08;
const WV_POST    = 6;

// ─── Initial state factory ─────────────────────────────────────────────────────

function makeInitialState(
  homeTeamId: string,
  awayTeamId: string,
  mode: ShootoutMode,
): ShootoutState {
  return {
    homeTeamId,
    awayTeamId,
    userTeamId: homeTeamId, // home always = user
    mode,
    phase: 'kicking',
    kickPhase: 'technique_select',
    round: 1,
    kicks: [],
    homeScore: 0,
    awayScore: 0,
    currentKickTeam: 'home',
    winner: null,
    pendingShot: {},
    lastKickResult: null,
  };
}

// ─── Team picker component ────────────────────────────────────────────────────

function TeamPicker({
  label,
  selected,
  onSelect,
  exclude,
}: {
  label: string;
  selected: string | null;
  onSelect: (id: string) => void;
  exclude: string | null;
}) {
  return (
    <View style={styles.pickerBlock}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <ScrollView style={styles.pickerList} nestedScrollEnabled>
        {NATIONS.map((t) => {
          const isSelected = t.id === selected;
          const isExcluded = t.id === exclude;
          return (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.pickerItem,
                isSelected && styles.pickerItemSelected,
                isExcluded && styles.pickerItemDisabled,
              ]}
              onPress={() => !isExcluded && onSelect(t.id)}
              activeOpacity={isExcluded ? 1 : 0.7}
            >
              <Text style={styles.pickerFlag}>{t.flag}</Text>
              <Text style={[
                styles.pickerName,
                isSelected && styles.pickerNameSelected,
                isExcluded && styles.pickerNameDisabled,
              ]}>
                {t.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Result screen ────────────────────────────────────────────────────────────

function ResultScreen({
  state,
  homeTeam,
  awayTeam,
  onPlayAgain,
  onBack,
}: {
  state:     ShootoutState;
  homeTeam:  Team;
  awayTeam:  Team;
  onPlayAgain: () => void;
  onBack:    () => void;
}) {
  const winner = state.winner ? NATIONS_BY_ID[state.winner] : null;
  const isDraw = !state.winner;

  return (
    <View style={styles.resultScreen}>
      <Text style={styles.resultTitle}>
        {isDraw ? 'IT\'S A DRAW!' : 'FULL TIME!'}
      </Text>

      {winner && (
        <>
          <Text style={styles.resultFlag}>{winner.flag}</Text>
          <Text style={styles.resultWinner}>{winner.name} WIN!</Text>
        </>
      )}

      <Text style={styles.resultScore}>
        {homeTeam.flag} {state.homeScore} – {state.awayScore} {awayTeam.flag}
      </Text>
      <Text style={styles.resultNames}>
        {homeTeam.name} vs {awayTeam.name}
      </Text>

      <View style={styles.resultActions}>
        <TouchableOpacity style={styles.playAgainBtn} onPress={onPlayAgain} activeOpacity={0.8}>
          <Text style={styles.playAgainBtnText}>⚽ PLAY AGAIN</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <Text style={styles.backBtnText}>← BACK</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PenaltyScreen({ route }: Props) {
  const paramHome = route.params?.homeTeamId ?? null;
  const paramAway = route.params?.awayTeamId ?? null;

  // ── Top-level phase ────────────────────────────────────────────────────────
  const [topPhase, setTopPhase] = useState<ShootoutPhase>(
    paramHome && paramAway ? 'kicking' : 'mode_select',
  );
  const [selectedMode, setSelectedMode] = useState<ShootoutMode | null>(null);
  const [pickedHome, setPickedHome] = useState<string | null>(paramHome);
  const [pickedAway, setPickedAway] = useState<string | null>(paramAway);

  // ── Shootout state ─────────────────────────────────────────────────────────
  const [state, setState] = useState<ShootoutState | null>(null);

  // ── Commentary toast ───────────────────────────────────────────────────────
  const [commentary, setCommentary] = useState<string | null>(null);
  const commentaryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showCommentary(msg: string) {
    if (commentaryTimer.current) clearTimeout(commentaryTimer.current);
    setCommentary(msg);
    commentaryTimer.current = setTimeout(() => setCommentary(null), 3000);
  }

  // ── Start match ────────────────────────────────────────────────────────────
  function startShootout(homeId: string, awayId: string, mode: ShootoutMode) {
    setState(makeInitialState(homeId, awayId, mode));
    setTopPhase('kicking');
  }

  // ── Advance kick after result delay ───────────────────────────────────────
  const advanceKick = useCallback((nextState: ShootoutState) => {
    setTimeout(() => {
      setState((prev) => {
        if (!prev) return prev;

        // Check if shootout is over
        const { ended, winner } = checkShootoutEnd(
          nextState.kicks,
          nextState.mode,
          nextState.homeTeamId,
          nextState.awayTeamId,
        );

        if (ended) {
          setTopPhase('finished');
          return { ...nextState, phase: 'finished', winner };
        }

        // Determine next team to kick
        const homeKicks = nextState.kicks.filter((k) => k.teamId === nextState.homeTeamId).length;
        const awayKicks = nextState.kicks.filter((k) => k.teamId === nextState.awayTeamId).length;

        let nextKickTeam: 'home' | 'away';
        let nextRound = nextState.round;

        if (nextState.currentKickTeam === 'home') {
          nextKickTeam = 'away';
        } else {
          nextKickTeam = 'home';
          nextRound = nextState.round + 1;
        }

        const isUserTurn = nextKickTeam === 'home'
          ? nextState.userTeamId === nextState.homeTeamId
          : nextState.userTeamId === nextState.awayTeamId;

        const nextKickPhase: KickPhase = isUserTurn ? 'technique_select' : 'cpu_kicking';

        return {
          ...nextState,
          currentKickTeam: nextKickTeam,
          round: nextRound,
          kickPhase: nextKickPhase,
          lastKickResult: null,
          pendingShot: {},
        };
      });
    }, 1800);
  }, []);

  // ── CPU kick auto-resolver ────────────────────────────────────────────────
  useEffect(() => {
    if (!state || state.kickPhase !== 'cpu_kicking') return;

    const timer = setTimeout(() => {
      setState((prev) => {
        if (!prev || prev.kickPhase !== 'cpu_kicking') return prev;

        const cpuTeamId = prev.currentKickTeam === 'home' ? prev.homeTeamId : prev.awayTeamId;
        const cpuTeam   = NATIONS_BY_ID[cpuTeamId];
        const userTeam  = NATIONS_BY_ID[prev.userTeamId];
        const gkRating  = userTeam?.goalkeeper_rating ?? 65;

        const { shot, gkDive, outcome } = resolveCPUShot(
          cpuTeam?.penalty_skill ?? 65,
          gkRating,
        );

        const commentary = getPenaltyCommentary(outcome, shot.technique, 'en');
        showCommentary(commentary);

        const newKick: KickRecord = { teamId: cpuTeamId, outcome };
        const newKicks = [...prev.kicks, newKick];
        const homeScore = newKicks.filter(
          (k) => k.teamId === prev.homeTeamId && k.outcome === 'goal',
        ).length;
        const awayScore = newKicks.filter(
          (k) => k.teamId === prev.awayTeamId && k.outcome === 'goal',
        ).length;

        const nextState: ShootoutState = {
          ...prev,
          kicks: newKicks,
          homeScore,
          awayScore,
          kickPhase: 'resolving',
          lastKickResult: { outcome, commentary, gkDive },
        };

        advanceKick(nextState);
        return nextState;
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [state?.kickPhase, advanceKick]);

  // ── User kick handlers ────────────────────────────────────────────────────

  function handleTechniqueSelect(technique: ShotTechnique) {
    setState((prev) => prev ? { ...prev, kickPhase: 'aiming', pendingShot: { technique } } : prev);
  }

  function handleZoneSelect(zone: GoalZone) {
    setState((prev) => {
      if (!prev) return prev;
      const pendingShot = { ...prev.pendingShot, zone };
      return { ...prev, kickPhase: 'power', pendingShot };
    });
  }

  function handlePowerRelease(power: number) {
    setState((prev) => {
      if (!prev) return prev;
      const pendingShot = { ...prev.pendingShot, power };
      return { ...prev, kickPhase: 'accuracy', pendingShot };
    });
  }

  function handleAccuracyTap(accuracy: number) {
    setState((prev) => {
      if (!prev) return prev;

      const shot = { ...prev.pendingShot, accuracy } as Required<typeof prev.pendingShot>;
      if (
        shot.zone === undefined ||
        shot.power === undefined ||
        shot.technique === undefined
      ) return prev;

      const userTeamId = prev.userTeamId;
      const oppTeamId  = prev.currentKickTeam === 'home' ? prev.awayTeamId : prev.homeTeamId;
      const oppTeam    = NATIONS_BY_ID[oppTeamId];
      const gkRating   = oppTeam?.goalkeeper_rating ?? 65;
      const gkDive     = generateGKDive(gkRating);

      const outcome = resolveUserShot(
        { zone: shot.zone as GoalZone, power: shot.power, accuracy, technique: shot.technique as ShotTechnique },
        gkDive,
        gkRating,
      );

      const commentary = getPenaltyCommentary(outcome, shot.technique as ShotTechnique, 'tr');
      showCommentary(commentary);

      const newKick: KickRecord = { teamId: userTeamId, outcome };
      const newKicks = [...prev.kicks, newKick];
      const homeScore = newKicks.filter(
        (k) => k.teamId === prev.homeTeamId && k.outcome === 'goal',
      ).length;
      const awayScore = newKicks.filter(
        (k) => k.teamId === prev.awayTeamId && k.outcome === 'goal',
      ).length;

      const nextState: ShootoutState = {
        ...prev,
        kicks: newKicks,
        homeScore,
        awayScore,
        kickPhase: 'resolving',
        lastKickResult: { outcome, commentary, gkDive },
        pendingShot: { ...prev.pendingShot, accuracy },
      };

      advanceKick(nextState);
      return nextState;
    });
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const homeTeam = state ? NATIONS_BY_ID[state.homeTeamId] : null;
  const awayTeam = state ? NATIONS_BY_ID[state.awayTeamId] : null;
  const isUserTurn = state
    ? (state.currentKickTeam === 'home'
        ? state.userTeamId === state.homeTeamId
        : state.userTeamId === state.awayTeamId)
    : false;

  const kickingTeam = state
    ? NATIONS_BY_ID[state.currentKickTeam === 'home' ? state.homeTeamId : state.awayTeamId]
    : null;

  const ringDuration = kickingTeam
    ? getRingDuration(kickingTeam.penalty_skill ?? 65)
    : 1200;

  // ── Render ─────────────────────────────────────────────────────────────────

  // MODE SELECT
  if (topPhase === 'mode_select') {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.pageTitle}>⚽ PENALTY SHOOTOUT</Text>
        <Text style={styles.pageSubtitle}>Choose mode</Text>
        <View style={styles.modeButtons}>
          <TouchableOpacity
            style={styles.modeBtn}
            onPress={() => { setSelectedMode('best_of_5'); setTopPhase('team_select'); }}
            activeOpacity={0.8}
          >
            <Text style={styles.modeBtnTitle}>BEST OF 5</Text>
            <Text style={styles.modeBtnSub}>5 kicks each, most goals wins</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modeBtn}
            onPress={() => { setSelectedMode('sudden_death'); setTopPhase('team_select'); }}
            activeOpacity={0.8}
          >
            <Text style={styles.modeBtnTitle}>SUDDEN DEATH</Text>
            <Text style={styles.modeBtnSub}>One miss and it's over</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // TEAM SELECT
  if (topPhase === 'team_select') {
    const canStart = pickedHome !== null && pickedAway !== null && selectedMode !== null;
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.pageTitle}>⚽ PENALTY SHOOTOUT</Text>
        <Text style={styles.pageSubtitle}>Pick your teams</Text>
        <View style={styles.teamPickers}>
          <TeamPicker
            label="YOUR TEAM"
            selected={pickedHome}
            onSelect={setPickedHome}
            exclude={pickedAway}
          />
          <TeamPicker
            label="OPPONENT"
            selected={pickedAway}
            onSelect={setPickedAway}
            exclude={pickedHome}
          />
        </View>
        <TouchableOpacity
          style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
          onPress={() => canStart && startShootout(pickedHome!, pickedAway!, selectedMode!)}
          activeOpacity={canStart ? 0.8 : 1}
        >
          <Text style={styles.startBtnText}>START SHOOTOUT ▶</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // FINISHED
  if (topPhase === 'finished' && state && homeTeam && awayTeam) {
    return (
      <SafeAreaView style={styles.root}>
        <ResultScreen
          state={state}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          onPlayAgain={() => {
            setTopPhase('mode_select');
            setState(null);
          }}
          onBack={() => {
            setTopPhase('mode_select');
            setState(null);
          }}
        />
      </SafeAreaView>
    );
  }

  // KICKING
  if (!state || !homeTeam || !awayTeam || !kickingTeam) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.pageTitle}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const { kickPhase, lastKickResult, pendingShot } = state;
  const showResult = kickPhase === 'resolving';
  const isAiming   = kickPhase === 'aiming';

  return (
    <SafeAreaView style={styles.root}>
      {/* Score tracker */}
      <ScoreTracker
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        kicks={state.kicks}
        homeScore={state.homeScore}
        awayScore={state.awayScore}
        round={state.round}
      />

      {/* Kicker info */}
      <View style={styles.kickerRow}>
        <Text style={styles.kickerText}>
          {kickingTeam.flag} {kickingTeam.name}
          {isUserTurn ? '  (YOU)' : '  (CPU)'}
        </Text>
        {state.mode === 'sudden_death' && (
          <View style={styles.sdBadge}>
            <Text style={styles.sdBadgeText}>SUDDEN DEATH</Text>
          </View>
        )}
      </View>

      {/* Goal WebView — always shown */}
      <View style={styles.goalContainer}>
        <GoalWebView
          pendingShot={
            showResult && lastKickResult && pendingShot.zone !== undefined
              ? {
                  zone:    pendingShot.zone as GoalZone,
                  gkDive:  lastKickResult.gkDive,
                  outcome: lastKickResult.outcome,
                }
              : null
          }
          onAnimDone={() => {}}
          onReady={() => {}}
        />

        {/* Aim overlay — absolutely positioned to match WebView goal interior */}
        {isAiming && (
          <AimOverlay
            selectedZone={pendingShot.zone as GoalZone ?? null}
            onSelect={handleZoneSelect}
            disabled={false}
            containerStyle={{
              left:   WV_GOAL_X + WV_POST,
              top:    WV_GOAL_Y + WV_POST,
              width:  WV_GOAL_W - WV_POST * 2,
              height: WV_GOAL_H - WV_POST,
            }}
          />
        )}
      </View>

      {/* Commentary toast */}
      {commentary && (
        <View style={styles.commentaryBox} pointerEvents="none">
          <Text style={styles.commentaryText}>{commentary}</Text>
        </View>
      )}

      {/* ── Phase-specific controls ── */}
      <View style={styles.controls}>

        {/* TECHNIQUE SELECT */}
        {kickPhase === 'technique_select' && isUserTurn && (
          <View style={styles.techniquePanel}>
            <Text style={styles.controlsLabel}>CHOOSE YOUR SHOT</Text>
            {(
              [
                { key: 'regular', emoji: '⚽', title: 'Regular', sub: 'Balanced power & accuracy' },
                { key: 'power',   emoji: '💥', title: 'Power Shot', sub: 'Hard & fast, harder to aim' },
                { key: 'panenka', emoji: '😏', title: 'Panenka', sub: 'Chip it — risky genius' },
              ] as { key: ShotTechnique; emoji: string; title: string; sub: string }[]
            ).map(({ key, emoji, title, sub }) => (
              <TouchableOpacity
                key={key}
                style={styles.techniqueBtn}
                onPress={() => handleTechniqueSelect(key)}
                activeOpacity={0.8}
              >
                <Text style={styles.techniqueBtnEmoji}>{emoji}</Text>
                <View>
                  <Text style={styles.techniqueBtnTitle}>{title}</Text>
                  <Text style={styles.techniqueBtnSub}>{sub}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* AIMING */}
        {kickPhase === 'aiming' && isUserTurn && (
          <View style={styles.aimPanel}>
            <Text style={styles.controlsLabel}>TAP A ZONE IN THE GOAL ↑</Text>
            <Text style={styles.controlsHint}>
              Technique: <Text style={{ color: COLORS.primary }}>
                {pendingShot.technique === 'panenka' ? 'Panenka 😏' : pendingShot.technique === 'power' ? 'Power 💥' : 'Regular ⚽'}
              </Text>
            </Text>
          </View>
        )}

        {/* POWER */}
        {kickPhase === 'power' && isUserTurn && (
          <View style={styles.powerPanel}>
            <Text style={styles.controlsLabel}>BUILD POWER</Text>
            <PowerBar onRelease={handlePowerRelease} disabled={false} />
          </View>
        )}

        {/* ACCURACY */}
        {kickPhase === 'accuracy' && isUserTurn && (
          <View style={styles.accuracyPanel}>
            <AccuracyRing
              ringDuration={ringDuration}
              onTap={handleAccuracyTap}
              disabled={false}
            />
          </View>
        )}

        {/* CPU KICKING / RESOLVING */}
        {(kickPhase === 'cpu_kicking' || (kickPhase === 'resolving' && !isUserTurn)) && (
          <View style={styles.cpuPanel}>
            <Text style={styles.cpuText}>
              {kickPhase === 'cpu_kicking'
                ? `${kickingTeam.flag} ${kickingTeam.name} is taking the penalty...`
                : `${lastKickResult?.outcome === 'goal' ? '⚽ GOAL' : lastKickResult?.outcome === 'saved' ? '🧤 SAVED' : '❌ MISS'}`}
            </Text>
          </View>
        )}

        {/* RESOLVING (user's kick) */}
        {kickPhase === 'resolving' && isUserTurn && (
          <View style={styles.cpuPanel}>
            <Text style={styles.cpuText}>
              {lastKickResult?.outcome === 'goal' ? '⚽ GOAL!' : lastKickResult?.outcome === 'saved' ? '🧤 SAVED!' : '❌ MISS!'}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },

  // ── Page headers ──
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: SPACING.md,
    letterSpacing: 2,
  },
  pageSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },

  // ── Mode select ──
  modeButtons: {
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.lg,
  },
  modeBtn: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.primary,
    padding: SPACING.md,
    alignItems: 'center',
  },
  modeBtnTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  modeBtnSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  // ── Team select ──
  teamPickers: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: SPACING.sm,
    gap: SPACING.sm,
  },
  pickerBlock: {
    flex: 1,
  },
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
  pickerItemSelected: {
    backgroundColor: `${COLORS.primary}30`,
  },
  pickerItemDisabled: {
    opacity: 0.3,
  },
  pickerFlag: { fontSize: 16 },
  pickerName: {
    fontSize: 11,
    color: COLORS.textSecondary,
    flex: 1,
  },
  pickerNameSelected: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  pickerNameDisabled: {
    color: COLORS.textMuted,
  },
  startBtn: {
    margin: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: SPACING.md,
    alignItems: 'center',
  },
  startBtnDisabled: {
    backgroundColor: COLORS.bgCardAlt,
  },
  startBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 1,
  },

  // ── Kicking phase ──
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  kickerText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  sdBadge: {
    backgroundColor: COLORS.danger,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sdBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  goalContainer: {
    width: '100%',
    position: 'relative',
  },
  commentaryBox: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.xs,
    backgroundColor: COLORS.bgCardAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
  },
  commentaryText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    textAlign: 'center',
    fontWeight: '500',
  },

  // ── Controls area ──
  controls: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    justifyContent: 'flex-start',
  },
  controlsLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  controlsHint: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // Technique panel
  techniquePanel: {
    gap: SPACING.xs,
  },
  techniqueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.bgSurface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
  },
  techniqueBtnEmoji: {
    fontSize: 24,
    width: 34,
    textAlign: 'center',
  },
  techniqueBtnTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  techniqueBtnSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // Aim panel
  aimPanel: {
    alignItems: 'center',
    paddingTop: SPACING.lg,
  },

  // Power panel
  powerPanel: {
    alignItems: 'center',
    paddingTop: SPACING.sm,
  },

  // Accuracy panel
  accuracyPanel: {
    alignItems: 'center',
    paddingTop: SPACING.sm,
    flex: 1,
  },

  // CPU panel
  cpuPanel: {
    alignItems: 'center',
    paddingTop: SPACING.xl,
  },
  cpuText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // Result screen
  resultScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  resultTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  resultFlag: {
    fontSize: 64,
  },
  resultWinner: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  resultScore: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 2,
    marginTop: SPACING.sm,
  },
  resultNames: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
  },
  resultActions: {
    gap: SPACING.sm,
    width: '100%',
  },
  playAgainBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: SPACING.md,
    alignItems: 'center',
  },
  playAgainBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 1,
  },
  backBtn: {
    backgroundColor: COLORS.bgCardAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: 'bold',
  },
});
