import React, { useRef, useEffect, useState, useCallback } from "react";
import { Scene, AspectRatio, VideoStyle } from "../types.js";
import { Play, Pause, RotateCcw, ShieldCheck, Eye, EyeOff } from "lucide-react";

interface StagePreviewProps {
  scenes: Scene[];
  selectedSceneIndex: number;
  onSelectScene: (index: number) => void;
  aspect: AspectRatio;
  style: VideoStyle;
  voiceAudioBuffer: AudioBuffer | null;
  currentFrame: number;
  onCurrentFrameChange: (frame: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  imageBitmaps: Record<string, ImageBitmap>;
}

const FPS = 30;
const FONT = '"Be Vietnam Pro", system-ui, sans-serif';
const SERIF = '"Playfair Display", Georgia, serif';
const LC = {
  ocean: "#1170D0",
  deep: "#0A3D78",
  sky: "#BFDDF7",
  ice: "#EEF6FD",
  ink: "#0B2545",
  paper: "#EFE7D4",
  mark: "#F7DC6B"
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export const StagePreview: React.FC<StagePreviewProps> = ({
  scenes,
  selectedSceneIndex,
  onSelectScene,
  aspect,
  style,
  voiceAudioBuffer,
  currentFrame,
  onCurrentFrameChange,
  isPlaying,
  onTogglePlay,
  imageBitmaps
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const lastTimeRef = useRef<number>(0);
  const [showGuides, setShowGuides] = useState(false);

  const isLandscape = aspect === "169";
  const W = isLandscape ? 960 : 540;
  const H = isLandscape ? 540 : 960;

  const totalFrames = scenes.reduce((sum, s) => sum + s.durationInFrames, 0) || 1;

  // Find active scene and offset frame
  const getSceneAtFrame = useCallback(
    (frame: number): [number, number] => {
      let accumulated = 0;
      for (let i = 0; i < scenes.length; i++) {
        const dur = scenes[i].durationInFrames;
        if (frame < accumulated + dur) {
          return [i, frame - accumulated];
        }
        accumulated += dur;
      }
      const last = Math.max(0, scenes.length - 1);
      return [last, (scenes[last]?.durationInFrames || 1) - 1];
    },
    [scenes]
  );

  // Web Audio playback sync
  const stopAudio = useCallback(() => {
    try {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
      }
    } catch {
      // ignore
    }
  }, []);

  const startAudio = useCallback(
    (startSecond: number) => {
      stopAudio();
      if (!voiceAudioBuffer) return;

      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        }
        const ctx = audioContextRef.current;
        if (ctx.state === "suspended") {
          ctx.resume();
        }

        const source = ctx.createBufferSource();
        source.buffer = voiceAudioBuffer;
        source.connect(ctx.destination);

        const safeOffset = Math.min(
          startSecond,
          Math.max(0, voiceAudioBuffer.duration - 0.05)
        );
        source.start(0, safeOffset);
        audioSourceRef.current = source;
      } catch (e) {
        console.warn("Audio sync start error:", e);
      }
    },
    [voiceAudioBuffer, stopAudio]
  );

  const currentFrameRef = useRef<number>(currentFrame);
  useEffect(() => {
    currentFrameRef.current = currentFrame;
  }, [currentFrame]);

