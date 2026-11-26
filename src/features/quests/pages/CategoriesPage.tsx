import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCategories, useTags, type Category, type Tag } from '@/data';
import {
  Button,
  Card,
  cx,
  EmptyState,
  Icon,
  IconButton,
  Input,
  Modal,
  Page,
  Section,
  Sheet,
  showToast,
  type IconName,
} from '@/ui';
import {
  CATEGORY_COLORS,
  createCategory,
  deleteCategory,
  deleteTag,
  renameTag,
  updateCategory,
} from '../model/actions';
import { useCategoryName } from '../components/labels';

const CATEGORY_ICONS: IconName[] = [
  'book',
  'home',
  'heart',
  'leaf',
  'star',
  'sword',
  'music',
  'palette',
  'coin',
  'gift',
  'bolt',
  'sun',
  'moon',
  'globe',
  'feather',
  'lantern',
  'user',
  'potion',
];

interface EditState {
  category: Category | null;
  name: string;
  color: string;
  icon: string;
}

/** Categories (color + icon) and tags: create, rename, delete. */
export function CategoriesPage() {
  const { t } = useTranslation('quests');
  const categories = useCategories();
  const tags = useTags();
  const categoryName = useCategoryName();
  const [edit, setEdit] = useState<EditState | null>(null);
  const [confirm, setConfirm] = useState<Category | null>(null);
  const [tagEdit, setTagEdit] = useState<{ tag: Tag; name: string } | null>(null);

  const save = async () => {
    if (!edit || !edit.name.trim()) return;
    if (edit.category)
      await updateCategory(edit.category.id, {
        name: edit.name,
        color: edit.color,
        icon: edit.icon,
      });
    else await createCategory({ name: edit.name, color: edit.color, icon: edit.icon });
    setEdit(null);
  };

  return (
    <Page title={t('categories.title')} subtitle={t('categories.subtitle')}>
      <Section title={t('categories.heading')}>
        <ul className="flex flex-col gap-2">
          {(categories ?? []).map((c) => (
            <Card as="li" key={c.id} padding="sm" className="flex items-center gap-3">
              <span
                aria-hidden
                className="grid size-10 shrink-0 place-items-center rounded-full text-on-primary"
                style={{ background: `var(--ql-cat-${c.color})` }}
              >
                <Icon
                  name={
                    (CATEGORY_ICONS as string[]).includes(c.icon) ? (c.icon as IconName) : 'star'
                  }
                />
              </span>
              <span className="min-w-0 flex-1 truncate font-bold">{categoryName(c)}</span>
              <IconButton
                icon="edit"
                size="sm"
                label={t('categories.edit_for', { name: categoryName(c) })}
                onClick={() =>
                  setEdit({ category: c, name: categoryName(c), color: c.color, icon: c.icon })
                }
              />
              <IconButton
                icon="trash"
                size="sm"
                label={t('categories.delete_for', { name: categoryName(c) })}
                onClick={() => setConfirm(c)}
              />
            </Card>
          ))}
        </ul>
        <div>
          <Button
            variant="secondary"
            icon="plus"
            onClick={() => setEdit({ category: null, name: '', color: 'teal', icon: 'star' })}
          >
            {t('categories.new')}
          </Button>
        </div>
      </Section>

      <Section title={t('tags.heading')} description={t('tags.hint')}>
        {tags && tags.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {tags.map((tag) => (
              <Card as="li" key={tag.id} padding="sm" className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate font-bold">#{tag.name}</span>
                <IconButton
                  icon="edit"
                  size="sm"
                  label={t('tags.rename_for', { name: tag.name })}
                  onClick={() => setTagEdit({ tag, name: tag.name })}
                />
                <IconButton
                  icon="trash"
                  size="sm"
                  label={t('tags.delete_for', { name: tag.name })}
                  onClick={async () => {
                    await deleteTag(tag.id);
                    showToast({ title: t('tags.deleted', { name: tag.name }), icon: 'trash' });
                  }}
                />
              </Card>
            ))}
          </ul>
        ) : (
          <EmptyState icon="sparkle" title={t('tags.empty_title')}>
            {t('tags.empty_body')}
          </EmptyState>
        )}
      </Section>

      <Sheet
        open={!!edit}
        onClose={() => setEdit(null)}
        dismissOnBackdrop={false}
        title={edit?.category ? t('categories.edit') : t('categories.new')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>
              {t('actions.cancel')}
            </Button>
            <Button icon="check" onClick={save} disabled={!edit?.name.trim()}>
              {t('actions.save')}
            </Button>
          </>
        }
      >
        {edit && (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Input
              label={t('categories.name')}
              value={edit.name}
              autoFocus
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            />
            <fieldset>
              <legend className="mb-2 text-sm font-bold">{t('categories.color')}</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-pressed={edit.color === color}
                    aria-label={t(`colors.${color}`)}
                    title={t(`colors.${color}`)}
                    onClick={() => setEdit({ ...edit, color })}
                    className={cx(
                      'grid size-10 place-items-center rounded-full border-2 text-on-primary',
                      edit.color === color ? 'border-text' : 'border-transparent',
                    )}
                    style={{ background: `var(--ql-cat-${color})` }}
                  >
                    {edit.color === color && <Icon name="check" />}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-bold">{t('categories.icon')}</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    aria-pressed={edit.icon === icon}
                    aria-label={t(`icons.${icon}` as 'icons.book')}
                    onClick={() => setEdit({ ...edit, icon })}
                    className={cx(
                      'grid size-10 place-items-center rounded-md border',
                      edit.icon === icon
                        ? 'border-primary bg-primary-soft text-text'
                        : 'border-border bg-surface text-muted hover:bg-surface-2',
                    )}
                  >
                    <Icon name={icon} />
                  </button>
                ))}
              </div>
            </fieldset>
          </form>
        )}
      </Sheet>

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        size="sm"
        title={t('categories.delete_title', { name: categoryName(confirm) })}
        description={t('categories.delete_body')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              {t('actions.cancel')}
            </Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={async () => {
                if (confirm) await deleteCategory(confirm.id);
                setConfirm(null);
              }}
            >
              {t('actions.delete')}
            </Button>
          </>
        }
      />

      <Sheet
        open={!!tagEdit}
        onClose={() => setTagEdit(null)}
        title={t('tags.rename')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTagEdit(null)}>
              {t('actions.cancel')}
            </Button>
            <Button
              icon="check"
              disabled={!tagEdit?.name.trim()}
              onClick={async () => {
                if (tagEdit?.name.trim()) await renameTag(tagEdit.tag.id, tagEdit.name);
                setTagEdit(null);
              }}
            >
              {t('actions.save')}
            </Button>
          </>
        }
      >
        {tagEdit && (
          <Input
            label={t('tags.name')}
            value={tagEdit.name}
            autoFocus
            onChange={(e) => setTagEdit({ ...tagEdit, name: e.target.value })}
          />
        )}
      </Sheet>
    </Page>
  );
}
