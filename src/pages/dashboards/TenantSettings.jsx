// src/pages/dashboards/TenantSettings.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Bell, Shield, Globe, ArrowLeft, ToggleLeft, ToggleRight } from 'lucide-react';
import '../../styles/tenant-dashboard.css';

export default function TenantSettings() {
  const navigate = useNavigate();
  
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    darkMode: false,
    language: 'en',
    privacy: 'public'
  });

  const toggleSetting = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="tenant-page">
      <button className="back-btn" onClick={() => navigate('/dashboard')}>
        <ArrowLeft size={18} /> Back to Dashboard
      </button>

      <div className="tenant-page-header">
        <h1><Settings size={24} /> Settings</h1>
      </div>

      <div className="tenant-settings-container">
        <div className="tenant-settings-section">
          <h3><Bell size={18} /> Notifications</h3>
          <div className="tenant-setting-item">
            <div className="tenant-setting-info">
              <p>Email Notifications</p>
              <span>Receive updates via email</span>
            </div>
            <button 
              className="tenant-toggle-btn"
              onClick={() => toggleSetting('emailNotifications')}
            >
              {settings.emailNotifications ? (
                <ToggleRight size={24} color="#5a1a20" />
              ) : (
                <ToggleLeft size={24} color="#8a7274" />
              )}
            </button>
          </div>
          <div className="tenant-setting-item">
            <div className="tenant-setting-info">
              <p>Push Notifications</p>
              <span>Receive push notifications on your device</span>
            </div>
            <button 
              className="tenant-toggle-btn"
              onClick={() => toggleSetting('pushNotifications')}
            >
              {settings.pushNotifications ? (
                <ToggleRight size={24} color="#5a1a20" />
              ) : (
                <ToggleLeft size={24} color="#8a7274" />
              )}
            </button>
          </div>
        </div>

        <div className="tenant-settings-section">
          <h3><Globe size={18} /> Preferences</h3>
          <div className="tenant-setting-item">
            <div className="tenant-setting-info">
              <p>Dark Mode</p>
              <span>Switch between light and dark theme</span>
            </div>
            <button 
              className="tenant-toggle-btn"
              onClick={() => toggleSetting('darkMode')}
            >
              {settings.darkMode ? (
                <ToggleRight size={24} color="#5a1a20" />
              ) : (
                <ToggleLeft size={24} color="#8a7274" />
              )}
            </button>
          </div>
          <div className="tenant-setting-item">
            <div className="tenant-setting-info">
              <p>Language</p>
              <span>Select your preferred language</span>
            </div>
            <select 
              value={settings.language}
              onChange={(e) => setSettings(prev => ({ ...prev, language: e.target.value }))}
              className="tenant-select"
            >
              <option value="en">English</option>
              <option value="sw">Swahili</option>
            </select>
          </div>
        </div>

        <div className="tenant-settings-section">
          <h3><Shield size={18} /> Privacy</h3>
          <div className="tenant-setting-item">
            <div className="tenant-setting-info">
              <p>Profile Visibility</p>
              <span>Control who can see your profile</span>
            </div>
            <select 
              value={settings.privacy}
              onChange={(e) => setSettings(prev => ({ ...prev, privacy: e.target.value }))}
              className="tenant-select"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}