  // Animation frame loop
  useEffect(() => {
    if (!isPlaying) {
      stopAudio();
      return;
    }

    lastTimeRef.current = performance.now();
    startAudio(currentFrameRef.current / FPS);

    let animationFrameId: number;

    const loop = (now: number) => {
      const deltaSec = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      currentFrameRef.current += deltaSec * FPS;
      const nextFrame = currentFrameRef.current;

      if (nextFrame >= totalFrames) {
        onCurrentFrameChange(0);
        onTogglePlay();
        stopAudio();
        return;
      }

      onCurrentFrameChange(nextFrame);
      const [sceneIdx] = getSceneAtFrame(Math.floor(nextFrame));
      if (sceneIdx !== selectedSceneIndex) {
        onSelectScene(sceneIdx);
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      stopAudio();
    };
  }, [isPlaying]);

  // Main Canvas Render
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const [sceneIdx, frameOffset] = getSceneAtFrame(Math.floor(currentFrame));
    const scene = scenes[sceneIdx];
    if (!scene) return;

    ctx.clearRect(0, 0, W, H);

    // Helpers
    const wrap = (t: string, maxW: number) => {
      const words = t.split(/\s+/);
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const next = cur ? `${cur} ${w}` : w;
        if (ctx.measureText(next).width > maxW && cur) {
          lines.push(cur);
          cur = w;
        } else {
          cur = next;
        }
      }
      if (cur) lines.push(cur);
      return lines;
    };

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
    };

    const dot = (x: number, y: number, r: number) => {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0, r), 0, 2 * Math.PI);
      ctx.fill();
    };

    // Zones for layout
    const zones = isLandscape
      ? {
          a: { x: 36, y: 36, w: W * 0.36, h: H - 72 }, // Headline
          b: { x: W * 0.40, y: 36, w: W * 0.54, h: H * 0.65 }, // Visual window
          c: { x: W * 0.40, y: H * 0.72, w: W * 0.54, h: H * 0.22 }, // Caption
          d: { x: 0, y: H * 0.94, w: W, h: H * 0.06 }
        }
      : {
          a: { x: 36, y: H * 0.06, w: W - 72, h: H * 0.28 }, // Headline
          b: { x: 36, y: H * 0.34, w: W - 72, h: H * 0.34 }, // Visual window
          c: { x: 36, y: H * 0.70, w: W - 72, h: H * 0.18 }, // Caption
          d: { x: 0, y: H * 0.88, w: W, h: H * 0.12 } // Safe UI area
        };

    // 1. Visual Window with Ken Burns motion (Only renders if visual is approved!)
    const drawVisualWindow = (z: typeof zones.b) => {
      const visual = scene.visual;
      const bitmap = imageBitmaps[scene.id];

      // Gate: Must be approved by user to show in timeline
      if (!visual || !visual.approved || !bitmap) {
        return;
      }

      const dur = scene.durationInFrames;
      const progress = clamp(frameOffset / dur, 0, 1);
      const enterAlpha = isPlaying ? Math.max(0.3, ease(clamp(frameOffset / 14, 0, 1))) : 1;
      // Ken Burns subtle zoom and pan
      const zoom = 1 + 0.08 * progress;
      const panY = Math.sin(progress * Math.PI) * 8;

      ctx.save();
      ctx.globalAlpha = enterAlpha;

      // Card shadow & frame
      ctx.shadowColor = "rgba(11, 37, 69, 0.28)";
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 10;
      ctx.fillStyle = "#ffffff";
      roundRect(z.x, z.y, z.w, z.h, 20);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Clip image inside card
      roundRect(z.x, z.y, z.w, z.h, 20);
      ctx.clip();

      const scale = Math.max(z.w / bitmap.width, z.h / bitmap.height) * zoom;
      const imgW = bitmap.width * scale;
      const imgH = bitmap.height * scale;
      const drawX = z.x + (z.w - imgW) / 2;
      const drawY = z.y + (z.h - imgH) / 2 + panY;

      ctx.drawImage(bitmap, drawX, drawY, imgW, imgH);

      // Attribution water-pill at bottom right
      if (visual.creator) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        roundRect(z.x + z.w - 150, z.y + z.h - 26, 142, 20, 6);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.font = "600 10px " + FONT;
        ctx.textAlign = "right";
        ctx.fillText(`© ${visual.creator.slice(0, 18)}`, z.x + z.w - 12, z.y + z.h - 12);
      }

      ctx.restore();
    };

    // 2. Headline with Serif Italic (Playfair Display)
    const drawHeadline = (z: typeof zones.a) => {
      const hd = scene.headline || { small: scene.title, main: "", tag: "" };
      const enter = isPlaying ? Math.max(0.3, ease(clamp(frameOffset / 16, 0, 1))) : 1;
      let y = z.y + (1 - enter) * 20;

      ctx.save();
      ctx.globalAlpha = enter;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      // Small lead-in
      if (hd.small) {
        ctx.font = "800 13px " + FONT;
        ctx.fillStyle = style === "DEFAULT" ? scene.accent : LC.ink;
        ctx.fillText(hd.small.toUpperCase(), z.x, y + 14);
        y += 28;
      }

      // Main big headline
      if (hd.main) {
        let fontSize = isLandscape ? 48 : 56;
        let lines: string[] = [];

        for (;;) {
          ctx.font = `italic 700 ${fontSize}px ${SERIF}`;
          lines = wrap(hd.main, z.w);
          if ((lines.length <= 2 && Math.max(...lines.map(l => ctx.measureText(l).width)) <= z.w) || fontSize <= 24) {
            break;
          }
          fontSize -= 2;
        }

        ctx.fillStyle = style === "DEFAULT" ? "#ffffff" : LC.ocean;
        lines.forEach((line, i) => {
          ctx.fillText(line, z.x, y + fontSize * 0.9 + i * fontSize * 1.08);
        });
        y += lines.length * fontSize * 1.08 + 10;
      }

      // Tag pill
      if (hd.tag) {
        ctx.font = "800 12px " + FONT;
        const tagText = hd.tag.toUpperCase();
        const tagW = Math.min(z.w, ctx.measureText(tagText).width + 24);
        ctx.fillStyle = scene.accent || LC.ocean;
        roundRect(z.x, y, tagW, 26, 6);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "middle";
        ctx.fillText(tagText, z.x + 12, y + 13);
      }

      ctx.restore();
    };

    // 3. Keyword Highlighting Logic
    const drawKeywordHighlight = (
      kw: Scene["keywords"][0],
      x: number,
      y: number,
      w: number,
      h: number,
      timeSec: number
    ) => {
      if (timeSec < kw.start || timeSec > kw.end + 0.3) return;

      ctx.save();
      const fadeOut = clamp((kw.end + 0.3 - timeSec) / 0.25, 0, 1);
      ctx.globalAlpha *= fadeOut;
      const enter = ease(clamp((timeSec - kw.start) / 0.38, 0, 1));

      if (kw.style === "editorial") {
        // LuanCut yellow marker with black framing tick marks
        ctx.fillStyle = LC.mark;
        ctx.fillRect(x, y + h * 0.12, w * enter, h * 0.78);

        const barEnter = ease(clamp((timeSec - kw.start - 0.2) / 0.18, 0, 1));
        const barH = h * 0.84 * barEnter;
        const barY = y + h * 0.08 + (h * 0.84 - barH) / 2;

        ctx.fillStyle = "#000000";
        ctx.fillRect(x - 1, barY, 2.5, barH);
        ctx.fillRect(x + w - 1.5, barY, 2.5, barH);
        dot(x - 1, y + h * 0.08 - 1, 3 * barEnter);
        dot(x + w + 1, y + h * 0.92 + 1, 3 * barEnter);
      } else if (kw.style === "ocean") {
        // Ocean underline
        ctx.fillStyle = LC.ocean;
        ctx.fillRect(x + 4, y + h - 2, (w - 8) * enter, 3);
      } else if (kw.style === "number") {
        // Sky pill
        ctx.globalAlpha *= enter;
        ctx.fillStyle = LC.sky;
        roundRect(x, y, w, h, 8);
        ctx.fill();
      } else if (kw.style === "glass") {
        // Frosted glass card
        ctx.globalAlpha *= enter;
        ctx.shadowColor = "rgba(11, 37, 69, 0.25)";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        roundRect(x, y, w, h, 8);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    };

    // 4. Caption & Clause Segmentation Renderer
    const drawCaption = (z: typeof zones.c) => {
      const text = scene.text || "";
      const timeSec = frameOffset / FPS;
      const clauses = scene.clauses || [];

      ctx.save();
      const enter = isPlaying ? Math.max(0.3, ease(clamp(frameOffset / 14, 0, 1))) : 1;
      ctx.globalAlpha = enter;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      // If we have distinct clauses and 2-tier display mode is selected:
      if (clauses.length >= 2 && scene.clauseDisplayMode === "two-tier") {
        const subClause = clauses.find(c => c.type === "subordinate") || clauses[0];
        const mainClause = clauses.find(c => c.type === "main") || clauses[1];

        let curY = z.y + 14;

        // Subordinate clause (upper tier, muted/lead-in)
        if (subClause) {
          ctx.font = "600 16px " + FONT;
          ctx.fillStyle = style === "DEFAULT" ? "#94a3b8" : LC.deep;
          const subLines = wrap(subClause.text, z.w);
          subLines.forEach(l => {
            ctx.fillText(l, z.x, curY);
            curY += 24;
          });
          curY += 6;
        }

        // Main clause (lower tier, bold, editorial font)
        if (mainClause) {
          let mainFontSize = isLandscape ? 24 : 26;
          ctx.font = `italic 700 ${mainFontSize}px ${SERIF}`;
          const mainLines = wrap(mainClause.text, z.w);

          mainLines.forEach(l => {
            ctx.font = `italic 700 ${mainFontSize}px ${SERIF}`;
            const lineW = ctx.measureText(l).width;
            // Draw editorial background bar on main clause
            ctx.fillStyle = LC.mark + "aa";
            ctx.fillRect(z.x, curY - mainFontSize + 6, Math.min(lineW + 8, z.w), mainFontSize);

            ctx.fillStyle = style === "DEFAULT" ? "#ffffff" : LC.ink;
            ctx.fillText(l, z.x + 4, curY);
            curY += mainFontSize * 1.3;
          });
        }

        ctx.restore();
        return;
      }

      // Inline Caption with Keyword and Clause Word Mapping
      const kws = (scene.keywords || []).map(k => {
        const idx = k.text ? text.toLowerCase().indexOf(k.text.toLowerCase()) : -1;
        return idx < 0 ? null : { ...k, startIdx: idx, endIdx: idx + k.text.length };
      }).filter(Boolean) as Array<Scene["keywords"][0] & { startIdx: number; endIdx: number }>;

      const tokens = [...text.matchAll(/\S+/g)].map(m => ({
        word: m[0],
        index: m.index || 0,
        kwIndex: kws.findIndex(k => (m.index || 0) < k.endIdx && (m.index || 0) + m[0].length > k.startIdx)
      }));

      let fs = isLandscape ? 22 : 24;
      let lines: Array<Array<{ word: string; kwIndex: number; x: number; width: number }>> = [[]];
      let lh = fs * 1.6;

      const getFont = (kwIdx: number) => {
        const styleName = kwIdx >= 0 ? kws[kwIdx].style : "";
        if (styleName === "editorial") return `italic 700 ${fs + 4}px ${SERIF}`;
        if (styleName === "number" || styleName === "ocean") return `800 ${fs}px ${FONT}`;
        return `600 ${fs}px ${FONT}`;
      };

      for (;;) {
        ctx.font = `600 ${fs}px ${FONT}`;
        const spaceW = ctx.measureText(" ").width;
        lines = [[]];
        let lineX = 0;

        tokens.forEach(tok => {
          ctx.font = getFont(tok.kwIndex);
          const w = ctx.measureText(tok.word).width;
          if (lineX + w > z.w && lines[lines.length - 1].length > 0) {
            lines.push([]);
            lineX = 0;
          }
          lines[lines.length - 1].push({
            word: tok.word,
            kwIndex: tok.kwIndex,
            x: lineX,
            width: w
          });
          lineX += w + spaceW;
        });

        lh = fs * 1.65;
        if (lines.length * lh <= z.h || fs <= 13) break;
        fs -= 1;
      }

      const y0 = z.y + Math.max(0, (z.h - lines.length * lh) / 2);

      lines.forEach((ln, li) => {
        const baselineY = y0 + li * lh + fs;

        // Draw highlights first behind text
        for (let q = 0; q < ln.length;) {
          const kIdx = ln[q].kwIndex;
          let e = q;
          while (e + 1 < ln.length && ln[e + 1].kwIndex === kIdx) e++;

          if (kIdx >= 0) {
            const kw = kws[kIdx];
            const startX = z.x + ln[q].x - 4;
            const spanW = ln[e].x + ln[e].width - ln[q].x + 8;
            drawKeywordHighlight(kw, startX, baselineY - fs - 3, spanW, fs + 10, timeSec);
          }
          q = e + 1;
        }

        // Render words
        ln.forEach(item => {
          let wordStr = item.word;
          const kw = item.kwIndex >= 0 ? kws[item.kwIndex] : null;

          // Animated number roll if applicable
          if (kw && kw.style === "number") {
            const timeSinceStart = timeSec - kw.start;
            if (timeSinceStart >= 0 && timeSinceStart < 0.8) {
              wordStr = wordStr.replace(/\d+/, n =>
                String(Math.round(Number(n) * ease(timeSinceStart / 0.8)))
              );
            }
          }

          ctx.font = getFont(item.kwIndex);
          if (style === "DEFAULT") {
            ctx.fillStyle = kw ? scene.accent : "#ffffff";
          } else {
            ctx.fillStyle =
              kw && (kw.style === "editorial" || kw.style === "ocean")
                ? LC.ocean
                : kw && kw.style === "number"
                ? LC.deep
                : LC.ink;
          }
          ctx.fillText(wordStr, z.x + item.x, baselineY);
        });
      });

      ctx.restore();
    };

    // 5. Safe Area Guides Overlay
    const drawGuides = () => {
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1.5;
      ctx.font = "600 11px " + FONT;
      ctx.textAlign = "right";

      const guideSections: Array<[keyof typeof zones, string, string]> = [
        ["a", "Đồ họa & Headline", LC.ocean],
        ["b", "Khung hình ảnh / Người nói", LC.deep],
        ["c", "Phụ đề & Mệnh đề", LC.ocean],
        ["d", "Vùng giao diện TikTok / Reels", LC.ink]
      ];

      guideSections.forEach(([key, label, col]) => {
        const r = zones[key];
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
        ctx.fillText(label, r.x + r.w - 6, r.y + 14);
      });

      ctx.restore();
    };

    // Render by Style
    if (style === "DEFAULT") {
      // Modern Dark Minimal
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, "#09090f");
      grad.addColorStop(0.55, "#17172b");
      grad.addColorStop(1, "#08080d");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Geometric accent
      ctx.strokeStyle = scene.accent + "55";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(W - 30, 280, 180, 0, 2 * Math.PI);
      ctx.stroke();

      drawVisualWindow(zones.b);
      drawHeadline(zones.a);
      drawCaption(zones.c);
    } else {
      // LuanCut Editorial (Magazine Aesthetic)
      ctx.fillStyle = LC.paper;
      ctx.fillRect(0, 0, W, H);

      // Soft blue radial glow
      const radial = ctx.createRadialGradient(
        W * 0.85,
        H * 0.08,
        0,
        W * 0.85,
        H * 0.08,
        W * 0.75
      );
      radial.addColorStop(0, LC.sky + "dd");
      radial.addColorStop(1, LC.sky + "00");
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, W, H);

      drawVisualWindow(zones.b);
      drawHeadline(zones.a);
      drawCaption(zones.c);
    }

    if (showGuides) {
      drawGuides();
    }
  }, [
    currentFrame,
    scenes,
    aspect,
    style,
    showGuides,
    W,
    H,
    isLandscape,
    getSceneAtFrame,
    imageBitmaps
  ]);

  useEffect(() => {
    renderCanvas();
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        renderCanvas();
      });
    }
  }, [renderCanvas]);

  const currentSec = (currentFrame / FPS).toFixed(1);
  const totalSec = (totalFrames / FPS).toFixed(1);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Video Canvas Stage */}
      <div
        className="relative bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 transition-all flex items-center justify-center"
        style={{
          width: isLandscape ? "min(100%, 720px)" : "min(100%, 340px)",
          aspectRatio: isLandscape ? "16/9" : "9/16"
        }}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full h-full block object-contain"
        />

        {/* Floating guide indicator */}
        {showGuides && (
          <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur text-violet-300 border border-violet-500/30 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
            <ShieldCheck className="w-3 h-3 text-violet-400" />
            Vùng an toàn đang bật
          </div>
        )}
      </div>

      {/* Playback Control Bar */}
      <div className="flex items-center gap-3 w-full max-w-[480px] bg-slate-900/90 border border-slate-800 px-4 py-2.5 rounded-xl shadow-lg backdrop-blur">
        <button
          onClick={onTogglePlay}
          className="p-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-md shadow-violet-600/30 transition cursor-pointer"
          title={isPlaying ? "Tạm dừng" : "Phát video"}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
        </button>

        <button
          onClick={() => {
            onCurrentFrameChange(0);
            stopAudio();
          }}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          title="Về đầu video"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <input
          type="range"
          min={0}
          max={Math.max(1, totalFrames - 1)}
          value={Math.floor(currentFrame)}
          onChange={(e) => {
            const frame = Number(e.target.value);
            onCurrentFrameChange(frame);
            if (isPlaying) {
              startAudio(frame / FPS);
            }
          }}
          className="flex-1 accent-violet-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          aria-label="Thanh thời gian video"
        />

        <span className="text-xs font-mono font-medium text-slate-300 tabular-nums">
          {currentSec} / {totalSec}s
        </span>

        <button
          onClick={() => setShowGuides(!showGuides)}
          className={`p-1.5 rounded-lg border text-xs transition flex items-center gap-1 ${
            showGuides
              ? "bg-violet-500/20 text-violet-300 border-violet-500/40"
              : "bg-slate-800/60 text-slate-400 border-slate-700 hover:text-white"
          }`}
          title="Hiện / ẩn khung vùng an toàn"
        >
          {showGuides ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
