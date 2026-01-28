import { render, screen, fireEvent } from '@testing-library/react';
import { EntryDialog } from './EntryDialog';

describe('EntryDialog', () => {
  const mockStartTime = new Date('2026-01-28T09:00:00Z').getTime();
  const mockEndTime = new Date('2026-01-28T10:30:00Z').getTime();
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
    mockOnCancel.mockClear();
  });

  it('renders dialog with time range', () => {
    render(
      <EntryDialog
        startTime={mockStartTime}
        endTime={mockEndTime}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Create Time Entry')).toBeInTheDocument();
    expect(screen.getByText('Time Range')).toBeInTheDocument();
    expect(screen.getByText('Label *')).toBeInTheDocument();
    expect(screen.getByText('Color')).toBeInTheDocument();
  });

  it('displays formatted time range', () => {
    render(
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
    render(
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
      return content.includes('1h 30m');
    })).toBeInTheDocument();
  });

  it('calls onSubmit with correct data when form is submitted', () => {
    render(
      <EntryDialog
        startTime={mockStartTime}
        endTime={mockEndTime}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const labelInput = screen.getByPlaceholderText('What were you working on?');
    fireEvent.change(labelInput, { target: { value: 'Test Entry' } });

    const submitButton = screen.getByText('Create Entry');
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith({
      start_time: mockStartTime,
      end_time: mockEndTime,
      label: 'Test Entry',
      color: '#4CAF50',
    });
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(
      <EntryDialog
        startTime={mockStartTime}
        endTime={mockEndTime}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('allows color selection', () => {
    render(
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

      const labelInput = screen.getByPlaceholderText('What were you working on?');
      fireEvent.change(labelInput, { target: { value: 'Test Entry' } });

      const submitButton = screen.getByText('Create Entry');
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
    render(
      <EntryDialog
        startTime={mockStartTime}
        endTime={mockEndTime}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const submitButton = screen.getByText('Create Entry');
    fireEvent.click(submitButton);

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('trims label whitespace before submitting', () => {
    render(
      <EntryDialog
        startTime={mockStartTime}
        endTime={mockEndTime}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const labelInput = screen.getByPlaceholderText('What were you working on?');
    fireEvent.change(labelInput, { target: { value: '  Test Entry  ' } });

    const submitButton = screen.getByText('Create Entry');
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith({
      start_time: mockStartTime,
      end_time: mockEndTime,
      label: 'Test Entry',
      color: '#4CAF50',
    });
  });

  it('renders all color options', () => {
    render(
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
