import React, { useRef, useEffect } from "react";
import { Scene } from "../types.js";
import {
  Mic,
  Split,
  Sparkles,
  Zap,
  CheckCircle2,
  Clock,
  Music,
  Check,
  AlertCircle
} from "lucide-react";

interface ScriptPanelProps {
  script: string;
  onScriptChange: (val: string) => void;
  onSplitScript: () => void;
  onSplitClauses: () => void;
  onAiDirector: () => void;
  onAutoEdit: () => void;
  onVoiceUpload: (file: File) => void;
  onVoiceSync: () => void;
  voiceInfo: {
    name: string;
    duration: number;
    pauseCount: number;
    env?: Float32Array;
  } | null;
  voiceSyncStatus: string | null;
  isAiDirectorLoading: boolean;
  isAutoEditRunning: boolean;
  autoEditStep: number;
  autoEditStepsData: Array<{ status: "wait" | "run" | "ok" | "warn"; message: string }>;
  scenes: Scene[];
}

const STEP_LABELS = [
  "Voice & Text đầu vào",
  "Phân tích giọng nói & Câu chính phụ",
  "Tìm ảnh đa nguồn (Openverse, Wiki, Pixabay)",
  "AI Vision đối soát & Chấm điểm",
  "Duyệt ảnh vào Timeline (User Approval)",
  "Đồng bộ Timeline & Motion Graphics"
];

