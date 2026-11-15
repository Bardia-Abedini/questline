import { useId, type FC } from 'react';
import '../art.css';
import { AvatarFace, AvatarHead, AvatarNeck, AvatarPlainShirt } from './base';
import { AVATAR_ART } from './registry';
import { hairSwatch, skinSwatch } from './swatches';
import type { AvatarArtProps, AvatarItemArt, AvatarLayer } from './types';

/** What the avatar wears: the same shape as `profile.avatar`. */
export interface AvatarLook {
  skin: string;
  hair: string | null;
  hair_color: string | null;
  outfit: string | null;
  hat: string | null;
  accessory: string | null;
}

export interface AvatarSvgProps {
  look: AvatarLook;
  /** Rendered width and height in px (or any CSS length). */
  size?: number | string;
  /** Accessible name. Without it the drawing is decorative (aria-hidden). */
  title?: string;
  /**
   * `portrait`: head and shoulders on a round tinted background (header badge, cards).
   * `bust`: the whole 120 x 120 canvas with no background (editor, previews).
   */
  variant?: 'portrait' | 'bust';
  className?: string;
}

/**
 * The layered avatar. Items are looked up by id in the art registry; unknown ids are
 * skipped, so a missing item never breaks the drawing.
 */
export function AvatarSvg({
  look,
  size = 120,
  title,
  variant = 'bust',
  className,
}: AvatarSvgProps) {
  const clipId = useId();
  const props: AvatarArtProps = { skin: skinSwatch(look.skin), hair: hairSwatch(look.hair_color) };
  const items = [look.hair, look.outfit, look.hat, look.accessory]
    .map((id) => (id ? AVATAR_ART[id] : undefined))
    .filter((a): a is AvatarItemArt => !!a);
  const hasOutfit = !!(look.outfit && AVATAR_ART[look.outfit]?.body);

  const layer = (name: AvatarLayer) =>
    items.map((art, i) => {
      const Part: FC<AvatarArtProps> | undefined = art[name];
      return Part ? <Part key={`${name}-${i}`} {...props} /> : null;
    });

  const portrait = variant === 'portrait';
  const drawing = (
    <>
      {layer('back')}
      <AvatarNeck {...props} />
      {hasOutfit ? null : <AvatarPlainShirt />}
      {layer('body')}
      {layer('neck')}
      <AvatarHead {...props} />
      <AvatarFace {...props} />
      {layer('hair')}
      {layer('eyes')}
      {layer('hat')}
    </>
  );

  return (
    <svg
      viewBox={portrait ? '12 8 96 96' : '0 0 120 120'}
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {portrait ? (
        <>
          <defs>
            <clipPath id={clipId}>
              <circle cx="60" cy="56" r="48" />
            </clipPath>
          </defs>
          <circle cx="60" cy="56" r="48" fill="var(--qa-badge-bg)" />
          <g clipPath={`url(#${clipId})`}>{drawing}</g>
        </>
      ) : (
        drawing
      )}
    </svg>
  );
}
