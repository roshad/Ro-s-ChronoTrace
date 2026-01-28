import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IdlePrompt } from './IdlePrompt';
import { api } from '../../services/api';

// Mock API module
jest.mock('../../services/api', () => ({
  api: {
    resolveIdlePeriod: jest.fn(),
  },
}));

const mockResolveIdlePeriod = api.resolveIdlePeriod as jest.MockedFunction<typeof api.resolveIdlePeriod>;

describe('IdlePrompt', () => {
  const mockIdlePeriod = {
    id: 1,
    start_time: new Date('2026-01-28T09:00:00Z').getTime(),
    end_time: new Date('2026-01-28T09:30:00Z').getTime(),
  };
  const mockOnResolved = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders idle prompt with idle period information', () => {
    render(
      <IdlePrompt
        idlePeriod={mockIdlePeriod}
        onResolved={mockOnResolved}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Idle Time Detected')).toBeInTheDocument();
    expect(screen.getByText(/Duration:/)).toBeInTheDocument();
    expect(screen.getByText(/Period:/)).toBeInTheDocument();
    expect(screen.getByText('30m')).toBeInTheDocument();
  });

  it('displays formatted time range', () => {
    render(
      <IdlePrompt
        idlePeriod={mockIdlePeriod}
        onResolved={mockOnResolved}
        onClose={mockOnClose}
      />
    );

    // Check if time range is displayed (look for the period paragraph)
    const periodText = screen.getByText((content, element) => {
      return element?.tagName === 'P' && content.includes('PM') && content.includes('-');
    });
    expect(periodText).toBeInTheDocument();
  });

  it('calls onResolved when discard button is clicked', async () => {
    mockResolveIdlePeriod.mockResolvedValue(undefined);

    render(
      <IdlePrompt
        idlePeriod={mockIdlePeriod}
        onResolved={mockOnResolved}
        onClose={mockOnClose}
      />
    );

    const discardButton = screen.getByText('Discard time (keep as gap)');
    fireEvent.click(discardButton);

    await waitFor(() => {
      expect(mockResolveIdlePeriod).toHaveBeenCalledWith({
        id: mockIdlePeriod.id,
        resolution: 'discarded',
        target_entry_id: undefined,
        new_entry_label: undefined,
      });
    });

    expect(mockOnResolved).toHaveBeenCalled();
  });

  it('shows label input when create new task button is clicked', () => {
    render(
      <IdlePrompt
        idlePeriod={mockIdlePeriod}
        onResolved={mockOnResolved}
        onClose={mockOnClose}
      />
    );

    const createTaskButton = screen.getByText('Create new task');
    fireEvent.click(createTaskButton);

    expect(screen.getByPlaceholderText('Enter task label...')).toBeInTheDocument();
    expect(screen.getByText('Create Task')).toBeInTheDocument();
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('calls onResolved when new task is created', async () => {
    mockResolveIdlePeriod.mockResolvedValue(undefined);

    render(
      <IdlePrompt
        idlePeriod={mockIdlePeriod}
        onResolved={mockOnResolved}
        onClose={mockOnClose}
      />
    );

    // Click create new task button
    const createTaskButton = screen.getByText('Create new task');
    fireEvent.click(createTaskButton);

    // Enter label
    const labelInput = screen.getByPlaceholderText('Enter task label...');
    fireEvent.change(labelInput, { target: { value: 'Test Task' } });

    // Click create task button
    const submitButton = screen.getByText('Create Task');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockResolveIdlePeriod).toHaveBeenCalledWith({
        id: mockIdlePeriod.id,
        resolution: 'labeled',
        target_entry_id: undefined,
        new_entry_label: 'Test Task',
      });
    });

    expect(mockOnResolved).toHaveBeenCalled();
  });

  it('submits task when Enter key is pressed', async () => {
    mockResolveIdlePeriod.mockResolvedValue(undefined);

    render(
      <IdlePrompt
        idlePeriod={mockIdlePeriod}
        onResolved={mockOnResolved}
        onClose={mockOnClose}
      />
    );

    // Click create new task button
    const createTaskButton = screen.getByText('Create new task');
    fireEvent.click(createTaskButton);

    // Enter label and press Enter
    const labelInput = screen.getByPlaceholderText('Enter task label...');
    fireEvent.change(labelInput, { target: { value: 'Test Task' } });
    fireEvent.keyDown(labelInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(mockResolveIdlePeriod).toHaveBeenCalledWith({
        id: mockIdlePeriod.id,
        resolution: 'labeled',
        target_entry_id: undefined,
        new_entry_label: 'Test Task',
      });
    });

    expect(mockOnResolved).toHaveBeenCalled();
  });

  it('does not submit task when label is empty', async () => {
    render(
      <IdlePrompt
        idlePeriod={mockIdlePeriod}
        onResolved={mockOnResolved}
        onClose={mockOnClose}
      />
    );

    // Click create new task button
    const createTaskButton = screen.getByText('Create new task');
    fireEvent.click(createTaskButton);

    // Try to submit with empty label
    const submitButton = screen.getByText('Create Task');
    fireEvent.click(submitButton);

    expect(mockResolveIdlePeriod).not.toHaveBeenCalled();
  });

  it('returns to main view when back button is clicked', () => {
    render(
      <IdlePrompt
        idlePeriod={mockIdlePeriod}
        onResolved={mockOnResolved}
        onClose={mockOnClose}
      />
    );

    // Click create new task button
    const createTaskButton = screen.getByText('Create new task');
    fireEvent.click(createTaskButton);

    // Click back button
    const backButton = screen.getByText('Back');
    fireEvent.click(backButton);

    // Should return to main view
    expect(screen.getByText('Discard time (keep as gap)')).toBeInTheDocument();
    expect(screen.getByText('Add to previous task')).toBeInTheDocument();
    expect(screen.getByText('Create new task')).toBeInTheDocument();
    expect(screen.getByText('Decide later')).toBeInTheDocument();
  });

  it('calls onResolved when add to previous task button is clicked', async () => {
    mockResolveIdlePeriod.mockResolvedValue(undefined);

    render(
      <IdlePrompt
        idlePeriod={mockIdlePeriod}
        onResolved={mockOnResolved}
        onClose={mockOnClose}
      />
    );

    const mergeButton = screen.getByText('Add to previous task');
    fireEvent.click(mergeButton);

    await waitFor(() => {
      expect(mockResolveIdlePeriod).toHaveBeenCalledWith({
        id: mockIdlePeriod.id,
        resolution: 'merged',
        target_entry_id: undefined,
        new_entry_label: undefined,
      });
    });

    expect(mockOnResolved).toHaveBeenCalled();
  });

  it('calls onClose when decide later button is clicked', () => {
    render(
      <IdlePrompt
        idlePeriod={mockIdlePeriod}
        onResolved={mockOnResolved}
        onClose={mockOnClose}
      />
    );

    const decideLaterButton = screen.getByText('Decide later');
    fireEvent.click(decideLaterButton);

    expect(mockOnClose).toHaveBeenCalled();
    expect(mockOnResolved).not.toHaveBeenCalled();
  });

  it('calls onClose when clicking outside of dialog', () => {
    render(
      <IdlePrompt
        idlePeriod={mockIdlePeriod}
        onResolved={mockOnResolved}
        onClose={mockOnClose}
      />
    );

    // Click on overlay (outside of dialog)
    const overlay = screen.getByText('Idle Time Detected').parentElement?.parentElement;
    if (overlay) {
      fireEvent.click(overlay);
    }

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('does not call onClose when clicking inside of dialog', () => {
    render(
      <IdlePrompt
        idlePeriod={mockIdlePeriod}
        onResolved={mockOnResolved}
        onClose={mockOnClose}
      />
    );

    // Click inside of dialog
    const dialog = screen.getByText('Idle Time Detected').parentElement;
    if (dialog) {
      fireEvent.click(dialog);
    }

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('disables buttons while loading', async () => {
    mockResolveIdlePeriod.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(
      <IdlePrompt
        idlePeriod={mockIdlePeriod}
        onResolved={mockOnResolved}
        onClose={mockOnClose}
      />
    );

    const discardButton = screen.getByText('Discard time (keep as gap)');
    fireEvent.click(discardButton);

    // Check if buttons are disabled
    expect(screen.getByText('Discard time (keep as gap)')).toBeDisabled();
    expect(screen.getByText('Add to previous task')).toBeDisabled();
    expect(screen.getByText('Create new task')).toBeDisabled();
    expect(screen.getByText('Decide later')).toBeDisabled();
  });

  it('formats duration correctly for hours and minutes', () => {
    const longIdlePeriod = {
      id: 1,
      start_time: new Date('2026-01-28T09:00:00Z').getTime(),
      end_time: new Date('2026-01-28T11:30:00Z').getTime(),
    };

    render(
      <IdlePrompt
        idlePeriod={longIdlePeriod}
        onResolved={mockOnResolved}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('2h 30m')).toBeInTheDocument();
  });

  it('formats duration correctly for minutes only', () => {
    const shortIdlePeriod = {
      id: 1,
      start_time: new Date('2026-01-28T09:00:00Z').getTime(),
      end_time: new Date('2026-01-28T09:15:00Z').getTime(),
    };

    render(
      <IdlePrompt
        idlePeriod={shortIdlePeriod}
        onResolved={mockOnResolved}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('15m')).toBeInTheDocument();
  });
});
