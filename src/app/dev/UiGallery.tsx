import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { formatNumber, type Language } from '@/i18n';
import {
  Button,
  Card,
  CardTitle,
  Chip,
  Dialog,
  EmptyState,
  Icon,
  ICON_NAMES,
  IconButton,
  Input,
  ProgressBar,
  SegmentedControl,
  Select,
  showToast,
  Spinner,
  Tabs,
  Textarea,
  Toggle,
  ToggleChip,
} from '@/ui';

/**
 * Hidden developer page (/dev/ui): every design-system component in light and dark, left to
 * right (English) and right to left (Persian). Not linked from the app.
 */
export default function UiGallery() {
  const { t } = useTranslation('dev');
  const panels: Array<{ theme: 'light' | 'dark'; lang: Language }> = [
    { theme: 'light', lang: 'en' },
    { theme: 'light', lang: 'fa' },
    { theme: 'dark', lang: 'en' },
    { theme: 'dark', lang: 'fa' },
  ];
  return (
    <main id="main" className="mx-auto flex max-w-[110rem] flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t('title')}</h1>
        <Link to="/" className="font-bold text-primary underline">
          {t('back')}
        </Link>
      </header>
      <div className="grid gap-6 xl:grid-cols-2">
        {panels.map((p) => (
          <GalleryPanel key={`${p.theme}-${p.lang}`} theme={p.theme} lang={p.lang} />
        ))}
      </div>
    </main>
  );
}

