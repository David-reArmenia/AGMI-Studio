import React from 'react';

interface LoadingOverlayProps {
    isVisible: boolean;
    message?: string;
    progress?: number;
    subMessage?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
    isVisible,
    message = 'Processing...',
    progress,
    subMessage
}) => {
    if (!isVisible) return null;

    return (
        <div className="absolute inset-0 z-50 bg-background-dark/90 backdrop-blur-sm flex flex-col items-center justify-center">
            {/* Spinner */}
            <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 border-4 border-border-dark rounded-full"></div>
                <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                {progress !== undefined && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-primary font-mono text-sm font-bold">{Math.round(progress)}%</span>
                    </div>
                )}
            </div>

            {/* Message */}
            <p className="text-white font-black text-sm uppercase tracking-widest mb-2">{message}</p>

            {/* Sub-message */}
            {subMessage && (
                <p className="text-[#5a7187] text-xs uppercase tracking-wider">{subMessage}</p>
            )}

            {/* Progress bar */}
            {progress !== undefined && (
                <div className="w-64 mt-6 bg-border-dark rounded-full h-1.5 overflow-hidden">
                    <div
                        className="bg-primary h-full transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
        </div>
    );
};

export default LoadingOverlay;
