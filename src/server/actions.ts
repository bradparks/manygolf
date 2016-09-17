import I from 'immutable';
import p2 from 'p2';

import ManygolfSocketManager from './ManygolfSocketManager';
import levelGen from '../universal/levelGen';

import {
  messageDisplayMessage,
  messagePlayerDisconnected,
  messagePlayerIdleKicked,
  messageLevel,
  messageSync,
  messageHurryUp,
} from '../universal/protocol';

import {
  ensureBallInBounds,
} from '../universal/physics';

import {
  IDLE_KICK_MS,
  TIMER_MS,
  HURRY_UP_MS,
  MATCH_LENGTH_MS,
  MATCH_OVER_MS,
} from '../universal/constants';

import {
  PlayersMap,
  Level,
  State,
} from './records';

import {createLevelOver, createMatchOver} from './messages';

type Dispatch = (action: any) => State;

export function sweepInactivePlayers(
  dispatch: Dispatch, socks: ManygolfSocketManager,
  {players, now}: {players: PlayersMap; now: number}
) {
  players.forEach((player, id) => {
    if (now > player.lastSwingTime  + IDLE_KICK_MS) {
      dispatch({
        type: 'leaveGame',
        id,
      });

      if (player.disconnected) {
        // this player already disconnected, so...
        return;
      }

      console.log(`Idle kicking ${player.name}`);

      socks.sendAll(messagePlayerDisconnected({
        id,
      }));

      socks.sendTo(id, messagePlayerIdleKicked({id}));

      const msg = `{{${player.name}}} is now spectating`;

      socks.sendAll(messageDisplayMessage({
        messageText: msg,
        color: player.color,
      }));
    }
  });
}

export function ensurePlayersInBounds(dispatch: Dispatch,
  {level, players}: {level: Level, players: PlayersMap}
) {
  players.forEach((player) => {
    return ensureBallInBounds(player.body, level);
  });
}

export function checkScored(
  dispatch: Dispatch, socks: ManygolfSocketManager,
  {overlappingMap, players, elapsed}: {
    overlappingMap: I.Iterable<number, Boolean>;
    players: PlayersMap;
    elapsed: number;
  }
) {
  players.forEach((player, id) => {
    if (player.scored) {
      return;

    } else {
      const isSleeping = player.body.sleepState === p2.Body.SLEEPING;
      const scored = overlappingMap.get(id) && isSleeping;

      if (scored) {
        dispatch({
          type: 'scored',
          id,
          elapsed,
        });

        const elapsedDisplay = (elapsed / 1000).toFixed(2);

        const strokeLabel = player.strokes === 1 ? 'stroke' : 'strokes';
        const {name, strokes} = player;
        const msg = `{{${name}}} scored! (${strokes} ${strokeLabel} in ${elapsedDisplay}s)`;

        socks.sendAll(messageDisplayMessage({
          messageText: msg,
          color: player.color,
        }));
      }
    }
  });
}

export function startMatch(dispatch: Dispatch) {
  const endTime = Date.now() + MATCH_LENGTH_MS;

  dispatch({
    type: 'startMatch',
    endTime,
  });
}

export function endMatch(dispatch: Dispatch, socks: ManygolfSocketManager) {
  const nextMatchAt = Date.now() + MATCH_OVER_MS;

  const state = dispatch({
    type: 'matchOver',
    nextMatchAt,
  });

  socks.sendAll(createMatchOver(state));
}

export function cycleLevel(dispatch: Dispatch, socks: ManygolfSocketManager) {
  console.log('Cycling level');

  const startTime = Date.now();
  const expTime = startTime + TIMER_MS;

  const nextLevel = levelGen();
  console.log(JSON.stringify(nextLevel));

  dispatch({
    type: 'level',
    levelData: nextLevel,
    expTime,
    startTime,
  });

  socks.sendAll(messageLevel({
    level: nextLevel,
    expiresIn: TIMER_MS,
  }));
}

export function sendSyncMessage(
  socks: ManygolfSocketManager,
  {players, time}: {players: PlayersMap, time: number}
) {
  const syncPlayers = players.map((player, id) => {
    return {
      id,
      position: [
        player.body.position[0],
        player.body.position[1],
      ],
      velocity: [
        player.body.velocity[0],
        player.body.velocity[1],
      ],
    };
  }).toArray();

  socks.sendAll(messageSync({
    players: syncPlayers,
    time,
  }));
}

export function levelOver(dispatch: Dispatch, socks: ManygolfSocketManager) {
  const newState = dispatch({
    type: 'levelOver',
  });

  socks.sendAll(createLevelOver(newState));
}

export function checkHurryUp(
  dispatch: Dispatch, socks: ManygolfSocketManager,
  {players, expTime}: {players: PlayersMap; expTime: number;}
) {
  // Go into hurry-up mode if the number of players who have yet to score is === 1 or less than
  // 25% of the remaining players and time is over hurry-up threshold
  const numRemaining = players
    .filter((player) => !player.scored && !player.disconnected)
    .size;

  if (players.size > 1 && numRemaining === 1 || (numRemaining / players.size) < 0.25) {
    const newTime = Date.now() + HURRY_UP_MS;

    if (expTime > newTime) {
      console.log('Hurry up mode entered');

      dispatch({
        type: 'hurryUp',
        expTime: newTime,
      });

      socks.sendAll(messageHurryUp({
        expiresIn: HURRY_UP_MS,
      }));
    }
  }
}