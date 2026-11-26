import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  Button,
  Chip,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  ProgressBar,
  SegmentedControl,
  Select,
  showToast,
  Tabs,
  Toaster,
  Toggle,
  ToggleChip,
  useToastStore,
} from '@/ui';

describe('Button / IconButton', () => {
  it('clicks, and blocks clicks while loading', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Start</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      <Button onClick={onClick} loading>
        Start
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Start' })).toHaveAttribute('aria-busy', 'true');
  });
  it('icon buttons have an accessible name', () => {
    render(<IconButton icon="plus" label="Add quest" />);
    expect(screen.getByRole('button', { name: 'Add quest' })).toBeInTheDocument();
  });
});

describe('form fields', () => {
  it('labels, hints and errors are wired for screen readers', () => {
    render(
      <>
        <Input label="Title" hint="Keep it short" />
        <Input label="Guess" error="Needs a number" />
        <Select label="Priority" options={[{ value: 'high', label: 'High' }]} />
      </>,
    );
    expect(screen.getByLabelText('Title')).toHaveAccessibleDescription('Keep it short');
    const guess = screen.getByLabelText('Guess');
    expect(guess).toHaveAttribute('aria-invalid', 'true');
    expect(guess).toHaveAccessibleDescription('Needs a number');
    expect(screen.getByLabelText('Priority')).toHaveValue('high');
  });
});

describe('Toggle', () => {
  it('is a labelled switch', async () => {
    function Demo() {
      const [on, setOn] = useState(false);
      return <Toggle label="Sounds" description="Chimes" checked={on} onChange={setOn} />;
    }
    render(<Demo />);
    const sw = screen.getByRole('switch', { name: 'Sounds' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });
});

describe('SegmentedControl', () => {
  function Demo({ dir = 'ltr' }: { dir?: 'ltr' | 'rtl' }) {
    const [v, setV] = useState<'a' | 'b' | 'c'>('a');
    return (
      <div dir={dir} style={{ direction: dir }}>
        <SegmentedControl
          label="Energy"
          value={v}
          onChange={setV}
          options={[
            { value: 'a', label: 'Low' },
            { value: 'b', label: 'Medium' },
            { value: 'c', label: 'High' },
          ]}
        />
      </div>
    );
  }
  it('selects with click and arrow keys', async () => {
    render(<Demo />);
    expect(screen.getByRole('radiogroup', { name: 'Energy' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Medium' }));
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'High' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'High' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Low' })).toBeChecked();
  });
  it('arrow keys follow the reading direction in RTL', async () => {
    render(<Demo dir="rtl" />);
    await userEvent.click(screen.getByRole('radio', { name: 'Medium' }));
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'High' })).toBeChecked();
  });
});

describe('Tabs', () => {
  it('switches panels with click and keyboard', async () => {
    render(
      <Tabs
        label="Quest lists"
        items={[
          { value: 'backlog', label: 'Backlog', content: <p>backlog panel</p> },
          { value: 'inbox', label: 'Inbox', content: <p>inbox panel</p> },
        ]}
      />,
    );
    expect(screen.getByRole('tabpanel')).toHaveTextContent('backlog panel');
    await userEvent.click(screen.getByRole('tab', { name: 'Inbox' }));
    expect(screen.getByRole('tab', { name: 'Inbox' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('inbox panel');
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('backlog panel');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Backlog');
  });
});

describe('ProgressBar', () => {
  it('exposes value and clamps', () => {
    render(<ProgressBar label="Experience" value={200} max={150} valueText="150 of 150 XP" />);
    const bar = screen.getByRole('progressbar', { name: 'Experience' });
    expect(bar).toHaveAttribute('aria-valuenow', '150');
    expect(bar).toHaveAttribute('aria-valuetext', '150 of 150 XP');
  });
});

describe('Chip / ToggleChip / EmptyState', () => {
  it('chips can be removed and toggled', async () => {
    const onRemove = vi.fn();
    const onChange = vi.fn();
    render(
      <>
        <Chip onRemove={onRemove}>exam</Chip>
        <ToggleChip selected={false} onChange={onChange}>
          Quick
        </ToggleChip>
        <EmptyState title="Nothing yet">Add one</EmptyState>
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove exam' }));
    expect(onRemove).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Quick' }));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('heading', { name: 'Nothing yet' })).toBeInTheDocument();
  });
});

describe('Dialog', () => {
  function Demo({ onClose }: { onClose?: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <Dialog
          open={open}
          onClose={() => {
            onClose?.();
            setOpen(false);
          }}
          title="Swap a quest"
          description="Pick one"
          footer={<button>Confirm</button>}
        >
          <input aria-label="Name" />
        </Dialog>
      </>
    );
  }

  it('is a labelled modal that traps focus and returns it on close', async () => {
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
    render(<Demo />, { container: root });
    const opener = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Swap a quest' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Pick one');
    expect(root).toHaveAttribute('inert');
    // First focusable is the close button.
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByLabelText('Name')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(root).not.toHaveAttribute('inert');
    expect(opener).toHaveFocus();
    root.remove();
  });
});

describe('Toast', () => {
  it('shows and auto-dismisses', () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      showToast({ title: '+12 XP', duration: 1000 });
    });
    expect(screen.getByText('+12 XP')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.queryByText('+12 XP')).not.toBeInTheDocument();
    vi.useRealTimers();
    useToastStore.setState({ toasts: [] });
  });
});
