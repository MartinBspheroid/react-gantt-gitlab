import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SmartTaskContent from '../SmartTaskContent';

describe('SmartTaskContent', () => {
  describe('Avatar rendering', () => {
    it('should render avatar image when avatarUrl is provided', () => {
      const task = {
        text: 'Test Task',
        assigned: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
      };

      render(<SmartTaskContent data={task} />);

      const avatar = screen.getByAltText('John Doe');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
      expect(avatar).toHaveClass('wx-avatar-image');
    });

    it('should render initials fallback when no avatarUrl', () => {
      const task = {
        text: 'Test Task',
        assigned: 'John Doe',
      };

      render(<SmartTaskContent data={task} />);

      const fallback = screen.getByText('JD');
      expect(fallback).toBeInTheDocument();
      expect(fallback).toHaveClass('wx-avatar-fallback');
    });

    it('should render question mark when no assignee', () => {
      const task = {
        text: 'Test Task',
      };

      render(<SmartTaskContent data={task} />);

      const fallback = screen.getByText('?');
      expect(fallback).toBeInTheDocument();
    });

    it('should get correct initials for single word name', () => {
      const task = {
        text: 'Test Task',
        assigned: 'Alice',
      };

      render(<SmartTaskContent data={task} />);

      expect(screen.getByText('AL')).toBeInTheDocument();
    });

    it('should get correct initials for multi-word name', () => {
      const task = {
        text: 'Test Task',
        assigned: 'John Paul Jones',
      };

      render(<SmartTaskContent data={task} />);

      expect(screen.getByText('JJ')).toBeInTheDocument();
    });
  });

  describe('Work item type icon', () => {
    it('should render Bug icon for Bug type', () => {
      const task = {
        text: 'Bug Task',
        workItemType: 'Bug',
      };

      render(<SmartTaskContent data={task} />);

      const icon = screen.getByTitle('Bug');
      expect(icon).toHaveClass('fas', 'fa-bug', 'wx-type-icon');
    });

    it('should render Task icon for Task type', () => {
      const task = {
        text: 'Task Item',
        workItemType: 'Task',
      };

      render(<SmartTaskContent data={task} />);

      const icon = screen.getByTitle('Task');
      expect(icon).toHaveClass('fas', 'fa-check-square');
    });

    it('should render Feature icon for Feature type', () => {
      const task = {
        text: 'Feature Item',
        workItemType: 'Feature',
      };

      render(<SmartTaskContent data={task} />);

      const icon = screen.getByTitle('Feature');
      expect(icon).toHaveClass('fas', 'fa-star');
    });

    it('should render User Story icon for User Story type', () => {
      const task = {
        text: 'My User Story Item',
        workItemType: 'User Story',
      };

      render(<SmartTaskContent data={task} />);

      const icons = screen.getAllByTitle('User Story');
      const icon = icons.find((el) => el.tagName.toLowerCase() === 'i');
      expect(icon).toHaveClass('fas', 'fa-book');
    });

    it('should render Issue icon (default) for Issue type', () => {
      const task = {
        text: 'Issue Item',
        workItemType: 'Issue',
      };

      render(<SmartTaskContent data={task} />);

      const icon = screen.getByTitle('Issue');
      expect(icon).toHaveClass('fas', 'fa-circle');
    });

    it('should render Issue icon (default) for unknown type', () => {
      const task = {
        text: 'Unknown Item',
        workItemType: 'UnknownType',
      };

      render(<SmartTaskContent data={task} />);

      const icon = screen.getByTitle('UnknownType');
      expect(icon).toHaveClass('fas', 'fa-circle');
    });

    it('should handle lowercase workItemType', () => {
      const task = {
        text: 'Bug Task',
        workItemType: 'bug',
      };

      render(<SmartTaskContent data={task} />);

      const icon = screen.getByTitle('bug');
      expect(icon).toHaveClass('fas', 'fa-bug');
    });
  });

  describe('Story points badge', () => {
    it('should render story points badge when provided', () => {
      const task = {
        text: 'Test Task',
        storyPoints: 5,
      };

      render(<SmartTaskContent data={task} />);

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should not render story points badge when undefined', () => {
      const task = {
        text: 'Test Task',
        storyPoints: undefined,
      };

      render(<SmartTaskContent data={task} />);

      // Only the task text and avatar initials should be present
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('should not render story points badge when null', () => {
      const task = {
        text: 'Test Task',
        storyPoints: null,
      };

      render(<SmartTaskContent data={task} />);

      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('should render story points badge with value 0', () => {
      const task = {
        text: 'Test Task',
        storyPoints: 0,
      };

      render(<SmartTaskContent data={task} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('Task text', () => {
    it('should render task text', () => {
      const task = {
        text: 'My Task Title',
      };

      render(<SmartTaskContent data={task} />);

      expect(screen.getByText('My Task Title')).toBeInTheDocument();
    });

    it('should handle empty text', () => {
      const task = {
        text: '',
      };

      render(<SmartTaskContent data={task} />);

      // Component should still render without crashing
      expect(
        document.querySelector('.wx-smart-task-container'),
      ).toBeInTheDocument();
    });

    it('should handle undefined text', () => {
      const task = {};

      render(<SmartTaskContent data={task} />);

      expect(
        document.querySelector('.wx-smart-task-container'),
      ).toBeInTheDocument();
    });
  });

  describe('Full integration', () => {
    it('should render all elements together', () => {
      const task = {
        text: 'Complete implementation',
        assigned: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
        storyPoints: 8,
        workItemType: 'Feature',
      };

      render(<SmartTaskContent data={task} />);

      // Avatar
      expect(screen.getByAltText('John Doe')).toBeInTheDocument();
      // Type icon
      expect(screen.getByTitle('Feature')).toHaveClass('fa-star');
      // Task text
      expect(screen.getByText('Complete implementation')).toBeInTheDocument();
      // Story points
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    it('should render without avatar but with other elements', () => {
      const task = {
        text: 'Fix bug',
        assigned: 'Jane Smith',
        storyPoints: 3,
        workItemType: 'Bug',
      };

      render(<SmartTaskContent data={task} />);

      // Initials fallback
      expect(screen.getByText('JS')).toBeInTheDocument();
      // Type icon
      expect(screen.getByTitle('Bug')).toHaveClass('fa-bug');
      // Task text
      expect(screen.getByText('Fix bug')).toBeInTheDocument();
      // Story points
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });
});
