// @ts-nocheck
/**
 * BoardSelector Component
 *
 * Dropdown selector for switching between Kanban boards.
 * Shows current board, allows switching, and provides buttons for creating/editing boards.
 */

import './BoardSelector.css';

/**
 * @param {Object} props
 * @param {import('../../types/issueBoard').IssueBoard[]} props.boards - List of available boards
 * @param {import('../../types/issueBoard').IssueBoard | null} props.currentBoard - Currently selected board
 * @param {function} props.onSelectBoard - Callback when board is selected (boardId: string) => void
 * @param {function} props.onCreateBoard - Callback when "New Board" is clicked
 * @param {function} props.onEditBoard - Callback when settings button is clicked
 * @param {boolean} props.loading - Whether boards are loading
 * @param {boolean} props.saving - Whether a save operation is in progress
 */
export function BoardSelector({
  boards = [],
  currentBoard,
  onSelectBoard,
  onCreateBoard,
  onEditBoard,
  loading = false,
  saving = false,
}) {
  const handleBoardChange = (e) => {
    const boardId = e.target.value;
    if (boardId) {
      onSelectBoard(boardId);
    }
  };

  return (
    <div className="board-selector">
      {/* Board dropdown */}
      <div className="board-selector-dropdown">
        <label className="board-selector-label">Board:</label>
        <select
          value={currentBoard?.id || ''}
          onChange={handleBoardChange}
          className="board-selector-select"
          disabled={loading || saving}
        >
          {boards.length === 0 ? (
            <option value="">No boards</option>
          ) : (
            <>
              <option value="" disabled>
                Select board...
              </option>
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      {/* New Board button */}
      <button
        onClick={onCreateBoard}
        className="board-selector-btn board-selector-btn-new"
        title="Create New Board"
        disabled={loading || saving}
      >
        <i className="fas fa-plus" />
        <span>Board</span>
      </button>

      {/* Settings button (only if board is selected) */}
      {currentBoard && (
        <button
          onClick={onEditBoard}
          className="board-selector-btn board-selector-btn-settings"
          title="Board Settings"
          disabled={loading || saving}
        >
          <i className="fas fa-cog" />
        </button>
      )}

      {/* Loading indicator */}
      {(loading || saving) && (
        <span className="board-selector-loading">
          <i className="fas fa-spinner fa-spin" />
        </span>
      )}
    </div>
  );
}
