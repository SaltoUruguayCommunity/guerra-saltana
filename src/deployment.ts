import { DEPLOYMENT_MS } from "../shared/presentation";

/** A shutter cut, team briefing and reveal. Gameplay stays locked until release. */
export class Deployment {
  active = false;
  onTick: () => void = () => {};
  private screen = document.getElementById("deployment-screen")!;
  private app = document.getElementById("app")!;
  private timers: ReturnType<typeof setTimeout>[] = [];

  play(
    onCovered: () => void,
    onReady: () => void = () => {},
    duration = DEPLOYMENT_MS,
  ) {
    if (this.active) return;
    this.active = true;
    this.app.classList.add("is-deploying");
    this.app.inert = true;
    this.screen.hidden = false;
    this.screen.classList.remove("deployment-reveal", "deployment-covered");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cover = reduced ? 0 : Math.min(350, duration * 0.12);
    const reveal = reduced ? 0 : Math.min(550, duration * 0.18);
    this.screen.style.setProperty(
      "--deployment-edge-ms",
      `${Math.max(1, reveal)}ms`,
    );
    document.getElementById("deployment-count")!.textContent = "3";
    this.later(cover, () => {
      onCovered();
      this.screen.classList.add("deployment-covered");
      this.onTick();
    });
    this.later(duration * 0.36, () => {
      document.getElementById("deployment-count")!.textContent = "2";
      this.onTick();
    });
    this.later(duration * 0.6, () => {
      document.getElementById("deployment-count")!.textContent = "1";
      this.onTick();
    });
    this.later(Math.max(cover, duration - reveal), () => {
      document.getElementById("deployment-count")!.textContent = "¡AL FRENTE!";
      this.screen.classList.add("deployment-reveal");
    });
    this.later(duration, () => {
      this.screen.hidden = true;
      this.active = false;
      this.app.classList.remove("is-deploying");
      this.app.inert = this.app.hasAttribute("aria-busy");
      this.timers = [];
      onReady();
    });
  }

  private later(delay: number, action: () => void) {
    this.timers.push(setTimeout(action, delay));
  }
}
