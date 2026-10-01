import { localToDocument } from '../../viewport/utils/hit-test';
import { rotationOriginDocument, transformWithRotationOrigin } from './transform';

describe('transformWithRotationOrigin', () => {
  it('keeps rotated geometry fixed while the pivot moves', () => {
    const turned = {
      x: 0,
      y: 0,
      rotation: 90,
      scaleX: 1,
      scaleY: 1,
      originX: 0,
      originY: 0,
    };
    const before = localToDocument(turned, { x: 10, y: 0 });
    const next = transformWithRotationOrigin(turned, { x: 40, y: 15 });

    expect(next).not.toBeNull();
    if (!next) {
      return;
    }
    const after = localToDocument(next, { x: 10, y: 0 });
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(rotationOriginDocument(next).x).toBeCloseTo(40);
    expect(rotationOriginDocument(next).y).toBeCloseTo(15);
  });

  it('leaves translation alone when the object is not rotated', () => {
    const next = transformWithRotationOrigin(
      { x: 4, y: 7, rotation: 0, scaleX: 2, scaleY: 1, originX: 0, originY: 0 },
      { x: 10, y: 7 },
    );

    expect(next).toEqual({
      x: 4,
      y: 7,
      rotation: 0,
      scaleX: 2,
      scaleY: 1,
      originX: 3,
      originY: 0,
    });
  });
});
