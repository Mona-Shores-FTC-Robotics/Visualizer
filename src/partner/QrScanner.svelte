<script lang="ts">
  /**
   * The camera, reading QR codes until one is found: `onRead` gets its text. Works offline (jsQR
   * reads the frames here), on old tablets too: no BarcodeDetector needed.
   */
  import jsQR from "jsqr";
  import { onMount } from "svelte";

  let {
    onRead,
    onClose,
  }: { onRead: (text: string) => void; onClose: () => void } = $props();

  let video = $state<HTMLVideoElement | null>(null);
  let problem = $state<string | null>(null);

  onMount(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    const scan = () => {
      if (stopped || !video || !context) return;
      if (video.readyState >= 2 && video.videoWidth) {
        // A smaller copy reads as well and keeps an old tablet responsive.
        const scale = Math.min(1, 640 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height, {
          inversionAttempts: "dontInvert",
        });
        if (code?.data) {
          onRead(code.data);
          return;
        }
      }
      frame = requestAnimationFrame(scan);
    };

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (stopped || !video) return;
        video.srcObject = stream;
        await video.play();
        frame = requestAnimationFrame(scan);
      } catch (error) {
        problem =
          error instanceof Error && error.name === "NotAllowedError"
            ? "The camera is blocked. Allow it for this page and try again."
            : "No camera could be opened on this device.";
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  });
</script>

<div class="scanner" role="dialog" aria-label="Scan a partner's QR code">
  {#if problem}
    <p class="problem">{problem}</p>
  {:else}
    <video bind:this={video} playsinline muted></video>
  {/if}
  <button type="button" onclick={onClose}>Close</button>
</div>

<style>
  .scanner {
    position: fixed;
    inset: 0;
    z-index: 20;
    background: #000;
    display: grid;
    grid-template-rows: 1fr auto;
    gap: 12px;
    padding: 16px;
  }
  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    min-height: 0;
  }
  .problem {
    color: #fff;
    align-self: center;
    text-align: center;
    font-size: 17px;
  }
  button {
    font: inherit;
    font-weight: 700;
    font-size: 17px;
    min-height: 48px;
    border-radius: 12px;
    border: 0;
    background: #fff;
    color: #111;
  }
</style>
