import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SmartTaskContent from '../SmartTaskContent';

describe('SmartTaskContent', () => {
  describe('Work item type icon', () => {
    it('should render Bug icon for Bug type', () => {
      const task = {
        text: 'Bug Task',
        workItemType: 'Bug',
      };

      const { container } = render(<SmartTaskContent data={task} />);

      const icon = container.querySelector('.fa-solid.fa-bug');
      expect(icon).toBeInTheDocument();
    });

    it('should render Task icon for Task type', () => {
      const task = {
        text: 'Task Item',
        workItemType: 'Task',
      };

      const { container } = render(<SmartTaskContent data={task} />);

      const icon = container.querySelector('.fa-solid.fa-check');
      expect(icon).toBeInTheDocument();
    });

    it('should render Feature icon for Feature type', () => {
      const task = {
        text: 'Feature Item',
        workItemType: 'Feature',
      };

      const { container } = render(<SmartTaskContent data={task} />);

      const icon = container.querySelector('.fa-solid.fa-star');
      expect(icon).toBeInTheDocument();
    });

    it('should render User Story icon for User Story type', () => {
      const task = {
        text: 'My User Story Item',
        workItemType: 'User Story',
      };

      const { container } = render(<SmartTaskContent data={task} />);

      const icon = container.querySelector('.fa-solid.fa-book');
      expect(icon).toBeInTheDocument();
    });

    it('should render Epic icon for Epic type', () => {
      const task = {
        text: 'Epic Item',
        workItemType: 'Epic',
      };

      const { container } = render(<SmartTaskContent data={task} />);

      const icon = container.querySelector('.fa-solid.fa-mountain');
      expect(icon).toBeInTheDocument();
    });

    it('should handle lowercase workItemType', () => {
      const task = {
        text: 'Bug Task',
        workItemType: 'bug',
      };

      const { container } = render(<SmartTaskContent data={task} />);

      const icon = container.querySelector('.fa-solid.fa-bug');
      expect(icon).toBeInTheDocument();
    });

    it('should not render icon when workItemType is unknown', () => {
      const task = {
        text: 'Unknown Item',
        workItemType: 'UnknownType',
      };

      const { container } = render(<SmartTaskContent data={task} />);

      const iconSpan = container.querySelector('.wx-task-type-icon');
      expect(iconSpan).toBeNull();
    });

    it('should not render icon when no workItemType provided', () => {
      const task = {
        text: 'Plain Task',
      };

      const { container } = render(<SmartTaskContent data={task} />);

      const iconSpan = container.querySelector('.wx-task-type-icon');
      expect(iconSpan).toBeNull();
    });
  });

  describe('Task text', () => {
    it('should render task text', () => {
      const task = {
        text: 'My Task Title',
        workItemType: 'Task',
      };

      render(<SmartTaskContent data={task} />);

      expect(screen.getByText('My Task Title')).toBeInTheDocument();
    });

    it('should handle empty text', () => {
      const task = {
        text: '',
        workItemType: 'Task',
      };

      const { container } = render(<SmartTaskContent data={task} />);

      const textSpan = container.querySelector('.wx-task-text');
      expect(textSpan).toBeInTheDocument();
      expect(textSpan).toHaveTextContent('');
    });

    it('should handle undefined text', () => {
      const task = {
        workItemType: 'Task',
      };

      const { container } = render(<SmartTaskContent data={task} />);

      const textSpan = container.querySelector('.wx-task-text');
      expect(textSpan).toBeInTheDocument();
      expect(textSpan).toHaveTextContent('');
    });
  });

  describe('Container structure', () => {
    it('should have correct container class', () => {
      const task = {
        text: 'Test Task',
        workItemType: 'Task',
      };

      const { container } = render(<SmartTaskContent data={task} />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('wx-smart-task', 'wx-text-out');
    });

    it('should render icon and text together', () => {
      const task = {
        text: 'Complete implementation',
        workItemType: 'Feature',
      };

      const { container } = render(<SmartTaskContent data={task} />);

      // Icon should be present
      const icon = container.querySelector('.fa-star');
      expect(icon).toBeInTheDocument();

      // Text should be present
      expect(screen.getByText('Complete implementation')).toBeInTheDocument();
    });
  });

  describe('ADO metadata', () => {
    it('should render icon for ADO work item type', () => {
      const task = {
        text: 'ADO Task',
        _ado: {
          workItemType: 'Bug',
        },
      };

      const { container } = render(<SmartTaskContent data={task} />);

      const icon = container.querySelector('.fa-solid.fa-bug');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('GitLab metadata', () => {
    it('should render milestone icon for milestones', () => {
      const task = {
        text: 'Milestone',
        $isMilestone: true,
      };

      const { container } = render(<SmartTaskContent data={task} />);

      const icon = container.querySelector('.far.fa-flag');
      expect(icon).toBeInTheDocument();
    });

    it('should render issue icon for GitLab issues', () => {
      const task = {
        text: 'GitLab Issue',
        _gitlab: {
          type: 'issue',
        },
      };

      const { container } = render(<SmartTaskContent data={task} />);

      const icon = container.querySelector('.far.fa-clipboard');
      expect(icon).toBeInTheDocument();
    });
  });
});
