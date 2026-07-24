// components/dashboard/AgentCredentialsSection.jsx
import { useState, useEffect, useCallback } from 'react';
import { FileText, Upload, ExternalLink, Clock, CheckCircle2, XCircle, UserPlus, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import AddTeamMemberModal from './AddTeamMemberModal';

const CREDENTIAL_TYPE_LABEL = {
  gazettement_certificate: 'Gazettement certificate',
  id_document: 'ID document',
  business_permit: 'Business permit',
  other: 'Other',
};

const STATUS_META = {
  pending:  { label: 'Pending review', icon: Clock,        className: 'doc-status--pending' },
  verified: { label: 'Verified',       icon: CheckCircle2, className: 'doc-status--verified' },
  rejected: { label: 'Rejected',       icon: XCircle,       className: 'doc-status--rejected' },
};

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_BYTES = 15 * 1024 * 1024;

export default function AgentCredentialsSection() {
  const { profile } = useAuth();

  // ---- Credentials ----
  const [credentials, setCredentials] = useState([]);
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [credentialsError, setCredentialsError] = useState(null);
  const [uploadType, setUploadType] = useState('gazettement_certificate');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [openingId, setOpeningId] = useState(null);

  // ---- Team ----
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addError, setAddError] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const fetchCredentials = useCallback(async () => {
    if (!profile?.id) return;
    setCredentialsLoading(true);
    const { data, error } = await supabase
      .schema('marketplace')
      .from('agent_credentials')
      .select('*')
      .eq('agent_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) {
      setCredentialsError(error.message);
    } else {
      setCredentials(data || []);
      setCredentialsError(null);
    }
    setCredentialsLoading(false);
  }, [profile?.id]);

  const fetchTeam = useCallback(async () => {
    if (!profile?.id) return;
    setMembersLoading(true);
    const { data, error } = await supabase
      .schema('marketplace')
      .from('team_members')
      .select('*')
      .eq('agent_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) {
      setMembersError(error.message);
    } else {
      setMembers(data || []);
      setMembersError(null);
    }
    setMembersLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchCredentials(); }, [fetchCredentials]);
  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !profile?.id) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError('Only PDF, JPEG, or PNG files are allowed.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError('File too large — max 15MB.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('agentId', profile.id);
      formData.append('credentialType', uploadType);

      const { data, error: fnError } = await supabase.functions.invoke(
        'upload-agent-credential',
        { body: formData }
      );

      if (fnError) throw new Error(fnError.message || 'Upload failed');
      setCredentials((prev) => [data.credential, ...prev]);
    } catch (err) {
      console.error(err);
      setUploadError(err.message || 'Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleView(cred) {
    setOpeningId(cred.id);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-credential-url', {
        body: { credentialId: cred.id },
      });
      if (fnError) throw new Error(fnError.message || 'Could not open document');
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error(err);
      setCredentialsError(err.message || 'Could not open document.');
    } finally {
      setOpeningId(null);
    }
  }

  async function handleAddMember(values) {
    const { error } = await supabase
      .schema('marketplace')
      .from('team_members')
      .insert({ agent_id: profile.id, ...values, status: 'active' });

    if (error) {
      setAddError(error.message);
      return { ok: false, error: error.message };
    }
    setAddError(null);
    await fetchTeam();
    return { ok: true };
  }

  async function handleRemoveMember(id) {
    setRemovingId(id);
    const { error } = await supabase
      .schema('marketplace')
      .from('team_members')
      .delete()
      .eq('id', id);
    setRemovingId(null);
    if (error) {
      setMembersError(error.message);
      return;
    }
    await fetchTeam();
  }

  return (
    <div className="settings-section">
      {/* ---------- Credentials block ---------- */}
      <div className="financials-block">
        <h3 className="settings-block-title">Credentials</h3>

        <div className="documents-upload-row">
          <select value={uploadType} onChange={(e) => setUploadType(e.target.value)}>
            {Object.entries(CREDENTIAL_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <label className="documents-upload-btn">
            {uploading ? 'Uploading…' : <><Upload size={15} /> Upload credential</>}
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={handleFileChange}
              disabled={uploading}
              hidden
            />
          </label>
        </div>
        {uploadError && <p className="dashboard-error">{uploadError}</p>}

        <div className="documents-list">
          {credentialsLoading ? (
            <p className="agent-picker-empty">Loading credentials…</p>
          ) : credentialsError ? (
            <p className="dashboard-error">{credentialsError}</p>
          ) : credentials.length === 0 ? (
            <p className="agent-picker-empty">No credentials uploaded yet.</p>
          ) : (
            credentials.map((cred) => {
              const status = STATUS_META[cred.status] || STATUS_META.pending;
              const StatusIcon = status.icon;
              return (
                <div key={cred.id} className="document-row">
                  <FileText size={18} className="document-row-icon" />
                  <div className="document-row-text">
                    <p className="document-row-name">{cred.file_name}</p>
                    <p className="document-row-meta">
                      {CREDENTIAL_TYPE_LABEL[cred.credential_type] || cred.credential_type}
                      {cred.expires_at && ` · Expires ${new Date(cred.expires_at).toLocaleDateString()}`}
                    </p>
                    {cred.status === 'rejected' && cred.rejection_reason && (
                      <p className="document-row-rejection">Rejected: {cred.rejection_reason}</p>
                    )}
                  </div>
                  <span className={`doc-status ${status.className}`}>
                    <StatusIcon size={13} /> {status.label}
                  </span>
                  <button
                    type="button"
                    className="document-view-btn"
                    onClick={() => handleView(cred)}
                    disabled={openingId === cred.id}
                  >
                    <ExternalLink size={14} /> {openingId === cred.id ? 'Opening…' : 'View'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ---------- Team block ---------- */}
      <div className="financials-block">
        <div className="section-card-header" style={{ marginBottom: 14 }}>
          <div className="section-card-heading">
            <h3 className="settings-block-title" style={{ margin: 0 }}>Team</h3>
          </div>
          <button
            type="button"
            className="section-card-action"
            onClick={() => { setAddError(null); setAddModalOpen(true); }}
          >
            <UserPlus size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
            Add team member
          </button>
        </div>

        {membersLoading ? (
          <p className="agent-picker-empty">Loading team…</p>
        ) : membersError ? (
          <p className="dashboard-error">{membersError}</p>
        ) : members.length === 0 ? (
          <p className="agent-picker-empty">No team members added yet.</p>
        ) : (
          <ul className="list-rows">
            {members.map((m) => (
              <li key={m.id} className="list-row">
                <div>
                  <p className="list-row-title">{m.full_name}</p>
                  <p className="list-row-meta">
                    {[m.role, m.phone, m.email].filter(Boolean).join(' · ') || 'No details added'}
                  </p>
                </div>
                <div className="list-row-actions">
                  <span className={`badge ${m.status === 'active' ? 'badge--success' : 'badge--neutral'}`}>
                    {m.status === 'active' ? 'Active' : m.status === 'invited' ? 'Invited' : 'Inactive'}
                  </span>
                  <button
                    type="button"
                    className="list-row-photos-btn"
                    onClick={() => handleRemoveMember(m.id)}
                    disabled={removingId === m.id}
                  >
                    <X size={13} style={{ marginRight: 3, verticalAlign: -2 }} />
                    {removingId === m.id ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {addModalOpen && (
        <AddTeamMemberModal
          error={addError}
          onSave={handleAddMember}
          onClose={() => setAddModalOpen(false)}
        />
      )}
    </div>
  );
}