function GalleryPanel({ theme, lang }: { theme: 'light' | 'dark'; lang: Language }) {
  const { i18n } = useTranslation();
  const t = i18n.getFixedT(lang, 'dev');
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [on, setOn] = useState(true);
  const [chip, setChip] = useState(true);
  const [open, setOpen] = useState<null | 'modal' | 'sheet'>(null);
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  const n = (v: number) => formatNumber(v, lang);

  return (
    <section
      data-theme={theme}
      lang={lang}
      dir={dir}
      aria-label={`${theme} ${dir}`}
      data-testid={`gallery-${theme}-${lang}`}
      className="flex min-w-0 flex-col gap-5 rounded-xl border border-border bg-bg p-4 text-text shadow-md sm:p-6"
    >
      <h2 className="text-2xl font-semibold">
        {t(`panel.${theme}`)} · {dir.toUpperCase()}
      </h2>

      <Group title={t('buttons')}>
        <div className="flex flex-wrap gap-2">
          <Button icon="play">{t('start')}</Button>
          <Button variant="secondary">{t('secondary')}</Button>
          <Button variant="soft" iconEnd="arrow-forward">
            {t('soft')}
          </Button>
          <Button variant="ghost">{t('ghost')}</Button>
          <Button variant="danger" icon="trash">
            {t('danger')}
          </Button>
          <Button loading>{t('loading')}</Button>
          <Button disabled>{t('disabled')}</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">{t('small')}</Button>
          <Button size="lg" icon="play">
            {t('continue')}
          </Button>
          <IconButton icon="plus" label={t('add')} variant="primary" />
          <IconButton icon="edit" label={t('edit')} variant="secondary" />
          <IconButton icon="star" label={t('favorite')} filled />
          <IconButton icon="close" label={t('close')} size="sm" />
        </div>
      </Group>

      <Group title={t('cards')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardTitle>{t('card_title')}</CardTitle>
            <p className="text-muted">{t('card_body')}</p>
          </Card>
          <Card tone="highlight">
            <CardTitle>{t('highlight')}</CardTitle>
            <p className="text-muted">{t('card_body')}</p>
          </Card>
          <Card tone="sunken">{t('sunken')}</Card>
          <Card tone="xp" interactive>
            {t('interactive')}
          </Card>
        </div>
      </Group>

      <Group title={t('chips')}>
        <div className="flex flex-wrap gap-2">
          <Chip tone="xp">S</Chip>
          <Chip tone="gold" icon="coin">
            {n(120)}
          </Chip>
          <Chip dotColor="sky">{t('school')}</Chip>
          <Chip dotColor="sage">{t('home')}</Chip>
          <Chip tone="primary" icon="flame">
            {t('high')}
          </Chip>
          <Chip tone="success" icon="check">
            {t('done')}
          </Chip>
          <Chip onRemove={() => undefined}>{t('tag')}</Chip>
          <ToggleChip selected={chip} onChange={setChip}>
            {t('filter')}
          </ToggleChip>
        </div>
      </Group>

      <Group title={t('progress')}>
        <ProgressBar value={75} max={150} label="XP" valueText={`${n(75)} / ${n(150)}`}>
          <span className="text-sm text-muted">
            {n(75)} / {n(150)} XP
          </span>
        </ProgressBar>
        <ProgressBar value={3} max={10} tone="gold" label="Gold" size="sm" />
        <ProgressBar value={0.6} tone="accent" label="Steps" size="lg" />
      </Group>

      <Group title={t('forms')}>
        <Input label={t('quest_title')} placeholder={t('quest_placeholder')} hint={t('hint')} />
        <Input label={t('guess')} type="number" defaultValue={25} error={t('error')} />
        <Select
          label={t('priority')}
          defaultValue="medium"
          options={[
            { value: 'high', label: t('high') },
            { value: 'medium', label: t('medium') },
            { value: 'low', label: t('low') },
          ]}
        />
        <Textarea label={t('notes')} placeholder={t('notes_placeholder')} />
        <Toggle label={t('toggle')} description={t('toggle_hint')} checked={on} onChange={setOn} />
        <SegmentedControl
          label={t('energy')}
          showLabel
          value={seg}
          onChange={setSeg}
          options={[
            { value: 'a', label: t('low'), icon: 'battery' },
            { value: 'b', label: t('medium') },
            { value: 'c', label: t('high'), icon: 'bolt' },
          ]}
        />
      </Group>

      <Group title={t('tabs')}>
        <Tabs
          label={t('tabs')}
          items={[
            {
              value: 'backlog',
              label: t('backlog'),
              badge: n(4),
              content: <p>{t('backlog_body')}</p>,
            },
            { value: 'inbox', label: t('inbox'), icon: 'inbox', content: <p>{t('inbox_body')}</p> },
            { value: 'done', label: t('done'), content: <p>{t('done_body')}</p> },
          ]}
        />
      </Group>

      <Group title={t('overlays')}>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setOpen('modal')}>
            {t('open_modal')}
          </Button>
          <Button variant="secondary" onClick={() => setOpen('sheet')}>
            {t('open_sheet')}
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              showToast({ tone: 'xp', title: t('toast_title'), description: t('toast_body') })
            }
          >
            {t('show_toast')}
          </Button>
          <Spinner label={t('loading')} />
        </div>
        <Dialog
          open={open !== null}
          variant={open ?? 'modal'}
          onClose={() => setOpen(null)}
          title={t('dialog_title')}
          description={t('dialog_body')}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(null)}>
                {t('cancel')}
              </Button>
              <Button onClick={() => setOpen(null)}>{t('confirm')}</Button>
            </>
          }
        >
          <Input label={t('quest_title')} />
        </Dialog>
      </Group>

      <Group title={t('empty')}>
        <EmptyState
          icon="quests"
          title={t('empty_title')}
          action={<Button icon="plus">{t('add')}</Button>}
        >
          {t('empty_body')}
        </EmptyState>
      </Group>

      <Group title={t('icons')}>
        <ul className="grid grid-cols-6 gap-3 text-muted sm:grid-cols-10">
          {ICON_NAMES.map((name) => (
            <li
              key={name}
              title={name}
              className="grid place-items-center rounded-md bg-surface p-2"
            >
              <Icon name={name} size={22} />
            </li>
          ))}
        </ul>
      </Group>
    </section>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-extrabold tracking-wide text-muted uppercase">{title}</h3>
      {children}
    </div>
  );
}
