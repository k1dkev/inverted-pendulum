/** Most recently pressed arrow wins; releasing it restores the other held key. */
export class JogKeys {
  private held = new Set<string>();
  press(code: string): number | null {
    if (code !== "ArrowLeft" && code !== "ArrowRight") return null;
    this.held.delete(code);
    this.held.add(code);
    return this.direction();
  }
  release(code: string): number | null {
    if (!this.held.delete(code)) return null;
    return this.direction();
  }
  clear() {
    this.held.clear();
  }
  private direction() {
    const code = [...this.held].at(-1);
    return code === "ArrowLeft" ? -1 : code === "ArrowRight" ? 1 : 0;
  }
}
