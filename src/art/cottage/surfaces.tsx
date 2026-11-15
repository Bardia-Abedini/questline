import { PALETTE } from '../style';

/**
 * Wallpapers fill the wall (0,0)-(360,170); floors fill (0,170)-(360,240). Fixed colors:
 * the evening look comes from the scene's tint overlay.
 */

/** Warm plaster with a faint pattern of tiny flowers. Starter. */
export function WallCream() {
  return (
    <g>
      <rect x="0" y="0" width="360" height="170" fill="#f7e6cc" />
      <g fill="#ecd4b2">
        {Array.from({ length: 6 }, (_, row) =>
          Array.from({ length: 10 }, (_, col) => (
            <circle
              key={`${row}-${col}`}
              cx={18 + col * 36 + (row % 2) * 18}
              cy={22 + row * 26}
              r="2.2"
            />
          )),
        )}
      </g>
    </g>
  );
}

/** Soft sage stripes. */
export function WallSageStripes() {
  return (
    <g>
      <rect x="0" y="0" width="360" height="170" fill="#e3ecd6" />
      <g fill="#d1dfc1">
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={i * 30 + 8} y="0" width="12" height="170" />
        ))}
      </g>
    </g>
  );
}

/** Deep blue with little gold stars. */
export function WallStarry() {
  const stars = [
    [20, 30],
    [64, 18],
    [110, 44],
    [128, 132],
    [36, 120],
    [240, 140],
    [300, 30],
    [338, 92],
    [270, 118],
    [90, 92],
    [326, 150],
    [12, 74],
  ] as const;
  return (
    <g>
      <rect x="0" y="0" width="360" height="170" fill="#5b5d93" />
      <g fill={PALETTE.honey}>
        {stars.map(([x, y], i) => (
          <path
            key={i}
            d={`M${x} ${y - 4} L${x + 1.2} ${y - 1.2} L${x + 4} ${y} L${x + 1.2} ${y + 1.2} L${x} ${y + 4} L${x - 1.2} ${y + 1.2} L${x - 4} ${y} L${x - 1.2} ${y - 1.2} Z`}
          />
        ))}
      </g>
    </g>
  );
}

/** Honey wooden planks. Starter. */
export function FloorPlanks() {
  return (
    <g>
      <rect x="0" y="170" width="360" height="70" fill="#d9b184" />
      <g stroke="#b08257" strokeWidth="1.2">
        {[186, 204, 222].map((y) => (
          <line key={y} x1="0" y1={y} x2="360" y2={y} />
        ))}
        {[
          [40, 170, 186],
          [150, 170, 186],
          [270, 170, 186],
          [90, 186, 204],
          [210, 186, 204],
          [330, 186, 204],
          [30, 204, 222],
          [160, 204, 222],
          [290, 204, 222],
          [100, 222, 240],
          [230, 222, 240],
        ].map(([x, y1, y2]) => (
          <line key={`${x}-${y1}`} x1={x} y1={y1} x2={x} y2={y2} />
        ))}
      </g>
    </g>
  );
}

/** Cream and sage checker tiles. */
export function FloorChecker() {
  const tiles = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 20; col++) {
      if ((row + col) % 2 === 0) {
        tiles.push(
          <rect key={`${row}-${col}`} x={col * 18} y={170 + row * 17.5} width="18" height="17.5" />,
        );
      }
    }
  }
  return (
    <g>
      <rect x="0" y="170" width="360" height="70" fill="#f3ead6" />
      <g fill="#bcd1a8">{tiles}</g>
    </g>
  );
}
