import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useTimelineStore } from '../../services/store';
import { TimerInput } from './TimerInput';

jest.mock('../../services/api', () => ({
  api: {
    getCategories: jest.fn(),
  },
}));

const mockGetCategories = api.getCategories as jest.MockedFunction<typeof api.getCategories>;

const renderTimerInput = (onStart = jest.fn().mockResolvedValue(42)) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <TimerInput
        onStart={onStart}
        onStop={jest.fn().mockResolvedValue(undefined)}
        onDeleteCurrent={jest.fn().mockResolvedValue(undefined)}
        onUpdateLabel={jest.fn().mockResolvedValue(undefined)}
        onUpdateCategory={jest.fn().mockResolvedValue(undefined)}
      />
    </QueryClientProvider>,
  );

  return { onStart };
};

describe('TimerInput', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useTimelineStore.setState({ activeTimer: null });
    mockGetCategories.mockResolvedValue([
      { id: 1, name: '工作', color: '#2563eb' },
      { id: 2, name: '休息', color: '#16a34a' },
    ]);
  });

  it('shows categories directly in the current behavior area without a dropdown', async () => {
    const { onStart } = renderTimerInput();

    const workCategory = await screen.findByRole('button', { name: '工作' });
    expect(screen.getByRole('button', { name: '休息' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '未分类' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: '分类' })).not.toBeInTheDocument();

    fireEvent.click(workCategory);
    expect(workCategory).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByPlaceholderText('你正在做什么？'), {
      target: { value: '编写测试' },
    });
    fireEvent.click(screen.getByRole('button', { name: '开始' }));

    await waitFor(() => {
      expect(onStart).toHaveBeenCalledWith('编写测试', expect.any(Number), 1);
    });
  });
});
