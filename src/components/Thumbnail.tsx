import React, { useState } from 'react';
import { MUSIC_PLACEHOLDER_ART } from '../utils/thumbnail';

interface ThumbnailProps {
  src?: string;
  className?: string;
}

export const Thumbnail: React.FC<ThumbnailProps> = ({ src, className }) => {
  const [failedSrc, setFailedSrc] = useState<string>();

  return (
    <img
      src={!src || failedSrc === src ? MUSIC_PLACEHOLDER_ART : src}
      alt=""
      className={className}
      onError={() => {
        if (src) setFailedSrc(src);
      }}
    />
  );
};
