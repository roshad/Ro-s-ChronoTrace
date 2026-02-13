import { render, screen } from '@testing-library/react';
import { HoverInsightsTooltip } from './HoverInsightsTooltip';

describe('HoverInsightsTooltip', () => {
  it('shows duration right after interval', () => {
    render(
      <HoverInsightsTooltip
        position={{ x: 10, y: 20 }}
        timestamp={1700000000000}
        rangeStart={1700000000000}
        rangeEnd={1700000090000}
        processItems={[]}
      />
    );

    expect(screen.getByText((content) => content.includes('持续 1分 30秒'))).toBeInTheDocument();
  });
});
