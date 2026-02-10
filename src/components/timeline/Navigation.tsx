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
        {'<'} 前一天
      </button>

      <button onClick={onGoToToday} className="btn btn-secondary btn-sm">
        今天
      </button>

      <button onClick={onNextDay} className="btn btn-secondary btn-sm">
        后一天 {'>'}
      </button>

      <div className="nav-date">
        {selectedDate.toLocaleDateString('zh-CN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </div>
    </div>
  );
};
