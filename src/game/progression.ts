export const INITIAL_OBJECTIVE = "Reach the tower at the center of the maze.";
export const TOWER_OBJECTIVE = "Climb to the top of the tower.";
export const RETURN_OBJECTIVE = "Return the orb to the pedestal at spawn.";
export const WIN_OBJECTIVE = "The orb rests on the pedestal. You escaped the maze.";

export type ProgressionState = {
  objective: string;
  enteredTower: boolean;
  hasOrb: boolean;
  orbPlaced: boolean;
  won: boolean;
};

export function createProgression(): ProgressionState {
  return {
    objective: INITIAL_OBJECTIVE,
    enteredTower: false,
    hasOrb: false,
    orbPlaced: false,
    won: false,
  };
}

export function enterTower(state: ProgressionState): ProgressionState {
  if (state.won || state.hasOrb || state.enteredTower) {
    return state;
  }

  return {
    ...state,
    objective: TOWER_OBJECTIVE,
    enteredTower: true,
  };
}

export function collectOrb(state: ProgressionState): ProgressionState {
  if (state.won || state.hasOrb || state.orbPlaced) {
    return state;
  }

  return {
    ...state,
    objective: RETURN_OBJECTIVE,
    enteredTower: true,
    hasOrb: true,
  };
}

export function placeOrbOnPedestal(state: ProgressionState): ProgressionState {
  if (!state.hasOrb || state.orbPlaced || state.won) {
    return state;
  }

  return {
    ...state,
    objective: WIN_OBJECTIVE,
    hasOrb: false,
    orbPlaced: true,
    won: true,
  };
}
