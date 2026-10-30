import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { JukeboxConfig } from '../types';
import { Printer, X, Sparkles, Music, QrCode } from 'lucide-react';

interface QRSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: JukeboxConfig;
}

export const QRSignModal: React.FC<QRSignModalProps> = ({
  isOpen,
  onClose,
  config
}) => {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [guestUrl, setGuestUrl] = useState('');

  useEffect(() => {
    // Current base URL without query parameters or sub-pages
    const currentOrigin = window.location.origin;
    const url = currentOrigin;
    setGuestUrl(url);

    QRCode.toDataURL(url, {
      width: 512,
      margin: 2,
      color: {
        dark: '#2B2622',
        light: '#FCFAF5'
      }
    }).then(setQrDataUrl).catch(console.error);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      
      {/* Modal Dialog Card */}
      <div className="relative bg-[#FCFAF5] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-[#ebdcd2] my-auto">
        
        {/* Close button (hidden in print) */}
        <button
          onClick={onClose}
          className="no-print absolute top-4 right-4 p-2 rounded-full text-[#756c64] hover:text-[#2B2622] hover:bg-[#ebdcd2] transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Printable Wedding Sign Content */}
        <div className="sign-print-page text-center space-y-4">
          
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-widest font-semibold text-[#b85433]">
              Welcome to the Celebration
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#2B2622]">
              {config.coupleNames}
            </h2>
            <div className="flex items-center justify-center gap-2 text-xs text-[#476127] font-semibold pt-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Interactive Wedding Jukebox</span>
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* QR Code Container */}
          <div className="py-2 flex justify-center">
            <div className="p-4 bg-white rounded-2xl border-2 border-dashed border-[#b85433] shadow-inner max-w-xs w-full">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Scan to open wedding jukebox"
                  className="w-full h-auto mx-auto rounded-lg"
                />
              ) : (
                <div className="aspect-square flex items-center justify-center text-gray-400">
                  <QrCode className="w-16 h-16 animate-pulse" />
                </div>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-1.5 max-w-xs mx-auto text-xs text-[#756c64]">
            <p className="font-bold text-sm text-[#2B2622]">
              Scan with your phone camera
            </p>
            <p>
              1. Open your camera and point it at the QR code.
            </p>
            <p>
              2. Search your favourite song or artist.
            </p>
            <p>
              3. Tap <span className="font-bold text-[#476127]">+ Add</span> to play on the dancefloor!
            </p>
          </div>

          <div className="pt-2 text-[11px] font-mono text-[#b85433] break-all">
            {guestUrl}
          </div>
        </div>

        {/* Actions (hidden in print) */}
        <div className="no-print pt-6 border-t border-[#ebdcd2] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-[#ebdcd2] text-xs font-semibold text-[#756c64] hover:bg-white transition-colors"
          >
            Done
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-3 rounded-xl bg-[#476127] hover:bg-[#35491c] text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Print Sign / PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
