<script lang="ts">
  /** A QR code of `text`, black on white in either theme (a scanner needs the contrast). */
  import qrcode from "qrcode-generator";

  let { text, label }: { text: string; label: string } = $props();

  const svg = $derived.by(() => {
    const qr = qrcode(0, "L");
    // The tail in QR's alphanumeric characters (a route's short form, last in our links) packs at
    // 5.5 bits a character, not 8: a smaller code, which an old camera reads more easily.
    const tail = /[0-9A-Z $%*+\-./:]*$/.exec(text)?.[0] ?? "";
    const head = text.slice(0, text.length - tail.length);
    if (head) qr.addData(head, "Byte");
    if (tail) qr.addData(tail, tail.length > 20 ? "Alphanumeric" : "Byte");
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
