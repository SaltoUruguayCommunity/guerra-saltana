import type { SaltoPlayClient, SaltoSession } from "./saltoplay";
interface Statistics {
  matches: number;
  wins: [number, number];
}
export class Platform {
  sdk?: SaltoPlayClient;
  session?: SaltoSession;
  async init() {
    if (!window.SaltoPlay) return;
    const hosted = window.parent !== window;
    const clientId = import.meta.env.VITE_SALTOPLAY_CLIENT_ID;
    if (!hosted && !clientId) return;
    this.sdk = await window.SaltoPlay.init(
      hosted
        ? {}
        : {
            transport: "external",
            apiOrigin: "https://play.saltouruguayserver.com",
            clientId,
            redirectUri:
              import.meta.env.VITE_SALTOPLAY_REDIRECT_URI ||
              location.origin + "/",
            scopes: [
              "profile:read",
              "saltotag:read",
              "saves:read",
              "saves:write",
              "achievements:read",
              "achievements:write",
            ],
          },
    );
    this.session = await this.sdk.auth.getSession();
    if (this.session.authenticated) {
      const tag = await this.sdk.player.getSaltoTag();
      return tag.tag || tag.displayName;
    }
  }
  async login() {
    if (!this.sdk)
      throw Error(
        "Registrá un cliente OAuth en SaltoUruguayServer y configurá VITE_SALTOPLAY_CLIENT_ID.",
      );
    await this.sdk.auth.login();
  }
  async save(result: number | null) {
    const key = "guerra-saltana-stats";
    const stats: Statistics = JSON.parse(
      localStorage.getItem(key) || '{"matches":0,"wins":[0,0]}',
    );
    stats.matches++;
    if (result === 0 || result === 1) stats.wins[result]++;
    localStorage.setItem(key, JSON.stringify(stats));
    if (this.session?.authenticated && this.sdk) {
      await this.sdk.saves.get("stats");
      await this.sdk.saves.set("stats", stats);
      await this.sdk.ui
        .notify({
          title: "Partida guardada",
          message: "Tu progreso está sincronizado con SaltoPlay.",
          tone: "success",
          duration: 3500,
        })
        .catch(() => {
          /* Presentation errors do not invalidate a saved match. */
        });
    }
    return stats;
  }
}
