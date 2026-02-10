import React from 'react';

interface NavigationProps {
  selectedDate: Date;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onGoToToday: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  selectedDate,
  onPreviousDay,
  onNextDay,
  onGoToToday,
}) => {
  return (
    <div className="toolbar-row">
      <button onClick={onPreviousDay} className="btn btn-secondary btn-sm">
        {'<'} Previous Day
      </button>

      <button onClick={onGoToToday} className="btn btn-secondary btn-sm">
        Today
      </button>

      <button onClick={onNextDay} className="btn btn-secondary btn-sm">
        Next Day {'>'}
      </button>

      <div className="nav-date">
        {selectedDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </div>
    </div>
  );
};
