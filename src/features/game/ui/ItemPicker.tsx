import { Link } from 'react-router';
import { PATHS } from '@/app/routing';
import type { AvatarLook } from '@/art/avatar/AvatarSvg';
import { useFormat } from '@/i18n/useFormat';
import { cx, Icon } from '@/ui';
import type { CosmeticItem } from '../catalog/cosmetics';
import { ItemArt } from './ItemArt';
import { useGameT } from './hooks';

/**
 * A grid of items for one slot: owned ones are buttons (aria-pressed when in use); others
 * show the level they need or point to the shop. Big tap targets for phones.
 */
export function ItemPicker({
  items,
  owned,
  selected,
  onPick,
  noneLabel,
  wearer,
  level,
  label,
}: {
  items: CosmeticItem[];
  owned: Set<string>;
  selected: string | null;
  onPick: (id: string | null) => void;
  /** Shows an "empty" choice first. */
  noneLabel?: string;
  wearer?: AvatarLook;
  level: number;
  label: string;
}) {
  const { t, tx } = useGameT();
  const { number } = useFormat();
  const tile =
    'flex min-h-[7.5rem] w-full flex-col items-center gap-1 rounded-lg border-2 p-2 text-center text-sm font-bold';
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label={label}>
      {noneLabel && (
        <li>
          <button
            type="button"
            aria-pressed={selected === null}
            onClick={() => onPick(null)}
            className={cx(
              tile,
              'justify-center',
              selected === null ? 'border-primary bg-primary-soft' : 'border-border bg-surface',
            )}
          >
            <Icon name="close" size={28} className="text-muted" />
            {noneLabel}
          </button>
        </li>
      )}
      {items.map((item) => {
        const name = tx(item.nameKey);
        const has = owned.has(item.id);
        if (has) {
          const on = selected === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onPick(item.id)}
                className={cx(
                  tile,
                  on
                    ? 'border-primary bg-primary-soft'
                    : 'border-border bg-surface hover:bg-surface-2',
                )}
              >
                <ItemArt itemId={item.id} size={60} wearer={wearer} />
                <span className="line-clamp-2 leading-tight">{name}</span>
              </button>
            </li>
          );
        }
        const locked = level < item.unlockLevel;
        return (
          <li key={item.id}>
            <Link
              to={`${PATHS.shop}?tab=cosmetics&item=${item.id}`}
              className={cx(tile, 'border-dashed border-border-strong bg-surface-2 text-muted')}
              aria-label={`${name}: ${
                locked
                  ? t('shop.locked', { level: number(item.unlockLevel) })
                  : t('avatar.get_in_shop')
              }`}
            >
              <span className={locked ? 'opacity-50 grayscale' : 'opacity-80'}>
                <ItemArt itemId={item.id} size={60} wearer={wearer} />
              </span>
              <span className="line-clamp-2 leading-tight">{name}</span>
              <span className="inline-flex items-center gap-1 text-xs">
                <Icon name={locked ? 'lock' : 'shop'} size={12} />
                {locked
                  ? t('avatar.locked', { level: number(item.unlockLevel) })
                  : t('avatar.get_in_shop')}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
