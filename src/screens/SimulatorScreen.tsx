import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ListRenderItem,
} from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useSimulator } from '../hooks/useSimulator';
import { NATIONS, NATIONS_BY_ID } from '../constants/nations';
import { COLORS, SPACING, FONT_SIZE } from '../constants/theme';
import { MatchEvent, Team, EventType } from '../types/simulator';
import { BottomTabParamList } from '../navigation/BottomTabNavigator';
import { useMatchStore } from '../store/useMatchStore';

type Props = BottomTabScreenProps<BottomTabParamList, 'Simulator'>;

// ─── Event icons ─────────────────────────────────────────────────────────────

const EVENT_ICON: Record<EventType, string> = {
  goal:        '⚽',
  yellow_card: '🟨',
  red_card:    '🟥',
  save:        '🧤',
  foul:        '🦶',
  var_check:   '📺',
  injury:      '🏥',
  kickoff:     '🏁',
  halftime:    '⏸️',
  fulltime:    '🏆',
};

const EVENT_COLOR: Record<EventType, string> = {
  goal:        COLORS.goal,
  yellow_card: COLORS.yellowCard,
  red_card:    COLORS.redCard,
  save:        COLORS.save,
  foul:        COLORS.foul,
  var_check:   COLORS.varCheck,
  injury:      COLORS.injury,
  kickoff:     COLORS.neutral,
  halftime:    COLORS.neutral,
  fulltime:    COLORS.primary,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function TeamRow({ team, label, selected, onPress }: {
  team: Team;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.teamRow, selected && styles.teamRowSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.teamRowFlag}>{team.flag}</Text>
      <Text style={[styles.teamRowName, selected && styles.teamRowNameSelected]} numberOfLines={1}>
        {team.name}
      </Text>
      {selected && <Text style={styles.teamRowBadge}>{label}</Text>}
    </TouchableOpacity>
  );
}

function Scoreboard({ homeTeam, awayTeam, homeScore, awayScore, minute, status }: {
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number;
  awayScore: number;
  minute: number;
  status: string;
}) {
  const minuteLabel =
    status === 'running'  ? `⏱ ${minute}'` :
    status === 'finished' ? 'FULL TIME' :
    'KICK OFF';

  return (
    <View style={styles.scoreboard}>
      <View style={styles.scoreTeam}>
        <Text style={styles.scoreFlag}>{homeTeam.flag}</Text>
        <Text style={styles.scoreName} numberOfLines={1}>{homeTeam.name}</Text>
      </View>
      <View style={styles.scoreCenter}>
        <Text style={styles.scoreNumbers}>{homeScore} – {awayScore}</Text>
        <Text style={styles.scoreMinute}>{minuteLabel}</Text>
      </View>
      <View style={[styles.scoreTeam, styles.scoreTeamRight]}>
        <Text style={styles.scoreFlag}>{awayTeam.flag}</Text>
        <Text style={styles.scoreName} numberOfLines={1}>{awayTeam.name}</Text>
      </View>
    </View>
  );
}

