<script lang="ts">
  /** A time in seconds, changed half a second at a time: no typing. */
  interface Props {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    label: string;
    onChange: (seconds: number) => void;
  }

  let {
    value,
    min = 0.5,
    max = 15,
    step = 0.5,
    label,
    onChange,
  }: Props = $props();

  const round = (v: number) => Math.round(v * 10) / 10;
</script>

<span
  class="inline-flex items-center overflow-hidden rounded-lg border border-border"
  role="group"
  aria-label={label}
>
  <button
    type="button"
    class="h-7 w-7 bg-base font-bold text-heading transition hover:bg-body/10 disabled:opacity-40"
    aria-label={`${label}: less`}
    disabled={value <= min}
    onclick={() => onChange(Math.max(min, round(value - step)))}>−</button
  >
  <span
    class="min-w-14 px-1 text-center font-mono text-xs text-heading tabular-nums"
    >{value.toFixed(1)} s</span
  >
  <button
    type="button"
    class="h-7 w-7 bg-base font-bold text-heading transition hover:bg-body/10 disabled:opacity-40"
    aria-label={`${label}: more`}
    disabled={value >= max}
    onclick={() => onChange(Math.min(max, round(value + step)))}>+</button
  >
</span>
