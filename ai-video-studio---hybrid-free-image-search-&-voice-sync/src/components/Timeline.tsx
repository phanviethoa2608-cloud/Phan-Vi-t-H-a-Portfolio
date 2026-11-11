import React from "react";
import { Scene } from "../types.js";
import { Check, Clock, ImageIcon } from "lucide-react";

interface TimelineProps {
  scenes: Scene[];
  selectedSceneIndex: number;
  onSelectScene: (index: number) => void;
  currentFrame: number;
  onSeekFrame: (frame: number) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  scenes,
  selectedSceneIndex,
  onSelectScene,
  currentFrame,
  onSeekFrame
}) => {
  const FPS = 30;
  const totalFrames = scenes.reduce((sum, s) => sum + s.durationInFrames, 0) || 1;

  // Calculate start frame of each scene
  const sceneStartFrames = scenes.reduce<number[]>((acc, s, idx) => {
    if (idx === 0) return [0];
    return [...acc, acc[idx - 1] + scenes[idx - 1].durationInFrames];
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 shadow-md">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-bold text-white flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-violet-400" />
          Timeline phân cảnh &amp; Visual Sync
        </span>
        <span className="text-[11px] font-mono text-slate-400">
          {(totalFrames / FPS).toFixed(1)} giây tổng thời lượng
        </span>
      </div>

      {/* Timeline track */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 pt-1 min-h-[72px]">
        {scenes.map((scene, idx) => {
          const isSelected = idx === selectedSceneIndex;
          const durSec = (scene.durationInFrames / FPS).toFixed(1);
          const hasVisual = !!scene.visual;
          const isApproved = scene.visual?.approved;
          const startFrame = sceneStartFrames[idx] || 0;

          return (
            <button
              key={scene.id}
              onClick={() => {
                onSelectScene(idx);
                onSeekFrame(startFrame);
              }}
              style={{
                flexGrow: scene.durationInFrames,
                minWidth: "120px",
                borderBottomColor: scene.accent || "#7c3aed"
              }}
              className={`relative text-left p-2 rounded-lg border-2 border-b-4 transition flex flex-col justify-between group cursor-pointer ${
                isSelected
                  ? "bg-slate-800/90 border-violet-500 shadow-md"
                  : "bg-slate-950 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between gap-1 w-full">
                <span className="font-bold text-[11px] text-white truncate max-w-[90px]">
                  {idx + 1}. {scene.title}
                </span>

                {/* Visual Status Indicator */}
                {hasVisual ? (
                  <div
                    className={`flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded ${
                      isApproved
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}
                    title={isApproved ? "Đã duyệt ảnh" : "Chưa duyệt ảnh"}
                  >
                    <ImageIcon className="w-2.5 h-2.5" />
                    {isApproved ? <Check className="w-2.5 h-2.5" /> : "!"}
                  </div>
                ) : null}
              </div>

              <span className="text-[10px] text-slate-400 line-clamp-1 my-1">
                {scene.text}
              </span>

              {/* Keyword mini bars */}
              <div className="relative h-1.5 w-full bg-slate-850 rounded overflow-hidden mt-1">
                {(scene.keywords || []).map((k, kIdx) => {
                  const leftPct = (k.start * FPS / scene.durationInFrames) * 100;
                  const widthPct = Math.max(4, ((k.end - k.start) * FPS / scene.durationInFrames) * 100);
                  const barColor =
                    k.style === "editorial"
                      ? "#facc15"
                      : k.style === "ocean"
                      ? "#38bdf8"
                      : k.style === "number"
                      ? "#34d399"
                      : "#c084fc";

                  return (
                    <span
                      key={kIdx}
                      style={{
                        left: `${clamp(leftPct, 0, 96)}%`,
                        width: `${clamp(widthPct, 2, 100)}%`,
                        backgroundColor: barColor
                      }}
                      className="absolute top-0 bottom-0 rounded-full opacity-80"
                      title={`${k.text} (${k.style})`}
                    />
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[9px] text-slate-500 mt-1 font-mono">
                <span>{(startFrame / FPS).toFixed(1)}s</span>
                <span>{durSec}s</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
