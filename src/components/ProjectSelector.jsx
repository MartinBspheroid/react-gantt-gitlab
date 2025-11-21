/**
 * Project Selector Component
 * Allows switching between multiple GitLab projects/groups
 */

import { useState, useEffect } from 'react';
import { gitlabConfigManager } from '../config/GitLabConfigManager';

export function ProjectSelector({ onProjectChange, currentConfigId }) {
  const [configs, setConfigs] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    gitlabUrl: '',
    token: '',
    type: 'project',
    projectId: '',
    groupId: '',
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = () => {
    const allConfigs = gitlabConfigManager.getAllConfigs();
    setConfigs(allConfigs);
  };

  const handleSelectConfig = (configId) => {
    gitlabConfigManager.setActiveConfig(configId);
    const config = gitlabConfigManager.getConfig(configId);
    if (config && onProjectChange) {
      onProjectChange(config);
    }
  };

  const handleAddNew = () => {
    setEditingConfig(null);
    setFormData({
      name: '',
      gitlabUrl: 'https://gitlab.com',
      token: '',
      type: 'project',
      projectId: '',
      groupId: '',
    });
    setConnectionStatus(null);
    setShowModal(true);
  };

  const handleEdit = (config) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      gitlabUrl: config.gitlabUrl,
      token: config.token,
      type: config.type,
      projectId: config.projectId || '',
      groupId: config.groupId || '',
    });
    setConnectionStatus(null);
    setShowModal(true);
  };

  const handleDelete = (configId) => {
    if (window.confirm('Are you sure you want to delete this configuration?')) {
      gitlabConfigManager.deleteConfig(configId);
      loadConfigs();

      // If deleted config was active, switch to another
      const activeConfig = gitlabConfigManager.getActiveConfig();
      if (activeConfig && onProjectChange) {
        onProjectChange(activeConfig);
      }
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);

    try {
      const result = await gitlabConfigManager.constructor.testConnection({
        gitlabUrl: formData.gitlabUrl,
        token: formData.token,
      });

      setConnectionStatus(result);
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
    const validation = gitlabConfigManager.constructor.validateConfig(formData);

    if (!validation.valid) {
      alert('Validation errors:\n' + validation.errors.join('\n'));
      return;
    }

    if (editingConfig) {
      // Update existing
      gitlabConfigManager.updateConfig(editingConfig.id, formData);
    } else {
      // Add new
      const newConfig = gitlabConfigManager.addConfig(formData);
      if (onProjectChange) {
        onProjectChange(newConfig);
      }
    }

    loadConfigs();
    setShowModal(false);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="gitlab-project-selector">
      <div className="selector-header">
        <select
          value={currentConfigId || ''}
          onChange={(e) => handleSelectConfig(e.target.value)}
          className="project-select"
        >
          <option value="">Select GitLab Project/Group...</option>
          {configs.map((config) => (
            <option key={config.id} value={config.id}>
              {config.name} ({config.type})
            </option>
          ))}
        </select>

        <button onClick={handleAddNew} className="btn-add" title="Add new configuration">
          + Add
        </button>
      </div>

      {currentConfigId && (
        <div className="selector-actions">
          {configs.map(
            (config) =>
              config.id === currentConfigId && (
                <div key={config.id} className="config-actions">
                  <button
                    onClick={() => handleEdit(config)}
                    className="btn-edit"
                    title="Edit configuration"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(config.id)}
                    className="btn-delete"
                    title="Delete configuration"
                  >
                    Delete
                  </button>
                </div>
              )
          )}
        </div>
      )}

      {showModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            // Only close if clicking directly on overlay (not dragging from content)
            if (e.target === e.currentTarget) {
              setShowModal(false);
            }
          }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingConfig ? 'Edit Configuration' : 'Add New Configuration'}</h3>
              <button onClick={() => setShowModal(false)} className="btn-close">
                &times;
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Configuration Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="My GitLab Project"
                />
              </div>

              <div className="form-group">
                <label>GitLab URL *</label>
                <input
                  type="text"
                  value={formData.gitlabUrl}
                  onChange={(e) => handleInputChange('gitlabUrl', e.target.value)}
                  placeholder="https://gitlab.com or https://gitlab.example.com"
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
                <small>Personal Access Token with api scope</small>
              </div>

              <div className="form-group">
                <button
                  onClick={handleTestConnection}
                  disabled={testingConnection || !formData.gitlabUrl || !formData.token}
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
                      ? 'Connection successful!'
                      : `Failed: ${connectionStatus.error}`}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                >
                  <option value="project">Project</option>
                  <option value="group">Group</option>
                </select>
              </div>

              {formData.type === 'project' && (
                <div className="form-group">
                  <label>Project ID *</label>
                  <input
                    type="text"
                    value={formData.projectId}
                    onChange={(e) => handleInputChange('projectId', e.target.value)}
                    placeholder="12345 or namespace/project-name"
                  />
                  <small>Numeric ID or URL-encoded path</small>
                </div>
              )}

              {formData.type === 'group' && (
                <div className="form-group">
                  <label>Group ID *</label>
                  <input
                    type="text"
                    value={formData.groupId}
                    onChange={(e) => handleInputChange('groupId', e.target.value)}
                    placeholder="12345 or group-name"
                  />
                  <small>Numeric ID or URL-encoded path</small>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn-cancel">
                Cancel
              </button>
              <button onClick={handleSave} className="btn-save">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .gitlab-project-selector {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          background: var(--wx-gitlab-filter-background);
          border-bottom: 1px solid var(--wx-gitlab-filter-border);
        }

        .selector-header {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .project-select {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid var(--wx-gitlab-button-border);
          border-radius: 4px;
          font-size: 14px;
          background: var(--wx-gitlab-button-background);
          color: var(--wx-gitlab-button-text);
        }

        .btn-add, .btn-edit, .btn-delete, .btn-test, .btn-save, .btn-cancel {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-add {
          background: #1f75cb;
          color: white;
        }

        .btn-add:hover {
          background: #1662b0;
        }

        .btn-edit {
          background: #6c757d;
          color: white;
        }

        .btn-edit:hover {
          background: #5a6268;
        }

        .btn-delete {
          background: #dc3545;
          color: white;
        }

        .btn-delete:hover {
          background: #c82333;
        }

        .btn-test {
          background: #17a2b8;
          color: white;
        }

        .btn-test:hover:not(:disabled) {
          background: #138496;
        }

        .btn-test:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-save {
          background: #28a745;
          color: white;
        }

        .btn-save:hover {
          background: #218838;
        }

        .btn-cancel {
          background: #6c757d;
          color: white;
        }

        .btn-cancel:hover {
          background: #5a6268;
        }

        .selector-actions {
          display: flex;
          gap: 8px;
        }

        .config-actions {
          display: flex;
          gap: 8px;
        }

        .modal-overlay {
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

        .modal-content {
          background: var(--wx-gitlab-modal-background);
          border-radius: 8px;
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--wx-gitlab-modal-border);
        }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          color: var(--wx-gitlab-modal-text);
        }

        .btn-close {
          background: none;
          border: none;
          font-size: 28px;
          cursor: pointer;
          color: var(--wx-gitlab-button-text);
          line-height: 1;
          padding: 0;
          width: 32px;
          height: 32px;
        }

        .btn-close:hover {
          color: var(--wx-gitlab-button-hover-text);
        }

        .modal-body {
          padding: 20px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          font-size: 14px;
          color: var(--wx-gitlab-modal-text);
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid var(--wx-gitlab-filter-input-border);
          border-radius: 4px;
          background: var(--wx-gitlab-filter-input-background);
          color: var(--wx-gitlab-modal-text);
          font-size: 14px;
          box-sizing: border-box;
        }

        .form-group small {
          display: block;
          margin-top: 4px;
          color: var(--wx-gitlab-modal-hint-text);
          font-size: 12px;
        }

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

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 16px 20px;
          border-top: 1px solid var(--wx-gitlab-modal-border);
        }
      `}</style>
    </div>
  );
}
