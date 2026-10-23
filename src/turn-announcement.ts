import type { Team } from "../shared/types";

/** One transient UI announcement per observed forward turn change. */
export class TurnAnnouncement {
  private element = document.getElementById("turn-announcement")!;
  private dismissTimer?: ReturnType<typeof setTimeout>;
  private hideTimer?: ReturnType<typeof setTimeout>;

  show(turn: number, team: Team) {
    this.clear();
    document.getElementById("turn-announcement-title")!.textContent =
      team === 0 ? "LOS CELESTES" : "LOS CÍTRICOS";
    document.getElementById("turn-announcement-number")!.textContent =
      `TURNO ${String(turn).padStart(2, "0")}`;
    this.element.dataset.team = String(team);
    this.element.hidden = false;
    this.dismissTimer = setTimeout(() => {
      this.element.classList.add("turn-notice-leaving");
      this.hideTimer = setTimeout(() => {
        this.element.hidden = true;
      }, 200);
    }, 1800);
  }

  clear() {
    clearTimeout(this.dismissTimer);
    clearTimeout(this.hideTimer);
    this.element.hidden = true;
    this.element.classList.remove("turn-notice-leaving");
  }
}
