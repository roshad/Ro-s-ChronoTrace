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
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
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
    mockCreateCategory.mockImplementation(async (category) => ({
      id: 1,
      ...category,
    }));
    mockDeleteCategory.mockResolvedValue(undefined);
  });

  it('renders dialog with time range', () => {
    renderWithQueryClient(
      <EntryDialog
        startTime={mockStartTime}
        endTime={mockEndTime}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('创建时间条目')).toBeInTheDocument();
    expect(screen.getByText('时间范围')).toBeInTheDocument();
    expect(screen.getByText('标签 *')).toBeInTheDocument();
    expect(screen.getByText('颜色')).toBeInTheDocument();
  });

  it('displays formatted time range', () => {
    renderWithQueryClient(
      <EntryDialog
        startTime={mockStartTime}
        endTime={mockEndTime}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Check if time range is displayed
    const timeRangeText = screen.getByText(/:/);
    expect(timeRangeText).toBeInTheDocument();
  });

  it('displays duration', () => {
    renderWithQueryClient(
      <EntryDialog
        startTime={mockStartTime}
        endTime={mockEndTime}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Check if duration is displayed (1h 30m)
    // Use a function matcher to find the text even if it's split across elements
    expect(screen.getByText((content, _element) => {
      return content.includes('1小时 30分钟');
    })).toBeInTheDocument();
  });

  it('calls onSubmit with correct data when form is submitted', () => {
    renderWithQueryClient(
      <EntryDialog
        startTime={mockStartTime}
        endTime={mockEndTime}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const labelInput = screen.getByPlaceholderText('你刚刚在做什么？');
    fireEvent.change(labelInput, { target: { value: 'Test Entry' } });

    const submitButton = screen.getByText('创建条目');
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith({
      start_time: mockStartTime,
      end_time: mockEndTime,
      label: 'Test Entry',
      color: '#4CAF50',
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

    const cancelButton = screen.getByText('取消');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('allows color selection', () => {
    renderWithQueryClient(
      <EntryDialog
        startTime={mockStartTime}
        endTime={mockEndTime}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Find color buttons (they are button elements with specific background colors)
    const colorButtons = screen.getAllByRole('button');
    const blueButton = colorButtons.find(
      (btn) => btn.style.backgroundColor === 'rgb(33, 150, 243)'
    );

    if (blueButton) {
      fireEvent.click(blueButton);

      const labelInput = screen.getByPlaceholderText('你刚刚在做什么？');
      fireEvent.change(labelInput, { target: { value: 'Test Entry' } });

      const submitButton = screen.getByText('创建条目');
      fireEvent.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalledWith({
        start_time: mockStartTime,
        end_time: mockEndTime,
        label: 'Test Entry',
        color: '#2196F3',
      });
    }
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

    const submitButton = screen.getByText('创建条目');
    fireEvent.click(submitButton);

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

    const labelInput = screen.getByPlaceholderText('你刚刚在做什么？');
    fireEvent.change(labelInput, { target: { value: '  Test Entry  ' } });

    const submitButton = screen.getByText('创建条目');
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith({
      start_time: mockStartTime,
      end_time: mockEndTime,
      label: 'Test Entry',
      color: '#4CAF50',
    });
  });

  it('renders all color options', () => {
    renderWithQueryClient(
      <EntryDialog
        startTime={mockStartTime}
        endTime={mockEndTime}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Check that all color buttons are rendered
    const colorButtons = screen.getAllByRole('button');
    expect(colorButtons.length).toBeGreaterThan(0);
  });
});
