/**
 * Project Selector Component
 * Allows switching between multiple GitLab projects/groups
 *
 * Features:
 * - 4-step wizard for new configurations (Type → Credential → Browse → Confirm)
 * - Legacy edit flow for existing configs
 * - Credential selection with inline creation option
 * - ProjectBrowser integration for browsing projects/groups
 * - Warning indicator for configs with missing credentials
 */

import { useState, useEffect } from 'react';
import './shared/modal-close-button.css';
import {
  gitlabConfigManager,
  GitLabConfigManager,
} from '../config/DataSourceConfigManager';
import {
  gitlabCredentialManager,
  GitLabCredentialManager,
} from '../config/DataSourceCredentialManager';
import { CredentialManager } from './CredentialManager';
import { ProjectBrowser } from './ProjectBrowser';
import { ConfirmDialog } from './shared/dialogs/ConfirmDialog';

export function ProjectSelector({
  onProjectChange,
  currentConfigId,
  onConfigsChange,
}) {
  const [configs, setConfigs] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'project',
    projectId: '',
    groupId: '',
    // fullPath for GitLab GraphQL API queries
    fullPath: '',
    // Legacy fields for editing existing configs
    gitlabUrl: '',
    token: '',
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  // Dialog states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfigId, setDeleteConfigId] = useState(null);
  const [validationErrorOpen, setValidationErrorOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  // Credential manager modal
  const [showCredentialManager, setShowCredentialManager] = useState(false);

  // New wizard flow states
  const [wizardStep, setWizardStep] = useState(1); // 1: type, 2: credential, 3: browse, 4: confirm
  const [credentials, setCredentials] = useState([]);
  const [selectedCredentialId, setSelectedCredentialId] = useState(null);
  const [showNewCredentialForm, setShowNewCredentialForm] = useState(false);
  const [newCredentialData, setNewCredentialData] = useState({
    name: '',
    gitlabUrl: 'https://gitlab.com',
    token: '',
  });
  const [selectedProject, setSelectedProject] = useState(null);
  // Manual input mode for step 3 (alternative to tree browsing)
  const [useManualInput, setUseManualInput] = useState(false);
  const [manualProjectInput, setManualProjectInput] = useState('');
  // Show browser in edit mode
  const [showEditBrowser, setShowEditBrowser] = useState(false);

  // Check for missing credentials
  const [configsWithMissingCredentials, setConfigsWithMissingCredentials] =
    useState(new Set());

  const loadCredentials = () => {
    setCredentials(gitlabCredentialManager.getAllCredentials());
  };

  // Check for missing credentials when configs change
  useEffect(() => {
    const missingSet = new Set();
    configs.forEach((config) => {
      if (!gitlabConfigManager.hasValidCredential(config.id)) {
        missingSet.add(config.id);
      }
    });
    setConfigsWithMissingCredentials(missingSet);
  }, [configs]);

  const loadConfigs = () => {
    const allConfigs = gitlabConfigManager.getAllConfigs();
    setConfigs(allConfigs);
  };

  useEffect(() => {
    loadCredentials();
  }, []);

  useEffect(() => {
    loadConfigs();
  }, []);

  const handleSelectConfig = (configId) => {
    gitlabConfigManager.setActiveConfig(configId);
    const config = gitlabConfigManager.getConfig(configId);
    if (config && onProjectChange) {
      onProjectChange(config);
    }
  };

  const handleAddNew = () => {
    setEditingConfig(null);
    setWizardStep(1);
    setFormData({
      name: '',
      type: 'project',
      projectId: '',
      groupId: '',
      fullPath: '',
      gitlabUrl: '',
      token: '',
    });
    setSelectedCredentialId(null);
    setSelectedProject(null);
    setShowNewCredentialForm(false);
    setNewCredentialData({
      name: '',
      gitlabUrl: 'https://gitlab.com',
      token: '',
    });
    setUseManualInput(false);
    setManualProjectInput('');
    setConnectionStatus(null);
    setShowModal(true);
    loadCredentials();
  };

  const handleEdit = (config) => {
    setEditingConfig(config);
    // For editing, we'll get the credential info
    const configWithCred = gitlabConfigManager.getConfigWithCredential(
      config.id,
    );
    setFormData({
      name: config.name,
      gitlabUrl: configWithCred?.credential?.gitlabUrl || '',
      token: configWithCred?.credential?.token || '',
      type: config.type,
      projectId: config.projectId || '',
      groupId: config.groupId || '',
      fullPath: config.fullPath || '',
    });
    setSelectedCredentialId(config.credentialId);
    setShowEditBrowser(false);
    setConnectionStatus(null);
    setShowModal(true);
    loadCredentials();
  };

  const handleDelete = (configId) => {
    setDeleteConfigId(configId);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deleteConfigId) {
      gitlabConfigManager.deleteConfig(deleteConfigId);
      loadConfigs();
      // Notify parent to refresh its configs list
      if (onConfigsChange) {
        onConfigsChange();
      }

      // If deleted config was active, switch to another
      const activeConfig = gitlabConfigManager.getActiveConfig();
      if (activeConfig && onProjectChange) {
        onProjectChange(activeConfig);
      }
    }
    setDeleteConfirmOpen(false);
    setDeleteConfigId(null);
  };

  // Wizard navigation functions
  const handleWizardNext = () => {
    if (wizardStep === 1) {
      // Type selection - just move forward
      setWizardStep(2);
    } else if (wizardStep === 2) {
      // Credential selection - validate credential is selected
      if (!selectedCredentialId) {
        setConnectionStatus({
          success: false,
          error: 'Please select or add a credential',
        });
        return;
      }
      setConnectionStatus(null);
      setWizardStep(3);
    } else if (wizardStep === 3) {
      // Project/Group selection - validate selection (either from browser or manual input)
      if (useManualInput) {
        // Manual input mode - validate input
        const trimmedInput = manualProjectInput.trim();
        if (!trimmedInput) {
          setConnectionStatus({
            success: false,
            error:
              formData.type === 'project'
                ? 'Please enter project ID or path'
                : 'Please enter group ID or path',
          });
          return;
        }
        // Set the ID directly from manual input
        // Manual input is assumed to be a fullPath (e.g., "namespace/project-name")
        setFormData((prev) => ({
          ...prev,
          projectId: formData.type === 'project' ? trimmedInput : '',
          groupId: formData.type === 'group' ? trimmedInput : '',
          // Store fullPath for GitLab GraphQL API queries
          fullPath: trimmedInput,
          // Use the input as name if name is empty
          name: prev.name || trimmedInput.split('/').pop() || trimmedInput,
        }));
        // Create a fake selectedProject for the confirmation screen
        setSelectedProject({
          id: trimmedInput,
          name: trimmedInput.split('/').pop() || trimmedInput,
          fullPath: trimmedInput,
          type: formData.type,
        });
      } else {
        // Browser mode - validate selection
        if (!selectedProject) {
          setConnectionStatus({
            success: false,
            error:
              formData.type === 'project'
                ? 'Please select a project'
                : 'Please select a group',
          });
          return;
        }
        // Auto-fill name from selected project/group
        if (!formData.name) {
          setFormData((prev) => ({
            ...prev,
            name: selectedProject.name,
          }));
        }
      }
      setConnectionStatus(null);
      setWizardStep(4);
    }
  };

  const handleWizardBack = () => {
    if (wizardStep > 1) {
      setWizardStep(wizardStep - 1);
      setConnectionStatus(null);
    }
  };

  // Test connection for new credential form
  const handleTestNewCredential = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);

    try {
      const result = await GitLabCredentialManager.testConnection({
        gitlabUrl: newCredentialData.gitlabUrl,
        token: newCredentialData.token,
      });

      setConnectionStatus(result);

      // Auto-fill name from domain if successful and name is empty
      if (result.success && !newCredentialData.name.trim()) {
        const domainName = GitLabCredentialManager.extractDomainName(
          newCredentialData.gitlabUrl,
        );
        setNewCredentialData((prev) => ({
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

  // Save inline new credential
  const handleNewCredentialSave = () => {
    if (!newCredentialData.name.trim()) {
      setConnectionStatus({
        success: false,
        error: 'Please enter a name',
      });
      return;
    }

    if (!newCredentialData.gitlabUrl.trim()) {
      setConnectionStatus({
        success: false,
        error: 'Please enter GitLab URL',
      });
      return;
    }

    if (!newCredentialData.token.trim()) {
      setConnectionStatus({
        success: false,
        error: 'Please enter Access Token',
      });
      return;
    }

    // Add the new credential
    const newCred = gitlabCredentialManager.addCredential(newCredentialData);

    // Refresh credentials list and select the new one
    loadCredentials();
    setSelectedCredentialId(newCred.id);
    setShowNewCredentialForm(false);
    setNewCredentialData({
      name: '',
      gitlabUrl: 'https://gitlab.com',
      token: '',
    });
    setConnectionStatus(null);
  };

  // Handle project/group selection from ProjectBrowser
  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    setFormData((prev) => ({
      ...prev,
      projectId: project.type === 'project' ? String(project.id) : '',
      groupId: project.type === 'group' ? String(project.id) : '',
      // Store fullPath for GitLab GraphQL API queries
      fullPath: project.fullPath,
    }));
  };

  // Get proxy config for ProjectBrowser
  const getProxyConfigForCredential = (credentialId) => {
    const credential = gitlabCredentialManager.getCredential(credentialId);
    if (!credential) return null;
    return {
      gitlabUrl: credential.gitlabUrl,
      token: credential.token,
    };
  };

  const handleSave = () => {
    if (editingConfig) {
      // Legacy edit flow - update existing config
      // NOTE: For editing, we still need to handle both legacy and new configs
      // Legacy configs may have inline gitlabUrl/token, new configs use credentialId
      const updates = {
        name: formData.name,
        type: formData.type,
        projectId: formData.type === 'project' ? formData.projectId : undefined,
        groupId: formData.type === 'group' ? formData.groupId : undefined,
        // Include fullPath for GitLab GraphQL API queries
        fullPath: formData.fullPath || undefined,
      };

      // If a credential is selected, update it
      if (selectedCredentialId) {
        updates.credentialId = selectedCredentialId;
      }

      gitlabConfigManager.updateConfig(editingConfig.id, updates);
    } else {
      // New config flow with wizard - use credentialId
      const newConfigData = {
        name: formData.name,
        type: formData.type,
        credentialId: selectedCredentialId,
        projectId: formData.type === 'project' ? formData.projectId : undefined,
        groupId: formData.type === 'group' ? formData.groupId : undefined,
        // Include fullPath for GitLab GraphQL API queries
        fullPath: formData.fullPath || undefined,
      };

      const validation = GitLabConfigManager.validateConfig(newConfigData);

      if (!validation.valid) {
        setValidationErrors(validation.errors);
        setValidationErrorOpen(true);
        return;
      }

      // Add new and set as active
      const newConfig = gitlabConfigManager.addConfig(newConfigData);
      gitlabConfigManager.setActiveConfig(newConfig.id);
      if (onProjectChange) {
        onProjectChange(newConfig);
      }
    }

    loadConfigs();
    // Notify parent to refresh its configs list
    if (onConfigsChange) {
      onConfigsChange();
    }
    setShowModal(false);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle credential manager close
  const handleCredentialManagerClose = () => {
    setShowCredentialManager(false);
    // Refresh credentials list in case changes were made
    loadCredentials();
  };

  // Render wizard step indicator
  const renderWizardSteps = () => {
    const steps = [
      { num: 1, label: 'Type' },
      { num: 2, label: 'Credential' },
      { num: 3, label: 'Select' },
      { num: 4, label: 'Confirm' },
    ];

    return (
      <div className="wizard-steps">
        {steps.map((step, idx) => (
          <div
            key={step.num}
            className={`step ${wizardStep === step.num ? 'active' : ''} ${wizardStep > step.num ? 'completed' : ''}`}
          >
            <span className="step-number">{step.num}</span>
            <span className="step-label">{step.label}</span>
            {idx < steps.length - 1 && <span className="step-connector" />}
          </div>
        ))}
      </div>
    );
  };

  // Render wizard step content
  const renderWizardContent = () => {
    switch (wizardStep) {
      case 1:
        // Type selection
        return (
          <div className="wizard-content">
            <div className="form-group">
              <label>Select Type *</label>
              <div className="radio-group">
                <label
                  className={`radio-option ${formData.type === 'project' ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="type"
                    value="project"
                    checked={formData.type === 'project'}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                  />
                  <span className="radio-label">
                    <span className="radio-title">Project</span>
                    <span className="radio-desc">
                      A single GitLab project
                      (gitlab.com/namespace/project-name)
                    </span>
                  </span>
                </label>
                <label
                  className={`radio-option ${formData.type === 'group' ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="type"
                    value="group"
                    checked={formData.type === 'group'}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                  />
                  <span className="radio-label">
                    <span className="radio-title">Group</span>
                    <span className="radio-desc">
                      All projects within a GitLab group (gitlab.com/group-name)
                    </span>
                  </span>
                </label>
              </div>
              {formData.type === 'group' && (
                <small className="type-warning">
                  <i className="fas fa-exclamation-triangle"></i>
                  <span>
                    Group mode has limited functionality: Holidays, Color Rules,
                    and Filter Presets are not available because GitLab does not
                    support Group Snippets.
                  </span>
                </small>
              )}
            </div>
          </div>
        );

      case 2:
        // Credential selection
        return (
          <div className="wizard-content">
            <div className="form-group">
              <div className="credential-header">
                <label>Select Credential *</label>
              </div>
              {!showNewCredentialForm ? (
                <>
                  <select
                    value={selectedCredentialId || ''}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        setShowNewCredentialForm(true);
                        setSelectedCredentialId(null);
                      } else {
                        setSelectedCredentialId(e.target.value);
                      }
                    }}
                    className="credential-select"
                  >
                    <option value="">Select Credential...</option>
                    {credentials.map((cred) => (
                      <option key={cred.id} value={cred.id}>
                        {cred.name} ({cred.gitlabUrl})
                      </option>
                    ))}
                    <option value="__new__">+ Add New Credential</option>
                  </select>
                  {selectedCredentialId && (
                    <div className="selected-info">
                      {(() => {
                        const cred = credentials.find(
                          (c) => c.id === selectedCredentialId,
                        );
                        return cred
                          ? `Selected: ${cred.name} (${cred.gitlabUrl})`
                          : '';
                      })()}
                    </div>
                  )}
                </>
              ) : (
                <div className="new-credential-form">
                  <div className="form-group">
                    <label>Name *</label>
                    <input
                      type="text"
                      value={newCredentialData.name}
                      onChange={(e) =>
                        setNewCredentialData((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder="e.g., Company GitLab"
                    />
                  </div>

                  <div className="form-group">
                    <label>GitLab URL *</label>
                    <input
                      type="text"
                      value={newCredentialData.gitlabUrl}
                      onChange={(e) =>
                        setNewCredentialData((prev) => ({
                          ...prev,
                          gitlabUrl: e.target.value,
                        }))
                      }
                      placeholder="https://gitlab.com"
                    />
                  </div>

                  <div className="form-group">
                    <label>Access Token *</label>
                    <input
                      type="password"
                      value={newCredentialData.token}
                      onChange={(e) =>
                        setNewCredentialData((prev) => ({
                          ...prev,
                          token: e.target.value,
                        }))
                      }
                      placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                    />
                    <small>
                      Requires a Personal Access Token with api scope
                    </small>
                  </div>

                  <div className="form-group">
                    <button
                      onClick={handleTestNewCredential}
                      disabled={
                        testingConnection ||
                        !newCredentialData.gitlabUrl ||
                        !newCredentialData.token
                      }
                      className="btn-test"
                    >
                      {testingConnection ? 'Testing...' : 'Test Connection'}
                    </button>
                  </div>

                  <div className="new-credential-actions">
                    <button
                      onClick={() => {
                        setShowNewCredentialForm(false);
                        setConnectionStatus(null);
                        setNewCredentialData({
                          name: '',
                          gitlabUrl: 'https://gitlab.com',
                          token: '',
                        });
                      }}
                      className="btn-cancel-small"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleNewCredentialSave}
                      className="btn-save-small"
                    >
                      Save Credential
                    </button>
                  </div>
                </div>
              )}
            </div>
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
        );

      case 3:
        // Project/Group browser with manual input option
        return (
          <div className="wizard-content">
            <div className="form-group">
              <div className="select-mode-toggle">
                <label>
                  Select {formData.type === 'project' ? 'Project' : 'Group'} *
                </label>
                <button
                  type="button"
                  className="btn-toggle-mode"
                  onClick={() => {
                    setUseManualInput(!useManualInput);
                    setConnectionStatus(null);
                  }}
                >
                  {useManualInput ? 'Browse List' : 'Enter Manually'}
                </button>
              </div>

              {useManualInput ? (
                // Manual input mode
                <div className="manual-input-section">
                  <input
                    type="text"
                    value={manualProjectInput}
                    onChange={(e) => setManualProjectInput(e.target.value)}
                    placeholder={
                      formData.type === 'project'
                        ? 'Enter project ID or path (e.g., 12345 or namespace/project-name)'
                        : 'Enter group ID or path (e.g., 12345 or group-name)'
                    }
                    className="manual-input"
                  />
                  <small className="manual-input-hint">
                    Enter the numeric ID or full path (namespace/project-name)
                  </small>
                </div>
              ) : selectedCredentialId ? (
                // Browser mode
                <ProjectBrowser
                  proxyConfig={getProxyConfigForCredential(
                    selectedCredentialId,
                  )}
                  type={formData.type}
                  onSelect={handleProjectSelect}
                  selectedId={
                    selectedProject
                      ? `${selectedProject.type}-${selectedProject.id}`
                      : null
                  }
                />
              ) : (
                <div className="pb-status pb-error">
                  Missing credential settings
                </div>
              )}
            </div>
            {connectionStatus && (
              <div
                className={`connection-status ${
                  connectionStatus.success ? 'success' : 'error'
                }`}
              >
                {connectionStatus.error}
              </div>
            )}
          </div>
        );

      case 4:
        // Confirmation
        return (
          <div className="wizard-content">
            <div className="form-group">
              <label>Configuration Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="My GitLab Project"
              />
            </div>

            <div className="confirm-summary">
              <h4>Summary</h4>
              <div className="summary-item">
                <span className="summary-label">Type:</span>
                <span className="summary-value">
                  {formData.type === 'project' ? 'Project' : 'Group'}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Credential:</span>
                <span className="summary-value">
                  {(() => {
                    const cred = credentials.find(
                      (c) => c.id === selectedCredentialId,
                    );
                    return cred ? `${cred.name} (${cred.gitlabUrl})` : '-';
                  })()}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">
                  {formData.type === 'project' ? 'Project' : 'Group'}:
                </span>
                <span className="summary-value">
                  {selectedProject
                    ? `${selectedProject.name} (${selectedProject.fullPath})`
                    : '-'}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">ID:</span>
                <span className="summary-value">
                  {formData.type === 'project'
                    ? formData.projectId
                    : formData.groupId}
                </span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Render legacy edit form
  const renderLegacyEditForm = () => (
    <>
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
        <label>Credential *</label>
        <select
          value={selectedCredentialId || ''}
          onChange={(e) => setSelectedCredentialId(e.target.value)}
          className="credential-select"
        >
          <option value="">Select Credential...</option>
          {credentials.map((cred) => (
            <option key={cred.id} value={cred.id}>
              {cred.name} ({cred.gitlabUrl})
            </option>
          ))}
        </select>
        {!selectedCredentialId && formData.gitlabUrl && (
          <small className="type-warning">
            <span>
              This configuration uses legacy format. Please select or add a
              credential to update.
            </span>
          </small>
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
        <small className="type-hint">
          {formData.type === 'project'
            ? 'Use "Project" for a single GitLab repository (gitlab.com/namespace/project-name)'
            : 'Use "Group" to view issues from all projects within a GitLab group (gitlab.com/group-name)'}
        </small>
        {formData.type === 'group' && (
          <small className="type-warning">
            <i className="fas fa-exclamation-triangle"></i>
            <span>
              Group mode has limited functionality: Holidays, Color Rules, and
              Filter Presets are not available because GitLab does not support
              Group Snippets.
            </span>
          </small>
        )}
      </div>

      <div className="form-group">
        <div className="select-mode-toggle">
          <label>
            {formData.type === 'project' ? 'Project' : 'Group'} ID *
          </label>
          {selectedCredentialId && (
            <button
              type="button"
              className="btn-toggle-mode"
              onClick={() => setShowEditBrowser(!showEditBrowser)}
            >
              {showEditBrowser ? 'Enter Manually' : 'Browse List'}
            </button>
          )}
        </div>

        {showEditBrowser && selectedCredentialId ? (
          <ProjectBrowser
            proxyConfig={getProxyConfigForCredential(selectedCredentialId)}
            type={formData.type}
            onSelect={(project) => {
              handleProjectSelect(project);
              setShowEditBrowser(false);
            }}
            selectedId={
              formData.type === 'project' && formData.projectId
                ? `project-${formData.projectId}`
                : formData.type === 'group' && formData.groupId
                  ? `group-${formData.groupId}`
                  : null
            }
          />
        ) : (
          <>
            <input
              type="text"
              value={
                formData.type === 'project'
                  ? formData.projectId
                  : formData.groupId
              }
              onChange={(e) =>
                handleInputChange(
                  formData.type === 'project' ? 'projectId' : 'groupId',
                  e.target.value,
                )
              }
              placeholder={
                formData.type === 'project'
                  ? '12345 or namespace/project-name'
                  : '12345 or group-name'
              }
            />
            <small>Numeric ID or URL-encoded path</small>
          </>
        )}
      </div>
    </>
  );

  return (
    <div className="gitlab-project-selector">
      <div className="selector-header">
        {/* Credential button - only show when a project is selected */}
        {currentConfigId && (
          <button
            onClick={() => setShowCredentialManager(true)}
            className="btn-credentials"
            title="Manage Credentials"
          >
            <i className="fas fa-key"></i>
          </button>
        )}

        <select
          value={currentConfigId || ''}
          onChange={(e) => handleSelectConfig(e.target.value)}
          className="project-select"
        >
          <option value="">Select GitLab Project/Group...</option>
          {configs.map((config) => (
            <option key={config.id} value={config.id}>
              {configsWithMissingCredentials.has(config.id) ? '⚠️ ' : ''}
              {config.name} ({config.type})
            </option>
          ))}
        </select>

        <button
          onClick={handleAddNew}
          className="btn-add"
          title="Add new configuration"
        >
          + Add
        </button>
      </div>

      {currentConfigId && (
        <div className="selector-actions">
          {configs.map(
            (config) =>
              config.id === currentConfigId && (
                <div key={config.id} className="config-actions">
                  {configsWithMissingCredentials.has(config.id) && (
                    <span
                      className="missing-credential-warning"
                      title="Credential for this configuration is missing"
                    >
                      ⚠️
                    </span>
                  )}
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
              ),
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
          <div
            className="modal-content project-selector-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>
                {editingConfig ? 'Edit Configuration' : 'Add Configuration'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="modal-close-btn"
              >
                &times;
              </button>
            </div>

            <div className="modal-body">
              {editingConfig ? (
                // Legacy edit form for existing configs
                renderLegacyEditForm()
              ) : (
                // New wizard flow
                <>
                  {renderWizardSteps()}
                  {renderWizardContent()}
                </>
              )}
            </div>

            <div className="modal-footer">
              {editingConfig ? (
                // Legacy footer for editing
                <>
                  <button
                    onClick={() => setShowModal(false)}
                    className="btn-cancel"
                  >
                    Cancel
                  </button>
                  <button onClick={handleSave} className="btn-save">
                    Save
                  </button>
                </>
              ) : (
                // Wizard footer
                <>
                  {wizardStep > 1 && (
                    <button onClick={handleWizardBack} className="btn-back">
                      Back
                    </button>
                  )}
                  <button
                    onClick={() => setShowModal(false)}
                    className="btn-cancel"
                  >
                    Cancel
                  </button>
                  {wizardStep < 4 ? (
                    <button
                      onClick={handleWizardNext}
                      className="btn-next"
                      disabled={
                        wizardStep === 2 && showNewCredentialForm // Disable next when editing new credential
                      }
                    >
                      Next
                    </button>
                  ) : (
                    <button onClick={handleSave} className="btn-save">
                      Save
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .gitlab-project-selector {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
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
          padding: 4px 8px;
          border: 1px solid var(--wx-gitlab-button-border);
          border-radius: 4px;
          font-size: 13px;
          background: var(--wx-gitlab-button-background);
          color: var(--wx-gitlab-button-text);
        }

        .btn-add, .btn-edit, .btn-delete, .btn-credentials {
          padding: 4px 10px;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-test, .btn-save, .btn-cancel, .btn-back, .btn-next {
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

        .btn-credentials {
          background: #6c757d;
          color: white;
        }

        .btn-credentials:hover {
          background: #5a6268;
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

        .btn-back {
          background: #6c757d;
          color: white;
          margin-right: auto;
        }

        .btn-back:hover {
          background: #5a6268;
        }

        .btn-next {
          background: #1f75cb;
          color: white;
        }

        .btn-next:hover:not(:disabled) {
          background: #1662b0;
        }

        .btn-next:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .selector-actions {
          display: flex;
          gap: 4px;
        }

        .config-actions {
          display: flex;
          gap: 4px;
          align-items: center;
        }

        .missing-credential-warning {
          font-size: 16px;
          margin-right: 4px;
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

        .project-selector-modal {
          max-width: 650px;
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

        .form-group small.type-hint {
          padding: 6px 8px;
          background: var(--wx-gitlab-filter-background, #f8f9fa);
          border-radius: 4px;
          border-left: 3px solid #1f75cb;
          font-style: italic;
        }

        .form-group small.type-warning {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 8px 10px;
          margin-top: 8px;
          background: #fff3cd;
          border-radius: 4px;
          border-left: 3px solid #d97706;
          color: #856404;
          font-style: normal;
        }

        .form-group small.type-warning i {
          color: #d97706;
          margin-top: 2px;
          flex-shrink: 0;
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

        /* Wizard Steps */
        .wizard-steps {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--wx-gitlab-modal-border);
        }

        .wizard-steps .step {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--wx-gitlab-modal-hint-text);
        }

        .wizard-steps .step.active {
          color: #1f75cb;
        }

        .wizard-steps .step.completed {
          color: #28a745;
        }

        .wizard-steps .step-number {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--wx-gitlab-filter-background, #f8f9fa);
          border: 2px solid currentColor;
          font-size: 12px;
          font-weight: 600;
        }

        .wizard-steps .step.active .step-number {
          background: #1f75cb;
          color: white;
          border-color: #1f75cb;
        }

        .wizard-steps .step.completed .step-number {
          background: #28a745;
          color: white;
          border-color: #28a745;
        }

        .wizard-steps .step-label {
          font-size: 13px;
          font-weight: 500;
        }

        .wizard-steps .step-connector {
          width: 30px;
          height: 2px;
          background: var(--wx-gitlab-modal-border);
          margin: 0 8px;
        }

        /* Radio Group */
        .radio-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .radio-option {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 16px;
          border: 2px solid var(--wx-gitlab-filter-input-border);
          border-radius: 8px;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
        }

        .radio-option:hover {
          border-color: #1f75cb;
          background: rgba(31, 117, 203, 0.05);
        }

        .radio-option.selected {
          border-color: #1f75cb;
          background: rgba(31, 117, 203, 0.1);
        }

        .radio-option input[type="radio"] {
          width: auto;
          margin-top: 4px;
        }

        .radio-label {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .radio-title {
          font-weight: 600;
          font-size: 14px;
          color: var(--wx-gitlab-modal-text);
        }

        .radio-desc {
          font-size: 12px;
          color: var(--wx-gitlab-modal-hint-text);
        }

        /* Credential Selection */
        .credential-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .credential-select {
          width: 100%;
        }

        .selected-info {
          margin-top: 8px;
          padding: 8px 12px;
          background: rgba(31, 117, 203, 0.1);
          border-radius: 4px;
          font-size: 13px;
          color: #1f75cb;
        }

        /* New Credential Form */
        .new-credential-form {
          padding: 16px;
          background: var(--wx-gitlab-filter-background, #f8f9fa);
          border-radius: 8px;
          border: 1px solid var(--wx-gitlab-filter-border);
        }

        .new-credential-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--wx-gitlab-filter-border);
        }

        .btn-cancel-small,
        .btn-save-small {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-cancel-small {
          background: #6c757d;
          color: white;
        }

        .btn-cancel-small:hover {
          background: #5a6268;
        }

        .btn-save-small {
          background: #28a745;
          color: white;
        }

        .btn-save-small:hover {
          background: #218838;
        }

        /* Confirmation Summary */
        .confirm-summary {
          padding: 16px;
          background: var(--wx-gitlab-filter-background, #f8f9fa);
          border-radius: 8px;
          border: 1px solid var(--wx-gitlab-filter-border);
        }

        .confirm-summary h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: var(--wx-gitlab-modal-text);
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid var(--wx-gitlab-filter-border);
        }

        .summary-item:last-child {
          border-bottom: none;
        }

        .summary-label {
          font-weight: 500;
          color: var(--wx-gitlab-modal-hint-text);
          font-size: 13px;
        }

        .summary-value {
          color: var(--wx-gitlab-modal-text);
          font-size: 13px;
          text-align: right;
          max-width: 60%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* ProjectBrowser status */
        .pb-status {
          padding: 20px;
          text-align: center;
          color: var(--wx-gitlab-control-text, #868686);
          font-size: 13px;
        }

        .pb-status.pb-error {
          color: #dc3545;
        }

        /* Select mode toggle */
        .select-mode-toggle {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .select-mode-toggle label {
          margin-bottom: 0;
        }

        .btn-toggle-mode {
          padding: 4px 10px;
          border: 1px solid #1f75cb;
          border-radius: 4px;
          background: transparent;
          color: #1f75cb;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }

        .btn-toggle-mode:hover {
          background: #1f75cb;
          color: white;
        }

        /* Manual input section */
        .manual-input-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .manual-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--wx-gitlab-filter-input-border);
          border-radius: 4px;
          background: var(--wx-gitlab-filter-input-background);
          color: var(--wx-gitlab-modal-text);
          font-size: 14px;
          box-sizing: border-box;
        }

        .manual-input:focus {
          outline: none;
          border-color: #1f75cb;
        }

        .manual-input-hint {
          color: var(--wx-gitlab-modal-hint-text);
          font-size: 12px;
        }
      `}</style>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeleteConfigId(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Configuration"
        message="Are you sure you want to delete this configuration?"
        severity="danger"
        confirmLabel="Delete"
      />

      {/* Validation Error Dialog */}
      <ConfirmDialog
        isOpen={validationErrorOpen}
        onClose={() => setValidationErrorOpen(false)}
        onConfirm={() => setValidationErrorOpen(false)}
        title="Validation Error"
        message={
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        }
        severity="warning"
        confirmLabel="OK"
        showCancel={false}
      />

      {/* Credential Manager Modal */}
      <CredentialManager
        isOpen={showCredentialManager}
        onClose={handleCredentialManagerClose}
        onCredentialsChange={loadCredentials}
      />
    </div>
  );
}
