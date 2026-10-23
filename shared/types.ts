export type Team = 0 | 1;
export type Animation = "idle" | "walk" | "jump" | "shoot" | "hurt" | "dead";
export interface Unit {
  id: number;
  team: Team;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  face: number;
  anim: Animation;
}
export interface Weapon {
  name: string;
  damage: number;
  radius: number;
  speed: number;
  gravity: number;
  bounce: number;
}
export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  weapon: number;
  age: number;
  bounces: number;
}
export interface Explosion {
  x: number;
  y: number;
  r: number;
  id: number;
  tick: number;
}
export interface GameState {
  terrain: Uint8Array;
  units: Unit[];
  active: number;
  team: Team;
  turn: number;
  time: number;
  wind: number;
  seed: number;
  phase: "aim" | "flight" | "settle" | "over";
  projectile: Projectile | null;
  explosions: Explosion[];
  event: number;
  winner: Team | -1 | null;
  travel: number;
  tick: number;
  settle: number;
}
export type Action =
  | {
      type: "move";
      dir: number;
    }
  | {
      type: "jump";
    }
  | {
      type: "fire";
      angle: number;
      power: number;
      weapon: number;
    };
export type GameSnapshot = Omit<GameState, "terrain"> & {
  terrain?: undefined;
};
export interface Peer {
  name: string;
  connected: boolean;
}
export type ClientMessage =
  | {
      type: "list";
    }
  | {
      type: "resume";
      code: string;
      token: string;
    }
  | {
      type: "create";
      name: string;
      public: boolean;
    }
  | {
      type: "join";
      name: string;
      code: string;
    }
  | {
      type: "action";
      action: Action;
    };
export type ServerMessage =
  | {
      type: "rooms";
      rooms: {
        code: string;
        name: string;
      }[];
    }
  | {
      type: "joined";
      code: string;
      token: string;
      team: Team;
    }
  | {
      type: "error";
      message: string;
    }
  | {
      type: "state";
      state: GameSnapshot;
      deploymentMs?: number;
      terrain?: number[];
      players: Peer[];
      started: boolean;
    };
