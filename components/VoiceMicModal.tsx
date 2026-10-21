'use client';

import React, { useState } from 'react';
import { X, Mic, Check, ArrowRight } from 'lucide-react';
import { apiRequest } from '../lib/api';

interface VoiceMicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyVoiceActions: (actions: any[]) => void;
}

export default function VoiceMicModal({
  isOpen,
  onClose,
  onApplyVoiceActions,
}: VoiceMicModalProps) {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [parsedActions, setParsedActions] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  if (!isOpen) return null;

  const quickSamples = [
    '2 basmati rice, 1 amul butter',
    '1 sunflower oil, 2 tata tea',
    '3 maggi noodles, 2 parle-g',
    'discount 20 rupees',
  ];

  const handleParse = async (textToParse?: string) => {
    const text = textToParse || transcript;
    if (!text.trim()) return;

    try {
      setIsParsing(true);
      const res = await apiRequest('/api/voice/parse', {
        method: 'POST',
        body: JSON.stringify({ transcript: text }),
      });

      if (res.success && res.data?.actions) {
        setParsedActions(res.data.actions);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsParsing(false);
    }
  };

  const startSpeechRecognition = () => {
    const windowWithSpeech = window as any;
    const SpeechRecognition =
      windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Web Speech API is not supported in this browser. You can type or use the quick sample chips.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const speechResult = event.results[0][0].transcript;
      setTranscript(speechResult);
      handleParse(speechResult);
    };

    recognition.start();
  };

  const handleAcceptAll = () => {
    onApplyVoiceActions(parsedActions);
    setParsedActions([]);
    setTranscript('');
    onClose();
  };

  const handleAcceptSingle = (index: number) => {
    const action = parsedActions[index];
    onApplyVoiceActions([action]);
    setParsedActions(parsedActions.filter((_, i) => i !== index));
  };

  const handleDismissSingle = (index: number) => {
    setParsedActions(parsedActions.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/40 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150 font-sans">
      <div className="bg-[#F5F5F4] border border-[#D6D3D1] w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-xl p-5 sm:p-7 shadow-[0_24px_48px_rgba(28,25,23,0.12)] relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C2410C]/10 border border-[#C2410C]/20 flex items-center justify-center text-[#C2410C]">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-[#1C1917]">Voice-to-Cart Billing</h3>
              <p className="text-xs text-[#78716C]">Speak items & quantities to draft cart changes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#78716C] hover:text-[#1C1917] p-1 rounded-lg hover:bg-[#E7E5E4] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mic Visualizer / Input */}
        <div className="bg-[#FAFAF9] border border-[#D6D3D1] rounded-xl p-5 mb-4 text-center">
          <button
            onClick={startSpeechRecognition}
            className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center transition-all cursor-pointer ${
              isListening
                ? 'bg-[#C2410C] text-white animate-pulse ring-8 ring-[#C2410C]/20 scale-110 shadow-lg'
                : 'bg-[#FAFAF9] hover:bg-[#E7E5E4] text-[#C2410C] border border-[#D6D3D1] shadow-xs'
            }`}
          >
            <Mic className="w-8 h-8" />
          </button>
          <div className="text-xs font-semibold text-[#1C1917]">
            {isListening ? 'Listening... Speak now (e.g. "2 basmati rice, 1 sunflower oil")' : 'Click Mic to Speak or type below'}
          </div>

          <div className="flex space-x-2 mt-4">
            <input
              type="text"
              placeholder="e.g. 2 rice, 1 amul butter"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleParse()}
              className="flex-1 bg-[#F5F5F4] border border-[#D6D3D1] rounded-lg px-3 py-2 text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#C2410C] focus:ring-3 focus:ring-[#C2410C]/15"
            />
            <button
              onClick={() => handleParse()}
              disabled={isParsing || !transcript.trim()}
              className="h-10 px-4 bg-[#C2410C] hover:bg-[#9A3412] disabled:bg-[#E7E5E4] disabled:text-[#78716C] text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              {isParsing ? 'Parsing...' : 'Parse'}
            </button>
          </div>

          {/* Quick test chips */}
          <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
            {quickSamples.map((sample, i) => (
              <button
                key={i}
                onClick={() => {
                  setTranscript(sample);
                  handleParse(sample);
                }}
                className="text-[11px] bg-[#F5F5F4] hover:bg-[#E7E5E4] text-[#57534E] hover:text-[#1C1917] px-2.5 py-1 rounded-full border border-[#D6D3D1] transition-colors"
              >
                &ldquo;{sample}&rdquo;
              </button>
            ))}
          </div>
        </div>

        {/* Confirmation Chips per DESIGN.md */}
        {parsedActions.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-[#1C1917] mb-2 flex items-center justify-between">
              <span>Parsed Confirmation Chips:</span>
              <button
                onClick={handleAcceptAll}
                className="text-xs font-semibold text-[#C2410C] hover:text-[#9A3412] hover:underline flex items-center space-x-1"
              >
                <span>Accept All ({parsedActions.length})</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {parsedActions.map((act, idx) => (
                <div
                  key={idx}
                  className="bg-[#FAFAF9] border border-[#D6D3D1] rounded-xl p-3 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
                    <div>
                      {act.action === 'ADD' && act.product ? (
                        <div className="text-xs font-semibold text-[#1C1917]">
                          {act.qty}x {act.product.name} • ₹{((act.qty * act.product.pricePaise) / 100).toFixed(2)}
                        </div>
                      ) : act.action === 'DISCOUNT' ? (
                        <div className="text-xs font-semibold text-[#C2410C]">
                          Apply Discount: ₹{(act.discountPaise / 100).toFixed(2)}
                        </div>
                      ) : act.action === 'REMOVE' && act.product ? (
                        <div className="text-xs font-semibold text-[#DC2626]">
                          Remove {act.product.name}
                        </div>
                      ) : (
                        <div className="text-xs font-semibold text-[#D97706]">Command: {act.action}</div>
                      )}
                      <div className="text-[10px] text-[#78716C] font-mono">
                        Confidence: {(act.confidence * 100).toFixed(0)}% match
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleAcceptSingle(idx)}
                      className="p-1.5 bg-[#FFEDD5] hover:bg-[#C2410C] text-[#C2410C] hover:text-white rounded-lg transition-colors border border-[#C2410C]/20"
                      title="Accept Chip"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDismissSingle(idx)}
                      className="p-1.5 bg-[#F5F5F4] hover:bg-red-50 text-[#78716C] hover:text-[#DC2626] rounded-lg transition-colors border border-[#D6D3D1]"
                      title="Dismiss"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-[11px] text-[#78716C] text-center">
          Payment method, UPI confirmation, and printing are strictly manual by tap per safety rules.
        </div>
      </div>
    </div>
  );
}
