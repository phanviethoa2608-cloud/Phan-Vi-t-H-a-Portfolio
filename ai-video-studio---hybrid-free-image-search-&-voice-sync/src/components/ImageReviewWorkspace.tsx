import React, { useState, useRef } from "react";
import { Scene, ImageResult, VoiceVisualAsset } from "../types.js";
import {
  Image as ImageIcon,
  Search,
  ExternalLink,
  CheckCircle,
  Copy,
  Upload,
  RefreshCw,
  Sparkles,
  Info,
  Layers,
  FileCheck,
  Check
} from "lucide-react";

interface ImageReviewWorkspaceProps {
  scene: Scene;
  sceneIndex: number;
  onUpdateScene: (updated: Partial<Scene>) => void;
  onSearchImages: (query: string) => Promise<void>;
  onVerifyWithAiVision: () => Promise<void>;
  onSelectAndApproveImage: (img: ImageResult) => Promise<void>;
  onUploadImageFile: (file: File) => Promise<void>;
  isSearching: boolean;
  isVerifying: boolean;
  candidateImages: ImageResult[];
  activeBitmap?: ImageBitmap | null;
}

export const ImageReviewWorkspace: React.FC<ImageReviewWorkspaceProps> = ({
  scene,
  sceneIndex,
  onUpdateScene,
  onSearchImages,
  onVerifyWithAiVision,
  onSelectAndApproveImage,
  onUploadImageFile,
  isSearching,
  isVerifying,
  candidateImages,
  activeBitmap
}) => {
  const [customQuery, setCustomQuery] = useState("");
  const [copiedQuery, setCopiedQuery] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<ImageResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const visual = scene.visual;
  const analysis = scene.analysis;
  const queries = analysis?.queries || [];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedQuery(text);
    setTimeout(() => setCopiedQuery(null), 2000);
  };

  const getScoreBadge = (score?: number) => {
    if (score === undefined) return null;
    let colorClass = "bg-rose-500/20 text-rose-300 border-rose-500/40";
    let label = "Độ khớp yếu";
    if (score >= 90) {
      colorClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      label = "Khớp xuất sắc";
    } else if (score >= 80) {
      colorClass = "bg-sky-500/20 text-sky-300 border-sky-500/40";
      label = "Khớp rất tốt";
    } else if (score >= 70) {
      colorClass = "bg-amber-500/20 text-amber-300 border-amber-500/40";
      label = "Khá phù hợp";
    }
    return (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${colorClass}`}>
        {score}/100 · {label}
      </span>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 text-slate-200 text-xs shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
          <ImageIcon className="w-4 h-4 text-violet-400" />
          Không gian duyệt ảnh (Cảnh #{sceneIndex + 1})
        </h2>
        {visual?.approved && (
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Check className="w-3 h-3" /> Đã duyệt vào Timeline
          </span>
        )}
      </div>

      {/* Voice Segment Summary & Visual Interpretation */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            Ý đồ thị giác (Visual Intent)
          </span>
          <span className="text-[10px] text-slate-400">
            {scene.voice ? `Voice: ${scene.voice.start.toFixed(1)}s - ${scene.voice.end.toFixed(1)}s` : "Chưa gắn mốc voice"}
          </span>
        </div>

        <p className="text-slate-300 italic text-[11px] bg-slate-900/60 p-2 rounded border border-slate-800/80">
          "{scene.text}"
        </p>

        {analysis && (
          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 bg-slate-900/40 p-2 rounded border border-slate-800/60">
            <div>
              <span className="text-slate-500 font-medium">Chủ thể: </span>
              <span className="text-slate-200 font-semibold">{analysis.subject || "Chưa xác định"}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Hành động: </span>
              <span className="text-slate-200">{analysis.action || "Chưa xác định"}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Bối cảnh: </span>
              <span className="text-slate-200">{analysis.environment || "Chưa xác định"}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Ý đồ hình ảnh: </span>
              <span className="text-violet-300 font-medium">{analysis.intent || "Minh hoạ nội dung lời thoại"}</span>
            </div>
          </div>
        )}
      </div>

      {/* Search Queries & Manual Google Fallback */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
            <Search className="w-3.5 h-3.5 text-sky-400" />
            Từ khoá tìm kiếm AI sinh ra
          </span>
          <span className="text-[10px] text-slate-500">Free-First (Openverse, Wiki, Pixabay)</span>
        </div>

        {queries.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {queries.map((q, idx) => {
              const googleSearchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`;
              return (
                <div
                  key={idx}
                  className="bg-slate-950 border border-slate-800/90 rounded-lg p-2 flex items-center justify-between gap-2 text-[11px]"
                >
                  <span className="text-slate-200 font-medium truncate flex-1" title={q}>
                    {idx + 1}. {q}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onSearchImages(q)}
                      disabled={isSearching}
                      className="px-2 py-1 bg-violet-600/30 hover:bg-violet-600/50 text-violet-300 hover:text-white rounded text-[10px] font-semibold transition cursor-pointer"
                      title="Tìm ảnh tự động trên Openverse, Wikimedia và Pixabay"
                    >
                      Tìm ảnh
                    </button>
                    <button
                      onClick={() => handleCopy(q)}
                      className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition"
                      title="Sao chép từ khoá"
                    >
                      {copiedQuery === q ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <a
                      href={googleSearchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-slate-800 text-sky-400 hover:text-sky-300 rounded transition flex items-center"
                      title="Mở tìm kiếm thủ công trên Google Images (Fallback)"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 italic">
            Chưa có từ khoá tìm kiếm. Bấm "Phân tích giọng nói" hoặc nhập từ khoá dưới đây.
          </p>
        )}

        {/* Custom Query Search Box */}
        <div className="flex items-center gap-2 mt-1">
          <input
            type="text"
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && customQuery.trim()) {
                onSearchImages(customQuery);
              }
            }}
            placeholder="Nhập từ khoá tuỳ chỉnh (tiếng Việt hoặc tiếng Anh)..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
          <button
            onClick={() => customQuery.trim() && onSearchImages(customQuery)}
            disabled={isSearching || !customQuery.trim()}
            className="py-1.5 px-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
          >
            <Search className="w-3.5 h-3.5" />
            Tìm
          </button>
        </div>
      </div>

      {/* Manual Upload Fallback */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUploadImageFile(file);
          }}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-xs font-medium transition cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          Tải ảnh lên từ máy tính
        </button>

        {candidateImages.length > 0 && (
          <button
            onClick={onVerifyWithAiVision}
            disabled={isVerifying}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-sky-600/25 transition disabled:opacity-50 cursor-pointer"
            title="Sử dụng Gemini AI Vision để kiểm tra độ khớp giữa ảnh và câu thoại"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            {isVerifying ? "AI Vision đang chấm điểm..." : "AI Vision đối soát"}
          </button>
        )}
      </div>

      {/* Active Selected Visual in Scene */}
      {visual && (
        <div className="bg-slate-950 border border-violet-900/40 rounded-xl p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-violet-300 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              Ảnh được gắn với Cảnh #{sceneIndex + 1}
            </span>
            <button
              onClick={() => {
                onUpdateScene({ visual: undefined });
              }}
              className="text-[10px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
            >
              Gỡ ảnh khỏi cảnh
            </button>
          </div>

          <div className="flex gap-3">
            {activeBitmap && (
              <div className="w-24 h-24 rounded-lg overflow-hidden border border-slate-800 bg-black flex-shrink-0 shadow-inner">
                <img
                  src={visual.localAssetUrl || visual.thumbnailUrl || visual.originalUrl}
                  alt={visual.name || "Scene visual"}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0 flex flex-col gap-1 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-white truncate">
                  {visual.name || "Ảnh minh họa"}
                </span>
                {visual.relevanceScore !== undefined && getScoreBadge(visual.relevanceScore)}
              </div>

              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className="bg-slate-800 px-1.5 py-0.5 rounded uppercase font-bold text-slate-300">
                  {visual.provider}
                </span>
                <span>Tác giả: {visual.creator || "Không rõ"}</span>
              </div>

              <div className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                <FileCheck className="w-3 h-3 text-sky-400" />
                <span>{visual.license || "License not verified"}</span>
              </div>

              {visual.scoreBreakdown?.reason && (
                <p className="text-[10px] text-slate-300 italic bg-slate-900 p-1.5 rounded border border-slate-800">
                  {visual.scoreBreakdown.reason}
                </p>
              )}
            </div>
          </div>

          {/* User Approval Gate Checkbox */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={visual.approved}
                onChange={(e) => {
                  const updatedVisual: VoiceVisualAsset = {
                    ...visual,
                    approved: e.target.checked
                  };
                  onUpdateScene({ visual: updatedVisual });
                }}
                className="w-4 h-4 rounded border-slate-700 text-violet-600 focus:ring-violet-500 bg-slate-950"
              />
              Duyệt đưa ảnh vào Timeline video
            </label>
            <span className="text-[10px] text-slate-400">
              {visual.approved ? (
                <span className="text-emerald-400 font-semibold">✓ Đã duyệt</span>
              ) : (
                <span className="text-amber-400 font-semibold">! Cần người dùng duyệt</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Candidate Images Grid */}
      <div className="border-t border-slate-800 pt-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            Ảnh ứng viên ({candidateImages.length})
          </span>
          {isSearching && (
            <span className="text-[10px] text-violet-400 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" /> Đang tìm kiếm...
            </span>
          )}
        </div>

        {candidateImages.length === 0 ? (
          <div className="bg-slate-950/50 border border-dashed border-slate-800 rounded-xl p-6 text-center text-slate-500">
            <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
            <p className="text-xs">Chưa có ảnh ứng viên nào được tìm thấy.</p>
            <p className="text-[10px] text-slate-600 mt-1">
              Nhấn "Tìm ảnh" từ danh sách query phía trên hoặc tải ảnh từ máy tính.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
            {candidateImages.map((img) => {
              const isSelected = visual?.sourceUrl === img.sourcePageUrl || visual?.thumbnailUrl === img.thumbnailUrl;
              const hasScore = img.matchScore !== undefined;

              return (
                <div
                  key={img.id}
                  className={`group relative bg-slate-950 border rounded-xl overflow-hidden flex flex-col transition hover:border-violet-500/80 ${
                    isSelected ? "border-violet-500 ring-2 ring-violet-500/30" : "border-slate-800"
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-black/40 overflow-hidden">
                    <img
                      src={img.thumbnailUrl}
                      alt={img.title}
                      className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                      loading="lazy"
                    />

                    {/* Provider badge */}
                    <span className="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur text-[9px] font-bold text-white px-1.5 py-0.5 rounded uppercase">
                      {img.provider}
                    </span>

                    {/* Match Score Badge */}
                    {hasScore && (
                      <div className="absolute top-1.5 right-1.5">
                        {getScoreBadge(img.matchScore)}
                      </div>
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="p-2 flex flex-col gap-1.5 flex-1">
                    <p className="text-[11px] font-medium text-slate-200 line-clamp-1" title={img.title}>
                      {img.title}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="truncate max-w-[100px]">{img.creator || "Tác giả ẩn danh"}</span>
                      {img.width && img.height && (
                        <span>
                          {img.width}x{img.height}
                        </span>
                      )}
                    </div>

                    {img.recommendationReason && (
                      <p className="text-[9px] text-slate-300 italic line-clamp-2 bg-slate-900 p-1 rounded">
                        {img.recommendationReason}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="mt-auto pt-1 flex items-center gap-1.5">
                      <button
                        onClick={() => onSelectAndApproveImage(img)}
                        className={`flex-1 py-1 px-2 rounded text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                          isSelected
                            ? "bg-emerald-600 text-white"
                            : "bg-violet-600 hover:bg-violet-500 text-white"
                        }`}
                      >
                        {isSelected ? <Check className="w-3 h-3" /> : null}
                        {isSelected ? "Đã chọn" : "Chọn ảnh"}
                      </button>

                      <a
                        href={img.sourcePageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                        title="Xem trang nguồn gốc và giấy phép"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
