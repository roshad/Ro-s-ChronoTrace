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

    expect(screen.getByText('检测到空闲时间')).toBeInTheDocument();
    expect(screen.getByText(/时长：/)).toBeInTheDocument();
    expect(screen.getByText(/时间段：/)).toBeInTheDocument();
    expect(screen.getByText('30分钟')).toBeInTheDocument();
  });

  it('displays formatted time range', () => {
    render(
      <IdlePrompt
        idlePeriod={mockIdlePeriod}
        onResolved={mockOnResolved}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/\d{2}:\d{2}\s-\s\d{2}:\d{2}/)).toBeInTheDocument();
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

    const discardButton = screen.getByText('丢弃（保持为空档）');
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

  it('shows label input when 创建新任务 button is clicked', () => {
    render(
      <IdlePrompt
        idlePeriod={mockIdlePeriod}
        onResolved={mockOnResolved}
        onClose={mockOnClose}
      />
    );

    const createTaskButton = screen.getByText('创建新任务');
    fireEvent.click(createTaskButton);

    expect(screen.getByPlaceholderText('请输入任务标签...')).toBeInTheDocument();
    expect(screen.getByText('创建任务')).toBeInTheDocument();
    expect(screen.getByText('返回')).toBeInTheDocument();
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

    // Click 创建新任务 button
    const createTaskButton = screen.getByText('创建新任务');
    fireEvent.click(createTaskButton);

    // Enter label
    const labelInput = screen.getByPlaceholderText('请输入任务标签...');
    fireEvent.change(labelInput, { target: { value: 'Test Task' } });

    // Click 创建任务 button
    const submitButton = screen.getByText('创建任务');
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

    // Click 创建新任务 button
    const createTaskButton = screen.getByText('创建新任务');
    fireEvent.click(createTaskButton);

    // Enter label and press Enter
    const labelInput = screen.getByPlaceholderText('请输入任务标签...');
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

    // Click 创建新任务 button
    const createTaskButton = screen.getByText('创建新任务');
    fireEvent.click(createTaskButton);

    // Try to submit with empty label
    const submitButton = screen.getByText('创建任务');
    fireEvent.click(submitButton);

    expect(mockResolveIdlePeriod).not.toHaveBeenCalled();
  });

  it('returns to main view when 返回 button is clicked', () => {
    render(
      <IdlePrompt
        idlePeriod={mockIdlePeriod}
        onResolved={mockOnResolved}
        onClose={mockOnClose}
      />
    );

    // Click 创建新任务 button
    const createTaskButton = screen.getByText('创建新任务');
    fireEvent.click(createTaskButton);

    // Click 返回 button
    const 返回Button = screen.getByText('返回');
    fireEvent.click(返回Button);

    // Should return to main view
    expect(screen.getByText('丢弃（保持为空档）')).toBeInTheDocument();
    expect(screen.getByText('合并到上一条任务')).toBeInTheDocument();
    expect(screen.getByText('创建新任务')).toBeInTheDocument();
    expect(screen.getByText('稍后决定')).toBeInTheDocument();
  });

  it('calls onResolved when merge button is clicked', async () => {
    mockResolveIdlePeriod.mockResolvedValue(undefined);

    render(
      <IdlePrompt
        idlePeriod={mockIdlePeriod}
        onResolved={mockOnResolved}
        onClose={mockOnClose}
      />
    );

    const mergeButton = screen.getByText('合并到上一条任务');
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

  it('calls onClose when postpone button is clicked', () => {
    render(
      <IdlePrompt
        idlePeriod={mockIdlePeriod}
        onResolved={mockOnResolved}
        onClose={mockOnClose}
      />
    );

    const decideLaterButton = screen.getByText('稍后决定');
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
    const overlay = screen.getByText('检测到空闲时间').parentElement?.parentElement;
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
    const dialog = screen.getByText('检测到空闲时间').parentElement;
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

    const discardButton = screen.getByText('丢弃（保持为空档）');
    fireEvent.click(discardButton);

    // Check if buttons are disabled
    expect(screen.getByText('丢弃（保持为空档）')).toBeDisabled();
    expect(screen.getByText('合并到上一条任务')).toBeDisabled();
    expect(screen.getByText('创建新任务')).toBeDisabled();
    expect(screen.getByText('稍后决定')).toBeDisabled();
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

    expect(screen.getByText('2小时 30分钟')).toBeInTheDocument();
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

    expect(screen.getByText('15分钟')).toBeInTheDocument();
  });
});

