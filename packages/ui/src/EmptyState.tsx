import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: IconName;
}

export function EmptyState({ title, description, action, icon = 'inbox' }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="icon-wrap">
        <Icon name={icon} size={22} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
