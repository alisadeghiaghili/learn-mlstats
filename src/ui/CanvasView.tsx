/**
 * SVG host for pure scene graphs.
 */

import type { SceneFrame, SceneNode } from "../engine/types.js";
import { FRAME_H, FRAME_W } from "../engine/scene.js";

/** Props for the canvas host. */
interface CanvasProps {
  /** Scene frames to draw (top layer first). */
  scenes: SceneFrame[];
}

/**
 * Render scene frames as stacked SVG panels.
 *
 * @param props - Canvas props.
 * @returns React element.
 */
export function CanvasView({ scenes }: CanvasProps) {
  if (scenes.length === 0) {
    return (
      <div className="canvas-empty">
        <h2>Sandbox</h2>
        <p>
          Type a command on the left — <code>describe</code>, <code>hist</code>,{" "}
          <code>sample 30</code>, <code>levels</code>. Plots appear here as the
          analysis state changes.
        </p>
      </div>
    );
  }
  return (
    <>
      {scenes.map((frame, i) => (
        <ScenePanel key={`${frame.plot.kind}-${i}`} frame={frame} />
      ))}
    </>
  );
}

function ScenePanel({ frame }: { frame: SceneFrame }) {
  return (
    <div className="scene">
      <svg viewBox={`0 0 ${FRAME_W} ${FRAME_H}`} role="img" aria-label={frame.caption}>
        <rect x={0} y={0} width={FRAME_W} height={FRAME_H} fill="#fffdf8" />
        {frame.nodes.map((node, i) => (
          <NodeView key={i} node={node} />
        ))}
      </svg>
      <div className="caption">{frame.caption}</div>
    </div>
  );
}

function NodeView({ node }: { node: SceneNode }) {
  switch (node.kind) {
    case "rect":
      return (
        <rect
          x={node.x}
          y={node.y}
          width={node.w}
          height={node.h}
          fill={node.fill}
          opacity={node.opacity ?? 1}
        />
      );
    case "circle":
      return (
        <circle
          cx={node.x}
          cy={node.y}
          r={node.r}
          fill={node.fill}
          opacity={node.opacity ?? 1}
        />
      );
    case "line":
      return (
        <line
          x1={node.x1}
          y1={node.y1}
          x2={node.x2}
          y2={node.y2}
          stroke={node.stroke}
          strokeWidth={node.strokeWidth ?? 1}
          strokeDasharray={node.dash}
        />
      );
    case "path":
      return (
        <path
          d={node.d}
          stroke={node.stroke}
          fill={node.fill ?? "none"}
          strokeWidth={node.strokeWidth ?? 1}
        />
      );
    case "text":
      return (
        <text
          x={node.x}
          y={node.y}
          fill={node.fill}
          fontSize={node.size ?? 12}
          textAnchor={node.anchor ?? "start"}
          dominantBaseline="central"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {node.text}
        </text>
      );
    default:
      return null;
  }
}