export const ScriptPanel: React.FC<ScriptPanelProps> = ({
  script,
  onScriptChange,
  onSplitScript,
  onSplitClauses,
  onAiDirector,
  onAutoEdit,
  onVoiceUpload,
  onVoiceSync,
  voiceInfo,
  voiceSyncStatus,
  isAiDirectorLoading,
  isAutoEditRunning,
  autoEditStep,
  autoEditStepsData,
  scenes
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const waveformRef = useRef<HTMLCanvasElement | null>(null);

  // Render audio waveform
  useEffect(() => {
    const canvas = waveformRef.current;
    if (!canvas || !voiceInfo || !voiceInfo.env) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const env = voiceInfo.env;
    const n = env.length;

    ctx.clearRect(0, 0, w, h);

    let maxVal = 0;
    for (let i = 0; i < n; i++) {
      if (env[i] > maxVal) maxVal = env[i];
    }
    maxVal = maxVal || 1;

    // Draw waveform bars
    ctx.fillStyle = "#38bdf8";
    for (let x = 0; x < w; x++) {
      const idxA = Math.floor((x * n) / w);
      const idxB = Math.max(idxA + 1, Math.floor(((x + 1) * n) / w));
      let m = 0;
      for (let k = idxA; k < idxB; k++) {
        if (env[k] > m) m = env[k];
      }
      const barH = Math.max(2, (m / maxVal) * (h * 0.88));
      ctx.fillRect(x, (h - barH) / 2, 1, barH);
    }

    // Draw scene markers if synced
    ctx.fillStyle = "#facc15";
    scenes.forEach((s, i) => {
      if (s.voice && i > 0 && voiceInfo.duration > 0) {
        const markerX = Math.round((s.voice.start / voiceInfo.duration) * w);
        ctx.fillRect(markerX - 1, 0, 2, h);
      }
    });
  }, [voiceInfo, scenes]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 text-slate-200 text-xs shadow-md">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
          <Mic className="w-4 h-4 text-violet-400" />
          Kịch bản & Lời thoại
        </h2>
        <span className="text-[11px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
          {scenes.length} phân cảnh
        </span>
      </div>

      {/* Script Textarea */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-slate-400">
          Nhập nội dung kịch bản video
        </label>
        <textarea
          rows={7}
          value={script}
          onChange={(e) => onScriptChange(e.target.value)}
          placeholder="Nhập kịch bản video tại đây..."
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 resize-y font-normal leading-relaxed text-xs"
        />
      </div>

      {/* Script Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onSplitScript}
          className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg border border-slate-700 font-medium transition cursor-pointer"
          title="Tự động chia kịch bản thành từng cảnh theo dấu chấm câu"
        >
          <Split className="w-3.5 h-3.5 text-sky-400" />
          Chia cảnh theo câu
        </button>

        <button
          onClick={onSplitClauses}
          className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg border border-slate-700 font-medium transition cursor-pointer"
          title="Tự động bóc tách mệnh đề chính và câu phụ trong từng cảnh"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Tách câu chính/phụ
        </button>

        <button
          onClick={onAiDirector}
          disabled={isAiDirectorLoading}
          className="col-span-2 flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-violet-600/30 to-indigo-600/30 hover:from-violet-600/40 hover:to-indigo-600/40 text-violet-300 hover:text-white border border-violet-500/40 rounded-lg font-semibold transition disabled:opacity-50 cursor-pointer"
          title="AI Director tự động lên phân cảnh, headline, từ khoá và template"
        >
          {isAiDirectorLoading ? (
            <>
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>AI Director đang phân cảnh...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>Tạo phân cảnh bằng AI Director</span>
            </>
          )}
        </button>
      </div>

      {/* Voice Audio Section */}
      <div className="border-t border-slate-800 pt-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
            <Music className="w-3.5 h-3.5 text-violet-400" />
            File thu âm Voice (MP3 / WAV)
          </label>
          {voiceInfo && (
            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
              <Check className="w-3 h-3" /> {voiceInfo.duration.toFixed(1)}s
            </span>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onVoiceUpload(file);
          }}
          className="hidden"
        />

        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 font-medium transition text-left truncate cursor-pointer"
          >
            {voiceInfo ? voiceInfo.name : "Chọn file voice tải lên..."}
          </button>
          {voiceInfo && (
            <button
              onClick={onVoiceSync}
              className="py-1.5 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium transition whitespace-nowrap cursor-pointer shadow-sm shadow-sky-600/20"
              title="Khớp mốc thời gian các cảnh theo khoảng lặng của giọng đọc"
            >
              Khớp Voice
            </button>
          )}
        </div>

        {/* Waveform Canvas */}
        {voiceInfo && (
          <div className="flex flex-col gap-1">
            <canvas
              ref={waveformRef}
              width={480}
              height={56}
              className="w-full h-11 bg-slate-950 border border-slate-800 rounded-lg"
            />
            <p className="text-[10px] text-slate-400">
              {voiceInfo.pauseCount} khoảng lặng phát hiện. Vạch vàng là ranh giới cảnh.
            </p>
          </div>
        )}

        {voiceSyncStatus && (
          <p className="text-[11px] text-sky-300 bg-sky-950/40 border border-sky-800/40 rounded p-1.5 leading-snug">
            {voiceSyncStatus}
          </p>
        )}
      </div>

      {/* Auto Edit Master Button */}
      <div className="border-t border-slate-800 pt-3 flex flex-col gap-2">
        <button
          onClick={onAutoEdit}
          disabled={isAutoEditRunning}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-600 hover:from-violet-500 hover:via-indigo-500 hover:to-sky-500 text-white font-bold rounded-xl shadow-lg shadow-violet-600/25 transition disabled:opacity-50 cursor-pointer"
        >
          {isAutoEditRunning ? (
            <>
              <Zap className="w-4 h-4 animate-spin text-amber-300" />
              <span>Đang xử lý Auto Edit...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
              <span>AUTO EDIT TOÀN BỘ DỰ ÁN</span>
            </>
          )}
        </button>

        {/* Multi-Step Pipeline Tracker */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-2">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Tiến trình Auto Edit:
          </p>
          <div className="flex flex-col gap-1.5">
            {STEP_LABELS.map((label, idx) => {
              const stepData = autoEditStepsData[idx] || { status: "wait", message: "" };
              const isCurrent = isAutoEditRunning && autoEditStep === idx;

              return (
                <div key={idx} className="flex items-start gap-2 text-[11px]">
                  <div className="mt-0.5">
                    {stepData.status === "ok" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : stepData.status === "run" || isCurrent ? (
                      <Sparkles className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                    ) : stepData.status === "warn" ? (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-300 font-medium flex items-center gap-1.5">
                      {label}
                    </div>
                    {stepData.message && (
                      <p className="text-[10px] text-slate-400 truncate">
                        {stepData.message}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
