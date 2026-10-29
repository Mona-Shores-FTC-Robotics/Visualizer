/** Which app-level dialog is open. */
export class Dialogs {
  fileManager = $state(false);
  settings = $state(false);
  palette = $state(false);
  exportCode = $state(false);
  /** Fork: Team Autos, Save to GitHub, and a share link to copy (its URL). */
  teamAutos = $state(false);
  github = $state(false);
  shareLink = $state<string | null>(null);
  anyOpen = $derived(
    this.fileManager ||
      this.settings ||
      this.palette ||
      this.exportCode ||
      this.teamAutos ||
      this.github ||
      this.shareLink !== null,
  );
}
