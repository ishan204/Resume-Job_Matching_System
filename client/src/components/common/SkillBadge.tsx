import React from 'react';
import { SkillCategory } from '@shared';

interface SkillBadgeProps {
  skill: string;
  category?: SkillCategory;
  variant?: 'matched' | 'missing-critical' | 'missing-bonus' | 'neutral';
  size?: 'sm' | 'md';
}

export const SkillBadge: React.FC<SkillBadgeProps> = ({
  skill,
  category,
  variant = 'neutral',
  size = 'md',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  let variantClasses = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700';

  if (variant === 'matched') {
    variantClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60';
  } else if (variant === 'missing-critical') {
    variantClasses = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60';
  } else if (variant === 'missing-bonus') {
    variantClasses = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border font-mono transition-colors ${sizeClasses} ${variantClasses}`}>
      {variant === 'matched' && (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      )}
      {variant === 'missing-critical' && (
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
      )}
      {variant === 'missing-bonus' && (
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      )}
      <span>{skill}</span>
    </span>
  );
};
