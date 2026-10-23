import type { SaltoPlayClient, SaltoSession } from "./saltoplay";
interface Statistics {
  matches: number;
  wins: [number, number];
}
export class Platform {
  sdk?: SaltoPlayClient;
  session?: SaltoSession;
  profile?: { displayName: string; avatar: string | null };
  async init() {
    if (!window.SaltoPlay)
      throw new Error("No se pudo cargar el SDK de SaltoUruguayServer. Reintentá la conexión.");
    const hosted = window.parent !== window;
    const clientId = import.meta.env.VITE_SALTOPLAY_CLIENT_ID;
    if (!hosted && !clientId)
      throw new Error("Falta configurar el cliente OAuth de SaltoUruguayServer para este juego.");
    this.sdk = await window.SaltoPlay.init(
      hosted
        ? {}
        : {
            transport: "external",
            apiOrigin: "https://play.saltouruguayserver.com",
            clientId,
            loginMode: "popup",
            persistence: "session",
            redirectUri:
              import.meta.env.VITE_SALTOPLAY_REDIRECT_URI ||
              new URL("./", location.href).href,
            scopes: [
              "profile:read",
              "saltotag:read",
            ],
          },
    );
    return this.refreshAccount();
  }
  async refreshAccount() {
    if (!this.sdk) return;
    this.session = await this.sdk.auth.getSession();
    this.profile = undefined;
    if (this.session.authenticated) {
      const [tag, profile] = await Promise.all([
        this.sdk.player.getSaltoTag().catch(() => null),
        this.sdk.player.getProfile().catch(() => null),
      ]);
      this.session = await this.sdk.auth.getSession();
      if (!this.session.authenticated) return;
      this.profile = {
        displayName: profile?.displayName || tag?.displayName || tag?.tag || "Jugador",
        avatar: profile?.avatar ?? null,
      };
      return tag?.tag || tag?.displayName;
    }
  }
  async login() {
    if (!this.sdk)
      throw Error(
        "Registrá un cliente OAuth en SaltoUruguayServer y configurá VITE_SALTOPLAY_CLIENT_ID.",
      );
    await this.sdk.auth.login();
    return this.refreshAccount();
  }
  async save(result: number | null) {
    const key = "guerra-saltana-stats";
    const stats: Statistics = JSON.parse(
      localStorage.getItem(key) || '{"matches":0,"wins":[0,0]}',
    );
    stats.matches++;
    if (result === 0 || result === 1) stats.wins[result]++;
    localStorage.setItem(key, JSON.stringify(stats));
    return stats;
  }
}
