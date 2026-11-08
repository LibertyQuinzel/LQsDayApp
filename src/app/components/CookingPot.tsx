export type PotState = 'off' | 'cooking' | 'ready';

const steamWisps = [
  { x: 44, delay: '0s' },
  { x: 60, delay: '0.8s' },
  { x: 76, delay: '1.6s' }
];

const flames = [
  { x: 46, delay: '0s' },
  { x: 60, delay: '0.3s' },
  { x: 74, delay: '0.15s' }
];

// SVG transforms are set relative to the viewBox so rotation origins line up with the drawing.
const viewBoxOrigin = (x: number, y: number) => ({ transformBox: 'view-box' as const, transformOrigin: `${x}px ${y}px` });

/**
 * Animated pot for the meal reminder: simmers while counting down, opens with steam when it's time to eat,
 * and sits dimmed when no reminder is set.
 */
export function CookingPot({ state, label }: { state: PotState; label: string }) {
  const cooking = state === 'cooking';
  const ready = state === 'ready';

  return (
    <svg
      viewBox="0 0 120 104"
      role="img"
      aria-label={label}
      className={`h-32 w-40 flex-shrink-0 transition-opacity ${state === 'off' ? 'opacity-40 grayscale' : ''}`}
    >
      <defs>
        <linearGradient id="pot-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9a7be0" />
          <stop offset="100%" stopColor="#5b3d9e" />
        </linearGradient>
        <linearGradient id="pot-lid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b49af0" />
          <stop offset="100%" stopColor="#7c5cc4" />
        </linearGradient>
        <linearGradient id="pot-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#fde047" />
        </linearGradient>
      </defs>

      {/* Steam once the lid is open */}
      {ready &&
        steamWisps.map((wisp) => (
          <path
            key={wisp.x}
            d={`M${wisp.x} 34 q -5 -6 0 -12 q 5 -6 0 -12`}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="pot-steam text-muted-foreground"
            style={{ ...viewBoxOrigin(wisp.x, 34), animation: `steam-rise 2.4s ease-out ${wisp.delay} infinite`, opacity: 0 }}
          />
        ))}

      {/* Flames while cooking */}
      {cooking &&
        flames.map((flame) => (
          <path
            key={flame.x}
            d={`M${flame.x} 102 c -5 -3 -5 -9 0 -14 c 5 5 5 11 0 14 z`}
            fill="url(#pot-flame)"
            style={{ ...viewBoxOrigin(flame.x, 102), animation: `flame-flicker 0.6s ease-in-out ${flame.delay} infinite` }}
          />
        ))}

      <g style={cooking ? { ...viewBoxOrigin(60, 88), animation: 'pot-simmer 1.4s ease-in-out infinite' } : undefined}>
        {/* Handles */}
        <rect x="8" y="54" width="16" height="7" rx="3.5" fill="#5b3d9e" />
        <rect x="96" y="54" width="16" height="7" rx="3.5" fill="#5b3d9e" />
        {/* Body */}
        <path d="M20 48 h80 v26 a14 14 0 0 1 -14 14 h-52 a14 14 0 0 1 -14 -14 z" fill="url(#pot-body)" />
        <rect x="16" y="45" width="88" height="7" rx="3.5" fill="#8466cf" />
        <path d="M28 58 v14" stroke="white" strokeOpacity="0.25" strokeWidth="4" strokeLinecap="round" />

        {/* Lid: rattles while cooking, tips open from the right edge when ready */}
        <g
          style={{
            ...viewBoxOrigin(100, 45),
            transition: 'transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            transform: ready ? 'translate(4px, -10px) rotate(24deg)' : 'none'
          }}
        >
          <g style={cooking ? { ...viewBoxOrigin(60, 45), animation: 'lid-rattle 2.2s ease-in-out infinite' } : undefined}>
            <path d="M18 45 Q60 18 102 45 z" fill="url(#pot-lid)" />
            <rect x="54" y="22" width="12" height="7" rx="3.5" fill="#5b3d9e" />
          </g>
        </g>
      </g>
    </svg>
  );
}
