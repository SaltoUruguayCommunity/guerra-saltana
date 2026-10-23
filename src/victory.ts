import type { GameState } from "../shared/types";

/** Screen-space celebration: square confetti stays crisp at every camera zoom. */
export class Victory {
  private screen = document.getElementById("victory-screen")!;
  show(state: GameState) {
    const draw = state.winner === -1 || state.winner === null;
    this.screen.dataset.team = String(state.winner);
    document.getElementById("victory-title")!.textContent = draw
      ? "EMPATE"
      : "¡VICTORIA!";
    document.getElementById("victory-team")!.textContent = draw
      ? "LA COSTA RESISTIÓ"
      : state.winner === 0
        ? "LOS CELESTES"
        : "LOS CÍTRICOS";
    const survivors = state.units.filter(
      (u) => u.team === state.winner && u.hp > 0,
    ).length;
    document.getElementById("victory-detail")!.textContent = draw
      ? "Ninguna brigada quedó en pie."
      : `${survivors} ${survivors === 1 ? "carpincho en pie" : "carpinchos en pie"} · Costa asegurada`;
    const confetti = document.getElementById("victory-confetti")!;
    confetti.replaceChildren();
    if (!draw)
      for (let i = 0; i < 72; i++) {
        const pixel = document.createElement("i");
        pixel.style.cssText = `left:${(i * 37) % 100}%;--delay:${-(i % 17) * 0.23}s;--duration:${3 + (i % 7) * 0.4}s;--drift:${(i % 2 ? 1 : -1) * (18 + (i % 55))}px;--color:${["#f8d66d", "#fff0b8", state.winner === 0 ? "#78d5ed" : "#fa9c54", "#9db568"][i % 4]}`;
        confetti.append(pixel);
      }
    this.screen.hidden = false;
    document.getElementById("app")!.classList.add("is-victory");
  }
  clear() {
    this.screen.hidden = true;
    document.getElementById("victory-confetti")!.replaceChildren();
    document.getElementById("app")!.classList.remove("is-victory");
  }
}
