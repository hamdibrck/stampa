import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button, ProgressBar } from '.';

describe('Button', () => {
  it('calls onPress and exposes its label', async () => {
    const onPress = jest.fn();
    await render(<Button label="Şehri gezdim" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Şehri gezdim' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Devam et" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: 'Devam et' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('ProgressBar', () => {
  it('clamps and reports its value', async () => {
    await render(<ProgressBar value={1.7} accessibilityLabel="ilerleme" />);
    expect(screen.getByLabelText('ilerleme').props.accessibilityValue.now).toBe(100);
  });
});
