import React, { useState } from "react";
import { X, Key, CheckCircle, Shield, Globe, ExternalLink } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixabayKey: string;
  onSavePixabayKey: (key: string) => void;
  serverConfig?: {
    pixabayConfigured: boolean;
    openverseMode: string;
    providers: Array<{ id: string; name: string; status: string; mode: string }>;
    gemini: { provider: string; model: string; configured: boolean };
  } | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  pixabayKey,
  onSavePixabayKey,
  serverConfig
}) => {
  const [localKey, setLocalKey] = useState(pixabayKey);
  const [savedMsg, setSavedMsg] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSavePixabayKey(localKey.trim());
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 flex flex-col gap-4 text-slate-200 text-xs shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-bold text-white">
              Cài đặt Nguồn ảnh &amp; AI Provider
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* AI Provider Status */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
          <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            AI Provider (Tái sử dụng Gemini sẵn có)
          </span>
          <p className="text-[10px] text-slate-400">
            Hệ thống tự động sử dụng model{" "}
            <span className="text-violet-300 font-semibold font-mono">
              {serverConfig?.gemini?.model || "gemini-3.8-flash"}
            </span>{" "}
            thông qua API Key server-side hiện có. Hỗ trợ đa phương thức AI Vision (đọc ảnh, đối soát ngữ cảnh và phân tách mệnh đề câu thoại).
          </p>
        </div>

        {/* Provider Status Grid */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold text-slate-300">
            Trạng thái các nguồn tìm kiếm ảnh miễn phí:
          </span>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">Openverse</span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded">
                  Miễn phí
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Chế độ tự động (Anonymous-first). Creative Commons.
              </p>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">Wikimedia Commons</span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded">
                  Public API
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Kho tư liệu mở lớn nhất thế giới, đầy đủ bản quyền.
              </p>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">Google Images</span>
                <span className="text-[9px] bg-sky-500/20 text-sky-400 font-bold px-1.5 py-0.5 rounded">
                  Thủ công
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Dự phòng tìm kiếm thủ công &amp; tải ảnh lên an toàn.
              </p>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">Pixabay</span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    serverConfig?.pixabayConfigured || pixabayKey
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {serverConfig?.pixabayConfigured || pixabayKey ? "Đã bật" : "Cần API Key"}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Giới hạn 100 req/60s, lưu cache 24h.
              </p>
            </div>
          </div>
        </div>

        {/* Pixabay API Key input */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              Pixabay API Key (Tuỳ chọn)
            </label>
            <a
              href="https://pixabay.com/api/docs/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
            >
              Lấy key miễn phí <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
          <p className="text-[10px] text-slate-400">
            Nếu chưa cấu hình, ứng dụng vẫn hoạt động bình thường với Openverse, Wikimedia và Google Images.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={localKey}
              onChange={(e) => setLocalKey(e.target.value)}
              placeholder="Nhập Pixabay API Key (nếu có)..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-violet-500 font-mono"
            />
            <button
              onClick={handleSave}
              className="py-1.5 px-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              Lưu Key
            </button>
          </div>
          {savedMsg && (
            <p className="text-[10px] text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Đã lưu cấu hình an toàn cho phiên làm việc.
            </p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="py-1.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
