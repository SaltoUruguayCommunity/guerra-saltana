/** Real boot progress: font, Phaser loader, scene setup, and first rendered frame. */
import { BOOT_MIN_MS, BOOT_READY_HOLD_MS } from "../shared/presentation";
export class LoadingScreen {
  private screen = document.getElementById("loading-screen")!;
  private app = document.getElementById("app")!;
  private progress = document.getElementById("loading-progress")!;
  private fill = document.getElementById("loading-fill")!;
  private stage = document.getElementById("loading-stage")!;
  private percent = document.getElementById("loading-percent")!;
  private value = 0;
  private failed = false;
  private finished = false;
  private finishing = false;
  private shownAt = performance.now();
  private releaseTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    document.getElementById("loading-retry")!.onclick = () => location.reload();
  }

  update(value: number, message?: string) {
    if (this.failed || this.finished) return;
    this.value = Math.max(this.value, Math.min(100, Math.round(value)));
    this.progress.setAttribute("aria-valuenow", String(this.value));
    this.fill.style.width = this.value + "%";
    this.percent.textContent = this.value + "%";
    if (message) this.stage.textContent = message;
  }

  check(part: "font" | "assets" | "scene") {
    if (this.failed) return;
    const item = document.getElementById(`loading-${part}-check`)!;
    item.textContent = item.textContent!.replace("□", "■");
    item.classList.add("complete");
  }

  fail(message: string) {
    if (this.finished) return;
    this.failed = true;
    clearTimeout(this.releaseTimer);
    this.screen.classList.add("loading-failed");
    this.stage.textContent = message;
    this.progress.removeAttribute("aria-valuenow");
    this.progress.setAttribute("aria-label", "Carga interrumpida");
    document.getElementById("loading-retry")!.hidden = false;
  }

  finish() {
    if (this.failed || this.finished || this.finishing) return;
    this.check("scene");
    this.update(100, "Brigada lista. ¡Al frente!");
    this.finishing = true;
    this.releaseTimer = setTimeout(
      () => this.dismiss(),
      Math.max(
        BOOT_READY_HOLD_MS,
        BOOT_MIN_MS - (performance.now() - this.shownAt),
      ),
    );
  }

  private dismiss() {
    if (this.failed || this.finished) return;
    this.finished = true;
    this.app.inert = this.app.classList.contains("is-deploying");
    this.app.removeAttribute("aria-busy");
    this.screen.classList.add("loading-complete");
    // Resource progress stays real; the minimum time only holds the ready screen.
    this.screen.addEventListener(
      "transitionend",
      () => {
        this.screen.hidden = true;
      },
      { once: true },
    );
    setTimeout(() => {
      this.screen.hidden = true;
    }, 450);
  }
}
