import React from 'react';

interface ScoreGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  showPercent?: boolean;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({
  score,
  size = 120,
  strokeWidth = 10,
  label,
  showPercent = true,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score, 0), 100);
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  let strokeColor = '#10b981'; // Green (80+)
  let textColor = 'text-emerald-600 dark:text-emerald-400';
  let bgColor = 'text-emerald-100 dark:text-emerald-950/40';

  if (progress < 60) {
    strokeColor = '#ef4444'; // Red (<60)
    textColor = 'text-rose-600 dark:text-rose-400';
    bgColor = 'text-rose-100 dark:text-rose-950/40';
  } else if (progress < 80) {
    strokeColor = '#f59e0b'; // Amber (60-79)
    textColor = 'text-amber-600 dark:text-amber-400';
    bgColor = 'text-amber-100 dark:text-amber-950/40';
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-200 dark:text-slate-800"
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            fill="transparent"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className={`text-2xl font-bold tracking-tight ${textColor}`}>
            {Math.round(score)}{showPercent && '%'}
          </span>
          {label && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
