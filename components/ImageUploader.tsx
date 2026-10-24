'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Link2,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Info,
  X,
} from 'lucide-react';
import { uploadImage, getUploadConfig } from '../lib/api';

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  folder?: 'products' | 'categories' | 'general';
  label?: string;
  compact?: boolean;
  aspectRatio?: 'square' | 'icon' | 'banner';
  defaultFallbackImage?: string;
  helperText?: string;
}

export default function ImageUploader({
  value,
  onChange,
  folder = 'products',
  label = 'Product Image',
  compact = false,
  aspectRatio = 'square',
  defaultFallbackImage = '/images/products/default-product.svg',
  helperText,
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isManualUrlOpen, setIsManualUrlOpen] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showConfigHelp, setShowConfigHelp] = useState(false);
  const [cloudinaryConfig, setCloudinaryConfig] = useState<{
    isConfigured: boolean;
    cloudName?: string;
  } | null>(null);

  const [pendingLocalFile, setPendingLocalFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check Cloudinary backend config on mount
  useEffect(() => {
    let isMounted = true;
    getUploadConfig()
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setCloudinaryConfig(res.data);
        }
      })
      .catch(() => {
        // Non-blocking
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const isCloudinaryUrl =
    Boolean(value) && (value.includes('cloudinary.com') || value.includes('res.cloudinary.com'));

  const handleApplyLocalFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        onChange(reader.result);
        setLocalPreview(null);
        setPendingLocalFile(null);
        setErrorMessage(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, WEBP, SVG, GIF).');
      return;
    }

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Image size exceeds 10MB. Please choose a smaller image.');
      return;
    }

    setErrorMessage(null);
    setPendingLocalFile(null);
    setIsUploading(true);
    setUploadProgress('Preparing upload...');

    // Generate instant client-side preview
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);

    try {
      setUploadProgress('Uploading to Cloudinary CDN...');
      const res = await uploadImage(file, folder);

      if (res.success && res.data?.url) {
        onChange(res.data.url);
        setLocalPreview(null);
        setUploadProgress('');
      } else {
        const msg = res.error?.message || 'Upload failed. Check Cloudinary credentials.';
        setErrorMessage(msg);
        setPendingLocalFile(file);
        if (msg.toLowerCase().includes('cloudinary') || msg.toLowerCase().includes('not configured')) {
          setShowConfigHelp(true);
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error during upload');
      setPendingLocalFile(file);
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setLocalPreview(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCopyUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentDisplayUrl = localPreview || value || '';

  // Compact layout (for category quick-add or tight spaces)
  if (compact) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          {label && <label className="block text-xs font-semibold text-[#1C1917]">{label}</label>}
          {cloudinaryConfig?.isConfigured && (
            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Cloudinary
            </span>
          )}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
          }}
        />

        <div className="flex items-center space-x-2">
          {/* Thumbnail preview / dropzone trigger */}
          <div
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 overflow-hidden cursor-pointer transition-all ${
              isDragOver
                ? 'border-[#C2410C] bg-[#FFEDD5]'
                : currentDisplayUrl
                ? 'border-[#D6D3D1] bg-white hover:border-[#C2410C]'
                : 'border-dashed border-[#D6D3D1] bg-[#FAFAF9] hover:border-[#C2410C]'
            }`}
            title="Click to upload image via Cloudinary"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 text-[#C2410C] animate-spin" />
            ) : currentDisplayUrl ? (
              <img
                src={currentDisplayUrl}
                alt="Preview"
                className="w-full h-full object-contain p-0.5"
                onError={(e) => {
                  (e.target as any).src = defaultFallbackImage;
                }}
              />
            ) : (
              <UploadCloud className="w-4 h-4 text-[#78716C]" />
            )}
          </div>

          {/* Quick upload button & URL fallback */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="h-8.5 px-3 bg-[#FAFAF9] hover:bg-[#F5F5F4] border border-[#D6D3D1] text-[#1C1917] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C2410C]" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-3.5 h-3.5 text-[#C2410C]" />
                <span>Upload</span>
              </>
            )}
          </button>

          <input
            type="text"
            placeholder="or paste image URL"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 bg-[#FAFAF9] border border-[#D6D3D1] rounded-lg px-2.5 py-1.5 text-xs text-[#1C1917] font-mono focus:outline-none focus:border-[#C2410C] min-w-0"
          />

          {value && (
            <button
              type="button"
              onClick={handleRemove}
              className="w-8 h-8 flex items-center justify-center text-[#78716C] hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors shrink-0"
              title="Remove image"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {errorMessage && (
          <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[11px] text-amber-900 space-y-1">
            <div className="flex items-start gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span className="flex-1 leading-snug">{errorMessage}</span>
            </div>
            {pendingLocalFile && (
              <button
                type="button"
                onClick={() => handleApplyLocalFile(pendingLocalFile)}
                className="mt-1 px-2 py-1 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded text-[10px] font-semibold cursor-pointer shadow-2xs flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                <span>Use as Local Image (Demo)</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full-featured standard layout
  return (
    <div className="space-y-2">
      {/* Header with label, Cloudinary badge, and toggle */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-[#1C1917]">{label}</label>
        <div className="flex items-center gap-2">
          {cloudinaryConfig?.isConfigured ? (
            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Cloudinary Active
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setShowConfigHelp(!showConfigHelp)}
              className="text-[10px] text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Info className="w-3 h-3 text-amber-600" />
              <span>Cloudinary Setup</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsManualUrlOpen(!isManualUrlOpen)}
            className="text-[11px] text-[#C2410C] hover:text-[#9A3412] hover:underline flex items-center gap-1 font-medium"
          >
            <Link2 className="w-3 h-3" />
            <span>{isManualUrlOpen ? 'Hide URL' : 'Paste URL'}</span>
          </button>
        </div>
      </div>

      {/* Cloudinary configuration help banner if toggled or not configured */}
      {showConfigHelp && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-2 animate-fadeIn relative">
          <button
            type="button"
            onClick={() => setShowConfigHelp(false)}
            className="absolute top-2 right-2 text-amber-700 hover:text-amber-900"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="font-semibold flex items-center gap-1.5 text-amber-900">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Cloudinary Environment Setup</span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            To upload directly to Cloudinary, add your Cloudinary credentials into{' '}
            <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[10px]">
              Backend/.env
            </code>
            :
          </p>
          <pre className="bg-[#1C1917] text-[#FAFAF9] p-2 rounded text-[10px] font-mono overflow-x-auto select-all">
{`CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret`}
          </pre>
          <p className="text-[10px] text-amber-700">
            Get your credentials from{' '}
            <a
              href="https://cloudinary.com/console"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#C2410C] underline font-medium inline-flex items-center gap-0.5"
            >
              cloudinary.com/console
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
            . You can also paste existing image URLs anytime.
          </p>
        </div>
      )}

      {/* Hidden native file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
        }}
      />

      {/* Main Dropzone / Preview Card */}
      {currentDisplayUrl ? (
        // Preview State Card
        <div className="p-3 bg-[#FAFAF9] rounded-xl border border-[#D6D3D1] space-y-2.5">
          <div className="flex items-start gap-3">
            {/* Image Preview Container */}
            <div
              className={`rounded-lg bg-white border border-[#D6D3D1] p-1.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs relative group ${
                aspectRatio === 'icon'
                  ? 'w-14 h-14'
                  : 'w-20 h-20 sm:w-24 sm:h-24'
              }`}
            >
              <img
                src={currentDisplayUrl}
                alt="Product Preview"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as any).src = defaultFallbackImage;
                }}
              />

              {isUploading && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex flex-col items-center justify-center text-white p-1">
                  <Loader2 className="w-5 h-5 animate-spin text-[#FFEDD5]" />
                </div>
              )}
            </div>

            {/* Image Details & Actions */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                {isCloudinaryUrl ? (
                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Cloudinary CDN Hosted
                  </span>
                ) : localPreview ? (
                  <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                    Uploading...
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-[#57534E] bg-[#E7E5E4] px-2 py-0.5 rounded">
                    External / Local Image
                  </span>
                )}

                <span className="text-[10px] text-[#78716C] font-mono">
                  {folder === 'products' ? 'Product Catalog' : 'Category Icon'}
                </span>
              </div>

              {/* URL preview snippet */}
              <div className="text-[11px] font-mono text-[#57534E] truncate bg-white border border-[#E7E5E4] rounded px-2 py-1 flex items-center justify-between gap-1">
                <span className="truncate">{currentDisplayUrl}</span>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="text-[#78716C] hover:text-[#1C1917] shrink-0 p-0.5"
                  title="Copy Image URL"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="h-7 px-2.5 bg-white hover:bg-[#F5F5F4] border border-[#D6D3D1] text-[#1C1917] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <RefreshCw className="w-3 h-3 text-[#C2410C]" />
                  <span>Replace Image</span>
                </button>

                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={isUploading}
                  className="h-7 px-2.5 bg-transparent hover:bg-red-50 text-red-600 border border-transparent hover:border-red-200 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Empty Upload Dropzone State
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 sm:p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
            isDragOver
              ? 'border-[#C2410C] bg-[#FFEDD5]/30 scale-[1.005]'
              : 'border-[#D6D3D1] bg-[#FAFAF9] hover:bg-[#F5F5F4] hover:border-[#C2410C]'
          }`}
        >
          {isUploading ? (
            <div className="py-2 flex flex-col items-center space-y-2">
              <Loader2 className="w-8 h-8 text-[#C2410C] animate-spin" />
              <div className="text-xs font-semibold text-[#1C1917]">
                {uploadProgress || 'Uploading to Cloudinary...'}
              </div>
              <div className="text-[11px] text-[#78716C]">
                Optimizing and storing on Cloudinary CDN
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-[#FFEDD5] flex items-center justify-center text-[#C2410C] shadow-2xs">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#1C1917]">
                  <span className="text-[#C2410C] hover:underline">Click to upload</span> or drag
                  and drop
                </p>
                <p className="text-[11px] text-[#78716C] mt-0.5">
                  PNG, JPG, WEBP, SVG or GIF (up to 10MB) • Powered by Cloudinary
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual URL Input Field (Collapsible) */}
      {isManualUrlOpen && (
        <div className="p-2.5 bg-[#FAFAF9] rounded-lg border border-[#D6D3D1] space-y-1.5 animate-fadeIn">
          <label className="block text-[11px] font-semibold text-[#57534E]">
            Direct Image Link / URL:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="https://... or /images/..."
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                setLocalPreview(null);
              }}
              className="flex-1 bg-white border border-[#D6D3D1] rounded-lg px-2.5 py-1.5 text-xs text-[#1C1917] font-mono focus:outline-none focus:border-[#C2410C]"
            />
            {value && (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-2.5 bg-white hover:bg-[#F5F5F4] border border-[#D6D3D1] text-[#57534E] rounded-lg text-xs flex items-center gap-1 transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Error message alert */}
      {errorMessage && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-2 animate-fadeIn">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-amber-950">Upload Notice</div>
              <div className="text-[11px] mt-0.5 leading-relaxed text-amber-900">{errorMessage}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setPendingLocalFile(null);
              }}
              className="text-amber-500 hover:text-amber-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {pendingLocalFile && (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleApplyLocalFile(pendingLocalFile)}
                className="h-7 px-3 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-lg text-xs font-semibold cursor-pointer shadow-2xs flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                <span>Use Local Image Anyway (Demo Mode)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowConfigHelp(true)}
                className="h-7 px-2.5 bg-white hover:bg-amber-100/50 border border-amber-300 text-amber-900 rounded-lg text-xs font-medium cursor-pointer"
              >
                Configure Cloudinary
              </button>
            </div>
          )}
        </div>
      )}

      {helperText && <p className="text-[11px] text-[#78716C]">{helperText}</p>}
    </div>
  );
}
