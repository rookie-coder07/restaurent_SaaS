/**
 * Optimized Image Component with Lazy Loading
 * Supports progressive image loading and caching
 */

import React, { memo, useState, useEffect } from 'react';
import { Loader } from 'lucide-react';

const OptimizedImage = memo(
  ({
    src,
    alt,
    className = '',
    width,
    height,
    onLoad,
    onError,
    lazyLoad = true,
    placeholder = null,
  }) => {
    const [isLoading, setIsLoading] = useState(!lazyLoad);
    const [error, setError] = useState(false);
    const [imageSrc, setImageSrc] = useState(lazyLoad ? null : src);

    useEffect(() => {
      if (!lazyLoad) {
        setImageSrc(src);
        return;
      }

      // Set up Intersection Observer for lazy loading
      const image = document.querySelector(`img[data-src="${src}"]`);
      if (!image) {
        return;
      }

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setImageSrc(src);
            observer.unobserve(entry.target);
          }
        });
      });

      observer.observe(image);

      return () => {
        observer.disconnect();
      };
    }, [src, lazyLoad]);

    const handleLoad = () => {
      setIsLoading(false);
      onLoad?.();
    };

    const handleError = () => {
      setError(true);
      setIsLoading(false);
      onError?.();
    };

    if (error) {
      return (
        <div className={`flex items-center justify-center bg-gray-200 ${className}`}>
          <span className="text-sm text-gray-500">Failed to load image</span>
        </div>
      );
    }

    return (
      <div className="relative" style={{ width, height }}>
        {isLoading && placeholder && <div className="absolute inset-0">{placeholder}</div>}

        {isLoading && !placeholder && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <Loader className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}

        {imageSrc && (
          <img
            src={imageSrc}
            alt={alt}
            data-src={lazyLoad ? src : undefined}
            className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
            onLoad={handleLoad}
            onError={handleError}
            width={width}
            height={height}
          />
        )}
      </div>
    );
  }
);

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage;
