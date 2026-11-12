import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps } from 'react';
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

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: 'primary' | 'secondary' | 'quiet';
  size?: 'md' | 'sm';
  icon?: IconName;
};

/** A link that looks like a Button, for navigation (new item, back, preview). */
export function ButtonLink({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: ButtonLinkProps) {
  const classes = [styles.button, styles[variant], styles[size], !children && styles.iconOnly, className].filter(Boolean).join(' ');
  return (
    <Link className={classes} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children && <span>{children}</span>}
    </Link>
  );
}
