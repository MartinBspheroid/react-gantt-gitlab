import React from 'react';

/**
 * Icon System - Standardized Icon Component
 * 
 * This component provides a unified interface for using icons across the application.
 * It supports three icon systems:
 * 
 * 1. **SVAR Icons (wxi-*)**: UI controls and actions from @svar-ui library
 *    - Use for: Buttons, toggles, navigation, toolbar actions
 *    - Example: <Icon type="svar" name="plus" />
 * 
 * 2. **Font Awesome**: Work item types and semantic icons
 *    - Use for: Work item type indicators, feature icons, semantic meanings
 *    - Example: <Icon type="fontawesome" name="bug" />
 * 
 * 3. **Inline SVG**: Custom icons not available in other systems
 *    - Use for: Unique UI elements, brand icons, complex graphics
 *    - Example: <Icon type="svg" svg={<CustomSvg />} />
 * 
 * ## Usage Guidelines
 * 
 * ### When to use SVAR Icons (type="svar")
 * - Toolbar buttons and actions
 * - Editor controls (close, delete, etc.)
 * - Grid actions (expand/collapse, add)
 * - Navigation elements
 * - Resizer controls
 * - Any UI control integrated with @svar-ui components
 * 
 * ### When to use Font Awesome (type="fontawesome")
 * - Work item type icons (bug, task, feature, epic, user story)
 * - Semantic icons that convey meaning (check, star, flag, etc.)
 * - Icons that need to match work item types from external systems (Azure DevOps, GitLab)
 * 
 * ### When to use Inline SVG (type="svg")
 * - Icons not available in SVAR or Font Awesome
 * - Brand/custom icons
 * - Complex icons requiring precise control
 * - Icons with animations or special effects
 * 
 * ## Migration Path
 * 
 * Existing code uses three patterns:
 * - `<i className="wxi-*" />` → Use type="svar"
 * - `<i className="fa-*" />` → Use type="fontawesome"
 * - `<svg>...</svg>` → Use type="svg"
 */

export type IconType = 'svar' | 'fontawesome' | 'svg';

export interface IconProps {
  /** The icon system to use */
  type: IconType;
  /** Icon name (for 'svar' and 'fontawesome' types) */
  name?: string;
  /** Custom SVG element (for 'svg' type) */
  svg?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Icon color (CSS color value) */
  color?: string;
  /** Icon size in pixels */
  size?: number;
  /** Click handler */
  onClick?: () => void;
  /** ARIA label for accessibility */
  ariaLabel?: string;
  /** HTML element to render as (default: 'i' for svar/fontawesome, 'span' for svg) */
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Standardized Icon Component
 * 
 * Provides a unified way to use icons from different icon systems.
 * 
 * @example
 * // SVAR icon
 * <Icon type="svar" name="plus" />
 * 
 * @example
 * // Font Awesome icon
 * <Icon type="fontawesome" name="bug" color="#dc3545" />
 * 
 * @example
 * // Inline SVG
 * <Icon type="svg" svg={<CustomSvg />} size={24} />
 */
export function Icon({
  type,
  name,
  svg,
  className = '',
  color,
  size,
  onClick,
  ariaLabel,
  as: Component,
}: IconProps) {
  const baseStyle: React.CSSProperties = {
    color,
    fontSize: size ? `${size}px` : undefined,
    width: size ? `${size}px` : undefined,
    height: size ? `${size}px` : undefined,
    cursor: onClick ? 'pointer' : undefined,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  switch (type) {
    case 'svar':
      const SvarComponent = (Component || 'i') as React.ElementType;
      return (
        <SvarComponent
          className={`wxi-${name} ${className}`}
          style={baseStyle}
          onClick={onClick}
          aria-label={ariaLabel}
          role={onClick ? 'button' : undefined}
        />
      );

    case 'fontawesome':
      const FaComponent = (Component || 'i') as React.ElementType;
      return (
        <FaComponent
          className={`${name} ${className}`}
          style={baseStyle}
          onClick={onClick}
          aria-label={ariaLabel}
          aria-hidden={!ariaLabel}
          role={onClick ? 'button' : undefined}
        />
      );

    case 'svg':
      const SvgComponent = (Component || 'span') as React.ElementType;
      return (
        <SvgComponent
          className={`wx-icon-svg ${className}`}
          style={baseStyle}
          onClick={onClick}
          aria-label={ariaLabel}
          role={onClick ? 'button' : undefined}
        >
          {svg}
        </SvgComponent>
      );

    default:
      console.warn(`Unknown icon type: ${type}`);
      return null;
  }
}

/**
 * Predefined icon configurations for common use cases
 */
export const icons = {
  // SVAR UI icons
  svar: {
    plus: { type: 'svar' as const, name: 'plus' },
    close: { type: 'svar' as const, name: 'close' },
    delete: { type: 'svar' as const, name: 'delete' },
    folder: { type: 'svar' as const, name: 'folder' },
    split: { type: 'svar' as const, name: 'split' },
    expand: { type: 'svar' as const, name: 'expand' },
    collapse: { type: 'svar' as const, name: 'collapse' },
    'menu-left': { type: 'svar' as const, name: 'menu-left' },
    'menu-right': { type: 'svar' as const, name: 'menu-right' },
    'menu-down': { type: 'svar' as const, name: 'menu-down' },
    'menu-up': { type: 'svar' as const, name: 'menu-up' },
  },

  // Font Awesome icons
  fontawesome: {
    bug: { type: 'fontawesome' as const, name: 'fa-solid fa-bug' },
    task: { type: 'fontawesome' as const, name: 'fa-solid fa-check' },
    'user-story': { type: 'fontawesome' as const, name: 'fa-solid fa-book' },
    feature: { type: 'fontawesome' as const, name: 'fa-solid fa-star' },
    epic: { type: 'fontawesome' as const, name: 'fa-solid fa-mountain' },
    milestone: { type: 'fontawesome' as const, name: 'far fa-flag' },
    issue: { type: 'fontawesome' as const, name: 'far fa-clipboard' },
    sync: { type: 'fontawesome' as const, name: 'fa-solid fa-sync' },
  },
};

/**
 * Convenience component for SVAR icons
 */
export function SvarIcon({
  name,
  ...props
}: Omit<IconProps, 'type' | 'name'> & { name: string }) {
  return <Icon type="svar" name={name} {...props} />;
}

/**
 * Convenience component for Font Awesome icons
 */
export function FontAwesomeIcon({
  name,
  ...props
}: Omit<IconProps, 'type' | 'name'> & { name: string }) {
  return <Icon type="fontawesome" name={name} {...props} />;
}

export default Icon;
