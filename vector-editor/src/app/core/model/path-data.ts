import { Anchor, Segment, SourcePath, Subpath, Vec2 } from './types';

export function sourceToPathData(source: SourcePath): string {
  return source.subpaths
    .map(subpathToPathData)
    .filter((data) => data.length > 0)
    .join(' ');
}

function subpathToPathData(subpath: Subpath): string {
  const anchors = new Map(subpath.anchors.map((item) => [item.id, item]));
  const commands: string[] = [];

  for (const segment of subpath.segments) {
    const from = anchors.get(segment.fromId);
    const to = anchors.get(segment.toId);
    if (!from || !to) {
      continue;
    }
    if (commands.length === 0) {
      commands.push(moveTo(from.position));
    }
    commands.push(segmentCommand(segment, from, to));
  }

  if (commands.length === 0 && subpath.anchors[0]) {
    commands.push(moveTo(subpath.anchors[0].position));
  }
  if (subpath.closed && commands.length > 0) {
    commands.push('Z');
  }
  return commands.join(' ');
}

function segmentCommand(segment: Segment, from: Anchor, to: Anchor): string {
  if (segment.kind === 'line') {
    return `L ${formatCoordinate(to.position.x)} ${formatCoordinate(to.position.y)}`;
  }
  const controlOut = from.handleOut ?? from.position;
  const controlIn = to.handleIn ?? to.position;
  return `C ${formatCoordinate(controlOut.x)} ${formatCoordinate(controlOut.y)} ${formatCoordinate(controlIn.x)} ${formatCoordinate(controlIn.y)} ${formatCoordinate(to.position.x)} ${formatCoordinate(to.position.y)}`;
}

function moveTo(position: Vec2): string {
  return `M ${formatCoordinate(position.x)} ${formatCoordinate(position.y)}`;
}

function formatCoordinate(value: number): string {
  const text = value.toFixed(3);
  return text.replace(/\.?0+$/, '');
}
