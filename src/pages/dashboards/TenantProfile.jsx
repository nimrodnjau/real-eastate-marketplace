// src/pages/dashboards/TenantProfile.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { User, Mail, Phone, MapPin, ArrowLeft, Save } from 'lucide-react';
import '../../styles/tenant-dashboard.css';

export default function TenantProfile() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
    location: profile?.location || '',
    bio: profile?.bio || ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { error } = await supabase
        .schema('marketplace')
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          location: formData.location,
          bio: formData.bio
        })
        .eq('id', profile.id);

      if (!error) {
        alert('Profile updated successfully!');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tenant-page">
      <button className="back-btn" onClick={() => navigate('/dashboard')}>
        <ArrowLeft size={18} /> Back to Dashboard
      </button>

      <div className="tenant-page-header">
        <h1><User size={24} /> Profile Settings</h1>
      </div>

      <div className="tenant-profile-container">
        <div className="tenant-profile-avatar">
          <img 
            src={profile?.avatar_url || 'https://placehold.co/120x120?text=👤'} 
            alt={profile?.full_name}
          />
        </div>

        <form onSubmit={handleSubmit} className="tenant-form">
          <div className="tenant-form-group">
            <label>Full Name</label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="tenant-form-group">
            <label><Mail size={16} /> Email</label>
            <input
              type="email"
              value={formData.email}
              disabled
              className="tenant-form-disabled"
            />
          </div>

          <div className="tenant-form-group">
            <label><Phone size={16} /> Phone Number</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+254 700 000 000"
            />
          </div>

          <div className="tenant-form-group">
            <label><MapPin size={16} /> Location</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="Nairobi, Kenya"
            />
          </div>

          <div className="tenant-form-group">
            <label>Bio</label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              rows={4}
              placeholder="Tell us about yourself..."
            />
          </div>

          <button type="submit" className="tenant-save-btn" disabled={loading}>
            <Save size={18} /> {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}