import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GroupingDropdown } from '../GroupingDropdown';

describe('GroupingDropdown', () => {
  describe('rendering', () => {
    it('should render the dropdown trigger button', () => {
      render(<GroupingDropdown />);
      const button = screen.getByTitle('Group tasks by...');
      expect(button).toBeInTheDocument();
    });

    it('should display the default label when value is "none"', () => {
      render(<GroupingDropdown value="none" />);
      expect(screen.getByText('No Grouping')).toBeInTheDocument();
    });

    it('should display the selected option label', () => {
      render(<GroupingDropdown value="assignee" />);
      expect(screen.getByText('By Assignee')).toBeInTheDocument();
    });

    it('should display "By Epic" when value is epic', () => {
      render(<GroupingDropdown value="epic" />);
      expect(screen.getByText('By Epic')).toBeInTheDocument();
    });

    it('should display "By Sprint" when value is sprint', () => {
      render(<GroupingDropdown value="sprint" />);
      expect(screen.getByText('By Sprint')).toBeInTheDocument();
    });

    it('should show group count and task count when groupCount > 0', () => {
      render(
        <GroupingDropdown value="assignee" groupCount={3} taskCount={15} />,
      );
      expect(screen.getByText('3 groups, 15 tasks')).toBeInTheDocument();
    });

    it('should not show count when groupCount is 0', () => {
      render(<GroupingDropdown value="none" groupCount={0} taskCount={10} />);
      expect(screen.queryByText(/groups/)).not.toBeInTheDocument();
    });

    it('should not show the dropdown menu by default', () => {
      render(<GroupingDropdown />);
      // When closed, only the trigger label is visible, not the menu items
      // The trigger shows "No Grouping" (the default), not the individual menu items
      const menuItems = document.querySelectorAll('.grouping-dropdown-menu');
      expect(menuItems).toHaveLength(0);
    });
  });

  describe('opening and closing', () => {
    it('should open the dropdown menu on click', async () => {
      const user = userEvent.setup();
      render(<GroupingDropdown value="none" />);

      await user.click(screen.getByTitle('Group tasks by...'));

      // All options should be visible
      expect(screen.getByText('By Assignee')).toBeInTheDocument();
      expect(screen.getByText('By Epic')).toBeInTheDocument();
      expect(screen.getByText('By Sprint')).toBeInTheDocument();
    });

    it('should close the dropdown on second click', async () => {
      const user = userEvent.setup();
      render(<GroupingDropdown value="none" />);

      const trigger = screen.getByTitle('Group tasks by...');
      await user.click(trigger);
      expect(screen.getByText('By Assignee')).toBeInTheDocument();

      await user.click(trigger);
      // Menu items from the menu (not trigger) should be gone
      expect(screen.queryByText('By Epic')).not.toBeInTheDocument();
    });

    it('should close when clicking outside', () => {
      render(
        <div>
          <GroupingDropdown value="none" />
          <button data-testid="outside">Outside</button>
        </div>,
      );

      // Open the dropdown
      fireEvent.click(screen.getByTitle('Group tasks by...'));
      expect(screen.getByText('By Assignee')).toBeInTheDocument();

      // Click outside
      fireEvent.mouseDown(screen.getByTestId('outside'));
      expect(screen.queryByText('By Epic')).not.toBeInTheDocument();
    });

    it('should not open when disabled', async () => {
      const user = userEvent.setup();
      render(<GroupingDropdown value="none" disabled={true} />);

      await user.click(screen.getByTitle('Group tasks by...'));
      expect(screen.queryByText('By Assignee')).not.toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('should call onChange when an option is selected', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<GroupingDropdown value="none" onChange={onChange} />);

      await user.click(screen.getByTitle('Group tasks by...'));
      await user.click(screen.getByText('By Assignee'));

      expect(onChange).toHaveBeenCalledWith('assignee');
    });

    it('should close the menu after selecting an option', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<GroupingDropdown value="none" onChange={onChange} />);

      await user.click(screen.getByTitle('Group tasks by...'));
      await user.click(screen.getByText('By Epic'));

      expect(screen.queryByText('By Sprint')).not.toBeInTheDocument();
    });

    it('should show a checkmark on the currently selected option', async () => {
      const user = userEvent.setup();
      render(<GroupingDropdown value="assignee" />);

      await user.click(screen.getByTitle('Group tasks by...'));

      // Find menu items by their class
      const menuItems = document.querySelectorAll('.grouping-dropdown-item');
      const assigneeItem = Array.from(menuItems).find((el) =>
        el.textContent?.includes('By Assignee'),
      );
      expect(assigneeItem).toHaveClass('selected');
    });

    it('should not show checkmark on non-selected options', async () => {
      const user = userEvent.setup();
      render(<GroupingDropdown value="assignee" />);

      await user.click(screen.getByTitle('Group tasks by...'));

      const menuItems = document.querySelectorAll('.grouping-dropdown-item');
      const epicItem = Array.from(menuItems).find((el) =>
        el.textContent?.includes('By Epic'),
      );
      expect(epicItem).not.toHaveClass('selected');
    });

    it('should handle onChange being undefined', async () => {
      const user = userEvent.setup();
      render(<GroupingDropdown value="none" />);

      await user.click(screen.getByTitle('Group tasks by...'));
      // Should not throw
      await user.click(screen.getByText('By Assignee'));
    });
  });

  describe('all grouping options', () => {
    it('should display all 4 options in the menu', async () => {
      const user = userEvent.setup();
      render(<GroupingDropdown value="none" />);

      await user.click(screen.getByTitle('Group tasks by...'));

      const options = screen
        .getAllByRole('button')
        .filter((btn) => btn.classList.contains('grouping-dropdown-item'));
      expect(options).toHaveLength(4);
    });

    it('should allow selecting each non-default option', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      // Test non-default options to avoid duplicate text issues
      const options = [
        { value: 'assignee', label: 'By Assignee' },
        { value: 'epic', label: 'By Epic' },
        { value: 'sprint', label: 'By Sprint' },
      ];

      for (const opt of options) {
        const { unmount } = render(
          <GroupingDropdown value="none" onChange={onChange} />,
        );

        await user.click(screen.getByTitle('Group tasks by...'));
        await user.click(screen.getByText(opt.label));

        expect(onChange).toHaveBeenCalledWith(opt.value);
        onChange.mockClear();
        unmount();
      }
    });
  });
});
