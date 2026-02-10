/**
 * Credential Manager Component
 * Modal for managing GitLab credentials (URL + token pairs)
 *
 * Features:
 * - List view: Display all credentials with name, URL, and usage count
 * - Form view: Add/edit credentials with connection testing
 * - Auto-fill name from domain on successful connection test
 * - Delete confirmation with usage warning
 */

import { useState, useEffect, useCallback } from 'react';
import './shared/modal-close-button.css';
import {
  gitlabCredentialManager,
  GitLabCredentialManager,
} from '../config/DataSourceCredentialManager';
import { gitlabConfigManager } from '../config/DataSourceConfigManager';
import { ConfirmDialog } from './shared/dialogs/ConfirmDialog';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close callback
 * @param {Function} props.onCredentialsChange - Callback when credentials change
 */
export function CredentialManager({ isOpen, onClose, onCredentialsChange }) {
  const [credentials, setCredentials] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCredential, setEditingCredential] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    gitlabUrl: 'https://gitlab.com',
    token: '',
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  // Dialog states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCredentialId, setDeleteCredentialId] = useState(null);
  const [deleteWarningMessage, setDeleteWarningMessage] = useState('');

  const loadCredentials = useCallback(() => {
    const allCredentials = gitlabCredentialManager.getAllCredentials();
    setCredentials(allCredentials);
  }, []);

  /**
   * Get the number of configs using a specific credential
   */
  const getUsageCount = useCallback((credentialId) => {
    const configs = gitlabConfigManager.getConfigsByCredential(credentialId);
    return configs.length;
  }, []);

  // Load credentials when modal opens
  useEffect(() => {
    if (isOpen) {
      loadCredentials();
    }
  }, [isOpen, loadCredentials]);

  // ============ List View Actions ============

  const handleAddNew = () => {
    setEditingCredential(null);
    setFormData({
      name: '',
      gitlabUrl: 'https://gitlab.com',
      token: '',
    });
    setConnectionStatus(null);
    setShowForm(true);
  };

  const handleEdit = (credential) => {
    setEditingCredential(credential);
    setFormData({
      name: credential.name,
      gitlabUrl: credential.gitlabUrl,
      token: credential.token,
    });
    setConnectionStatus(null);
    setShowForm(true);
  };

  const handleDelete = (credentialId) => {
    const usageCount = getUsageCount(credentialId);
    const credential = gitlabCredentialManager.getCredential(credentialId);

    if (usageCount > 0) {
      setDeleteWarningMessage(
        `This credential "${credential?.name}" is currently used by ${usageCount} configuration(s). Deleting it will cause those configurations to stop working. Are you sure you want to delete it?`,
      );
    } else {
      setDeleteWarningMessage(
        `Are you sure you want to delete credential "${credential?.name}"?`,
      );
    }

    setDeleteCredentialId(credentialId);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deleteCredentialId) {
      gitlabCredentialManager.deleteCredential(deleteCredentialId);
      loadCredentials();

      if (onCredentialsChange) {
        onCredentialsChange();
      }
    }
    setDeleteConfirmOpen(false);
    setDeleteCredentialId(null);
    setDeleteWarningMessage('');
  };

  // ============ Form Actions ============

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);

    try {
      const result = await GitLabCredentialManager.testConnection({
        gitlabUrl: formData.gitlabUrl,
        token: formData.token,
      });

      setConnectionStatus(result);

      // Auto-fill name from domain if successful and name is empty
      if (result.success && !formData.name.trim()) {
        const domainName = GitLabCredentialManager.extractDomainName(
          formData.gitlabUrl,
        );
        setFormData((prev) => ({
          ...prev,
          name: domainName,
        }));
      }
    } catch (error) {
      setConnectionStatus({
        success: false,
        error: error.message,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSave = () => {
    // Basic validation
    if (!formData.name.trim()) {
      setConnectionStatus({
        success: false,
        error: 'Please enter a name',
      });
      return;
    }

    if (!formData.gitlabUrl.trim()) {
      setConnectionStatus({
        success: false,
        error: 'Please enter GitLab URL',
      });
      return;
    }

    if (!formData.token.trim()) {
      setConnectionStatus({
        success: false,
        error: 'Please enter Access Token',
      });
      return;
    }

    if (editingCredential) {
      // Update existing credential
      gitlabCredentialManager.updateCredential(editingCredential.id, formData);
    } else {
      // Add new credential
      gitlabCredentialManager.addCredential(formData);
    }

    loadCredentials();

    if (onCredentialsChange) {
      onCredentialsChange();
    }

    setShowForm(false);
  };

  const handleCancel = () => {
    setShowForm(false);
    setConnectionStatus(null);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleClose = () => {
    setShowForm(false);
    setConnectionStatus(null);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="modal-content credential-manager-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>
            {showForm
              ? editingCredential
                ? 'Edit Credential'
                : 'Add Credential'
              : 'Manage Credentials'}
          </h3>
          <button onClick={handleClose} className="modal-close-btn">
            &times;
          </button>
        </div>

        <div className="modal-body">
          {!showForm ? (
            // ============ List View ============
            <div className="credential-list">
              {credentials.length === 0 ? (
                <div className="empty-state">
                  <p>No credentials yet</p>
                  <p>
                    Click the button below to add your first GitLab credential
                  </p>
                </div>
              ) : (
                credentials.map((credential) => {
                  const usageCount = getUsageCount(credential.id);
                  return (
                    <div key={credential.id} className="credential-item">
                      <div className="credential-info">
                        <div className="credential-name">{credential.name}</div>
                        <div className="credential-url">
                          {credential.gitlabUrl}
                        </div>
                        <div className="credential-usage">
                          {usageCount > 0
                            ? `Used by ${usageCount} configuration(s)`
                            : 'Not in use'}
                        </div>
                      </div>
                      <div className="credential-actions">
                        <button
                          onClick={() => handleEdit(credential)}
                          className="btn-edit"
                          title="Edit"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(credential.id)}
                          className="btn-delete"
                          title="Delete"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            // ============ Form View ============
            <div className="credential-form">
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="e.g., Company GitLab"
                />
              </div>

              <div className="form-group">
                <label>GitLab URL *</label>
                <input
                  type="text"
                  value={formData.gitlabUrl}
                  onChange={(e) =>
                    handleInputChange('gitlabUrl', e.target.value)
                  }
                  placeholder="https://gitlab.com"
                />
              </div>

              <div className="form-group">
                <label>Access Token *</label>
                <input
                  type="password"
                  value={formData.token}
                  onChange={(e) => handleInputChange('token', e.target.value)}
                  placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                />
                <small>Requires a Personal Access Token with api scope</small>
              </div>

              <div className="form-group">
                <button
                  onClick={handleTestConnection}
                  disabled={
                    testingConnection || !formData.gitlabUrl || !formData.token
                  }
                  className="btn-test"
                >
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </button>

                {connectionStatus && (
                  <div
                    className={`connection-status ${
                      connectionStatus.success ? 'success' : 'error'
                    }`}
                  >
                    {connectionStatus.success
                      ? `Connection successful!${connectionStatus.username ? ` (${connectionStatus.username})` : ''}`
                      : `Failed: ${connectionStatus.error}`}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {!showForm ? (
            // List view footer
            <button onClick={handleAddNew} className="btn-save">
              Add Credential
            </button>
          ) : (
            // Form view footer
            <>
              <button onClick={handleCancel} className="btn-cancel">
                Cancel
              </button>
              <button onClick={handleSave} className="btn-save">
                Save
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        .credential-manager-modal {
          width: 90%;
          max-width: 550px;
        }

        .credential-manager-modal .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--wx-gitlab-modal-overlay);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }

        .credential-manager-modal .modal-content {
          background: var(--wx-gitlab-modal-background);
          border-radius: 8px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .credential-manager-modal .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--wx-gitlab-modal-border);
        }

        .credential-manager-modal .modal-header h3 {
          margin: 0;
          font-size: 18px;
          color: var(--wx-gitlab-modal-text);
        }

        .credential-manager-modal .modal-body {
          padding: 20px;
          min-height: 150px;
        }

        .credential-manager-modal .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 16px 20px;
          border-top: 1px solid var(--wx-gitlab-modal-border);
        }

        /* List View Styles */
        .credential-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .empty-state {
          text-align: center;
          padding: 32px 20px;
          color: var(--wx-gitlab-modal-hint-text);
        }

        .empty-state p {
          margin: 4px 0;
        }

        .credential-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: var(--wx-gitlab-filter-background, #f8f9fa);
          border-radius: 6px;
          border: 1px solid var(--wx-gitlab-filter-border, #e1e4e8);
        }

        .credential-info {
          flex: 1;
          min-width: 0;
        }

        .credential-name {
          font-weight: 600;
          font-size: 14px;
          color: var(--wx-gitlab-modal-text);
          margin-bottom: 2px;
        }

        .credential-url {
          font-size: 12px;
          color: var(--wx-gitlab-modal-hint-text);
          margin-bottom: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .credential-usage {
          font-size: 11px;
          color: var(--wx-gitlab-modal-hint-text);
        }

        .credential-actions {
          display: flex;
          gap: 6px;
          margin-left: 12px;
        }

        /* Form View Styles */
        .credential-form .form-group {
          margin-bottom: 16px;
        }

        .credential-form .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          font-size: 14px;
          color: var(--wx-gitlab-modal-text);
        }

        .credential-form .form-group input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid var(--wx-gitlab-filter-input-border);
          border-radius: 4px;
          background: var(--wx-gitlab-filter-input-background);
          color: var(--wx-gitlab-modal-text);
          font-size: 14px;
          box-sizing: border-box;
        }

        .credential-form .form-group small {
          display: block;
          margin-top: 4px;
          color: var(--wx-gitlab-modal-hint-text);
          font-size: 12px;
        }

        /* Button Styles */
        .credential-manager-modal .btn-edit,
        .credential-manager-modal .btn-delete {
          padding: 4px 10px;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .credential-manager-modal .btn-test,
        .credential-manager-modal .btn-save,
        .credential-manager-modal .btn-cancel {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .credential-manager-modal .btn-edit {
          background: #6c757d;
          color: white;
        }

        .credential-manager-modal .btn-edit:hover {
          background: #5a6268;
        }

        .credential-manager-modal .btn-delete {
          background: #dc3545;
          color: white;
        }

        .credential-manager-modal .btn-delete:hover {
          background: #c82333;
        }

        .credential-manager-modal .btn-test {
          background: #17a2b8;
          color: white;
        }

        .credential-manager-modal .btn-test:hover:not(:disabled) {
          background: #138496;
        }

        .credential-manager-modal .btn-test:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .credential-manager-modal .btn-save {
          background: #28a745;
          color: white;
        }

        .credential-manager-modal .btn-save:hover {
          background: #218838;
        }

        .credential-manager-modal .btn-cancel {
          background: #6c757d;
          color: white;
        }

        .credential-manager-modal .btn-cancel:hover {
          background: #5a6268;
        }

        /* Connection Status */
        .connection-status {
          margin-top: 8px;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 13px;
        }

        .connection-status.success {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .connection-status.error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }
      `}</style>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeleteCredentialId(null);
          setDeleteWarningMessage('');
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Credential"
        message={deleteWarningMessage}
        severity="danger"
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </div>
  );
}

export default CredentialManager;
