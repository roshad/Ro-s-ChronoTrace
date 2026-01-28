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
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <button
        onClick={onPreviousDay}
        style={{
          padding: '8px 16px',
          fontSize: '14px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          backgroundColor: 'white',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
      >
        ← Previous Day
      </button>

      <button
        onClick={onGoToToday}
        style={{
          padding: '8px 16px',
          fontSize: '14px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          backgroundColor: 'white',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
      >
        Today
      </button>

      <button
        onClick={onNextDay}
        style={{
          padding: '8px 16px',
          fontSize: '14px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          backgroundColor: 'white',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
      >
        Next Day →
      </button>

      <div
        style={{
          fontSize: '18px',
          fontWeight: 'bold',
          marginLeft: '16px',
          minWidth: '250px',
        }}
      >
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
