import React from "react";
import { AspectRatio, VideoStyle } from "../types.js";
import {
  Film,
  Download,
  FileJson,
  Settings,
  Sparkles,
  Smartphone,
  Tv
} from "lucide-react";

interface HeaderProps {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  style: VideoStyle;
  onStyleChange: (style: VideoStyle) => void;
  aspect: AspectRatio;
  onAspectChange: (aspect: AspectRatio) => void;
  onExportWebM: () => void;
  onExportJson: () => void;
  onOpenSettings: () => void;
  isExporting: boolean;
  exportProgress: number;
}

export const Header: React.FC<HeaderProps> = ({
  projectName,
  onProjectNameChange,
  style,
  onStyleChange,
  aspect,
  onAspectChange,
  onExportWebM,
  onExportJson,
  onOpenSettings,
  isExporting,
  exportProgress
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-md">
      {/* Brand & Project Name */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-sky-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
          <Film className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
              AI VIDEO STUDIO
              <span className="bg-violet-500/20 text-violet-300 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-violet-500/30">
                PRO V2
              </span>
            </span>
          </div>
          <input
            type="text"
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            className="text-xs bg-transparent border-b border-transparent hover:border-slate-700 focus:border-violet-500 text-slate-300 focus:text-white px-0.5 py-0.5 outline-none transition max-w-[200px] truncate"
            title="Đổi tên dự án"
          />
        </div>
      </div>

      {/* Global Controls: Style & Aspect */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {/* Aspect Ratio */}
        <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700">
          <button
            onClick={() => onAspectChange("916")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md font-medium transition ${
              aspect === "916"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Tỷ lệ 9:16 Dọc (TikTok, Shorts, Reels)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            9:16 Dọc
          </button>
          <button
            onClick={() => onAspectChange("169")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md font-medium transition ${
              aspect === "169"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Tỷ lệ 16:9 Ngang (YouTube, TV, Web)"
          >
            <Tv className="w-3.5 h-3.5" />
            16:9 Ngang
          </button>
        </div>

        {/* Video Style */}
        <select
          value={style}
          onChange={(e) => onStyleChange(e.target.value as VideoStyle)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 hover:border-slate-600 focus:outline-none focus:border-violet-500 cursor-pointer"
        >
          <option value="LUANCUT_EDITORIAL">LuanCut Editorial (Tạp chí cao cấp)</option>
          <option value="DEFAULT">Tối giản (Modern Dark Minimal)</option>
        </select>
      </div>

      {/* Action Buttons: Export & Settings */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-xs font-medium transition"
          title="Cấu hình Pixabay API Key & Nguồn ảnh"
        >
          <Settings className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Cài đặt API</span>
        </button>

        <button
          onClick={onExportJson}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-xs font-medium transition"
          title="Lưu dự án JSON"
        >
          <FileJson className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">JSON</span>
        </button>

        <button
          onClick={onExportWebM}
          disabled={isExporting}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md shadow-violet-600/25 transition cursor-pointer"
        >
          {isExporting ? (
            <>
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>Xuất {exportProgress}%</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Video WebM</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
