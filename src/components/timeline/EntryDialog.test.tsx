import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EntryDialog } from './EntryDialog';
import { api } from '../../services/api';

jest.mock('../../services/api', () => ({
  api: {
    getCategories: jest.fn(),
    createCategory: jest.fn(),
    deleteCategory: jest.fn(),
  },
}));

const mockGetCategories = api.getCategories as jest.MockedFunction<typeof api.getCategories>;
const mockCreateCategory = api.createCategory as jest.MockedFunction<typeof api.createCategory>;
const mockDeleteCategory = api.deleteCategory as jest.MockedFunction<typeof api.deleteCategory>;

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
};

describe('EntryDialog', () => {
  const mockStartTime = new Date('2026-01-28T09:00:00Z').getTime();
  const mockEndTime = new Date('2026-01-28T10:30:00Z').getTime();
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
    mockOnCancel.mockClear();
    mockGetCategories.mockResolvedValue([]);
    mockCreateCategory.mockImplementation(async (category) => ({ id: 1, ...category }));
    mockDeleteCategory.mockResolvedValue(undefined);
  });

  it('renders dialog fields', () => {
    renderWithQueryClient(
      <EntryDialog
        startTime={mockStartTime}
        endTime={mockEndTime}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByPlaceholderText('你刚刚在做什么？')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建条目' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
  });

  it('calls onSubmit with category only (no color)', () => {
    renderWithQueryClient(
      <EntryDialog
        startTime={mockStartTime}
        endTime={mockEndTime}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('你刚刚在做什么？'), {
      target: { value: 'Test Entry' },
    });
    fireEvent.click(screen.getByRole('button', { name: '创建条目' }));

    expect(mockOnSubmit).toHaveBeenCalledWith({
      start_time: mockStartTime,
      end_time: mockEndTime,
      label: 'Test Entry',
      category_id: undefined,
    });
  });

  it('does not submit when label is empty', () => {
    renderWithQueryClient(
      <EntryDialog
        startTime={mockStartTime}
        endTime={mockEndTime}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '创建条目' }));
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('trims label whitespace before submitting', () => {
    renderWithQueryClient(
      <EntryDialog
        startTime={mockStartTime}
        endTime={mockEndTime}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('你刚刚在做什么？'), {
      target: { value: '  Test Entry  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: '创建条目' }));

    expect(mockOnSubmit).toHaveBeenCalledWith({
      start_time: mockStartTime,
      end_time: mockEndTime,
      label: 'Test Entry',
      category_id: undefined,
    });
  });

  it('calls onCancel when cancel button is clicked', () => {
    renderWithQueryClient(
      <EntryDialog
        startTime={mockStartTime}
        endTime={mockEndTime}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('submits edited time range from dialog', () => {
    const { container } = renderWithQueryClient(
      <EntryDialog
        startTime={mockStartTime}
        endTime={mockEndTime}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const timeInputs = container.querySelectorAll('input[type="time"]');
    expect(timeInputs).toHaveLength(2);

    fireEvent.change(timeInputs[0], { target: { value: '09:15' } });
    fireEvent.change(timeInputs[1], { target: { value: '11:00' } });
    fireEvent.change(screen.getByPlaceholderText('你刚刚在做什么？'), {
      target: { value: 'Edited Range Entry' },
    });
    fireEvent.click(screen.getByRole('button', { name: '创建条目' }));

    const expectedStart = new Date(mockStartTime);
    expectedStart.setHours(9, 15, 0, 0);
    const expectedEnd = new Date(mockEndTime);
    expectedEnd.setHours(11, 0, 0, 0);

    expect(mockOnSubmit).toHaveBeenCalledWith({
      start_time: expectedStart.getTime(),
      end_time: expectedEnd.getTime(),
      label: 'Edited Range Entry',
      category_id: undefined,
    });
  });
});

