import { ROAM_HASH_PATH, ROAM_R_PATH } from "./brand";

export function RoamLogo() {
  return (
    <svg
      class="roam-logo"
      viewBox="0 0 152 104"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={ROAM_HASH_PATH}
        fill="none"
        stroke="var(--moss)"
        stroke-width="7"
        stroke-linecap="round"
      />
      <path d={ROAM_R_PATH} fill="currentColor" fill-rule="evenodd" />
    </svg>
  );
}