function EventItem({ event, homeId }: { event: MatchEvent; homeId: string }) {
  const isNeutral = event.teamId === '';
  const side = isNeutral ? '' : event.teamId === homeId ? 'H' : 'A';
  const color = EVENT_COLOR[event.type];

  return (
    <View style={styles.eventRow}>
      <Text style={[styles.eventIcon]}>{EVENT_ICON[event.type]}</Text>
      <View style={styles.eventBody}>
        <Text style={[styles.eventMinute, { color }]}>
          {event.minute > 0 ? `${event.minute}'` : '0'}{side ? `  [${side}]` : ''}
        </Text>
        <Text style={styles.eventCommentary}>{event.commentary}</Text>
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function SimulatorScreen({ route }: Props) {
  const { state, selectHomeTeam, selectAwayTeam, startMatch, resetMatch, setTeamsAndStart } = useSimulator();
  const saveResult = useMatchStore((s) => s.saveResult);
  const feedRef = useRef<FlatList<MatchEvent>>(null);

  const fixtureId = route.params?.fixtureId;

  // When navigated from Fixtures with pre-selected teams, kick off immediately
  useEffect(() => {
    const homeId = route.params?.homeTeamId;
    const awayId = route.params?.awayTeamId;
    if (homeId && awayId) {
      const home = NATIONS_BY_ID[homeId];
      const away = NATIONS_BY_ID[awayId];
      if (home && away) setTeamsAndStart(home, away);
    }
  // Depend on the ID strings so re-navigation with different teams fires again
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.homeTeamId, route.params?.awayTeamId]);

  // Save result to store when match reaches FULLTIME
  useEffect(() => {
    if (state.status !== 'finished') return;
    if (!state.homeTeam || !state.awayTeam) return;

    saveResult({
      fixtureId: fixtureId ?? `adhoc-${state.homeTeam.id}-${state.awayTeam.id}-${Date.now()}`,
      homeTeamId: state.homeTeam.id,
      awayTeamId: state.awayTeam.id,
      homeScore: state.homeScore,
      awayScore: state.awayScore,
      events: state.events,
      simulatedAt: Date.now(),
    });
  // Only fire once per status transition to 'finished'
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // Auto-scroll event feed to the latest event
  useEffect(() => {
    if (state.events.length > 0) {
      feedRef.current?.scrollToEnd({ animated: true });
    }
  }, [state.events.length]);

  const bothSelected = state.homeTeam !== null && state.awayTeam !== null;
  const sameTeam = state.homeTeam?.id === state.awayTeam?.id;
  const canKickOff = bothSelected && !sameTeam;

  const renderTeam: ListRenderItem<Team> = ({ item }) => (
    <View style={styles.teamPickerRow}>
      <TeamRow
        team={item}
        label="H"
        selected={state.homeTeam?.id === item.id}
        onPress={() => selectHomeTeam(item)}
      />
      <TeamRow
        team={item}
        label="A"
        selected={state.awayTeam?.id === item.id}
        onPress={() => selectAwayTeam(item)}
      />
    </View>
  );

  const renderEvent: ListRenderItem<MatchEvent> = ({ item }) => (
    <EventItem event={item} homeId={state.homeTeam?.id ?? ''} />
  );

  // ── Idle: team picker ──────────────────────────────────────────────────────
  if (state.status === 'idle') {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.header}>⚽ MATCH SIMULATOR</Text>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerLabel}>HOME</Text>
          <Text style={styles.pickerLabel}>AWAY</Text>
        </View>
        <FlatList
          data={NATIONS}
          keyExtractor={(t) => t.id}
          renderItem={renderTeam}
          contentContainerStyle={styles.pickerList}
          style={styles.picker}
        />
        <TouchableOpacity
          style={[styles.ctaButton, !canKickOff && styles.ctaButtonDisabled]}
          onPress={startMatch}
          disabled={!canKickOff}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaText}>
            {!bothSelected ? 'PICK BOTH TEAMS' :
             sameTeam     ? 'PICK DIFFERENT TEAMS' :
             '⚽  KICK OFF!'}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Running / Finished: match view ─────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.header}>⚽ MATCH SIMULATOR</Text>

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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
    paddingVertical: SPACING.sm,
    letterSpacing: 1.5,
  },

  // ── Team picker ──
  pickerHeader: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  pickerLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZE.sm,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  picker: {
    flex: 1,
  },
  pickerList: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  teamPickerRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  teamRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 6,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  teamRowSelected: {
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.primary,
  },
  teamRowFlag: {
    fontSize: FONT_SIZE.md,
  },
  teamRowName: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  teamRowNameSelected: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
  },
  teamRowBadge: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: 'bold',
  },

  // ── Scoreboard ──
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: 10,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scoreTeam: {
    flex: 1,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  scoreTeamRight: {
    // mirror of left
  },
  scoreFlag: {
    fontSize: FONT_SIZE.xxl,
  },
  scoreName: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  scoreCenter: {
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  scoreNumbers: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
  scoreMinute: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // ── Event feed ──
  feed: {
    flex: 1,
    marginHorizontal: SPACING.md,
  },
  feedContent: {
    paddingBottom: SPACING.md,
    gap: 2,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: 6,
    padding: SPACING.sm,
    gap: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.border,
  },
  eventIcon: {
    fontSize: FONT_SIZE.md,
    marginTop: 1,
  },
  eventBody: {
    flex: 1,
  },
  eventMinute: {
    fontSize: FONT_SIZE.xs,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  eventCommentary: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  // ── CTA button ──
  ctaButton: {
    backgroundColor: COLORS.primary,
    margin: SPACING.md,
    borderRadius: 8,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  ctaButtonDisabled: {
    backgroundColor: COLORS.primaryDim,
    opacity: 0.6,
  },
  ctaText: {
    fontSize: FONT_SIZE.md,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 1,
  },
});
