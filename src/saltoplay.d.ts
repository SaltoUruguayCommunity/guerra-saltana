/** Public surface consumed from the hosted SaltoPlay SDK. */
export interface SaltoUIOptions {
  enabled?: boolean;
  welcome?: boolean;
  position?:
    | "bottom-center"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "top-right"
    | "top-left";
  duration?: number;
}
export interface SaltoNotification {
  id?: string;
  title?: string;
  message?: string;
  description?: string;
  tone?: "info" | "success" | "error";
  duration?: number;
  gameTitle?: string;
  xp?: number;
  demo?: boolean;
}
export interface SaltoSession {
  authenticated: boolean;
  transport?: string;
  demo?: boolean;
}
export interface SaltoPlayClient {
  auth: {
    getSession(): Promise<SaltoSession>;
    login(): Promise<unknown>;
    logout(): Promise<void>;
  };
  player: {
    getProfile(): Promise<{
      id?: string;
      displayName: string;
      avatar: string | null;
    }>;
    getSaltoTag(): Promise<{
      id: string;
      tag: string;
      displayName: string;
    }>;
  };
  saves: {
    get(slot: string): Promise<unknown>;
    set(slot: string, data: unknown): Promise<unknown>;
  };
  achievements: {
    list(): Promise<unknown[]>;
    requestUnlock(key: string): Promise<{
      unlocked: boolean;
      newlyUnlocked: boolean;
      xp: number;
      achievement?: { key: string; title: string; description?: string | null };
    }>;
  };
  ui: {
    notify(value: string | SaltoNotification): Promise<string | null>;
    showAchievement(value: SaltoNotification): Promise<string | null>;
    configure(options: SaltoUIOptions): Promise<Required<SaltoUIOptions>>;
    dismissAll(): Promise<boolean>;
  };
  destroy(): void;
}
interface SaltoPlayOptions {
  transport?: "external";
  apiOrigin?: string;
  clientId?: string;
  redirectUri?: string;
  scopes?: string[];
  loginMode?: "popup" | "redirect";
  persistence?: "session" | "memory";
  ui?: SaltoUIOptions;
}
declare global {
  interface Window {
    SaltoPlay?: {
      version: string;
      isOAuthCallback?: boolean;
      init(options?: SaltoPlayOptions): Promise<SaltoPlayClient>;
      ui: {
        showWelcome(value: { id?: string; tag?: string; displayName?: string; avatar?: string | null }, options?: { once?: boolean }): string | null;
        notify(value: string | SaltoNotification): string | null;
        showAchievement(value: SaltoNotification): string | null;
        configure(options?: SaltoUIOptions): Required<SaltoUIOptions>;
        dismissAll(): boolean;
      };
    };
  }
}
