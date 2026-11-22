<script lang="ts">
  /** A QR code of `text`, black on white in either theme (a scanner needs the contrast). */
  import qrcode from "qrcode-generator";

  let { text, label }: { text: string; label: string } = $props();

  const svg = $derived.by(() => {
    const qr = qrcode(0, "L");
    qr.addData(text, "Byte");
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
  });
</script>

<div class="qr" role="img" aria-label={label}>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- built here from our own link -->
  {@html svg}
</div>

<style>
  .qr {
    background: #fff;
    border-radius: 12px;
    padding: 8px;
    width: min(100%, 360px);
    margin: 0 auto;
  }
  .qr :global(svg) {
    display: block;
    width: 100%;
    height: auto;
  }
</style>
