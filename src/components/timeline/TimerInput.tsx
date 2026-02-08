import React, { useState, useEffect } from 'react';
import { useTimelineStore } from '../../services/store';
import { CategorySelector } from './CategorySelector';

interface TimerInputProps {
    onStop: (label: string, startTime: number, endTime: number, categoryId?: number) => void;
}

export const TimerInput: React.FC<TimerInputProps> = ({ onStop }) => {
    const { activeTimer, startTimer, stopTimer } = useTimelineStore();
    const [label, setLabel] = useState('');
    const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        let interval: number | undefined;
        if (activeTimer) {
            setLabel(activeTimer.label);
            setCategoryId(activeTimer.categoryId);
            interval = window.setInterval(() => {
                setElapsed(Date.now() - activeTimer.startTime);
            }, 1000);
        } else {
            setElapsed(0);
            setCategoryId(undefined);
        }
        return () => clearInterval(interval);
    }, [activeTimer]);

    const handleStartStop = () => {
        if (activeTimer) {
            const endTime = Date.now();
            onStop(activeTimer.label, activeTimer.startTime, endTime, activeTimer.categoryId);
            stopTimer();
            setLabel('');
            setCategoryId(undefined);
        } else {
            if (label.trim()) {
                startTimer(label, categoryId);
            }
        }
    };

    const formatElapsedTime = (ms: number) => {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor(ms / (1000 * 60 * 60));

        return `${hours.toString().padStart(2, '0')}:${minutes
            .toString()
            .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 20px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                border: '1px solid #dee2e6',
                width: '100%',
                marginBottom: '20px',
            }}
        >
            <input
                type="text"
                placeholder="What are you working on?"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={!!activeTimer}
                style={{
                    flex: 1,
                    padding: '10px 16px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleStartStop();
                }}
            />

            <CategorySelector
                selectedCategoryId={categoryId}
                onSelect={setCategoryId}
            />

            {activeTimer && (
                <div
                    style={{
                        fontSize: '20px',
                        fontWeight: '600',
                        fontFamily: 'monospace',
                        color: '#2d3436',
                        minWidth: '100px',
                        textAlign: 'right',
                    }}
                >
                    {formatElapsedTime(elapsed)}
                </div>
            )}

            <button
                onClick={handleStartStop}
                style={{
                    padding: '10px 24px',
                    backgroundColor: activeTimer ? '#ff4757' : '#2ed573',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s, transform 0.1s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '100px',
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
                {activeTimer ? 'Stop' : 'Start'}
            </button>
        </div>
    );
};
