import Brand from '@/components/ui/Brand';
import styles from './LoginArt.module.css';

// The login popup's left column: an original line drawing, no copy. Students look things up,
// one sends an application from her laptop — a paper plane leaves it and the check badge ticks.
// Decorative only (aria-hidden); the form beside it carries every word a student needs.
export default function LoginArt() {
  return <div className={styles.panel} aria-hidden="true">
    <Brand tone="light" className={styles.logo} />
    <div className={styles.scene}>
      <svg className={styles.art} viewBox="10 40 500 410" focusable="false">
        <defs>
          <radialGradient id="login-art-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity=".16" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* soft halo and a slowly turning orbit behind the scene */}
        <circle className={styles.halo} cx="262" cy="262" r="200" fill="url(#login-art-halo)" />
        <circle className={styles.orbit} cx="262" cy="262" r="196" />
        {/* floor */}
        <path className={styles.faint} d="M30 432h420" />

        {/* sparkles */}
        <path className={styles.twinkle} d="M116 96v14M109 103h14" />
        <path className={styles.twinkle} d="M330 74v12M324 80h12" />
        <path className={styles.twinkle} d="M452 268v10M447 273h10" />
        <path className={styles.twinkle} d="M36 214v10M31 219h10" />

        {/* chat bubbles */}
        <g className={styles.float1}>
          <path className={styles.wash} d="M70 170a13 13 0 0 1 3-25 18 18 0 0 1 34-6 13 13 0 0 1 5 31z" />
          <path d="M96 128a15 15 0 0 1 28 4 11 11 0 0 1 1 21h-7" />
        </g>

        {/* the document */}
        <path className={styles.wash} d="M152 110h146a14 14 0 0 1 14 14v226H166a14 14 0 0 1-14-14z" />
        <path d="M152 110a14 14 0 0 0-14 14v14h28v-14a14 14 0 0 0-14-14" />
        <path className={styles.faint} d="M184 146h104M184 164h104M184 182h86M184 200h104M184 218h70M184 236h104M184 254h94M184 272h104M184 290h78M184 308h104M184 326h60" />

        {/* magnifying glass, sweeping the page */}
        <g className={styles.lens}>
          <circle className={styles.washStrong} cx="214" cy="222" r="44" strokeWidth="4.5" />
          <circle className={styles.faint} cx="214" cy="222" r="34" />
          <path d="M194 202a28 28 0 0 1 24-10" />
          <path d="M246 255l38 40" strokeWidth="11" />
        </g>

        {/* standing student with a phone */}
        <path className={styles.solid} d="M66 352h30l-2 72h-10l-3-54-3 54h-10z" />
        <path d="M60 426h17M84 426h17" strokeWidth="5" />
        <path className={styles.wash} d="M62 354c-3-36 3-64 20-70h4c17 6 21 34 18 70z" />
        <circle className={styles.wash} cx="84" cy="262" r="14" />
        <path className={styles.solid} d="M70 259c0-11 6-19 14-19s15 7 15 16c-6-4-12-6-18-5-5 1-8 4-11 8z" />
        <path d="M70 300c-9-4-14-12-16-20" />
        <rect className={styles.solid} x="44" y="262" width="12" height="21" rx="3" transform="rotate(-16 50 272)" />
        <rect className={`${styles.accentFill} ${styles.phoneGlow}`} x="46.5" y="265" width="7" height="13" rx="1.5" transform="rotate(-16 50 272)" />
        <path d="M100 300c5 12 5 24-1 34" />

        {/* standing student pointing at the document */}
        <path className={styles.washStrong} d="M122 362h32l4 62h-15l-5-46-5 46h-15z" />
        <path d="M118 426h16M146 426h16" strokeWidth="5" />
        <path className={styles.wash} d="M120 364c-3-32 4-54 19-58h4c15 4 20 26 17 58z" />
        <circle className={styles.wash} cx="141" cy="290" r="13" />
        <circle className={styles.solid} cx="148" cy="272" r="7" />
        <path className={styles.solid} d="M128 288c0-10 6-16 13-16s13 6 13 15c-5-4-10-5-15-4-5 1-8 3-11 5z" />
        <path className={styles.point} d="M158 322l26-11 7-2" />
        <path d="M123 322c-6 12-6 24 0 34" />

        {/* paper stack */}
        <path className={styles.wash} d="M270 354h152l-8 17H262z" />
        <path className={styles.wash} d="M262 371h162v19H262z" />
        <path className={styles.wash} d="M268 390h150l6 19H262z" />
        <path className={styles.wash} d="M262 409h166v23H262z" />
        <path className={styles.faint} d="M290 381h34M352 381h44M284 421h48M362 421h34M304 399l8 6 8-6" />

        {/* seated student with a laptop */}
        <path className={styles.solid} d="M300 354c-6-22 14-30 34-28h50c22-2 40 8 34 28z" />
        <path className={styles.wash} d="M336 330c-2-28 6-52 26-56h8c20 4 28 28 26 56z" />
        <path d="M366 262v10" />
        <circle className={styles.wash} cx="366" cy="246" r="16" />
        <path className={styles.solid} d="M350 245c0-13 7-21 16-21s16 8 16 21c-4-7-10-11-16-11s-12 4-16 11z" />
        <circle className={styles.solid} cx="366" cy="219" r="8" />
        <path d="M361 249h.01M372 249h.01" strokeWidth="3.4" />
        <path d="M361 256q5 4 10 0" />
        <path d="M344 298c-6 10-2 22 8 26M388 298c6 10 2 22-8 26" />
        <rect className={styles.solid} x="334" y="284" width="64" height="40" rx="5" />
        <circle className={styles.lidMark} cx="366" cy="304" r="4.5" />
        <path d="M324 326h84" strokeWidth="4" />

        {/* paper plane: leaves the laptop and flies to the badge */}
        <path className={`${styles.plane} ${styles.accentFill}`} d="M396 282l20-9-7 20-4-7z" />

        {/* check badge */}
        <g className={styles.badge}>
          <rect className={styles.washStrong} x="404" y="118" width="40" height="40" rx="10" />
          <path className={`${styles.check} ${styles.accent}`} d="M414 138l8 8 13-15" strokeWidth="3.4" />
        </g>

        {/* share nodes */}
        <g className={styles.float2}>
          <circle cx="414" cy="198" r="5.5" />
          <circle cx="440" cy="192" r="5.5" />
          <circle cx="428" cy="220" r="5.5" />
          <path d="M418 203l7 12M436 197l-6 18" />
        </g>

        {/* plant */}
        <path className={styles.wash} d="M436 398h32l-5 32h-22z" />
        <g className={styles.leaves}>
          <path className={styles.wash} d="M452 398c-3-22-16-33-32-33 2 18 14 29 32 33z" />
          <path className={styles.wash} d="M452 398c3-28 16-43 34-45-2 22-15 37-34 45z" />
          <path d="M452 398c0-18 4-32 13-41M452 398c-6-10-14-18-24-24" />
        </g>
      </svg>
    </div>
  </div>;
}
