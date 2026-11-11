import React from "react";
import { Scene, SceneTemplate, HighlightStyle, ClauseSegment } from "../types.js";
import {
  Type,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  Palette
} from "lucide-react";

interface SceneEditorProps {
  scene: Scene;
  sceneIndex: number;
  totalScenes: number;
  onUpdateScene: (updated: Partial<Scene>) => void;
  onAddScene: () => void;
  onDeleteScene: () => void;
  isVoiceLocked: boolean;
}

export const SceneEditor: React.FC<SceneEditorProps> = ({
  scene,
  sceneIndex,
  totalScenes,
  onUpdateScene,
  onAddScene,
  onDeleteScene,
  isVoiceLocked
}) => {
  const clauses = scene.clauses || [];
  const keywords = scene.keywords || [];
  const headline = scene.headline || { small: "", main: "", tag: "" };

  const handleUpdateClause = (clauseIndex: number, updatedClause: Partial<ClauseSegment>) => {
    const updated = [...clauses];
    updated[clauseIndex] = { ...updated[clauseIndex], ...updatedClause };
    onUpdateScene({ clauses: updated });
  };

  const handleAddKeyword = () => {
    const firstWord = (scene.text.split(/\s+/)[0] || "Từ khoá").replace(/[.,!?;:]+$/, "");
    const durSec = scene.durationInFrames / 30;
    const newKw = {
      id: `kw-${Date.now().toString(36)}`,
      text: firstWord,
      style: "editorial" as HighlightStyle,
      start: 0.5,
      end: Number(Math.min(durSec - 0.2, 2.5).toFixed(1)),
      est: false
    };
    onUpdateScene({ keywords: [...keywords, newKw] });
  };

  const handleUpdateKeyword = (kwIndex: number, patch: Partial<Scene["keywords"][0]>) => {
    const updated = [...keywords];
    updated[kwIndex] = { ...updated[kwIndex], ...patch, est: false };
    onUpdateScene({ keywords: updated });
  };

  const handleDeleteKeyword = (kwIndex: number) => {
    const updated = keywords.filter((_, i) => i !== kwIndex);
    onUpdateScene({ keywords: updated });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 text-slate-200 text-xs shadow-md">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
          <Type className="w-4 h-4 text-violet-400" />
          Cảnh #{sceneIndex + 1}: {scene.title}
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onAddScene}
            disabled={isVoiceLocked}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-40"
            title={isVoiceLocked ? "Đã khoá voice. Khớp lại voice nếu đổi cấu trúc." : "Thêm cảnh mới"}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDeleteScene}
            disabled={isVoiceLocked || totalScenes <= 1}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 transition disabled:opacity-40"
            title="Xoá cảnh này"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Basic Properties */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-[11px] text-slate-400">
          Tiêu đề phân cảnh
          <input
            type="text"
            value={scene.title}
            onChange={(e) => onUpdateScene({ title: e.target.value })}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-violet-500 text-xs"
          />
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-slate-400">
          Template chuyển động
          <select
            value={scene.template}
            onChange={(e) => onUpdateScene({ template: e.target.value as SceneTemplate })}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-violet-500 text-xs"
          >
            <option value="kinetic-title">Kinetic Title (Chữ động)</option>
            <option value="feature-card">Feature Card (Thẻ nổi)</option>
            <option value="quote">Quote (Trích dẫn)</option>
            <option value="end-card">End Card (Kết thúc)</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-slate-400">
          Thời lượng (giây) {isVoiceLocked && <span className="text-amber-400">(Khớp voice)</span>}
          <input
            type="number"
            min={1}
            max={30}
            step={0.5}
            disabled={isVoiceLocked}
            value={(scene.durationInFrames / 30).toFixed(1)}
            onChange={(e) => {
              const frames = Math.max(30, Math.round(Number(e.target.value) * 30));
              onUpdateScene({ durationInFrames: frames });
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-violet-500 text-xs disabled:opacity-50"
          />
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-slate-400">
          Màu nhấn (Accent)
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={scene.accent}
              onChange={(e) => onUpdateScene({ accent: e.target.value })}
              className="w-8 h-8 rounded border border-slate-800 bg-slate-950 cursor-pointer p-0.5"
            />
            <span className="font-mono text-xs text-slate-300">{scene.accent}</span>
          </div>
        </label>
      </div>

      {/* Scene Text & Narration */}
      <label className="flex flex-col gap-1 text-[11px] text-slate-400">
        Chữ hiển thị trên màn hình
        <textarea
          rows={2}
          value={scene.text}
          onChange={(e) => onUpdateScene({ text: e.target.value })}
          className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-violet-500 text-xs"
        />
      </label>

      {/* Editorial Headline */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 flex flex-col gap-2">
        <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
          <Palette className="w-3.5 h-3.5 text-indigo-400" />
          Tiêu đề đồ họa (LuanCut Editorial)
        </span>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-0.5 text-[10px] text-slate-400">
            Dòng dẫn nhỏ (Small lead-in)
            <input
              type="text"
              value={headline.small}
              onChange={(e) => onUpdateScene({ headline: { ...headline, small: e.target.value } })}
              placeholder="VD: BÍ QUYẾT"
              className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:border-violet-500"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[10px] text-slate-400">
            Nhãn phân loại (Tag)
            <input
              type="text"
              value={headline.tag}
              onChange={(e) => onUpdateScene({ headline: { ...headline, tag: e.target.value } })}
              placeholder="VD: HIỆU SUẤT"
              className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:border-violet-500"
            />
          </label>
          <label className="col-span-2 flex flex-col gap-0.5 text-[10px] text-slate-400">
            Từ khoá lớn nổi bật (Main Headline Serif Italic)
            <input
              type="text"
              value={headline.main}
              onChange={(e) => onUpdateScene({ headline: { ...headline, main: e.target.value } })}
              placeholder="VD: Gấp đôi năng suất"
              className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:border-violet-500 font-semibold"
            />
          </label>
        </div>
      </div>

      {/* Vietnamese Main Clause vs Subordinate Clause Segmentation Section */}
      <div className="bg-slate-950/80 border border-violet-900/30 rounded-lg p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-violet-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-violet-400" />
            Phân tách câu chính &amp; câu phụ
          </span>
          <select
            value={scene.clauseDisplayMode || "two-tier"}
            onChange={(e) =>
              onUpdateScene({ clauseDisplayMode: e.target.value as Scene["clauseDisplayMode"] })
            }
            className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-[11px] text-slate-300 focus:outline-none focus:border-violet-500 cursor-pointer"
            title="Cách hiển thị câu chính phụ trên canvas"
          >
            <option value="two-tier">Phân cấp 2 tầng (Khuyên dùng)</option>
            <option value="inline">Trên 1 dòng nối tiếp</option>
            <option value="split">Tách đoạn rời</option>
          </select>
        </div>

        <p className="text-[10px] text-slate-400 leading-relaxed">
          Tách bạch câu chính (hành động/kết quả nổi bật) và câu phụ (dẫn dắt/thời gian/nguyên nhân) để phụ đề video rõ ràng, dễ nắm bắt nhịp điệu.
        </p>

        {clauses.length === 0 ? (
          <p className="text-[11px] text-slate-500 italic">
            Chưa phát hiện phân tách mệnh đề. Nhấn nút "Tách câu chính/phụ" ở cột trái hoặc chỉnh sửa câu có dấu phẩy.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {clauses.map((clause, idx) => {
              const isMain = clause.type === "main";
              return (
                <div
                  key={clause.id || idx}
                  className={`p-2.5 rounded-lg border flex flex-col gap-1.5 transition ${
                    isMain
                      ? "bg-amber-950/20 border-amber-500/40"
                      : "bg-sky-950/20 border-sky-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 ${
                        isMain
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                      }`}
                    >
                      {isMain ? "★ CÂU CHÍNH (MAIN)" : "↳ CÂU PHỤ (SUBORDINATE)"}
                    </span>

                    <button
                      onClick={() =>
                        handleUpdateClause(idx, { type: isMain ? "subordinate" : "main" })
                      }
                      className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                      title="Chuyển đổi kiểu mệnh đề"
                    >
                      Đổi thành {isMain ? "Câu phụ" : "Câu chính"}
                    </button>
                  </div>

                  <input
                    type="text"
                    value={clause.text}
                    onChange={(e) => handleUpdateClause(idx, { text: e.target.value })}
                    className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:border-violet-500 w-full"
                  />

                  {clause.role && (
                    <span className="text-[10px] text-slate-400">
                      Vai trò: <span className="text-slate-300">{clause.role}</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Keyword Highlights Editor */}
      <div className="border-t border-slate-800 pt-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Từ khoá nhấn mạnh ({keywords.length})
          </span>
          <button
            onClick={handleAddKeyword}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium transition cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            Thêm từ khoá
          </button>
        </div>

        {keywords.length === 0 ? (
          <p className="text-[11px] text-slate-500 italic">
            Chưa có từ khoá nhấn mạnh trong cảnh này.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {keywords.map((kw, idx) => (
              <div
                key={kw.id || idx}
                className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-2 text-[11px]"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={kw.text}
                    onChange={(e) => handleUpdateKeyword(idx, { text: e.target.value })}
                    placeholder="Từ khoá..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:border-violet-500"
                  />
                  <select
                    value={kw.style}
                    onChange={(e) =>
                      handleUpdateKeyword(idx, { style: e.target.value as HighlightStyle })
                    }
                    className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300 text-xs cursor-pointer"
                  >
                    <option value="editorial">Editorial (Highlight vàng)</option>
                    <option value="ocean">Ocean (Gạch chân xanh)</option>
                    <option value="number">Number (Số đếm pill)</option>
                    <option value="glass">Glass (Thẻ kính mờ)</option>
                  </select>
                  <button
                    onClick={() => handleDeleteKeyword(idx)}
                    className="p-1 hover:text-rose-400 text-slate-500 transition cursor-pointer"
                    title="Xoá từ khoá"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <label className="flex items-center gap-1">
                    Bắt đầu:
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      value={kw.start}
                      onChange={(e) =>
                        handleUpdateKeyword(idx, { start: Math.max(0, Number(e.target.value)) })
                      }
                      className="w-14 bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-slate-200 text-right"
                    />
                    s
                  </label>
                  <label className="flex items-center gap-1">
                    Kết thúc:
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      value={kw.end}
                      onChange={(e) =>
                        handleUpdateKeyword(idx, { end: Math.max(0, Number(e.target.value)) })
                      }
                      className="w-14 bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-slate-200 text-right"
                    />
                    s
                  </label>
                  {kw.est && (
                    <span className="text-amber-400/80 italic ml-auto">
                      Ước lượng theo nhịp nói
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
