import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';
import styles from './Button.module.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet';
  size?: 'md' | 'sm';
  icon?: IconName;
  iconAfter?: IconName;
  fullWidth?: boolean;
};

/** Design system button. `secondary` is the default; use one `primary` per view. Icon-only buttons need `aria-label`. */
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconAfter,
  fullWidth,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [styles.button, styles[variant], styles[size], fullWidth && styles.full, !children && styles.iconOnly, className]
    .filter(Boolean)
    .join(' ');
  const iconSize = size === 'sm' ? 16 : 18;
  return (
    <button type={type} className={classes} {...rest}>
      {icon && <Icon name={icon} size={iconSize} />}
      {children && <span>{children}</span>}
      {iconAfter && <Icon name={iconAfter} size={iconSize} />}
    </button>
  );
}
