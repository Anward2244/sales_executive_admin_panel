import React from 'react';

const Card = ({ children, className = '', onClick, hoverable = false, glowing = false, ...props }) => {
  if (glowing) {
    const classes = className.split(' ').filter(Boolean);
    const paddingClasses = [];
    const nonPaddingClasses = [];

    classes.forEach(c => {
      const isPadding = c.startsWith('p-') || 
                        c.startsWith('px-') || 
                        c.startsWith('py-') || 
                        c.startsWith('pt-') || 
                        c.startsWith('pb-') || 
                        c.startsWith('pl-') || 
                        c.startsWith('pr-') ||
                        c.includes(':p-') || 
                        c.includes(':px-') || 
                        c.includes(':py-') || 
                        c.includes(':pt-') || 
                        c.includes(':pb-') || 
                        c.includes(':pl-') || 
                        c.includes(':pr-');
      
      const isLayout = c === 'flex' ||
                       c === 'flex-col' ||
                       c === 'flex-row' ||
                       c.startsWith('justify-') ||
                       c.startsWith('items-') ||
                       c.startsWith('gap-') ||
                       c.startsWith('grid') ||
                       c.startsWith('col-') ||
                       c.startsWith('row-') ||
                       c.startsWith('min-h-');

      if (isPadding || isLayout) {
        paddingClasses.push(c);
        // If it's a layout class, we also want the outer container to have it for structure
        if (isLayout) {
          nonPaddingClasses.push(c);
        }
      } else {
        nonPaddingClasses.push(c);
      }
    });

    return (
      <div
        onClick={onClick}
        className={`glowing-card ${nonPaddingClasses.join(' ')}`}
        {...props}
      >
        <div className={`glowing-card-inner ${paddingClasses.join(' ') || 'p-3'}`}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-xs rounded-2xl p-3 transition-all duration-300 ${hoverable ? ' hover:border-blue-500/40 hover:shadow-md' : ''
        } ${onClick ? 'cursor-pointer hover:-translate-y-0.5 active:translate-y-0' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
