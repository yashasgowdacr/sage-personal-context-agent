import React from 'react';

interface ActionCardProps {
  tool: string;
  success: boolean;
  verified: boolean;
  data?: any;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  tool,
  success,
  verified,
  data,
}) => {
  if (!success) return null;

  // Format concise user-safe label based on verified backend tool
  let title = 'Action Verified';
  let icon = '✓';
  let subtitle = '';

  const toolLower = tool.toLowerCase();

  if (toolLower.includes('save_memory')) {
    title = 'Memory saved';
    icon = '💾';
    subtitle = data?.content ? `"${data.content}"` : 'Stored to semantic memory';
  } else if (toolLower.includes('create_task')) {
    title = 'Task created';
    icon = '📋';
    subtitle = data?.task?.title ? `"${data.task.title}"` : 'Added to pending tasks';
  } else if (toolLower.includes('complete_task')) {
    title = 'Task completed';
    icon = '✓';
    subtitle = data?.task?.title ? `"${data.task.title}" marked done` : 'Status updated in store';
  } else if (toolLower.includes('cancel_task')) {
    title = 'Task cancelled';
    icon = '✕';
    subtitle = data?.task?.title ? `"${data.task.title}" cancelled` : 'Removed from pending';
  } else if (toolLower.includes('forget_memory')) {
    title = 'Memory deleted';
    icon = '🗑';
    subtitle = 'Removed from Qdrant vector store';
  } else if (toolLower.includes('list_tasks')) {
    title = 'Tasks retrieved';
    icon = '📋';
    subtitle = `${data?.count ?? data?.tasks?.length ?? ''} tasks loaded from database`;
  }

  return (
    <div className={`action-card-verified ${verified ? 'is-verified' : ''}`} id="action-card-verified">
      <div className="action-card-icon">{icon}</div>
      <div className="action-card-body">
        <div className="action-card-title-row">
          <span className="action-card-title">{title}</span>
          {verified && <span className="action-verified-pill">Verified</span>}
        </div>
        {subtitle && <p className="action-card-subtitle">{subtitle}</p>}
      </div>
    </div>
  );
};
