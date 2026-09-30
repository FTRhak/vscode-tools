import { ObjectTransform, SourcePath, Vec2 } from '../model/types';

export interface Matrix {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

export const identityMatrix: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export const identityTransform: ObjectTransform = {
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  originX: 0,
  originY: 0,
};

export function multiplyMatrix(left: Matrix, right: Matrix): Matrix {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

export function invertMatrix(value: Matrix): Matrix | null {
  const determinant = value.a * value.d - value.b * value.c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) {
    return null;
  }
  return {
    a: value.d / determinant,
    b: -value.b / determinant,
    c: -value.c / determinant,
    d: value.a / determinant,
    e: (value.c * value.f - value.d * value.e) / determinant,
    f: (value.b * value.e - value.a * value.f) / determinant,
  };
}

export function applyMatrix(matrix: Matrix, point: Vec2): Vec2 {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
  };
}

export function matrixFromTransform(transform: ObjectTransform): Matrix {
  const scale = matrix(transform.scaleX, 0, 0, transform.scaleY, 0, 0);
  const rotation = rotateMatrix(
    transform.rotation,
    transform.originX * transform.scaleX,
    transform.originY * transform.scaleY,
  );
  const translation = translateMatrix(transform.x, transform.y);
  return multiplyMatrix(translation, multiplyMatrix(rotation, scale));
}

export function transformSource(source: SourcePath, matrix: Matrix): SourcePath {
  return {
    subpaths: source.subpaths.map((subpath) => ({
      closed: subpath.closed,
      anchors: subpath.anchors.map((anchor) => ({
        ...anchor,
        position: applyMatrix(matrix, anchor.position),
        handleIn: anchor.handleIn ? applyMatrix(matrix, anchor.handleIn) : null,
        handleOut: anchor.handleOut ? applyMatrix(matrix, anchor.handleOut) : null,
      })),
      segments: subpath.segments,
    })),
  };
}

export function parseSvgTransform(value: string | null): Matrix {
  if (!value) {
    return identityMatrix;
  }
  let result = identityMatrix;
  for (const match of value.matchAll(
    /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/gi,
  )) {
    const kind = match[1]?.toLowerCase();
    const args = numbersIn(match[2] ?? '');
    const next = transformPart(kind, args);
    if (next) {
      result = multiplyMatrix(result, next);
    }
  }
  return result;
}

function transformPart(kind: string | undefined, args: readonly number[]): Matrix | null {
  switch (kind) {
    case 'matrix':
      return args.length >= 6 ? matrix(args[0], args[1], args[2], args[3], args[4], args[5]) : null;
    case 'translate':
      return args.length >= 1 ? translateMatrix(args[0], args[1] ?? 0) : null;
    case 'scale':
      return args.length >= 1 ? matrix(args[0], 0, 0, args[1] ?? args[0], 0, 0) : null;
    case 'rotate':
      return args.length >= 1 ? rotateMatrix(args[0], args[1] ?? 0, args[2] ?? 0) : null;
    case 'skewx':
      return args.length >= 1 ? matrix(1, 0, Math.tan((args[0] * Math.PI) / 180), 1, 0, 0) : null;
    case 'skewy':
      return args.length >= 1 ? matrix(1, Math.tan((args[0] * Math.PI) / 180), 0, 1, 0, 0) : null;
    default:
      return null;
  }
}

function translateMatrix(x: number, y: number): Matrix {
  return matrix(1, 0, 0, 1, x, y);
}

function rotateMatrix(degrees: number, cx = 0, cy = 0): Matrix {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rotation = matrix(cos, sin, -sin, cos, 0, 0);
  if (cx === 0 && cy === 0) {
    return rotation;
  }
  return multiplyMatrix(
    multiplyMatrix(translateMatrix(cx, cy), rotation),
    translateMatrix(-cx, -cy),
  );
}

function matrix(a: number, b: number, c: number, d: number, e: number, f: number): Matrix {
  return { a, b, c, d, e, f };
}

function numbersIn(value: string): number[] {
  return [...value.matchAll(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g)].flatMap((match) => {
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? [parsed] : [];
  });
}
