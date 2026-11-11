import { canAddPhoto, photoPath, targetSize } from './resize';

describe('targetSize', () => {
  it('scales the long edge down to 2048', () => {
    expect(targetSize(4032, 3024)).toEqual({ width: 2048, height: 1536 });
    expect(targetSize(3024, 4032)).toEqual({ width: 1536, height: 2048 });
  });
  it('never upscales', () => {
    expect(targetSize(1200, 800)).toEqual({ width: 1200, height: 800 });
    expect(targetSize(2048, 2048)).toEqual({ width: 2048, height: 2048 });
  });
});

describe('photoPath', () => {
  it('matches the shape the storage policy expects', () => {
    expect(photoPath('u', 745044, 'x')).toBe('u/745044/x.jpg');
  });
});

describe('canAddPhoto', () => {
  it('allows two free photos and blocks the third', () => {
    expect(canAddPhoto(0, 2)).toBe(true);
    expect(canAddPhoto(1, 2)).toBe(true);
    expect(canAddPhoto(2, 2)).toBe(false);
  });
  it('respects purchased slots and Plus', () => {
    expect(canAddPhoto(11, 12)).toBe(true);
    expect(canAddPhoto(12, 12)).toBe(false);
    expect(canAddPhoto(500, null)).toBe(true);
  });
});
